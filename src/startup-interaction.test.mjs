import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-startup-interaction-'))
let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium', headless: true,
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  await worker.evaluate(async () => chrome.storage.local.set({
    curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013', maskEnabled: false },
    curatorBookmarkNewTabFolderSettings: { selectedFolderIds: ['1'], browseMode: 'expanded' },
    curatorBookmarkOnboardingState: { completed: true }
  }))

  async function openSurface(surface) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ surface }) => {
      const metric = window.__startup = { treeReads: 0, faviconBuilds: 0, firstFaviconBuilds: null, openedTabs: [] }
      const bookmark = (id, parentId, index) => ({ id: String(id), parentId, index, title: `Bookmark ${id}`, url: `https://example.com/article/${id}` })
      const children = Array.from({ length: 40 }, (_, index) => bookmark(100 + index, '1', index))
      for (let folder = 0; folder < 24; folder++) {
        const id = String(1000 + folder)
        children.push({ id, parentId: '1', title: `Folder ${folder}`, children: Array.from({ length: 64 }, (_, index) => bookmark(10000 + folder * 100 + index, id, index)) })
      }
      const tree = [{ id: '0', title: '', children: [{ id: '1', parentId: '0', title: 'Bookmarks bar', children }, { id: '2', parentId: '0', title: 'Other bookmarks', children: [] }] }]
      const pending = []
      let released = false
      chrome.bookmarks.getTree = callback => {
        metric.treeReads++
        metric.firstTreeRead ??= performance.now()
        return new Promise(resolve => {
          const finish = () => { callback?.(tree); resolve(tree) }
          if (released) queueMicrotask(finish)
          else pending.push(finish)
        })
      }
      window.__releaseStartupTree = () => {
        released = true
        for (const finish of pending.splice(0)) finish()
      }
      const getURL = chrome.runtime.getURL.bind(chrome.runtime)
      chrome.runtime.getURL = resource => {
        if (resource === '/_favicon/') metric.faviconBuilds++
        return getURL(resource)
      }
      chrome.tabs.create = (options, callback) => {
        metric.openedTabs.push(options)
        const tab = { id: 123, ...options }
        callback?.(tab)
        return Promise.resolve(tab)
      }
      window.close = () => { metric.closed = true }
      new MutationObserver(() => {
        if (metric.firstFaviconBuilds === null && document.querySelector('.bookmark-tile')) {
          metric.firstFaviconBuilds = metric.faviconBuilds
        }
        const input = document.getElementById('popup-preboot-search-input')
        if (surface === 'popup' && input && !metric.prebootTyped) {
          metric.prebootTyped = true
          input.value = 'Bookmark 100'
          input.focus()
          input.setSelectionRange(4, 4)
        }
      }).observe(document, { childList: true, subtree: true })
    }, { surface })
    await page.goto(surface === 'newtab' ? 'chrome://newtab/' : `chrome-extension://${extensionId}/src/popup/popup.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__startup?.treeReads > 0)
    return { page, errors }
  }

  const newtab = await openSurface('newtab')
  await newtab.page.waitForFunction(() => performance.getEntriesByName('newtab.domContentLoaded').length > 0)
  assert.equal(await newtab.page.evaluate(() => window.__startup.treeReads), 1)
  assert.ok(await newtab.page.evaluate(() => window.__startup.firstTreeRead < performance.getEntriesByName('newtab.domContentLoaded')[0].startTime), 'Newtab must start its browser read before the React entry executes.')
  await newtab.page.evaluate(() => window.__releaseStartupTree())
  await newtab.page.locator('.bookmark-tile').first().waitFor()
  const newtabInitial = await newtab.page.evaluate(() => window.__startup)
  assert.equal(newtabInitial.treeReads, 1, 'Newtab must consume the preboot request without a duplicate read.')
  assert.ok(newtabInitial.firstFaviconBuilds <= 100, `Only the initial visible batch needs favicon URLs: ${JSON.stringify(newtabInitial)}`)
  await newtab.page.waitForTimeout(700)
  assert.equal(await newtab.page.locator('#newtab-settings-drawer').count(), 0, 'The unused settings drawer must remain unmounted after idle startup.')

  // This opens settings through the controller, without clicking the trigger
  // that requests the lazy host. It protects against a readiness deadlock.
  const search = newtab.page.locator('.newtab-search-input')
  await search.fill('/settings')
  await newtab.page.locator('.newtab-search-suggestion').filter({ hasText: '打开设置' }).click()
  await newtab.page.locator('#newtab-settings-drawer .settings-drawer-panel').waitFor({ state: 'visible' })
  await newtab.page.keyboard.press('Escape')
  await newtab.page.getByRole('button', { name: '打开设置', exact: true }).waitFor({ state: 'visible' })
  await newtab.page.getByRole('button', { name: '打开设置', exact: true }).click()
  await newtab.page.locator('#newtab-settings-drawer .settings-drawer-panel').waitFor({ state: 'visible' })
  assert.deepEqual(newtab.errors, [])
  await newtab.page.close()

  const popup = await openSurface('popup')
  const input = popup.page.locator('#search-input')
  await input.waitFor({ state: 'visible' })
  assert.equal(await input.inputValue(), 'Bookmark 100', 'React must adopt text entered in the classic preboot input.')
  assert.deepEqual(await input.evaluate(element => [element.selectionStart, element.selectionEnd]), [4, 4], 'Adoption must preserve the text cursor.')
  assert.equal(await popup.page.evaluate(() => window.__startup.treeReads), 1)
  assert.ok(await popup.page.evaluate(() => window.__startup.firstTreeRead < performance.getEntriesByName('popup.domContentLoaded')[0].startTime), 'Popup must start its browser read before controller initialization.')

  // Actual input and caret edits work while the bookmark RPC is still pending.
  await input.press('End')
  await input.press('0')
  assert.equal(await input.inputValue(), 'Bookmark 1000')
  await popup.page.evaluate(() => window.__releaseStartupTree())
  await popup.page.locator('#content .t-skel[data-state="ready"]').waitFor()
  await popup.page.waitForFunction(() => document.querySelector('#content')?.textContent.includes('Bookmark 10000'))
  assert.equal(await input.inputValue(), 'Bookmark 1000', 'Hydration must retain edits made while data was loading.')
  assert.equal(await popup.page.evaluate(() => window.__startup.treeReads), 1)
  await input.press('ArrowDown')
  await input.press('Enter')
  await popup.page.waitForFunction(() => window.__startup.openedTabs.length > 0)
  assert.match((await popup.page.evaluate(() => window.__startup.openedTabs))[0].url, /^https:\/\/example\.com\/article\/1000\d$/)
  assert.deepEqual(popup.errors, [])
  console.log('Startup browser interactions passed: early single reads, lazy favicons/settings, preboot caret, pending-data typing, and keyboard search.')
} finally {
  await context?.close()
  if (path.dirname(profilePath) === path.resolve(tmpdir()) && path.basename(profilePath).startsWith('curator-startup-interaction-')) {
    await rm(profilePath, { recursive: true, force: true })
  }
}
