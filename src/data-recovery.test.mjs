import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

// Real MV3 storage, bookmark events and IndexedDB; never use a personal profile.
const temporary = await mkdtemp(path.resolve('.tmp-test/data-recovery-'))
const extension = path.join(temporary, 'extension')
const output = path.resolve('output/playwright/data-recovery')
await mkdir(output, { recursive: true })
await cp(path.resolve('dist'), extension, { recursive: true })
await writeFile(path.join(extension, 'fixture.html'), '<!doctype html><title>Recovery fixture</title>')
await build({
  stdin: { contents: `export { createCuratorBackupFile, restoreCuratorBackup } from './src/shared/backup.ts';
    export { saveManualBookmarkTags, loadBookmarkTagIndex } from './src/shared/bookmark-tags.ts';
    export { deleteBookmarkToRecycle, restoreBookmarkFromRecycleEntry } from './src/shared/recycle-bin.ts';
    export { loadCustomIcons, setBookmarkCustomIcon } from './src/shared/repositories/custom-icon-repository.ts';
    export { readCustomIconFile } from './src/newtab/custom-icon-picker.ts';`, resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'browser', outfile: path.join(extension, 'fixture-api.js')
})

async function launch(profile) {
  const context = await chromium.launchPersistentContext(path.join(temporary, profile), {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  })
  context.setDefaultTimeout(15000)
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const origin = `chrome-extension://${new URL(worker.url()).host}`
  const page = await context.newPage()
  await page.goto(origin + '/fixture.html')
  await page.evaluate(async () => {
    globalThis.api = await import(chrome.runtime.getURL('fixture-api.js'))
    await chrome.storage.local.set({ curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false }, curatorBookmarkContentSnapshotSettings: { enabled: false } })
  })
  return { context, origin, page }
}

