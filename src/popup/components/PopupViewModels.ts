export interface PopupEmptyActionViewModel {
  action: string
  label: string
  primary?: boolean
}

export type PopupEmptyStateViewModel =
  | { kind: 'none' }
  | { kind: 'message'; message: string }
  | { kind: 'natural-setup' }
  | {
      actions: PopupEmptyActionViewModel[]
      hint: string
      kind: 'search'
      title: string
    }

export interface PopupFolderTreeOptionViewModel {
  badges: Array<{ label: string; muted?: boolean }>
  disabled: boolean
  expanded: boolean
  hasChildren: boolean
  id: string
  mode: 'move' | 'smart' | 'edit'
  path: string
  rowCurrent: boolean
  selected: boolean
  title: string
  toggleLabel: string
  depth: number
}

export interface PopupFolderPickerState {
  empty: {
    action?: string
    actionLabel?: string
    detail?: string
    message?: string
    title?: string
  } | null
  mode: 'move' | 'smart' | 'edit'
  query: string
  treeOptions?: PopupFolderTreeOptionViewModel[]
}

export interface PopupActionMenuItemViewModel {
  action: string
  ariaLabel: string
  bookmarkId: string
  danger: boolean
  disabled: boolean
  label: string
}

export interface PopupActionMenuViewModel {
  items: PopupActionMenuItemViewModel[]
}

export interface PopupContentBookmarkRowViewModel {
  bookmarkId: string
  depth: number
  displayUrl: string
  kind: 'bookmark'
  menu: PopupActionMenuViewModel
  menuLabel: string
  path?: string
  title: string
  url: string
}

export interface PopupContentFolderRowViewModel {
  active?: boolean
  countLabel: string
  depth: number
  expanded: boolean
  folderId: string
  kind: 'folder'
  root: boolean
  subtitle: string
  title: string
  toggleLabel: string
}

export interface PopupContentSearchResultViewModel {
  active: boolean
  bookmarkId: string
  depth: number
  displayUrl: string
  highlightQuery: string
  index: number
  kind: 'result'
  menu: PopupActionMenuViewModel
  menuLabel: string
  path: string
  reasonLabel: string
  reasonTitle: string
  reasonTokens: string[]
  title: string
  url: string
}

export type PopupContentRowViewModel =
  | PopupContentBookmarkRowViewModel
  | PopupContentFolderRowViewModel
  | PopupContentSearchResultViewModel

export type PopupContentMainRowViewModel =
  | PopupContentBookmarkRowViewModel
  | PopupContentSearchResultViewModel

export interface PopupContentViewModel {
  emptyLabel?: string
  loading?: boolean
  mainState?: {
    kind: 'empty' | 'loading' | 'natural-setup' | 'search-empty'
    label?: string
    state?: PopupEmptyStateViewModel
  }
  mainRows?: PopupContentMainRowViewModel[]
  meta?: string
  mode?: 'search' | 'tree'
  rows: PopupContentRowViewModel[]
  sidebarRows?: PopupContentFolderRowViewModel[]
  title?: string
}

export interface PopupSmartPageViewModel {
  bookmarked: boolean
  favicon: string
  pinLabel: string
  pinPending: boolean
  pinned: boolean
  status: string
  statusTitle: string
  title: string
  fallbackIcon: string
}

export interface PopupSmartRecommendationViewModel {
  confidence: number
  id: string
  isNew: boolean
  selected: boolean
  title: string
  path: string
}

export interface PopupSmartClassifierViewModel {
  error: string
  loadingLabel: string
  loadingProgress: number
  loadingStartProgress: number
  loadingStep: number
  loadingStepCount: number
  page: PopupSmartPageViewModel | null
  permissionOrigins: string[]
  recommendations: PopupSmartRecommendationViewModel[]
  saved: boolean
  saving: boolean
  status: 'hidden' | 'idle' | 'page-loading' | 'loading' | 'results' | 'error' | 'permission'
  suggestedTitle: string
}
