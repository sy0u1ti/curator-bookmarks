import { STORAGE_KEYS } from './constants.js'
import {
  createBookmark,
  getBookmarkById,
  getBookmarkTree,
  removeBookmark,
  removeBookmarkTree
} from './bookmarks-api.js'
import { findBookmarksBar, findNodeById } from './bookmark-tree.js'
import { loadBookmarkTagIndex, normalizeBookmarkTagRecord, restoreBookmarkTagIndexSnapshot, saveBookmarkTagIndex, type BookmarkTagIndex, type BookmarkTagRecord } from './bookmark-tags.js'
import { normalizeCustomIconEntries, prepareCustomIconReferences, setBookmarkCustomIcon } from './repositories/custom-icon-repository.js'
import {
  getLocalStorage,
  setLocalStorage,
  withLocalStorageTransaction,
  type LocalStorageTransaction
} from './storage.js'

export interface RecycleEntry {
  recycleId: string
  deletedAt: number
  bookmarkId?: string
  title?: string
  url?: string
  parentId?: string
  index?: number
  path?: string
  tagRecord?: BookmarkTagRecord | null
  customIcon?: string
  /* Set while a restore is in flight so concurrent restores cannot both
     create a copy; stale claims expire after RECYCLE_RESTORE_CLAIM_MS. */
  restoringAt?: number
  [key: string]: unknown
}

export interface DeletedFolderBlueprintBookmark {
  kind: 'bookmark'
  recycleId: string
  title: string
  url: string
}

export interface DeletedFolderBlueprintFolder {
  kind: 'folder'
  title: string
  children: DeletedFolderBlueprintChild[]
}

export type DeletedFolderBlueprintChild =
  | DeletedFolderBlueprintBookmark
  | DeletedFolderBlueprintFolder

export interface DeletedFolderBlueprint {
  folderId: string
  parentId: string
  index: number
  title: string
  path: string
  children: DeletedFolderBlueprintChild[]
  recycleIds: string[]
}

export interface BatchRecycleBookmarkInput {
  bookmarkId: string
  title: string
  url: string
  parentId: string
  index: number
  path: string
}

const RECYCLE_RESTORE_CLAIM_MS = 2 * 60 * 1000

export const RECYCLE_DELETE_ROLLBACK_FAILED_CODE = 'recycle-delete-rollback-failed'
export const RECYCLE_RESTORE_ROLLBACK_FAILED_CODE = 'recycle-restore-rollback-failed'
export const RECYCLE_RESTORE_SOURCE_EXISTS_CODE = 'recycle-restore-source-exists'

class RecycleLifecycleError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'RecycleLifecycleError'
  }
}

export async function appendRecycleEntry(entry: RecycleEntry): Promise<void> {
  return appendRecycleEntries([entry])
}

export async function appendRecycleEntries(entries: RecycleEntry[]): Promise<void> {
  return withLocalStorageTransaction((transaction) =>
    appendRecycleEntriesWithoutLock(entries, transaction)
  )
}

export async function removeRecycleEntry(recycleId: string): Promise<void> {
  return removeRecycleEntries([recycleId])
}

export async function removeRecycleEntries(recycleIds: string[]): Promise<void> {
  return withLocalStorageTransaction((transaction) =>
    removeRecycleEntriesWithoutLock(recycleIds, transaction)
  )
}

export async function loadRecycleBinEntries(): Promise<RecycleEntry[]> {
  const stored = await getLocalStorage<Record<string, unknown>>([STORAGE_KEYS.recycleBin])
  return normalizeRecycleEntries(stored[STORAGE_KEYS.recycleBin])
}

