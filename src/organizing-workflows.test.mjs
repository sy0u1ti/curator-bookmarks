import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve('.tmp-test')
await mkdir(root, { recursive: true })
const profile = await mkdtemp(path.join(root, 'organizing-workflows-'))
const output = path.resolve('output/playwright/organizing-workflows')
await mkdir(output, { recursive: true })
const extension = path.resolve('dist')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
})
context.setDefaultTimeout(15000)
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const origin = `chrome-extension://${new URL(worker.url()).host}`
  const seed = await worker.evaluate(async () => {
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: false },
      curatorBookmarkInboxSettings: { autoAnalyzeEnabled: false }
    })
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Inbox 审核' })
    const items = []
    for (let i = 0; i < 230; i++) {
      const bookmark = await chrome.bookmarks.create({ parentId: folder.id, title: `待办 ${i}`, url: `https://example.com/item/${i}/detail` })
      items.push({ captureId: `capture-${i}`, bookmarkId: bookmark.id, title: bookmark.title, url: bookmark.url,
        inboxFolderId: folder.id, originalParentId: folder.id, status: 'needs-review', createdAt: i + 1, updatedAt: i + 1 })
    }
    await chrome.storage.local.set({
      curatorBookmarkInboxState: { version: 1, folderId: folder.id, items },
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id] },
      curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013' },
      curatorBookmarkNewTabGlassSettings: { tint: 17, blur: 7 }
    })
    return items
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin + '/src/options/options.html#inbox')
  await page.getByRole('heading', { name: '待整理 230 条', exact: true }).waitFor()
  assert.equal(await page.locator('#inbox article').count(), 20)
  assert.equal(await page.locator('aside[aria-label="设置导航"] [aria-label="230 条待整理"]').count(), 1)
  await page.getByRole('textbox', { name: '搜索待整理书签' }).fill(seed[0].url)
  assert.equal(await page.locator('#inbox article').count(), 1)
  await page.getByRole('button', { name: '保留原位', exact: true }).click()
  await page.getByRole('heading', { name: '待整理 229 条', exact: true }).waitFor()
  await page.getByRole('textbox', { name: '搜索待整理书签' }).fill(seed[1].url)
  await page.evaluate(id => chrome.bookmarks.update(id, { url: 'https://changed.example/updated' }), seed[1].bookmarkId)
  await page.getByRole('button', { name: '结清待办', exact: true }).click()
  await page.getByRole('heading', { name: '待整理 228 条', exact: true }).waitFor()
  await page.evaluate(id => chrome.bookmarks.remove(id), seed[2].bookmarkId)
  await page.getByRole('heading', { name: '待整理 227 条', exact: true }).waitFor()
  await page.getByRole('textbox', { name: '搜索待整理书签' }).fill('')
  await page.screenshot({ path: path.join(output, 'inbox.png') })

  await page.goto(origin + '/src/options/options.html#general')
  const workflow = page.getByRole('combobox', { name: 'Inbox 收藏后的整理方式' })
  await workflow.waitFor()
  await page.waitForFunction(() => document.querySelector('[aria-label="Inbox 收藏后的整理方式"]')?.textContent.includes('只收藏'))
  await workflow.click()
  await page.getByRole('option', { name: '生成整理建议，由我决定是否移动', exact: true }).click()
  await page.waitForFunction(async () => (await chrome.storage.local.get('curatorBookmarkInboxSettings')).curatorBookmarkInboxSettings?.autoAnalyzeEnabled === true)
  await workflow.click()
  await page.getByRole('option', { name: '只收藏，暂不分析', exact: true }).click()
  await page.waitForFunction(async () => (await chrome.storage.local.get('curatorBookmarkInboxSettings')).curatorBookmarkInboxSettings?.autoAnalyzeEnabled === false)
  await page.screenshot({ path: path.join(output, 'general.png') })

  await page.goto(origin + '/src/options/options.html#general:ai-provider')
  await page.locator('#ai-api-key').waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: 'AI 服务配置', exact: true }).waitFor()
  assert.equal(await page.locator('aside[aria-label="设置导航"] [data-options-section="ai-settings"][aria-current="page"]').count(), 1)
  await page.goto(origin + '/src/options/options.html#backup')
  await page.getByText('包含自定义书签图标。', { exact: false }).waitFor()

  // Cross-page selections must retain their exact scope, including hidden rows.
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      curatorBookmarkRecycleBin: Array.from({ length: 65 }, (_, index) => ({
        recycleId: `recycle-${index}`, bookmarkId: `removed-${index}`,
        title: `回收测试 ${index}`, url: `https://example.com/recycled/${index}/detail`,
        parentId: '1', path: '书签栏', index, source: '测试删除', deletedAt: index + 1
      }))
    })
  })
  await page.goto(origin + '/src/options/options.html#recycle')
  await page.reload() // Hydrate the externally seeded fixture into the options controller.
  const recycle = page.locator('#recycle')
  await recycle.getByText('第 1 / 3 页 · 65 条', { exact: true }).waitFor()
  assert.equal(await recycle.locator('article').count(), 30)
  await writeFile(path.join(output, 'recycle-pagination.txt'), await recycle.ariaSnapshot())
  await recycle.getByRole('checkbox', { name: '选择回收站书签：回收测试 64', exact: true }).check()
  await recycle.getByRole('button', { name: '下一页', exact: true }).click()
  await recycle.getByRole('checkbox', { name: '选择回收站书签：回收测试 34', exact: true }).check()
  await recycle.getByRole('status').filter({ hasText: '当前页已选 1 条，其他页或筛选外已选 1 条。' }).waitFor()
  const recycleSearch = recycle.getByRole('textbox', { name: '搜索回收站记录' })
  await recycleSearch.fill('https://example.com/recycled/0/detail')
  assert.equal(await recycle.locator('article').count(), 1)
  await recycle.getByRole('status').filter({ hasText: '当前页已选 0 条，其他页或筛选外已选 2 条。' }).waitFor()
  await recycle.getByRole('button', { name: '清除回收站已选记录', exact: true }).click()
  const clearDialog = page.getByRole('dialog', { name: '清除 2 条回收站记录？', exact: true })
  await clearDialog.getByRole('button', { name: '确认当前操作', exact: true }).click()
  await clearDialog.waitFor({ state: 'hidden' })
  await page.waitForFunction(async () => (await chrome.storage.local.get('curatorBookmarkRecycleBin')).curatorBookmarkRecycleBin.length === 63)
  const retainedRecycleIds = await worker.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkRecycleBin')).curatorBookmarkRecycleBin.map(entry => entry.recycleId))
  assert.ok(!retainedRecycleIds.includes('recycle-64') && !retainedRecycleIds.includes('recycle-34'))
  assert.ok(retainedRecycleIds.includes('recycle-0'), 'clearing hidden selections must preserve the visible unselected row')
  await recycle.getByRole('button', { name: '全选回收站条目', exact: true }).click()
  await recycle.getByRole('status').filter({ hasText: '当前页已选 1 条，其他页或筛选外已选 62 条。' }).waitFor()
  await recycle.getByRole('button', { name: '清空回收站已选书签', exact: true }).click()
  await recycleSearch.fill('')
  await recycle.getByRole('button', { name: '下一页', exact: true }).click()
  await recycle.getByRole('button', { name: '下一页', exact: true }).click()
  assert.equal(await recycle.locator('article').count(), 3)
  await page.screenshot({ path: path.join(output, 'recycle-pagination.png') })

  await page.goto(origin + '/src/newtab/newtab.html')
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '玻璃', exact: true }).click()
  const custom = await page.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings')).curatorBookmarkNewTabGlassSettings)
  const detail = page.getByRole('button', { name: '精细调整玻璃材质', exact: true })
  assert.equal(await detail.getAttribute('aria-expanded'), 'false')
  await page.getByRole('button', { name: '清透', exact: true }).click()
  await page.waitForFunction(async () => (await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings')).curatorBookmarkNewTabGlassSettings?.blur === 3)
  await page.getByRole('button', { name: '撤销本次调整', exact: true }).click()
  await page.waitForFunction(async expected => {
    const settings = (await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings')).curatorBookmarkNewTabGlassSettings
    return settings?.blur === expected.blur && settings.tint === expected.tint
  }, custom)
  await page.getByRole('button', { name: '柔和', exact: true }).click()
  await page.waitForFunction(async () => (await chrome.storage.local.get('curatorBookmarkNewTabGlassSettings')).curatorBookmarkNewTabGlassSettings?.tint === 24)
  await page.screenshot({ path: path.join(output, 'glass-presets.png') })
  await detail.click()
  await page.getByRole('slider', { name: '玻璃模糊', exact: true }).waitFor()
  await page.reload()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('curator-newtab-glass-v1')).tint), 24)
  assert.deepEqual(errors, [])
  console.log('Organizing workflows passed: 230 pending items, pagination, stale records, live counts, capture mode, legacy AI link, backup disclosure, cross-page recycle selection and clearing, glass presets and undo.')
} finally {
  await context.close()
  if (path.dirname(profile) === root) await rm(profile, { recursive: true, force: true })
}
