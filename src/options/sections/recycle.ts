import {
  BOOKMARKS_BAR_ID,
  RECYCLE_BIN_LIMIT
} from '../../shared/constants.js'
import { createBookmark, getBookmarkTree } from '../../shared/bookmarks-api.js'
import { buildBookmarkCatalogSnapshot } from '../../shared/bookmark-catalog.js'
import {
  deleteBookmarkToRecycle,
  loadRecycleBinEntries,
  mergeRecycleEntries,
  removeRecycleEntries,
  type RecycleEntry
} from '../../shared/recycle-bin.js'
import { createAutoBackupBeforeDangerousOperation, type DangerousOperationKind } from '../../shared/backup.js'
import { availabilityState, managerState } from '../shared-options/state.js'
import { syncSelectionSet } from '../shared-options/utils.js'
import { publishRecycleBin } from '../components/recycle-bin-store.js'
import { publishRecycleControls } from '../components/recycle-controls-store.js'

export function normalizeRecycleBin(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return []
  }

  return rawEntries.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((entry) => {
      return {
        recycleId: String(entry?.recycleId || '').trim(),
        bookmarkId: String(entry?.bookmarkId || '').trim(),
        title: String(entry?.title || '未命名书签').trim() || '未命名书签',
        url: String(entry?.url || '').trim(),
        parentId: String(entry?.parentId || '').trim(),
        index: Number.isFinite(Number(entry?.index)) ? Number(entry.index) : 0,
        path: String(entry?.path || '').trim(),
        source: String(entry?.source || '删除').trim() || '删除',
        deletedAt: Number(entry?.deletedAt) || Date.now()
      }
    })(combineValue); return ((entry) => entry.recycleId && entry.url)(combinedResult) ? [combinedResult] : [] })
    .sort((left, right) => right.deletedAt - left.deletedAt)
}

function buildRecycleEntry(bookmark, source) {
  return {
    recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    bookmarkId: String(bookmark.id),
    title: bookmark.title || '未命名书签',
    url: bookmark.url,
    parentId: String(bookmark.parentId || ''),
    index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
    path: bookmark.path || '',
    source,
    deletedAt: Date.now()
  }
}

export function renderRecycleSection(callbacks) {
  syncSelectionSet(
    managerState.selectedRecycleIds,
    new Set(managerState.recycleBin.map((entry) => String(entry.recycleId)))
  )

  publishRecycleControls({
    busy: availabilityState.deleting,
    entryCount: managerState.recycleBin.length,
    selectedCount: managerState.selectedRecycleIds.size
  })

  publishRecycleBin({
    entries: managerState.recycleBin,
    selectedIds: managerState.selectedRecycleIds,
    disabled: availabilityState.deleting
  })
}

export function clearRecycleSelection(callbacks) {
  managerState.selectedRecycleIds.clear()
  callbacks.renderAvailabilitySection()
}

export function toggleRecycleEntrySelection(recycleId, checked, callbacks) {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (availabilityState.deleting || !normalizedRecycleId) {
    return
  }

  if (checked === true) {
    managerState.selectedRecycleIds.add(normalizedRecycleId)
  } else if (checked === false) {
    managerState.selectedRecycleIds.delete(normalizedRecycleId)
  } else if (managerState.selectedRecycleIds.has(normalizedRecycleId)) {
    managerState.selectedRecycleIds.delete(normalizedRecycleId)
  } else {
    managerState.selectedRecycleIds.add(normalizedRecycleId)
  }
  callbacks.renderAvailabilitySection()
}

export function clearRecycleEntry(recycleId, callbacks) {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (availabilityState.deleting || !normalizedRecycleId) {
    return
  }

  void clearRecycleEntriesByIds([normalizedRecycleId], callbacks)
}

export function restoreRecycleEntry(recycleId, callbacks) {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (availabilityState.deleting || !normalizedRecycleId) {
    return
  }

  restoreRecycleEntriesByIds([normalizedRecycleId], callbacks)
}

async function clearRecycleEntriesByIds(recycleIds, callbacks) {
  const targetSet = new Set<string>(recycleIds.flatMap(id => { const mappedResult = String(id); return mappedResult ? [mappedResult] : [] }))
  const targetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })

  if (!targetEntries.length || availabilityState.deleting) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: targetEntries.length === 1
          ? '清除这条回收站记录？'
          : `清除 ${targetEntries.length} 条回收站记录？`,
        copy: '这只会从扩展回收站中移除记录，之后无法再从扩展内恢复；不会再次修改 Chrome 书签。',
        confirmLabel: '清除记录',
        label: '清除回收站记录',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  managerState.recycleBin = managerState.recycleBin.filter((entry) => {
    return !targetSet.has(String(entry.recycleId))
  })
  for (const recycleId of targetSet) {
    managerState.selectedRecycleIds.delete(recycleId)
  }
  await removeRecycleEntries([...targetSet])
  await refreshRecycleBinState()
  availabilityState.lastError = targetEntries.length === 1
    ? '已清除 1 条回收站记录。'
    : `已清除 ${targetEntries.length} 条回收站记录。`
  callbacks.renderAvailabilitySection()
}

export function selectAllRecycleEntries(callbacks) {
  managerState.selectedRecycleIds = new Set(
    managerState.recycleBin.map((entry) => String(entry.recycleId))
  )
  callbacks.renderAvailabilitySection()
}

export async function restoreSelectedRecycleEntries(callbacks) {
  if (!managerState.selectedRecycleIds.size || availabilityState.deleting) {
    return
  }

  await restoreRecycleEntriesByIds([...managerState.selectedRecycleIds], callbacks)
  clearRecycleSelection(callbacks)
}

