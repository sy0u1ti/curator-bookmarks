import type { NewTabActivityRepositoryRecord } from '../shared/repositories/activity-repository.js'

export type PopupFolderSortMode =
  | 'title-asc'
  | 'title-desc'
  | 'date-desc'
  | 'date-asc'
  | 'frequency-desc'

export interface PopupFolderSortOption {
  label: string
  mode: PopupFolderSortMode
  shortLabel: string
}

export const POPUP_FOLDER_SORT_OPTIONS: readonly PopupFolderSortOption[] = [
  { mode: 'title-asc', label: '按名称（A → Z）', shortLabel: '名称升序' },
  { mode: 'title-desc', label: '按名称（Z → A）', shortLabel: '名称降序' },
  { mode: 'date-desc', label: '按收藏时间（最新在前）', shortLabel: '最新收藏' },
  { mode: 'date-asc', label: '按收藏时间（最早在前）', shortLabel: '最早收藏' },
  { mode: 'frequency-desc', label: '按常点程度（最常访问在前）', shortLabel: '常点程度' }
]

export interface PopupSortableBookmarkLike {
  dateAdded?: number
  id: string
  title?: string
  url?: string
}

export interface PopupDirectBookmarkSortMove {
  bookmarkId: string
  index: number
}

const TITLE_COLLATOR = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base'
})

const MAX_FOLDER_TITLE_LENGTH = 180

export function isProtectedBookmarkFolder(
  node: chrome.bookmarks.BookmarkTreeNode | null | undefined
): boolean {
  if (!node || Boolean(node.url)) {
    return true
  }
  const folderId = String(node.id || '').trim()
  const parentId = String(node.parentId || '').trim()
  if (!folderId || folderId === '0' || !parentId || parentId === '0') {
    return true
  }
  return node.unmodifiable === 'managed'
}

export function validateFolderTitle(rawTitle: unknown): { ok: true; title: string } | { ok: false; error: string } {
  const trimmed = String(rawTitle ?? '').trim()
  if (!trimmed) {
    return { ok: false, error: '请输入文件夹名称' }
  }
  if (trimmed.length > MAX_FOLDER_TITLE_LENGTH) {
    return { ok: false, error: `文件夹名称不能超过 ${MAX_FOLDER_TITLE_LENGTH} 个字符` }
  }
  return { ok: true, title: trimmed }
}

export function collectFolderDescendantIds(
  folderNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
): Set<string> {
  const ids = new Set<string>()
  if (!folderNode || folderNode.url) {
    return ids
  }
  const stack: chrome.bookmarks.BookmarkTreeNode[] = [folderNode]
  while (stack.length) {
    const current = stack.pop()!
    const currentId = String(current.id || '').trim()
    if (currentId) {
      ids.add(currentId)
    }
    for (const child of current.children || []) {
      if (!child.url) {
        stack.push(child)
      }
    }
  }
  return ids
}

export function countFolderSubtreeContents(
  folderNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
): { bookmarkCount: number; subfolderCount: number } {
  let bookmarkCount = 0
  let subfolderCount = 0
  if (!folderNode || folderNode.url) {
    return { bookmarkCount, subfolderCount }
  }
  const stack: chrome.bookmarks.BookmarkTreeNode[] = [...(folderNode.children || [])]
  while (stack.length) {
    const current = stack.pop()!
    if (current.url) {
      bookmarkCount += 1
      continue
    }
    subfolderCount += 1
    if (current.children?.length) {
      stack.push(...current.children)
    }
  }
  return { bookmarkCount, subfolderCount }
}

export function getPopupFolderSortOption(mode: PopupFolderSortMode): PopupFolderSortOption {
  return POPUP_FOLDER_SORT_OPTIONS.find((option) => option.mode === mode) || POPUP_FOLDER_SORT_OPTIONS[0]
}

