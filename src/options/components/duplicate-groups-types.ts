export interface DuplicateBookmarkViewModel {
  ancestorIds?: unknown[]
  dateAdded?: number
  id: string
  parentId?: string
  path: string
  title: string
  url: string
}

export interface DuplicateGroupViewModel {
  displayUrl: string
  folders: unknown[]
  fullerTitleItemId: string
  hasTitleVariants: boolean
  id: string
  isCrossFolder: boolean
  items: DuplicateBookmarkViewModel[]
  latestItemId: string
  newTabSourceItemId: string
  oldestItemId: string
  recentItemId: string
  recommendedKeepId: string
  recommendation: {
    reason?: string
  }
  risk: string
  shorterPathItemId: string
  taggedItemId: string
}

export interface DuplicateSelectionStatsViewModel {
  deleteCount: number
  groupCount: number
  keepCount: number
  unsafeGroupCount: number
}

export interface DuplicateGroupsState {
  catalogLoading: boolean
  currentScopeFolderId: string
  groups: DuplicateGroupViewModel[]
  locked: boolean
  selectedIds: Set<unknown>
  selectionStats: DuplicateSelectionStatsViewModel
  tagBadgeLabels: Record<string, string>
}
