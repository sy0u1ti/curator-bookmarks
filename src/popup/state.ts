import type { FolderRecord } from '../shared/types.js'
import type { PopupSearchBookmark, PopupSearchResult } from './search.js'

export interface PopupSmartRecommendation {
  id: string
  kind: string
  folderId?: string
  title: string
  path: string
  reason: string
  confidence: number
  [key: string]: unknown
}

export interface PopupDeletedBookmark {
  title: string
  url: string
  parentId: string
  index: number
  recycleId: string
}

export interface PopupToast {
  id?: string
  type: string
  message: string
  action?: string
  actionLabel?: string
  [key: string]: unknown
}

export interface PopupState {
  isLoading: boolean
  loadError: string
  rawTreeRoot: chrome.bookmarks.BookmarkTreeNode | null
  bookmarksBarNode: chrome.bookmarks.BookmarkTreeNode | null
  allBookmarks: PopupSearchBookmark[]
  allFolders: FolderRecord[]
  bookmarkMap: Map<string, PopupSearchBookmark>
  folderMap: Map<string, FolderRecord>
  expandedFolders: Set<string>
  moveExpandedFolders: Set<string>
  searchQuery: string
  debouncedQuery: string
  selectedFolderFilterId: string | null
  isFilterPickerOpen: boolean
  filterSearchQuery: string
  searchResults: PopupSearchResult[]
  activeResultIndex: number
  searchTimer: number | null
  searchRunId: number
  searchPending: boolean
  searchCache: Map<string, PopupSearchResult[]>
  filteredBookmarksCacheKey: string
  filteredBookmarksCache: PopupSearchBookmark[]
  contentRenderHtml: string
  activeMenuBookmarkId: string | null
  moveTargetBookmarkId: string | null
  moveSearchQuery: string
  editTargetBookmarkId: string | null
  confirmDeleteBookmarkId: string | null
  currentTab: chrome.tabs.Tab | null
  currentPageBookmarkId: string | null
  smartStatus: string
  smartError: string
  smartStep: number
  smartProgressPercent: number
  smartSuggestedTitle: string
  smartSummary: string
  smartRecommendations: PopupSmartRecommendation[]
  smartSelectedRecommendationId: string
  smartFolderPickerOpen: boolean
  smartFolderSearchQuery: string
  smartSaving: boolean
  smartSaved: boolean
  smartRunId: number
  smartPermissionRequest: { origins?: string[] } | null
  lastDeletedBookmark: PopupDeletedBookmark | null
  toasts: PopupToast[]
  toastTimers: Map<string, number>
}

export const state: PopupState = {
  isLoading: true,
  loadError: '',
  rawTreeRoot: null,
  bookmarksBarNode: null,
  allBookmarks: [],
  allFolders: [],
  bookmarkMap: new Map(),
  folderMap: new Map(),
  expandedFolders: new Set(),
  moveExpandedFolders: new Set(),
  searchQuery: '',
  debouncedQuery: '',
  selectedFolderFilterId: null,
  isFilterPickerOpen: false,
  filterSearchQuery: '',
  searchResults: [],
  activeResultIndex: 0,
  searchTimer: null,
  searchRunId: 0,
  searchPending: false,
  searchCache: new Map(),
  filteredBookmarksCacheKey: '',
  filteredBookmarksCache: [],
  contentRenderHtml: '',
  activeMenuBookmarkId: null,
  moveTargetBookmarkId: null,
  moveSearchQuery: '',
  editTargetBookmarkId: null,
  confirmDeleteBookmarkId: null,
  currentTab: null,
  currentPageBookmarkId: null,
  smartStatus: 'idle',
  smartError: '',
  smartStep: 0,
  smartProgressPercent: 0,
  smartSuggestedTitle: '',
  smartSummary: '',
  smartRecommendations: [],
  smartSelectedRecommendationId: '',
  smartFolderPickerOpen: false,
  smartFolderSearchQuery: '',
  smartSaving: false,
  smartSaved: false,
  smartRunId: 0,
  smartPermissionRequest: null,
  lastDeletedBookmark: null,
  toasts: [],
  toastTimers: new Map()
}