export function computeSortedDirectBookmarkIds(
  directBookmarks: readonly PopupSortableBookmarkLike[],
  mode: PopupFolderSortMode,
  activityRecords: Record<string, NewTabActivityRepositoryRecord> = {}
): { matchedActivityCount: number; orderedIds: string[] } {
  let matchedActivityCount = 0
  const indexed = directBookmarks.map((bookmark, originalIndex) => {
    const bookmarkId = String(bookmark.id || '')
    const activity = activityRecords[bookmarkId]
    const openCount = Number(activity?.openCount) || 0
    const lastOpenedAt = Number(activity?.lastOpenedAt) || 0
    if (openCount > 0) {
      matchedActivityCount += 1
    }
    return {
      bookmarkId,
      dateAdded: Number(bookmark.dateAdded) || 0,
      lastOpenedAt,
      openCount,
      originalIndex,
      title: String(bookmark.title || '').trim(),
      url: String(bookmark.url || '').trim()
    }
  })

  const compareTitleAsc = (left: (typeof indexed)[number], right: (typeof indexed)[number]): number =>
    TITLE_COLLATOR.compare(left.title, right.title) ||
    TITLE_COLLATOR.compare(left.url, right.url) ||
    left.originalIndex - right.originalIndex

  indexed.sort((left, right) => {
    if (mode === 'title-asc') {
      return compareTitleAsc(left, right)
    }
    if (mode === 'title-desc') {
      return -TITLE_COLLATOR.compare(left.title, right.title) ||
        -TITLE_COLLATOR.compare(left.url, right.url) ||
        left.originalIndex - right.originalIndex
    }
    if (mode === 'date-desc') {
      return (right.dateAdded - left.dateAdded) || compareTitleAsc(left, right)
    }
    if (mode === 'date-asc') {
      return (left.dateAdded - right.dateAdded) || compareTitleAsc(left, right)
    }
    return (right.openCount - left.openCount) ||
      (right.lastOpenedAt - left.lastOpenedAt) ||
      (right.dateAdded - left.dateAdded) ||
      compareTitleAsc(left, right)
  })

  return {
    matchedActivityCount,
    orderedIds: indexed.map((entry) => entry.bookmarkId)
  }
}

export function planDirectBookmarkSortMoves(
  folderChildren: readonly chrome.bookmarks.BookmarkTreeNode[] | undefined,
  desiredBookmarkIds: readonly string[]
): PopupDirectBookmarkSortMove[] {
  const children = Array.isArray(folderChildren) ? folderChildren : []
  const bookmarkSlots: number[] = []
  const existingBookmarkIds = new Set<string>()
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (child?.url) {
      bookmarkSlots.push(index)
      existingBookmarkIds.add(String(child.id || ''))
    }
  }

  const targetIds: string[] = []
  const seenTargetIds = new Set<string>()
  for (const rawId of desiredBookmarkIds) {
    const bookmarkId = String(rawId || '')
    if (bookmarkId && existingBookmarkIds.has(bookmarkId) && !seenTargetIds.has(bookmarkId)) {
      targetIds.push(bookmarkId)
      seenTargetIds.add(bookmarkId)
    }
  }
  for (const child of children) {
    if (!child?.url) continue
    const bookmarkId = String(child.id || '')
    if (bookmarkId && !seenTargetIds.has(bookmarkId)) {
      targetIds.push(bookmarkId)
      seenTargetIds.add(bookmarkId)
    }
  }

  if (bookmarkSlots.length < 2 || targetIds.length !== bookmarkSlots.length) {
    return []
  }

  const desiredChildIds: string[] = []
  let bookmarkCursor = 0
  for (const child of children) {
    if (child?.url) {
      desiredChildIds.push(targetIds[bookmarkCursor])
      bookmarkCursor += 1
    } else {
      desiredChildIds.push(String(child?.id || ''))
    }
  }

  const workingChildIds = children.map((child) => String(child.id || ''))
  const moves: PopupDirectBookmarkSortMove[] = []

  for (let targetIndex = 0; targetIndex < desiredChildIds.length; targetIndex += 1) {
    const desiredId = desiredChildIds[targetIndex]
    const currentIndex = workingChildIds.indexOf(desiredId)
    if (currentIndex < 0 || currentIndex === targetIndex) {
      continue
    }
    if (existingBookmarkIds.has(desiredId)) {
      // Indices [0..targetIndex-1] are already finalized, so desired bookmarks
      // always move strictly leftward (currentIndex > targetIndex).
      moves.push({ bookmarkId: desiredId, index: targetIndex })
      workingChildIds.splice(currentIndex, 1)
      workingChildIds.splice(targetIndex, 0, desiredId)
      continue
    }
    // Never move folder nodes: relocate any bookmarks blocking this folder's
    // slot to the end of the parent (Chrome destination index = children.length).
    const blockingCount = currentIndex - targetIndex
    for (let step = 0; step < blockingCount; step += 1) {
      const blockingBookmarkId = workingChildIds[targetIndex]
      moves.push({ bookmarkId: blockingBookmarkId, index: workingChildIds.length })
      workingChildIds.splice(targetIndex, 1)
      workingChildIds.push(blockingBookmarkId)
    }
  }

  return moves
}

