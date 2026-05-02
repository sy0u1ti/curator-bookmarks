export const BACKGROUND_URL_FETCH_TIMEOUT_MS = 12000
export const BACKGROUND_URL_MAX_BYTES = 8 * 1024 * 1024

export interface BookmarkMoveOperation {
  id: string
  parentId: string
  index: number
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
    operations.push({
      id: movedId,
      parentId: normalizedParentId,
      index
    })
  }

  return operations
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
