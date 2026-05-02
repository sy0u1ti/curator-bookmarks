import { RECYCLE_BIN_LIMIT, STORAGE_KEYS } from './constants.js'
import { removeBookmark } from './bookmarks-api.js'
import { getLocalStorage, setLocalStorage } from './storage.js'

export interface RecycleEntry {
  recycleId: string
  deletedAt: number
  bookmarkId?: string
  title?: string
  url?: string
  parentId?: string
  index?: number
  path?: string
  [key: string]: unknown
}

let recycleBinWriteQueue: Promise<unknown> = Promise.resolve()

export async function appendRecycleEntry(entry: RecycleEntry): Promise<void> {
  return appendRecycleEntries([entry])
}

export async function appendRecycleEntries(entries: RecycleEntry[]): Promise<void> {
  return updateRecycleBinEntries(
    (currentEntries) => mergeRecycleEntries(entries, currentEntries),
    (latestEntries) => mergeRecycleEntries(entries, latestEntries)
  )
}

export async function removeRecycleEntry(recycleId: string): Promise<void> {
  return removeRecycleEntries([recycleId])
}

export async function removeRecycleEntries(recycleIds: string[]): Promise<void> {
  const targetSet = new Set(recycleIds.map((id) => String(id || '').trim()).filter(Boolean))
  return updateRecycleBinEntries(
    (currentEntries) => removeRecycleEntriesById(currentEntries, targetSet),
    (latestEntries) => removeRecycleEntriesById(latestEntries, targetSet)
  )
}

export async function loadRecycleBinEntries(): Promise<RecycleEntry[]> {
  const stored = await getLocalStorage<Record<string, unknown>>([STORAGE_KEYS.recycleBin])
  return normalizeRecycleEntries(stored[STORAGE_KEYS.recycleBin])
}

export async function deleteBookmarkToRecycle(
  bookmarkId: string,
  entry: RecycleEntry
): Promise<void> {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  const recycleId = String(entry?.recycleId || '').trim()
  if (!normalizedBookmarkId || !recycleId) {
    throw new Error('缺少可删除的书签或回收站记录。')
  }

  let recycleEntryAppended = false
  try {
    await appendRecycleEntry({ ...entry, recycleId })
    recycleEntryAppended = true
    await removeBookmark(normalizedBookmarkId)
  } catch (error) {
    if (recycleEntryAppended) {
      await removeRecycleEntry(recycleId).catch((cleanupError) => {
        console.warn('回收站删除事务回滚失败。', cleanupError)
      })
    }
    throw error
  }
}

export function mergeRecycleEntries(
  incomingEntries: RecycleEntry[],
  existingEntries: RecycleEntry[] = []
): RecycleEntry[] {
  const merged = new Map<string, RecycleEntry>()

  for (const entry of [...existingEntries, ...incomingEntries]) {
    const recycleId = String(entry?.recycleId || '').trim()
    if (!recycleId) {
      continue
    }
    merged.set(recycleId, {
      ...entry,
      recycleId
    })
  }

  return [...merged.values()]
    .sort((left, right) => (Number(right.deletedAt) || 0) - (Number(left.deletedAt) || 0))
    .slice(0, RECYCLE_BIN_LIMIT)
}

function normalizeRecycleEntries(rawEntries: unknown): RecycleEntry[] {
  return Array.isArray(rawEntries)
    ? mergeRecycleEntries(rawEntries as RecycleEntry[])
    : []
}

function updateRecycleBinEntries(
  updater: (entries: RecycleEntry[]) => RecycleEntry[],
  reconcileAfterWrite: (entries: RecycleEntry[]) => RecycleEntry[] = (latestEntries) => latestEntries
): Promise<void> {
  const task = recycleBinWriteQueue.then(async () => {
    const currentEntries = await loadRecycleBinEntries()
    const nextEntries = mergeRecycleEntries(updater(currentEntries))

    await setLocalStorage({
      [STORAGE_KEYS.recycleBin]: nextEntries
    })

    const latestEntries = await loadRecycleBinEntries()
    const reconciledEntries = mergeRecycleEntries(reconcileAfterWrite(latestEntries))
    if (!haveSameRecycleEntries(latestEntries, reconciledEntries)) {
      await setLocalStorage({
        [STORAGE_KEYS.recycleBin]: reconciledEntries
      })
    }
  })

  recycleBinWriteQueue = task.catch(() => {})
  return task
}

function removeRecycleEntriesById(
  entries: RecycleEntry[],
  targetSet: Set<string>
): RecycleEntry[] {
  return entries.filter((entry) => {
    return !targetSet.has(String(entry?.recycleId || ''))
  })
}

function haveSameRecycleEntries(leftEntries: RecycleEntry[], rightEntries: RecycleEntry[]): boolean {
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries)
}