export async function deleteBookmarkToRecycle(
  bookmarkId: string,
  entry: RecycleEntry,
  {
    expectedUrl = ''
  }: {
    expectedUrl?: string
  } = {}
): Promise<boolean> {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  const recycleId = String(entry?.recycleId || '').trim()
  if (!normalizedBookmarkId || !recycleId) {
    throw new Error('缺少可删除的书签或回收站记录。')
  }

  return withLocalStorageTransaction(async (transaction) => {
    const [previousEntries, tags, stored] = await Promise.all([
      loadRecycleBinEntries(),
      loadBookmarkTagIndex({ transaction }),
      getLocalStorage(STORAGE_KEYS.newTabCustomIcons)
    ])
    const icon = normalizeCustomIconEntries(stored[STORAGE_KEYS.newTabCustomIcons])[normalizedBookmarkId]
    const icons = icon ? await prepareCustomIconReferences({ [normalizedBookmarkId]: icon }) : {}
    let recycleEntryAppended = false
    try {
      await appendRecycleEntriesWithoutLock([{
        ...entry, recycleId,
        ...(tags.records[normalizedBookmarkId] ? { tagRecord: tags.records[normalizedBookmarkId] } : {}),
        ...(icons[normalizedBookmarkId] ? { customIcon: icons[normalizedBookmarkId] } : {})
      }], transaction)
      recycleEntryAppended = true
      const normalizedExpectedUrl = String(expectedUrl || '').trim()
      if (normalizedExpectedUrl) {
        const latestBookmark = await getBookmarkById(normalizedBookmarkId)
        if (String(latestBookmark?.url || '') !== normalizedExpectedUrl) {
          await replaceRecycleEntriesWithoutLock(previousEntries, transaction)
          recycleEntryAppended = false
          return false
        }
      }
      await removeBookmark(normalizedBookmarkId)
      return true
    } catch (error) {
      if (recycleEntryAppended) {
        try {
          await replaceRecycleEntriesWithoutLock(previousEntries, transaction)
        } catch (cleanupError) {
          throw new RecycleLifecycleError(
            `${formatRecycleBinError(error)} 回收站记录自动回滚失败：` +
            `${formatRecycleBinError(cleanupError)}`,
            RECYCLE_DELETE_ROLLBACK_FAILED_CODE
          )
        }
      }
      throw error
    }
  })
}

