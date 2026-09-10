import assert from 'node:assert/strict'
import {
  getNewtabBookmarkContentNodes,
  setNewtabBookmarkFolderHeaderNode,
  setNewtabBookmarkFolderSectionNode,
  setNewtabBookmarkGridNode,
  setNewtabBookmarkTileIconNode,
  setNewtabBookmarkTileNode
} from './newtab-bookmark-content-store.js'
import {
  findNewTabFolder,
  getDisplayableNewTabSourceFolders,
  normalizeFolderSettingsWithDefault
} from './folder-settings.js'

// Exercise the same callback-ref lifecycle as progressively mounted tiles and
// navigation between folders. Count work rather than asserting machine timings.
const OriginalMap = globalThis.Map
let copiedEntries = 0
let lifecycleCopiedEntries = 0
const tileCount = 1024
const elements = Array.from({ length: tileCount }, (_, index) => ({ index } as unknown as HTMLElement))

try {
  globalThis.Map = class TrackedMap<K, V> extends OriginalMap<K, V> {
    constructor(entries?: Iterable<readonly [K, V]> | null) {
      super(entries)
      if (entries instanceof OriginalMap) {
        copiedEntries += entries.size
      }
    }
  } as MapConstructor

  for (let index = 0; index < tileCount; index += 1) {
    setNewtabBookmarkTileNode(String(index), elements[index])
    setNewtabBookmarkTileIconNode(String(index), elements[index])
  }
  assert.equal(getNewtabBookmarkContentNodes().tiles.size, tileCount)
  assert.equal(getNewtabBookmarkContentNodes().tileIcons.get('1023'), elements[1023])
  for (let index = 0; index < tileCount; index += 1) {
    setNewtabBookmarkTileNode(String(index), null)
    setNewtabBookmarkTileIconNode(String(index), null)
  }
  assert.equal(getNewtabBookmarkContentNodes().tiles.size, 0)
  assert.equal(getNewtabBookmarkContentNodes().tileIcons.size, 0)
  lifecycleCopiedEntries = copiedEntries
} finally {
  globalThis.Map = OriginalMap
}

const nodeSetters = [
  ['tiles', setNewtabBookmarkTileNode],
  ['tileIcons', setNewtabBookmarkTileIconNode],
  ['grids', setNewtabBookmarkGridNode],
  ['folderSections', setNewtabBookmarkFolderSectionNode],
  ['folderHeaders', setNewtabBookmarkFolderHeaderNode]
] as const

for (const [key, setNode] of nodeSetters) {
  setNode(' ', elements[0])
  assert.equal(getNewtabBookmarkContentNodes()[key].size, 0, 'Empty identifiers must remain ignored.')
  setNode(' example ', elements[0])
  setNode('example', elements[0])
  assert.equal(getNewtabBookmarkContentNodes()[key].get('example'), elements[0])
  assert.equal(getNewtabBookmarkContentNodes()[key].size, 1, 'Duplicate refs must remain idempotent.')
  setNode('example', elements[1])
  assert.equal(getNewtabBookmarkContentNodes()[key].get('example'), elements[1], 'A remounted ref must replace its previous element.')
  setNode('example', null)
  setNode('example', null)
  assert.equal(getNewtabBookmarkContentNodes()[key].size, 0, 'Unmounting must release DOM references.')
}

let urlReads = 0
const bookmarkCount = 2048
function createNode(
  id: string,
  children?: chrome.bookmarks.BookmarkTreeNode[],
  url?: string
): chrome.bookmarks.BookmarkTreeNode {
  return { id, title: id, syncing: false, children, get url() { urlReads += 1; return url } }
}

const leaf = createNode('leaf', Array.from({ length: bookmarkCount }, (_, index) =>
  createNode(`bookmark-${index}`, undefined, `https://example.com/${index}`)
))
let root = leaf
for (let depth = 0; depth < 48; depth += 1) {
  root = createNode(`folder-${depth}`, [root])
}
urlReads = 0
assert.deepEqual(getDisplayableNewTabSourceFolders(root), [leaf])
const nestedUrlReads = urlReads

const empty = createNode('empty', [])
const direct = createNode('direct', [createNode('bookmark', undefined, 'https://example.com'), empty, leaf])
assert.deepEqual(getDisplayableNewTabSourceFolders(direct), [direct, leaf], 'Folder order and direct-bookmark semantics must be preserved.')
assert.deepEqual(getDisplayableNewTabSourceFolders(empty), [empty], 'An empty selected source must keep its add-bookmark surface.')
assert.deepEqual(getDisplayableNewTabSourceFolders(null), [])
assert.deepEqual(getDisplayableNewTabSourceFolders(createNode('bookmark', undefined, 'https://example.com')), [])

const namedSource = { ...createNode('named', [leaf]), title: '标签页', parentId: '1' }
const emptyNamedSource = { ...createNode('empty-named', []), title: '标签页', parentId: '1' }
const bookmarksBar = createNode('1', [emptyNamedSource, namedSource])
const browserRoot = createNode('0', [bookmarksBar])
assert.equal(findNewTabFolder(browserRoot, { requireDisplayableBookmarks: true }), namedSource)
assert.equal(findNewTabFolder(browserRoot, { requireDirectBookmarks: true }), null)
assert.deepEqual(normalizeFolderSettingsWithDefault(null, browserRoot).selectedFolderIds, ['named'])
assert.deepEqual(normalizeFolderSettingsWithDefault({ selectedFolderIds: [] }, browserRoot).selectedFolderIds, [], 'An explicit empty selection must not pick a default source.')
bookmarksBar.children.unshift(createNode('bar-bookmark', undefined, 'https://example.com'))
assert.deepEqual(normalizeFolderSettingsWithDefault(null, browserRoot).selectedFolderIds, ['1'], 'Direct bookmarks on the bookmarks bar must retain default-source priority.')

assert.ok(
  lifecycleCopiedEntries <= tileCount * 10,
  `Mounting and unmounting ${tileCount} tiles must use linear ref bookkeeping; copied ${lifecycleCopiedEntries} entries.`
)
assert.ok(
  nestedUrlReads <= (bookmarkCount + 49) * 3,
  `Source-folder discovery must not repeatedly scan descendants; observed ${nestedUrlReads} URL reads.`
)
console.log('Newtab large-bookmark performance regression tests passed.')
