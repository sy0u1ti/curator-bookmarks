import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

await mkdir('.tmp-test', { recursive: true })
const profile = await mkdtemp(path.resolve('.tmp-test/options-audit-'))
const output = path.resolve('output/playwright/options-audit')
await mkdir(output, { recursive: true })
const extension = path.resolve('dist')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`]
})
context.setDefaultTimeout(15000)
const errors = []
const report = {}
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  await worker.evaluate(() => chrome.storage.local.set({ curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false }, curatorBookmarkContentSnapshotSettings: { enabled: false }, curatorBookmarkInboxSettings: { autoAnalyzeEnabled: false } }))
  await page.addInitScript(() => {
    window.audit = { failUsage: false, failTree: false, treeReads: 0 }
    const get = chrome.storage.local.get.bind(chrome.storage.local)
    chrome.storage.local.get = (keys, ...args) => {
      if (keys === null && window.audit.failUsage) throw new Error('测试用量读取失败')
      return get(keys, ...args)
    }
    const tree = chrome.bookmarks.getTree.bind(chrome.bookmarks)
    chrome.bookmarks.getTree = (...args) => {
      window.audit.treeReads++
      if (window.audit.failTree) throw new Error('测试 Inbox 读取失败')
      return tree(...args)
    }
  })
  const origin = `chrome-extension://${new URL(worker.url()).host}/src/options/options.html`
  await page.goto(origin + '#availability')
  const sidebar = page.locator('aside[aria-label="设置导航"]')
  const disclosure = sidebar.getByRole('button', { name: '可用性管理', exact: true })
  await disclosure.waitFor()
  await page.waitForFunction(() => document.querySelector('aside [aria-controls="availability-tools-nav"]')?.getAttribute('aria-expanded') === 'true')
  await disclosure.click()
  assert.equal(await disclosure.getAttribute('aria-expanded'), 'false')
  await sidebar.getByRole('link', { name: '通用设置', exact: true }).click()
  await page.goBack()
  await page.waitForFunction(() => document.querySelector('aside [aria-controls="availability-tools-nav"]')?.getAttribute('aria-expanded') === 'true')
  await disclosure.click()
  await page.screenshot({ path: path.join(output, 'collapsed-current-section.png'), animations: 'disabled' })
  report.navigation = { collapseCurrentSection: true, historyReopens: true }

  await page.evaluate(() => { window.audit.failUsage = true })
  await sidebar.getByRole('link', { name: '数据与备份', exact: true }).click()
  const storage = page.getByRole('region', { name: '本地存储', exact: true })
  await storage.getByRole('status').filter({ hasText: '测试用量读取失败' }).waitFor()
  assert.equal(await storage.getByText('正在读取用量…', { exact: true }).count(), 0)
  assert.equal(await storage.getByRole('button', { name: '刷新用量' }).isEnabled(), true)
  await page.screenshot({ path: path.join(output, 'storage-failure.png'), animations: 'disabled' })
  await page.evaluate(() => { window.audit.failUsage = false })
  await storage.getByRole('button', { name: '刷新用量' }).click()
  await storage.getByText(/设置与索引约/).waitFor()
  assert.equal(await storage.getByRole('status').filter({ hasText: '测试用量读取失败' }).count(), 0)
  report.storage = { errorState: true, retry: true }

  await page.evaluate(() => { window.audit.failTree = true })
  await sidebar.locator('[data-options-section="inbox"]').click()
  await worker.evaluate(() => chrome.storage.local.set({ curatorBookmarkInboxState: { version: 1, items: [] } }))
  const inbox = page.locator('section[aria-labelledby="inbox-review-title"]')
  await inbox.getByText('测试 Inbox 读取失败', { exact: true }).waitFor()
  assert.equal(await inbox.getByText('正在读取待整理…', { exact: true }).count(), 0)
  await page.evaluate(() => { window.audit.failTree = false })
  await inbox.getByRole('button', { name: '重新读取', exact: true }).click()
  await inbox.getByText('当前没有待整理书签。', { exact: true }).waitFor()
  await page.getByRole('heading', { name: '待整理 · 0', exact: true }).waitFor()
  await page.evaluate(() => { window.audit.treeReads = 0 })
  await worker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '批量审核' })
    const bookmarks = await Promise.all(Array.from({ length: 80 }, (_, i) => chrome.bookmarks.create({ parentId: folder.id, title: `待办 ${i}`, url: `https://example.com/${i}` })))
    await chrome.storage.local.set({ curatorBookmarkInboxState: { version: 1, folderId: folder.id, items: bookmarks.map(bookmark => ({
      captureId: `audit-${bookmark.id}`, bookmarkId: bookmark.id, title: bookmark.title, url: bookmark.url,
      inboxFolderId: folder.id, originalParentId: folder.id, status: 'needs-review', createdAt: 1, updatedAt: 1
    })) } })
  })
  await page.getByRole('heading', { name: '待整理 · 80', exact: true }).waitFor()
  const treeReads = await page.evaluate(() => window.audit.treeReads)
  assert.ok(treeReads <= 8, `80 bookmark changes must be coalesced; got ${treeReads} full-tree reads`)
  report.inbox = { errorState: true, retry: true, pending: 80, treeReads }
  await page.screenshot({ path: path.join(output, 'inbox-batch.png'), animations: 'disabled' })
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log('Options audit navigation, storage failure/retry and coalesced Inbox updates passed.', report)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText())
  throw error
} finally {
  await context.close()
  await rm(profile, { recursive: true, force: true })
}
