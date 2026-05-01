export const BOOKMARKS_BAR_ID = '1'
export const ROOT_ID = '0'

export const STORAGE_KEYS = {
  ignoreRules: 'curatorBookmarkIgnoreRules',
  detectionHistory: 'curatorBookmarkDetectionHistory',
  bookmarkAddHistory: 'curatorBookmarkAddHistory',
  autoAnalyzeQueue: 'curatorBookmarkAutoAnalyzeQueue',
  autoAnalyzeStatus: 'curatorBookmarkAutoAnalyzeStatus',
  pendingAutoAnalyzeNotice: 'curatorBookmarkPendingAutoAnalyzeNotice',
  pendingAvailabilityResults: 'curatorBookmarkPendingAvailabilityResults',
  newTabCustomIcons: 'curatorBookmarkNewTabCustomIcons',
  newTabBackgroundSettings: 'curatorBookmarkNewTabBackgroundSettings',
  newTabSearchSettings: 'curatorBookmarkNewTabSearchSettings',
  newTabIconSettings: 'curatorBookmarkNewTabIconSettings',
  newTabTimeSettings: 'curatorBookmarkNewTabTimeSettings',
  newTabGeneralSettings: 'curatorBookmarkNewTabGeneralSettings',
  newTabFolderSettings: 'curatorBookmarkNewTabFolderSettings',
  popupCommandIntent: 'curatorBookmarkPopupCommandIntent',
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
export const AUTO_ANALYZE_STATUS_ACTIVE_EXPIRE_MS = 10 * 60 * 1000
export const AUTO_ANALYZE_STATUS_FINAL_EXPIRE_MS = 5 * 60 * 1000
export const POPUP_COMMAND_INTENT_TTL_MS = 45 * 1000
export const COMMAND_FEEDBACK_BADGE_TTL_MS = 3000
