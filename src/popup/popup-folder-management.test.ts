import {
  POPUP_FOLDER_SORT_OPTIONS,
  collectFolderDescendantIds,
  computeMultiSelectSwipeRange,
  computeMultiSelectToggle,
  computeSortedDirectBookmarkIds,
  countFolderSubtreeContents,
  getPopupFolderSortOption,
  isProtectedBookmarkFolder,
  planDirectBookmarkSortMoves,
  pruneSelectionToVisibleIds,
  validateFolderTitle
} from './popup-folder-management.js'

function run(): void {
  testProtectedFolderGuards()
  testFolderTitleValidation()
  testFolderDescendantCollectionAndCounts()
  testAllFiveFolderSortModes()
  testPlanDirectBookmarkSortMovesPreservesInterleavedSubfoldersAndRoundtrips()
  testMultiSelectToggleAndShiftRange()
  testMultiSelectSwipeRange()
  testPruneSelectionToVisibleIds()
}

function testProtectedFolderGuards(): void {
  assert(isProtectedBookmarkFolder(null), 'null node must be protected')
  assert(isProtectedBookmarkFolder({ id: '0', title: '', syncing: false }), 'virtual root 0 must be protected')
  assert(isProtectedBookmarkFolder({ id: '1', parentId: '0', title: '书签栏', syncing: false }), 'bookmarks bar must be protected')
  assert(isProtectedBookmarkFolder({ id: '2', parentId: '0', title: '其他书签', syncing: false }), 'other bookmarks must be protected')
  assert(
    isProtectedBookmarkFolder({ id: '9', parentId: '1', title: 'Managed', unmodifiable: 'managed', syncing: false }),
    'managed enterprise folders must be protected'
  )
  assert(
    isProtectedBookmarkFolder({ id: '10', parentId: '1', title: 'Link', url: 'https://example.com', syncing: false }),
    'bookmark leaves are not manageable folders'
  )
  assert(
    !isProtectedBookmarkFolder({ id: '11', parentId: '1', title: '开发工具', children: [], syncing: false }),
    'regular user folder must be manageable'
  )
}

function testFolderTitleValidation(): void {
  assert(!validateFolderTitle('').ok, 'empty title must fail')
  assert(!validateFolderTitle('   \t\n ').ok, 'whitespace-only title must fail')
  assert(!validateFolderTitle('a'.repeat(181)).ok, 'title longer than 180 chars must fail')
  const ok = validateFolderTitle('  前端资料  ')
  assert(ok.ok && ok.title === '前端资料', 'valid title should be trimmed')
}

function testFolderDescendantCollectionAndCounts(): void {
  const tree = folder('f1', [
    bookmark('b1', 'A', 100),
    folder('f2', [
      bookmark('b2', 'B', 200),
      folder('f3', [
        bookmark('b3', 'C', 300)
      ])
    ])
  ])
  const descendants = collectFolderDescendantIds(tree)
  assertDeepEqual(
    [...descendants].sort(),
    ['f1', 'f2', 'f3'],
    'descendant IDs must include self and every nested folder without bookmarks'
  )
  const counts = countFolderSubtreeContents(tree)
  assertDeepEqual(
    counts,
    { bookmarkCount: 3, subfolderCount: 2 },
    'subtree count must tally all nested bookmarks and subfolders'
  )
}