export function computeMultiSelectToggle(
  currentSelectedIds: ReadonlySet<string>,
  orderedVisibleIds: readonly string[],
  targetId: string,
  anchorId: string,
  shiftKey: boolean
): { anchorId: string; selectedIds: Set<string> } {
  const normalizedTargetId = String(targetId || '').trim()
  const nextSelected = new Set(currentSelectedIds)
  if (!normalizedTargetId) {
    return { anchorId, selectedIds: nextSelected }
  }

  if (shiftKey && anchorId) {
    const anchorIndex = orderedVisibleIds.indexOf(anchorId)
    const targetIndex = orderedVisibleIds.indexOf(normalizedTargetId)
    if (anchorIndex >= 0 && targetIndex >= 0) {
      const start = Math.min(anchorIndex, targetIndex)
      const end = Math.max(anchorIndex, targetIndex)
      for (let index = start; index <= end; index += 1) {
        nextSelected.add(orderedVisibleIds[index])
      }
      return { anchorId: normalizedTargetId, selectedIds: nextSelected }
    }
  }

  if (nextSelected.has(normalizedTargetId)) {
    nextSelected.delete(normalizedTargetId)
  } else {
    nextSelected.add(normalizedTargetId)
  }
  return { anchorId: normalizedTargetId, selectedIds: nextSelected }
}

export function computeMultiSelectSwipeRange(
  baseSelectedIds: ReadonlySet<string>,
  orderedVisibleIds: readonly string[],
  startIndex: number,
  endIndex: number,
  targetSelected: boolean
): { anchorId: string; selectedIds: Set<string> } {
  const nextSelected = new Set(baseSelectedIds)
  if (!orderedVisibleIds.length) {
    return { anchorId: '', selectedIds: nextSelected }
  }
  const maxIndex = orderedVisibleIds.length - 1
  const clampedStart = Math.max(0, Math.min(Math.trunc(startIndex), maxIndex))
  const clampedEnd = Math.max(0, Math.min(Math.trunc(endIndex), maxIndex))
  const rangeStart = Math.min(clampedStart, clampedEnd)
  const rangeEnd = Math.max(clampedStart, clampedEnd)
  for (let index = rangeStart; index <= rangeEnd; index += 1) {
    const bookmarkId = orderedVisibleIds[index]
    if (!bookmarkId) continue
    if (targetSelected) {
      nextSelected.add(bookmarkId)
    } else {
      nextSelected.delete(bookmarkId)
    }
  }
  return {
    anchorId: orderedVisibleIds[clampedEnd] || '',
    selectedIds: nextSelected
  }
}

export function pruneSelectionToVisibleIds(
  selectedIds: Set<string>,
  visibleIds: readonly string[]
): Set<string> {
  if (!selectedIds.size) {
    return selectedIds
  }
  const visibleSet = new Set(visibleIds)
  let changed = false
  for (const bookmarkId of selectedIds) {
    if (!visibleSet.has(bookmarkId)) {
      changed = true
      break
    }
  }
  if (!changed) {
    return selectedIds
  }
  const next = new Set<string>()
  for (const bookmarkId of selectedIds) {
    if (visibleSet.has(bookmarkId)) {
      next.add(bookmarkId)
    }
  }
  return next
}
