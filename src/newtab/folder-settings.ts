import { BOOKMARKS_BAR_ID } from '../shared/constants.js'

export const DEFAULT_NEW_TAB_FOLDER_TITLE = '标签页'

export interface NewTabFolderSettings {
  selectedFolderIds: string[]
  hideFolderNames: boolean
}

export const DEFAULT_FOLDER_SETTINGS: NewTabFolderSettings = {
  selectedFolderIds: [],
  hideFolderNames: false
}

export function normalizeFolderSettings(rawSettings: unknown): NewTabFolderSettings {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return createDefaultFolderSettings()
  }

  const settings = rawSettings as Record<string, unknown>
  return {
    selectedFolderIds: normalizeFolderIds(settings.selectedFolderIds),
    hideFolderNames: settings.hideFolderNames === true
  }
}

export function normalizeFolderSettingsWithDefault(
  rawSettings: unknown,
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): NewTabFolderSettings {
  const settings = normalizeFolderSettings(rawSettings)
  if (settings.selectedFolderIds.length || hasExplicitFolderSelection(rawSettings)) {
    return settings
  }

  const defaultFolder = findNewTabFolder(rootNode)
  if (!defaultFolder?.id) {
    return settings
  }

  return {
    ...settings,
    selectedFolderIds: [String(defaultFolder.id)]
  }
}

export function normalizeFolderIds(value: unknown): string[] {
  const source = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of source) {
    const id = String(item || '').trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids.slice(0, 24)
}

export function findNewTabFolder(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode | null {
  const candidates: Array<{
    node: chrome.bookmarks.BookmarkTreeNode
    depth: number
    underBookmarksBar: boolean
    directBookmarksBarChild: boolean
  }> = []

  function walk(
    node: chrome.bookmarks.BookmarkTreeNode,
    ancestors: chrome.bookmarks.BookmarkTreeNode[] = []
  ): void {
    if (!node.url && node.title === DEFAULT_NEW_TAB_FOLDER_TITLE) {
      candidates.push({
        node,
        depth: ancestors.length,
        underBookmarksBar: ancestors.some((ancestor) => ancestor.id === BOOKMARKS_BAR_ID),
        directBookmarksBarChild: node.parentId === BOOKMARKS_BAR_ID
      })
    }

    for (const child of node.children || []) {
      if (!child.url) {
        walk(child, [...ancestors, node])
      }
    }
  }

  if (rootNode) {
    walk(rootNode)
  }

  candidates.sort((left, right) => {
    if (left.directBookmarksBarChild !== right.directBookmarksBarChild) {
      return left.directBookmarksBarChild ? -1 : 1
    }
    if (left.underBookmarksBar !== right.underBookmarksBar) {
      return left.underBookmarksBar ? -1 : 1
    }
    return left.depth - right.depth
  })

  return candidates[0]?.node || null
}

function hasExplicitFolderSelection(rawSettings: unknown): boolean {
  return Boolean(
    rawSettings &&
    typeof rawSettings === 'object' &&
    !Array.isArray(rawSettings) &&
    Array.isArray((rawSettings as Record<string, unknown>).selectedFolderIds)
  )
}

function createDefaultFolderSettings(): NewTabFolderSettings {
  return {
    selectedFolderIds: [],
    hideFolderNames: DEFAULT_FOLDER_SETTINGS.hideFolderNames
  }
}