export async function clearSelectedRecycleEntries(callbacks) {
  if (!managerState.selectedRecycleIds.size || availabilityState.deleting) {
    return
  }

  await clearRecycleEntriesByIds([...managerState.selectedRecycleIds], callbacks)
}

async function restoreRecycleEntriesByIds(recycleIds, callbacks) {
  const targetSet = new Set(recycleIds.flatMap(id => { const mappedResult = String(id); return mappedResult ? [mappedResult] : [] }))
  const targetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })

  if (!targetEntries.length) {
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const restoredIds = []
  let restoreError = null

  try {
    const currentFolderIds = await loadCurrentFolderIds()
    await runRecycleEntriesSequentially(targetEntries, async (entry) => {
      const fallbackParentId = currentFolderIds.has(String(entry.parentId))
        ? entry.parentId
        : BOOKMARKS_BAR_ID

      await createBookmark({
        parentId: fallbackParentId,
        index: Number.isFinite(entry.index) ? entry.index : undefined,
        title: entry.title,
        url: entry.url
      })
      restoredIds.push(String(entry.recycleId))
    })
  } catch (error) {
    restoreError = error
  } finally {
    availabilityState.deleting = false

    if (restoredIds.length) {
      const restoredSet = new Set(restoredIds)
      managerState.recycleBin = managerState.recycleBin.filter((entry) => {
        return !restoredSet.has(String(entry.recycleId))
      })
      await removeRecycleEntries(restoredIds)
      await Promise.all([
        refreshRecycleBinState(),
        callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      ])
    }

    if (restoreError) {
      availabilityState.lastError =
        restoreError instanceof Error
          ? `恢复过程中断，已恢复 ${restoredIds.length} 条：${restoreError.message}`
          : `恢复过程中断，已恢复 ${restoredIds.length} 条。`
    } else {
      availabilityState.lastError = `已从回收站恢复 ${restoredIds.length} 条书签。`
    }

    callbacks.renderAvailabilitySection()
  }
}

function runRecycleEntriesSequentially<T>(items: T[], task: (item: T, index: number) => Promise<void>): Promise<void> {
  return items.reduce<Promise<void>>((chain, item, index) => {
    return chain.then(() => task(item, index))
  }, Promise.resolve())
}

async function loadCurrentFolderIds(): Promise<Set<string>> {
  const tree = await getBookmarkTree()
  const folders = buildBookmarkCatalogSnapshot({ rootNode: tree[0] }).extracted.folderMap
  return new Set([...folders.keys(), BOOKMARKS_BAR_ID])
}

export async function clearRecycleBin(callbacks) {
  if (!managerState.recycleBin.length || availabilityState.deleting) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `清空 ${managerState.recycleBin.length} 条回收站记录？`,
        copy: '这些回收站记录会被永久移除，之后无法再从扩展内恢复。',
        confirmLabel: '清空回收站',
        label: '清空回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  const recycleIds = managerState.recycleBin.map((entry) => String(entry.recycleId))
  managerState.recycleBin = []
  await removeRecycleEntries(recycleIds)
  await refreshRecycleBinState()
  clearRecycleSelection(callbacks)
  availabilityState.lastError = '已清空回收站记录。'
  callbacks.renderAvailabilitySection()
}

export async function deleteBookmarksToRecycle(bookmarkIds: unknown[], source: string, callbacks: any) {
  const uniqueIds = [...new Set(bookmarkIds.flatMap(id => { const mappedResult = String(id); return mappedResult ? [mappedResult] : [] }))]
  if (!uniqueIds.length) {
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const removedIds = []
  const recycleEntries = []
  let removalError = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: inferDeleteBackupKind(source),
      source: 'options',
      reason: source || '删除书签前自动备份',
      targetBookmarkIds: uniqueIds,
      estimatedChangeCount: uniqueIds.length
    })

    await runRecycleEntriesSequentially(uniqueIds, async (bookmarkId) => {
      const bookmark = callbacks.getBookmarkRecord(bookmarkId)
      if (!bookmark?.url) {
        return
      }

      const recycleEntry = buildRecycleEntry(bookmark, source)
      await deleteBookmarkToRecycle(bookmarkId, recycleEntry)
      removedIds.push(bookmarkId)
      recycleEntries.push(recycleEntry)
    })
  } catch (error) {
    removalError = error
  } finally {
    if (removedIds.length) {
      managerState.recycleBin = mergeRecycleEntries(
        recycleEntries as RecycleEntry[],
        managerState.recycleBin as RecycleEntry[]
      )
      await refreshRecycleBinState()
      callbacks.removeDeletedResultsFromState(removedIds)
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      await callbacks.saveRedirectCache()
    }

    availabilityState.deleting = false
    availabilityState.deleteModalOpen = false

    if (removalError) {
      availabilityState.lastError =
        removalError instanceof Error
          ? `删除过程中断，已删除 ${removedIds.length} 条：${removalError.message}`
          : `删除过程中断，已删除 ${removedIds.length} 条。`
    } else if (removedIds.length) {
      availabilityState.lastError = `已删除 ${removedIds.length} 条书签，并移入回收站。可在左侧“回收站”查看并恢复。`
    }

    callbacks.renderAvailabilitySection()
  }
}

export async function refreshRecycleBinState(): Promise<void> {
  managerState.recycleBin = normalizeRecycleBin(await loadRecycleBinEntries())
  managerState.recycleBin = managerState.recycleBin.slice(0, RECYCLE_BIN_LIMIT)
}

function inferDeleteBackupKind(source: string): DangerousOperationKind {
  if (/重复/.test(source)) {
    return 'duplicate-cleanup'
  }
  if (/异常|坏链|高置信/.test(source)) {
    return 'availability-cleanup'
  }
  return 'batch-delete'
}
