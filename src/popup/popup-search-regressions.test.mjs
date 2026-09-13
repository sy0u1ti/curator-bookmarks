import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// Exercise the actual controller without starting Chrome or exposing testing
// methods in the extension. Only timers and browser/IndexedDB boundaries are fake.
const source = await readFile(new URL('./popup-controller.ts', import.meta.url), 'utf8')
const bundle = await build({
  stdin: {
    contents: `${source}
export {
  state, setSearchQuery, handleDocumentKeydown, applyPopupIndexedBookmarkData,
  warmPopupSnapshotFullTextIndex, cleanupPopupController,
  getSearchCacheKey, getNaturalSearchDateBucket,
  buildBookmarkCatalogSnapshot, buildLightPopupSearchIndexFromCatalog,
  searchBookmarks, searchBookmarksCooperatively, searchBookmarksFirstBatch,
  setPopupKeyboardHelpOpen, isPopupKeyboardHelpOpen
};
export { setContentFullTextOperationsForTest } from '../shared/content-snapshots.js';
export function readCatalogForTest() { return popupBookmarkCatalog; }
`,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)),
    sourcefile: 'popup-controller-regression-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"test"' },
  logLevel: 'silent'
})
const controller = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const { state } = controller
const timers = new Map()
const frames = new Map()
const openedUrls = []
const openedTabs = []
const updatedTabs = []
let nextTimer = 1
const originalGlobals = new Map()

