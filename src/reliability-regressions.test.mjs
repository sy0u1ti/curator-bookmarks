import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const temporary = await mkdtemp(path.resolve('.tmp-test/reliability-'))
const extension = path.join(temporary, 'extension')
const output = path.resolve('output/playwright/reliability-regressions')
await mkdir(output, { recursive: true })
await cp(path.resolve('dist'), extension, { recursive: true })
await writeFile(path.join(extension, 'fixture.html'), '<!doctype html><title>Reliability fixture</title>')
await build({
  stdin: { contents: `export * from './src/shared/storage-maintenance.ts';
    export * from './src/shared/repositories/custom-icon-repository.ts';
    export * from './src/shared/content-snapshots.ts';
    export { withLocalStorageTransaction } from './src/shared/storage.ts';
    export { loadBackupProtectedIconReferences } from './src/shared/backup.ts';`, resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'browser', outfile: path.join(extension, 'fixture-api.js')
})
const context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
})
context.setDefaultTimeout(20000)
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
const origin = `chrome-extension://${new URL(worker.url()).host}`
const errors = []
const report = {}
let ui
try {
  const fixture = await context.newPage()
  await fixture.goto(origin + '/fixture.html')
  const seed = await fixture.evaluate(async () => {
    globalThis.api = await import(chrome.runtime.getURL('fixture-api.js'))
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: true, autoCaptureOnBookmarkCreate: false, fullTextSearchEnabled: true },
      curatorBookmarkInboxSettings: { enabled: true, autoMoveToRecommendedFolder: false, tagOnlyNoAutoMove: false },
      curatorBookmarkAvailabilitySettings: { concurrency: 3 }
    })
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '审查资料' })
    const target = await chrome.bookmarks.create({ parentId: '1', title: '目标目录' })
    const ime = await chrome.bookmarks.create({ parentId: folder.id, title: '中文输入测试', url: 'https://example.com/ime-test' })
    const local = await chrome.bookmarks.create({ parentId: folder.id, title: '本地正文', url: 'https://example.com/local-body' })
    const records = {}
    const bodies = []
    let tail
    for (let index = 0; index < 601; index++) {
      tail = await chrome.bookmarks.create({ parentId: folder.id, title: `文档 ${index}`, url: `https://example.com/document/${index}` })
      const snapshotId = `body-${index}`
      const text = index === 600 ? 'beyondlimituniquekeyword' : 'ordinary document content'
      records[tail.id] = { snapshotId, bookmarkId: tail.id, url: tail.url, title: tail.title, summary: '普通摘要', headings: [], hasFullText: true, fullTextStorage: 'idb', fullTextRef: snapshotId, fullTextBytes: text.length, extractedAt: Date.now() }
      bodies.push({ snapshotId, bookmarkId: tail.id, text, bytes: text.length, savedAt: Date.now() })
    }
    records[local.id] = { snapshotId: 'local', bookmarkId: local.id, url: local.url, title: local.title, summary: '普通摘要', hasFullText: true, fullTextStorage: 'local', fullText: 'inlineuniquekeyword', fullTextBytes: 18, extractedAt: Date.now() }
    await api.putContentFullTexts(bodies)
    await chrome.storage.local.set({
      curatorBookmarkContentSnapshotIndex: { version: 1, updatedAt: Date.now(), records },
      curatorBookmarkNewTabCustomIcons: { [ime.id]: 'curator-icon:v1:missing-fixture' },
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id], hideFolderNames: false },
      curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013' },
      curatorBookmarkNewTabSearchSettings: { enabled: true, webSearchEnabled: true, autoVerticalCenter: false },
      curatorBookmarkInboxState: { version: 1, folderId: folder.id, items: [{ captureId: 'review', bookmarkId: ime.id, url: ime.url, title: ime.title, inboxFolderId: folder.id, originalParentId: folder.id, status: 'needs-review', createdAt: Date.now(), updatedAt: Date.now(), recommendedFolderId: target.id, recommendedFolderPath: `Bookmarks bar > ${target.title}`, recommendationReason: '这是一份测试资料', confidence: .95, lastError: '等待你决定是否移动。' }] }
    })
    // Use the actual localized Chrome root title for identity validation.
    const root = (await chrome.bookmarks.get('1'))[0]
    const inbox = (await chrome.storage.local.get('curatorBookmarkInboxState')).curatorBookmarkInboxState
    inbox.items[0].recommendedFolderPath = `${root.title} > ${target.title}`
    await chrome.storage.local.set({ curatorBookmarkInboxState: inbox })
    return { folder, target, ime, local, tail }
  })
  ui = await context.newPage()
  ui.on('pageerror', error => errors.push(error.message))
  await ui.goto(origin + '/src/newtab/newtab.html')
  const input = ui.locator('.newtab-search-input')
  await input.waitFor()
  await ui.locator('.bookmark-tile').first().waitFor()
  report.missingIcon = { inputs: await input.count(), tiles: await ui.locator('.bookmark-tile').count() }
  await input.fill('中文输入测试')
  await ui.locator('#newtab-search-suggestion-0').waitFor()
  report.ime = await input.evaluate(element => {
    const before = element.getAttribute('aria-activedescendant')
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const keys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].map(key => {
      const event = new KeyboardEvent('keydown', { key, keyCode: 229, isComposing: true, bubbles: true, cancelable: true })
      element.dispatchEvent(event)
      return { key, prevented: event.defaultPrevented }
    })
    const after = element.getAttribute('aria-activedescendant')
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    return { before, after, value: element.value, keys }
  })
  assert.equal(report.ime.after, report.ime.before)
  assert.equal(report.ime.value, '中文输入测试')
  assert.ok(report.ime.keys.every(key => !key.prevented))
  assert.ok(ui.url().startsWith(origin))
  await input.press('ArrowDown')
  assert.equal(await input.getAttribute('aria-activedescendant'), 'newtab-search-suggestion-0')
  for (const [query, title] of [['beyondlimituniquekeyword', seed.tail.title], ['inlineuniquekeyword', seed.local.title]]) {
    await input.fill(query)
    await ui.locator('#newtab-search-suggestion-0').filter({ hasText: title }).waitFor()
  }
  await ui.screenshot({ path: path.join(output, 'newtab-body-and-icon.png') })
  const popup = await context.newPage()
  popup.on('pageerror', error => errors.push(error.message))
  await popup.goto(origin + '/src/popup/popup.html')
  await popup.locator('#search-input').fill('beyondlimituniquekeyword')
  await popup.getByText(seed.tail.title, { exact: true }).waitFor()
  report.fullText = { idbRecords: 601, newtab: true, popup: true, inline: true }
  await popup.screenshot({ path: path.join(output, 'popup-body-after-600.png') })
  await popup.close()

  await ui.goto(origin + '/src/options/options.html#backup')
  const downloadPromise = ui.waitForEvent('download')
  await ui.getByRole('button', { name: '导出完整书签备份', exact: true }).click()
  const download = await downloadPromise
  const backupPath = path.join(output, 'backup.json')
  await download.saveAs(backupPath)
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  assert.deepEqual(Object.keys(backup.storage.preferences).sort(), ['availabilitySettings', 'contentSnapshotSettings', 'inboxSettings'])
  assert.ok(backup.notes.some(note => note.includes('图标无法读取')))
  await ui.getByRole('button', { name: '移除失效图标引用', exact: true }).click()
  await fixture.waitForFunction(async id => !(await chrome.storage.local.get('curatorBookmarkNewTabCustomIcons')).curatorBookmarkNewTabCustomIcons[id], seed.ime.id)
  await ui.screenshot({ path: path.join(output, 'storage-management.png'), fullPage: true })

  await ui.goto(origin + '/src/options/options.html#inbox')
  await ui.getByRole('button', { name: '重新分析', exact: true }).click()
  await ui.getByText('请先在 AI 设置中配置可用渠道。', { exact: true }).waitFor()
  await fixture.evaluate(id => chrome.bookmarks.update(id, { title: '已重命名目录' }), seed.target.id)
  await ui.getByRole('button', { name: '接受建议', exact: true }).click()
  await ui.getByText('目标文件夹已变化，请重新选择目录。', { exact: true }).waitFor()
  await fixture.evaluate(({ id, title }) => chrome.bookmarks.update(id, { title }), seed.target)
  await ui.getByRole('button', { name: '接受建议', exact: true }).click()
  await fixture.waitForFunction(async ({ id, parent }) => (await chrome.bookmarks.get(id))[0].parentId === parent, { id: seed.ime.id, parent: seed.target.id })
  await ui.getByRole('button', { name: '撤销最近一次移动', exact: true }).click()
  await fixture.waitForFunction(async ({ id, parent }) => (await chrome.bookmarks.get(id))[0].parentId === parent, { id: seed.ime.id, parent: seed.folder.id })
  await ui.getByRole('combobox', { name: `为 ${seed.ime.title} 选择目录` }).click()
  await ui.getByRole('option', { name: new RegExp(seed.target.title) }).click()
  await ui.getByRole('button', { name: '移至所选目录', exact: true }).click()
  await fixture.waitForFunction(async ({ id, parent }) => (await chrome.bookmarks.get(id))[0].parentId === parent, { id: seed.ime.id, parent: seed.target.id })
  await ui.getByRole('button', { name: '撤销最近一次移动', exact: true }).click()
  await fixture.waitForFunction(async ({ id, parent }) => (await chrome.bookmarks.get(id))[0].parentId === parent, { id: seed.ime.id, parent: seed.folder.id })
  await ui.getByRole('button', { name: '保留原位', exact: true }).click()
  await fixture.waitForFunction(async () => (await chrome.storage.local.get('curatorBookmarkInboxState')).curatorBookmarkInboxState.items[0].status === 'kept')
  report.inbox = { accepted: true, alternateFolder: true, undone: true, kept: true, staleTargetRejected: true, retryFeedback: true }
  await ui.screenshot({ path: path.join(output, 'inbox-completed.png') })

  report.gc = await fixture.evaluate(async seed => {
    const image = color => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${color}"/></svg>`)
    const refs = await api.withLocalStorageTransaction(async () => api.prepareCustomIconReferences({ live: image('blue'), recycle: image('red'), journal: image('green'), orphan: image('purple') }))
    await chrome.storage.local.set({ curatorBookmarkNewTabCustomIcons: { [seed.ime.id]: refs.live }, curatorBookmarkRecycleBin: [{ recycleId: 'protected', url: 'https://example.com/deleted', customIcon: refs.recycle }] })
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('curatorBookmarkHeavyUserData', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('autoBackups', 'readwrite')
      tx.objectStore('autoBackups').put({ backupId: 'gc-fixture-journal', previousStorage: { customIcons: { saved: refs.journal } } })
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error)
    })
    db.close()
    const collect = now => api.withLocalStorageTransaction(async transaction => {
      const protectedRefs = api.collectCustomIconReferences(await chrome.storage.local.get(null), await api.loadBackupProtectedIconReferences())
      return api.inspectCustomIconStorage(protectedRefs, { transaction, now })
    })
    const first = await collect(Date.now())
    const second = await collect(Date.now() + api.CUSTOM_ICON_GRACE_MS + 100)
    const remaining = await api.resolveCustomIconState(refs)
    return { first, second, remaining: Object.keys(remaining.icons), missing: remaining.missingIds }
  }, seed)
  assert.equal(report.gc.first.removed, 0)
  assert.equal(report.gc.second.removed, 1)
  assert.deepEqual(report.gc.remaining.sort(), ['journal', 'live', 'recycle'])
  assert.deepEqual(report.gc.missing, ['orphan'])

  await ui.goto(origin + '/src/options/options.html#backup')
  await ui.getByRole('button', { name: '清除本地正文', exact: true }).click()
  await ui.getByText('已清除本地正文，摘要与书签仍保留。之后采集的正文仍按当前设置保存。', { exact: true }).waitFor()
  await fixture.waitForFunction(async () => Object.values((await api.loadContentSnapshotIndex()).records).every(record => !record.hasFullText))
  const bodyUsage = await fixture.evaluate(() => api.getContentFullTextStorageUsage())
  assert.equal(bodyUsage.count, 0)
  assert.equal((await fixture.evaluate(() => chrome.bookmarks.search({ url: 'https://example.com/document/600' }))).length, 1)
  report.cleanup = { bodyCount: bodyUsage.count, bookmarkKept: true }
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2))
  console.log('Reliability browser regressions passed.', report)
} catch (error) {
  for (const [index, page] of context.pages().entries()) {
    await page.screenshot({ path: path.join(output, `failure-tab-${index}.png`), fullPage: true }).catch(() => {})
    await writeFile(path.join(output, `failure-tab-${index}.txt`), await page.locator('body').innerText().catch(() => page.url()))
  }
  await ui?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ report, errors, error: String(error) }, null, 2))
  throw error
} finally {
  await context.close()
  await rm(temporary, { recursive: true, force: true })
}