function testAllFiveFolderSortModes(): void {
  assert(POPUP_FOLDER_SORT_OPTIONS.length === 5, 'expected 5 folder sort options')
  assert(getPopupFolderSortOption('frequency-desc').mode === 'frequency-desc', 'sort option lookup should match mode')

  const bookmarks = [
    { id: 'b1', title: 'Item 10', url: 'https://b1.example', dateAdded: 1000 },
    { id: 'b2', title: 'Item 2', url: 'https://b2.example', dateAdded: 3000 },
    { id: 'b3', title: 'Alpha', url: 'https://b3.example', dateAdded: 2000 },
    { id: 'b4', title: 'Beta', url: 'https://b4.example', dateAdded: 4000 }
  ]

  assertDeepEqual(
    computeSortedDirectBookmarkIds(bookmarks, 'title-asc').orderedIds,
    ['b3', 'b4', 'b2', 'b1'],
    'title-asc must sort naturally with numeric collation (Item 2 before Item 10)'
  )
  assertDeepEqual(
    computeSortedDirectBookmarkIds(bookmarks, 'title-desc').orderedIds,
    ['b1', 'b2', 'b4', 'b3'],
    'title-desc must reverse natural title order'
  )
  assertDeepEqual(
    computeSortedDirectBookmarkIds(bookmarks, 'date-desc').orderedIds,
    ['b4', 'b2', 'b3', 'b1'],
    'date-desc must place newest dateAdded first'
  )
  assertDeepEqual(
    computeSortedDirectBookmarkIds(bookmarks, 'date-asc').orderedIds,
    ['b1', 'b3', 'b2', 'b4'],
    'date-asc must place oldest dateAdded first'
  )

  const activity = {
    b1: { bookmarkId: 'b1', title: 'Item 10', url: 'https://b1.example', openCount: 9, firstOpenedAt: 100, lastOpenedAt: 500 },
    b3: { bookmarkId: 'b3', title: 'Alpha', url: 'https://b3.example', openCount: 9, firstOpenedAt: 100, lastOpenedAt: 900 },
    b2: { bookmarkId: 'b2', title: 'Item 2', url: 'https://b2.example', openCount: 2, firstOpenedAt: 100, lastOpenedAt: 1000 }
  }
  const freq = computeSortedDirectBookmarkIds(bookmarks, 'frequency-desc', activity)
  assert(freq.matchedActivityCount === 3, 'frequency sort should count bookmarks with activity')
  assertDeepEqual(
    freq.orderedIds,
    ['b3', 'b1', 'b2', 'b4'],
    'frequency-desc must rank by openCount, then lastOpenedAt, then dateAdded'
  )
}

function testPlanDirectBookmarkSortMovesPreservesInterleavedSubfoldersAndRoundtrips(): void {
  const initialChildren = [
    folder('sub-a', []),
    bookmark('b3', 'Gamma', 3),
    bookmark('b1', 'Alpha', 1),
    folder('sub-b', []),
    bookmark('b2', 'Beta', 2)
  ]

  const sortedMoves = planDirectBookmarkSortMoves(initialChildren, ['b1', 'b2', 'b3'])
  const afterSort = simulateChromeMoves(initialChildren, sortedMoves)
  assertDeepEqual(
    afterSort.map((node) => node.id),
    ['sub-a', 'b1', 'b2', 'sub-b', 'b3'],
    'sort moves must reorder bookmarks strictly within bookmark slots while preserving subfolder slots'
  )
  assert(
    sortedMoves.every((move) => !move.bookmarkId.startsWith('sub-')),
    'sort planner must never move subfolder nodes'
  )

  // Exhaustive check: interleaved subfolders + 4 bookmarks across all 24 permutations.
  const interleaved = [
    bookmark('b1', 'One', 1),
    folder('sub-1', []),
    bookmark('b2', 'Two', 2),
    folder('sub-2', []),
    bookmark('b3', 'Three', 3),
    bookmark('b4', 'Four', 4),
    folder('sub-3', [])
  ]
  for (const permutation of permute(['b1', 'b2', 'b3', 'b4'])) {
    const moves = planDirectBookmarkSortMoves(interleaved, permutation)
    assert(moves.every((move) => !move.bookmarkId.startsWith('sub-')), 'never move folders in any permutation')
    const result = simulateChromeMoves(interleaved, moves)
    assertDeepEqual(
      result.map((node) => node.id),
      [permutation[0], 'sub-1', permutation[1], 'sub-2', permutation[2], permutation[3], 'sub-3'],
      `permutation ${permutation.join(',')} must preserve every subfolder slot`
    )
  }

  // Undo restores the exact original order using the same move planner.
  const undoMoves = planDirectBookmarkSortMoves(afterSort, ['b3', 'b1', 'b2'])
  const afterUndo = simulateChromeMoves(afterSort, undoMoves)
  assertDeepEqual(
    afterUndo.map((node) => node.id),
    initialChildren.map((node) => node.id),
    'undoing a sort must restore the exact original sibling layout'
  )

  assertDeepEqual(
    planDirectBookmarkSortMoves(afterSort, ['b1', 'b2', 'b3']),
    [],
    'already-sorted folder should produce zero moves'
  )
}

