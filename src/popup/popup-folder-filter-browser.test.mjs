import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

// Exercise the folder filter against the real popup and the real bookmarks API.
const extensionPath = path.resolve('dist')
const profile = await mkdtemp(path.join(tmpdir(), 'curator-folder-filter-'))
const output = path.resolve('output/playwright/popup-folder-filter')
let context

try {
  await mkdir(output, { recursive: true })
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 800, height: 600 },
    args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
  })
  context.setDefaultTimeout(10000)
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  await worker.evaluate(async () => {
    const market = await chrome.bookmarks.create({ parentId: '1', title: '市场' })
    await chrome.bookmarks.create({ parentId: market.id, title: 'AI API' })
    await chrome.bookmarks.create({ parentId: market.id, title: '卡网' })
    const stores = await chrome.bookmarks.create({ parentId: '1', title: '店' })
    await chrome.bookmarks.create({ parentId: stores.id, title: '小店 A' })
    const github = await chrome.bookmarks.create({ parentId: '1', title: 'GitHub 存档' })
    await chrome.bookmarks.create({ parentId: github.id, title: 'Repos' })
    await chrome.bookmarks.create({ parentId: '1', title: '书签栏归档' })
  })

  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`)

  // The workspace renders a skeleton layer and a content layer; always act on
  // the live one so the assertions cannot accidentally measure placeholders.
  const filter = page.locator('.t-skel-content #popup-folder-filter-input')
  const tree = page.locator('.t-skel-content .popup-folder-tree')
  const header = page.locator('.t-skel-content aside[aria-label="文件夹树"] > header')
  await filter.waitFor()

  // The filter must not grow the existing pane header or shift the panes.
  const headerHeight = await header.evaluate((element) => element.getBoundingClientRect().height)
  assert.equal(Math.round(headerHeight), 42, `the folder pane header must stay 42px, got ${headerHeight}`)
  const asideBox = await page.locator('.t-skel-content aside[aria-label="文件夹树"]').boundingBox()
  assert.equal(Math.round(asideBox.width), 221, `the folder pane must keep its 221px column, got ${asideBox.width}`)

  const titles = async () => tree.locator('[role="treeitem"]').evaluateAll(
    (rows) => rows.map((row) => row.textContent?.trim() || '')
  )
  const before = await titles()
  assert.ok(before.some((title) => title.startsWith('GitHub 存档')), 'the unfiltered tree must list all folders')

  // The popup refreshes its catalog once after mount; filter after that settles
  // so the assertions measure the final tree rather than the initial snapshot.
  await page.waitForFunction(() => {
    const workspace = document.querySelector('.popup-workspace-reveal')
    return workspace?.getAttribute('data-state') === 'ready' &&
      document.querySelectorAll('.t-skel-content .popup-folder-tree [role="treeitem"]').length >= 4
  })
  // Click before typing: the popup autofocuses the main search on its first
  // commit, so a programmatic fill can otherwise race that focus handoff.
  await filter.click()
  await page.keyboard.type('市场')
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.t-skel-content .popup-folder-tree [role="treeitem"]')]
    return rows.length && rows.every((row) => !row.textContent.includes('GitHub'))
  })
  const filtered = await titles()
  assert.ok(filtered.some((title) => title.startsWith('市场')), 'the matching folder must remain')
  assert.ok(!filtered.some((title) => title.includes('GitHub')), 'unrelated folders must be hidden')
  assert.ok(filtered[0].startsWith('书签栏'), 'the pinned root row must stay reachable while filtering')
  assert.equal(
    await page.locator('.t-skel-content [data-folder-filter-empty]').count(),
    0,
    'a query with matches must not show the empty state'
  )

  // Ancestors of a match stay visible but recede.
  await filter.fill('AI')
  await page.waitForFunction(() => document.querySelectorAll('.popup-folder-tree [role="treeitem"]').length > 0)
  const dimmed = await tree.locator('[role="treeitem"]').evaluateAll(
    (rows) => rows.filter((row) => Number(getComputedStyle(row).opacity) < 1).length
  )
  assert.ok(dimmed >= 1, 'ancestors kept only for hierarchy must be dimmed')
  assert.equal(
    await page.locator('.t-skel-content aside[aria-label="文件夹树"] header [aria-live]').innerText(),
    '1 个匹配文件夹',
    'the live region must count direct matches only, not dimmed ancestors'
  )

  // Pinyin initials resolve asynchronously without blocking the first paint.
  await filter.fill('sc')
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.popup-folder-tree [role="treeitem"]')]
    return rows.some((row) => row.textContent.includes('市场'))
  })

  // No matches: the tree reports it and the root stays available.
  await filter.fill('zzzznotfound')
  const emptyNotice = page.locator('.t-skel-content [data-folder-filter-empty]')
  await emptyNotice.waitFor()
  assert.match(await emptyNotice.innerText(), /未找到文件夹/)
  const emptyRows = await titles()
  assert.deepEqual(emptyRows.map((title) => title.replace(/\d+$/, '')), ['书签栏'], 'only the root row remains with no matches')

  // Enter applies the highlighted folder, clears the query and returns to the list.
  await filter.fill('市场')
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.popup-folder-tree [role="treeitem"]')]
    return rows.some((row) => row.getAttribute('aria-selected') === 'true')
  })
  await filter.press('Enter')
  await page.waitForFunction(() => document.querySelector('#popup-folder-filter-input')?.value === '')
  assert.equal(await filter.inputValue(), '', 'applying a folder must clear the filter query')
  await page.waitForFunction(() => {
    const caption = document.querySelector('#view-caption')?.textContent || ''
    return caption.includes('市场')
  })
  assert.notEqual(
    await page.evaluate(() => document.activeElement?.id || ''),
    'popup-folder-filter-input',
    'applying a folder must leave the filter so the bookmark list keeps keyboard control'
  )

  // Ctrl+F focuses and selects the query, matching the browser find shortcut.
  await filter.fill('市场')
  await filter.blur()
  await page.keyboard.press('Control+f')
  await page.waitForFunction(() => document.activeElement?.id === 'popup-folder-filter-input')
  const selection = await filter.evaluate((element) => [element.selectionStart, element.selectionEnd])
  assert.deepEqual(selection, [0, 2], 'Ctrl+F must select the existing query for replacement')

  // Escape clears the text first and only then leaves the field.
  await filter.press('Escape')
  await page.waitForFunction(() => document.querySelector('#popup-folder-filter-input')?.value === '')
  assert.equal(
    await page.evaluate(() => document.activeElement?.id || ''),
    'popup-folder-filter-input',
    'the first Escape must clear the text but keep focus in the field'
  )
  await filter.press('Escape')
  await page.waitForFunction(() => document.activeElement?.id !== 'popup-folder-filter-input')

  // ← walks bookmarks → folders → filter, and ↑↓ keep focus in the field while
  // the tree highlight moves across the matches.
  // Leave any editable field first: inside one, ← correctly stays a caret key.
  await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())
  await page.waitForFunction(() => !document.activeElement?.closest?.('input, textarea, [contenteditable="true"]'))
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await page.waitForFunction(() => document.activeElement?.id === 'popup-folder-filter-input')
  await filter.fill('店')
  await page.waitForFunction(() => {
    const selected = [...document.querySelectorAll('.t-skel-content .popup-folder-tree [aria-selected="true"]')]
    return selected.length === 1
  })
  await filter.press('ArrowDown')
  assert.equal(
    await page.evaluate(() => document.activeElement?.id || ''),
    'popup-folder-filter-input',
    'arrow keys must keep the caret in the filter while moving the tree highlight'
  )
  const highlighted = await tree.locator('[aria-selected="true"]').innerText()
  assert.match(highlighted, /小店 A|店/, 'arrow navigation must move the highlight across matches')
  await filter.press('Escape')
  await page.waitForFunction(() => document.querySelector('#popup-folder-filter-input')?.value === '')

  await page.screenshot({ path: path.join(output, 'folder-filter.png') })
  assert.deepEqual(errors, [])
  console.log('Popup folder filter browser test passed: header height, filtering, pinyin, Enter/Escape and Ctrl+F.')
} finally {
  await context?.close()
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()))
  await rm(profile, { recursive: true, force: true })
}
