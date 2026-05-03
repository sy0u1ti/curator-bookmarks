export const BACKGROUND_URL_FETCH_TIMEOUT_MS = 12000
export const BACKGROUND_URL_MAX_BYTES = 8 * 1024 * 1024

export interface BookmarkMoveOperation {
  id: string
  parentId: string
  index: number
}

export interface BookmarkTileRectLike {
  left: number
  top: number
  width: number
  height: number
}

export interface BookmarkDragSlotRectLike extends BookmarkTileRectLike {
  id: string
}

export interface BackgroundFetchSizeCheck {
  allowed: boolean
  message?: string
}

export function resolveRestorableBookmarkParentId(
  requestedParentId: string | null | undefined,
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined,
  defaultParentId: string
): string {
  const normalizedDefaultParentId = String(defaultParentId || '').trim()
  const normalizedRequestedParentId = String(requestedParentId || '').trim()

  if (!normalizedRequestedParentId) {
    return normalizedDefaultParentId
  }

  const target = findBookmarkNodeById(rootNode, normalizedRequestedParentId)
  return target && !target.url ? normalizedRequestedParentId : normalizedDefaultParentId
}

export function buildMinimalBookmarkMoveOperations(
  originalIds: string[],
  finalIds: string[],
  parentId: string
): BookmarkMoveOperation[] {
  const normalizedParentId = String(parentId || '').trim()
  if (!normalizedParentId || originalIds.length !== finalIds.length) {
    return []
  }

  const original = normalizeUniqueIds(originalIds)
  const final = normalizeUniqueIds(finalIds)
  if (
    original.length !== originalIds.length ||
    final.length !== finalIds.length ||
    original.length !== final.length ||
    !haveSameMembers(original, final)
  ) {
    return []
  }

  const finalIndexById = new Map(final.map((id, index) => [id, index]))
  const originalFinalIndexes = original.map((id) => Number(finalIndexById.get(id)))
  const stableIndexes = getLongestIncreasingSubsequenceIndexes(originalFinalIndexes)
  const stableIds = new Set(stableIndexes.map((index) => original[index]))

  const current = [...original]
  const operations: BookmarkMoveOperation[] = []
  for (let index = 0; index < final.length; index += 1) {
    if (current[index] === final[index]) {
      continue
    }
    if (stableIds.has(final[index])) {
      continue
    }

    const currentIndex = current.indexOf(final[index])
    if (currentIndex < 0) {
      return []
    }

    const [movedId] = current.splice(currentIndex, 1)
    current.splice(index, 0, movedId)
    const chromeMoveIndex = currentIndex < index ? index + 1 : index
    operations.push({
      id: movedId,
      parentId: normalizedParentId,
      index: chromeMoveIndex
    })
  }

  return operations
}

export function buildBookmarkOrderAfterInsert(
  currentIds: string[],
  draggedId: string,
  insertIndex: number
): string[] {
  const normalizedDraggedId = String(draggedId || '').trim()
  const currentIndex = currentIds.findIndex((id) => id === normalizedDraggedId)
  if (!normalizedDraggedId || currentIndex < 0) {
    return [...currentIds]
  }

  const nextIds = [...currentIds]
  const [draggedBookmarkId] = nextIds.splice(currentIndex, 1)
  const normalizedIndex = Math.max(0, Math.min(insertIndex, nextIds.length))

  nextIds.splice(normalizedIndex, 0, draggedBookmarkId)
  return nextIds
}

export function shouldInsertAfterBookmarkTile(
  pointer: { x: number; y: number },
  targetRect: BookmarkTileRectLike
): boolean {
  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2
  const verticalThreshold = Math.max(
    6,
    targetRect.height * 0.24
  )

  if (pointer.y < targetCenterY - verticalThreshold) {
    return false
  }
  if (pointer.y > targetCenterY + verticalThreshold) {
    return true
  }

  return pointer.x > targetCenterX
}

export function resolveBookmarkDragInsertIndex(
  slotRects: BookmarkDragSlotRectLike[],
  draggedId: string,
  targetPoint: { x: number; y: number }
): number {
  const normalizedDraggedId = String(draggedId || '').trim()
  if (!normalizedDraggedId || !slotRects.length) {
    return -1
  }

  const slotRows = groupBookmarkDragSlotRows(slotRects)
  const targetRow = findBookmarkDragTargetRow(slotRows, targetPoint.y)
  if (!targetRow.length) {
    return -1
  }

  const targetSlotIndex = resolveBookmarkDragTargetSlotIndex(targetRow, targetPoint.x)
  const slotIndex = slotRects.findIndex((slot) => slot.id === targetRow[targetSlotIndex].id)
  if (slotIndex < 0) {
    return -1
  }

  return slotIndexToBookmarkInsertIndex(slotRects, normalizedDraggedId, slotIndex)
}

