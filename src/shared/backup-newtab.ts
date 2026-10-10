import { STORAGE_KEYS } from './constants.js'

// One field list owns export, restore and rollback coverage.
export const NEWTAB_BACKUP_FIELDS = {
  customIcons: STORAGE_KEYS.newTabCustomIcons,
  backgroundSettings: STORAGE_KEYS.newTabBackgroundSettings,
  searchSettings: STORAGE_KEYS.newTabSearchSettings,
  iconSettings: STORAGE_KEYS.newTabIconSettings,
  timeSettings: STORAGE_KEYS.newTabTimeSettings,
  glassSettings: STORAGE_KEYS.newTabGlassSettings,
  generalSettings: STORAGE_KEYS.newTabGeneralSettings,
  folderSettings: STORAGE_KEYS.newTabFolderSettings,
  workspaceSettings: STORAGE_KEYS.newTabWorkspaceSettings,
  moduleSettings: STORAGE_KEYS.newTabModuleSettings,
  featuredBackgroundFavorites: STORAGE_KEYS.newTabFeaturedBackgroundFavorites,
  featuredBackgroundPreferences: STORAGE_KEYS.newTabFeaturedBackgroundPreferences,
  activity: STORAGE_KEYS.newTabActivity
} as const

export function buildNewTabStoragePayload(newTab: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(NEWTAB_BACKUP_FIELDS)
    .filter(([field]) => newTab[field] !== undefined && newTab[field] !== null)
    .map(([field, key]) => [key, newTab[field]]))
}

interface ReferenceNode { id: string; url: string; path: string; folder: boolean }
export interface BackupReferences {
  bookmarks: Map<string, string>
  folders: Map<string, string[]>
}

function flatten(tree: chrome.bookmarks.BookmarkTreeNode[], normalizeUrl: (url: string) => string): ReferenceNode[] {
  const nodes: ReferenceNode[] = []
  function visit(node: chrome.bookmarks.BookmarkTreeNode, path: string[]) {
    const folder = !node.url
    const next = folder ? [...path, node.title || ''] : path
    nodes.push({ id: String(node.id), url: node.url ? normalizeUrl(node.url) : '', path: JSON.stringify(next), folder })
    node.children?.forEach(child => visit(child, next))
  }
  tree.forEach(root => root.children?.forEach(child => visit(child, [])))
  return nodes
}

export function buildBackupReferences(
  sourceTree: chrome.bookmarks.BookmarkTreeNode[],
  currentTree: chrome.bookmarks.BookmarkTreeNode[],
  copiedIds: Map<string, string>,
  normalizeUrl: (url: string) => string
): BackupReferences {
  const current = flatten(currentTree, normalizeUrl)
  const byId = new Map(current.map(node => [node.id, node]))
  const byIdentity = new Map<string, ReferenceNode[]>()
  const byUrl = new Map<string, ReferenceNode[]>()
  const identity = (node: ReferenceNode) => JSON.stringify([node.folder, node.path, node.url])
  for (const node of current) {
    const key = identity(node)
    const identities = byIdentity.get(key) || []
    identities.push(node)
    byIdentity.set(key, identities)
    if (node.url) {
      const urls = byUrl.get(node.url) || []
      urls.push(node)
      byUrl.set(node.url, urls)
    }
  }
  const references: BackupReferences = { bookmarks: new Map(), folders: new Map() }
  for (const source of flatten(sourceTree, normalizeUrl)) {
    const sameId = byId.get(source.id)
    const exact = byIdentity.get(identity(source)) || []
    const urls = source.url ? byUrl.get(source.url) || [] : []
    // Numeric Chrome IDs are profile-local. Never trust an ID with a different identity.
    const matched = sameId && identity(sameId) === identity(source) ? sameId
      : exact.length === 1 ? exact[0] : !source.folder && urls.length === 1 ? urls[0] : undefined
    const copied = copiedIds.get(source.id)
    if (source.folder) {
      const ids = [...new Set([matched?.id, copied].filter((id): id is string => Boolean(id)))]
      if (ids.length) references.folders.set(source.id, ids)
    } else if (copied || matched) {
      references.bookmarks.set(source.id, copied || matched!.id)
    }
  }
  return references
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function remapNewTabBackup(newTab: Record<string, unknown>, references: BackupReferences): Record<string, unknown> {
  const result = { ...newTab }
  const remapPins = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.flatMap(id => references.bookmarks.get(String(id)) || []))] : []
  const remapRecords = (value: unknown, update: boolean) => Object.fromEntries(
    Object.entries(object(value)).flatMap(([id, record]) => {
      const restoredId = references.bookmarks.get(id)
      return restoredId ? [[restoredId, update ? { ...object(record), bookmarkId: restoredId } : record]] : []
    })
  )
  if (newTab.customIcons) result.customIcons = remapRecords(newTab.customIcons, false)
  if (newTab.folderSettings) {
    const settings = object(newTab.folderSettings)
    result.folderSettings = {
      ...settings,
      selectedFolderIds: Array.isArray(settings.selectedFolderIds)
        ? [...new Set(settings.selectedFolderIds.flatMap(id => references.folders.get(String(id)) || []))] : []
    }
  }
  if (newTab.workspaceSettings) {
    const settings = object(newTab.workspaceSettings)
    result.workspaceSettings = {
      ...settings,
      workspaces: Array.isArray(settings.workspaces) ? settings.workspaces.map(value => {
        const workspace = object(value)
        return { ...workspace, pinnedIds: remapPins(workspace.pinnedIds) }
      }) : []
    }
  }
  if (newTab.activity) {
    const activity = object(newTab.activity)
    result.activity = { ...activity, pinnedIds: remapPins(activity.pinnedIds), records: remapRecords(activity.records, true) }
  }
  return result
}