function installGlobal(name, value) {
  originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

const fakeSetTimeout = (callback) => {
  const id = nextTimer++
  timers.set(id, callback)
  return id
}
const fakeRequestAnimationFrame = (callback) => {
  const id = nextTimer++
  frames.set(id, callback)
  return id
}
installGlobal('setTimeout', fakeSetTimeout)
installGlobal('clearTimeout', (id) => timers.delete(id))
installGlobal('window', {
  setTimeout: fakeSetTimeout,
  clearTimeout: (id) => timers.delete(id),
  requestAnimationFrame: fakeRequestAnimationFrame,
  cancelAnimationFrame: (id) => frames.delete(id),
  matchMedia: () => ({ matches: false }),
  close: () => {}
})
installGlobal('document', { getElementById: () => null, activeElement: null })
installGlobal('HTMLElement', class {})
installGlobal('chrome', {
  runtime: { lastError: undefined },
  tabs: {
    create: (options, callback) => { openedUrls.push(options.url); openedTabs.push(options); callback({ id: 1, ...options }) },
    query: (_options, callback) => callback([{ id: 77, url: 'https://current.example/' }]),
    update: (id, options, callback) => { updatedTabs.push({ id, ...options }); callback({ id, ...options }) }
  }
})

function bookmark(id, title, url = `https://example.test/${id}`) {
  return { id, title, url, parentId: '1', index: 0, dateAdded: 1 }
}

function installBookmarks(bookmarks, snapshotState = null) {
  const root = { id: '0', title: '', children: [{ id: '1', title: 'Bookmarks bar', children: bookmarks }] }
  const catalog = controller.buildBookmarkCatalogSnapshot({ rootNode: root, snapshotState })
  state.rawTreeRoot = root
  state.bookmarksBarNode = root.children[0]
  controller.applyPopupIndexedBookmarkData({
    catalog,
    indexedBookmarks: controller.buildLightPopupSearchIndexFromCatalog(catalog)
  })
  state.isLoading = false
  state.searchQuery = ''
  state.debouncedQuery = ''
  state.searchResults = []
  state.activeResultIndex = -1
  state.searchPending = false
  state.naturalSearchEnabled = false
  state.naturalSearchPending = false
  state.selectedFolderFilterId = null
  state.keyboardPane = 'bookmarks'
  state.loadError = ''
  timers.clear()
  frames.clear()
  openedUrls.length = 0
  openedTabs.length = 0
  updatedTabs.length = 0
  return catalog
}

function pressEnter(isComposing = false, modifiers = {}) {
  const event = {
    key: 'Enter', target: null, isComposing, defaultPrevented: false,
    ...modifiers,
    preventDefault() { this.defaultPrevented = true }
  }
  controller.handleDocumentKeydown(event)
  return event
}

async function finishCooperativeSearch() {
  for (let step = 0; step < 100 && state.searchPending; step += 1) {
    for (const [id, callback] of [...frames]) {
      frames.delete(id)
      callback(step)
    }
    await Promise.resolve()
  }
  assert.equal(state.searchPending, false, 'cooperative search should complete in the controlled scheduler')
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function snapshotFor(bookmarkId) {
  return {
    settings: { fullTextSearchEnabled: true },
    index: {
      version: 1, updatedAt: 1,
      records: {
        [bookmarkId]: {
          bookmarkId, snapshotId: `snapshot-${bookmarkId}`,
          fullTextStorage: 'idb', fullTextRef: `text-${bookmarkId}`
        }
      }
    }
  }
}

try {
  installBookmarks([
    bookmark('literal', 'Not found'),
    bookmark('unrelated', 'Neutral'),
    bookmark('chinese', '我爱我家'),
    bookmark('recent-word', 'New'),
    bookmark('date-word', '昨天')
  ])
  for (const [query, id] of [['"not found"', 'literal'], ['"我爱我家"', 'chinese'], ['"new"', 'recent-word'], ['"昨天"', 'date-word']]) {
    assert.deepEqual(controller.searchBookmarks(query, state.allBookmarks).map((result) => result.id), [id])
  }
  installBookmarks([bookmark('dotted-title', 'React.js'), bookmark('compact-title', 'ReactJS')])
  assert.deepEqual(controller.searchBookmarksFirstBatch('"react.js"', state.allBookmarks).results.map((row) => row.id), ['dotted-title'],
    'the provisional first batch must also respect literal punctuation')

  const siteBookmarks = [
    bookmark('site', 'GitHub', 'https://github.com/openai'),
    bookmark('subdomain', 'GitHub Docs', 'https://docs.github.com/en'),
    bookmark('substring-host', 'Other', 'https://notgithub.com/openai'),
    bookmark('url-only', 'Source', 'https://example.org/?source=github.com')
  ]
  const expectedSiteIds = ['site', 'subdomain']
  for (const fillerCount of [0, 1200]) {
    installBookmarks([...siteBookmarks, ...Array.from({ length: fillerCount }, (_, index) => bookmark(`filler-${index}`, 'Neutral'))])
    assert.deepEqual(controller.searchBookmarks('site:github.com', state.allBookmarks).map((row) => row.id).sort(), expectedSiteIds)
    assert.deepEqual((await controller.searchBookmarksCooperatively('site:github.com', state.allBookmarks, {
      isActive: () => true, yieldWork: () => Promise.resolve()
    })).map((row) => row.id).sort(), expectedSiteIds)
    assert.ok(controller.searchBookmarks('url:github.com', state.allBookmarks).some((row) => row.id === 'url-only'))
    for (const query of ['site:github.com zqxvunique', 'folder:bookmarks zqxvunique', 'recent zqxvunique', 'site:github.com recent zqxvunique']) {
      assert.deepEqual(controller.searchBookmarks(query, state.allBookmarks), [], `${query} must not match the filter/sort alone`)
      assert.deepEqual(await controller.searchBookmarksCooperatively(query, state.allBookmarks, {
        isActive: () => true, yieldWork: () => Promise.resolve()
      }), [], `${query} must have the same semantics during cooperative search`)
    }
    assert.equal(controller.searchBookmarks('site:github.com docs', state.allBookmarks)[0]?.id, 'subdomain')
    assert.ok(controller.searchBookmarks('recent', state.allBookmarks).length, 'a standalone recency query should still browse recent bookmarks')
  }

  const oldBookmark = bookmark('alpha', 'Alpha document')
  const newBookmark = bookmark('beta', 'Beta manual')
  installBookmarks([oldBookmark, newBookmark])
  controller.setSearchQuery('alpha document', { immediate: true })
  controller.setSearchQuery('beta manual')
  assert.equal(state.debouncedQuery, 'alpha document', 'reproduction must still be inside the input debounce')
  assert.equal(pressEnter().defaultPrevented, true)
  assert.deepEqual(openedUrls, [newBookmark.url], 'fast Enter must open the latest query result')
  assert.equal(timers.size, 0, 'flushing Enter should cancel the delayed duplicate search')

  openedUrls.length = 0
  controller.setSearchQuery('')
  pressEnter()
  assert.deepEqual(openedUrls, [], 'clearing the input then pressing Enter must not open the old result')

  controller.setSearchQuery('alpha document', { immediate: true })
  controller.setSearchQuery('beta manual')
  pressEnter(true)
  assert.deepEqual(openedUrls, [], 'IME confirmation must not trigger bookmark activation')
  assert.equal(state.debouncedQuery, 'alpha document', 'IME confirmation must not flush composition input')

  installBookmarks([oldBookmark, newBookmark, ...Array.from({ length: 1200 }, (_, index) => bookmark(`entry-${index}`, 'Neutral'))])
  controller.setSearchQuery('beta manual')
  pressEnter()
  assert.equal(state.searchPending, true)
  assert.deepEqual(openedUrls, [], 'Enter must wait for the latest cooperative ranking to settle')
  await finishCooperativeSearch()
  assert.deepEqual(openedUrls, [newBookmark.url], 'the queued Enter must open the completed query without requiring a second keypress')
  installBookmarks([oldBookmark, newBookmark, ...Array.from({ length: 1200 }, (_, index) => bookmark(`cancel-${index}`, 'Neutral'))])
  controller.setSearchQuery('beta manual')
  pressEnter()
  controller.setSearchQuery('alpha document', { immediate: true })
  await finishCooperativeSearch()
  assert.deepEqual(openedUrls, [], 'editing a query cancels its pending activation')
  controller.setSearchQuery('beta manual', { immediate: true })
  pressEnter()
  controller.handleDocumentKeydown({ key: 'Escape', target: null, defaultPrevented: false, preventDefault() {} })
  await finishCooperativeSearch()
  assert.deepEqual(openedUrls, [], 'Escape cancels a pending activation')

  controller.setSearchQuery('manual beta')
  pressEnter()
  assert.equal(state.searchPending, true)
  controller.cancelPendingSearchActivation()
  await finishCooperativeSearch()
  assert.deepEqual(openedUrls, [], 'a new pointer interaction cancels the queued keyboard activation')

  controller.setSearchQuery('beta manual', { immediate: true })
  await finishCooperativeSearch()
  openedUrls.length = 0
  state.naturalSearchPending = true
  pressEnter()
  assert.deepEqual(openedUrls, [], 'an unfinished semantic query must not activate a stale selection')
  state.naturalSearchPending = false
  controller.setSearchQuery('', { immediate: true })

  installBookmarks([oldBookmark, newBookmark])
  controller.setSearchQuery('alpha document', { immediate: true })
  state.naturalSearchEnabled = true
  state.searchCache.set(controller.getSearchCacheKey(`natural:${controller.getNaturalSearchDateBucket()}:beta manual`),
    controller.searchBookmarks('beta manual', state.allBookmarks))
  controller.setSearchQuery('beta manual')
  pressEnter()
  assert.equal(state.naturalSearchPending, true, 'cached semantic results must still wait for asynchronous provider/plan validation')
  assert.deepEqual(openedUrls, [], 'a cached semantic query must not activate the previous query while validating its plan')
  controller.cleanupPopupController()

  installBookmarks([oldBookmark, newBookmark])
  controller.setSearchQuery('beta manual', { immediate: true })
  pressEnter(false, { ctrlKey: true })
  assert.equal(openedTabs[0].active, false, 'Ctrl Enter opens a background tab')
  assert.equal(state.searchQuery, 'beta manual')
  pressEnter(false, { metaKey: true })
  assert.equal(openedTabs[1].active, false, 'Command Enter uses the same background behavior')
  pressEnter(false, { altKey: true })
  for (let step = 0; step < 10; step++) await Promise.resolve()
  assert.deepEqual(updatedTabs, [{ id: 77, url: newBookmark.url }], 'Alt Enter resolves and updates the current tab')

  installBookmarks([oldBookmark, newBookmark, ...Array.from({ length: 1200 }, (_, index) => bookmark(`keyboard-${index}`, 'Neutral'))])
  controller.setSearchQuery('beta manual')
  pressEnter(false, { ctrlKey: true })
  await finishCooperativeSearch()
  assert.equal(openedTabs[0].active, false, 'queued Enter retains its opening disposition')
  controller.setSearchQuery('alpha document')
  pressEnter()
  controller.handleDocumentKeydown({ key: '/', ctrlKey: true, target: null, defaultPrevented: false, preventDefault() {} })
  assert.equal(controller.isPopupKeyboardHelpOpen(), true)
  await finishCooperativeSearch()
  assert.equal(openedTabs.length, 1, 'opening help cancels a queued bookmark activation')
  pressEnter()
  assert.equal(openedTabs.length, 1, 'Enter inside help must not open an underlying result')
  controller.handleDocumentKeydown({ key: 'Escape', target: null, defaultPrevented: false, preventDefault() {} })
  assert.equal(controller.isPopupKeyboardHelpOpen(), false)
  assert.equal(state.searchQuery, 'alpha document', 'closing help retains the search')

  const oldSnapshot = snapshotFor('old-snapshot')
  const newSnapshot = snapshotFor('new-snapshot')
  installBookmarks([bookmark('old-snapshot', 'Old page')], oldSnapshot)
  const readStarted = deferred()
  const oldRead = deferred()
  const restoreReads = controller.setContentFullTextOperationsForTest({
    getMany: () => { readStarted.resolve(); return oldRead.promise }
  })
  try {
    state.searchSnapshotFullTextPending = true
    const oldWarmup = controller.warmPopupSnapshotFullTextIndex(oldSnapshot, state.searchSnapshotFullTextRunId)
    await readStarted.promise
    const nextCatalog = installBookmarks([bookmark('new-snapshot', 'New page')], newSnapshot)
    const pinyinRunId = state.pinyinEnrichmentRunId
    oldRead.resolve(new Map([['text-old-snapshot', 'old snapshot content']]))
    await oldWarmup
    assert.equal(controller.readCatalogForTest(), nextCatalog, 'an obsolete warmup must not replace the refreshed catalog')
    assert.equal(state.searchSnapshotFullTextReady, false, 'the new light index must still be eligible for full-text enrichment')
    assert.equal(state.pinyinEnrichmentRunId, pinyinRunId, 'an obsolete completion must not reset the new pinyin job')
  } finally {
    restoreReads()
  }

  const restoreCurrentReads = controller.setContentFullTextOperationsForTest({
    getMany: async () => new Map([['text-new-snapshot', 'unique fulltext phrase']])
  })
  try {
    state.searchSnapshotFullTextPending = true
    await controller.warmPopupSnapshotFullTextIndex(newSnapshot, state.searchSnapshotFullTextRunId)
    assert.equal(state.searchSnapshotFullTextReady, true)
    assert.equal(state.searchSnapshotFullTextPending, false)
    assert.equal(controller.searchBookmarks('"unique fulltext phrase"', state.allBookmarks)[0]?.id, 'new-snapshot')
  } finally {
    restoreCurrentReads()
  }

  console.log('Popup search, Enter, IME, and full-text lifecycle regressions passed.')
} finally {
  controller.cleanupPopupController()
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
}