function groupBookmarkDragSlotRows(
  slotRects: BookmarkDragSlotRectLike[]
): BookmarkDragSlotRectLike[][] {
  const rows: BookmarkDragSlotRectLike[][] = []
  for (const slot of slotRects) {
    const centerY = slot.top + slot.height / 2
    const row = rows.find((items) => {
      const first = items[0]
      const firstCenterY = first.top + first.height / 2
      return Math.abs(centerY - firstCenterY) <= Math.max(8, Math.min(first.height, slot.height) * 0.5)
    })
    if (row) {
      row.push(slot)
    } else {
      rows.push([slot])
    }
  }

  for (const row of rows) {
    row.sort((left, right) => left.left - right.left)
  }
  rows.sort((left, right) => left[0].top - right[0].top)
  return rows
}

function findBookmarkDragTargetRow(
  rows: BookmarkDragSlotRectLike[][],
  targetY: number
): BookmarkDragSlotRectLike[] {
  let closestRow: BookmarkDragSlotRectLike[] | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const row of rows) {
    const top = Math.min(...row.map((slot) => slot.top))
    const bottom = Math.max(...row.map((slot) => slot.top + slot.height))
    const centerY = (top + bottom) / 2
    const distance = targetY < top
      ? top - targetY
      : targetY > bottom
        ? targetY - bottom
        : Math.abs(targetY - centerY) * 0.2
    if (distance < closestDistance) {
      closestDistance = distance
      closestRow = row
    }
  }

  return closestRow || []
}

function resolveBookmarkDragTargetSlotIndex(
  row: BookmarkDragSlotRectLike[],
  targetX: number
): number {
  if (row.length <= 1) {
    return 0
  }

  for (let index = 0; index < row.length - 1; index += 1) {
    const leftSlot = row[index]
    const rightSlot = row[index + 1]
    const boundaryX = (
      leftSlot.left + leftSlot.width / 2 +
      rightSlot.left + rightSlot.width / 2
    ) / 2
    if (targetX < boundaryX) {
      return index
    }
  }

  return row.length - 1
}

function slotIndexToBookmarkInsertIndex(
  slotRects: BookmarkDragSlotRectLike[],
  draggedId: string,
  slotIndex: number
): number {
  const draggedSlotIndex = slotRects.findIndex((slot) => slot.id === draggedId)
  if (draggedSlotIndex < 0) {
    return -1
  }

  return Math.max(0, Math.min(slotIndex, slotRects.length - 1))
}

function getLongestIncreasingSubsequenceIndexes(values: number[]): number[] {
  const tails: number[] = []
  const previous = new Array<number>(values.length).fill(-1)

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    let low = 0
    let high = tails.length

    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (values[tails[mid]] < value) {
        low = mid + 1
      } else {
        high = mid
      }
    }

    if (low > 0) {
      previous[index] = tails[low - 1]
    }
    tails[low] = index
  }

  const result: number[] = []
  for (let index = tails[tails.length - 1] ?? -1; index >= 0; index = previous[index]) {
    result.push(index)
  }

  return result.reverse()
}

export function validateBackgroundContentLength(
  value: string | null,
  maxBytes = BACKGROUND_URL_MAX_BYTES
): BackgroundFetchSizeCheck {
  if (!value) {
    return { allowed: true }
  }

  const size = Number(value)
  if (!Number.isFinite(size) || size < 0) {
    return { allowed: true }
  }

  if (size > maxBytes) {
    return {
      allowed: false,
      message: `远程图片太大：服务器声明 ${formatBytes(size)}，当前上限 ${formatBytes(maxBytes)}。`
    }
  }

  return { allowed: true }
}

export function validateBackgroundBlobSize(
  size: number,
  maxBytes = BACKGROUND_URL_MAX_BYTES
): BackgroundFetchSizeCheck {
  if (!Number.isFinite(size) || size <= maxBytes) {
    return { allowed: true }
  }

  return {
    allowed: false,
    message: `远程图片太大：下载后 ${formatBytes(size)}，当前上限 ${formatBytes(maxBytes)}。`
  }
}

function findBookmarkNodeById(
  node: chrome.bookmarks.BookmarkTreeNode | null | undefined,
  targetId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  if (!node) {
    return null
  }

  if (node.id === targetId) {
    return node
  }

  for (const child of node.children || []) {
    const match = findBookmarkNodeById(child, targetId)
    if (match) {
      return match
    }
  }

  return null
}

function normalizeUniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const id of ids) {
    const value = String(id || '').trim()
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    normalized.push(value)
  }
  return normalized
}

function haveSameMembers(left: string[], right: string[]): boolean {
  const rightSet = new Set(right)
  return left.length === rightSet.size && left.every((id) => rightSet.has(id))
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}