export async function deleteBookmarksBatchToRecycle(
  items: readonly BatchRecycleBookmarkInput[],
  source = '弹窗批量删除'
): Promise<{ deletedIds: string[]; failedCount: number; recycleIds: string[] }> {
  const normalizedItems = items.filter((item) => String(item?.bookmarkId || '').trim() && String(item?.url || '').trim())
  if (!normalizedItems.length) {
    return { deletedIds: [], failedCount: 0, recycleIds: [] }
  }

  const deletedAt = Date.now()
  const prepared = normalizedItems.map((item, position) => {
    const bookmarkId = String(item.bookmarkId).trim()
    const recycleId = `recycle-${bookmarkId}-${deletedAt}-${position}-${Math.random().toString(16).slice(2, 8)}`
    return {
      bookmarkId,
      expectedUrl: String(item.url || '').trim(),
      entry: {
        recycleId,
        bookmarkId,
        title: item.title || '未命名书签',
        url: item.url,
        parentId: String(item.parentId || ''),
        index: Number.isFinite(Number(item.index)) ? Math.trunc(Number(item.index)) : 0,
        path: item.path || '',
        source,
        deletedAt
      } satisfies RecycleEntry
    }
  })

  return withLocalStorageTransaction(async (transaction) => {
    const [previousEntries, tags, stored] = await Promise.all([
      loadRecycleBinEntries(),
      loadBookmarkTagIndex({ transaction }),
      getLocalStorage(STORAGE_KEYS.newTabCustomIcons)
    ])
    const customIcons = normalizeCustomIconEntries(stored[STORAGE_KEYS.newTabCustomIcons])
    const iconMap: Record<string, string> = {}
    for (const item of prepared) {
      const icon = customIcons[item.bookmarkId]
      if (icon) iconMap[item.bookmarkId] = icon
    }
    const preparedIcons = Object.keys(iconMap).length ? await prepareCustomIconReferences(iconMap) : {}
    const enrichedEntries = prepared.map((item) => ({
      ...item.entry,
      ...(tags.records[item.bookmarkId] ? { tagRecord: tags.records[item.bookmarkId] } : {}),
      ...(preparedIcons[item.bookmarkId] ? { customIcon: preparedIcons[item.bookmarkId] } : {})
    }))

    let entriesAppended = false
    try {
      await appendRecycleEntriesWithoutLock(enrichedEntries, transaction)
      entriesAppended = true

      const deletedIds: string[] = []
      const succeededRecycleIds: string[] = []
      const failedRecycleIds: string[] = []

      for (const item of prepared) {
        try {
          const latestBookmark = await getBookmarkById(item.bookmarkId)
          if (!latestBookmark || String(latestBookmark.url || '').trim() !== item.expectedUrl) {
            failedRecycleIds.push(item.entry.recycleId)
            continue
          }
          await removeBookmark(item.bookmarkId)
          deletedIds.push(item.bookmarkId)
          succeededRecycleIds.push(item.entry.recycleId)
        } catch {
          failedRecycleIds.push(item.entry.recycleId)
        }
      }

      if (!deletedIds.length) {
        await replaceRecycleEntriesWithoutLock(previousEntries, transaction)
        entriesAppended = false
        throw new Error('选中的书签均已变化或无法删除，已取消本次批量删除。')
      }

      if (failedRecycleIds.length) {
        await removeRecycleEntriesWithoutLock(failedRecycleIds, transaction)
      }

      return {
        deletedIds,
        failedCount: failedRecycleIds.length,
        recycleIds: succeededRecycleIds
      }
    } catch (error) {
      if (entriesAppended) {
        try {
          await replaceRecycleEntriesWithoutLock(previousEntries, transaction)
        } catch (cleanupError) {
          throw new RecycleLifecycleError(
            `${formatRecycleBinError(error)} 回收站记录自动回滚失败：` +
            `${formatRecycleBinError(cleanupError)}`,
            RECYCLE_DELETE_ROLLBACK_FAILED_CODE
          )
        }
      }
      throw error
    }
  })
}

