import { extractBookmarkData } from './bookmark-tree.js'
import { formatBookmarkPath } from './bookmark-path.js'
import { buildDuplicateKey } from './text.js'
import type { BackupReferences } from './backup-newtab.js'
import type { RecycleEntry } from './recycle-bin.js'
import type { FolderRecord } from './types.js'

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function resolveRecoveryFolder(
  parentId: string,
  path: string,
  folders: Map<string, FolderRecord>
): string {
  const expectedPath = formatBookmarkPath(path)
  const byId = folders.get(parentId)
  if (byId && (!expectedPath || formatBookmarkPath(byId.path) === expectedPath)) return byId.id
  if (!expectedPath) return ''
  const matches = [...folders.values()].filter(folder => formatBookmarkPath(folder.path) === expectedPath)
  return matches.length === 1 ? matches[0].id : ''
}

export function remapRecoveryCollections(
  recycle: unknown[],
  ignore: { bookmarks: unknown[]; folders: unknown[]; domains: unknown[] },
  references: BackupReferences,
  currentTree: chrome.bookmarks.BookmarkTreeNode[]
) {
  const catalog = extractBookmarkData(currentTree[0])
  const recycleBin = recycle.map(value => {
    const entry = object(value)
    const mappedParent = references.folders.get(String(entry.parentId || ''))?.[0]
    // Never carry unverified profile-local IDs through a restore.
    const parentId = mappedParent || resolveRecoveryFolder('', String(entry.path || ''), catalog.folderMap)
    return {
      ...entry,
      bookmarkId: references.bookmarks.get(String(entry.bookmarkId || '')) || '',
      parentId,
      path: catalog.folderMap.get(parentId)?.path || entry.path || ''
    } as RecycleEntry
  })
  const bookmarks = ignore.bookmarks.flatMap(value => {
    const rule = object(value)
    const id = references.bookmarks.get(String(rule.bookmarkId || ''))
    const bookmark = id ? catalog.bookmarkMap.get(id) : undefined
    return bookmark && rule.url && buildDuplicateKey(bookmark.url) === buildDuplicateKey(String(rule.url))
      ? [{ ...rule, bookmarkId: bookmark.id, url: bookmark.url, title: bookmark.title }] : []
  })
  const folders = ignore.folders.flatMap(value => {
    const rule = object(value)
    const ids = references.folders.get(String(rule.folderId || '')) || []
    const matches = ids.length ? ids : [resolveRecoveryFolder('', String(rule.path || ''), catalog.folderMap)]
    return matches.flatMap(id => {
      const folder = catalog.folderMap.get(id)
      return folder ? [{ ...rule, folderId: folder.id, title: folder.title, path: folder.path }] : []
    })
  })
  return { recycleBin, ignoreRules: { bookmarks, folders, domains: ignore.domains } }
}