function testMultiSelectToggleAndShiftRange(): void {
  const visible = ['a', 'b', 'c', 'd', 'e']
  const first = computeMultiSelectToggle(new Set(), visible, 'b', '', false)
  assertDeepEqual([...first.selectedIds], ['b'], 'clicking toggles item on')
  assert(first.anchorId === 'b', 'anchor should update to clicked item')

  const ranged = computeMultiSelectToggle(first.selectedIds, visible, 'd', first.anchorId, true)
  assertDeepEqual([...ranged.selectedIds], ['b', 'c', 'd'], 'Shift+click selects inclusive range')
  assert(ranged.anchorId === 'd', 'anchor should advance after range select')

  const reversed = computeMultiSelectToggle(ranged.selectedIds, visible, 'a', ranged.anchorId, true)
  assertDeepEqual([...reversed.selectedIds].sort(), ['a', 'b', 'c', 'd'], 'upward Shift+click works identically')

  const unchecked = computeMultiSelectToggle(reversed.selectedIds, visible, 'c', reversed.anchorId, false)
  assert(!unchecked.selectedIds.has('c') && unchecked.selectedIds.size === 3, 'clicking selected item unchecks it')
}

function testMultiSelectSwipeRange(): void {
  const visible = ['a', 'b', 'c', 'd', 'e']
  const base = new Set(['e'])

  const down = computeMultiSelectSwipeRange(base, visible, 0, 3, true)
  assertDeepEqual([...down.selectedIds].sort(), ['a', 'b', 'c', 'd', 'e'], 'downward swipe selects continuous range while preserving prior selections')
  assert(down.anchorId === 'd', 'swipe anchor tracks end row')

  const pulledBack = computeMultiSelectSwipeRange(base, visible, 0, 1, true)
  assertDeepEqual([...pulledBack.selectedIds].sort(), ['a', 'b', 'e'], 'pulling back before release reverts overshot rows to base selection')

  const up = computeMultiSelectSwipeRange(new Set(), visible, 3, 1, true)
  assertDeepEqual([...up.selectedIds].sort(), ['b', 'c', 'd'], 'upward swipe selects inclusive range')

  const deselect = computeMultiSelectSwipeRange(new Set(['a', 'b', 'c', 'd']), visible, 1, 2, false)
  assertDeepEqual([...deselect.selectedIds].sort(), ['a', 'd'], 'starting on a checked row swipes to deselect continuous range')

  const clamped = computeMultiSelectSwipeRange(new Set(), visible, -2, 99, true)
  assertDeepEqual([...clamped.selectedIds], ['a', 'b', 'c', 'd', 'e'], 'out-of-bounds swipe indices clamp safely')
}

function testPruneSelectionToVisibleIds(): void {
  const selected = new Set(['a', 'b', 'c'])
  const sameRef = pruneSelectionToVisibleIds(selected, ['a', 'b', 'c', 'd'])
  assert(sameRef === selected, 'when all selected IDs remain visible, return same Set reference')

  const pruned = pruneSelectionToVisibleIds(selected, ['b', 'd'])
  assertDeepEqual([...pruned], ['b'], 'invisible IDs must be pruned on view change')
}

function simulateChromeMoves(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  moves: Array<{ bookmarkId: string; index: number }>
): chrome.bookmarks.BookmarkTreeNode[] {
  const list = [...nodes]
  for (const move of moves) {
    const fromIndex = list.findIndex((node) => node.id === move.bookmarkId)
    assert(fromIndex >= 0, `missing node ${move.bookmarkId}`)
    const [item] = list.splice(fromIndex, 1)
    // Chrome adjusts index down by 1 when moving forward within the same parent.
    const insertIndex = fromIndex < move.index ? move.index - 1 : move.index
    list.splice(insertIndex, 0, item)
  }
  return list
}

function bookmark(id: string, title: string, dateAdded: number): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId: '1', title, url: `https://${id}.example`, dateAdded, syncing: false }
}

function folder(id: string, children: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId: '1', title: id, children, syncing: false }
}

function permute<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const results: T[][] = []
  for (let index = 0; index < items.length; index += 1) {
    const head = items[index]
    const rest = [...items.slice(0, index), ...items.slice(index + 1)]
    for (const tail of permute(rest)) {
      results.push([head, ...tail])
    }
  }
  return results
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nactual:   ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`)
  }
}

run()
console.log('Popup folder management tests passed.')