let session
const results = {}
try {
  session = await launch('source')
  const { page, context, origin } = session
  const seed = await page.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '恢复资料' })
    const bookmark = await chrome.bookmarks.create({ parentId: folder.id, title: '带标签的资料', url: 'https://example.com/reference' })
    const icon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>')
    await api.saveManualBookmarkTags(bookmark, ['重要资料', '工作'])
    await chrome.storage.local.set({
      curatorBookmarkNewTabCustomIcons: { [bookmark.id]: icon },
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id], hideFolderNames: false },
      curatorBookmarkNewTabWorkspaceSettings: { activeWorkspaceId: 'default', workspaces: [{ id: 'default', name: 'Speed Dial', pinnedIds: [bookmark.id], createdAt: 1, updatedAt: 1 }] },
      curatorBookmarkNewTabModuleSettings: { version: 1, speedDial: false, order: ['speedDial'] }
    })
    const resolved = await api.loadCustomIcons()
    const stored = (await chrome.storage.local.get('curatorBookmarkNewTabCustomIcons')).curatorBookmarkNewTabCustomIcons
    return { folder, bookmark, icon, migratedIcon: resolved[bookmark.id], reference: stored[bookmark.id] }
  })
  assert.equal(seed.migratedIcon, seed.icon)
  assert.match(seed.reference, /^curator-icon:v1:/)
  const backup = await page.evaluate(async ({ folder }) => {
    const bar = (await chrome.bookmarks.get('1'))[0]
    await chrome.storage.local.set({ curatorBookmarkRecycleBin: [{ recycleId: 'imported-recycle', bookmarkId: 'deleted-older', title: '跨电脑回收记录', url: 'https://example.com/old-deleted', parentId: folder.id, path: `${bar.title} > ${folder.title}`, index: 999, deletedAt: Date.now() }] })
    return api.createCuratorBackupFile()
  }, seed)
  assert.equal(backup.storage.newTab.customIcons[seed.bookmark.id], seed.icon, 'Export must embed portable image bytes')
  assert.equal(backup.storage.newTab.moduleSettings.speedDial, false)

  // onRemoved really clears the live tag repository before restore starts.
  await page.evaluate(async ({ bookmark }) => {
    await api.deleteBookmarkToRecycle(bookmark.id, { recycleId: 'roundtrip', bookmarkId: bookmark.id, title: bookmark.title, url: bookmark.url, parentId: bookmark.parentId, deletedAt: Date.now() })
  }, seed)
  await page.waitForFunction(async id => !(await api.loadBookmarkTagIndex()).records[id], seed.bookmark.id)
  results.recycle = await page.evaluate(async ({ bookmark }) => {
    const restored = await api.restoreBookmarkFromRecycleEntry('roundtrip', () => chrome.bookmarks.create({ parentId: bookmark.parentId, title: bookmark.title, url: bookmark.url }))
    return { id: restored.id, tags: (await api.loadBookmarkTagIndex()).records[restored.id].manualTags, icon: (await api.loadCustomIcons())[restored.id] }
  }, seed)
  assert.notEqual(results.recycle.id, seed.bookmark.id)
  assert.deepEqual(results.recycle.tags, ['重要资料', '工作'])
  assert.equal(results.recycle.icon, seed.icon)

  results.icon = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 700
    const ctx = canvas.getContext('2d')
    const image = ctx.createImageData(700, 700)
    for (let offset = 0; offset < image.data.length; offset += 65536) crypto.getRandomValues(image.data.subarray(offset, Math.min(offset + 65536, image.data.length)))
    ctx.putImageData(image, 0, 0)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const data = await api.readCustomIconFile(new File([blob], 'noise.png', { type: 'image/png' }))
    const decoded = new Image()
    decoded.src = data
    await decoded.decode()
    await Promise.all(Array.from({ length: 8 }, (_, i) => api.setBookmarkCustomIcon(`quota-${i}`, data)))
    const icons = await api.loadCustomIcons()
    return { originalBytes: blob.size, dataBytes: data.length, width: decoded.naturalWidth, height: decoded.naturalHeight, saved: Object.keys(icons).filter(id => id.startsWith('quota-')).length, storageBytes: await chrome.storage.local.getBytesInUse('curatorBookmarkNewTabCustomIcons') }
  })
  assert.equal(results.icon.saved, 8)
  assert.equal(results.icon.width, 128)
  assert.ok(results.icon.dataBytes < 100000)
  assert.ok(results.icon.storageBytes < 2000)

  const ui = await context.newPage()
  const errors = []
  ui.on('pageerror', error => errors.push(error.message))
  await ui.goto(origin + '/src/newtab/newtab.html')
  await ui.locator('.bookmark-tile').first().waitFor()
  const changedIcon = seed.icon.replace('blue', 'red')
  await page.evaluate(({ id, icon }) => api.setBookmarkCustomIcon(id, icon), { id: results.recycle.id, icon: changedIcon })
  await ui.waitForFunction(icon => [...document.images].some(image => image.src === icon), changedIcon)
  await ui.reload()
  await ui.waitForFunction(icon => [...document.images].some(image => image.src === icon), changedIcon)

  await ui.setViewportSize({ width: 380, height: 900 })
  await ui.goto(origin + '/src/sidepanel/sidepanel.html')
  const collapse = ui.getByRole('button', { name: '收起文件夹列表', exact: true })
  await collapse.waitFor()
  const pane = ui.locator('.t-skel-content .popup-main-pane')
  const before = (await pane.boundingBox()).height
  await collapse.click()
  await ui.locator('#sidepanel-folder-tree').waitFor({ state: 'hidden' })
  await ui.waitForFunction(() => {
    const content = document.querySelector('.popup-workspace-reveal > .t-skel-content')
    const skeleton = document.querySelector('.popup-workspace-reveal > .t-skel-skeleton')
    return content && skeleton && getComputedStyle(content).opacity === '1' && getComputedStyle(skeleton).opacity === '0'
  })
  const after = (await pane.boundingBox()).height
  assert.ok(after > before + 30, `Collapsing should return space to results: ${before} -> ${after}`)
  await ui.screenshot({ path: path.join(output, 'sidepanel-collapsed.png') })
  await ui.getByRole('button', { name: '展开文件夹列表', exact: true }).click()
  await ui.locator('#sidepanel-folder-tree').waitFor({ state: 'visible' })
  assert.ok(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  results.sidebar = { before, after }

  await ui.setViewportSize({ width: 1280, height: 900 })
  await ui.goto(origin + '/src/options/options.html#general')
  for (const [label, move, tags] of [
    ['只生成标签和摘要，保留在 Inbox', false, true],
    ['生成整理建议，由我决定是否移动', false, false],
    ['生成标签，高置信时自动移动', true, false]
  ]) {
    const select = ui.getByRole('combobox', { name: 'Inbox 收藏后的整理方式' })
    await select.click()
    await ui.getByRole('option', { name: label, exact: true }).click()
    await page.waitForFunction(async ({ move, tags }) => {
      const settings = (await chrome.storage.local.get('curatorBookmarkInboxSettings')).curatorBookmarkInboxSettings
      return settings?.autoMoveToRecommendedFolder === move && settings?.tagOnlyNoAutoMove === tags
    }, { move, tags })
    await ui.reload()
    await ui.getByRole('combobox', { name: 'Inbox 收藏后的整理方式' }).filter({ hasText: label }).waitFor()
  }
  await ui.screenshot({ path: path.join(output, 'options.png'), fullPage: true })
  assert.deepEqual(errors, [])
  await context.close()

  // A different profile has no image database and colliding numeric Chrome IDs.
  session = await launch('destination')
  results.backup = await session.page.evaluate(async ({ backup, seed }) => {
    for (let i = 0; i < 10; i++) await chrome.bookmarks.create({ parentId: '1', title: `Unrelated ${i}`, url: `https://unrelated.example/${i}` })
    await api.restoreCuratorBackup(backup, 'safeFull')
    const restored = (await chrome.bookmarks.search({ url: seed.bookmark.url }))[0]
    const stored = await chrome.storage.local.get(['curatorBookmarkNewTabFolderSettings', 'curatorBookmarkNewTabWorkspaceSettings', 'curatorBookmarkNewTabModuleSettings'])
    return { restoredId: restored.id, folderId: restored.parentId, selected: stored.curatorBookmarkNewTabFolderSettings.selectedFolderIds,
      pins: stored.curatorBookmarkNewTabWorkspaceSettings.workspaces[0].pinnedIds, speedDial: stored.curatorBookmarkNewTabModuleSettings.speedDial,
      icon: (await api.loadCustomIcons())[restored.id], tags: (await api.loadBookmarkTagIndex()).records[restored.id].manualTags }
  }, { backup, seed })
  assert.notEqual(results.backup.restoredId, seed.bookmark.id)
  assert.deepEqual(results.backup.selected, [results.backup.folderId])
  assert.deepEqual(results.backup.pins, [results.backup.restoredId])
  assert.equal(results.backup.speedDial, false)
  assert.equal(results.backup.icon, seed.icon)
  assert.deepEqual(results.backup.tags, ['重要资料', '工作'])
  const recycleUi = await session.context.newPage()
  await recycleUi.goto(session.origin + '/src/options/options.html#recycle')
  await recycleUi.getByRole('button', { name: '恢复书签：跨电脑回收记录', exact: true }).click()
  await session.page.waitForFunction(async folderId => (await chrome.bookmarks.search({ url: 'https://example.com/old-deleted' }))[0]?.parentId === folderId, results.backup.folderId)
  results.crossProfileRecycle = { parentId: results.backup.folderId, verifiedThroughOptions: true }
  await recycleUi.screenshot({ path: path.join(output, 'cross-profile-recycle.png') })
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2))
  console.log('Data recovery, portable icons, concurrent icon writes, sidebar and Inbox controls passed.', results)
} finally {
  await session?.context.close()
  await rm(temporary, { recursive: true, force: true })
}
