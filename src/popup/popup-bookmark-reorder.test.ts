import {
  getPopupBookmarkMoveDestinationIndex,
  getPopupBookmarkReorderTargetIndex,
  reorderPopupBookmarkIds
} from './popup-bookmark-reorder.js'

function run(): void {
  testReorderIdsMovesOneBookmark()
  testMoveDestinationAccountsForDownwardChromeIndex()
  testMoveDestinationSkipsFolderNodes()
  testMoveDestinationPlacesLastBookmarkBeforeTrailingFolders()
  testPointerTargetAdjustsForRemovedSourceSlot()
  testPointerTargetUsesVirtualScrollOffset()
}

function testReorderIdsMovesOneBookmark(): void {
  assertDeepEqual(
    reorderPopupBookmarkIds(['a', 'b', 'c', 'd'], 'c', 0),
    ['c', 'a', 'b', 'd'],
    'dragging upward should preserve every other bookmark order'
  )
  assertDeepEqual(
    reorderPopupBookmarkIds(['a', 'b', 'c'], 'a', 2),
    ['b', 'c', 'a'],
    'dragging to the end should append the selected bookmark'
  )
}

function testMoveDestinationAccountsForDownwardChromeIndex(): void {
  const children = [bookmark('a', 0), bookmark('b', 1), bookmark('c', 2)]
  assert(
    getPopupBookmarkMoveDestinationIndex(children, 'a', 1) === 2,
    'same-parent downward moves should include the source slot in the Chrome destination index'
  )
  assert(
    getPopupBookmarkMoveDestinationIndex(children, 'c', 0) === 0,
    'upward moves should use the target child index directly'
  )
}

function testMoveDestinationSkipsFolderNodes(): void {
  const children = [bookmark('a', 0), folder('folder', 1), bookmark('b', 2), bookmark('c', 3)]
  assert(
    getPopupBookmarkMoveDestinationIndex(children, 'c', 1) === 2,
    'bookmark-only positions should resolve against the complete mixed child list'
  )
  assert(
    getPopupBookmarkMoveDestinationIndex(children, 'a', 2) === 4,
    'moving past bookmarks separated by a folder should preserve bookmark ordering semantics'
  )
}

function testMoveDestinationPlacesLastBookmarkBeforeTrailingFolders(): void {
  const children = [bookmark('a', 0), bookmark('b', 1), folder('folder', 2)]
  assert(
    getPopupBookmarkMoveDestinationIndex(children, 'a', 1) === 2,
    'the last bookmark position should remain before an existing trailing folder'
  )
}

function testPointerTargetAdjustsForRemovedSourceSlot(): void {
  assert(
    getPopupBookmarkReorderTargetIndex({
      containerTop: 100,
      paddingTop: 8,
      pointerY: 100 + 8 + 3 * 80,
      rowCount: 5,
      rowHeight: 80,
      scrollTop: 0,
      sourceIndex: 1
    }) === 2,
    'an insertion below the source should subtract the removed source slot'
  )
}

function testPointerTargetUsesVirtualScrollOffset(): void {
  assert(
    getPopupBookmarkReorderTargetIndex({
      containerTop: 200,
      paddingTop: 8,
      pointerY: 248,
      rowCount: 40,
      rowHeight: 80,
      scrollTop: 800,
      sourceIndex: 2
    }) === 10,
    'pointer targeting should include virtual-list scroll offset'
  )
}

function bookmark(id: string, index: number): chrome.bookmarks.BookmarkTreeNode {
  return { id, index, parentId: 'parent', syncing: false, title: id, url: `https://${id}.example` }
}

function folder(id: string, index: number): chrome.bookmarks.BookmarkTreeNode {
  return { children: [], id, index, parentId: 'parent', syncing: false, title: id }
}

function assert(value: unknown, message: string): void {
  if (!value) throw new Error(message)
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

run()
console.log('Popup bookmark reorder tests passed.')
