import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

await mkdir('.tmp-test', { recursive: true })
const temporary = await mkdtemp(path.resolve('.tmp-test/folder-cleanup-'))
const extension = path.join(temporary, 'extension')
const output = path.resolve('output/playwright/folder-cleanup')
await mkdir(output, { recursive: true })
await cp(path.resolve('dist'), extension, { recursive: true })
await writeFile(path.join(extension, 'fixture.html'), '<!doctype html><title>Folder cleanup regression</title>')
await build({ stdin: { contents: `export * from './src/options/sections/folder-cleanup.ts';
  export { folderCleanupState, availabilityState } from './src/options/shared-options/state.ts';
  export { analyzeFolderCleanup } from './src/shared/folder-cleanup.ts';`, resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'browser', outfile: path.join(extension, 'fixture.js') })
const context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
  channel: 'chromium', headless: true,
  args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`]
})
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const page = await context.newPage()
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/fixture.html`)
  const result = await page.evaluate(async () => {
    const api = await import('./fixture.js')
    await chrome.storage.local.set({ curatorBookmarkContentSnapshotSettings: { enabled: false }, curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false } })
    api.availabilityState.catalogLoading = false
    const refresh = async () => {
      api.folderCleanupState.rootNode = (await chrome.bookmarks.getTree())[0]
      api.folderCleanupState.suggestions = api.analyzeFolderCleanup(api.folderCleanupState.rootNode)
    }
    // This isolated fixture has one mutation caller; provide the controller's
    // required lease callback and assert release after each operation.
    let locked = false
    const callbacks = { confirm: async () => true, hydrateAvailabilityCatalog: refresh, renderAvailabilitySection: () => {},
      claimAvailabilityMutationLock: async () => {
        if (locked) throw new Error('Previous cleanup leaked its mutation lease')
        locked = true
        return () => { locked = false }
      } }
    const exists = async id => (await chrome.bookmarks.getTree())[0].children.some(function has(node) {
      return node.id === id || node.children?.some(has)
    })
    const empty = await chrome.bookmarks.create({ parentId: '1', title: '扫描后新增内容' })
    await refresh()
    let newBookmark
    await api.executeFolderCleanupAction(`empty-folder:${empty.id}`, { ...callbacks, confirm: async () => {
      newBookmark = await chrome.bookmarks.create({ parentId: empty.id, title: '不能被旧建议删除', url: 'https://example.com/new' })
      return true
    } })
    const stale = { preserved: await exists(newBookmark.id), status: api.folderCleanupState.statusMessage }

    // Content arriving after validation must also survive the final API mutation.
    const concurrent = await chrome.bookmarks.create({ parentId: '1', title: '删除时新增内容' })
    await refresh()
    const remove = chrome.bookmarks.remove.bind(chrome.bookmarks)
    let injected
    chrome.bookmarks.remove = (id, callback) => {
      if (id === concurrent.id && !injected) {
        void chrome.bookmarks.create({ parentId: id, title: '并发保存', url: 'https://example.com/concurrent' })
          .then(bookmark => { injected = bookmark; remove(id, callback) })
        return
      }
      return remove(id, callback)
    }
    await api.executeFolderCleanupAction(`empty-folder:${concurrent.id}`, callbacks)
    chrome.bookmarks.remove = remove
    const racing = { preserved: injected ? await exists(injected.id) : false }

    // A merge must clean approved empty descendants without recursive removal.
    const left = await chrome.bookmarks.create({ parentId: '1', title: '同名资料' })
    const right = await chrome.bookmarks.create({ parentId: '2', title: '同名资料' })
    const child = await chrome.bookmarks.create({ parentId: right.id, title: '子目录' })
    await chrome.bookmarks.create({ parentId: left.id, title: '甲', url: 'https://example.com/a' })
    await chrome.bookmarks.create({ parentId: left.id, title: '乙', url: 'https://example.com/b' })
    const moved = await chrome.bookmarks.create({ parentId: child.id, title: '丙', url: 'https://example.com/c' })
    await refresh()
    const merge = api.folderCleanupState.suggestions.find(item => item.kind === 'same-name-folders' && item.targetFolderId === left.id)
    await api.executeFolderCleanupAction(merge.id, callbacks)
    const merged = { moved: (await chrome.bookmarks.get(moved.id))[0].parentId === left.id, removed: !(await exists(right.id)), status: api.folderCleanupState.statusMessage }

    const large = await chrome.bookmarks.create({ parentId: '1', title: '拆分资料' })
    for (let i = 0; i < 42; i++) await chrome.bookmarks.create({ parentId: large.id, title: `文章 ${i}`, url: `https://${i < 21 ? 'a' : 'b'}.example.com/${i}` })
    await refresh()
    const split = api.folderCleanupState.suggestions.find(item => item.kind === 'large-folder-split' && item.primaryFolderId === large.id)
    await api.executeFolderCleanupAction(split.id, callbacks)
    const undo = api.folderCleanupState.lastSplitUndo
    if (!undo) throw new Error(`Split did not produce undo: ${api.folderCleanupState.statusMessage}`)
    const manual = undo.moves[0]
    await chrome.bookmarks.move(manual.bookmarkId, { parentId: '2' })
    await api.undoFolderCleanupSplitAction(callbacks)
    const splitUndo = {
      manualMovePreserved: (await chrome.bookmarks.get(manual.bookmarkId))[0].parentId === '2',
      restored: (await chrome.bookmarks.getChildren(large.id)).filter(node => node.url).length,
      status: api.folderCleanupState.statusMessage
    }

    const moveKinds = []
    for (const kind of ['deep-single-bookmark', 'single-path-chain']) {
      let parentId = '1'
      for (let depth = 0; depth < 5; depth++) {
        parentId = (await chrome.bookmarks.create({ parentId, title: `${kind}-${depth}` })).id
      }
      const bookmark = await chrome.bookmarks.create({ parentId, title: '保留的末端书签', url: `https://example.com/${kind}` })
      await refresh()
      const suggestion = api.folderCleanupState.suggestions.find(item => item.kind === kind && item.bookmarkIds.includes(bookmark.id))
      await api.executeFolderCleanupAction(suggestion.id, { ...callbacks, confirm: async () => false })
      const cancelled = (await chrome.bookmarks.get(bookmark.id))[0].parentId === parentId
      await api.executeFolderCleanupAction(suggestion.id, callbacks)
      moveKinds.push({ kind, cancelled, moved: (await chrome.bookmarks.get(bookmark.id))[0].parentId === suggestion.targetFolderId,
        removed: (await Promise.all(suggestion.folderIds.map(exists))).every(value => !value) })
    }
    if (locked) throw new Error('Cleanup leaked its mutation lease')
    return { stale, racing, merged, splitUndo, moveKinds }
  })
  await writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2))
  assert.equal(result.stale.preserved, true, 'An outdated empty-folder suggestion must preserve newly added contents')
  assert.equal(result.racing.preserved, true, 'The deletion API must refuse a folder populated during execution')
  assert.equal(result.merged.moved && result.merged.removed, true, 'Merge must support nested source folders')
  assert.equal(result.splitUndo.manualMovePreserved, true, 'Undo must preserve later manual folder choices')
  assert.equal(result.splitUndo.restored, 41)
  assert.ok(result.moveKinds.every(item => item.cancelled && item.moved && item.removed), 'Deep and chain cleanup must preserve bookmarks and honor cancellation')
  console.log('Folder cleanup stale-preview, concurrent save, nested merge and split undo passed.', result)
} finally {
  await context.close()
  await rm(temporary, { recursive: true, force: true })
}
