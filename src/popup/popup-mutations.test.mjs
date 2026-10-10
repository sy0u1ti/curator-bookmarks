import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('output/playwright/popup-mutations')
await mkdir(output, { recursive: true })
await mkdir('.tmp-test', { recursive: true })
const profile = await mkdtemp(path.resolve('.tmp-test/popup-mutations-'))
const extension = path.resolve('dist')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 800, height: 600 },
  args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`]
})
context.setDefaultTimeout(10000)
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
const page = await context.newPage()
const errors = []
const report = {}
page.on('pageerror', error => errors.push(error.message))
try {
  const seed = await worker.evaluate(async () => {
    await chrome.storage.local.set({ curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false }, curatorBookmarkContentSnapshotSettings: { enabled: false } })
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '撤销测试目录' })
    const bookmarks = []
    for (const title of ['记录甲', '记录乙', '记录丙']) bookmarks.push(await chrome.bookmarks.create({ parentId: folder.id, title, url: `https://example.com/${encodeURIComponent(title)}` }))
    return { folder, bookmarks }
  })
  await page.addInitScript(bookmark => {
    const query = chrome.tabs.query.bind(chrome.tabs)
    chrome.tabs.query = (info, callback) => info.active && info.currentWindow
      ? callback([{ id: 77, active: true, url: bookmark.url, title: bookmark.title }])
      : query(info, callback)
    const create = chrome.bookmarks.create.bind(chrome.bookmarks)
    window.failNextRestore = false
    chrome.bookmarks.create = (...args) => {
      if (window.failNextRestore) { window.failNextRestore = false; throw new Error('测试恢复失败') }
      return create(...args)
    }
  }, seed.bookmarks[0])
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/popup/popup.html`)
  const search = page.locator('#search-input')
  const action = async (title, label) => {
    await search.fill(title)
    const row = page.getByRole('row').filter({ hasText: title })
    await row.hover()
    await row.getByRole('button', { name: '操作菜单', exact: true }).click()
    await row.getByRole('button', { name: `${label}：${title}`, exact: true }).click()
  }
  const exists = bookmark => worker.evaluate(url => chrome.bookmarks.search({ url }), bookmark.url)
  const remove = async bookmark => {
    await action(bookmark.title, '删除书签')
    await page.locator('#confirm-delete').click()
    await page.locator('#delete-modal').waitFor({ state: 'hidden' })
    assert.equal((await exists(bookmark)).length, 0)
  }

  const pin = page.locator('[data-current-page-action="pin-newtab"]')
  await pin.waitFor()
  await worker.evaluate(async bookmark => {
    await chrome.storage.local.set({ curatorBookmarkNewTabWorkspaceSettings: { activeWorkspaceId: 'default', workspaces: [{ id: 'default', name: 'Speed Dial', pinnedIds: [bookmark.id], createdAt: 1, updatedAt: 1 }] } })
  }, seed.bookmarks[0])
  await page.waitForFunction(() => document.querySelector('[data-current-page-action="pin-newtab"]')?.getAttribute('aria-pressed') === 'true')
  await pin.click()
  await page.waitForFunction(() => document.querySelector('[data-current-page-action="pin-newtab"]')?.getAttribute('aria-pressed') === 'false')
  await search.fill('externaltagkeyword')
  await page.getByText('未找到相关书签', { exact: true }).waitFor()
  await worker.evaluate(async bookmark => chrome.storage.local.set({ curatorBookmarkTagIndex: { version: 1, updatedAt: Date.now(), records: { [bookmark.id]: { bookmarkId: bookmark.id, url: bookmark.url, title: bookmark.title, tags: ['externaltagkeyword'], source: 'manual', updatedAt: Date.now() } } } }), seed.bookmarks[0])
  await page.getByRole('row').filter({ hasText: seed.bookmarks[0].title }).waitFor()
  report.liveMetadata = { tags: true, pins: true }

  await remove(seed.bookmarks[0])
  const olderToastId = await page.locator('[data-toast-id]').filter({ has: page.getByRole('button', { name: '撤销', exact: true }) }).getAttribute('data-toast-id')
  await remove(seed.bookmarks[1])
  const newerToastId = await page.locator(`[data-toast-id]:not([data-toast-id="${olderToastId}"])`).filter({ has: page.getByRole('button', { name: '撤销', exact: true }) }).getAttribute('data-toast-id')
  await page.locator(`[data-toast-id="${olderToastId}"]`).getByRole('button', { name: '撤销', exact: true }).click()
  await page.getByText('已撤销删除', { exact: true }).waitFor()
  assert.equal((await exists(seed.bookmarks[0])).length, 1, 'The older undo must restore its own bookmark')
  assert.equal((await exists(seed.bookmarks[1])).length, 0, 'The newer deletion must remain undoable')
  report.independentUndo = true

  await page.evaluate(() => { window.failNextRestore = true })
  await page.locator(`[data-toast-id="${newerToastId}"]`).getByRole('button', { name: '撤销', exact: true }).click()
  await page.locator('[data-toast-id]').getByText(/撤销失败：测试恢复失败/).waitFor()
  await page.locator('[data-toast-id] button').filter({ hasText: /^重试$/ }).click()
  await page.waitForFunction(async url => (await chrome.bookmarks.search({ url })).length === 1, seed.bookmarks[1].url)
  report.retry = true

  // The old index exceeds the surviving folder length after another deletion.
  await page.reload()
  await remove(seed.bookmarks[2])
  await worker.evaluate(async url => {
    const [bookmark] = await chrome.bookmarks.search({ url })
    await chrome.bookmarks.remove(bookmark.id)
  }, seed.bookmarks[0].url)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await page.waitForFunction(async url => (await chrome.bookmarks.search({ url })).length === 1, seed.bookmarks[2].url)
  report.clampedIndex = true

  await page.reload()
  await action(seed.bookmarks[2].title, '编辑书签')
  const title = page.locator('#edit-title-input')
  await title.fill('中文组合草稿')
  await title.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true })
  await title.fill('最终编辑标题')
  assert.equal((await exists(seed.bookmarks[2]))[0].title, seed.bookmarks[2].title, 'IME confirmation must not save an edit')
  await page.locator('#edit-url-input').fill('invalid-url')
  await page.locator('#save-edit').click()
  await page.locator('[data-toast-id]').getByText('请输入有效的网址', { exact: true }).waitFor()
  await page.locator('#edit-url-input').fill(seed.bookmarks[2].url)
  await title.press('Enter')
  await page.locator('#edit-modal').waitFor({ state: 'hidden' })
  assert.equal((await exists(seed.bookmarks[2]))[0].title, '最终编辑标题')
  report.edit = { ime: true, invalidUrl: true, saved: true }

  await remove({ ...seed.bookmarks[2], title: '最终编辑标题' })
  await worker.evaluate(id => chrome.bookmarks.removeTree(id), seed.folder.id)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await page.waitForFunction(async url => (await chrome.bookmarks.search({ url }))[0]?.parentId === '1', seed.bookmarks[2].url)
  report.missingParent = true
  assert.deepEqual(errors, [])
  await page.screenshot({ path: path.join(output, 'popup.png'), animations: 'disabled' })
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log('Popup mutation regressions passed.', report)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText())
  throw error
} finally {
  await context.close()
  await rm(profile, { recursive: true, force: true })
}
