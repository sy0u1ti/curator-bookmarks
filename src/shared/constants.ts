export const BOOKMARKS_BAR_ID = '1'
export const ROOT_ID = '0'

export const STORAGE_KEYS = {
  ignoreRules: 'curatorBookmarkIgnoreRules',
  detectionHistory: 'curatorBookmarkDetectionHistory',
  bookmarkAddHistory: 'curatorBookmarkAddHistory',
  autoAnalyzeQueue: 'curatorBookmarkAutoAnalyzeQueue',
  pendingAutoAnalyzeNotice: 'curatorBookmarkPendingAutoAnalyzeNotice',
  newTabCustomIcons: 'curatorBookmarkNewTabCustomIcons',
  newTabBackgroundSettings: 'curatorBookmarkNewTabBackgroundSettings',
  newTabSearchSettings: 'curatorBookmarkNewTabSearchSettings',
  newTabIconSettings: 'curatorBookmarkNewTabIconSettings',
  newTabTimeSettings: 'curatorBookmarkNewTabTimeSettings',
  newTabGeneralSettings: 'curatorBookmarkNewTabGeneralSettings',
  newTabFolderSettings: 'curatorBookmarkNewTabFolderSettings',
  popupPreferences: 'curatorBookmarkPopupPreferences',
  redirectCache: 'curatorBookmarkRedirectCache',
  recycleBin: 'curatorBookmarkRecycleBin',
  aiProviderSettings: 'curatorBookmarkAiNamingSettings',
  bookmarkTagIndex: 'curatorBookmarkTagIndex'
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export const BOOKMARK_ADD_HISTORY_LIMIT = 200
export const RECYCLE_BIN_LIMIT = 200
export const UNDO_WINDOW_MS = 5000
