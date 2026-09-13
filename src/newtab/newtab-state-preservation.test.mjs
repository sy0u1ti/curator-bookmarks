import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-newtab-state-'))
let context
const failures = []
const navigationEvents = []
const consoleErrors = []
try {
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: process.env.CURATOR_HEADLESS === '1',
    viewport: { width: 1440, height: 1000 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  await context.route('https://example.test/**', (route) => route.fulfill({ status: 200, body: 'Local bookmark regression fixture' }))
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 })
  const extensionId = new URL(worker.url()).host
  const newtabUrl = `chrome-extension://${extensionId}/src/newtab/newtab.html`
  const seed = await worker.evaluate(async () => {
    const tree = await chrome.bookmarks.getTree()
    const bar = tree[0].children.find((node) => node.folderType === 'bookmarks-bar') || tree[0].children[0]
    const source = await chrome.bookmarks.create({ parentId: bar.id, title: 'State regression source' })
    const nested = await chrome.bookmarks.create({ parentId: source.id, title: 'Keep this folder first' })
    const a = await chrome.bookmarks.create({ parentId: source.id, title: 'Audit Alpha', url: 'https://example.test/alpha' })
    const b = await chrome.bookmarks.create({ parentId: source.id, title: 'Audit Beta', url: 'https://example.test/beta' })
    const c = await chrome.bookmarks.create({ parentId: source.id, title: 'Audit Gamma', url: 'https://example.test/gamma' })
    const outside = await chrome.bookmarks.create({ parentId: bar.id, title: 'Unselected source' })
    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [source.id], browseMode: 'expanded' },
      curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013' },
      curatorBookmarkNewTabIconSettings: { showTitles: true },
      curatorBookmarkNewTabTimeSettings: { enabled: true, showSeconds: false },
      curatorBookmarkNewTabSearchSettings: { enabled: true, webSearchEnabled: true, openInNewTab: true },
      curatorBookmarkNewTabWorkspaceSettings: { activeWorkspaceId: 'default', workspaces: [{ id: 'default', pinnedIds: [] }] }
    })
    return { source: source.id, nested: nested.id, a: a.id, b: b.id, c: c.id, outside: outside.id }
  })

  async function openPage(existing) {
    const page = existing || await context.newPage()
    if (!existing) {
      page.on('pageerror', (error) => failures.push(error.message))
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigationEvents.push(frame.url()) })
      await page.addInitScript(() => {
        window.__newtabNavigationProbe = []
        for (const type of ['pointerdown', 'pointerup', 'click', 'focusin', 'focusout']) document.addEventListener(type, (event) => {
          const target = event.target instanceof Element ? event.target.closest('button,a,input') : null
          window.__newtabNavigationProbe.push({ type, target: target?.getAttribute('aria-label') || target?.id || target?.tagName, now: performance.now() })
        }, true)
        const open = window.open
        window.open = function (...args) {
          window.__newtabNavigationProbe.push({ type: 'open', url: args[0], active: navigator.userActivation.isActive, now: performance.now() })
          return Reflect.apply(open, window, args)
        }
      })
    }
    await page.goto(newtabUrl, { waitUntil: 'domcontentloaded' })
    await page.bringToFront()
    await page.locator(`.bookmark-tile[data-bookmark-id="${seed.a}"]`).first().waitFor({ timeout: 15000 })
    await page.waitForFunction(() => performance.getEntriesByName('newtab.searchReady', 'mark').length > 0)
    return page
  }
  async function settings(page, group) {
    await page.bringToFront()
    await page.locator('#newtab-settings-trigger').click()
    await page.locator(`#settings-tab-${group}`).click()
  }
  async function readStorage(key) {
    return worker.evaluate(async (key) => (await chrome.storage.local.get(key))[key], key)
  }
  const a = await openPage()
  const b = await openPage()

  await b.emulateMedia({ reducedMotion: 'reduce' })
  await b.locator(`.bookmark-tile[data-bookmark-id="${seed.c}"]`).first().click({ button: 'right' })
  await expect(b.locator('.bookmark-edit-menu')).toBeVisible()
  await b.keyboard.press('Escape')
  await expect(b.locator('.bookmark-edit-menu'), 'Closing without CSS transitions must release the menu and its focus scope.').toHaveCount(0)
  await b.locator('.folder-section-add').first().click()
  await expect(b.locator('.bookmark-add-menu')).toBeVisible()
  await b.keyboard.press('Escape')
  await expect(b.locator('.bookmark-add-menu'), 'The add menu must also unmount when motion is disabled.').toHaveCount(0)
  await b.emulateMedia({ reducedMotion: 'no-preference' })

  // Both mutations must be pending together, but a headed browser has only one
  // foreground tab. Queue the real foreground clicks behind a temporary lock.
  await worker.evaluate(() => new Promise((ready) => {
    void navigator.locks.request('curator:local-storage-transaction', () => new Promise((release) => {
      globalThis.__releaseNewtabPinTestLock = release
      ready()
    }))
  }))
  try {
    await a.bringToFront()
    await a.locator(`.bookmark-tile[data-bookmark-id="${seed.a}"]`).first().click({ button: 'right' })
    await a.locator('.bookmark-edit-menu [aria-label^="将书签设为固定入口"]').click()
    await b.bringToFront()
    await b.locator(`.bookmark-tile[data-bookmark-id="${seed.b}"]`).first().click({ button: 'right' })
    await b.locator('.bookmark-edit-menu [aria-label^="将书签设为固定入口"]').click()
  } finally {
    await worker.evaluate(() => {
      globalThis.__releaseNewtabPinTestLock?.()
      delete globalThis.__releaseNewtabPinTestLock
    })
  }
  await expect.poll(async () => (await readStorage('curatorBookmarkNewTabWorkspaceSettings')).workspaces[0].pinnedIds.sort())
    .toEqual([seed.a, seed.b].sort())
  await a.bringToFront()
  await expect(a.locator('.bookmark-edit-menu')).toContainText('已添加固定入口')
  await a.keyboard.press('Escape')
  await expect(a.locator('.bookmark-edit-menu:not(.is-closing)')).toHaveCount(0)
  await b.bringToFront()
  await expect(b.locator('.bookmark-edit-menu')).toContainText('已添加固定入口')
  await b.keyboard.press('Escape')
  await expect(b.locator('.bookmark-edit-menu:not(.is-closing)')).toHaveCount(0)

  await a.bringToFront()
  const firstTile = a.locator(`.bookmark-tile[data-bookmark-id="${seed.a}"][data-folder-id="${seed.source}"]`).first()
  await firstTile.focus()
  await firstTile.press('Alt+ArrowRight')
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.bookmarks.getChildren(id)).map((node) => node.id), seed.source))
    .toEqual([seed.nested, seed.b, seed.a, seed.c])
  await expect(a.locator('[data-browse-mode="expanded"][aria-busy]')).toHaveAttribute('aria-busy', 'false')
  await expect(a.getByRole('status').filter({ hasText: '书签已移动到' })).toContainText('第 2 位')
  assert.equal(await firstTile.evaluate((tile) => new Promise((resolve) => requestAnimationFrame(() => {
    resolve(document.activeElement === tile)
  }))), true, 'Wait for the completed keyboard reorder’s scheduled focus return before starting a search.')

  await worker.evaluate(async (id) => {
    await chrome.bookmarks.update(id, { title: 'Renamed unique needle', url: 'https://example.test/updated' })
  }, seed.a)
  const search = a.locator('input[aria-controls="newtab-search-suggestions"]')
  await search.fill('Renamed unique needle')
  const renamedOption = a.getByRole('option', { name: /Renamed unique needle/ })
  await expect(renamedOption).toBeVisible()
  await search.press('ArrowDown')
  await expect(a.locator('[role="option"][aria-selected="true"]')).toHaveCount(1)
  const searchSettingsBeforeOpen = await readStorage('curatorBookmarkNewTabSearchSettings')
  assert.equal(searchSettingsBeforeOpen.openInNewTab, true, `The seeded search opening preference must remain enabled: ${JSON.stringify(searchSettingsBeforeOpen)}`)
  const beforeOpenState = await a.evaluate(() => ({
    visible: document.visibilityState,
    focused: document.hasFocus(),
    userActivation: navigator.userActivation.isActive,
    activeElement: document.activeElement?.getAttribute('aria-controls'),
    target: document.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('aria-label'),
    targetUrl: document.querySelector('[role="option"][aria-selected="true"] .newtab-search-suggestion-meta')?.textContent
  }))
  assert.equal(beforeOpenState.focused, true, `The search scenario must run in its foreground tab: ${JSON.stringify(beforeOpenState)}`)
  const opening = await Promise.allSettled([
    context.waitForEvent('page'),
    renamedOption.click()
  ])
  try {
    if (opening[1].status === 'rejected') throw opening[1].reason
    if (opening[0].status === 'rejected') throw opening[0].reason
    await opening[0].value.waitForURL('https://example.test/updated')
    await opening[0].value.close()
  } catch (error) {
    const state = await a.evaluate(() => ({
      visible: document.visibilityState,
      focused: document.hasFocus(),
      userActivation: navigator.userActivation.isActive,
      activeElement: document.activeElement?.outerHTML?.slice(0, 300),
      searchValue: document.querySelector('input[aria-controls="newtab-search-suggestions"]')?.value,
      options: [...document.querySelectorAll('[role="option"]')].map((element) => ({
        label: element.getAttribute('aria-label'),
        rect: element.getBoundingClientRect().toJSON(),
        hidden: Boolean(element.closest('[hidden],[inert]'))
      })),
      actions: window.__newtabNavigationProbe?.slice(-12)
    })).catch(() => null)
    throw new Error(`Search result navigation failed: ${JSON.stringify({
      actionResults: opening.map((result) => result.status === 'rejected' ? String(result.reason) : 'fulfilled'),
      searchSettingsBeforeOpen, beforeOpenState,
      searchSettingsAfterOpen: await readStorage('curatorBookmarkNewTabSearchSettings'),
      pages: context.pages().map((page) => page.url()), navigationEvents, failures, consoleErrors: consoleErrors.slice(-8), state
    })}`, { cause: error })
  }

  const outsideBookmark = await worker.evaluate(async (parentId) => {
    return chrome.bookmarks.create({ parentId, title: 'Outside unique needle', url: 'https://example.test/outside' })
  }, seed.outside)
  await a.bringToFront()
  await search.fill('Outside unique needle')
  await expect(a.getByRole('option', { name: /Outside unique needle/ })).toBeVisible()
  await worker.evaluate(async (id) => chrome.bookmarks.remove(id), outsideBookmark.id)
  await expect(a.getByRole('option', { name: /Outside unique needle/ })).toHaveCount(0)
  await search.press('Escape')

  const removedFolder = await worker.evaluate(async (parentId) => {
    const folder = await chrome.bookmarks.create({ parentId, title: 'Remove pinned subtree' })
    const nested = await chrome.bookmarks.create({ parentId: folder.id, title: 'Nested pinned subtree' })
    const bookmark = await chrome.bookmarks.create({ parentId: nested.id, title: 'Pinned descendant', url: 'https://example.test/descendant' })
    const key = 'curatorBookmarkNewTabWorkspaceSettings'
    const settings = (await chrome.storage.local.get(key))[key]
    settings.workspaces[0].pinnedIds.push(bookmark.id)
    await chrome.storage.local.set({ [key]: settings })
    return folder.id
  }, seed.outside)
  await b.bringToFront()
  await b.locator(`.bookmark-tile[data-bookmark-id="${seed.c}"]`).first().click({ button: 'right' })
  await Promise.all([
    worker.evaluate(async (id) => chrome.bookmarks.removeTree(id), removedFolder),
    b.locator('.bookmark-edit-menu [aria-label^="将书签设为固定入口"]').click()
  ])
  await expect.poll(async () => (await readStorage('curatorBookmarkNewTabWorkspaceSettings')).workspaces[0].pinnedIds.sort())
    .toEqual([seed.a, seed.b, seed.c].sort())
  await b.keyboard.press('Escape')
  await expect(b.locator('.bookmark-edit-menu')).toHaveCount(0)

  await settings(a, 'search')
  await settings(b, 'search')
  await a.bringToFront()
  await a.locator('#search-placeholder').fill('两个页面保留设置')
  await b.bringToFront()
  await b.locator('[role="switch"][aria-labelledby="search-open-new-tab-label"]').click()
  await expect.poll(async () => {
    const value = await readStorage('curatorBookmarkNewTabSearchSettings')
    return { placeholder: value.placeholder, openInNewTab: value.openInNewTab }
  }).toEqual({ placeholder: '两个页面保留设置', openInNewTab: false })
  await expect(b.locator('#search-placeholder')).toHaveValue('两个页面保留设置')

  // Dispatch the user edit and navigation in one task, before the 260 ms save
  // timer can fire. This exercises a real pagehide rather than calling a helper.
  await a.bringToFront()
  await a.evaluate(() => {
    const input = document.querySelector('#search-placeholder')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '页面离开也保存')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    location.assign('about:blank')
  })
  await a.waitForURL('about:blank')
  await expect.poll(async () => (await readStorage('curatorBookmarkNewTabSearchSettings')).placeholder).toBe('页面离开也保存')

  await openPage(a)
  await settings(a, 'appearance')
  await a.locator('[role="switch"][aria-labelledby="icon-show-titles-label"]').waitFor({ state: 'visible' })
  await a.evaluate(() => {
    document.querySelector('[role="switch"][aria-labelledby="icon-show-titles-label"]').click()
    location.assign('about:blank')
  })
  await a.waitForURL('about:blank')
  await expect.poll(async () => (await readStorage('curatorBookmarkNewTabIconSettings')).showTitles).toBe(false)

  await openPage(a)
  await settings(a, 'appearance')
  await a.locator('[role="switch"][aria-labelledby="time-show-seconds-label"]').scrollIntoViewIfNeeded()
  await a.evaluate(() => {
    document.querySelector('[role="switch"][aria-labelledby="time-show-seconds-label"]').click()
    location.assign('about:blank')
  })
  await a.waitForURL('about:blank')
  await expect.poll(async () => (await readStorage('curatorBookmarkNewTabTimeSettings')).showSeconds).toBe(true)
  await expect.poll(() => worker.evaluate(async () => Object.keys(await chrome.storage.local.get(null))
    .filter((key) => key.startsWith('curatorNewTabPendingSettings:')).length)).toBe(0)
  assert.deepEqual(failures, [], 'State synchronization must not introduce page errors.')
  console.log('New Tab two-page preference/pin preservation, mixed-sibling reorder, search freshness, and immediate exit tests passed.')
} finally {
  await context?.close()
  assert.ok(path.resolve(profilePath).startsWith(`${path.resolve(tmpdir())}${path.sep}`))
  await rm(profilePath, { recursive: true, force: true })
}
