import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('output/playwright/newtab-mutations')
await mkdir(output, { recursive: true })
await mkdir('.tmp-test', { recursive: true })
const profile = await mkdtemp(path.resolve('.tmp-test/newtab-mutations-'))
const extension = path.resolve('dist')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`]
})
context.setDefaultTimeout(12000)
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
const page = await context.newPage()
const errors = []
const report = {}
page.on('pageerror', error => errors.push(error.message))
try {
  const seed = await worker.evaluate(async () => {
    await chrome.storage.local.set({ curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false }, curatorBookmarkContentSnapshotSettings: { enabled: false } })
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '检修资料' })
    const first = await chrome.bookmarks.create({ parentId: folder.id, title: '前置书签', url: 'https://example.com/first' })
    const target = await chrome.bookmarks.create({ parentId: folder.id, title: '编辑测试', url: 'https://example.com/edit' })
    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id], browseMode: 'expanded' },
      curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013' },
      curatorBookmarkNewTabCustomIcons: { [target.id]: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>') }
    })
    return { folder, first, target }
  })
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/newtab/newtab.html`)
  const tile = page.locator(`.bookmark-tile[data-bookmark-id="${seed.target.id}"]`).first()
  await tile.click({ button: 'right' })
  const menu = page.locator('.bookmark-edit-menu')
  const title = menu.getByLabel('标题', { exact: true })
  await title.fill('中文组合草稿')
  await title.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true })
  await title.fill('最终标题')
  assert.equal((await worker.evaluate(id => chrome.bookmarks.get(id), seed.target.id))[0].title, '编辑测试')
  await title.press('Enter')
  await page.waitForFunction(async id => (await chrome.bookmarks.get(id))[0]?.title === '最终标题', seed.target.id)
  await page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
  report.imeEdit = true

  await tile.click({ button: 'right' })
  await menu.locator('[aria-label^="删除书签："]').click()
  await menu.locator('[aria-label^="确认删除书签："]').click()
  await tile.waitFor({ state: 'hidden' })
  await worker.evaluate(id => chrome.bookmarks.remove(id), seed.first.id)
  await page.getByRole('button', { name: /^撤销删除：/ }).click()
  // The service worker keeps its own bookmarks connection, which can lag the
  // page's view by a beat; wait on the worker itself before reading the node.
  await worker.evaluate(async (url) => {
    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      if ((await chrome.bookmarks.search({ url })).length === 1) return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('restored bookmark never appeared in the worker')
  }, seed.target.url)
  const restored = await worker.evaluate(async url => {
    const [bookmark] = await chrome.bookmarks.search({ url })
    const icons = (await chrome.storage.local.get('curatorBookmarkNewTabCustomIcons')).curatorBookmarkNewTabCustomIcons
    return { bookmark, icon: icons[bookmark.id] }
  }, seed.target.url)
  assert.equal(restored.bookmark.parentId, seed.folder.id)
  assert.equal(restored.bookmark.index, 0)
  assert.ok(restored.icon, 'The shared restore must retain the custom icon under its new bookmark ID')
  await page.waitForFunction(id => {
    const image = document.querySelector(`.bookmark-tile[data-bookmark-id="${id}"] img.custom-icon`)
    return image?.complete && image.naturalWidth > 0 && image.dataset.faviconReady === 'true'
  }, restored.bookmark.id)
  const pixel = await page.locator(`.bookmark-tile[data-bookmark-id="${restored.bookmark.id}"] img.custom-icon`).first().evaluate(image => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, 1, 1)
    return [...context.getImageData(0, 0, 1, 1).data]
  })
  assert.ok(pixel[0] > 200 && pixel[1] < 30, 'The restored red icon must be rendered, not just saved')
  report.restore = { changedIndex: true, customIcon: true }
  assert.deepEqual(errors, [])
  await page.screenshot({ path: path.join(output, 'newtab.png'), animations: 'disabled' })
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log('New Tab mutation regressions passed.', report)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText())
  throw error
} finally {
  await context.close()
  await rm(profile, { recursive: true, force: true })
}
