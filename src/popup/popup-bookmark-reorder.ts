export interface PopupBookmarkReorderTargetInput {
  containerTop: number
  paddingTop: number
  pointerY: number
  rowCount: number
  rowHeight: number
  scrollTop: number
  sourceIndex: number
}

export function reorderPopupBookmarkIds(
  currentIds: string[],
  bookmarkId: string,
  targetIndex: number
): string[] {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  const sourceIndex = currentIds.indexOf(normalizedBookmarkId)
  if (!normalizedBookmarkId || sourceIndex < 0 || currentIds.length < 2) {
    return [...currentIds]
  }

  const nextIds = [...currentIds]
  const [movedId] = nextIds.splice(sourceIndex, 1)
  const normalizedTargetIndex = Math.max(0, Math.min(Math.trunc(targetIndex), nextIds.length))
  nextIds.splice(normalizedTargetIndex, 0, movedId)
  return nextIds
}

export function getPopupBookmarkMoveDestinationIndex(
  children: chrome.bookmarks.BookmarkTreeNode[] | undefined,
  bookmarkId: string,
  targetBookmarkIndex: number
): number | null {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  const siblings = Array.isArray(children) ? children : []
  const sourceChildIndex = siblings.findIndex((child) => String(child.id) === normalizedBookmarkId && Boolean(child.url))
  const bookmarkSiblings = siblings.filter((child) => Boolean(child.url))
  const sourceBookmarkIndex = bookmarkSiblings.findIndex((child) => String(child.id) === normalizedBookmarkId)
  if (!normalizedBookmarkId || sourceChildIndex < 0 || sourceBookmarkIndex < 0 || bookmarkSiblings.length < 2) {
    return null
  }

  const normalizedTargetIndex = Math.max(
    0,
    Math.min(Math.trunc(targetBookmarkIndex), bookmarkSiblings.length - 1)
  )
  if (normalizedTargetIndex === sourceBookmarkIndex) {
    return null
  }

  const remainingChildren = siblings.filter((child) => String(child.id) !== normalizedBookmarkId)
  const remainingBookmarks = remainingChildren.filter((child) => Boolean(child.url))
  let insertionIndex = 0

  if (normalizedTargetIndex >= remainingBookmarks.length) {
    const lastBookmarkId = String(remainingBookmarks.at(-1)?.id || '')
    const lastBookmarkIndex = remainingChildren.findIndex((child) => String(child.id) === lastBookmarkId)
    insertionIndex = lastBookmarkIndex >= 0 ? lastBookmarkIndex + 1 : remainingChildren.length
  } else {
    const targetBookmarkId = String(remainingBookmarks[normalizedTargetIndex]?.id || '')
    const targetChildIndex = remainingChildren.findIndex((child) => String(child.id) === targetBookmarkId)
    insertionIndex = targetChildIndex >= 0 ? targetChildIndex : remainingChildren.length
  }

  // chrome.bookmarks.move() interprets a same-parent downward index against the
  // list before the source node is removed. Account for that extra slot.
  return sourceChildIndex < insertionIndex ? insertionIndex + 1 : insertionIndex
}

export function getPopupBookmarkReorderTargetIndex({
  containerTop,
  paddingTop,
  pointerY,
  rowCount,
  rowHeight,
  scrollTop,
  sourceIndex
}: PopupBookmarkReorderTargetInput): number {
  if (rowCount <= 0 || rowHeight <= 0 || sourceIndex < 0 || sourceIndex >= rowCount) {
    return sourceIndex
  }

  const contentY = Math.max(0, scrollTop + pointerY - containerTop - paddingTop)
  const insertIndex = Math.max(0, Math.min(Math.round(contentY / rowHeight), rowCount))
  const adjustedIndex = insertIndex > sourceIndex ? insertIndex - 1 : insertIndex
  return Math.max(0, Math.min(adjustedIndex, rowCount - 1))
}