export async function restoreBookmarksBatchFromRecycle(
  recycleIds: readonly string[]
): Promise<{ failedCount: number; remainingRecycleIds: string[]; restoredCount: number }> {
  const normalizedIds = [...new Set(recycleIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (!normalizedIds.length) {
    return { failedCount: 0, remainingRecycleIds: [], restoredCount: 0 }
  }

  const entries = await loadRecycleBinEntries()
  const entryById = new Map(entries.map((entry) => [String(entry.recycleId), entry]))
  const orderedIds = [...normalizedIds].sort((leftId, rightId) => {
    const left = entryById.get(leftId)
    const right = entryById.get(rightId)
    const parentCmp = String(left?.parentId || '').localeCompare(String(right?.parentId || ''))
    if (parentCmp !== 0) return parentCmp
    return (Number(left?.index) || 0) - (Number(right?.index) || 0)
  })

  let restoredCount = 0
  const remainingRecycleIds: string[] = []
  for (const recycleId of orderedIds) {
    try {
      await restoreBookmarkFromRecycleEntry(recycleId)
      restoredCount += 1
    } catch {
      remainingRecycleIds.push(recycleId)
    }
  }

  return {
    failedCount: remainingRecycleIds.length,
    remainingRecycleIds,
    restoredCount
  }
}

export async function deleteFolderTreeToRecycle(
  folderNode: chrome.bookmarks.BookmarkTreeNode,
  {
    path = '',
    source = '弹窗删除文件夹'
  }: {
    path?: string
    source?: string
  } = {}
): Promise<{
  blueprint: DeletedFolderBlueprint
  bookmarkCount: number
  recycleIds: string[]
  subfolderCount: number
}> {
  const folderId = String(folderNode?.id || '').trim()
  const parentId = String(folderNode?.parentId || '').trim()
  if (!folderId || folderNode.url || !parentId || parentId === '0') {
    throw new Error('系统根文件夹不可删除。')
  }

  const deletedAt = Date.now()
  const folderTitle = String(folderNode.title || '未命名文件夹')
  const rootPath = String(path || folderTitle)
  const collectedEntries: Array<{ bookmarkId: string; entry: RecycleEntry }> = []
  const recycleIds: string[] = []
  let bookmarkCount = 0
  let subfolderCount = 0
  let sequence = 0

  function captureChildren(
    children: readonly chrome.bookmarks.BookmarkTreeNode[] | undefined,
    currentPath: string
  ): DeletedFolderBlueprintChild[] {
    const result: DeletedFolderBlueprintChild[] = []
    for (const child of children || []) {
      if (child.url) {
        const bookmarkId = String(child.id || '').trim()
        const recycleId = `recycle-folder-${bookmarkId || sequence}-${deletedAt}-${sequence}-${Math.random().toString(16).slice(2, 8)}`
        sequence += 1
        bookmarkCount += 1
        recycleIds.push(recycleId)
        collectedEntries.push({
          bookmarkId,
          entry: {
            recycleId,
            bookmarkId,
            title: child.title || '未命名书签',
            url: child.url,
            parentId: String(child.parentId || ''),
            index: Number.isFinite(Number(child.index)) ? Math.trunc(Number(child.index)) : 0,
            path: currentPath,
            source,
            deletedAt
          }
        })
        result.push({
          kind: 'bookmark',
          recycleId,
          title: child.title || '未命名书签',
          url: child.url
        })
      } else {
        subfolderCount += 1
        const childTitle = child.title || '未命名文件夹'
        const childPath = currentPath ? `${currentPath} / ${childTitle}` : childTitle
        result.push({
          kind: 'folder',
          title: childTitle,
          children: captureChildren(child.children, childPath)
        })
      }
    }
    return result
  }

  const blueprint: DeletedFolderBlueprint = {
    folderId,
    parentId,
    index: Number.isFinite(Number(folderNode.index)) ? Math.trunc(Number(folderNode.index)) : 0,
    title: folderTitle,
    path: rootPath,
    children: captureChildren(folderNode.children, rootPath),
    recycleIds
  }

  await withLocalStorageTransaction(async (transaction) => {
    const [previousEntries, tags, stored] = await Promise.all([
      loadRecycleBinEntries(),
      loadBookmarkTagIndex({ transaction }),
      getLocalStorage(STORAGE_KEYS.newTabCustomIcons)
    ])
    const customIcons = normalizeCustomIconEntries(stored[STORAGE_KEYS.newTabCustomIcons])
    const iconMap: Record<string, string> = {}
    for (const item of collectedEntries) {
      const icon = customIcons[item.bookmarkId]
      if (icon) iconMap[item.bookmarkId] = icon
    }
    const preparedIcons = Object.keys(iconMap).length ? await prepareCustomIconReferences(iconMap) : {}
    const enrichedEntries = collectedEntries.map((item) => ({
      ...item.entry,
      ...(tags.records[item.bookmarkId] ? { tagRecord: tags.records[item.bookmarkId] } : {}),
      ...(preparedIcons[item.bookmarkId] ? { customIcon: preparedIcons[item.bookmarkId] } : {})
    }))

    let entriesAppended = false
    try {
      if (enrichedEntries.length) {
        await appendRecycleEntriesWithoutLock(enrichedEntries, transaction)
        entriesAppended = true
      }
      await removeBookmarkTree(folderId)
    } catch (error) {
      if (entriesAppended) {
        try {
          await replaceRecycleEntriesWithoutLock(previousEntries, transaction)
        } catch (cleanupError) {
          throw new RecycleLifecycleError(
            `${formatRecycleBinError(error)} 回收站记录自动回滚失败：` +
            `${formatRecycleBinError(cleanupError)}`,
            RECYCLE_DELETE_ROLLBACK_FAILED_CODE
          )
        }
      }
      throw error
    }
  })

  return {
    blueprint,
    bookmarkCount,
    recycleIds,
    subfolderCount
  }
}

export async function restoreFolderTreeFromUndo(
  blueprint: DeletedFolderBlueprint
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const [root] = await getBookmarkTree()
  const originalParent = findNodeById(root, String(blueprint.parentId || ''))
  const parent = originalParent && !originalParent.url && originalParent.parentId
    ? originalParent
    : findBookmarksBar(root)
  if (!parent) {
    throw new Error('找不到可恢复的书签目录，请稍后重试。')
  }

  const destinationIndex = parent === originalParent && Number.isFinite(blueprint.index)
    ? Math.max(0, Math.min(Math.trunc(blueprint.index), parent.children?.length || 0))
    : undefined
  const restoredRoot = await createBookmark({
    parentId: parent.id,
    title: blueprint.title || '未命名文件夹',
    index: destinationIndex
  })

  const existingRecycleIds = new Set(
    (await loadRecycleBinEntries()).map((entry) => String(entry.recycleId))
  )

  async function restoreChildren(
    parentId: string,
    children: readonly DeletedFolderBlueprintChild[]
  ): Promise<void> {
    for (const child of children) {
      if (child.kind === 'folder') {
        const createdFolder = await createBookmark({
          parentId,
          title: child.title || '未命名文件夹'
        })
        await restoreChildren(createdFolder.id, child.children)
      } else if (existingRecycleIds.has(child.recycleId)) {
        await restoreBookmarkFromRecycleEntry(child.recycleId, () =>
          createBookmark({
            parentId,
            title: child.title || '未命名书签',
            url: child.url
          })
        )
      } else {
        await createBookmark({
          parentId,
          title: child.title || '未命名书签',
          url: child.url
        })
      }
    }
  }

  await restoreChildren(restoredRoot.id, blueprint.children)
  return restoredRoot
}

export async function restoreBookmarkFromRecycleEntry(
  recycleId: string,
  createRestoredBookmark?: () => Promise<chrome.bookmarks.BookmarkTreeNode>
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (!normalizedRecycleId) {
    throw new Error('缺少待恢复的回收站记录。')
  }

  // Claim the entry under the storage lock so two surfaces cannot both create
  // a copy, then release it: the bookmark APIs below are the slow part of a
  // restore and must not hold up every other storage write.
  const claimedEntry = await withLocalStorageTransaction(async (transaction) => {
    const currentEntries = await loadRecycleBinEntries()
    const currentEntry = currentEntries.find((entry) => {
      return String(entry.recycleId) === normalizedRecycleId
    })
    if (!currentEntry) {
      throw new Error('回收站记录已不存在，已取消重复恢复。')
    }
    const restoringAt = Number(currentEntry.restoringAt) || 0
    if (restoringAt && Date.now() - restoringAt < RECYCLE_RESTORE_CLAIM_MS) {
      throw new Error('该记录正在恢复中，请稍后重试。')
    }
    const claimed: RecycleEntry = { ...currentEntry, restoringAt: Date.now() }
    await replaceRecycleEntriesWithoutLock(
      currentEntries.map((entry) => (String(entry.recycleId) === normalizedRecycleId ? claimed : entry)),
      transaction
    )
    return claimed
  })

  let createdBookmark: chrome.bookmarks.BookmarkTreeNode | null = null
  let previousTags: BookmarkTagIndex | null = null
  let previousIcons: Record<string, unknown> | null = null
  try {
    const sourceBookmarkId = String(claimedEntry.bookmarkId || '').trim()
    const sourceUrl = String(claimedEntry.url || '').trim()
    if (sourceBookmarkId && sourceUrl) {
      const sourceBookmark = await getBookmarkById(sourceBookmarkId)
      if (sourceBookmark && String(sourceBookmark.url || '').trim() === sourceUrl) {
        await removeRecycleEntry(normalizedRecycleId)
        throw new RecycleLifecycleError(
          '原书签仍然存在，已清理未完成删除留下的回收站记录；未创建副本。',
          RECYCLE_RESTORE_SOURCE_EXISTS_CODE
        )
      }
    }

    createdBookmark = await (createRestoredBookmark
      ? createRestoredBookmark()
      : createBookmarkAtRecycleDestination(claimedEntry))
    if (!createdBookmark?.id) {
      throw new Error('Chrome 未返回已恢复书签的标识。')
    }

    // The storage half of the restore stays atomic: tag data, custom icon and
    // the recycle-entry removal land together.
    const restoredBookmark = createdBookmark
    await withLocalStorageTransaction(async (transaction) => {
      const tagRecord = normalizeBookmarkTagRecord(claimedEntry.tagRecord)
      if (tagRecord && tagRecord.url === restoredBookmark.url) {
        previousTags = await loadBookmarkTagIndex({ transaction })
        await saveBookmarkTagIndex({
          ...previousTags,
          records: {
            ...previousTags.records,
            [restoredBookmark.id]: { ...tagRecord, bookmarkId: restoredBookmark.id, title: restoredBookmark.title }
          }
        }, { transaction })
      }
      if (claimedEntry.customIcon) {
        previousIcons = await getLocalStorage(STORAGE_KEYS.newTabCustomIcons)
        await setBookmarkCustomIcon(restoredBookmark.id, claimedEntry.customIcon, transaction)
      }
      await removeRecycleEntriesWithoutLock([normalizedRecycleId], transaction)
    })
    return createdBookmark
  } catch (error) {
    if (!createdBookmark?.id) {
      // Nothing was created; release the claim so the user can retry.
      await releaseRecycleRestoreClaim(normalizedRecycleId).catch(() => {})
      throw error
    }

    const rollbackErrors: string[] = []
    let bookmarkRolledBack = false
    try {
      await removeBookmark(String(createdBookmark.id))
      bookmarkRolledBack = true
    } catch (rollbackError) {
      rollbackErrors.push(formatRecycleBinError(rollbackError))
    }
    if (previousTags) {
      await restoreBookmarkTagIndexSnapshot(previousTags).catch(reason => rollbackErrors.push(formatRecycleBinError(reason)))
    }
    if (previousIcons) {
      await setLocalStorage({ [STORAGE_KEYS.newTabCustomIcons]: previousIcons[STORAGE_KEYS.newTabCustomIcons] || {} })
        .catch(reason => rollbackErrors.push(formatRecycleBinError(reason)))
    }
    // Nothing was left behind: let the user retry right away. When the bookmark
    // rollback failed the claim stays in place, so an immediate retry cannot
    // create a second copy; the claim expires on its own.
    if (bookmarkRolledBack) {
      await releaseRecycleRestoreClaim(normalizedRecycleId).catch(() => {})
    }
    if (rollbackErrors.length) throw new RecycleLifecycleError(
      `${formatRecycleBinError(error)} 刚恢复的书签及附加数据自动回滚失败：${rollbackErrors.join('；')}`,
      RECYCLE_RESTORE_ROLLBACK_FAILED_CODE
    )
    throw new Error(`${formatRecycleBinError(error)} 已撤销刚恢复的书签。`)
  }
}

/** Drops a restore claim that never produced a bookmark, so the entry can be
 * restored again. A claim left behind by a killed worker expires on its own. */
async function releaseRecycleRestoreClaim(recycleId: string): Promise<void> {
  await withLocalStorageTransaction(async (transaction) => {
    const entries = await loadRecycleBinEntries()
    const entry = entries.find((item) => String(item.recycleId) === recycleId)
    if (!entry || !Number(entry.restoringAt)) {
      return
    }
    const { restoringAt: _dropped, ...rest } = entry
    await replaceRecycleEntriesWithoutLock(
      entries.map((item) => (String(item.recycleId) === recycleId ? rest as RecycleEntry : item)),
      transaction
    )
  })
}

async function createBookmarkAtRecycleDestination(entry: RecycleEntry): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const [root] = await getBookmarkTree()
  const originalParent = findNodeById(root, String(entry.parentId || ''))
  const parent = originalParent && !originalParent.url && originalParent.parentId
    ? originalParent
    : findBookmarksBar(root)
  if (!parent) throw new Error('找不到可恢复的书签目录，请稍后重试。')
  return createBookmark({
    title: entry.title || '未命名书签',
    url: entry.url,
    parentId: parent.id,
    index: parent === originalParent && Number.isFinite(entry.index)
      ? Math.max(0, Math.min(Math.trunc(entry.index!), parent.children?.length || 0))
      : undefined
  })
}

export function mergeRecycleEntries(
  incomingEntries: RecycleEntry[],
  existingEntries: RecycleEntry[] = []
): RecycleEntry[] {
  const merged = new Map<string, RecycleEntry>()
  const incomingIds = new Set(
    incomingEntries.map((entry) => String(entry?.recycleId || '').trim())
  )

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
    .sort((left, right) => {
      const leftIncoming = incomingIds.has(String(left.recycleId))
      const rightIncoming = incomingIds.has(String(right.recycleId))
      if (leftIncoming !== rightIncoming) {
        return leftIncoming ? -1 : 1
      }
      return (Number(right.deletedAt) || 0) - (Number(left.deletedAt) || 0)
    })
}

function normalizeRecycleEntries(rawEntries: unknown): RecycleEntry[] {
  return Array.isArray(rawEntries)
    ? mergeRecycleEntries(rawEntries as RecycleEntry[])
    : []
}

function updateRecycleBinEntries(
  updater: (entries: RecycleEntry[]) => RecycleEntry[],
  transaction: LocalStorageTransaction
): Promise<void> {
  return loadRecycleBinEntries().then((currentEntries) => {
    const nextEntries = mergeRecycleEntries(updater(currentEntries))
    return setLocalStorage({
      [STORAGE_KEYS.recycleBin]: nextEntries
    }, { transaction })
  })
}

function appendRecycleEntriesWithoutLock(
  entries: RecycleEntry[],
  transaction: LocalStorageTransaction
): Promise<void> {
  return updateRecycleBinEntries(
    (currentEntries) => mergeRecycleEntries(entries, currentEntries),
    transaction
  )
}

function removeRecycleEntriesWithoutLock(
  recycleIds: string[],
  transaction: LocalStorageTransaction
): Promise<void> {
  const targetSet = new Set(
    recycleIds.flatMap((id) => {
      const normalizedId = String(id || '').trim()
      return normalizedId ? [normalizedId] : []
    })
  )
  return updateRecycleBinEntries(
    (currentEntries) => removeRecycleEntriesById(currentEntries, targetSet),
    transaction
  )
}

function replaceRecycleEntriesWithoutLock(
  entries: RecycleEntry[],
  transaction: LocalStorageTransaction
): Promise<void> {
  return setLocalStorage({
    [STORAGE_KEYS.recycleBin]: mergeRecycleEntries(entries)
  }, { transaction })
}

function removeRecycleEntriesById(
  entries: RecycleEntry[],
  targetSet: Set<string>
): RecycleEntry[] {
  return entries.filter((entry) => {
    return !targetSet.has(String(entry?.recycleId || ''))
  })
}

function formatRecycleBinError(error: unknown): string {
  return error instanceof Error ? error.message : '回收站操作失败。'
}
