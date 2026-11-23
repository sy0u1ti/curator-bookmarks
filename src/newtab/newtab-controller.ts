import { flushSync } from 'react-dom'
import { actionFeedback, IDLE_ACTION_FEEDBACK } from '../shared/action-feedback.js'
import { formatBytes } from '../shared/format.js'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import {
  BOOKMARKS_BAR_ID,
  STORAGE_KEYS
} from '../shared/constants.js'
import {
  findBookmarksBar
} from '../shared/bookmark-tree.js'
import { buildBookmarkCatalogSnapshot, type BookmarkCatalogSnapshot } from '../shared/bookmark-catalog.js'
import { buildBookmarkManagerHash } from '../shared/extension-surfaces.js'
import { getLocalStorage, setLocalStorage, withLocalStorageTransaction, type LocalStorageTransaction } from '../shared/storage.js'
import { consumeNewtabStartupData, getBookmarkTree } from './newtab-startup-data.js'
import { createNewtabSettingsPersistence, NEWTAB_SYNCED_SETTING_KEYS } from './newtab-settings-persistence.js'
import { collectRemovedBookmarkNodeIds, persistNewtabWorkspaceMutation } from './newtab-workspace-persistence.js'
import { getMotionDurationMs, getMotionEasing, prefersReducedMotion } from '../shared/motion.js'
import { isBookmarkMenuInteractionTarget } from './bookmark-menu-interactions.js'
import { buildBookmarkMoveActions } from './bookmark-move-menu.js'
import {
  POPUP_FOLDER_SORT_OPTIONS,
  collectFolderDescendantIds,
  computeSortedDirectBookmarkIds,
  countFolderSubtreeContents,
  getPopupFolderSortOption,
  isProtectedBookmarkFolder,
  planDirectBookmarkSortMoves,
  validateFolderTitle,
  type PopupFolderSortMode
} from '../popup/popup-folder-management.js'
import {
  normalizeSettingsDrawerSection,
  type SettingsDrawerSection
} from './settings-group-sync.js'
import type { ExtractedBookmarkData, FolderRecord } from '../shared/types.js'
import {
  buildFolderCandidateRenderKey,
  getCachedFolderCandidates,
  type FolderCandidateCacheState,
  type NewTabFolderCandidate
} from './folder-candidate-cache.js'
import { parseSearchQuery } from '../shared/search-query.js'
import { searchDateBucket } from '../shared/search/date.js'
import type { NaturalSearchPlan } from '../popup/natural-search.js'
import type {
  BookmarkTagExtraction,
  BookmarkTagIndex,
  BookmarkTagRecord,
  BookmarkTagSource
} from '../shared/bookmark-tags.js'
import type { ContentSnapshotIndex } from '../shared/content-snapshots.js'
import { loadContentSnapshotSettings, type ContentSnapshotSettings } from '../shared/content-snapshot-search.js'
import {
  DEFAULT_ICON_SETTINGS,
  applyIconLayoutPreset,
  type IconLayoutPresetKey,
  type IconSettings,
  detectPresetFromValues,
  getEffectiveIconTileWidthPx,
  getFixedIconGridWidthPx,
  getFolderGapPx,
  getIconGapPx,
  getIconPageWidthPx,
  getResponsiveFixedIconColumns,
  getIconRowGapPx,
  normalizeIconSettings
} from './icon-settings.js'
import {
  DEFAULT_SEARCH_LAYOUT,
  getAdaptiveSearchWidthBounds,
  normalizeSearchHeight,
  resetSearchLayout,
  SEARCH_WIDTH_MAX_VW,
  SEARCH_WIDTH_MIN_VW
} from './search-layout.js'
import {
  dispatchIconPreviewViewForSettings,
  getIconPreviewSignature,
} from './icon-preview.js'
import {
  buildNewTabSearchIndex,
  buildNewTabSourceNavigationItems,
  createMissingFolderView,
  createNewTabPage,
  createStateView,
  collectPortalBookmarkSourceItems,
  createLoadingStateView,
  getNaturalSearchBookmarkSuggestionsFromIndex,
  getNewTabSourceAnchorId,
  getAutoCenteredSearchOffsetY,
  getPopupSearchBookmarkSuggestionsFromIndex,
  prepareNewTabSearchIndex,
  schedulePreparedNewTabSearchWarmup,
  getAdaptiveSearchOffsetBounds,
  getVerticalCenterCollisionOffset,
  normalizeNewTabSearchText,
  type AdaptiveSearchOffsetBounds,
  type NewTabContentState,
  type NewTabContentView,
  type NewTabBookmarksModule,
  resolveNewTabContentState,
  type NewTabPageModule,
  type NewTabSearchIndexEntry,
  type NewTabPreparedSearchIndex,
  type SearchBookmarkSuggestion
} from './content-state.js'
import {
  DEFAULT_FOLDER_SETTINGS,
  DEFAULT_NEW_TAB_FOLDER_TITLE,
  type NewTabBookmarkBrowseMode,
  type NewTabFolderSettings,
  findNewTabFolder,
  getDisplayableNewTabSourceFolders,
  getFolderBookmarkCounts,
  normalizeFolderIds,
  normalizeFolderSettings,
  normalizeFolderSettingsWithDefault
} from './folder-settings.js'
import {
  clearActiveFaviconSource,
  getActiveFaviconOrigin,
  getActiveFaviconSource,
  loadActiveFaviconStore,
  subscribeActiveFaviconResolution
} from './active-favicon.js'
import { buildChromeFaviconUrl } from './favicon-cache.js'
import {
  BACKGROUND_URL_FETCH_TIMEOUT_MS,
  BACKGROUND_URL_FULL_MAX_BYTES,
  BACKGROUND_URL_PREVIEW_MAX_BYTES,
  applyBookmarkMoveOperationsToChildren,
  buildBookmarkOrderAfterInsert,
  buildMinimalBookmarkMoveOperations,
  resolveBookmarkDragInsertIndex,
  type BookmarkMoveOperation,
  type BookmarkDragSlotRectLike,
  validateBackgroundBlobSize,
  validateBackgroundContentLength
} from './interactions.js'
import { searchWithBrowserDefault } from './browser-search.js'
import {
  canUseNewtabSearchFocus,
  getNewtabBlankPointerAction,
  getNewtabSearchFocusIntent,
  getNextNewtabSearchValue,
  shouldKeepNewtabSearchOpen,
  type NewtabSearchFocusIntent
} from './newtab-search-focus.js'
import {
  buildNewTabModuleSettingRows,
  DEFAULT_NEW_TAB_MODULE_SETTINGS,
  getVisibleNewTabModules,
  normalizeNewTabModuleSettings,
  type NewTabModuleSettingKey,
  type NewTabModuleSettings
} from './module-settings.js'
import { getSpeedDialFaviconLoadAttributes } from './speed-dial-load-attributes.js'
import { buildSpeedDialItems, createSpeedDialEmptyState, getSpeedDialStatus } from './speed-dial.js'
import type { SpeedDialItem } from './speed-dial-types.js'
import {
  createFolderDragSectionRectSnapshot,
  getFolderFlipDeltasFromSnapshots,
  getFolderInsertIndexFromSnapshot,
  projectFolderDragSectionRectSnapshot,
  type FolderDragSectionRectSnapshot
} from './folder-drag-geometry.js'
import {
  getBookmarkCreationIncrementalResult,
  getBookmarkMoveIncrementalResult,
  getBookmarkRemovalIncrementalResult
} from './bookmark-change-incremental.js'
import {
  clearInstantWallpaper,
  clearInstantWallpaperTarget,
  createInstantWallpaperDataUrl,
  createInstantWallpaperImageDataUrl,
  createInstantWallpaperVideoPosterDataUrl,
  readInstantWallpaper,
  readInstantWallpaperDataUrl,
  readInstantWallpaperImageDataUrl,
  readInstantWallpaperTarget,
  saveInstantWallpaper,
  saveInstantWallpaperTarget,
  saveWallpaperAdjustmentsSnapshot,
  getInstantWallpaperFallbackColor,
  normalizeInstantWallpaperColor,
  type InstantWallpaperTargetRecord
} from './instant-wallpaper.js'
import {
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  updateNewTabWorkspace,
  type NewTabWorkspaceSettings
} from '../shared/newtab-workspace-settings.js'
import { mark as perfMark, measure as perfMeasure, measureNow } from '../shared/perf.js'
import { runIdle } from '../shared/idle.js'
import { writeClipboardText } from '../shared/clipboard.js'
import { readCustomIconFile } from './custom-icon-picker.js'
import { loadCustomIcons, resolveCustomIcons, setBookmarkCustomIcon } from '../shared/repositories/custom-icon-repository.js'
import type { SpeedDialCardViewModel } from './components/NewtabSpeedDialPanel.js'
import {
  dispatchNewtabBookmarkContentView,
  getNewtabBookmarkContentNodes,
  getNewtabBookmarkContentView,
  patchNewtabBookmarkContentView,
  type BookmarkContentViewModel,
  type BookmarkFolderCardViewModel,
  type BookmarkFolderSectionViewModel,
  type BookmarkNavigationViewModel,
  type BookmarkTileViewModel,
  type BookmarkContentStyleState,
  type SourceNavigationState
} from './newtab-bookmark-content-store.js'
import { clearNewtabBookmarkPrebootSnapshot } from './newtab-bookmark-preboot.js'
import { computeCardAnchoredOrigin } from '../shared/anchor-origin.js'
import {
  createDefaultSearchWidgetInteractionState,
  createSearchWidgetActionState,
  dispatchNewtabSearchWidgetView,
  getNewtabSearchWidgetNodes,
  getNewtabSearchWidgetView,
  patchNewtabSearchWidgetView,
  type NewtabSearchWidgetNodes,
  type SearchChipViewModel,
  type SearchHintState,
  type SearchSuggestionViewModel,
  type SearchWidgetShellState
} from './newtab-search-widget-store.js'
import {
  dispatchNewtabModuleSettingsView,
  registerNewtabModuleSettingsActions,
  type NewtabModuleSettingRowView
} from './newtab-module-settings-store.js'
import {
  dispatchNewtabFolderCandidateFocusRequest,
  dispatchNewtabFolderSourceView,
  registerNewtabFolderSourceActions,
  type NewtabFolderCandidateItemView,
  type NewtabFolderCandidateState,
  type NewtabGeneralSettingToggleKey,
  type NewtabSelectedFolderSourceItemView,
  type NewtabSelectedFolderSourceState
} from './newtab-folder-source-store.js'
import type {
  BookmarkMenuActionIcon,
  BookmarkMenuActionViewModel,
  BookmarkMenuTextFieldViewModel
} from './bookmark-menu-view-models.js'
import {
  dispatchNewtabSettingsDrawerActiveGroup,
  dispatchNewtabSettingsDrawerFocusFirstControl,
  dispatchNewtabSettingsDrawerFocusSection,
  getNewtabSettingsDrawerNodes,
  requestNewtabSettingsDrawer,
  getNewtabSettingsDrawerView,
  dispatchNewtabSettingsDrawerOpen,
  dispatchNewtabSettingsDrawerScrollTop,
  dispatchNewtabSettingsDrawerSaveStatus,
  registerNewtabSettingsDrawerActions,
  subscribeNewtabSettingsDrawerNodes
} from './newtab-settings-drawer-store.js'
import {
  getNewtabContentLayoutNodes,
  getNewtabContentView,
  dispatchNewtabContentView,
  patchNewtabContentView,
  registerNewtabContentShellActions,
  subscribeNewtabContentLayoutNodes
} from './newtab-content-store.js'
import { registerNewtabKeyboardActions } from './newtab-keyboard-store.js'
import { registerNewtabLifecycleActions } from './newtab-lifecycle-store.js'
import { registerNewtabWindowActions } from './newtab-window-store.js'
import {
  dispatchNewtabSpeedDialView,
  getNewtabSpeedDialNodes,
  getNewtabSpeedDialView,
  patchNewtabSpeedDialView
} from './newtab-speed-dial-store.js'
import {
  dispatchNewtabDeleteToastView,
  registerNewtabDeleteToastActions
} from './newtab-delete-toast-store.js'
import {
  dispatchNewtabBookmarkAddMenuClosing,
  dispatchNewtabBookmarkAddMenuView,
  dispatchNewtabBookmarkEditMenuClosing,
  dispatchNewtabBookmarkEditMenuView,
  dispatchNewtabBookmarkFolderMenuClosing,
  dispatchNewtabBookmarkFolderMenuView
} from './newtab-bookmark-menu-store.js'
import {
  registerNewtabBookmarkEventActions,
  type BookmarkChangeInfo,
  type BookmarkMoveInfo,
  type BookmarkRemoveInfo
} from './newtab-bookmark-events-store.js'
import {
  registerNewtabIconSettingsActions,
  type NewtabIconSettingsFieldKey
} from './newtab-icon-preview-store.js'
import {
  createNewtabSearchSettingsView,
  dispatchNewtabSearchSettingsView,
  registerNewtabSearchSettingsActions,
  type NewtabSearchSettingsFieldKey,
  type NewtabSearchSettingsToggleKey
} from './newtab-search-settings-store.js'
import {
  createNewtabBackgroundSettingsView,
  dispatchNewtabBackgroundSettingsView,
  registerNewtabBackgroundSettingsActions,
  type NewtabBackgroundSettingsFieldKey
} from './newtab-background-settings-store.js'
import { normalizeNewtabBackgroundType } from './newtab-background-types.js'
import {
  DEFAULT_WALLPAPER_ADJUSTMENTS,
  getEffectiveWallpaperAdjustments,
  haveSameWallpaperSource,
  normalizeWallpaperMaskStyle,
  readWallpaperAdjustments,
  toWallpaperAdjustmentFields,
  WALLPAPER_MASK_PRESETS
} from './wallpaper-adjustments.js'
import { DEFAULT_TEXTURE_SETTINGS, TEXTURE_BACKGROUND_COLOR, isProceduralBackgroundType, normalizeTextureSettings } from './texture-settings.js'
import { syncTextureBackground } from './texture-background.js'
import {
  dispatchNewtabBackgroundMediaView,
  getNewtabBackgroundMediaView
} from './newtab-background-media-store.js'
import {
  dispatchNewtabInstantWallpaperView,
  getNewtabInstantWallpaperView
} from './newtab-instant-wallpaper-store.js'
import {
  createOptimizedBackgroundImageBlob,
  waitForBackgroundVideoSourceReady
} from './background-media-capabilities.js'
import { dispatchNewtabDragUiView } from './newtab-drag-ui-store.js'
import {
  dispatchBookmarkDragGhostView,
  dispatchFolderDragGhostView,
  dispatchSpeedDialDragGhostView,
  patchBookmarkDragGhostView,
  patchFolderDragGhostView,
  patchSpeedDialDragGhostView,
} from './newtab-drag-layer-store.js'
const FAVICON_SIZE = 64
const BOOKMARK_DRAG_LONG_PRESS_MS = 320
const FOLDER_DRAG_LONG_PRESS_MS = BOOKMARK_DRAG_LONG_PRESS_MS
const POINTER_DRAG_START_THRESHOLD_PX = 6
const TOUCH_DRAG_CANCEL_THRESHOLD_PX = 10
const SETTINGS_SAVE_DEBOUNCE_MS = 260
const EAGER_FAVICON_LIMIT = 12
const HIGH_PRIORITY_FAVICON_LIMIT = 6
const BACKGROUND_MEDIA_DB_NAME = 'curatorNewTabBackgroundMedia'
const BACKGROUND_MEDIA_STORE = 'media'
const BACKGROUND_URL_CACHE_KEY = 'urlImage'
const BACKGROUND_URL_CACHE_KEY_PREFIX = `${BACKGROUND_URL_CACHE_KEY}:`
const BACKGROUND_IMAGE_READY_TIMEOUT_MS = 2200
const BACKGROUND_STARTUP_CACHE_IDLE_DELAY_MS = 2400

type DragStartPointerEvent = Pick<
  PointerEvent,
  'button' | 'clientX' | 'clientY' | 'pointerId' | 'pointerType'
>
const INSTANT_WALLPAPER_STARTUP_CACHE_ATTEMPTS = [
  { maxDimension: 960, quality: 0.68 },
  { maxDimension: 720, quality: 0.62 },
  { maxDimension: 520, quality: 0.56 },
  { maxDimension: 360, quality: 0.5 }
] as const
const DEFAULT_BACKGROUND_SETTINGS = {
  ...DEFAULT_TEXTURE_SETTINGS,
  type: 'color',
  color: '#101013',
  imageName: '',
  videoName: '',
  url: '',
  ...toWallpaperAdjustmentFields(DEFAULT_WALLPAPER_ADJUSTMENTS)
}
const DEFAULT_SEARCH_SETTINGS = {
  enabled: true,
  webSearchEnabled: true,
  openInNewTab: false,
  placeholder: '搜索书签、网页，或输入 / 执行命令',
  naturalSearchEnabled: false,
  naturalSearchAiConfigured: false,
  ...DEFAULT_SEARCH_LAYOUT,
  background: 30
}
const SEARCH_OFFSET_BOUNDS_FALLBACK: AdaptiveSearchOffsetBounds = { min: -32, max: 72 }
const SEARCH_OFFSET_ABSOLUTE_MIN = -240
const SEARCH_OFFSET_ABSOLUTE_MAX = 240
const AUTO_SEARCH_OFFSET_CACHE_KEY = 'curatorNewTabAutoSearchOffsetY'
const AUTO_SEARCH_LAYOUT_STABLE_FRAME_COUNT = 0
const AUTO_SEARCH_LAYOUT_PENDING_ATTRIBUTE = 'data-newtab-search-layout-pending'
const SEARCH_WIDTH_BOUNDS_FALLBACK = { min: SEARCH_WIDTH_MIN_VW, max: SEARCH_WIDTH_MAX_VW }
const NEWTAB_LAYOUT_SAFE_GAP = 12
const NEWTAB_COMMAND_SCORE = -100000
const NEWTAB_COMMAND_SUGGESTION_LIMIT = 4

interface NewTabCommandSuggestion {
  id: string
  title: string
  subtitle: string
  keywords: string[]
  run: () => void | Promise<void>
}

type NewTabCommandSearchSuggestion = {
  suggestionType: 'command'
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  score: number
  order: number
  command: NewTabCommandSuggestion
}

type NewTabSearchSuggestion =
  | (SearchBookmarkSuggestion & { suggestionType?: 'bookmark' })
  | NewTabCommandSearchSuggestion

const SEARCH_SUGGESTION_LIMIT = 6
const SEARCH_SUGGESTION_CACHE_LIMIT = 24
const SEARCH_SUGGESTION_CACHE_TTL_MS = 2 * 60 * 1000

async function moveBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').moveBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').moveBookmark> {
  const { moveBookmark } = await import('../shared/bookmarks-api.js')
  return moveBookmark(...args)
}

async function updateBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').updateBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').updateBookmark> {
  const { updateBookmark } = await import('../shared/bookmarks-api.js')
  return updateBookmark(...args)
}

async function createBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').createBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').createBookmark> {
  const { createBookmark } = await import('../shared/bookmarks-api.js')
  return createBookmark(...args)
}

async function deleteBookmarkToRecycleLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').deleteBookmarkToRecycle>
): ReturnType<typeof import('../shared/recycle-bin.js').deleteBookmarkToRecycle> {
  const { deleteBookmarkToRecycle } = await import('../shared/recycle-bin.js')
  return deleteBookmarkToRecycle(...args)
}

async function restoreBookmarkFromRecycleEntryLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').restoreBookmarkFromRecycleEntry>
): ReturnType<typeof import('../shared/recycle-bin.js').restoreBookmarkFromRecycleEntry> {
  const { restoreBookmarkFromRecycleEntry } = await import('../shared/recycle-bin.js')
  return restoreBookmarkFromRecycleEntry(...args)
}

async function deleteFolderTreeToRecycleLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').deleteFolderTreeToRecycle>
): ReturnType<typeof import('../shared/recycle-bin.js').deleteFolderTreeToRecycle> {
  const { deleteFolderTreeToRecycle } = await import('../shared/recycle-bin.js')
  return deleteFolderTreeToRecycle(...args)
}

async function restoreFolderTreeFromUndoLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').restoreFolderTreeFromUndo>
): ReturnType<typeof import('../shared/recycle-bin.js').restoreFolderTreeFromUndo> {
  const { restoreFolderTreeFromUndo } = await import('../shared/recycle-bin.js')
  return restoreFolderTreeFromUndo(...args)
}

const BOOKMARK_TILE_INITIAL_RENDER_LIMIT = 72
const BOOKMARK_TILE_RENDER_CHUNK_SIZE = 48
const BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS = 320
const QUICK_ACCESS_ITEM_LIMIT = 6
const ACTIVITY_RECORD_LIMIT = 160
const DEFAULT_GENERAL_SETTINGS = {
  hideSettingsTrigger: false,
  showQuickAccess: true,
  showSourceNavigation: false,
  openBookmarksInNewTab: false
}

interface NewTabFolderSection {
  id: string
  sourceId: string
  title: string
  path: string
  node: chrome.bookmarks.BookmarkTreeNode
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  directBookmarkCount: number
  totalBookmarkCount: number
}

interface NewTabActivityRecord {
  bookmarkId: string
  title: string
  url: string
  openCount: number
  firstOpenedAt: number
  lastOpenedAt: number
}

interface NewTabActivityState {
  pinnedIds: string[]
  records: Record<string, NewTabActivityRecord>
}

type NewTabActivityRepositoryModule = typeof import('../shared/repositories/activity-repository.js')

type MenuActionIcon = BookmarkMenuActionIcon
type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'

interface LastDeletedBookmarkState {
  bookmark: chrome.bookmarks.BookmarkTreeNode
  recycleId: string
  deletedAt: number
  customIcon?: string
}

type NewTabUndoActionState =
  | ({ kind: 'delete-bookmark' } & LastDeletedBookmarkState)
  | {
      kind: 'delete-folder'
      folderTitle: string
      undoEntry: import('../shared/recycle-bin.js').DeletedFolderBlueprint
      deletedAt: number
    }
  | {
      kind: 'move-bookmark'
      bookmarkId: string
      bookmarkLabel: string
      fromParentId: string
      fromIndex: number
      toFolderTitle: string
    }
  | {
      kind: 'edit-bookmark'
      bookmarkId: string
      bookmarkLabel: string
      previousTitle: string
      previousUrl: string
    }
  | {
      kind: 'rename-folder'
      folderId: string
      previousTitle: string
      nextTitle: string
    }
  | {
      kind: 'move-folder'
      folderId: string
      folderTitle: string
      fromParentId: string
      fromIndex: number
      toFolderTitle: string
    }
  | {
      kind: 'sort-folder'
      folderId: string
      folderTitle: string
      sortLabel: string
      previousDirectBookmarkIds: string[]
    }

interface BackgroundDisplayCss {
  backgroundSize: string
  backgroundPosition: string
}

const state = {
  loading: true,
  creatingFolder: false,
  error: '',
  rootNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderData: null as ExtractedBookmarkData | null,
  bookmarkCatalog: null as BookmarkCatalogSnapshot | null,
  bookmarkTagIndex: null as BookmarkTagIndex | null,
  searchSnapshotIndex: null as ContentSnapshotIndex | null,
  searchSnapshotSettings: null as ContentSnapshotSettings | null,
  folderNodeMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  folderNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderSections: [] as NewTabFolderSection[],
  bookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
  bookmarkMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  allBookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
  allBookmarkMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  searchIndex: [] as NewTabSearchIndexEntry[],
  preparedSearchIndex: prepareNewTabSearchIndex([]) as NewTabPreparedSearchIndex,
  searchIndexReady: false,
  searchIndexReadyPromise: Promise.resolve() as Promise<void>,
  naturalSearchPending: false,
  naturalSearchError: '',
  naturalSearchPlan: null as NaturalSearchPlan | null,
  naturalSearchPlanCache: new Map<string, NaturalSearchPlan>(),
  naturalSearchAbortController: null as AbortController | null,
  activeMenuBookmarkId: '',
  menuX: 0,
  menuY: 0,
  editTitle: '',
  editUrl: '',
  menuBusy: false,
  menuError: '',
  menuStatus: '',
  editIconMode: 'website',
  pendingCustomIconDataUrl: '',
  lastUndoAction: null as NewTabUndoActionState | null,
  deleteToastStatus: '',
  deleteToastTitle: '',
  deleteToastTone: 'success' as 'success' | 'error',
  deleteToastBusy: false,
  addMenuOpen: false,
  addMenuExpanded: false,
  addMenuMode: 'collapsed' as 'collapsed' | 'bookmark' | 'folder',
  addFolderId: '',
  addMenuX: 0,
  addMenuY: 0,
  addTitle: '',
  addUrl: '',
  addFolderTitle: '',
  addMenuBusy: false,
  addMenuError: '',
  activeMenuFolderId: '',
  folderMenuX: 0,
  folderMenuY: 0,
  folderMenuTitle: '',
  folderMenuSubfolderExpanded: false,
  folderMenuSubfolderTitle: '',
  folderMenuDeleteArmed: false,
  folderMenuBusy: false,
  folderMenuError: '',
  folderMenuStatus: '',
  customIcons: {} as Record<string, string>,
  backgroundUrlCacheBusy: false,
  backgroundUrlCacheStatus: '',
  backgroundUrlCachePendingUrls: new Set<string>(),
  backgroundStatus: '',
  backgroundStatusTone: 'info' as 'info' | 'success' | 'warning' | 'error',
  draggingBookmarkId: '',
  dragPointerId: 0,
  dragLongPressTimer: 0,
  dragClientX: 0,
  dragClientY: 0,
  dragStartX: 0,
  dragStartY: 0,
  dragPointerType: '',
  dragOffsetX: 0,
  dragOffsetY: 0,
  draggingBookmarkFolderId: '',
  dragOriginalOrderIds: [] as string[],
  dragPendingInsertIndex: -1,
  dragSuppressClick: false,
  speedDialDraggingBookmarkId: '',
  speedDialDragPointerId: 0,
  speedDialDragLongPressTimer: 0,
  speedDialDragClientX: 0,
  speedDialDragClientY: 0,
  speedDialDragStartX: 0,
  speedDialDragStartY: 0,
  speedDialDragPointerType: '',
  speedDialDragOffsetX: 0,
  speedDialDragOffsetY: 0,
  speedDialDragOriginalOrderIds: [] as string[],
  speedDialDragPendingInsertIndex: -1,
  speedDialDragSuppressClick: false,
  reorderingSpeedDial: false,
  speedDialReorderError: '',
  draggingFolderId: '',
  folderDragPointerId: 0,
  folderDragLongPressTimer: 0,
  folderDragClientX: 0,
  folderDragClientY: 0,
  folderDragStartX: 0,
  folderDragStartY: 0,
  folderDragPointerType: '',
  folderDragOffsetX: 0,
  folderDragOffsetY: 0,
  folderDragOriginalOrderIds: [] as string[],
  folderDragOriginalSections: [] as NewTabFolderSection[],
  folderDragSuppressClick: false,
  reorderingBookmarks: false,
  selfBookmarkMoveIds: new Set<string>(),
  selfBookmarkMoveSuppressUntil: 0,
  bookmarkReorderError: '',
  folderReorderStatus: '',
  folderReorderStatusTone: 'success' as 'success' | 'error',
  backgroundSettings: { ...DEFAULT_BACKGROUND_SETTINGS },
  searchSettings: { ...DEFAULT_SEARCH_SETTINGS },
  iconSettings: { ...DEFAULT_ICON_SETTINGS },
  generalSettings: { ...DEFAULT_GENERAL_SETTINGS },
  folderSettings: { ...DEFAULT_FOLDER_SETTINGS } as NewTabFolderSettings,
  moduleSettings: { ...DEFAULT_NEW_TAB_MODULE_SETTINGS } as NewTabModuleSettings,
  workspaceSettings: normalizeNewTabWorkspaceSettings(null) as NewTabWorkspaceSettings,
  utilitySettingsHydrated: false,
  folderCandidateCache: {
    cacheKey: '',
    candidates: []
  } as FolderCandidateCacheState,
  activity: {
    pinnedIds: [],
    records: {}
  } as NewTabActivityState,
  folderCandidatesExpanded: false,
  folderCandidateQuery: '',
  folderCandidateActiveId: '',
  bookmarkNavigationPath: [] as string[],
  settingsSaveState: 'idle' as SettingsSaveState,
  settingsSaveMessage: '',
  activeSettingsGroup: 'source' as SettingsDrawerSection,
  searchOffsetBounds: { ...SEARCH_OFFSET_BOUNDS_FALLBACK } as AdaptiveSearchOffsetBounds,
  searchWidthBounds: { ...SEARCH_WIDTH_BOUNDS_FALLBACK },
  faviconRefreshTokens: new Map<string, number>()
}

const settingsPersistence = createNewtabSettingsPersistence({
  normalize: normalizePersistedNewtabSetting,
  onChange: applySyncedNewtabSetting,
  onError: (error) => {
    console.warn('新标签页待保存设置恢复失败，将在下次打开时重试。', error)
    setSettingsSaveStatus('error', '上次的设置尚未写入，已保留待恢复记录；再次保存或打开新标签页时会重试。')
  }
})

let onboardingCompleted = false

let backgroundApplyToken = 0
let backgroundUploadVersion = 0
let backgroundUploadQueue = Promise.resolve()
let activeBackgroundObjectUrl = ''
let lastAppliedBackgroundMediaSignature = ''
let bookmarkDragGhostFrame = 0
let bookmarkDropCommitFrame = 0
let speedDialDragGhostFrame = 0
let folderDragGhostFrame = 0
let bookmarkDragGeneration = 0
let speedDialDragGeneration = 0
let folderDragGeneration = 0
let folderDragSectionRectSnapshot: FolderDragSectionRectSnapshot | null = null
let resizeLayoutFrame = 0
let verticalCenterCollisionFrame = 0
let autoSearchLayoutRevealFrame = 0
let lastMeasuredSearchSlot: HTMLElement | null = null
let verticalCenterContentSettleFrame = 0
let settledVerticalCenterContent: HTMLElement | null = null
let deferredRenderFrame = 0
let autoSearchLayoutStableFrames = 0
let autoSearchLayoutStableKey = ''
let lastIconPreviewKey = ''
let searchSettingsSaveTimer = 0
let searchSettingsSettleTimer = 0
let iconSettingsSaveTimer = 0
let settingsSaveStatusTimer = 0
let folderReorderStatusTimer = 0
let bookmarkChangeRefreshTimer = 0
let bookmarkChangeRefreshInFlight = false
let bookmarkChangeRefreshQueued = false
let bookmarkTreeEventVersion = 0
let backgroundStartupCacheTimer = 0
let backgroundStartupCacheRequestId = 0
let backgroundUrlCacheTaskByUrl = new Map<string, BackgroundUrlCacheTask>()
let preloadedBackgroundSettings: typeof DEFAULT_BACKGROUND_SETTINGS | null = null
let backgroundSettingsHydrated = false
let backgroundSettingsMutationVersion = 0
let backgroundMediaMutationVersion = 0
let backgroundUiAppliedFromPreload = false
let bookmarkDragSlotRects = new Map<string, DOMRect>()
let bookmarkDragSlotOrderIds: string[] = []
let speedDialDragSlotRects = new Map<string, DOMRect>()
let speedDialDragSlotOrderIds: string[] = []
let newTabDomContentLoadedRecorded = false
let newTabSkeletonRenderRecorded = false
let newTabFirstRenderRecorded = false
let newTabBackgroundReadyRecorded = false
let newTabRefreshVersion = 0
let searchIndexBuildVersion = 0
let searchWidgetGeneration = 0
let dismissedSearchQuery: string | null = null
let searchIndexRebuildScheduled = false
let lastBuiltSearchIndexCatalogVersion = ''
let resolveSearchIndexReady: () => void = () => {}
let searchIndexReadyPromise: Promise<void> = createSearchIndexReadyPromise()
let lastRenderedContentKey = ''
let unregisterNewtabContentShellActions: () => void = () => {}
let unregisterNewtabContentLayoutNodes: () => void = () => {}
let unregisterNewtabKeyboardActions: () => void = () => {}
let unregisterNewtabLifecycleActions: () => void = () => {}
let unregisterNewtabSettingsDrawerNodes: () => void = () => {}
let unregisterNewtabWindowActions: () => void = () => {}
let unregisterNewtabBookmarkEventActions: () => void = () => {}

function refreshBookmarkCatalog(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null = state.rootNode,
  extracted: ExtractedBookmarkData | null = null
): BookmarkCatalogSnapshot {
  const snapshot = buildBookmarkCatalogSnapshot({
    rootNode,
    extracted,
    tagIndex: state.bookmarkTagIndex,
    snapshotState: {
      settings: null,
      index: state.searchSnapshotIndex
    }
  })
  state.bookmarkCatalog = snapshot
  state.folderData = snapshot.extracted
  return snapshot
}

function getBookmarkCatalog(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null = state.rootNode
): BookmarkCatalogSnapshot {
  if (state.bookmarkCatalog && state.rootNode === rootNode) {
    return state.bookmarkCatalog
  }
  return refreshBookmarkCatalog(rootNode)
}
let lastRenderedShellKey = ''
state.searchIndexReadyPromise = searchIndexReadyPromise

interface BackgroundUrlCacheTask {
  startupBlob: Promise<Blob>
  durableBlob: Promise<Blob>
}

let newTabControllerStarted = false
let newTabControllerGeneration = 0
let bookmarkMenuSession = 0
let bookmarkCopyFeedback = IDLE_ACTION_FEEDBACK
let bookmarkMenuReturnFocus: HTMLElement | null = null
let addBookmarkMenuSession = 0
let folderMenuSession = 0
let folderMenuReturnFocus: HTMLElement | null = null
let undoToastAutoDismissTimer = 0
let newTabStorageEventsBound = false
let newTabNaturalSearchSettingsGeneration = 0
let newTabNaturalSearchToggleVersion = 0
let newTabMetadataRefreshTimer: ReturnType<typeof setTimeout> | undefined
let newTabActivityWriteQueue = Promise.resolve()
let newTabRefreshStorageChanges: Record<string, unknown> | null = null
const newTabHydrationStorageKeys = new Set<string>([
  ...NEWTAB_SYNCED_SETTING_KEYS,
  STORAGE_KEYS.newTabWorkspaceSettings,
  STORAGE_KEYS.onboardingState
])
let refreshNewTabSearchSuggestionsAfterAiSettingsChange: (() => void) | null = null

export function startNewTabController(): void {
  if (newTabControllerStarted) {
    return
  }
  newTabControllerStarted = true
  settingsPersistence.resume()
  newTabControllerGeneration += 1

  recordNewTabDomContentLoaded()
  bindEvents()
  bindNewTabStorageEvents()
  activeFaviconResolutionUnsubscribe = subscribeActiveFaviconResolution((origin, src) => {
    if (!newTabControllerStarted) return
    applyResolvedActiveFavicon(origin, src)
  })
  bindBookmarkEvents()
  void refreshNewTab()
}

function bindNewTabStorageEvents(): void {
  if (newTabStorageEventsBound || !chrome.storage?.onChanged) {
    return
  }
  chrome.storage.onChanged.addListener(handleNewTabStorageChanged)
  newTabStorageEventsBound = true
}

let customIconLoadVersion = 0
let activeFaviconResolutionUnsubscribe: (() => void) | null = null
let newTabSearchHydrationVersion = 0
function handleNewTabStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName === 'local' && newTabRefreshStorageChanges) {
    for (const [key, change] of Object.entries(changes)) {
      if (newTabHydrationStorageKeys.has(key)) newTabRefreshStorageChanges[key] = change.newValue
    }
  }
  settingsPersistence.handleStorageChanges(changes, areaName)
  if (areaName === 'local' && [STORAGE_KEYS.bookmarkTagIndex, STORAGE_KEYS.newTabActivity,
    STORAGE_KEYS.contentSnapshotSettings, STORAGE_KEYS.contentSnapshotIndex].some(key => changes[key])) {
    newTabSearchHydrationVersion += 1
    clearTimeout(newTabMetadataRefreshTimer)
    newTabMetadataRefreshTimer = setTimeout(() => {
      newTabMetadataRefreshTimer = undefined
      if (newTabControllerStarted) void hydrateNewTabSearchAndTags()
    }, 100)
  }
  if (areaName === 'local' && changes[STORAGE_KEYS.newTabCustomIcons]) {
    const version = ++customIconLoadVersion
    void resolveCustomIcons(changes[STORAGE_KEYS.newTabCustomIcons].newValue).then(icons => {
      if (version !== customIconLoadVersion || !newTabControllerStarted) return
      state.customIcons = icons
      if (!state.loading) render()
    }).catch(error => console.warn('新标签页自定义图标同步失败。', error))
  }
  if (areaName === 'local' && changes[STORAGE_KEYS.newTabWorkspaceSettings]) {
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(changes[STORAGE_KEYS.newTabWorkspaceSettings].newValue)
    if (!state.speedDialDraggingBookmarkId && !state.reorderingSpeedDial) refreshSpeedDialPanel()
  }
  if (areaName !== 'local' || !changes[STORAGE_KEYS.aiProviderSettings]) {
    return
  }
  newTabNaturalSearchSettingsGeneration += 1
  abortNewTabNaturalSearchRequest()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlanCache.clear()
  state.naturalSearchPlan = null
  state.naturalSearchError = ''
  refreshNewTabSearchSuggestionsAfterAiSettingsChange?.()
}

function normalizePersistedNewtabSetting(key: string, value: unknown): Record<string, unknown> {
  switch (key) {
    case STORAGE_KEYS.newTabSearchSettings: {
      const { naturalSearchAiConfigured: _configured, ...settings } = normalizeSearchSettings(value)
      return settings
    }
    case STORAGE_KEYS.newTabIconSettings: return { ...normalizeIconSettings(value) }
    case STORAGE_KEYS.newTabGeneralSettings: return { ...normalizeGeneralSettings(value) }
    case STORAGE_KEYS.newTabFolderSettings: return { ...normalizeFolderSettingsWithDefault(value, state.rootNode) }
    case STORAGE_KEYS.newTabBackgroundSettings: return { ...normalizeBackgroundSettings(value) }
    case STORAGE_KEYS.newTabModuleSettings: return { ...normalizeNewTabModuleSettings(value) }
    default: return {}
  }
}

function applySyncedNewtabSetting(key: string, value: Record<string, unknown>): void {
  switch (key) {
    case STORAGE_KEYS.newTabSearchSettings:
      newTabNaturalSearchToggleVersion += 1
      state.searchSettings = normalizeSearchSettings({
        ...value,
        naturalSearchAiConfigured: state.searchSettings.naturalSearchAiConfigured
      })
      applySearchSettingsLive()
      syncSearchSettingsControls()
      scheduleRender()
      break
    case STORAGE_KEYS.newTabIconSettings:
      state.iconSettings = normalizeIconSettings(value)
      applyIconSettingsLive()
      syncIconSettingsControls()
      break
    case STORAGE_KEYS.newTabGeneralSettings:
      state.generalSettings = normalizeGeneralSettings(value)
      syncGeneralSettingsControls()
      scheduleRender()
      break
    case STORAGE_KEYS.newTabFolderSettings:
      state.folderSettings = normalizeFolderSettingsWithDefault(value, state.rootNode)
      state.folderSections = buildNewTabFolderSections(state.rootNode, state.folderSettings)
      refreshDerivedBookmarkState()
      syncFolderSettingsControls()
      scheduleRender()
      break
    case STORAGE_KEYS.newTabBackgroundSettings: {
      const previousSettings = state.backgroundSettings
      backgroundSettingsMutationVersion += 1
      state.backgroundSettings = normalizeBackgroundSettings(value)
      preloadedBackgroundSettings = state.backgroundSettings
      if (haveSameWallpaperSource(previousSettings, state.backgroundSettings)) {
        saveWallpaperAdjustmentsSnapshot(getEffectiveWallpaperAdjustments(state.backgroundSettings))
        dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
        break
      }
      backgroundMediaMutationVersion += 1
      syncInstantWallpaperTargetForSettings(state.backgroundSettings)
      syncBackgroundSettingsControls()
      runBackgroundTask(applyBackgroundSettings(), '背景应用失败')
      break
    }
    case STORAGE_KEYS.newTabModuleSettings:
      state.moduleSettings = normalizeNewTabModuleSettings(value)
      syncModuleSettingsControls()
      scheduleRender()
  }
}

function createSearchIndexReadyPromise(): Promise<void> {
  return new Promise<void>((resolve) => {
    resolveSearchIndexReady = resolve
  })
}

function resetSearchIndexReadyState(): void {
  searchIndexBuildVersion += 1
  searchIndexRebuildScheduled = false
  resolveSearchIndexReady()
  state.searchIndexReady = false
  searchIndexReadyPromise = createSearchIndexReadyPromise()
  state.searchIndexReadyPromise = searchIndexReadyPromise
}

function markSearchIndexDirty({ schedule = true, force = false } = {}): void {
  state.bookmarkCatalog = null
  if (force) lastBuiltSearchIndexCatalogVersion = ''
  resetSearchIndexReadyState()
  if (schedule) {
    scheduleNewTabSearchIndexRebuild()
  }
}

function scheduleNewTabSearchIndexRebuild(): void {
  if (state.searchIndexReady) {
    return
  }
  if (searchIndexRebuildScheduled) {
    return
  }

  searchIndexRebuildScheduled = true
  const version = searchIndexBuildVersion
  runIdle(() => {
    if (version !== searchIndexBuildVersion || !newTabControllerStarted) {
      return
    }
    searchIndexRebuildScheduled = false

    rebuildNewTabSearchIndex()
  })
}

function recordNewTabDomContentLoaded(): void {
  if (newTabDomContentLoadedRecorded) {
    return
  }

  newTabDomContentLoadedRecorded = true
  if (!performance.getEntriesByName('newtab.domContentLoaded', 'mark').length) {
    perfMark('newtab.domContentLoaded')
  }
}

function recordNewTabSkeletonRendered(): void {
  if (newTabSkeletonRenderRecorded) {
    return
  }

  newTabSkeletonRenderRecorded = true
  perfMark('newtab.skeletonRendered')
  perfMeasure('newtab.skeletonMs', 'newtab.domContentLoaded', 'newtab.skeletonRendered')
}

function recordNewTabFirstBookmarksRendered(): void {
  if (newTabFirstRenderRecorded) {
    return
  }

  newTabFirstRenderRecorded = true
  perfMark('newtab.firstBookmarksRendered')
  perfMeasure('newtab.firstBookmarksMs', 'newtab.domContentLoaded', 'newtab.firstBookmarksRendered')
  perfMeasure('newtab.totalInteractive', 'newtab.domContentLoaded', 'newtab.firstBookmarksRendered')
}

function recordNewTabBackgroundReady(): void {
  if (newTabBackgroundReadyRecorded) {
    return
  }

  newTabBackgroundReadyRecorded = true
  perfMark('newtab.backgroundReady')
  perfMeasure('newtab.backgroundReadyMs', 'newtab.domContentLoaded', 'newtab.backgroundReady')
}

function bindEvents(): void {
  registerNewtabSettingsDrawerActions({
    onActiveGroupChange: (group) => {
      setActiveSettingsGroup(group)
    },
    onOpenChange: (open) => {
      if (!open && isSettingsDrawerOpen()) {
        closeSettingsDrawer()
      }
    },
    onReady: initializeSettingsDrawer,
    onToggleRequest: () => {
      openSettingsDrawer()
    }
  })
  registerNewtabDeleteToastActions({
    onOpenRecycle: openRecycleBin,
    onUndo: () => {
      void undoLastDeletedBookmark()
    }
  })
  registerNewtabModuleSettingsActions({
    onToggle: handleModuleSettingToggle
  })
  registerNewtabFolderSourceActions({
    onCandidateFocus: handleFolderCandidateFocus,
    onCandidateKeyDown: handleFolderCandidateListKeydown,
    onCandidateSearchKeyDown: handleFolderCandidateSearchKeydown,
    onCandidateSelect: handleFolderCandidateSelect,
    onCandidateQueryChange: handleFolderCandidateSearch,
    onFolderHideNamesToggle: handleFolderHideNamesToggle,
    onBrowseModeChange: handleBookmarkBrowseModeChange,
    onGeneralToggle: handleGeneralSettingToggle,
    onRemoveSelected: handleSelectedFolderRemove,
    onToggleCandidates: toggleFolderCandidates
  })
  registerNewtabIconSettingsActions({
    onFieldChange: handleIconSettingFieldChange,
    onPresetApply: applyIconPreset,
    onResetDefaults: resetIconSettingsToDefaults,
    onShowTitlesToggle: handleIconShowTitlesToggle,
    onVerticalCenterToggle: handleIconVerticalCenterToggle
  })
  registerNewtabSearchSettingsActions({
    onFieldChange: handleSearchSettingFieldChange,
    onFieldCommit: flushSearchSettingsSave,
    onResetLayout: () => {
      commitSearchSettings(resetSearchLayout(state.searchSettings), { live: true })
      scheduleSearchSettingsSettle()
    },
    onToggle: handleSearchSettingToggle
  })
  registerNewtabBackgroundSettingsActions({
    onFileSelect: (mediaType, file) => {
      void handleBackgroundFileChange(mediaType, file)
    },
    onFieldChange: handleBackgroundSettingFieldChange,
    onUrlCommit: () => {
      void handleBackgroundUrlCommit()
    }
  })
  unregisterNewtabContentShellActions()
  unregisterNewtabContentShellActions = registerNewtabContentShellActions({
    onContextMenu: handleNewtabShellContextMenu,
    onPointerDownCapture: handleNewtabShellPointerDownCapture
  })
  unregisterNewtabContentLayoutNodes()
  unregisterNewtabContentLayoutNodes = subscribeNewtabContentLayoutNodes(handleNewtabContentLayoutNodesChange)
  unregisterNewtabKeyboardActions()
  unregisterNewtabKeyboardActions = registerNewtabKeyboardActions({
    onDocumentKeyDown: handleDocumentKeydown
  })
  unregisterNewtabLifecycleActions()
  unregisterNewtabLifecycleActions = registerNewtabLifecycleActions({
    onPageHide: cleanupNewTabController,
    onVisibilityChange: () => {}
  })
  unregisterNewtabWindowActions()
  unregisterNewtabWindowActions = registerNewtabWindowActions({
    onPointerCancel: handleNewtabWindowPointerCancel,
    onPointerMove: handleNewTabPointerMove,
    onPointerUp: handleNewtabWindowPointerUp,
    onResize: handleNewtabWindowResize
  })
  syncDragWindowListeners()
  unregisterNewtabSettingsDrawerNodes()
  unregisterNewtabSettingsDrawerNodes = subscribeNewtabSettingsDrawerNodes(handleSettingsDrawerNodesChange)
  initializeSettingsDrawer()
}

function bindBookmarkEvents(): void {
  unregisterNewtabBookmarkEventActions()
  unregisterNewtabBookmarkEventActions = registerNewtabBookmarkEventActions({
    onChanged: handleBookmarkChanged,
    onCreated: handleBookmarkCreated,
    onMoved: handleBookmarkMoved,
    onRemoved: handleBookmarkRemoved,
    onChildrenReordered: () => {
      bookmarkTreeEventVersion += 1
      scheduleBookmarkChangeRefresh()
    }
  })
}

function handleNewtabShellContextMenu(event: ReactMouseEvent<HTMLDivElement>): void {
  if (
    state.draggingBookmarkId ||
    state.dragSuppressClick ||
    state.speedDialDraggingBookmarkId ||
    state.speedDialDragSuppressClick ||
    state.draggingFolderId ||
    state.folderDragSuppressClick
  ) {
    event.preventDefault()
    return
  }

  event.preventDefault()
  closeBookmarkMenu({ animate: false })
  openAddBookmarkMenu(event.clientX, event.clientY, getAddBookmarkFolderIdFromContextMenuTarget(event.target))
}

function getAddBookmarkFolderIdFromContextMenuTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) {
    return ''
  }

  const folderElement = target.closest<HTMLElement>(
    '[data-add-bookmark-folder-id],[data-bookmark-grid-folder-id],[data-folder-section-id]'
  )
  if (!folderElement) {
    return ''
  }

  const folderId = String(
    folderElement.dataset.addBookmarkFolderId ||
    folderElement.dataset.bookmarkGridFolderId ||
    folderElement.dataset.folderSectionId ||
    ''
  ).trim()
  return folderId && state.folderNodeMap.has(folderId) ? folderId : ''
}

function handleNewtabShellPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (state.activeMenuBookmarkId || state.addMenuOpen || state.activeMenuFolderId) {
    if (isBookmarkMenuInteractionTarget(target)) {
      return
    }

    closeBookmarkMenu()
    closeAddBookmarkMenu()
    closeFolderMenu()
  }

  if (shouldToggleSearchFocusFromPointerDown(event, target)) {
    const input = getNewtabSearchWidgetNodes().input
    const action = getNewtabBlankPointerAction(Boolean(input && document.activeElement === input))
    window.setTimeout(() => {
      if (action === 'blur') {
        input?.blur()
        return
      }
      focusNewtabSearchInput(input)
    }, 0)
  }
}

function handleNewtabWindowResize(): void {
  closeBookmarkMenu()
  closeAddBookmarkMenu()
  closeFolderMenu()
  cancelSpeedDialDrag()
  cancelBookmarkDrag()
  cancelFolderDrag()
  if (!resizeLayoutFrame) {
    resizeLayoutFrame = window.requestAnimationFrame(() => {
      resizeLayoutFrame = 0
      applyIconSettingsLive()
      // Search bounds depend on the viewport even when no bookmark grid is shown.
      runBatchedAdaptiveLayoutUpdate()
    })
  }
}

let dragWindowListenersBound = false

function hasActiveNewtabDragPointer(): boolean {
  return Boolean(
    state.speedDialDraggingBookmarkId ||
    state.draggingBookmarkId ||
    state.draggingFolderId
  )
}

function syncDragWindowListeners(): void {
  const shouldBind = newTabControllerStarted && hasActiveNewtabDragPointer()
  if (shouldBind === dragWindowListenersBound) return
  dragWindowListenersBound = shouldBind
  if (shouldBind) {
    window.addEventListener('pointermove', handleNewTabPointerMove)
    window.addEventListener('pointerup', handleNewtabWindowPointerUp)
    window.addEventListener('pointercancel', handleNewtabWindowPointerCancel)
    return
  }
  window.removeEventListener('pointermove', handleNewTabPointerMove)
  window.removeEventListener('pointerup', handleNewtabWindowPointerUp)
  window.removeEventListener('pointercancel', handleNewtabWindowPointerCancel)
}

function handleNewtabWindowPointerUp(event: PointerEvent): void {
  void finishSpeedDialDrag(event)
  void finishBookmarkDrag(event)
  void finishFolderDrag(event)
}

function handleNewtabWindowPointerCancel(): void {
  cancelSpeedDialDrag({ keepSuppressClick: true })
  cancelBookmarkDrag({ keepSuppressClick: true })
  cancelFolderDrag({ keepSuppressClick: true })
}

function handleBookmarkContextMenu(
  bookmarkId: string,
  event: ReactMouseEvent<HTMLElement>
): void {
  event.preventDefault()
  event.stopPropagation()
  if (
    state.draggingBookmarkId ||
    state.dragSuppressClick ||
    state.speedDialDraggingBookmarkId ||
    state.speedDialDragSuppressClick ||
    state.draggingFolderId ||
    state.folderDragSuppressClick
  ) {
    return
  }

  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId || !getBookmarkById(normalizedBookmarkId)?.url) {
    return
  }

  closeAddBookmarkMenu({ animate: false })
  openBookmarkMenu(normalizedBookmarkId, event.clientX, event.clientY, event.currentTarget)
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (isSettingsDrawerOpen()) {
      event.preventDefault()
      closeSettingsDrawer()
    }
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    closeFolderMenu()
    cancelFolderDrag()
    return
  }

  const focusIntent = getDocumentSearchFocusIntent(event)
  if (!focusIntent) {
    return
  }

  const input = getNewtabSearchWidgetNodes().input
  if (!input) {
    return
  }

  applyNewtabSearchFocusIntent(input, focusIntent, event)
}

function handleNewtabContentLayoutNodesChange(): void {
  runBatchedAdaptiveLayoutUpdate()
}

function handleSearchWidgetNodesChange(nodes: NewtabSearchWidgetNodes): void {
  if (!nodes.slot) {
    lastMeasuredSearchSlot = null
    return
  }
  // The search widget re-publishes its nodes on every render (focus, typing,
  // suggestion-panel updates). Measuring each time made the auto-centered slot
  // visibly wander; only a genuinely new slot element warrants a re-measure.
  if (nodes.slot === lastMeasuredSearchSlot) {
    return
  }
  lastMeasuredSearchSlot = nodes.slot

  resetAutoSearchLayoutSettle()
  runBatchedAdaptiveLayoutUpdate()
}

function handleSettingsDrawerNodesChange(): void {
  initializeSettingsDrawer()
}

function getDocumentSearchFocusIntent(event: KeyboardEvent): NewtabSearchFocusIntent | null {
  if (!canUseNewtabSearchFocus({
    draggingBookmark: Boolean(state.draggingBookmarkId),
    draggingFolder: Boolean(state.draggingFolderId),
    draggingSpeedDial: Boolean(state.speedDialDraggingBookmarkId),
    editableTarget: isEditableEventTarget(event.target),
    enabled: state.searchSettings.enabled,
    menuOpen: Boolean(
      state.activeMenuBookmarkId ||
      state.addMenuOpen
    ),
    settingsOpen: isSettingsDrawerOpen()
  })) {
    return null
  }

  return getNewtabSearchFocusIntent(event)
}

function applyNewtabSearchFocusIntent(
  input: HTMLInputElement,
  intent: NewtabSearchFocusIntent,
  event: KeyboardEvent
): void {
  focusNewtabSearchInput(input)

  if (intent.type === 'focus') {
    return
  }

  event.preventDefault()

  if (intent.type === 'select') {
    input.select()
    return
  }

  const currentValue = input.value
  const nextValue = getNextNewtabSearchValue(currentValue, intent)

  if (nextValue === currentValue) {
    return
  }

  input.value = nextValue
  input.setSelectionRange(nextValue.length, nextValue.length)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function focusNewtabSearchInput(input = getNewtabSearchWidgetNodes().input): boolean {
  if (!input || !state.searchSettings.enabled) {
    return false
  }

  input.focus({ preventScroll: true })
  return document.activeElement === input
}

function shouldToggleSearchFocusFromPointerDown(
  event: ReactPointerEvent<HTMLDivElement>,
  target: Element
): boolean {
  if (
    event.button !== 0 ||
    !state.searchSettings.enabled ||
    state.draggingBookmarkId ||
    state.draggingFolderId ||
    state.speedDialDraggingBookmarkId ||
    isSettingsDrawerOpen()
  ) {
    return false
  }

  return !target.closest([
    'a',
    'button',
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="combobox"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[data-newtab-bookmark-menu-surface]'
  ].join(','))
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.getAttribute('role') === 'combobox' ||
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true'
}

function bindGeneralSettingsEvents(): void {
}

function bindFolderSettingsEvents(): void {
}

function handleGeneralSettingToggle(key: NewtabGeneralSettingToggleKey, enabled: boolean): void {
  const previousSettings = state.generalSettings
  state.generalSettings = normalizeGeneralSettings({
    ...state.generalSettings,
    [key]: enabled
  })
  void saveGeneralSettings().catch((error) => {
    console.warn('新标签页通用设置保存失败。', error)
  })
  syncGeneralSettingsControls()
  applyGeneralSettings()
  if (
    previousSettings.showQuickAccess !== state.generalSettings.showQuickAccess ||
    previousSettings.showSourceNavigation !== state.generalSettings.showSourceNavigation
  ) {
    scheduleRender()
  }
}

function handleFolderHideNamesToggle(enabled: boolean): void {
  const previousSettings = state.folderSettings
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    hideFolderNames: enabled
  })
  void saveFolderSettings().catch((error) => {
    console.warn('新标签页文件夹设置保存失败。', error)
  })
  syncFolderSettingsControls()
  applyFolderSettings()
  if (previousSettings.hideFolderNames !== state.folderSettings.hideFolderNames) {
    if (!renderBookmarkSections()) {
      render()
    }
    scheduleAdaptiveNewTabLayoutUpdate()
  }
}

function handleBookmarkBrowseModeChange(mode: NewTabBookmarkBrowseMode): void {
  const previousMode = state.folderSettings.browseMode
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    browseMode: mode
  })
  void saveFolderSettings().catch((error) => {
    console.warn('新标签页文件夹设置保存失败。', error)
  })
  syncFolderSettingsControls()
  applyFolderSettings()
  if (previousMode !== state.folderSettings.browseMode) {
    // 切换浏览模式会改变整个视图结构（展开分组 ↔ 导航扁平网格），需整树重渲染。
    // 同步清空 preboot 快照：否则切换后立即刷新会先回放旧模式的快照再被替换（=形变）。
    clearNewtabBookmarkPrebootSnapshot()
    resetBookmarkNavigation()
    if (!renderBookmarkSections()) {
      render()
    }
    scheduleAdaptiveNewTabLayoutUpdate()
  }
}

// 导航模式的当前浏览层级路径栈（folderId 序列，空 = 根来源层）。
// 展开模式不使用它；切换模式或返回根时清空。阶段 4 会充实进入/返回逻辑。
function resetBookmarkNavigation(): void {
  if (state.bookmarkNavigationPath.length) {
    state.bookmarkNavigationPath = []
  }
}

function toggleFolderCandidates(): void {
  state.folderCandidatesExpanded = !state.folderCandidatesExpanded
  syncFolderSettingsControls()
  if (state.folderCandidatesExpanded) {
    requestFolderCandidateSearchFocus()
  }
}

function handleFolderCandidateSearch(query: string): void {
  state.folderCandidateQuery = query
  state.folderCandidateActiveId = ''
  syncFolderSettingsControls()
}

function handleFolderCandidateSearchKeydown(key: string): boolean {
  if (key !== 'ArrowDown' && key !== 'ArrowUp') {
    return false
  }

  const candidates = getFilteredFolderCandidates()
  const targetId = getFolderCandidateFocusTargetId(candidates, key === 'ArrowDown' ? 'first' : 'last')
  if (!targetId) {
    return false
  }

  focusFolderCandidateOptionById(targetId)
  return true
}

function handleFolderCandidateSelect(folderId: string): void {
  if (!folderId) {
    return
  }

  state.folderCandidateActiveId = folderId
  void toggleSelectedFolder(folderId, {
    preserveCandidateScroll: true,
    restoreCandidateFocus: true,
    focusCandidateId: folderId
  })
}

function handleFolderCandidateListKeydown(key: string, folderId: string): boolean {
  if (
    key !== 'ArrowDown' &&
    key !== 'ArrowUp' &&
    key !== 'Home' &&
    key !== 'End' &&
    key !== 'Escape'
  ) {
    return false
  }

  if (key === 'Escape') {
    requestFolderCandidateSearchFocus()
    return true
  }

  const candidates = getFilteredFolderCandidates()
  const targetId = getFolderCandidateFocusTargetId(
    candidates,
    key === 'Home'
      ? 'first'
      : key === 'End'
        ? 'last'
        : key === 'ArrowDown'
          ? 1
          : -1,
    folderId || state.folderCandidateActiveId
  )
  if (targetId) {
    focusFolderCandidateOptionById(targetId)
  }
  return true
}

function focusFolderCandidateOptionById(folderId: string): boolean {
  const id = String(folderId || '').trim()
  if (!id || !getFilteredFolderCandidates().some((candidate) => candidate.id === id)) {
    return false
  }

  state.folderCandidateActiveId = id
  syncFolderSettingsControls()
  dispatchNewtabFolderCandidateFocusRequest({
    folderId: id,
    preventScroll: true,
    target: 'candidate'
  })
  return true
}

function resolveFolderCandidateActiveId(candidates: NewTabFolderCandidate[]): string {
  if (!candidates.length) {
    state.folderCandidateActiveId = ''
    return ''
  }

  const activeId = candidates.some((folder) => folder.id === state.folderCandidateActiveId)
    ? state.folderCandidateActiveId
    : candidates[0]?.id || ''
  state.folderCandidateActiveId = activeId
  return activeId
}

function getFolderCandidateFocusTargetId(
  candidates: NewTabFolderCandidate[],
  direction: 1 | -1 | 'first' | 'last',
  currentFolderId = state.folderCandidateActiveId
): string {
  if (!candidates.length) {
    return ''
  }

  const currentIndex = candidates.findIndex((candidate) => candidate.id === currentFolderId)
  let nextIndex = currentIndex

  if (direction === 'first') {
    nextIndex = 0
  } else if (direction === 'last') {
    nextIndex = candidates.length - 1
  } else if (currentIndex >= 0) {
    nextIndex = (currentIndex + direction + candidates.length) % candidates.length
  } else if (nextIndex < 0) {
    nextIndex = direction > 0 ? 0 : candidates.length - 1
  }

  return candidates[Math.max(0, Math.min(candidates.length - 1, nextIndex))]?.id || ''
}

function handleFolderCandidateFocus(folderId: string): void {
  if (!folderId) {
    return
  }

  state.folderCandidateActiveId = folderId
  syncFolderSettingsControls()
}

function requestFolderCandidateSearchFocus(): void {
  dispatchNewtabFolderCandidateFocusRequest({
    folderId: '',
    preventScroll: true,
    target: 'search'
  })
}

function handleSelectedFolderRemove(folderId: string): void {
  if (!folderId) {
    return
  }

  void removeSelectedFolder(folderId)
}

async function toggleSelectedFolder(
  folderId: string,
  {
    preserveCandidateScroll = false,
    restoreCandidateFocus = false,
    focusCandidateId = ''
  } = {}
): Promise<void> {
  const currentIds = state.folderSettings.selectedFolderIds
  const nextIds = currentIds.includes(folderId)
    ? currentIds.filter((id) => id !== folderId)
    : [...currentIds, folderId]
  await updateSelectedFolders(nextIds, {
    preserveCandidateScroll,
    restoreCandidateFocus,
    focusCandidateId
  })
}

async function removeSelectedFolder(folderId: string): Promise<void> {
  await updateSelectedFolders(
    state.folderSettings.selectedFolderIds.filter((id) => id !== folderId)
  )
}

async function updateSelectedFolders(
  folderIds: string[],
  {
    preserveCandidateScroll = false,
    restoreCandidateFocus = false,
    focusCandidateId = ''
  } = {}
): Promise<void> {
  void preserveCandidateScroll
  const previousSettings = state.folderSettings
  const previousSections = [...state.folderSections]

  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: folderIds
  })
  state.folderSections = buildNewTabFolderSections(state.rootNode, state.folderSettings)
  refreshDerivedBookmarkState()
  markSearchIndexDirty()

  try {
    await saveFolderSettings()
  } catch (error) {
    state.folderSettings = previousSettings
    settingsPersistence.discard(STORAGE_KEYS.newTabFolderSettings, previousSettings)
    state.folderSections = previousSections
    refreshDerivedBookmarkState()
    markSearchIndexDirty()
    render()
    syncFolderSettingsControls()
    applyFolderSettings()
    setSettingsSaveStatus('error', '来源保存失败，已恢复到上次已保存状态')
    console.warn('新标签页来源设置保存失败，已回滚。', error)
    return
  }

  render()
  syncFolderSettingsControls()
  applyFolderSettings()

  if (preserveCandidateScroll || restoreCandidateFocus) {
    if (restoreCandidateFocus) {
      focusFolderCandidateOptionById(focusCandidateId || state.folderCandidateActiveId)
    }
  }
}

function handleIconVerticalCenterToggle(enabled: boolean): void {
  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    verticalCenter: enabled,
    preset: ''
  }))
}

function handleIconShowTitlesToggle(enabled: boolean): void {
  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    showTitles: enabled,
    preset: ''
  }))
}

function handleIconSettingFieldChange(key: NewtabIconSettingsFieldKey, value: number | string): void {
  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    [key]: value,
    preset: ''
  }))
}

function handleSearchSettingToggle(key: NewtabSearchSettingsToggleKey, enabled: boolean): void {
  commitSearchSettings(normalizeSearchSettings({
    ...state.searchSettings,
    [key]: enabled
  }), { render: true })
}

function handleSearchSettingFieldChange(
  key: NewtabSearchSettingsFieldKey,
  value: number | string | string[]
): void {
  const nextSettings = normalizeSearchSettings({
    ...state.searchSettings,
    [key]: value
  })
  const isLiveField = key === 'background' ||
    key === 'height' ||
    key === 'offsetY' ||
    key === 'width'

  commitSearchSettings(nextSettings, isLiveField ? { live: true } : { render: true })
  if (isLiveField) {
    scheduleSearchSettingsSettle()
  }
}

function commitSearchSettings(
  nextSettings: typeof DEFAULT_SEARCH_SETTINGS,
  options: { live?: boolean; render?: boolean; syncControls?: boolean } = {}
): void {
  state.searchSettings = nextSettings
  scheduleSearchSettingsSave()
  if (options.live) {
    applySearchSettingsLive()
  }
  if (options.render) {
    scheduleRender()
  }
  if (options.syncControls !== false) {
    syncSearchSettingsControls()
  }
}

function getRevealedAutoSearchShell(): SearchWidgetShellState | null {
  const shell = getNewtabSearchWidgetView()?.shell
  return shell?.autoVerticalCenter && shell.layoutReady ? shell : null
}

function applySearchSettingsLive(): void {
  const settings = state.searchSettings
  const widthBounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  const offsetBounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  const width = clampNumber(settings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)
  const cachedAutoOffsetY = settings.autoVerticalCenter
    ? readCachedAutoSearchOffsetYValue()
    : null
  // A visible auto-centered search keeps its current offset and slides to the next
  // measurement instead of blinking back into the hidden measurement gate.
  const revealedAutoOffsetY = settings.autoVerticalCenter
    ? getRevealedAutoSearchShell()?.offsetY ?? null
    : null
  const offsetY = settings.autoVerticalCenter
    ? revealedAutoOffsetY ?? cachedAutoOffsetY ?? DEFAULT_SEARCH_SETTINGS.offsetY
    : clampNumber(settings.offsetY, offsetBounds.min, offsetBounds.max, DEFAULT_SEARCH_SETTINGS.offsetY)
  const layoutReady = !settings.autoVerticalCenter ||
    revealedAutoOffsetY !== null ||
    cachedAutoOffsetY !== null

  if (settings.autoVerticalCenter) {
    setAutoSearchLayoutPending(!layoutReady)
    resetAutoSearchLayoutSettle()
    scheduleAdaptiveNewTabLayoutUpdate()
  } else {
    setAutoSearchLayoutPending(false)
  }
  patchSearchWidgetShellState({
    autoVerticalCenter: settings.autoVerticalCenter,
    backgroundAlpha: String(settings.background / 100),
    height: settings.height,
    layoutReady,
    offsetY,
    width
  })
}

function scheduleSearchSettingsSettle(): void {
  window.clearTimeout(searchSettingsSettleTimer)
  searchSettingsSettleTimer = window.setTimeout(() => {
    searchSettingsSettleTimer = 0
    scheduleAdaptiveNewTabLayoutUpdate()
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function handleBackgroundSettingFieldChange(
  key: NewtabBackgroundSettingsFieldKey,
  value: number | string | boolean
): void {
  const previousSettings = state.backgroundSettings
  if (key === 'type') setBackgroundStatus('')
  const preset = key === 'wallpaperStyle' ? WALLPAPER_MASK_PRESETS[normalizeWallpaperMaskStyle(value)] : null
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    ...(preset ? { wallpaperBlur: preset.blur } : {}),
    [key]: value
  })
  commitBackgroundSettings(previousSettings, nextSettings)
}

function commitBackgroundSettings(
  previousSettings: typeof DEFAULT_BACKGROUND_SETTINGS,
  nextSettings: typeof DEFAULT_BACKGROUND_SETTINGS
): void {
  const shouldClearUrlCache = shouldClearBackgroundUrlCache(previousSettings, nextSettings)
  backgroundSettingsHydrated = true
  state.backgroundSettings = nextSettings
  backgroundSettingsMutationVersion += 1
  preloadedBackgroundSettings = nextSettings
  if (haveSameWallpaperSource(previousSettings, nextSettings)) {
    saveWallpaperAdjustmentsSnapshot(getEffectiveWallpaperAdjustments(nextSettings))
    dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
    void saveSettingsWithFeedback({
      [STORAGE_KEYS.newTabBackgroundSettings]: nextSettings
    }).catch(error => {
      console.warn('新标签页背景设置保存失败。', error)
    })
    return
  }
  backgroundMediaMutationVersion += 1
  updateBackgroundStartupCacheStatus(nextSettings)
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(nextSettings))
  syncInstantWallpaperTargetForSettings(nextSettings)
  void saveBackgroundSettings().catch((error) => {
    console.warn('新标签页背景设置保存失败。', error)
  })
  syncBackgroundSettingsControls()
  scheduleCurrentBackgroundStartupCache(nextSettings)
  runBackgroundTask(applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache), '背景应用失败')
}

async function handleBackgroundUrlCommit(): Promise<void> {
  if (state.backgroundSettings.type !== 'urls') {
    return
  }

  const imageUrl = getRemoteBackgroundImageUrl(state.backgroundSettings)
  if (!imageUrl) {
    return
  }

  const session = newTabControllerGeneration
  const version = backgroundMediaMutationVersion
  const permissionGranted = await ensureBackgroundImageFetchPermission(imageUrl, { request: true })
  if (!newTabControllerStarted || session !== newTabControllerGeneration || version !== backgroundMediaMutationVersion) return
  if (!permissionGranted) {
    setBackgroundStatus('未授权该图片域名，首屏缓存可能无法准备。', 'warning')
    syncBackgroundSettingsControls()
    return
  }
  await ensureCurrentBackgroundStartupCache(state.backgroundSettings)
}

async function applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache: boolean): Promise<void> {
  const session = newTabControllerGeneration
  const version = backgroundMediaMutationVersion
  if (shouldClearUrlCache) {
    await clearBackgroundUrlCache()
  }
  if (!newTabControllerStarted || session !== newTabControllerGeneration || version !== backgroundMediaMutationVersion) return
  await applyBackgroundSettings()
}

async function handleBackgroundFileChange(
  mediaType: 'image' | 'video',
  file: File
): Promise<void> {
  const expectedPrefix = mediaType === 'image' ? 'image/' : 'video/'
  if (!file.type.startsWith(expectedPrefix)) {
    setBackgroundStatus(
      mediaType === 'image'
        ? '文件类型不匹配：请选择图片文件（JPG、PNG、WebP 或 GIF）。'
        : '文件类型不匹配：请选择视频文件（MP4、WebM 或 MOV）。',
      'warning'
    )
    syncBackgroundSettingsControls()
    return
  }

  const uploadVersion = ++backgroundUploadVersion
  const session = newTabControllerGeneration
  const previousSettings = state.backgroundSettings
  let expectedSignature = getBackgroundMediaSignature(previousSettings)
  const isCurrent = () => uploadVersion === backgroundUploadVersion && session === newTabControllerGeneration &&
    newTabControllerStarted && expectedSignature === getBackgroundMediaSignature(state.backgroundSettings)
  try {
    setBackgroundStatus('正在保存背景文件...', 'info')
    syncBackgroundSettingsControls()
    const save = backgroundUploadQueue.then(async () => {
      if (isCurrent()) await saveBackgroundMedia(mediaType, file)
    })
    backgroundUploadQueue = save.catch(() => {})
    await save
    if (!isCurrent()) return
    state.backgroundSettings = normalizeBackgroundSettings({
      ...state.backgroundSettings,
      type: mediaType,
      imageName: mediaType === 'image' ? file.name : state.backgroundSettings.imageName,
      videoName: mediaType === 'video' ? file.name : state.backgroundSettings.videoName
    })
    backgroundSettingsHydrated = true
    backgroundSettingsMutationVersion += 1
    backgroundMediaMutationVersion += 1
    preloadedBackgroundSettings = state.backgroundSettings
    expectedSignature = getBackgroundMediaSignature(state.backgroundSettings)
    // Replacing a file with the same name still requires reloading its bytes.
    lastAppliedBackgroundMediaSignature = ''
    await saveBackgroundSettings()
    if (!isCurrent()) return
    await updateInstantWallpaperFromBlob(file, expectedSignature, state.backgroundSettings)
    if (!isCurrent()) return
    if (shouldClearBackgroundUrlCache(previousSettings, state.backgroundSettings)) {
      await clearBackgroundUrlCache()
    }
    if (!isCurrent()) return
    syncBackgroundSettingsControls()
    await applyBackgroundSettings()
    if (!isCurrent()) return
    if (lastAppliedBackgroundMediaSignature !== expectedSignature) return
    setBackgroundStatus(
      mediaType === 'image' ? '背景图片已保存。' : '背景视频已保存。',
      'success'
    )
    syncBackgroundSettingsControls()
  } catch (error) {
    if (!isCurrent()) return
    setBackgroundStatus(getBackgroundMediaSaveErrorMessage(error), 'error')
    syncBackgroundSettingsControls()
  }
}

let settingsDrawerReady = false
let settingsDrawerReadyPromise: Promise<void> | null = null
let resolveSettingsDrawerReady: (() => void) | null = null

function ensureSettingsDrawerReady(): Promise<void> {
  if (settingsDrawerReady) return Promise.resolve()
  requestNewtabSettingsDrawer()
  if (!settingsDrawerReadyPromise) {
    settingsDrawerReadyPromise = new Promise<void>((resolve) => {
      resolveSettingsDrawerReady = resolve
    })
  }
  return settingsDrawerReadyPromise
}

function initializeSettingsDrawer(): void {
  if (settingsDrawerReady) return
  const { drawer } = getNewtabSettingsDrawerNodes()
  if (!drawer) {
    return
  }

  bindGeneralSettingsEvents()
  bindFolderSettingsEvents()
  settingsDrawerReady = true
  resolveSettingsDrawerReady?.()
  syncBackgroundSettingsControls()
  syncSearchSettingsControls()
  syncGeneralSettingsControls()
  syncFolderSettingsControls()
  syncIconSettingsControls()
}

function openSettingsDrawer(options?: { focusFirstControl?: boolean; section?: SettingsDrawerSection }): void {
  if (settingsDrawerReady) {
    runOpenSettingsDrawer(options)
    return
  }
  void ensureSettingsDrawerReady().then(() => {
    runOpenSettingsDrawer(options)
  })
}

function runOpenSettingsDrawer(options?: { focusFirstControl?: boolean; section?: SettingsDrawerSection }): void {
  measureNow('newtab.openSettingsDrawer', () => {
    dispatchNewtabSettingsDrawerOpen(true)
    const focusFirstControl = options?.focusFirstControl !== false
    setActiveSettingsGroup(options?.section || state.activeSettingsGroup || 'source', { scrollToTop: false })
    syncSettingsSaveStatus()
    scheduleAdaptiveNewTabLayoutUpdate()
    if (focusFirstControl) {
      window.requestAnimationFrame(() => {
        dispatchNewtabSettingsDrawerFocusFirstControl()
      })
    }
    if (options?.section) {
      window.requestAnimationFrame(() => {
        dispatchNewtabSettingsDrawerFocusSection(options.section)
      })
    }
  })
}

function openFolderSourceSettings(): void {
  state.folderCandidatesExpanded = true
  state.folderCandidateQuery = ''
  syncFolderSettingsControls()
  openSettingsDrawer({ focusFirstControl: false, section: 'source' })
}

function setActiveSettingsGroup(
  section: SettingsDrawerSection,
  { scrollToTop = true }: { scrollToTop?: boolean } = {}
): void {
  measureNow('newtab.setActiveSettingsGroup', () => {
    const nextSection = normalizeSettingsDrawerSection(section)
    state.activeSettingsGroup = nextSection
    dispatchNewtabSettingsDrawerActiveGroup(nextSection)

    if (scrollToTop) {
      dispatchNewtabSettingsDrawerScrollTop('auto')
    }
  })
}

function closeSettingsDrawer(): void {
  if (!isSettingsDrawerOpen()) {
    return
  }

  dispatchNewtabSettingsDrawerOpen(false)
}

function isSettingsDrawerOpen(): boolean {
  return getNewtabSettingsDrawerView().open
}

function openBookmarkMenu(bookmarkId: string, clientX: number, clientY: number, anchor: HTMLElement): void {
  const bookmark = getBookmarkById(bookmarkId)
  if (!bookmark?.url) {
    return
  }

  closeAddBookmarkMenu({ animate: false })
  closeFolderMenu({ animate: false })
  bookmarkMenuSession += 1
  bookmarkCopyFeedback = IDLE_ACTION_FEEDBACK
  bookmarkMenuReturnFocus = anchor
  state.activeMenuBookmarkId = bookmarkId
  state.menuX = clientX
  state.menuY = clientY
  state.editTitle = String(bookmark.title || '').trim() || String(bookmark.url || '')
  state.editUrl = String(bookmark.url || '').trim()
  state.editIconMode = state.customIcons[bookmarkId] ? 'custom' : 'website'
  state.pendingCustomIconDataUrl = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu()
}

function openAddBookmarkMenu(clientX: number, clientY: number, folderId = ''): void {
  closeBookmarkMenu({ animate: false })
  closeFolderMenu({ animate: false })
  addBookmarkMenuSession += 1
  state.addMenuOpen = true
  state.addMenuExpanded = false
  state.addMenuMode = 'collapsed'
  state.addFolderId = folderId
  state.addMenuX = clientX
  state.addMenuY = clientY
  state.addTitle = ''
  state.addUrl = ''
  state.addFolderTitle = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function openAddBookmarkMenuForElement(anchor: HTMLElement, folderId: string): void {
  const rect = anchor.getBoundingClientRect()
  closeBookmarkMenu({ animate: false })
  closeFolderMenu({ animate: false })
  addBookmarkMenuSession += 1
  state.addMenuOpen = true
  state.addMenuExpanded = true
  state.addMenuMode = 'bookmark'
  state.addFolderId = folderId
  state.addMenuX = rect.right
  state.addMenuY = rect.bottom + 8
  state.addTitle = ''
  state.addUrl = ''
  state.addFolderTitle = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function handleFolderContextMenu(
  folderId: string,
  event: ReactMouseEvent<HTMLElement>
): void {
  event.preventDefault()
  event.stopPropagation()
  if (
    state.reorderingBookmarks ||
    state.draggingBookmarkId ||
    state.draggingFolderId ||
    state.folderDragSuppressClick
  ) {
    return
  }
  const normalizedFolderId = String(folderId || '').trim()
  if (!normalizedFolderId) return
  openFolderMenu(normalizedFolderId, event.clientX, event.clientY, event.currentTarget)
}

function openFolderMenu(folderId: string, clientX: number, clientY: number, anchor: HTMLElement): void {
  const folder = state.folderNodeMap.get(folderId)
  if (!folder || folder.url !== undefined || folder.id === '0') {
    return
  }
  closeBookmarkMenu({ animate: false })
  closeAddBookmarkMenu({ animate: false })
  folderMenuSession += 1
  folderMenuReturnFocus = anchor
  state.activeMenuFolderId = folderId
  state.folderMenuX = clientX
  state.folderMenuY = clientY
  state.folderMenuTitle = String(folder.title || '').trim() || '未命名文件夹'
  state.folderMenuSubfolderExpanded = false
  state.folderMenuSubfolderTitle = ''
  state.folderMenuDeleteArmed = false
  state.folderMenuBusy = false
  state.folderMenuError = ''
  state.folderMenuStatus = ''
  renderFolderMenu()
}

function closeFolderMenu({ animate = true, restoreFocus = false } = {}): void {
  const anchor = folderMenuReturnFocus
  folderMenuReturnFocus = null
  folderMenuSession += 1
  const session = folderMenuSession
  state.activeMenuFolderId = ''
  state.folderMenuSubfolderExpanded = false
  state.folderMenuSubfolderTitle = ''
  state.folderMenuDeleteArmed = false
  state.folderMenuBusy = false
  state.folderMenuError = ''
  state.folderMenuStatus = ''
  if (animate) {
    dispatchNewtabBookmarkFolderMenuClosing()
  } else {
    dispatchNewtabBookmarkFolderMenuView(null)
  }
  if (restoreFocus) {
    window.requestAnimationFrame(() => {
      if (session !== folderMenuSession || state.activeMenuFolderId) return
      if (anchor?.isConnected) {
        anchor.focus({ preventScroll: true })
      }
    })
  }
}

function finalizeFolderMenuClose(): void {
  if (!state.activeMenuFolderId) {
    dispatchNewtabBookmarkFolderMenuView(null)
  }
}

function closeBookmarkMenu({ animate = true, restoreFocus = false } = {}): void {
  const anchor = bookmarkMenuReturnFocus
  const bookmarkId = state.activeMenuBookmarkId
  bookmarkMenuReturnFocus = null
  bookmarkMenuSession += 1
  bookmarkCopyFeedback = IDLE_ACTION_FEEDBACK
  const session = bookmarkMenuSession
  state.activeMenuBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  state.pendingCustomIconDataUrl = ''
  if (animate) {
    dispatchNewtabBookmarkEditMenuClosing()
  } else {
    dispatchNewtabBookmarkEditMenuView(null)
  }
  if (restoreFocus) {
    window.requestAnimationFrame(() => {
      if (session !== bookmarkMenuSession || state.activeMenuBookmarkId) return
      const target = anchor?.isConnected ? anchor : (
        getNewtabBookmarkContentNodes().tiles.get(bookmarkId) ||
        getNewtabSpeedDialNodes().cards.get(bookmarkId) ||
        getNewtabSearchWidgetNodes().input
      )
      target?.focus({ preventScroll: true })
    })
  }
}

function finalizeBookmarkMenuClose(): void {
  if (!state.activeMenuBookmarkId) {
    dispatchNewtabBookmarkEditMenuView(null)
  }
}

function closeAddBookmarkMenu({ animate = true } = {}): void {
  addBookmarkMenuSession += 1
  state.addMenuOpen = false
  state.addMenuExpanded = false
  state.addMenuMode = 'collapsed'
  state.addFolderId = ''
  state.addFolderTitle = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  if (animate) {
    dispatchNewtabBookmarkAddMenuClosing()
  } else {
    dispatchNewtabBookmarkAddMenuView(null)
  }
}

function finalizeAddBookmarkMenuClose(): void {
  if (!state.addMenuOpen) {
    dispatchNewtabBookmarkAddMenuView(null)
  }
}

function startSpeedDialDragFromReact(
  bookmarkId: string,
  card: HTMLElement,
  event: DragStartPointerEvent
): void {
  finishPendingBookmarkDropVisualCommit()
  if (
    state.draggingBookmarkId ||
    state.dragLongPressTimer ||
    state.draggingFolderId ||
    state.folderDragLongPressTimer
  ) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId || !getBookmarkById(normalizedBookmarkId)) {
    return
  }

  cancelSpeedDialDrag({ keepSuppressClick: true })
  state.speedDialDragPointerId = event.pointerId
  state.speedDialDragPointerType = event.pointerType
  state.speedDialDraggingBookmarkId = normalizedBookmarkId
  state.speedDialDragStartX = event.clientX
  state.speedDialDragStartY = event.clientY
  state.speedDialDragClientX = event.clientX
  state.speedDialDragClientY = event.clientY
  const rect = card.getBoundingClientRect()
  state.speedDialDragOffsetX = event.clientX - rect.left
  state.speedDialDragOffsetY = event.clientY - rect.top
  syncDragWindowListeners()
  if (event.pointerType !== 'mouse') {
    dispatchNewtabDragUiView({ speedDialPendingId: normalizedBookmarkId })
    state.speedDialDragLongPressTimer = window.setTimeout(() => {
      beginSpeedDialDrag()
    }, BOOKMARK_DRAG_LONG_PRESS_MS)
  }
}

function handleSpeedDialDragPointerDown(
  bookmarkId: string,
  card: HTMLElement,
  event: ReactPointerEvent<HTMLElement>
): void {
  startSpeedDialDragFromReact(bookmarkId, card, event.nativeEvent)
}

function beginSpeedDialDrag(): void {
  if (!state.speedDialDraggingBookmarkId || !getBookmarkById(state.speedDialDraggingBookmarkId)) {
    cancelSpeedDialDrag()
    return
  }

  const originalOrderIds = getActiveWorkspacePinnedIds()
    .filter((bookmarkId) => Boolean(getBookmarkById(bookmarkId)?.url))
  if (originalOrderIds.length < 2 || !originalOrderIds.includes(state.speedDialDraggingBookmarkId)) {
    cancelSpeedDialDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  state.speedDialDragLongPressTimer = 0
  state.speedDialDragOriginalOrderIds = originalOrderIds
  state.speedDialDragSuppressClick = true
  const sourceCard = getActiveSpeedDialDragCard()
  if (sourceCard) {
    try {
      sourceCard.setPointerCapture(state.speedDialDragPointerId)
    } catch {
      // The pointer may already be released when a synthetic test begins drag.
    }
  }
  dispatchNewtabDragUiView({ speedDialDragging: true, speedDialPendingId: '' })
  createSpeedDialDragGhost(sourceCard)
  captureSpeedDialDragLayout()
  patchSpeedDialDraggingState(state.speedDialDraggingBookmarkId, true)
  dispatchNewtabDragUiView({ previewInitializing: true })
  syncSpeedDialDragVisualPreview()
  window.requestAnimationFrame(() => {
    dispatchNewtabDragUiView({ previewInitializing: false })
  })
}

function handleNewTabPointerMove(event: PointerEvent): void {
  handleSpeedDialPointerMove(event)
  handleBookmarkPointerMove(event)
  handleFolderPointerMove(event)
}

function handleSpeedDialPointerMove(event: PointerEvent): void {
  if (!state.speedDialDraggingBookmarkId || event.pointerId !== state.speedDialDragPointerId) {
    return
  }

  state.speedDialDragClientX = event.clientX
  state.speedDialDragClientY = event.clientY

  if (!state.speedDialDragOriginalOrderIds.length) {
    const distance = Math.hypot(
      event.clientX - state.speedDialDragStartX,
      event.clientY - state.speedDialDragStartY
    )
    if (state.speedDialDragPointerType === 'mouse') {
      if (distance < POINTER_DRAG_START_THRESHOLD_PX) {
        return
      }
      beginSpeedDialDrag()
    } else {
      if (distance >= TOUCH_DRAG_CANCEL_THRESHOLD_PX) {
        cancelSpeedDialDrag()
      }
      return
    }
  }

  if (!state.speedDialDragOriginalOrderIds.length) {
    return
  }

  event.preventDefault()
  updateSpeedDialDragGhost()
  const insertIndex = getSpeedDialInsertIndex(event.clientX, event.clientY)
  setSpeedDialDragPendingInsertIndex(insertIndex)
}

async function finishSpeedDialDrag(event: PointerEvent): Promise<void> {
  if (!state.speedDialDraggingBookmarkId || event.pointerId !== state.speedDialDragPointerId) {
    return
  }

  window.clearTimeout(state.speedDialDragLongPressTimer)
  state.speedDialDragLongPressTimer = 0
  state.speedDialDragPointerId = 0
  window.cancelAnimationFrame(speedDialDragGhostFrame)
  speedDialDragGhostFrame = 0

  const wasDragging = Boolean(state.speedDialDragOriginalOrderIds.length)
  const generation = speedDialDragGeneration
  const bookmarkId = state.speedDialDraggingBookmarkId
  const originalOrderIds = [...state.speedDialDragOriginalOrderIds]
  const pendingInsertIndex = state.speedDialDragPendingInsertIndex >= 0
    ? state.speedDialDragPendingInsertIndex
    : getSpeedDialInsertIndex(event.clientX, event.clientY)
  const finalOrderIds = wasDragging && pendingInsertIndex >= 0
    ? buildBookmarkOrderAfterInsert(getActiveWorkspacePinnedIds(), bookmarkId, pendingInsertIndex)
    : getActiveWorkspacePinnedIds()
  if (wasDragging) {
    await settleSpeedDialDragGhost(finalOrderIds)
  }
  if (generation !== speedDialDragGeneration) return

  if (!wasDragging) {
    clearSpeedDialDragState()
    return
  }

  flushSync(() => {
    if (pendingInsertIndex >= 0) applyDraggedSpeedDialInsertInState(pendingInsertIndex)
    clearSpeedDialDragState({ deferVisualReset: true, keepSuppressClick: true })
    render()
  })
  const committedCard = getNewtabSpeedDialNodes().cards.get(bookmarkId)
  if (committedCard) void committedCard.offsetWidth
  finishBookmarkDropVisualCommit()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  await persistSpeedDialOrder(originalOrderIds, finalOrderIds)
}

function cancelSpeedDialDrag({ keepSuppressClick = false } = {}): void {
  if (!state.speedDialDraggingBookmarkId && !state.speedDialDragLongPressTimer) {
    return
  }

  window.clearTimeout(state.speedDialDragLongPressTimer)
  clearSpeedDialDragState({ keepSuppressClick })
  render()
}

function clearSpeedDialDragState({ deferVisualReset = false, keepSuppressClick = false } = {}): void {
  speedDialDragGeneration += 1
  if (deferVisualReset) {
    dispatchNewtabDragUiView({ speedDialPendingId: '', speedDialDragging: true, previewInitializing: true })
  } else {
    patchSpeedDialDraggingState(state.speedDialDraggingBookmarkId, false)
  }
  state.speedDialDraggingBookmarkId = ''
  state.speedDialDragPointerId = 0
  state.speedDialDragLongPressTimer = 0
  state.speedDialDragClientX = 0
  state.speedDialDragClientY = 0
  state.speedDialDragStartX = 0
  state.speedDialDragStartY = 0
  state.speedDialDragPointerType = ''
  state.speedDialDragOffsetX = 0
  state.speedDialDragOffsetY = 0
  state.speedDialDragOriginalOrderIds = []
  state.speedDialDragPendingInsertIndex = -1
  syncDragWindowListeners()
  if (deferVisualReset) {
    speedDialDragSlotRects = new Map()
    speedDialDragSlotOrderIds = []
  } else {
    removeSpeedDialDragGhost()
    clearSpeedDialDragVisualPreview()
    dispatchNewtabDragUiView({
      previewInitializing: false,
      speedDialPendingId: '',
      speedDialDragging: false
    })
  }

  if (keepSuppressClick) {
    state.speedDialDragSuppressClick = true
    window.setTimeout(() => {
      state.speedDialDragSuppressClick = false
    }, 250)
  } else {
    state.speedDialDragSuppressClick = false
  }
}

function patchSpeedDialDraggingState(bookmarkId: string, dragging: boolean): void {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return
  }

  patchNewtabSpeedDialView((view) => {
    if (view.content.type !== 'items') {
      return view
    }

    let changed = false
    const items = view.content.items.map((item) => {
      if (String(item.id) !== normalizedBookmarkId || item.dragging === dragging) {
        return item
      }
      changed = true
      return {
        ...item,
        dragging
      }
    })
    if (!changed) {
      return view
    }
    return {
      ...view,
      content: {
        ...view.content,
        items
      }
    }
  })
}

function createSpeedDialDragGhost(sourceCard = getActiveSpeedDialDragCard()): void {
  removeSpeedDialDragGhost()

  if (!sourceCard || !state.speedDialDraggingBookmarkId) {
    return
  }

  const bookmark = getBookmarkById(state.speedDialDraggingBookmarkId)
  if (!bookmark?.url) {
    return
  }
  const item = getSpeedDialDragItemModel(state.speedDialDraggingBookmarkId, bookmark)
  if (!item) {
    return
  }
  const rect = sourceCard.getBoundingClientRect()

  dispatchSpeedDialDragGhostView({
    customIcon: item.customIcon,
    detail: item.detail,
    fallbackLabel: item.fallbackLabel,
    favicon: item.favicon,
    height: rect.height,
    style: item.style,
    title: item.title,
    transform: 'translate3d(0, 0, 0)',
    visible: false,
    width: rect.width
  })
  updateSpeedDialDragGhost({ immediate: true })
  patchSpeedDialDragGhostView((view) => ({
    ...view,
    visible: true
  }))
}

function getSpeedDialDragItemModel(
  bookmarkId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): SpeedDialCardViewModel | null {
  const items = getNewtabSpeedDialView()?.content
  if (items?.type === 'items') {
    const item = items.items.find((item) => String(item.id) === String(bookmarkId))
    if (item) {
      return item
    }
  }

  return createSpeedDialCardViewModel({
    detail: getBookmarkDisplayTitle(bookmark),
    domain: '',
    fallbackLabel: getFallbackLabel(getBookmarkDisplayTitle(bookmark)),
    id: bookmarkId,
    pinnedOrder: 0,
    title: getBookmarkDisplayTitle(bookmark),
    url: String(bookmark.url || '')
  }, bookmark)
}

function getActiveSpeedDialDragCard(): HTMLElement | null {
  if (!state.speedDialDraggingBookmarkId) {
    return null
  }

  return getNewtabSpeedDialNodes().cards.get(state.speedDialDraggingBookmarkId) || null
}

function updateSpeedDialDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateSpeedDialDragGhostPosition()
    return
  }

  if (speedDialDragGhostFrame) {
    return
  }

  speedDialDragGhostFrame = window.requestAnimationFrame(() => {
    speedDialDragGhostFrame = 0
    updateSpeedDialDragGhostPosition()
  })
}

function updateSpeedDialDragGhostPosition(): void {
  const left = state.speedDialDragClientX - state.speedDialDragOffsetX
  const top = state.speedDialDragClientY - state.speedDialDragOffsetY
  patchSpeedDialDragGhostView((view) => ({
    ...view,
    transform: `translate3d(${left}px, ${top}px, 0)`
  }))
}

function removeSpeedDialDragGhost(): void {
  window.cancelAnimationFrame(speedDialDragGhostFrame)
  speedDialDragGhostFrame = 0
  dispatchSpeedDialDragGhostView(null)
}

function setSpeedDialDragPendingInsertIndex(insertIndex: number): void {
  const nextInsertIndex = hasSpeedDialInsertChange(insertIndex) ? insertIndex : -1
  if (state.speedDialDragPendingInsertIndex === nextInsertIndex) {
    return
  }

  state.speedDialDragPendingInsertIndex = nextInsertIndex
  syncSpeedDialDragVisualPreview()
}

function getSpeedDialInsertIndex(clientX: number, clientY: number): number {
  const slots = getSpeedDialDragLayoutSlots()
  if (!slots.length) {
    return -1
  }

  return resolveBookmarkDragInsertIndex(
    slots,
    state.speedDialDraggingBookmarkId,
    { x: clientX, y: clientY }
  )
}

function hasSpeedDialInsertChange(insertIndex: number): boolean {
  if (insertIndex < 0 || !state.speedDialDraggingBookmarkId) {
    return false
  }

  const currentOrderIds = getActiveWorkspacePinnedIds()
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.speedDialDraggingBookmarkId,
    insertIndex
  )
  return !areStringArraysEqual(currentOrderIds, finalOrderIds)
}

function getPreviewSpeedDialOrderIds(): string[] {
  const currentOrderIds = getActiveWorkspacePinnedIds()
  if (state.speedDialDragPendingInsertIndex < 0 || !state.speedDialDraggingBookmarkId) {
    return currentOrderIds
  }

  return buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.speedDialDraggingBookmarkId,
    state.speedDialDragPendingInsertIndex
  )
}

function captureSpeedDialDragLayout(): void {
  speedDialDragSlotRects = new Map()
  speedDialDragSlotOrderIds = []

  for (const { bookmarkId, card } of getSpeedDialCardEntries()) {
    speedDialDragSlotOrderIds.push(bookmarkId)
    speedDialDragSlotRects.set(bookmarkId, card.getBoundingClientRect())
  }
}

function getSpeedDialGrid(): HTMLElement | null {
  return getNewtabSpeedDialNodes().grid
}

function getSpeedDialCardEntries(): Array<{ bookmarkId: string; card: HTMLElement }> {
  const nodes = getNewtabSpeedDialNodes()
  const content = getNewtabSpeedDialView()?.content
  const orderedIds = content?.type === 'items'
    ? content.items.map((item) => String(item.id))
    : getActiveWorkspacePinnedIds()

  return orderedIds
    .map((bookmarkId) => {
      const card = nodes.cards.get(bookmarkId)
      return card ? { bookmarkId, card } : null
    })
    .filter((entry): entry is { bookmarkId: string; card: HTMLElement } => Boolean(entry))
}

function getSpeedDialDragLayoutSlots(): BookmarkDragSlotRectLike[] {
  if (speedDialDragSlotOrderIds.length && speedDialDragSlotRects.size) {
    return speedDialDragSlotOrderIds
      .map((bookmarkId) => {
        const rect = speedDialDragSlotRects.get(bookmarkId)
        return rect ? {
          id: bookmarkId,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        } : null
      })
      .filter((slot): slot is BookmarkDragSlotRectLike => Boolean(slot))
  }

  return getSpeedDialCardEntries()
    .map(({ bookmarkId, card }) => {
      const rect = card.getBoundingClientRect()
      return {
        id: bookmarkId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
}

function syncSpeedDialDragVisualPreview(): void {
  const grid = getSpeedDialGrid()
  if (!grid || !speedDialDragSlotOrderIds.length) {
    return
  }

  const targetSlotByBookmarkId = new Map<string, DOMRect>()
  const targetOrderIds = getPreviewSpeedDialOrderIds().filter((bookmarkId) => speedDialDragSlotRects.has(bookmarkId))
  if (targetOrderIds.length !== speedDialDragSlotOrderIds.length) {
    return
  }

  for (let index = 0; index < targetOrderIds.length; index += 1) {
    const slotBookmarkId = speedDialDragSlotOrderIds[index]
    const targetRect = speedDialDragSlotRects.get(slotBookmarkId)
    if (!targetRect) {
      return
    }
    targetSlotByBookmarkId.set(targetOrderIds[index], targetRect)
  }

  const previewStyleByBookmarkId = new Map<string, CSSProperties | undefined>()
  for (const bookmarkId of targetOrderIds) {
    const originalRect = speedDialDragSlotRects.get(bookmarkId)
    const targetRect = targetSlotByBookmarkId.get(bookmarkId)
    if (!originalRect || !targetRect) {
      continue
    }

    const deltaX = targetRect.left - originalRect.left
    const deltaY = targetRect.top - originalRect.top
    const isDraggedCard = bookmarkId === state.speedDialDraggingBookmarkId
    previewStyleByBookmarkId.set(
      bookmarkId,
      createDragPreviewStylePatch(deltaX, deltaY, isDraggedCard)
    )
  }

  patchNewtabSpeedDialView((view) => {
    if (view.content.type !== 'items') {
      return view
    }

    let changed = false
    const items = view.content.items.map((item) => {
      const previewStyle = previewStyleByBookmarkId.get(String(item.id))
      if (!previewStyleByBookmarkId.has(String(item.id))) {
        return item
      }
      changed = true
      return {
        ...item,
        style: mergeDragPreviewStyle(item.style, previewStyle)
      }
    })

    return changed
      ? {
          ...view,
          content: {
            ...view.content,
            items
          }
        }
      : view
  })
}

function clearSpeedDialDragVisualPreview(): void {
  patchNewtabSpeedDialView((view) => {
    if (view.content.type !== 'items') {
      return view
    }

    let changed = false
    const items = view.content.items.map((item) => {
      const style = clearDragPreviewStyle(item.style)
      if (style === item.style) {
        return item
      }
      changed = true
      return {
        ...item,
        style
      }
    })

    return changed
      ? {
          ...view,
          content: {
            ...view.content,
            items
          }
        }
      : view
  })
  speedDialDragSlotRects = new Map()
  speedDialDragSlotOrderIds = []
}

function applyDraggedSpeedDialInsertInState(insertIndex: number): string[] {
  const currentOrderIds = getActiveWorkspacePinnedIds()
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.speedDialDraggingBookmarkId,
    insertIndex
  )
  if (areStringArraysEqual(currentOrderIds, finalOrderIds)) {
    return currentOrderIds
  }

  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  state.workspaceSettings = updateNewTabWorkspace(
    state.workspaceSettings,
    activeWorkspace.id,
    { pinnedIds: finalOrderIds },
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )
  return getActiveWorkspacePinnedIds()
}

async function persistSpeedDialOrder(
  originalBookmarkIds: string[],
  finalBookmarkIds: string[]
): Promise<void> {
  if (areStringArraysEqual(originalBookmarkIds, finalBookmarkIds)) {
    return
  }

  state.reorderingSpeedDial = true
  state.speedDialReorderError = ''
  syncSpeedDialReorderBusyState()
  try {
    state.workspaceSettings = await persistNewtabWorkspaceMutation({
      type: 'reorder', originalIds: originalBookmarkIds, finalIds: finalBookmarkIds
    })
    refreshSpeedDialPanel()
  } catch (error) {
    const message = error instanceof Error ? error.message : '固定入口排序保存失败，请刷新后重试。'
    const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
    state.workspaceSettings = updateNewTabWorkspace(
      state.workspaceSettings,
      activeWorkspace.id,
      { pinnedIds: originalBookmarkIds },
      { validBookmarkIds: state.allBookmarkMap.keys() }
    )
    state.speedDialReorderError = message
    render()
  } finally {
    state.reorderingSpeedDial = false
    syncSpeedDialReorderBusyState()
  }
}

function syncSpeedDialReorderBusyState(): void {
  const current = getNewtabSpeedDialView()
  if (!current) {
    return
  }

  const content = current.content.type === 'items'
    ? {
        ...current.content,
        busy: state.reorderingSpeedDial
      }
    : current.content

  dispatchNewtabSpeedDialView({
    ...current,
    ariaBusy: state.reorderingSpeedDial,
    content,
    meta: getSpeedDialStatus(state.reorderingSpeedDial, state.speedDialReorderError),
    metaTone: state.speedDialReorderError ? 'error' : ''
  })
}

async function settleSpeedDialDragGhost(finalOrderIds: string[]): Promise<void> {
  const finalIndex = finalOrderIds.indexOf(state.speedDialDraggingBookmarkId)
  const slotId = speedDialDragSlotOrderIds[finalIndex]
  const targetRect = slotId ? speedDialDragSlotRects.get(slotId) : null
  if (!targetRect) {
    return
  }
  await settleNewtabDragGhost('.speed-dial-drag-ghost', targetRect.left, targetRect.top)
}

function handleSpeedDialReorderKeyDown(
  bookmarkId: string,
  event: ReactKeyboardEvent<HTMLElement>
): void {
  const direction = getKeyboardReorderDirection(event, 'horizontal')
  if (!direction) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (state.reorderingSpeedDial) {
    return
  }
  void reorderSpeedDialByKeyboard(bookmarkId, direction)
}

async function reorderSpeedDialByKeyboard(bookmarkId: string, direction: -1 | 1): Promise<void> {
  const originalIds = getActiveWorkspacePinnedIds()
  const currentIndex = originalIds.indexOf(bookmarkId)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= originalIds.length) {
    setFolderReorderStatus(direction < 0 ? '固定入口已在最前面。' : '固定入口已在最后面。', 'success')
    return
  }

  const finalIds = swapArrayItems(originalIds, currentIndex, nextIndex)
  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  state.workspaceSettings = updateNewTabWorkspace(
    state.workspaceSettings,
    activeWorkspace.id,
    { pinnedIds: finalIds },
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )
  render()
  focusSpeedDialCard(bookmarkId)
  await persistSpeedDialOrder(originalIds, finalIds)
  if (!state.speedDialReorderError) {
    setFolderReorderStatus(`固定入口已移动到第 ${nextIndex + 1} 位。`, 'success')
    focusSpeedDialCard(bookmarkId)
  }
}

function startBookmarkDragFromReact(
  bookmarkId: string,
  folderId: string,
  tile: HTMLElement,
  event: DragStartPointerEvent
): void {
  finishPendingBookmarkDropVisualCommit()
  if (
    state.speedDialDraggingBookmarkId ||
    state.speedDialDragLongPressTimer ||
    state.draggingFolderId ||
    state.folderDragLongPressTimer
  ) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!getBookmarkById(normalizedBookmarkId)) {
    return
  }
  const normalizedFolderId = String(folderId || '').trim()
  if (!normalizedFolderId) {
    return
  }

  cancelBookmarkDrag({ keepSuppressClick: true })
  state.dragPointerId = event.pointerId
  state.dragPointerType = event.pointerType
  state.draggingBookmarkId = normalizedBookmarkId
  state.draggingBookmarkFolderId = normalizedFolderId
  state.dragStartX = event.clientX
  state.dragStartY = event.clientY
  state.dragClientX = event.clientX
  state.dragClientY = event.clientY
  const rect = tile.getBoundingClientRect()
  state.dragOffsetX = event.clientX - rect.left
  state.dragOffsetY = event.clientY - rect.top
  syncDragWindowListeners()
  if (event.pointerType !== 'mouse') {
    dispatchNewtabDragUiView({ bookmarkPendingId: normalizedBookmarkId })
    state.dragLongPressTimer = window.setTimeout(() => {
      beginBookmarkDrag()
    }, BOOKMARK_DRAG_LONG_PRESS_MS)
  }
}

function handleBookmarkDragPointerDown(
  bookmarkId: string,
  folderId: string,
  tile: HTMLElement,
  event: ReactPointerEvent<HTMLElement>
): void {
  startBookmarkDragFromReact(bookmarkId, folderId, tile, event.nativeEvent)
}

function beginBookmarkDrag(): void {
  if (!state.draggingBookmarkId || !getBookmarkById(state.draggingBookmarkId)) {
    cancelBookmarkDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  state.dragLongPressTimer = 0
  state.dragOriginalOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  state.dragSuppressClick = true
  const sourceTile = getActiveDragTile()
  if (sourceTile) {
    try {
      sourceTile.setPointerCapture(state.dragPointerId)
    } catch {
      // The pointer may already be released when a synthetic test begins drag.
    }
  }
  dispatchNewtabDragUiView({ bookmarkDragging: true, bookmarkPendingId: '' })
  createBookmarkDragGhost(sourceTile)
  captureBookmarkDragLayout()
  patchBookmarkTileDraggingState(state.draggingBookmarkId, true)
  dispatchNewtabDragUiView({ previewInitializing: true })
  syncBookmarkDragVisualPreview()
  window.requestAnimationFrame(() => {
    dispatchNewtabDragUiView({ previewInitializing: false })
  })
}

function handleBookmarkPointerMove(event: PointerEvent): void {
  if (!state.draggingBookmarkId || event.pointerId !== state.dragPointerId) {
    return
  }

  state.dragClientX = event.clientX
  state.dragClientY = event.clientY

  if (!state.dragOriginalOrderIds.length) {
    const distance = Math.hypot(
      event.clientX - state.dragStartX,
      event.clientY - state.dragStartY
    )
    if (state.dragPointerType === 'mouse') {
      if (distance < POINTER_DRAG_START_THRESHOLD_PX) {
        return
      }
      beginBookmarkDrag()
    } else {
      if (distance >= TOUCH_DRAG_CANCEL_THRESHOLD_PX) {
        cancelBookmarkDrag()
      }
      return
    }
  }

  if (!state.dragOriginalOrderIds.length) {
    return
  }

  event.preventDefault()
  updateBookmarkDragGhost()
  const insertIndex = getBookmarkInsertIndex(event.clientX, event.clientY)
  setBookmarkDragPendingInsertIndex(insertIndex)
}

async function finishBookmarkDrag(event: PointerEvent): Promise<void> {
  if (!state.draggingBookmarkId || event.pointerId !== state.dragPointerId) {
    return
  }

  window.clearTimeout(state.dragLongPressTimer)
  state.dragLongPressTimer = 0
  state.dragPointerId = 0
  window.cancelAnimationFrame(bookmarkDragGhostFrame)
  bookmarkDragGhostFrame = 0

  const wasDragging = Boolean(state.dragOriginalOrderIds.length)
  const generation = bookmarkDragGeneration
  const folderId = state.draggingBookmarkFolderId
  const originalOrderIds = [...state.dragOriginalOrderIds]
  const pendingInsertIndex = state.dragPendingInsertIndex >= 0
    ? state.dragPendingInsertIndex
    : getBookmarkInsertIndex(event.clientX, event.clientY)
  const finalOrderIds = wasDragging && pendingInsertIndex >= 0
    ? buildBookmarkOrderAfterInsert(
        getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id)),
        state.draggingBookmarkId,
        pendingInsertIndex
      )
    : getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  if (wasDragging) {
    await settleBookmarkDragGhost(finalOrderIds)
  }
  if (generation !== bookmarkDragGeneration) return
  if (!wasDragging) {
    clearBookmarkDragState()
    return
  }

  // Publish the order only after the preview settles. An intervening render
  // must not combine the new DOM order with the old preview offsets.
  flushSync(() => {
    if (pendingInsertIndex >= 0) applyDraggedBookmarkInsertInState(pendingInsertIndex)
    clearBookmarkDragState({ deferVisualReset: true, keepSuppressClick: true })
    render()
  })
  const committedGrid = getNewtabBookmarkContentNodes().grids.get(folderId)
  if (committedGrid) void committedGrid.offsetWidth
  finishBookmarkDropVisualCommit()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  markSearchIndexDirty()
  await persistBookmarkOrder(folderId, originalOrderIds, finalOrderIds)
}

function cancelBookmarkDrag({ keepSuppressClick = false } = {}): void {
  if (!state.draggingBookmarkId && !state.dragLongPressTimer) {
    return
  }

  window.clearTimeout(state.dragLongPressTimer)
  clearBookmarkDragState({ keepSuppressClick })
  render()
}

function clearBookmarkDragState({
  deferVisualReset = false,
  keepSuppressClick = false
} = {}): void {
  bookmarkDragGeneration += 1
  if (deferVisualReset) {
    dispatchNewtabDragUiView({
      bookmarkPendingId: '',
      bookmarkDragging: true,
      previewInitializing: true
    })
  } else {
    patchBookmarkTileDraggingState(state.draggingBookmarkId, false)
  }
  state.draggingBookmarkId = ''
  state.dragPointerId = 0
  state.dragLongPressTimer = 0
  state.dragClientX = 0
  state.dragClientY = 0
  state.dragStartX = 0
  state.dragStartY = 0
  state.dragPointerType = ''
  state.dragOffsetX = 0
  state.dragOffsetY = 0
  state.draggingBookmarkFolderId = ''
  state.dragOriginalOrderIds = []
  state.dragPendingInsertIndex = -1
  syncDragWindowListeners()
  if (deferVisualReset) {
    bookmarkDragSlotRects = new Map()
    bookmarkDragSlotOrderIds = []
  } else {
    removeBookmarkDragGhost()
    clearBookmarkDragVisualPreview()
    dispatchNewtabDragUiView({
      bookmarkPendingId: '',
      bookmarkDragging: false,
      previewInitializing: false
    })
  }

  if (keepSuppressClick) {
    state.dragSuppressClick = true
    window.setTimeout(() => {
      state.dragSuppressClick = false
    }, 250)
  } else {
    state.dragSuppressClick = false
  }
}

function finishBookmarkDropVisualCommit(): void {
  removeBookmarkDragGhost()
  removeSpeedDialDragGhost()
  window.cancelAnimationFrame(bookmarkDropCommitFrame)
  bookmarkDropCommitFrame = window.requestAnimationFrame(() => {
    bookmarkDropCommitFrame = 0
    dispatchNewtabDragUiView({
      bookmarkPendingId: '',
      bookmarkDragging: false,
      speedDialPendingId: '',
      speedDialDragging: false,
      previewInitializing: false
    })
  })
}

function finishPendingBookmarkDropVisualCommit(): void {
  if (!bookmarkDropCommitFrame) {
    return
  }
  window.cancelAnimationFrame(bookmarkDropCommitFrame)
  bookmarkDropCommitFrame = 0
  dispatchNewtabDragUiView({
    bookmarkPendingId: '',
    bookmarkDragging: false,
    speedDialPendingId: '',
    speedDialDragging: false,
    previewInitializing: false
  })
}

function patchBookmarkTileDraggingState(bookmarkId: string, dragging: boolean): void {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return
  }

  patchNewtabBookmarkContentView((view) => {
    let changed = false
    const sections = view.sections.map((section) => {
      if (!section.grid) {
        return section
      }

      const items = section.grid.items.map((item) => {
        if (String(item.id) !== normalizedBookmarkId || item.dragging === dragging) {
          return item
        }
        changed = true
        return {
          ...item,
          dragging
        }
      })
      if (items === section.grid.items) {
        return section
      }
      return {
        ...section,
        grid: {
          ...section.grid,
          items
        }
      }
    })

    return changed
      ? {
          ...view,
          sections
        }
      : view
  })
}

function createBookmarkDragGhost(sourceTile = getActiveDragTile()): void {
  removeBookmarkDragGhost()

  if (!sourceTile || !state.draggingBookmarkId) {
    return
  }

  const bookmark = getBookmarkById(state.draggingBookmarkId)
  if (!bookmark?.url) {
    return
  }
  const item = getBookmarkDragTileModel(
    state.draggingBookmarkId,
    state.draggingBookmarkFolderId,
    bookmark
  )
  if (!item) {
    return
  }
  const rect = sourceTile.getBoundingClientRect()

  dispatchBookmarkDragGhostView({
    customIcon: item.customIcon,
    fallbackLabel: item.fallbackLabel,
    favicon: item.favicon,
    height: rect.height,
    showTitles: state.iconSettings.showTitles,
    style: getBookmarkDragGhostStyle(item.style),
    title: item.title,
    transform: 'translate3d(0, 0, 0)',
    visible: false,
    width: rect.width
  })
  updateBookmarkDragGhost({ immediate: true })
  patchBookmarkDragGhostView((view) => ({
    ...view,
    visible: true
  }))
}

function getBookmarkDragTileModel(
  bookmarkId: string,
  folderId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): BookmarkTileViewModel | null {
  const content = getNewtabBookmarkContentView()
  const item = content?.sections
    .flatMap((section) => section.grid?.items || [])
    .find((item) => String(item.id) === String(bookmarkId))
  if (item) {
    return item
  }

  return createBookmarkTileViewModel(bookmark, folderId)
}

function getBookmarkDragGhostStyle(itemStyle: CSSProperties | undefined): CSSProperties | undefined {
  const style = { ...(itemStyle || {}) } as CSSProperties
  ;(style as Record<string, string>)['--icon-shell-size'] = `${state.iconSettings.iconShellSize}px`
  ;(style as Record<string, string>)['--icon-title-lines'] = String(state.iconSettings.titleLines)

  return Object.keys(style).length ? style : undefined
}

function getActiveDragTile(): HTMLElement | null {
  if (!state.draggingBookmarkId) {
    return null
  }

  return getNewtabBookmarkContentNodes().tiles.get(state.draggingBookmarkId) || null
}

function updateBookmarkDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateBookmarkDragGhostPosition()
    return
  }

  if (bookmarkDragGhostFrame) {
    return
  }

  bookmarkDragGhostFrame = window.requestAnimationFrame(() => {
    bookmarkDragGhostFrame = 0
    updateBookmarkDragGhostPosition()
  })
}

function updateBookmarkDragGhostPosition(): void {
  const left = state.dragClientX - state.dragOffsetX
  const top = state.dragClientY - state.dragOffsetY
  patchBookmarkDragGhostView((view) => ({
    ...view,
    transform: `translate3d(${left}px, ${top}px, 0)`
  }))
}

function removeBookmarkDragGhost(): void {
  window.cancelAnimationFrame(bookmarkDragGhostFrame)
  bookmarkDragGhostFrame = 0
  dispatchBookmarkDragGhostView(null)
}

function setBookmarkDragPendingInsertIndex(insertIndex: number): void {
  const nextInsertIndex = hasBookmarkInsertChange(insertIndex) ? insertIndex : -1
  if (state.dragPendingInsertIndex === nextInsertIndex) {
    return
  }

  state.dragPendingInsertIndex = nextInsertIndex
  syncBookmarkDragVisualPreview()
}

function getActiveBookmarkFolderSection(): NewTabFolderSection | null {
  if (!state.draggingBookmarkFolderId) {
    return null
  }

  return state.folderSections.find((section) => section.id === state.draggingBookmarkFolderId) || null
}

function getActiveBookmarkFolderBookmarks(): chrome.bookmarks.BookmarkTreeNode[] {
  return getActiveBookmarkFolderSection()?.bookmarks || []
}

function setActiveBookmarkFolderBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): void {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return
  }

  section.bookmarks = bookmarks
  refreshDerivedBookmarkState()
}

function getBookmarkInsertIndex(clientX: number, clientY: number): number {
  const folderId = state.draggingBookmarkFolderId
  if (!folderId) {
    return -1
  }

  const slots = getBookmarkDragLayoutSlots()
  if (!slots.length) {
    return -1
  }

  return resolveBookmarkDragInsertIndex(
    slots,
    state.draggingBookmarkId,
    getBookmarkDragTargetPoint(clientX, clientY)
  )
}

function hasBookmarkInsertChange(insertIndex: number): boolean {
  if (insertIndex < 0 || !state.draggingBookmarkId) {
    return false
  }

  const currentOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    insertIndex
  )
  return !areStringArraysEqual(currentOrderIds, finalOrderIds)
}

function getPreviewBookmarkOrderIds(): string[] {
  const currentOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  if (state.dragPendingInsertIndex < 0 || !state.draggingBookmarkId) {
    return currentOrderIds
  }

  return buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    state.dragPendingInsertIndex
  )
}

function captureBookmarkDragLayout(): void {
  bookmarkDragSlotRects = new Map()
  bookmarkDragSlotOrderIds = []

  for (const { bookmarkId, tile } of getBookmarkTileEntries()) {
    bookmarkDragSlotOrderIds.push(bookmarkId)
    bookmarkDragSlotRects.set(bookmarkId, tile.getBoundingClientRect())
  }
}

function getActiveBookmarkGrid(): HTMLElement | null {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return null
  }

  return getNewtabBookmarkContentNodes().grids.get(section.id) || null
}

function getBookmarkTileEntries(): Array<{ bookmarkId: string; tile: HTMLElement }> {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return []
  }

  const nodes = getNewtabBookmarkContentNodes()
  const content = getNewtabBookmarkContentView()
  const activeViewSection = content?.sections.find((viewSection) => viewSection.folderId === section.id) || null
  const orderedIds = activeViewSection?.grid
    ? activeViewSection.grid.items.map((item) => String(item.id))
    : section.bookmarks.map((bookmark) => String(bookmark.id || ''))

  return orderedIds
    .map((bookmarkId) => {
      const tile = nodes.tiles.get(bookmarkId)
      return tile ? { bookmarkId, tile } : null
    })
    .filter((entry): entry is { bookmarkId: string; tile: HTMLElement } => Boolean(entry))
}

function getBookmarkDragLayoutSlots(): BookmarkDragSlotRectLike[] {
  if (bookmarkDragSlotOrderIds.length && bookmarkDragSlotRects.size) {
    return bookmarkDragSlotOrderIds
      .map((bookmarkId) => {
        const rect = bookmarkDragSlotRects.get(bookmarkId)
        return rect ? {
          id: bookmarkId,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        } : null
      })
      .filter((slot): slot is BookmarkDragSlotRectLike => Boolean(slot))
  }

  return getBookmarkTileEntries()
    .map(({ bookmarkId, tile }) => {
      const rect = tile.getBoundingClientRect()
      return {
        id: bookmarkId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
}

function getBookmarkDragTargetPoint(
  clientX: number,
  clientY: number
): { x: number; y: number } {
  // The pointer is kept at the favicon center, so it matches the point users steer visually.
  return { x: clientX, y: clientY }
}

function syncBookmarkDragVisualPreview(): void {
  const grid = getActiveBookmarkGrid()
  if (!grid || !bookmarkDragSlotOrderIds.length) {
    return
  }

  const targetSlotByBookmarkId = new Map<string, DOMRect>()
  const targetOrderIds = getPreviewBookmarkOrderIds()
  if (targetOrderIds.length !== bookmarkDragSlotOrderIds.length) {
    return
  }

  for (let index = 0; index < targetOrderIds.length; index += 1) {
    const slotBookmarkId = bookmarkDragSlotOrderIds[index]
    const targetRect = bookmarkDragSlotRects.get(slotBookmarkId)
    if (!targetRect) {
      return
    }
    targetSlotByBookmarkId.set(targetOrderIds[index], targetRect)
  }

  const previewStyleByBookmarkId = new Map<string, CSSProperties | undefined>()
  for (const bookmarkId of targetOrderIds) {
    const originalRect = bookmarkDragSlotRects.get(bookmarkId)
    const targetRect = targetSlotByBookmarkId.get(bookmarkId)
    if (!originalRect || !targetRect) {
      continue
    }

    const deltaX = targetRect.left - originalRect.left
    const deltaY = targetRect.top - originalRect.top
    const isDraggedTile = bookmarkId === state.draggingBookmarkId
    previewStyleByBookmarkId.set(
      bookmarkId,
      createDragPreviewStylePatch(deltaX, deltaY, isDraggedTile)
    )
  }

  patchBookmarkTilePreviewStyles(previewStyleByBookmarkId)
}

function createDragPreviewStylePatch(
  deltaX: number,
  deltaY: number,
  isDraggedTile: boolean
): CSSProperties | undefined {
  const transform = buildBookmarkPreviewTransform(deltaX, deltaY, isDraggedTile)
  if (!transform && !isDraggedTile) {
    return undefined
  }

  return {
    transform,
    zIndex: isDraggedTile ? 1 : undefined
  }
}

function buildBookmarkPreviewTransform(deltaX: number, deltaY: number, isDraggedTile: boolean): string {
  const hasOffset = Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5
  if (!hasOffset) {
    return isDraggedTile ? 'scale(0.92)' : ''
  }

  const translate = `translate3d(${deltaX}px, ${deltaY}px, 0)`
  return isDraggedTile ? `${translate} scale(0.92)` : translate
}

function clearBookmarkDragVisualPreview(): void {
  patchBookmarkTilePreviewStyles(new Map())
  bookmarkDragSlotRects = new Map()
  bookmarkDragSlotOrderIds = []
}

function patchBookmarkTilePreviewStyles(previewStyleByBookmarkId: Map<string, CSSProperties | undefined>): void {
  patchNewtabBookmarkContentView((view) => {
    let changed = false
    const sections = view.sections.map((section) => {
      if (!section.grid) {
        return section
      }

      let sectionChanged = false
      const items = section.grid.items.map((item) => {
        const itemId = String(item.id)
        const style = previewStyleByBookmarkId.has(itemId)
          ? mergeDragPreviewStyle(item.style, previewStyleByBookmarkId.get(itemId))
          : clearDragPreviewStyle(item.style)
        if (style === item.style) {
          return item
        }
        sectionChanged = true
        return {
          ...item,
          style
        }
      })

      if (sectionChanged) {
        changed = true
      }
      return sectionChanged
        ? {
            ...section,
            grid: {
              ...section.grid,
              items
            }
          }
        : section
    })

    return changed
      ? {
          ...view,
          sections
        }
      : view
  })
}

// 主动解析出的网站图标回填到当前视图模型：刷新或重排后仍直接使用真实图标，
// 也让下一次 preboot 快照直接携带它。
function applyResolvedActiveFavicon(origin: string, src: string): void {
  patchNewtabBookmarkContentView((view) => {
    let changed = false
    const sections = view.sections.map((section) => {
      if (!section.grid) {
        return section
      }
      const patched = patchResolvedActiveFaviconItems(section.grid.items, origin, src)
      if (!patched.changed) {
        return section
      }
      changed = true
      return {
        ...section,
        grid: {
          ...section.grid,
          items: patched.items
        }
      }
    })
    let navigation = view.navigation
    if (navigation) {
      const patched = patchResolvedActiveFaviconItems(navigation.items, origin, src)
      if (patched.changed) {
        changed = true
        navigation = {
          ...navigation,
          items: patched.items
        }
      }
    }
    return changed
      ? {
          ...view,
          navigation,
          sections
        }
      : view
  })
}

function patchResolvedActiveFaviconItems<T extends {
  customIcon: boolean
  favicon: BookmarkTileViewModel['favicon']
  url: string
}>(
  items: T[],
  origin: string,
  src: string
): { changed: boolean; items: T[] } {
  let changed = false
  const nextItems = items.map((item) => {
    if (item.customIcon || getActiveFaviconOrigin(item.url) !== origin) {
      return item
    }
    changed = true
    return {
      ...item,
      favicon: {
        fetchpriority: item.favicon.fetchpriority,
        loading: item.favicon.loading,
        pageUrl: item.favicon.pageUrl,
        src
      }
    }
  })
  return changed ? { changed: true, items: nextItems } : { changed: false, items }
}

function mergeDragPreviewStyle(
  baseStyle: CSSProperties | undefined,
  previewStyle: CSSProperties | undefined
): CSSProperties | undefined {
  const next = clearDragPreviewStyle(baseStyle)
  const merged = { ...(next || {}) } as CSSProperties
  if (previewStyle?.transform) {
    merged.transform = previewStyle.transform
  }
  if (previewStyle?.zIndex !== undefined) {
    merged.zIndex = previewStyle.zIndex
  }
  return Object.keys(merged).length ? merged : undefined
}

function clearDragPreviewStyle(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style || (!('transform' in style) && !('zIndex' in style))) {
    return style
  }

  const next = { ...style } as CSSProperties
  delete next.transform
  delete next.zIndex
  return Object.keys(next).length ? next : undefined
}

function applyDraggedBookmarkInsertInState(insertIndex: number): string[] {
  const currentBookmarks = getActiveBookmarkFolderBookmarks()
  const currentOrderIds = currentBookmarks.map((bookmark) => String(bookmark.id))
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    insertIndex
  )
  if (areStringArraysEqual(currentOrderIds, finalOrderIds)) {
    return currentOrderIds
  }

  const bookmarkById = new Map(currentBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  const nextBookmarks: chrome.bookmarks.BookmarkTreeNode[] = []
  for (const bookmarkId of finalOrderIds) {
    const bookmark = bookmarkById.get(bookmarkId)
    if (!bookmark) {
      return currentOrderIds
    }
    nextBookmarks.push(bookmark)
  }

  setActiveBookmarkFolderBookmarks(nextBookmarks)
  return finalOrderIds
}

async function persistBookmarkOrder(
  folderId: string,
  originalBookmarkIds: string[],
  finalBookmarkIds: string[]
): Promise<void> {
  if (!folderId) {
    return
  }

  const operations = buildMinimalBookmarkMoveOperations(
    originalBookmarkIds,
    finalBookmarkIds,
    folderId,
    state.folderNodeMap.get(folderId)?.children
  )
  if (!operations.length) {
    return
  }

  state.reorderingBookmarks = true
  state.selfBookmarkMoveIds = new Set(operations.map((operation) => operation.id))
  state.selfBookmarkMoveSuppressUntil = Date.now() + 1500
  state.bookmarkReorderError = ''
  syncBookmarkReorderBusyState()
  try {
    await moveBookmarkOperationsSequentially(operations)

    if (!syncPersistedBookmarkOrderInState(folderId, operations, finalBookmarkIds)) {
      await refreshNewTab({ showLoading: false })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '书签排序保存失败，请刷新后重试。'
    // Moves are applied one by one, so a failure leaves the folder half
    // reordered. Put every bookmark back where it was before surfacing the
    // error; the refresh below then re-reads the real tree either way.
    await restoreBookmarkOrderAfterFailure(folderId, originalBookmarkIds)
    await refreshNewTab({ showLoading: false })
    state.bookmarkReorderError = message
    render()
  } finally {
    state.reorderingBookmarks = false
    syncBookmarkReorderBusyState()
  }
}

/** Best-effort rollback after a partially applied reorder: move each bookmark
 * of the folder back to its original index. Individual failures are ignored
 * because the caller refreshes from the real tree afterwards. */
async function restoreBookmarkOrderAfterFailure(folderId: string, originalBookmarkIds: string[]): Promise<void> {
  const children = state.folderNodeMap.get(folderId)?.children
  if (!children?.length || !originalBookmarkIds.length) {
    return
  }
  const knownIds = new Set(children.map((child) => String(child.id)))
  if (originalBookmarkIds.some((bookmarkId) => !knownIds.has(bookmarkId))) {
    return
  }
  for (const [index, bookmarkId] of originalBookmarkIds.entries()) {
    try {
      await moveBookmarkLazy(bookmarkId, folderId, index)
    } catch { /* The refresh below re-reads the real tree. */ }
  }
}

function moveBookmarkOperationsSequentially(operations: BookmarkMoveOperation[]): Promise<void> {
  return operations.reduce<Promise<void>>((chain, operation) => {
    return chain.then(async () => {
      await moveBookmarkLazy(operation.id, operation.parentId, operation.index)
    })
  }, Promise.resolve())
}

function syncPersistedBookmarkOrderInState(
  folderId: string,
  operations: BookmarkMoveOperation[],
  finalBookmarkIds: string[]
): boolean {
  const folderNode = state.folderNodeMap.get(folderId) || null
  const nextChildren = applyBookmarkMoveOperationsToChildren(folderNode?.children, operations)
  if (!folderNode || !nextChildren) {
    return false
  }

  const nextBookmarkIds = nextChildren.flatMap((combineValue, combineIndex, combineArray) => { if (!((child) => Boolean(child.url))(combineValue)) return []; const combinedResult = ((child) => String(child.id))(combineValue); return [combinedResult] })
  if (!areStringArraysEqual(nextBookmarkIds, finalBookmarkIds)) {
    return false
  }

  folderNode.children = nextChildren
  state.bookmarkCatalog = null
  state.folderData = refreshBookmarkCatalog(state.rootNode).extracted
  state.folderNodeMap = buildFolderNodeMap(state.rootNode)
  state.folderSections = buildNewTabFolderSections(
    state.rootNode,
    state.folderSettings,
    state.folderData,
    state.folderNodeMap
  )
  refreshDerivedBookmarkState()
  markSearchIndexDirty()
  render()
  return true
}

function syncBookmarkReorderBusyState(): void {
  patchNewtabBookmarkContentView((view) => {
    const sections = view.sections.map((section) => ({
      ...section,
      grid: section.grid ? {
        ...section.grid,
        busy: state.reorderingBookmarks
      } : null
    }))
    return {
      ...view,
      content: {
        ...view.content,
        reordering: state.reorderingBookmarks
      },
      sections
    }
  })
}

async function settleBookmarkDragGhost(finalOrderIds: string[]): Promise<void> {
  const finalIndex = finalOrderIds.indexOf(state.draggingBookmarkId)
  const slotId = bookmarkDragSlotOrderIds[finalIndex]
  const targetRect = slotId ? bookmarkDragSlotRects.get(slotId) : null
  if (!targetRect) {
    return
  }
  await settleNewtabDragGhost('.bookmark-drag-ghost', targetRect.left, targetRect.top)
}

function handleBookmarkReorderKeyDown(
  bookmarkId: string,
  folderId: string,
  event: ReactKeyboardEvent<HTMLElement>
): void {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  const direction = getKeyboardReorderDirection(event, 'horizontal')
  if (!direction) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (state.reorderingBookmarks) {
    return
  }

  if (event.shiftKey) {
    void moveBookmarkToAdjacentFolderByKeyboard(bookmarkId, folderId, direction)
    return
  }
  void reorderBookmarkByKeyboard(bookmarkId, folderId, direction)
}

async function reorderBookmarkByKeyboard(
  bookmarkId: string,
  folderId: string,
  direction: -1 | 1
): Promise<void> {
  const section = state.folderSections.find((item) => item.id === folderId)
  if (!section) {
    return
  }
  const currentIndex = section.bookmarks.findIndex((bookmark) => String(bookmark.id) === bookmarkId)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= section.bookmarks.length) {
    setFolderReorderStatus(direction < 0 ? '书签已在当前文件夹最前面。' : '书签已在当前文件夹最后面。', 'success')
    return
  }

  const originalIds = section.bookmarks.map((bookmark) => String(bookmark.id))
  section.bookmarks = swapArrayItems(section.bookmarks, currentIndex, nextIndex)
  const finalIds = section.bookmarks.map((bookmark) => String(bookmark.id))
  refreshDerivedBookmarkState()
  render()
  focusBookmarkTile(bookmarkId)
  await persistBookmarkOrder(folderId, originalIds, finalIds)
  if (!state.bookmarkReorderError) {
    setFolderReorderStatus(`书签已移动到「${section.title || '未命名文件夹'}」第 ${nextIndex + 1} 位。`, 'success')
    focusBookmarkTile(bookmarkId)
  }
}

async function moveBookmarkToAdjacentFolderByKeyboard(
  bookmarkId: string,
  folderId: string,
  direction: -1 | 1
): Promise<void> {
  const currentFolderIndex = state.folderSections.findIndex((section) => section.id === folderId)
  const targetSection = state.folderSections[currentFolderIndex + direction]
  if (currentFolderIndex < 0 || !targetSection) {
    setFolderReorderStatus(direction < 0 ? '没有更前面的来源文件夹。' : '没有更后面的来源文件夹。', 'success')
    return
  }

  state.reorderingBookmarks = true
  syncBookmarkReorderBusyState()
  try {
    await moveBookmarkLazy(bookmarkId, targetSection.id, targetSection.bookmarks.length)
    markSearchIndexDirty()
    await refreshNewTab({ showLoading: false })
    setFolderReorderStatus(`书签已移动到「${targetSection.title || '未命名文件夹'}」。`, 'success')
    focusBookmarkTile(bookmarkId)
  } catch (error) {
    const message = error instanceof Error ? error.message : '移动失败，请稍后重试。'
    setFolderReorderStatus(`书签移动失败。${message}`, 'error')
  } finally {
    state.reorderingBookmarks = false
    syncBookmarkReorderBusyState()
  }
}

function handleFolderReorderKeyDown(
  folderId: string,
  event: ReactKeyboardEvent<HTMLElement>
): void {
  const direction = getKeyboardReorderDirection(event, 'vertical')
  if (!direction) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  void reorderFolderByKeyboard(folderId, direction)
}

async function reorderFolderByKeyboard(folderId: string, direction: -1 | 1): Promise<void> {
  const currentIndex = state.folderSections.findIndex((section) => section.id === folderId)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.folderSections.length) {
    setFolderReorderStatus(direction < 0 ? '文件夹已在最前面。' : '文件夹已在最后面。', 'success')
    return
  }

  const originalSections = [...state.folderSections]
  const originalIds = originalSections.map((section) => section.id)
  state.folderSections = swapArrayItems(state.folderSections, currentIndex, nextIndex)
  const finalIds = state.folderSections.map((section) => section.id)
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: finalIds
  })
  refreshDerivedBookmarkState()
  render()
  focusFolderHeader(folderId)

  try {
    await saveFolderSettings()
    syncFolderSettingsControls()
    setFolderReorderStatus(`文件夹已移动到第 ${nextIndex + 1} 位。`, 'success')
    focusFolderHeader(folderId)
  } catch (error) {
    state.folderSections = originalSections
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: originalIds
    })
    settingsPersistence.discard(STORAGE_KEYS.newTabFolderSettings, state.folderSettings)
    refreshDerivedBookmarkState()
    render()
    const message = error instanceof Error ? error.message : '保存失败，请稍后重试。'
    setFolderReorderStatus(`文件夹顺序保存失败，已恢复。${message}`, 'error')
    focusFolderHeader(folderId)
  }
}

function getKeyboardReorderDirection(
  event: ReactKeyboardEvent<HTMLElement>,
  orientation: 'horizontal' | 'vertical'
): -1 | 0 | 1 {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return 0
  }
  if (orientation === 'horizontal') {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return 1
    return 0
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') return -1
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') return 1
  return 0
}

function swapArrayItems<T>(items: readonly T[], leftIndex: number, rightIndex: number): T[] {
  const next = [...items]
  ;[next[leftIndex], next[rightIndex]] = [next[rightIndex], next[leftIndex]]
  return next
}

function focusBookmarkTile(bookmarkId: string): void {
  window.requestAnimationFrame(() => {
    getNewtabBookmarkContentNodes().tiles.get(bookmarkId)?.focus({ preventScroll: true })
  })
}

function focusSpeedDialCard(bookmarkId: string): void {
  window.requestAnimationFrame(() => {
    getNewtabSpeedDialNodes().cards.get(bookmarkId)?.focus({ preventScroll: true })
  })
}

function focusFolderHeader(folderId: string): void {
  window.requestAnimationFrame(() => {
    getNewtabBookmarkContentNodes().folderHeaders.get(folderId)?.focus({ preventScroll: true })
  })
}

function startFolderDragFromReact(
  folderId: string,
  header: HTMLElement,
  event: DragStartPointerEvent
): void {
  finishPendingBookmarkDropVisualCommit()
  if (state.draggingBookmarkId || state.dragLongPressTimer) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const normalizedFolderId = String(folderId || '').trim()
  if (!normalizedFolderId || !state.folderSections.some((section) => section.id === normalizedFolderId)) {
    return
  }

  cancelFolderDrag({ keepSuppressClick: true })
  state.folderDragPointerId = event.pointerId
  state.folderDragPointerType = event.pointerType
  state.draggingFolderId = normalizedFolderId
  state.folderDragStartX = event.clientX
  state.folderDragStartY = event.clientY
  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY
  const rect = header.getBoundingClientRect()
  state.folderDragOffsetX = event.clientX - rect.left
  state.folderDragOffsetY = event.clientY - rect.top
  syncDragWindowListeners()
  if (event.pointerType !== 'mouse') {
    dispatchNewtabDragUiView({ folderPendingId: normalizedFolderId })
    state.folderDragLongPressTimer = window.setTimeout(() => {
      beginFolderDrag()
    }, FOLDER_DRAG_LONG_PRESS_MS)
  }
}

function handleFolderDragPointerDown(
  folderId: string,
  header: HTMLElement,
  event: ReactPointerEvent<HTMLElement>
): void {
  startFolderDragFromReact(folderId, header, event.nativeEvent)
}

function handleFolderHeaderClick(event: ReactMouseEvent<HTMLButtonElement>): void {
  if (!shouldSuppressNewtabActionClick()) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
}

function beginFolderDrag(): void {
  if (!state.draggingFolderId || !state.folderSections.some((section) => section.id === state.draggingFolderId)) {
    cancelFolderDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  clearFolderReorderStatus()
  state.folderDragLongPressTimer = 0
  state.folderDragOriginalOrderIds = state.folderSections.map((section) => section.id)
  state.folderDragOriginalSections = [...state.folderSections]
  folderDragSectionRectSnapshot = getFolderSectionRects()
  state.folderDragSuppressClick = true
  const sourceHeader = getActiveFolderDragHeader()
  if (sourceHeader) {
    try {
      sourceHeader.setPointerCapture(state.folderDragPointerId)
    } catch {
      // The pointer may already be released when a synthetic test begins drag.
    }
  }
  dispatchNewtabDragUiView({ folderOrderDragging: true, folderPendingId: '' })
  createFolderDragGhost(sourceHeader)
  patchFolderDraggingState(state.draggingFolderId, true)
}

function handleFolderPointerMove(event: PointerEvent): void {
  if (!state.draggingFolderId || event.pointerId !== state.folderDragPointerId) {
    return
  }

  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY

  if (!state.folderDragOriginalOrderIds.length) {
    const distance = Math.hypot(
      event.clientX - state.folderDragStartX,
      event.clientY - state.folderDragStartY
    )
    if (state.folderDragPointerType === 'mouse') {
      if (distance < POINTER_DRAG_START_THRESHOLD_PX) {
        return
      }
      beginFolderDrag()
    } else {
      if (distance >= TOUCH_DRAG_CANCEL_THRESHOLD_PX) {
        cancelFolderDrag()
      }
      return
    }
  }

  if (!state.folderDragOriginalOrderIds.length) {
    return
  }

  event.preventDefault()
  updateFolderDragGhost()
  const insertIndex = getFolderInsertIndex(event.clientY)
  if (insertIndex < 0) {
    return
  }

  if (moveDraggedFolderInState(insertIndex)) {
    renderWithFolderFlip()
    updateFolderDragGhost({ immediate: true })
  }
}

async function finishFolderDrag(event: PointerEvent): Promise<void> {
  if (!state.draggingFolderId || event.pointerId !== state.folderDragPointerId) {
    return
  }

  window.clearTimeout(state.folderDragLongPressTimer)
  state.folderDragLongPressTimer = 0
  state.folderDragPointerId = 0
  window.cancelAnimationFrame(folderDragGhostFrame)
  folderDragGhostFrame = 0

  const wasDragging = Boolean(state.folderDragOriginalOrderIds.length)
  const generation = folderDragGeneration
  const finalOrderIds = state.folderSections.map((section) => section.id)
  const originalOrderIds = [...state.folderDragOriginalOrderIds]
  const originalSections = [...state.folderDragOriginalSections]
  const targetHeaderRect = getActiveFolderDragHeader()?.getBoundingClientRect() || null
  if (wasDragging && targetHeaderRect) {
    await settleNewtabDragGhost('.folder-drag-ghost', targetHeaderRect.left, targetHeaderRect.top)
  }
  if (generation !== folderDragGeneration) return
  clearFolderDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: finalOrderIds
  })
  markSearchIndexDirty()
  try {
    await saveFolderSettings()
    syncFolderSettingsControls()
    setFolderReorderStatus('文件夹顺序已保存。', 'success')
  } catch (error) {
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: originalOrderIds
    })
    settingsPersistence.discard(STORAGE_KEYS.newTabFolderSettings, state.folderSettings)
    restoreFolderDragOrder(originalOrderIds, originalSections)
    markSearchIndexDirty()
    syncFolderSettingsControls()
    const message = error instanceof Error ? error.message : '请稍后重试。'
    setFolderReorderStatus(`文件夹顺序保存失败，已恢复到拖拽前顺序。${message}`, 'error')
  }
}

function cancelFolderDrag({ keepSuppressClick = false } = {}): void {
  if (!state.draggingFolderId && !state.folderDragLongPressTimer) {
    return
  }

  window.clearTimeout(state.folderDragLongPressTimer)
  const originalOrderIds = [...state.folderDragOriginalOrderIds]
  const originalSections = [...state.folderDragOriginalSections]
  clearFolderDragState({ keepSuppressClick })
  restoreFolderDragOrder(originalOrderIds, originalSections)
  render()
}

function clearFolderDragState({ keepSuppressClick = false } = {}): void {
  folderDragGeneration += 1
  patchFolderDraggingState(state.draggingFolderId, false)
  state.draggingFolderId = ''
  state.folderDragPointerId = 0
  state.folderDragLongPressTimer = 0
  state.folderDragClientX = 0
  state.folderDragClientY = 0
  state.folderDragStartX = 0
  state.folderDragStartY = 0
  state.folderDragPointerType = ''
  state.folderDragOffsetX = 0
  state.folderDragOffsetY = 0
  state.folderDragOriginalOrderIds = []
  state.folderDragOriginalSections = []
  folderDragSectionRectSnapshot = null
  syncDragWindowListeners()
  removeFolderDragGhost()
  dispatchNewtabDragUiView({ folderOrderDragging: false, folderPendingId: '' })

  if (keepSuppressClick) {
    state.folderDragSuppressClick = true
    window.setTimeout(() => {
      state.folderDragSuppressClick = false
    }, 250)
  } else {
    state.folderDragSuppressClick = false
  }
}

function patchFolderDraggingState(folderId: string, dragging: boolean): void {
  const normalizedFolderId = String(folderId || '').trim()
  if (!normalizedFolderId) {
    return
  }

  patchNewtabBookmarkContentView((view) => {
    let changed = false
    const sections = view.sections.map((section) => {
      if (section.folderId !== normalizedFolderId || section.dragging === dragging) {
        return section
      }
      changed = true
      return {
        ...section,
        dragging
      }
    })

    return changed
      ? {
          ...view,
          sections
        }
      : view
  })
}

function createFolderDragGhost(sourceHeader = getActiveFolderDragHeader()): void {
  removeFolderDragGhost()

  if (!sourceHeader || !state.draggingFolderId) {
    return
  }

  const section = state.folderSections.find((section) => section.id === state.draggingFolderId)
  if (!section) {
    return
  }

  // Ghost 用导航模式的文件夹卡片形态（玻璃卡片），尺寸取一张 live 书签卡片的
  // 实际 rect（拖拽手感与书签卡片一致）；没有可参照的卡片时退回标题尺寸。
  const referenceTile = getNewtabBookmarkContentNodes().tiles.values().next().value as HTMLElement | undefined
  const referenceRect = referenceTile?.getBoundingClientRect()
  const headerRect = sourceHeader.getBoundingClientRect()
  const width = referenceRect && referenceRect.width > 0 ? referenceRect.width : Math.max(headerRect.width, 168)
  const height = referenceRect && referenceRect.height > 0 ? referenceRect.height : Math.max(headerRect.height, 48)
  dispatchFolderDragGhostView({
    bookmarkCount: section.bookmarks.length,
    height,
    style: getBookmarkDragGhostStyle(undefined),
    title: section.title,
    transform: 'translate3d(0, 0, 0)',
    width
  })
  updateFolderDragGhost({ immediate: true })
}

function getActiveFolderDragHeader(): HTMLElement | null {
  if (!state.draggingFolderId) {
    return null
  }

  return getNewtabBookmarkContentNodes().folderHeaders.get(state.draggingFolderId) || null
}

function updateFolderDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateFolderDragGhostPosition()
    return
  }

  if (folderDragGhostFrame) {
    return
  }

  folderDragGhostFrame = window.requestAnimationFrame(() => {
    folderDragGhostFrame = 0
    updateFolderDragGhostPosition()
  })
}

function updateFolderDragGhostPosition(): void {
  const left = state.folderDragClientX - state.folderDragOffsetX
  const top = state.folderDragClientY - state.folderDragOffsetY
  patchFolderDragGhostView((view) => ({
    ...view,
    transform: `translate3d(${left}px, ${top}px, 0)`
  }))
}

function removeFolderDragGhost(): void {
  window.cancelAnimationFrame(folderDragGhostFrame)
  folderDragGhostFrame = 0
  dispatchFolderDragGhostView(null)
}

async function settleNewtabDragGhost(
  selector: string,
  left: number,
  top: number
): Promise<void> {
  if (prefersReducedMotion()) {
    return
  }
  const ghost = document.querySelector<HTMLElement>(selector)
  if (!ghost) {
    return
  }
  const currentTransform = getComputedStyle(ghost).transform
  for (const existing of ghost.getAnimations()) {
    existing.cancel()
  }
  const animation = ghost.animate(
    [
      { transform: currentTransform === 'none' ? ghost.style.transform : currentTransform },
      { transform: `translate3d(${left}px, ${top}px, 0) scale(1)` }
    ],
    {
      duration: getMotionDurationMs('--drag-settle-dur', 160),
      easing: getMotionEasing('--ds-ease-settle', 'cubic-bezier(0.32, 0.72, 0, 1)'),
      fill: 'forwards'
    }
  )
  try {
    await animation.finished
  } catch {
    // Cancellation means a new gesture retargeted the same preview.
  }
}

function getFolderSectionRects(): FolderDragSectionRectSnapshot {
  const nodes = getNewtabBookmarkContentNodes()
  return createFolderDragSectionRectSnapshot(
    state.folderSections
      .map((section) => {
        const element = nodes.folderSections.get(section.id)
        if (!element) {
          return null
        }
        const rect = element.getBoundingClientRect()
        return {
          id: section.id,
          top: rect.top,
          height: rect.height
        }
      })
      .filter((section): section is { id: string; top: number; height: number } => Boolean(section))
  )
}

function renderWithFolderFlip(): void {
  const previousRects = folderDragSectionRectSnapshot || getFolderSectionRects()
  render()
  const currentSnapshot = projectFolderDragSectionRectSnapshot(previousRects, state.folderSections.map((section) => section.id))

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    folderDragSectionRectSnapshot = currentSnapshot
    return
  }

  for (const delta of getFolderFlipDeltasFromSnapshots(
    previousRects,
    currentSnapshot,
    state.draggingFolderId
  )) {
    const section = getNewtabBookmarkContentNodes().folderSections.get(delta.folderId) || null
    if (!section) {
      continue
    }
    let currentOffsetY = 0
    const activeFlips = section.getAnimations().filter((animation) => animation.id === 'folder-flip')
    if (activeFlips.length) {
      const transform = getComputedStyle(section).transform
      if (transform && transform !== 'none') {
        currentOffsetY = new DOMMatrixReadOnly(transform).m42
      }
      for (const animation of activeFlips) {
        animation.cancel()
      }
    }
    section.animate(
      [
        { transform: `translate3d(0, ${delta.deltaY + currentOffsetY}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ],
      {
        id: 'folder-flip',
        // 与书签卡片让位（BOOKMARK_TILE_DRAG_RESTING_MOTION_CLASS）共用
        // drag settle 时长和 easing，避免不同拖拽模式在落位时变速。
        duration: getMotionDurationMs('--drag-settle-dur', 160),
        easing: getMotionEasing('--ds-ease-settle', 'cubic-bezier(0.32, 0.72, 0, 1)')
      }
    )
  }
  folderDragSectionRectSnapshot = currentSnapshot
}

function getFolderInsertIndex(clientY: number): number {
  const snapshot = folderDragSectionRectSnapshot || getFolderSectionRects()
  return getFolderInsertIndexFromSnapshot(clientY, snapshot)
}

function moveDraggedFolderInState(insertIndex: number): boolean {
  const currentIndex = state.folderSections.findIndex(
    (section) => section.id === state.draggingFolderId
  )
  if (currentIndex < 0) {
    return false
  }

  const nextSections = [...state.folderSections]
  const [draggedSection] = nextSections.splice(currentIndex, 1)
  const normalizedIndex = Math.max(
    0,
    Math.min(
      currentIndex < insertIndex ? insertIndex - 1 : insertIndex,
      nextSections.length
    )
  )

  if (currentIndex === normalizedIndex) {
    return false
  }

  nextSections.splice(normalizedIndex, 0, draggedSection)
  state.folderSections = nextSections
  refreshDerivedBookmarkState()
  return true
}

function restoreFolderDragOrder(
  originalOrderIds: string[],
  originalSections: NewTabFolderSection[]
): boolean {
  if (!originalOrderIds.length || originalSections.length !== originalOrderIds.length) {
    return false
  }

  const sectionById = new Map(originalSections.map((section) => [section.id, section]))
  const restoredSections: NewTabFolderSection[] = []
  for (const folderId of originalOrderIds) {
    const section = sectionById.get(folderId)
    if (!section) {
      return false
    }
    restoredSections.push(section)
  }

  state.folderSections = restoredSections
  refreshDerivedBookmarkState()
  return true
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function handleBookmarkCreated(
  _bookmarkId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  bookmarkTreeEventVersion += 1
  if (state.reorderingBookmarks) {
    scheduleBookmarkChangeRefresh()
    return
  }

  const createdBookmark = Boolean(bookmark?.url)
  const insertedLocally = createdBookmark ? insertBookmarkInPlace(bookmark) : false
  const result = getBookmarkCreationIncrementalResult({
    createdBookmark,
    parentRelevant: true,
    insertedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function handleBookmarkChanged(bookmarkId: string, changeInfo: BookmarkChangeInfo): void {
  bookmarkTreeEventVersion += 1
  if (state.reorderingBookmarks) {
    scheduleBookmarkChangeRefresh()
    return
  }

  const id = String(bookmarkId || '').trim()
  if (!id) {
    scheduleBookmarkChangeRefresh()
    return
  }

  if (!patchBookmarkInPlace(id, changeInfo)) {
    scheduleBookmarkChangeRefresh()
  }
}

function insertBookmarkInPlace(bookmark: chrome.bookmarks.BookmarkTreeNode): boolean {
  const bookmarkId = String(bookmark?.id || '').trim()
  const parentId = String(bookmark?.parentId || '').trim()
  if (!bookmarkId || !bookmark?.url || !parentId) {
    return false
  }

  const targetSection = state.folderSections.find((section) => section.id === parentId)
  const parentNode = state.folderNodeMap.get(parentId) || targetSection?.node || null
  if (!parentNode) {
    return false
  }

  const existingChildren = Array.isArray(parentNode.children) ? parentNode.children : []
  const alreadyInTree = existingChildren.some((child) => String(child.id) === bookmarkId)
  const alreadyInSection = targetSection?.bookmarks.some((item) => String(item.id) === bookmarkId)
  if (alreadyInSection) {
    return true
  }

  if (!alreadyInTree) {
    const nextChildren = [...existingChildren]
    const insertIndex = typeof bookmark.index === 'number'
      ? Math.max(0, Math.min(bookmark.index, nextChildren.length))
      : nextChildren.length
    nextChildren.splice(insertIndex, 0, bookmark)
    parentNode.children = reindexBookmarkChildren(nextChildren)
  }

  state.folderSections = state.folderSections.map((section) => {
    if (section.id !== parentId) {
      return section
    }

    const nextBookmarks = (parentNode.children || []).filter((child) => Boolean(child.url))
    return {
      ...section,
      bookmarks: nextBookmarks,
      directBookmarkCount: nextBookmarks.length,
      totalBookmarkCount: Math.max(
        alreadyInTree ? section.totalBookmarkCount : section.totalBookmarkCount + 1,
        nextBookmarks.length
      )
    }
  })
  state.bookmarks = getAllSectionBookmarks()
  state.bookmarkMap = new Map(state.bookmarks.map((item) => [String(item.id), item]))
  if (!state.allBookmarkMap.has(bookmarkId)) {
    state.allBookmarks.push(bookmark)
    state.allBookmarkMap.set(bookmarkId, bookmark)
  }
  markSearchIndexDirty({ force: true })
  scheduleRender()
  return true
}

function patchBookmarkInPlace(
  bookmarkId: string,
  changeInfo: BookmarkChangeInfo
): boolean {
  const node = state.allBookmarkMap.get(bookmarkId) || state.bookmarkMap.get(bookmarkId)
  if (!node || !node.url) {
    return false
  }

  if (changeInfo.title !== undefined) {
    node.title = changeInfo.title
  }
  if (changeInfo.url !== undefined) {
    node.url = changeInfo.url
  }
  markSearchIndexDirty({ force: true })

  const updatedBookmarkContent = state.bookmarkMap.has(bookmarkId)
  if (updatedBookmarkContent) {
    renderBookmarkSections()
  }

  const speedDialView = getNewtabSpeedDialView()
  const updatedSpeedDial = speedDialView?.content.type === 'items' &&
    speedDialView.content.items.some((item) => String(item.id) === bookmarkId)
  if (updatedSpeedDial) {
    refreshSpeedDialPanel()
  }

  return true
}

function handleBookmarkRemoved(bookmarkId: string, removeInfo: BookmarkRemoveInfo): void {
  bookmarkTreeEventVersion += 1
  // Folder removal emits one event for its whole subtree. Resolve removals
  // against current persisted pins, which can be newer than this page's view.
  void persistNewtabWorkspaceMutation({
    type: 'remove', bookmarkIds: collectRemovedBookmarkNodeIds(bookmarkId, removeInfo.node)
  }).catch((error) => console.warn('已删除书签的固定入口清理失败。', error))
  if (state.reorderingBookmarks) {
    scheduleBookmarkChangeRefresh()
    return
  }

  const removedBookmark = Boolean(removeInfo.node?.url)
  if (!removedBookmark) {
    scheduleBookmarkChangeRefresh()
    return
  }

  const removedLocally = removeBookmarkFromLocalState(String(bookmarkId || ''))
  const result = getBookmarkRemovalIncrementalResult({
    removedBookmark,
    removedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function removeBookmarkFromLocalState(bookmarkId: string): boolean {
  if (!bookmarkId) {
    return false
  }

  const removedAny = forgetBookmarkFromLocalMaps(bookmarkId)
  if (removedAny) {
    markSearchIndexDirty({ force: true })
    renderBookmarkSections()
    refreshSpeedDialPanel()
  }
  return removedAny
}

function forgetBookmarkFromLocalMaps(bookmarkId: string): boolean {
  const bookmark = state.allBookmarkMap.get(bookmarkId) || state.bookmarkMap.get(bookmarkId)
  const parent = bookmark?.parentId ? state.folderNodeMap.get(String(bookmark.parentId)) : null
  if (parent) removeBookmarkFromParentNode(parent, bookmarkId)
  const removedVisible = state.bookmarkMap.delete(bookmarkId)
  const removedAny = state.allBookmarkMap.delete(bookmarkId) || removedVisible
  if (removedAny) {
    state.bookmarks = state.bookmarks.filter((bookmark) => String(bookmark.id) !== bookmarkId)
    state.allBookmarks = state.allBookmarks.filter((bookmark) => String(bookmark.id) !== bookmarkId)
    state.folderSections = state.folderSections.map((section) => {
      if (!section.bookmarks.some((bookmark) => String(bookmark.id) === bookmarkId)) {
        return section
      }
      const nodeChildren = Array.isArray(section.node.children)
        ? section.node.children.filter((child) => String(child.id) !== bookmarkId)
        : section.node.children
      if (Array.isArray(section.node.children)) {
        section.node.children = nodeChildren
      }
      return {
        ...section,
        bookmarks: section.bookmarks.filter((bookmark) => String(bookmark.id) !== bookmarkId),
        directBookmarkCount: Math.max(0, section.directBookmarkCount - 1),
        totalBookmarkCount: Math.max(0, section.totalBookmarkCount - 1)
      }
    })
    state.faviconRefreshTokens.delete(bookmarkId)
  }
  return removedAny
}

function handleBookmarkMoved(
  bookmarkId: string,
  moveInfo?: BookmarkMoveInfo
): void {
  bookmarkTreeEventVersion += 1
  const ownMove = state.selfBookmarkMoveIds.has(String(bookmarkId)) && Date.now() <= state.selfBookmarkMoveSuppressUntil
  if (isSelfBookmarkMoveEvent(bookmarkId)) {
    if (!ownMove) scheduleBookmarkChangeRefresh()
    return
  }

  const movedLocally = moveInfo
    ? moveBookmarkInPlace(String(bookmarkId || ''), moveInfo)
    : false
  const result = getBookmarkMoveIncrementalResult({
    movedBookmark: Boolean(getBookmarkById(bookmarkId)?.url),
    oldParentRelevant: true,
    newParentRelevant: true,
    movedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function moveBookmarkInPlace(
  bookmarkId: string,
  moveInfo: BookmarkMoveInfo
): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  const oldParentId = String(moveInfo.oldParentId || '').trim()
  const newParentId = String(moveInfo.parentId || '').trim()
  if (!normalizedBookmarkId || !oldParentId || !newParentId) {
    return false
  }

  const movedNode = state.allBookmarkMap.get(normalizedBookmarkId) || state.bookmarkMap.get(normalizedBookmarkId) || null
  if (!movedNode?.url) {
    return false
  }

  const oldParentNode = state.folderNodeMap.get(oldParentId) || null
  const newParentNode = state.folderNodeMap.get(newParentId) || null
  if (!oldParentNode || !newParentNode) {
    return false
  }

  const oldSection = state.folderSections.find((section) => section.id === oldParentId) || null
  const newSection = state.folderSections.find((section) => section.id === newParentId) || null
  if (
    oldSection &&
    !oldSection.bookmarks.some((bookmark) => String(bookmark.id) === normalizedBookmarkId)
  ) {
    return false
  }
  if (
    newSection &&
    newSection !== oldSection &&
    newSection.bookmarks.some((bookmark) => String(bookmark.id) === normalizedBookmarkId)
  ) {
    return false
  }

  if (!removeBookmarkFromParentNode(oldParentNode, normalizedBookmarkId)) {
    return false
  }

  const nextBookmark = movedNode
  nextBookmark.parentId = newParentId
  if (typeof moveInfo.index === 'number') {
    nextBookmark.index = moveInfo.index
  }

  insertBookmarkIntoParentNode(newParentNode, nextBookmark, moveInfo.index)

  state.folderSections = state.folderSections.map((section) => {
    if (section.id !== oldParentId && section.id !== newParentId) {
      return section
    }

    let nextBookmarks = section.bookmarks
    if (section.id === oldParentId) {
      nextBookmarks = nextBookmarks.filter((bookmark) => String(bookmark.id) !== normalizedBookmarkId)
    }
    if (section.id === newParentId) {
      nextBookmarks = (newParentNode.children || []).filter((child) => Boolean(child.url))
    }

    if (nextBookmarks === section.bookmarks) {
      return section
    }

    const counts = getFolderBookmarkCounts(section.node)
    return {
      ...section,
      bookmarks: nextBookmarks,
      directBookmarkCount: counts.directBookmarkCount,
      totalBookmarkCount: counts.totalBookmarkCount
    }
  })

  movedNode.parentId = newParentId
  if (typeof moveInfo.index === 'number') {
    movedNode.index = moveInfo.index
  }
  const nextBookmarks = getAllSectionBookmarks()
  state.bookmarks = nextBookmarks
  state.bookmarkMap = new Map(nextBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  state.folderNode = state.folderSections[0]?.node || null
  state.bookmarkCatalog = null
  markSearchIndexDirty({ force: true })
  renderBookmarkSections()
  return true
}

function removeBookmarkFromParentNode(
  parentNode: chrome.bookmarks.BookmarkTreeNode,
  bookmarkId: string
): boolean {
  if (!Array.isArray(parentNode.children)) {
    return false
  }

  const nextChildren = parentNode.children.filter((child) => String(child.id) !== bookmarkId)
  if (nextChildren.length === parentNode.children.length) {
    return false
  }

  parentNode.children = reindexBookmarkChildren(nextChildren)
  return true
}

function insertBookmarkIntoParentNode(
  parentNode: chrome.bookmarks.BookmarkTreeNode,
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  rawIndex: number | undefined
): void {
  const nextChildren = Array.isArray(parentNode.children)
    ? parentNode.children.filter((child) => String(child.id) !== String(bookmark.id))
    : []
  const insertIndex = normalizeBookmarkInsertIndex(rawIndex, nextChildren.length)
  nextChildren.splice(insertIndex, 0, bookmark)
  parentNode.children = reindexBookmarkChildren(nextChildren)
}

function reindexBookmarkChildren(
  children: chrome.bookmarks.BookmarkTreeNode[]
): chrome.bookmarks.BookmarkTreeNode[] {
  return children.map((child, index) => {
    child.index = index
    return child
  })
}

function normalizeBookmarkInsertIndex(rawIndex: number | undefined, length: number): number {
  if (!Number.isFinite(rawIndex)) {
    return length
  }
  return Math.max(0, Math.min(Math.trunc(Number(rawIndex)), length))
}

function scheduleBookmarkChangeRefresh(): void {
  if (!newTabControllerStarted) return
  bookmarkChangeRefreshQueued = true
  if (state.loading || newTabRefreshStorageChanges || bookmarkChangeRefreshTimer || bookmarkChangeRefreshInFlight) {
    return
  }

  bookmarkChangeRefreshTimer = window.setTimeout(() => {
    bookmarkChangeRefreshTimer = 0
    void flushBookmarkChangeRefresh()
  }, BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS)
}

async function flushBookmarkChangeRefresh(): Promise<void> {
  if (!newTabControllerStarted || state.loading || newTabRefreshStorageChanges || bookmarkChangeRefreshInFlight || !bookmarkChangeRefreshQueued) {
    return
  }

  bookmarkChangeRefreshQueued = false
  bookmarkChangeRefreshInFlight = true
  const session = newTabControllerGeneration
  const refreshVersion = newTabRefreshVersion
  try {
    // Native bookmark events must not rehydrate settings or clear an in-progress
    // search/settings draft. Refresh only the tree and its derived views.
    const eventVersion = bookmarkTreeEventVersion
    const tree = await getBookmarkTree()
    if (session !== newTabControllerGeneration || !newTabControllerStarted) return
    if (refreshVersion !== newTabRefreshVersion || newTabRefreshStorageChanges || eventVersion !== bookmarkTreeEventVersion || state.reorderingBookmarks || state.draggingBookmarkId) {
      bookmarkChangeRefreshQueued = true
      return
    }
    state.rootNode = tree[0] || null
    state.folderNodeMap = buildFolderNodeMap(state.rootNode)
    state.bookmarkCatalog = null
    state.folderData = refreshBookmarkCatalog().extracted
    state.folderSections = buildNewTabFolderSections(state.rootNode, state.folderSettings)
    refreshDerivedBookmarkState()
    markSearchIndexDirty({ force: true })
    syncFolderSettingsControls()
    render()
  } catch (error) {
    console.warn('新标签页书签更新失败。', error)
  } finally {
    if (session === newTabControllerGeneration) {
      bookmarkChangeRefreshInFlight = false
      if (bookmarkChangeRefreshQueued) {
        scheduleBookmarkChangeRefresh()
      }
    }
  }
}

function isSelfBookmarkMoveEvent(bookmarkId: string): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (
    normalizedBookmarkId &&
    state.selfBookmarkMoveIds.has(normalizedBookmarkId) &&
    Date.now() <= state.selfBookmarkMoveSuppressUntil
  ) {
    state.selfBookmarkMoveIds.delete(normalizedBookmarkId)
    return true
  }

  if (Date.now() > state.selfBookmarkMoveSuppressUntil) {
    state.selfBookmarkMoveIds.clear()
  }

  return state.reorderingBookmarks
}

function isActiveMenuBookmarkPinned(): boolean {
  const bookmark = getActiveMenuBookmark()
  return Boolean(bookmark && isBookmarkPinnedInSpeedDial(getActiveWorkspacePinnedIds(), String(bookmark.id)))
}

async function toggleActiveMenuBookmarkPin(): Promise<void> {
  if (state.menuBusy) return
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id)
  const session = bookmarkMenuSession
  const controllerSession = newTabControllerGeneration
  const workspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const pinned = isBookmarkPinnedInSpeedDial(workspace.pinnedIds, bookmarkId)
  try {
    state.menuBusy = true
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
    const workspaceSettings = await persistNewtabWorkspaceMutation({ type: 'pin', bookmarkId, pinned: !pinned })
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    state.workspaceSettings = workspaceSettings
    scheduleRender()
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    const copy = getSpeedDialPinActionCopyLocal(pinned)
    state.menuError = ''
    state.menuStatus = copy.status
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  } catch (error) {
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '固定状态保存失败，请稍后重试。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  }
}

async function saveBookmarkMenuChanges(): Promise<void> {
  if (state.menuBusy) return
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  const session = bookmarkMenuSession
  const controllerSession = newTabControllerGeneration
  let bookmarkSaved = false
  try {
    const previousTitle = String(bookmark.title || '').trim()
    const previousUrl = String(bookmark.url || '').trim()
    const title = state.editTitle.trim() || state.editUrl.trim()
    const url = normalizeBookmarkInputUrl(state.editUrl)
    const customIcon = getCustomIconChoice(bookmark.id)
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu()

    await updateBookmarkLazy(bookmark.id, { title, url })
    bookmarkSaved = true
    await persistCustomIconChoice(bookmark.id, customIcon)
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    if (previousUrl !== url) {
      state.faviconRefreshTokens.set(bookmark.id, Date.now())
    }
    if (previousTitle !== title || previousUrl !== url) {
      publishNewTabUndoAction({
        kind: 'edit-bookmark',
        bookmarkId: bookmark.id,
        bookmarkLabel: title || url,
        previousTitle,
        previousUrl
      })
    }
    if (isCurrentBookmarkMenuSession(session)) closeBookmarkMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.menuStatus = ''
    const detail = error instanceof Error ? error.message : '请稍后重试。'
    state.menuError = bookmarkSaved ? `名称和网址已保存，但图标保存失败：${detail}` : `保存失败：${detail}`
    renderBookmarkMenu()
  }
}

async function copyActiveMenuBookmarkUrl(): Promise<void> {
  if (state.menuBusy) return
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  const session = bookmarkMenuSession
  bookmarkCopyFeedback = actionFeedback('pending')
  try {
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu({ focusFirst: false })
    await writeClipboardText(bookmark.url)
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.menuError = ''
    bookmarkCopyFeedback = actionFeedback('success')
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  } catch (error) {
    if (!isCurrentBookmarkMenuSession(session)) return
    bookmarkCopyFeedback = actionFeedback('error')
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? `复制失败：${error.message}` : '复制失败，请手动复制链接。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  }
}

async function moveActiveMenuBookmark(folderId: string): Promise<void> {
  if (state.menuBusy) return
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }
  if (bookmark.parentId === folderId || bookmark.unmodifiable === 'managed') return
  const folder = state.folderNodeMap.get(folderId)
  if (!folder || folder.id === '0' || folder.unmodifiable === 'managed') {
    state.menuError = '目标文件夹已不可用，请重新选择。'
    state.menuStatus = ''
    renderBookmarkMenu({ focusFirst: false, focusAction: 'move-bookmark' })
    return
  }

  const session = bookmarkMenuSession
  const fromParentId = String(bookmark.parentId || '')
  const fromIndex = Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0
  const targetFolderTitle = String(folder.title || '未命名文件夹').trim() || '未命名文件夹'
  state.menuBusy = true
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu({ focusFirst: false })
  try {
    await moveBookmarkLazy(bookmark.id, folderId)
    // Native bookmark events update the tree without rehydrating settings or
    // committing the title, URL and icon drafts still being edited in this menu.
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.menuStatus = `已移动到「${targetFolderTitle}」`
    if (fromParentId) {
      publishNewTabUndoAction({
        kind: 'move-bookmark',
        bookmarkId: bookmark.id,
        bookmarkLabel: getBookmarkDisplayTitle(bookmark),
        fromParentId,
        fromIndex,
        toFolderTitle: targetFolderTitle
      })
    }
    renderBookmarkMenu({ focusFirst: false, focusAction: 'move-bookmark' })
  } catch (error) {
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'move-bookmark' })
  }
}

async function deleteActiveMenuBookmark(): Promise<void> {
  if (state.menuBusy) return
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  const session = bookmarkMenuSession
  const controllerSession = newTabControllerGeneration
  try {
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = `正在删除 1 个书签：「${getBookmarkDisplayTitle(bookmark)}」...`
    renderBookmarkMenu({ focusFirst: false, focusAction: 'delete-bookmark' })

    const recycleId = `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const deleted = await deleteBookmarkToRecycleLazy(bookmark.id, {
      recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title || '未命名书签',
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: getBookmarkFolderPath(bookmark) || DEFAULT_NEW_TAB_FOLDER_TITLE,
      source: '新标签页删除',
      deletedAt: Date.now()
    }, {
      expectedUrl: bookmark.url
    })
    if (!deleted) {
      throw new Error('书签地址已变化，已取消删除。')
    }
    const deletedCustomIcon = state.customIcons[bookmark.id]
    if (deletedCustomIcon) {
      await Promise.all([
        setBookmarkCustomIcon(bookmark.id, null).catch((error) => {
          console.warn('新标签页自定义图标清理失败。', error)
        }),
        removeBookmarkFromActivity(bookmark.id).catch((error) => {
          console.warn('新标签页打开记录清理失败。', error)
        }),
        removeBookmarkFromWorkspacePins(bookmark.id).catch((error) => {
          console.warn('新标签页 workspace 固定入口清理失败。', error)
        })
      ])
    } else {
      await Promise.all([
        removeBookmarkFromActivity(bookmark.id).catch((error) => {
          console.warn('新标签页打开记录清理失败。', error)
        }),
        removeBookmarkFromWorkspacePins(bookmark.id).catch((error) => {
          console.warn('新标签页 workspace 固定入口清理失败。', error)
        })
      ])
    }

    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    publishNewTabUndoAction({
      kind: 'delete-bookmark',
      bookmark,
      recycleId,
      deletedAt: Date.now(),
      customIcon: deletedCustomIcon
    })
    if (isCurrentBookmarkMenuSession(session)) closeBookmarkMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '删除失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

function clearUndoToastAutoDismiss(): void {
  if (undoToastAutoDismissTimer) {
    window.clearTimeout(undoToastAutoDismissTimer)
    undoToastAutoDismissTimer = 0
  }
}

function publishNewTabUndoAction(action: NewTabUndoActionState): void {
  clearUndoToastAutoDismiss()
  state.lastUndoAction = action
  state.deleteToastBusy = false
  state.deleteToastStatus = ''
  state.deleteToastTitle = ''
  state.deleteToastTone = 'success'
  renderDeleteToast()
  if (action.kind !== 'delete-bookmark' && action.kind !== 'delete-folder') {
    undoToastAutoDismissTimer = window.setTimeout(() => {
      undoToastAutoDismissTimer = 0
      if (state.lastUndoAction === action && !state.deleteToastBusy) {
        state.lastUndoAction = null
        renderDeleteToast()
      }
    }, 10000)
  }
}

async function undoLastDeletedBookmark(): Promise<void> {
  const action = state.lastUndoAction
  if (!action || state.deleteToastBusy) {
    return
  }

  clearUndoToastAutoDismiss()
  const session = newTabControllerGeneration
  state.deleteToastBusy = true
  state.deleteToastStatus = action.kind === 'delete-bookmark' || action.kind === 'delete-folder' ? '正在恢复...' : '正在撤销...'
  state.deleteToastTitle = ''
  state.deleteToastTone = 'success'
  renderDeleteToast()

  try {
    let restoredBookmark: chrome.bookmarks.BookmarkTreeNode | null = null
    if (action.kind === 'delete-bookmark') {
      restoredBookmark = await restoreBookmarkFromRecycleEntryLazy(action.recycleId)
    } else if (action.kind === 'delete-folder') {
      await restoreFolderTreeFromUndoLazy(action.undoEntry)
    } else if (action.kind === 'move-bookmark') {
      await moveBookmarkLazy(action.bookmarkId, action.fromParentId, action.fromIndex)
    } else if (action.kind === 'edit-bookmark') {
      await updateBookmarkLazy(action.bookmarkId, { title: action.previousTitle, url: action.previousUrl })
    } else if (action.kind === 'rename-folder') {
      await updateBookmarkLazy(action.folderId, { title: action.previousTitle })
    } else if (action.kind === 'move-folder') {
      await moveBookmarkLazy(action.folderId, action.fromParentId, action.fromIndex)
    } else if (action.kind === 'sort-folder') {
      const folderNode = state.folderNodeMap.get(action.folderId)
      if (!folderNode) {
        throw new Error('文件夹已不存在，无法恢复排序。')
      }
      const moves = planDirectBookmarkSortMoves(folderNode.children || [], action.previousDirectBookmarkIds)
      for (const move of moves) {
        await moveBookmarkLazy(move.bookmarkId, action.folderId, move.index)
      }
    }
    if (session !== newTabControllerGeneration || !newTabControllerStarted) return
    if (state.lastUndoAction === action) state.lastUndoAction = null
    state.deleteToastBusy = false
    state.deleteToastStatus = ''
    state.deleteToastTitle = ''
    state.deleteToastTone = 'success'
    // The bookmark already exists in Chrome; insert it now instead of leaving
    // the grid stale until the background refresh lands, so the restore never
    // reads as a stalled toast.
    if (restoredBookmark) {
      insertBookmarkInPlace(restoredBookmark)
      render()
    }
    renderDeleteToast()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (session !== newTabControllerGeneration || !newTabControllerStarted) return
    state.deleteToastBusy = false
    if (state.lastUndoAction === action) {
      const isDelete = action.kind === 'delete-bookmark' || action.kind === 'delete-folder'
      state.deleteToastStatus = error instanceof Error ? error.message : (isDelete ? '恢复失败，请打开回收站处理。' : '撤销失败，请稍后重试。')
      state.deleteToastTitle = isDelete ? '恢复失败' : '撤销失败'
      state.deleteToastTone = 'error'
    }
    renderDeleteToast()
  }
}

function openRecycleBin(): void {
  const url = chrome.runtime.getURL('src/options/options.html#recycle')
  const clearToast = () => {
    clearUndoToastAutoDismiss()
    state.lastUndoAction = null
    state.deleteToastStatus = ''
    state.deleteToastTitle = ''
    state.deleteToastTone = 'success'
    renderDeleteToast()
  }
  const created = chrome.tabs?.create?.({ url })
  if (created && typeof created.then === 'function') {
    void created.then(
      () => {
        clearToast()
      },
      () => {
        if (!state.lastUndoAction) {
          return
        }
        state.deleteToastTitle = '无法打开回收站'
        state.deleteToastTone = 'error'
        state.deleteToastStatus = '回收站打开失败，请在扩展设置中手动打开。'
        renderDeleteToast()
      }
    )
    return
  }
  clearToast()
}

function openOptionsHash(hash: string): void {
  const normalizedHash = String(hash || '').startsWith('#') ? String(hash) : `#${String(hash || '').trim()}`
  const url = chrome.runtime.getURL(`src/options/options.html${normalizedHash}`)
  void chrome.tabs?.create?.({ url })?.catch?.(() => {
    setBackgroundStatus('设置页打开失败，请手动打开扩展设置。', 'error')
    render()
  })
}

function openAiProviderSettings(): void {
  openOptionsHash('#general:ai-provider')
}

function getBookmarkDisplayTitle(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  return String(bookmark.title || '').trim() || String(bookmark.url || '').trim() || '未命名书签'
}

function getBookmarkActionLabelContext(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const title = getBookmarkDisplayTitle(bookmark)
  return title.length > 48 ? `${title.slice(0, 47).trim()}…` : title
}

function refreshActiveMenuIcon(): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  state.faviconRefreshTokens.set(bookmark.id, Date.now())
  clearActiveFaviconSource(String(bookmark.url || ''))
  if (!renderBookmarkSections()) {
    render()
  }
  scheduleAdaptiveNewTabLayoutUpdate()
  renderBookmarkMenu({ focusFirst: false, focusAction: 'refresh-icon' })
}

function expandAddBookmarkMenu(): void {
  state.addMenuExpanded = true
  state.addMenuMode = 'bookmark'
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function expandAddFolderMenu(): void {
  state.addMenuExpanded = true
  state.addMenuMode = 'folder'
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

async function saveAddedFolder(): Promise<void> {
  if (!state.addMenuOpen || state.addMenuBusy) return
  const session = addBookmarkMenuSession
  const controllerSession = newTabControllerGeneration
  const validation = validateFolderTitle(state.addFolderTitle)
  if ('error' in validation) {
    state.addMenuError = validation.error
    renderAddBookmarkMenu({ focusFirst: false })
    return
  }
  try {
    state.addMenuBusy = true
    state.addMenuError = ''
    renderAddBookmarkMenu({ focusFirst: false })
    const parentId =
      state.addFolderId ||
      (state.folderSettings.browseMode === 'navigation' ? state.bookmarkNavigationPath[state.bookmarkNavigationPath.length - 1] : '') ||
      state.folderSections[0]?.id ||
      await ensureNewTabFolder()
    await createBookmarkLazy({
      parentId,
      title: validation.title
    })
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    if (session === addBookmarkMenuSession) closeAddBookmarkMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (session !== addBookmarkMenuSession) return
    state.addMenuBusy = false
    state.addMenuError = error instanceof Error ? error.message : '新建文件夹失败，请稍后重试。'
    renderAddBookmarkMenu({ focusFirst: false })
  }
}

function getActiveMenuFolder(): chrome.bookmarks.BookmarkTreeNode | null {
  return state.activeMenuFolderId ? (state.folderNodeMap.get(state.activeMenuFolderId) || null) : null
}

function isCurrentFolderMenuSession(session: number): boolean {
  return session === folderMenuSession && Boolean(state.activeMenuFolderId)
}

async function saveFolderMenuRename(): Promise<void> {
  if (state.folderMenuBusy) return
  const folder = getActiveMenuFolder()
  if (!folder) {
    closeFolderMenu()
    return
  }
  if (isProtectedBookmarkFolder(folder)) {
    state.folderMenuError = '系统默认书签目录不能重命名。'
    renderFolderMenu({ focusFirst: false })
    return
  }
  const validation = validateFolderTitle(state.folderMenuTitle)
  if ('error' in validation) {
    state.folderMenuError = validation.error
    renderFolderMenu({ focusFirst: false })
    return
  }
  const previousTitle = String(folder.title || '').trim()
  if (validation.title === previousTitle) {
    closeFolderMenu({ restoreFocus: true })
    return
  }
  const session = folderMenuSession
  const controllerSession = newTabControllerGeneration
  state.folderMenuBusy = true
  state.folderMenuError = ''
  state.folderMenuStatus = ''
  renderFolderMenu({ focusFirst: false })
  try {
    await updateBookmarkLazy(folder.id, { title: validation.title })
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    publishNewTabUndoAction({
      kind: 'rename-folder',
      folderId: folder.id,
      previousTitle,
      nextTitle: validation.title
    })
    if (isCurrentFolderMenuSession(session)) closeFolderMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (!isCurrentFolderMenuSession(session)) return
    state.folderMenuBusy = false
    state.folderMenuError = error instanceof Error ? `重命名失败：${error.message}` : '重命名失败，请稍后重试。'
    renderFolderMenu({ focusFirst: false })
  }
}

async function createActiveMenuSubfolder(): Promise<void> {
  if (state.folderMenuBusy) return
  const folder = getActiveMenuFolder()
  if (!folder) {
    closeFolderMenu()
    return
  }
  const validation = validateFolderTitle(state.folderMenuSubfolderTitle)
  if ('error' in validation) {
    state.folderMenuError = validation.error
    renderFolderMenu({ focusFirst: false })
    return
  }
  const session = folderMenuSession
  const controllerSession = newTabControllerGeneration
  state.folderMenuBusy = true
  state.folderMenuError = ''
  state.folderMenuStatus = ''
  renderFolderMenu({ focusFirst: false })
  try {
    await createBookmarkLazy({
      parentId: folder.id,
      title: validation.title
    })
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    if (isCurrentFolderMenuSession(session)) {
      state.folderMenuBusy = false
      state.folderMenuSubfolderExpanded = false
      state.folderMenuSubfolderTitle = ''
      state.folderMenuStatus = `已新建子文件夹「${validation.title}」`
      renderFolderMenu({ focusFirst: false })
    }
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (!isCurrentFolderMenuSession(session)) return
    state.folderMenuBusy = false
    state.folderMenuError = error instanceof Error ? `新建失败：${error.message}` : '新建子文件夹失败，请稍后重试。'
    renderFolderMenu({ focusFirst: false })
  }
}

async function sortActiveMenuFolder(mode: PopupFolderSortMode): Promise<void> {
  if (state.folderMenuBusy) return
  const folder = getActiveMenuFolder()
  if (!folder) {
    closeFolderMenu()
    return
  }
  const directBookmarks = getDirectBookmarks(folder)
  if (directBookmarks.length < 2) {
    state.folderMenuError = '当前文件夹至少需要 2 个直属书签才能排序。'
    renderFolderMenu({ focusFirst: false, focusAction: 'sort-folder' })
    return
  }
  const session = folderMenuSession
  const controllerSession = newTabControllerGeneration
  const option = getPopupFolderSortOption(mode)
  const previousDirectBookmarkIds = directBookmarks.map((bookmark) => String(bookmark.id))
  state.folderMenuBusy = true
  state.folderMenuError = ''
  state.folderMenuStatus = ''
  renderFolderMenu({ focusFirst: false })
  try {
    let activityByBookmarkId: typeof state.activity.records | undefined
    if (mode === 'frequency-desc') {
      activityByBookmarkId = { ...state.activity.records }
      try {
        const snapshot = await loadNewTabActivityLazy()
        if (snapshot?.records) {
          activityByBookmarkId = snapshot.records
        }
      } catch {
        // Fall back to in-memory activity records if repository read fails.
      }
    }
    const { orderedIds } = computeSortedDirectBookmarkIds(directBookmarks, mode, activityByBookmarkId)
    const moves = planDirectBookmarkSortMoves(folder.children || [], orderedIds)
    if (!moves.length) {
      if (isCurrentFolderMenuSession(session)) {
        state.folderMenuBusy = false
        state.folderMenuStatus = `当前已符合「${option.label}」顺序`
        renderFolderMenu({ focusFirst: false, focusAction: 'sort-folder' })
      }
      return
    }
    for (const move of moves) {
      await moveBookmarkLazy(move.bookmarkId, folder.id, move.index)
    }
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    publishNewTabUndoAction({
      kind: 'sort-folder',
      folderId: folder.id,
      folderTitle: String(folder.title || '未命名文件夹'),
      sortLabel: option.label,
      previousDirectBookmarkIds
    })
    if (isCurrentFolderMenuSession(session)) closeFolderMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (!isCurrentFolderMenuSession(session)) return
    state.folderMenuBusy = false
    state.folderMenuError = error instanceof Error ? `排序失败：${error.message}` : '排序失败，请稍后重试。'
    renderFolderMenu({ focusFirst: false, focusAction: 'sort-folder' })
  }
}

async function moveActiveMenuFolder(targetParentId: string): Promise<void> {
  if (state.folderMenuBusy) return
  const folder = getActiveMenuFolder()
  if (!folder) {
    closeFolderMenu()
    return
  }
  if (isProtectedBookmarkFolder(folder)) return
  if (folder.parentId === targetParentId) return
  const blocked = collectFolderDescendantIds(folder)
  if (blocked.has(targetParentId)) {
    state.folderMenuError = '不能将文件夹移动到自身或其子文件夹内。'
    renderFolderMenu({ focusFirst: false, focusAction: 'move-folder' })
    return
  }
  const targetFolder = state.folderNodeMap.get(targetParentId)
  if (!targetFolder || targetFolder.id === '0' || targetFolder.unmodifiable === 'managed') {
    state.folderMenuError = '目标文件夹已不可用，请重新选择。'
    renderFolderMenu({ focusFirst: false, focusAction: 'move-folder' })
    return
  }
  const session = folderMenuSession
  const controllerSession = newTabControllerGeneration
  const fromParentId = String(folder.parentId || '')
  const fromIndex = Number.isFinite(Number(folder.index)) ? Number(folder.index) : 0
  const targetFolderTitle = String(targetFolder.title || '未命名文件夹').trim() || '未命名文件夹'
  state.folderMenuBusy = true
  state.folderMenuError = ''
  state.folderMenuStatus = ''
  renderFolderMenu({ focusFirst: false })
  try {
    await moveBookmarkLazy(folder.id, targetParentId)
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    if (fromParentId) {
      publishNewTabUndoAction({
        kind: 'move-folder',
        folderId: folder.id,
        folderTitle: String(folder.title || '未命名文件夹'),
        fromParentId,
        fromIndex,
        toFolderTitle: targetFolderTitle
      })
    }
    if (isCurrentFolderMenuSession(session)) closeFolderMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (!isCurrentFolderMenuSession(session)) return
    state.folderMenuBusy = false
    state.folderMenuError = error instanceof Error ? `移动失败：${error.message}` : '移动文件夹失败，请稍后重试。'
    renderFolderMenu({ focusFirst: false, focusAction: 'move-folder' })
  }
}

async function deleteActiveMenuFolder(): Promise<void> {
  if (state.folderMenuBusy) return
  const folder = getActiveMenuFolder()
  if (!folder) {
    closeFolderMenu()
    return
  }
  if (isProtectedBookmarkFolder(folder)) {
    state.folderMenuError = '系统默认书签目录不能删除。'
    renderFolderMenu({ focusFirst: false, focusAction: 'delete-folder' })
    return
  }
  const counts = countFolderSubtreeContents(folder)
  if (!state.folderMenuDeleteArmed) {
    state.folderMenuDeleteArmed = true
    state.folderMenuError = ''
    const summaryParts = [
      counts.subfolderCount > 0 ? `${counts.subfolderCount} 个子文件夹` : '',
      counts.bookmarkCount > 0 ? `${counts.bookmarkCount} 个书签` : ''
    ].filter(Boolean)
    state.folderMenuStatus = summaryParts.length
      ? `含 ${summaryParts.join('、')}，书签会进回收站且可撤销。再次点击确认删除。`
      : '将删除此空文件夹并可撤销。再次点击确认删除。'
    renderFolderMenu({ focusFirst: false, focusAction: 'delete-folder' })
    return
  }
  const session = folderMenuSession
  const controllerSession = newTabControllerGeneration
  const folderTitle = String(folder.title || '未命名文件夹').trim() || '未命名文件夹'
  const folderPath = state.folderData?.folderMap.get(folder.id)?.path || folderTitle
  state.folderMenuBusy = true
  state.folderMenuError = ''
  state.folderMenuStatus = `正在删除文件夹「${folderTitle}」...`
  renderFolderMenu({ focusFirst: false, focusAction: 'delete-folder' })
  try {
    const deleted = await deleteFolderTreeToRecycleLazy(folder, {
      source: '新标签页删除文件夹',
      path: folderPath
    })
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    if (state.bookmarkNavigationPath.includes(folder.id)) {
      const idx = state.bookmarkNavigationPath.indexOf(folder.id)
      state.bookmarkNavigationPath = state.bookmarkNavigationPath.slice(0, idx)
    }
    publishNewTabUndoAction({
      kind: 'delete-folder',
      folderTitle,
      undoEntry: deleted.blueprint,
      deletedAt: Date.now()
    })
    if (isCurrentFolderMenuSession(session)) closeFolderMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (!isCurrentFolderMenuSession(session)) return
    state.folderMenuBusy = false
    state.folderMenuDeleteArmed = false
    state.folderMenuStatus = ''
    state.folderMenuError = error instanceof Error ? `删除失败：${error.message}` : '删除文件夹失败，请稍后重试。'
    renderFolderMenu({ focusFirst: false, focusAction: 'delete-folder' })
  }
}

function renderFolderMenu({ focusFirst = true, focusAction = '' } = {}): void {
  const folder = getActiveMenuFolder()
  if (!folder) {
    dispatchNewtabBookmarkFolderMenuView(null)
    return
  }
  const session = folderMenuSession
  const folderTitle = String(folder.title || '未命名文件夹').trim() || '未命名文件夹'
  const isProtected = isProtectedBookmarkFolder(folder)
  const directBookmarkCount = getDirectBookmarks(folder).length
  const blockedMoveIds = collectFolderDescendantIds(folder)

  const actions: BookmarkMenuActionViewModel[] = [
    ...(!isProtected ? [createMenuActionViewModel('保存名称', 'save', saveFolderMenuRename, {
      actionId: 'save-folder-name',
      ariaLabel: `保存文件夹名称：${folderTitle}`,
      disabled: state.folderMenuBusy
    })] : []),
    createMenuActionViewModel('添加书签', 'plus', () => {
      const anchor = folderMenuReturnFocus
      const x = state.folderMenuX
      const y = state.folderMenuY
      closeFolderMenu({ animate: false })
      if (anchor?.isConnected) {
        openAddBookmarkMenuForElement(anchor, folder.id)
      } else {
        openAddBookmarkMenu(x, y, folder.id)
        expandAddBookmarkMenu()
      }
    }, {
      actionId: 'add-bookmark-to-folder',
      ariaLabel: `向文件夹添加书签：${folderTitle}`,
      disabled: state.folderMenuBusy,
      separatorBefore: !isProtected
    }),
    createMenuActionViewModel(
      state.folderMenuSubfolderExpanded ? '收起新建子文件夹' : '新建子文件夹',
      'folder-plus',
      () => {
        state.folderMenuSubfolderExpanded = !state.folderMenuSubfolderExpanded
        state.folderMenuError = ''
        state.folderMenuDeleteArmed = false
        renderFolderMenu({ focusFirst: state.folderMenuSubfolderExpanded })
      },
      {
        actionId: 'toggle-subfolder-input',
        ariaLabel: `在「${folderTitle}」内新建子文件夹`,
        disabled: state.folderMenuBusy
      }
    ),
    {
      ...createMenuActionViewModel('排序书签', 'sort', () => {}, {
        actionId: 'sort-folder',
        ariaLabel: `排序文件夹书签：${folderTitle}`,
        disabled: state.folderMenuBusy || directBookmarkCount < 2
      }),
      children: () => POPUP_FOLDER_SORT_OPTIONS.map((option) => ({
        id: `sort:${option.mode}`,
        ariaLabel: `${option.label}：${folderTitle}`,
        disabled: state.folderMenuBusy,
        icon: 'sort' as const,
        label: option.label,
        onSelect: () => {
          if (isCurrentFolderMenuSession(session)) return sortActiveMenuFolder(option.mode)
        }
      }))
    },
    createMenuActionViewModel('在书签管理中打开', 'folder-open', () => {
      closeFolderMenu({ animate: false })
      openOptionsHash(buildBookmarkManagerHash({ folderId: folder.id }))
    }, {
      actionId: 'open-folder-in-manager',
      ariaLabel: `在全部书签中打开：${folderTitle}`,
      disabled: state.folderMenuBusy
    }),
    {
      ...createMenuActionViewModel('移动到', 'move', () => {}, {
        actionId: 'move-folder',
        ariaLabel: `移动文件夹：${folderTitle}`,
        disabled: state.folderMenuBusy || isProtected
      }),
      children: () => buildBookmarkMoveActions(
        state.rootNode?.children || [],
        String(folder.parentId || ''),
        (targetParentId) => {
          if (isCurrentFolderMenuSession(session)) return moveActiveMenuFolder(targetParentId)
        },
        blockedMoveIds
      )
    },
    createMenuActionViewModel(
      state.folderMenuDeleteArmed ? '确认删除文件夹' : '删除文件夹',
      'trash',
      deleteActiveMenuFolder,
      {
        actionId: 'delete-folder',
        variant: 'danger',
        ariaLabel: `${state.folderMenuDeleteArmed ? '确认删除文件夹' : '删除文件夹'}：${folderTitle}`,
        disabled: state.folderMenuBusy || isProtected,
        separatorBefore: true
      }
    )
  ]

  dispatchNewtabBookmarkFolderMenuView({
    sessionId: session,
    closing: false,
    focusAction,
    focusFirst,
    onExitComplete: finalizeFolderMenuClose,
    menu: {
      actions,
      canRename: !isProtected,
      error: state.folderMenuError,
      nameField: createMenuTextFieldViewModel('名称', '输入文件夹名称', state.folderMenuTitle, (value) => {
        state.folderMenuTitle = value
        state.folderMenuError = ''
      }, {
        disabled: state.folderMenuBusy || isProtected,
        onEnter: saveFolderMenuRename
      }),
      onCloseRequest: () => closeFolderMenu({ restoreFocus: true }),
      status: state.folderMenuStatus,
      statusTone: state.folderMenuDeleteArmed ? 'warning' : '',
      subfolderAction: createMenuActionViewModel('创建子文件夹', 'folder-plus', createActiveMenuSubfolder, {
        actionId: 'create-subfolder',
        ariaLabel: `创建子文件夹到：${folderTitle}`,
        disabled: state.folderMenuBusy
      }),
      subfolderExpanded: state.folderMenuSubfolderExpanded,
      subfolderField: createMenuTextFieldViewModel('子目录', '输入子文件夹名称', state.folderMenuSubfolderTitle, (value) => {
        state.folderMenuSubfolderTitle = value
        state.folderMenuError = ''
      }, {
        disabled: state.folderMenuBusy,
        onEnter: createActiveMenuSubfolder
      }),
      title: folderTitle,
      x: state.folderMenuX,
      y: state.folderMenuY
    }
  })
}
async function saveAddedBookmark(): Promise<void> {
  if (!state.addMenuOpen || state.addMenuBusy) return
  const session = addBookmarkMenuSession
  const controllerSession = newTabControllerGeneration
  try {
    const url = normalizeBookmarkInputUrl(state.addUrl)
    const title = state.addTitle.trim() || url
    state.addMenuBusy = true
    state.addMenuError = ''
    renderAddBookmarkMenu({ focusFirst: false })

    const folderId = state.addFolderId || await ensureNewTabFolder()
    await createBookmarkLazy({
      parentId: folderId,
      title,
      url
    })
    if (controllerSession !== newTabControllerGeneration || !newTabControllerStarted) return
    if (session === addBookmarkMenuSession) closeAddBookmarkMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    if (session !== addBookmarkMenuSession) return
    state.addMenuBusy = false
    state.addMenuError =
      error instanceof Error ? error.message : '添加失败，请稍后重试。'
    renderAddBookmarkMenu({ focusFirst: false })
  }
}

interface RefreshNewTabOptions {
  showLoading?: boolean
}

async function refreshNewTab({ showLoading = true }: RefreshNewTabOptions = {}): Promise<void> {
  const refreshVersion = ++newTabRefreshVersion
  const iconVersion = customIconLoadVersion
  newTabRefreshStorageChanges = {}
  const bookmarkEventVersionAtStart = bookmarkTreeEventVersion
  let settingsRecoveryError = ''
  const backgroundMutationVersionAtStart = backgroundSettingsMutationVersion
  state.error = ''
  state.utilitySettingsHydrated = false
  state.bookmarkReorderError = ''
  clearFolderReorderStatus()
  resetAutoSearchLayoutSettle()
  resetSearchIndexReadyState()
  if (showLoading) {
    state.loading = true
    render()
  }

  try {
    let resolveStartupData!: (value: Awaited<ReturnType<typeof consumeNewtabStartupData>>) => void
    let rejectStartupData!: (reason?: unknown) => void
    const sharedStartupData = new Promise<Awaited<ReturnType<typeof consumeNewtabStartupData>>>((resolve, reject) => {
      resolveStartupData = resolve
      rejectStartupData = reject
    })
    const [startup, customIcons] = await Promise.all([
      consumeNewtabStartupData().then(
        data => {
          resolveStartupData(data)
          return data
        },
        error => {
          rejectStartupData(error)
          throw error
        }
      ),
      sharedStartupData
        .then(data => loadCustomIcons({
          raw: STORAGE_KEYS.newTabCustomIcons in newTabRefreshStorageChanges
            ? newTabRefreshStorageChanges[STORAGE_KEYS.newTabCustomIcons]
            : data.stored[STORAGE_KEYS.newTabCustomIcons]
        }))
        .catch(error => { console.warn('新标签页图标读取失败，保留已有图标。', error); return null }),
      loadActiveFaviconStore().catch(error => { console.warn('新标签页网站图标缓存读取失败。', error) })
    ])
    if (refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) return
    settingsRecoveryError = startup.settingsRecoveryError || ''
    const tree = startup.tree
    state.rootNode = tree[0] || null
    const stored = settingsPersistence.hydrate({ ...startup.stored, ...newTabRefreshStorageChanges })
    if (backgroundMutationVersionAtStart === backgroundSettingsMutationVersion) {
      preloadBackgroundSettings(stored[STORAGE_KEYS.newTabBackgroundSettings])
    }
    perfMark('newtab.storageLoaded')
    const rootNode = tree[0] || null
    state.rootNode = rootNode
    state.bookmarkCatalog = null
    const folderData = refreshBookmarkCatalog(rootNode).extracted
    const folderNodeMap = buildFolderNodeMap(rootNode)
    const folderSettings = normalizeFolderSettingsWithDefault(
      stored[STORAGE_KEYS.newTabFolderSettings],
      rootNode
    )
    const folderSections = buildNewTabFolderSections(rootNode, folderSettings, folderData, folderNodeMap)
    perfMark('newtab.sectionsBuilt')
    perfMeasure('newtab.sectionsBuildMs', 'newtab.storageLoaded', 'newtab.sectionsBuilt')

    state.folderData = folderData
    state.folderNodeMap = folderNodeMap
    state.folderSettings = folderSettings
    state.folderSections = folderSections
    refreshDerivedBookmarkState()
    if (customIcons && iconVersion === customIconLoadVersion) state.customIcons = customIcons
    state.activity = normalizeNewTabActivity(state.activity, state.allBookmarks)
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings], {
      validBookmarkIds: state.allBookmarkMap.keys()
    })
    state.moduleSettings = normalizeNewTabModuleSettings(stored[STORAGE_KEYS.newTabModuleSettings])
    if (backgroundMutationVersionAtStart === backgroundSettingsMutationVersion) {
      state.backgroundSettings = preloadedBackgroundSettings || state.backgroundSettings
    }
    state.searchSettings = normalizeSearchSettings(stored[STORAGE_KEYS.newTabSearchSettings])
    setAutoSearchLayoutPending(
      state.searchSettings.autoVerticalCenter && readCachedAutoSearchOffsetYValue() === null
    )
    state.iconSettings = normalizeIconSettings(stored[STORAGE_KEYS.newTabIconSettings])
    state.generalSettings = normalizeGeneralSettings(stored[STORAGE_KEYS.newTabGeneralSettings])
    state.utilitySettingsHydrated = true
    onboardingCompleted = normalizeNewTabOnboardingCompleted(stored[STORAGE_KEYS.onboardingState])
  } catch (error) {
    if (refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) return
    state.error = error instanceof Error ? error.message : '新标签页加载失败，请刷新后重试。'
    scheduleNewTabSearchIndexRebuild()
  } finally {
    if (refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) return
    newTabRefreshStorageChanges = null
    state.loading = false
    if (bookmarkChangeRefreshQueued || bookmarkTreeEventVersion !== bookmarkEventVersionAtStart) scheduleBookmarkChangeRefresh()
    render()
    renderDeleteToast()
    const backgroundUiAlreadyApplied = backgroundUiAppliedFromPreload
    backgroundUiAppliedFromPreload = false
    const shouldSyncBackgroundUi = backgroundSettingsHydrated && !backgroundUiAlreadyApplied
    if (shouldSyncBackgroundUi) {
      runBackgroundTask(applyBackgroundSettings(), '背景应用失败')
    }
    applyGeneralSettings()
    applyFolderSettings()
    if (shouldSyncBackgroundUi) {
      syncBackgroundSettingsControls()
    }
    syncSearchSettingsControls()
    syncIconSettingsControls()
    syncGeneralSettingsControls()
    syncFolderSettingsControls()
    syncNewTabModernSettingsControls()
    if (settingsRecoveryError) setSettingsSaveStatus('error', settingsRecoveryError)
    runIdle(() => {
      void hydrateNewTabSearchAndTags(refreshVersion)
    })
    runIdle(() => {
      if (refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) return
      const toggleVersion = newTabNaturalSearchToggleVersion
      void refreshNewTabNaturalSearchAiConfiguredState().then((configured) => {
        if (refreshVersion !== newTabRefreshVersion || !newTabControllerStarted || toggleVersion !== newTabNaturalSearchToggleVersion) return
        if (configured === false && state.searchSettings.naturalSearchEnabled) {
          state.searchSettings = normalizeSearchSettings({
            ...state.searchSettings,
            naturalSearchEnabled: false
          })
          void saveSearchSettings().catch((saveError) => {
            console.warn('新标签页 AI 语义搜索状态保存失败。', saveError)
          })
          syncSearchSettingsControls()
        }
      })
    }, { timeout: 800 })
  }
}

async function hydrateNewTabSearchAndTags(refreshVersion = newTabRefreshVersion): Promise<void> {
  if (refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) return
  const hydrationVersion = ++newTabSearchHydrationVersion
  try {
    if (refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) {
      return
    }
    const [tagIndex, snapshotIndex, activity, snapshotSettings] = await Promise.all([
      loadNewTabBookmarkTagIndexLazy(),
      loadNewTabContentSnapshotIndexLazy(),
      loadNewTabActivityLazy(),
      loadContentSnapshotSettings()
    ])

    if (hydrationVersion !== newTabSearchHydrationVersion || refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) return

    state.bookmarkTagIndex = normalizeNewTabBookmarkTagIndex(tagIndex)
    state.searchSnapshotIndex = normalizeNewTabContentSnapshotIndex(snapshotIndex)
    state.searchSnapshotSettings = snapshotSettings
    state.activity = activity
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(state.workspaceSettings, {
      validBookmarkIds: state.allBookmarkMap.keys(),
      legacyPinnedIds: state.activity.pinnedIds
    })
    // Tree changes clear the catalog, so a remaining catalog still matches the
    // tree. Only the tag and snapshot indexes changed; keep its extraction.
    const currentExtraction = state.bookmarkCatalog?.extracted || null
    markSearchIndexDirty({ force: true })
    if (currentExtraction) {
      refreshBookmarkCatalog(state.rootNode, currentExtraction)
    }
    render()
  } catch (error) {
    if (hydrationVersion !== newTabSearchHydrationVersion || refreshVersion !== newTabRefreshVersion || !newTabControllerStarted) return
    console.warn('新标签页 idle 数据加载失败。', error)
    scheduleNewTabSearchIndexRebuild()
  }
}

async function loadNewTabBookmarkTagIndexLazy(): Promise<BookmarkTagIndex | null> {
  const { loadBookmarkTagIndex } = await import('../shared/bookmark-tags.js')
  return loadBookmarkTagIndex()
}

async function loadNewTabContentSnapshotIndexLazy(): Promise<ContentSnapshotIndex | null> {
  const { loadContentSnapshotIndex } = await import('../shared/content-snapshots.js')
  return loadContentSnapshotIndex()
}

async function loadNewTabActivityLazy(): Promise<NewTabActivityState> {
  const activityRepository = await loadNewTabActivityRepositoryLazy()
  return activityRepository.loadNewTabActivityFromRepository(normalizeNewTabActivityForCurrentBookmarks)
}

function preloadBackgroundSettings(rawSettings: unknown): typeof DEFAULT_BACKGROUND_SETTINGS | null {
  const backgroundMutationVersionAtStart = backgroundSettingsMutationVersion
  try {
    const nextSettings = normalizeBackgroundSettings(rawSettings)
    backgroundSettingsHydrated = true
    if (backgroundMutationVersionAtStart === backgroundSettingsMutationVersion) {
      state.backgroundSettings = nextSettings
      preloadedBackgroundSettings = nextSettings
      setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(state.backgroundSettings))
      syncInstantWallpaperTargetForSettings(nextSettings)
      scheduleCurrentBackgroundStartupCache(nextSettings, { delay: 0 })
      syncBackgroundSettingsControls()
      runBackgroundTask(applyBackgroundSettings(), '背景应用失败')
      backgroundUiAppliedFromPreload = true
    } else {
      syncBackgroundSettingsControls()
    }
    return nextSettings
  } catch (error) {
    syncBackgroundSettingsControls()
    console.warn('新标签页背景预加载失败。', error)
    markWallpaperReady()
    recordNewTabBackgroundReady()
    return preloadedBackgroundSettings
  }
}

async function createNewTabFolder(): Promise<void> {
  if (state.creatingFolder) {
    return
  }

  state.creatingFolder = true
  state.error = ''
  render()

  try {
    const rootNode = state.rootNode || (await getBookmarkTree())[0] || null
    const bookmarksBar = findBookmarksBar(rootNode)
    const createdFolder = await createBookmarkLazy({
      parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
      title: DEFAULT_NEW_TAB_FOLDER_TITLE
    })
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: [...state.folderSettings.selectedFolderIds, String(createdFolder.id)]
    })
    await saveFolderSettings()
    await refreshNewTab()
  } catch (error) {
    state.error = error instanceof Error ? error.message : '书签来源文件夹创建失败，请稍后重试。'
    render()
  } finally {
    state.creatingFolder = false
    render()
  }
}

async function ensureNewTabFolder(): Promise<string> {
  const primarySection = state.folderSections[0]
  if (primarySection?.id) {
    return primarySection.id
  }

  const rootNode = state.rootNode || (await getBookmarkTree())[0] || null
  const existingFolder = findNewTabFolder(rootNode)
  if (existingFolder?.id) {
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: [String(existingFolder.id)]
    })
    state.folderSections = buildNewTabFolderSections(rootNode, state.folderSettings)
    refreshDerivedBookmarkState()
    markSearchIndexDirty()
    await saveFolderSettings()
    return String(existingFolder.id)
  }

  const bookmarksBar = findBookmarksBar(rootNode)
  const createdFolder = await createBookmarkLazy({
    parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
    title: DEFAULT_NEW_TAB_FOLDER_TITLE
  })
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: [String(createdFolder.id)]
  })
  state.folderSections = buildNewTabFolderSections(rootNode, state.folderSettings)
  refreshDerivedBookmarkState()
  markSearchIndexDirty()
  await saveFolderSettings()
  return String(createdFolder.id)
}

function render(): void {
  const contentState = resolveNewTabContentState({
    loading: state.loading,
    error: state.error,
    selectedFolderCount: state.folderSettings.selectedFolderIds.length,
    visibleFolderCount: state.folderSections.length
  })
  const contentKey = getContentStateSignature(contentState)
  const shellKey = getNewTabShellSignature()

  if (
    contentState.type === 'bookmarks' &&
    lastRenderedContentKey === 'bookmarks' &&
    lastRenderedShellKey === shellKey &&
    renderBookmarkSections()
  ) {
    scheduleAdaptiveNewTabLayoutUpdate()
    recordNewTabFirstBookmarksRendered()
    return
  }

  cancelScheduledAdaptiveNewTabLayoutUpdate()
  if (contentState.type !== 'bookmarks') {
    dispatchNewtabBookmarkContentView(null)
  }
  dispatchNewtabContentView(createContentStateView(contentState))
  lastRenderedContentKey = contentKey
  lastRenderedShellKey = shellKey
  scheduleAdaptiveNewTabLayoutUpdate()
  recordContentStateRender(contentState)
}

function createContentStateView(contentState: NewTabContentState): NewTabContentView {
  if (contentState.type === 'loading') {
    return createNewTabLayout(createLoadingStateView())
  }

  if (contentState.type === 'error') {
    return createStateView(contentState.message, '重新加载', () => {
      void refreshNewTab()
    })
  }

  if (contentState.type === 'missing-folder') {
    return createNewTabLayout(createMissingFolderView({
      creatingFolder: state.creatingFolder,
      reason: contentState.reason,
      onCreateFolder: () => {
        void createNewTabFolder()
      },
      onOpenFolderSettings: openFolderSourceSettings
    }))
  }

  return createNewTabLayout(createBookmarkSections(state.folderSections))
}

function renderBookmarkSections(): boolean {
  if (!getNewtabBookmarkContentView()) {
    return false
  }

  createBookmarkSections(state.folderSections)
  return true
}

function recordContentStateRender(contentState: NewTabContentState): void {
  if (contentState.type === 'loading') {
    recordNewTabSkeletonRendered()
  } else if (contentState.type === 'bookmarks' || contentState.type === 'missing-folder') {
    recordNewTabFirstBookmarksRendered()
  }
}

function getContentStateSignature(contentState: NewTabContentState): string {
  if (contentState.type === 'error') {
    return `error:${contentState.message}`
  }
  if (contentState.type === 'missing-folder') {
    return `missing-folder:${contentState.reason}:${state.creatingFolder}`
  }
  return contentState.type
}

function getNewTabShellSignature(): string {
  return [
    onboardingCompleted,
    state.searchSettings.enabled,
    state.searchSettings.webSearchEnabled,
    state.searchSettings.openInNewTab,
    state.searchSettings.placeholder,
    state.searchSettings.naturalSearchEnabled,
    state.searchSettings.autoVerticalCenter,
    state.searchSettings.width,
    state.searchSettings.height,
    state.searchSettings.offsetY,
    state.searchSettings.background
  ].join('|')
}

function renderDeleteToast(): void {
  const action = state.lastUndoAction
  if (!action) {
    dispatchNewtabDeleteToastView(null)
    return
  }
  if (action.kind === 'delete-bookmark') {
    const bookmarkLabel = getBookmarkActionLabelContext(action.bookmark)
    dispatchNewtabDeleteToastView({
      bookmarkLabel,
      busy: state.deleteToastBusy,
      detail: state.deleteToastStatus || getBookmarkDisplayTitle(action.bookmark),
      showRecycleAction: true,
      title: state.deleteToastTitle || undefined,
      tone: state.deleteToastTone,
      undoAriaLabel: `撤销删除：${bookmarkLabel}`
    })
    return
  }
  if (action.kind === 'delete-folder') {
    const bookmarkCount = action.undoEntry.recycleIds.length
    const defaultDetail = bookmarkCount > 0
      ? `「${action.folderTitle}」及 ${bookmarkCount} 个书签已移入回收站`
      : `「${action.folderTitle}」已删除`
    dispatchNewtabDeleteToastView({
      bookmarkLabel: action.folderTitle,
      busy: state.deleteToastBusy,
      detail: state.deleteToastStatus || defaultDetail,
      showRecycleAction: bookmarkCount > 0,
      title: state.deleteToastTitle || '已删除文件夹',
      tone: state.deleteToastTone,
      undoAriaLabel: `撤销删除文件夹：${action.folderTitle}`
    })
    return
  }
  if (action.kind === 'move-bookmark') {
    dispatchNewtabDeleteToastView({
      bookmarkLabel: action.bookmarkLabel,
      busy: state.deleteToastBusy,
      detail: state.deleteToastStatus || `「${action.bookmarkLabel}」→ ${action.toFolderTitle}`,
      showRecycleAction: false,
      title: state.deleteToastTitle || '已移动书签',
      tone: state.deleteToastTone,
      undoAriaLabel: `撤销移动：${action.bookmarkLabel}`
    })
    return
  }
  if (action.kind === 'edit-bookmark') {
    dispatchNewtabDeleteToastView({
      bookmarkLabel: action.bookmarkLabel,
      busy: state.deleteToastBusy,
      detail: state.deleteToastStatus || action.bookmarkLabel,
      showRecycleAction: false,
      title: state.deleteToastTitle || '已更新书签',
      tone: state.deleteToastTone,
      undoAriaLabel: `撤销编辑：${action.bookmarkLabel}`
    })
    return
  }
  if (action.kind === 'rename-folder') {
    dispatchNewtabDeleteToastView({
      bookmarkLabel: action.nextTitle,
      busy: state.deleteToastBusy,
      detail: state.deleteToastStatus || `「${action.previousTitle}」→「${action.nextTitle}」`,
      showRecycleAction: false,
      title: state.deleteToastTitle || '已重命名文件夹',
      tone: state.deleteToastTone,
      undoAriaLabel: `撤销重命名：${action.nextTitle}`
    })
    return
  }
  if (action.kind === 'move-folder') {
    dispatchNewtabDeleteToastView({
      bookmarkLabel: action.folderTitle,
      busy: state.deleteToastBusy,
      detail: state.deleteToastStatus || `「${action.folderTitle}」→ ${action.toFolderTitle}`,
      showRecycleAction: false,
      title: state.deleteToastTitle || '已移动文件夹',
      tone: state.deleteToastTone,
      undoAriaLabel: `撤销移动文件夹：${action.folderTitle}`
    })
    return
  }
  dispatchNewtabDeleteToastView({
    bookmarkLabel: action.folderTitle,
    busy: state.deleteToastBusy,
    detail: state.deleteToastStatus || `「${action.folderTitle}」已按${action.sortLabel}排序`,
    showRecycleAction: false,
    title: state.deleteToastTitle || '已排序文件夹',
    tone: state.deleteToastTone,
    undoAriaLabel: `撤销排序：${action.folderTitle}`
  })
}

function scheduleRender(): void {
  if (deferredRenderFrame) {
    return
  }

  deferredRenderFrame = window.requestAnimationFrame(() => {
    deferredRenderFrame = 0
    render()
  })
}

function cancelScheduledAdaptiveNewTabLayoutUpdate(): void {
  if (!verticalCenterCollisionFrame) {
    return
  }

  window.cancelAnimationFrame(verticalCenterCollisionFrame)
  verticalCenterCollisionFrame = 0
}

function scheduleAdaptiveNewTabLayoutUpdate(): void {
  cancelScheduledAdaptiveNewTabLayoutUpdate()
  verticalCenterCollisionFrame = window.requestAnimationFrame(() => {
    verticalCenterCollisionFrame = 0
    runBatchedAdaptiveLayoutUpdate()
  })
}

function setAutoSearchLayoutPending(pending: boolean): void {
  if (typeof document === 'undefined') {
    return
  }

  if (!pending && autoSearchLayoutRevealFrame) {
    window.cancelAnimationFrame(autoSearchLayoutRevealFrame)
    autoSearchLayoutRevealFrame = 0
  }
  document.documentElement.toggleAttribute(AUTO_SEARCH_LAYOUT_PENDING_ATTRIBUTE, pending)
}

function scheduleAutoSearchLayoutReveal(): void {
  if (autoSearchLayoutRevealFrame) {
    window.cancelAnimationFrame(autoSearchLayoutRevealFrame)
  }

  autoSearchLayoutRevealFrame = window.requestAnimationFrame(() => {
    autoSearchLayoutRevealFrame = 0
    const view = getNewtabSearchWidgetView()
    const slot = getNewtabSearchWidgetNodes().slot
    if (!view?.shell.autoVerticalCenter) {
      setAutoSearchLayoutPending(false)
      return
    }
    if (!view.shell.layoutReady || !slot || slot.dataset.searchLayoutReady !== 'true') {
      scheduleAutoSearchLayoutReveal()
      return
    }

    const renderedOffsetY = slot.style.getPropertyValue('--search-offset-y')
    if (renderedOffsetY !== `${view.shell.offsetY}px`) {
      scheduleAutoSearchLayoutReveal()
      return
    }
    writeCachedAutoSearchOffsetY(view.shell.offsetY)
    setAutoSearchLayoutPending(false)
  })
}

function runBatchedAdaptiveLayoutUpdate(): void {
  const layoutNodes = getNewtabContentLayoutNodes()
  const contentView = getNewtabContentView()
  const page = layoutNodes.page
  const registeredSlot = getNewtabSearchWidgetNodes().slot
  const slot = registeredSlot && page?.contains(registeredSlot)
    ? registeredSlot
    : null
  if (!page || !slot) {
    resetAutoSearchLayoutSettle()
    state.searchOffsetBounds = { ...SEARCH_OFFSET_BOUNDS_FALLBACK }
    state.searchWidthBounds = { ...SEARCH_WIDTH_BOUNDS_FALLBACK }
    patchNewtabPageCollisionOffset(0)
    syncSearchWidthControl()
    syncSearchOffsetControl()
    return
  }

  const previousModule = slot.previousElementSibling instanceof HTMLElement
    ? slot.previousElementSibling
    : null
  const iconVerticalCenter = contentView?.type === 'page' && contentView.iconVerticalCenter === 'true'
  const primaryContent = iconVerticalCenter ? layoutNodes.primaryContent : null
  const collisionUtilityStack = iconVerticalCenter ? layoutNodes.utilityStack : null

  if (primaryContent && settledVerticalCenterContent !== primaryContent) {
    // Until one frame after this content block first paints, its
    // content-visibility sections report contain-intrinsic-size placeholder
    // heights (verified by probe), so the vertically centered anchor — and any
    // offset centered against it — measures wrong and would visibly snap later.
    // Keep the current (cache-trusted) position and re-run after first paint.
    if (!verticalCenterContentSettleFrame) {
      verticalCenterContentSettleFrame = window.requestAnimationFrame(() => {
        verticalCenterContentSettleFrame = window.requestAnimationFrame(() => {
          verticalCenterContentSettleFrame = 0
          settledVerticalCenterContent = primaryContent
          runBatchedAdaptiveLayoutUpdate()
        })
      })
    }
    return
  }

  const viewportWidth = getNewtabViewportWidth()
  const shellRect = layoutNodes.shell?.getBoundingClientRect()
  const slotRect = slot.getBoundingClientRect()
  const previousModuleRect = previousModule?.getBoundingClientRect()
  const nextModuleRect = iconVerticalCenter
    ? getSearchAutoVerticalCenterNextModule(slot, layoutNodes.primarySlot)?.getBoundingClientRect()
    : null
  const primaryContentRect = primaryContent?.getBoundingClientRect()
  const collisionUtilityRect = collisionUtilityStack?.getBoundingClientRect()
  const currentCollisionOffset = contentView?.type === 'page'
    ? contentView.primaryCollisionOffsetY
    : 0
  const currentOffsetY = getCurrentSearchOffsetY(slot)

  const viewportTop = shellRect?.top ?? 0
  const viewportBottom = shellRect?.bottom ?? getNewtabViewportHeight()
  const bounds = getAdaptiveSearchOffsetBounds({
    currentOffsetY,
    searchTop: slotRect.top,
    searchBottom: slotRect.bottom,
    viewportTop,
    viewportBottom,
    previousModuleBottom: previousModuleRect?.bottom,
    primaryContentTop: primaryContentRect?.top,
    minimumGap: NEWTAB_LAYOUT_SAFE_GAP,
    absoluteMin: SEARCH_OFFSET_ABSOLUTE_MIN,
    absoluteMax: SEARCH_OFFSET_ABSOLUTE_MAX
  })
  const widthBounds = getAdaptiveSearchWidthBounds({
    viewportWidth,
    containerWidth: slotRect.width,
    automaticWidth: Boolean(getComputedStyle(slot).getPropertyValue('--search-auto-width').trim())
  })

  let collisionOffset = 0
  if (iconVerticalCenter) {
    if (collisionUtilityRect && primaryContentRect) {
      collisionOffset = getVerticalCenterCollisionOffset({
        utilityBottom: collisionUtilityRect.bottom,
        // The rect already includes the slot's current translateY. Remove that
        // rendered offset so repeated measurements solve against one stable
        // baseline instead of alternating between the shifted and base tops.
        contentTop: primaryContentRect.top - currentCollisionOffset
      })
    }
  }

  state.searchOffsetBounds = bounds
  state.searchWidthBounds = widthBounds
  const nextSearchWidth = clampNumber(state.searchSettings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)
  let nextSearchOffsetY = getCurrentSearchOffsetY(slot)
  if (!state.searchSettings.autoVerticalCenter) {
    nextSearchOffsetY = clampNumber(
      state.searchSettings.offsetY,
      bounds.min,
      bounds.max,
      DEFAULT_SEARCH_SETTINGS.offsetY
    )
  } else {
    nextSearchOffsetY = getAutoCenteredSearchOffsetY({
      currentOffsetY,
      searchTop: slotRect.top,
      searchBottom: slotRect.bottom,
      viewportTop,
      viewportBottom,
      previousModuleBottom: previousModuleRect?.bottom,
      nextModuleTop: nextModuleRect?.top,
      minimumGap: NEWTAB_LAYOUT_SAFE_GAP,
      minOffsetY: bounds.min,
      maxOffsetY: bounds.max,
      fallbackOffsetY: currentOffsetY
    })
  }
  const nextSearchLayoutReady = getNextAutoSearchLayoutReadyState({
    autoVerticalCenter: state.searchSettings.autoVerticalCenter,
    offsetY: nextSearchOffsetY,
    width: nextSearchWidth
  })
  patchSearchWidgetShellState({
    autoVerticalCenter: state.searchSettings.autoVerticalCenter,
    layoutReady: nextSearchLayoutReady,
    offsetY: nextSearchOffsetY,
    width: nextSearchWidth
  })
  if (state.searchSettings.autoVerticalCenter && nextSearchLayoutReady) {
    scheduleAutoSearchLayoutReveal()
  } else if (!state.searchSettings.autoVerticalCenter) {
    setAutoSearchLayoutPending(false)
  }
  patchNewtabPageCollisionOffset(collisionOffset)
  syncSearchWidthControl()
  syncSearchOffsetControl()
}

function getNextAutoSearchLayoutReadyState({
  autoVerticalCenter,
  offsetY,
  width
}: {
  autoVerticalCenter: boolean
  offsetY: number
  width: number
}): boolean {
  if (!autoVerticalCenter) {
    resetAutoSearchLayoutSettle()
    return true
  }

  const view = getNewtabSearchWidgetView()
  if (view?.shell.layoutReady) {
    resetAutoSearchLayoutSettle()
    return true
  }

  const layoutKey = `${Math.round(offsetY)}:${Math.round(width)}`
  if (autoSearchLayoutStableKey !== layoutKey) {
    autoSearchLayoutStableKey = layoutKey
    autoSearchLayoutStableFrames = AUTO_SEARCH_LAYOUT_STABLE_FRAME_COUNT
  }

  if (autoSearchLayoutStableFrames > 0) {
    autoSearchLayoutStableFrames -= 1
    scheduleAdaptiveNewTabLayoutUpdate()
    return false
  }

  resetAutoSearchLayoutSettle()
  return true
}

function resetAutoSearchLayoutSettle(): void {
  autoSearchLayoutStableFrames = 0
  autoSearchLayoutStableKey = ''
}

function getCurrentSearchOffsetY(slot: HTMLElement): number {
  // The centering math needs the offset the measured rect actually reflects; the
  // shell state can run ahead of the DOM between a patch and its React commit.
  const renderedOffsetY = Number.parseFloat(slot.style.getPropertyValue('--search-offset-y'))
  if (Number.isFinite(renderedOffsetY)) {
    return renderedOffsetY
  }
  const registeredSlot = getNewtabSearchWidgetNodes().slot
  if (registeredSlot === slot) {
    const value = getNewtabSearchWidgetView()?.shell.offsetY
    if (Number.isFinite(value)) {
      return value
    }
  }
  return state.searchSettings.offsetY
}

function patchNewtabPageCollisionOffset(primaryCollisionOffsetY: number): void {
  patchNewtabContentView((view) => {
    if (view.type !== 'page' || view.primaryCollisionOffsetY === primaryCollisionOffsetY) {
      return view
    }
    return {
      ...view,
      primaryCollisionOffsetY
    }
  })
}

function getSearchAutoVerticalCenterNextModule(
  slot: HTMLElement,
  primarySlot: HTMLElement | null
): HTMLElement | null {
  const nextUtilityModule = slot.nextElementSibling instanceof HTMLElement
    ? slot.nextElementSibling
    : null
  if (nextUtilityModule) {
    return nextUtilityModule
  }

  const primaryModule = primarySlot?.firstElementChild
  return primaryModule instanceof HTMLElement ? primaryModule : null
}

function createNewTabLayout(primaryContent: NewTabPageModule): NewTabContentView {
  const modules: NewTabPageModule[] = []

  if (!state.utilitySettingsHydrated) {
    dispatchNewtabSearchWidgetView(null)
    modules.push(primaryContent)
    return createNewTabPage({ modules })
  }

  const onboarding = createNewTabOnboardingStrip()
  if (onboarding) {
    modules.push(onboarding)
  }

  if (initializeSearchWidget()) {
    modules.push({
      id: 'search',
      kind: 'search',
      placement: 'utility'
    })
  }

  modules.push(primaryContent)

  return createNewTabPage({ modules })
}

function normalizeNewTabOnboardingCompleted(rawState: unknown): boolean {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return false
  }
  return (rawState as { completed?: unknown }).completed === true
}

function createNewTabOnboardingStrip(): NewTabPageModule | null {
  if (onboardingCompleted || state.loading || state.error) {
    return null
  }

  return {
    id: 'onboarding',
    kind: 'onboarding',
    onOpenFolderSettings: openFolderSourceSettings,
    onSkip: () => {
      void completeNewTabOnboarding()
    },
    placement: 'utility'
  }
}

async function completeNewTabOnboarding(): Promise<void> {
  onboardingCompleted = true
  await setLocalStorage({
    [STORAGE_KEYS.onboardingState]: {
      version: 1,
      completed: true,
      completedAt: Date.now()
    }
  }).catch((error) => {
    console.warn('新标签页引导状态保存失败。', error)
  })
  render()
}

function initializeSearchWidget(): boolean {
  const widgetGeneration = ++searchWidgetGeneration
  const settings = state.searchSettings
  if (!settings.enabled) {
    refreshNewTabSearchSuggestionsAfterAiSettingsChange = null
    setAutoSearchLayoutPending(false)
    dispatchNewtabSearchWidgetView(null)
    return false
  }
  if (settings.autoVerticalCenter) {
    // Only hide behind the measurement gate when no trusted first-paint offset exists;
    // a shell that has already revealed keeps its position across full re-renders.
    setAutoSearchLayoutPending(
      getRevealedAutoSearchShell() === null && readCachedAutoSearchOffsetYValue() === null
    )
  }
  let searchComboboxExpanded = false
  let activeSearchDescendantId = ''
  let searchPanelVisible = false
  let searchSuggestionListVisible = true
  let searchSuggestions: NewTabSearchSuggestion[] = []
  let activeSuggestionIndex = -1
  let searchInputComposing = false
  let suggestionDebounceTimer = 0
  let suggestionRequestId = 0
  let webSearchRequestId = 0
  let visibleSuggestionQuery = ''
  let visibleSuggestionIndex = state.preparedSearchIndex
  const suggestionIdentity = (item: NewTabSearchSuggestion) => `${item.suggestionType}:${item.id}`
  const ownsWidget = () => widgetGeneration === searchWidgetGeneration && newTabControllerStarted

  const getSearchNodes = (): NewtabSearchWidgetNodes => getNewtabSearchWidgetNodes()
  const getSearchInput = (): HTMLInputElement | null => getSearchNodes().input
  const getSearchSlot = (): HTMLElement | null => getSearchNodes().slot
  const hasSearchInteraction = () => {
    const active = document.activeElement
    return shouldKeepNewtabSearchOpen({
      focusWithin: Boolean(active && getSearchSlot()?.contains(active)),
      settingsOpen: isSettingsDrawerOpen(),
      composing: searchInputComposing
    })
  }

  const syncSearchWidgetButtons = () => {
    patchNewtabSearchWidgetView({
      buttons: {
        natural: getNaturalSearchButtonState()
      }
    })
  }
  const updateNaturalButton = syncSearchWidgetButtons
  const executeWebSearch = (value: string, forceNewTab = false) => {
    const requestId = ++webSearchRequestId
    patchNewtabSearchWidgetView({ webSearchError: '' })
    void submitSearch(value, forceNewTab).catch(() => {
      if (!ownsWidget() || requestId !== webSearchRequestId ||
        getSearchInput()?.value.trim() !== value.trim()) return
      patchNewtabSearchWidgetView({
        webSearchError: '网页搜索失败，请检查 Chrome 的默认搜索引擎后重试。'
      })
    })
  }
  const syncSearchWidgetInteractions = () => {
    patchNewtabSearchWidgetView({
      interactions: {
        onClear: () => {
          const input = getSearchInput()
          if (!input) {
            return
          }
          input.value = ''
          patchNewtabSearchWidgetView({ webSearchError: '' })
          syncSearchInputActions(input)
          hideSuggestions()
          input.focus()
        },
        onInputFocus: () => {
          scheduleSuggestionsRender({ immediate: true })
        },
        onInputInput: () => {
          const input = getSearchInput()
          if (!input) {
            return
          }
          syncSearchInputActions(input)
          patchNewtabSearchWidgetView({ webSearchError: '' })
          scheduleSuggestionsRender()
        },
        onInputCompositionChange: (composing) => {
          searchInputComposing = composing
          if (!composing) {
            if (hasSearchInteraction()) scheduleSuggestionsRender({ immediate: true })
            else hideSuggestions()
          }
        },
        onInputKeyDown: (event) => {
          if (event.defaultPrevented) return
          if (searchInputComposing || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
          const input = getSearchInput()
          if (!input) {
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1)
            return
          }

          if (event.key === 'Enter' && activeSuggestionIndex >= 0 && !event.metaKey && !event.ctrlKey &&
            visibleSuggestionQuery === input.value && visibleSuggestionIndex === state.preparedSearchIndex && state.searchIndexReady) {
            const suggestion = searchSuggestions[activeSuggestionIndex]
            if (suggestion) {
              event.preventDefault()
              input.value = suggestion.title
              syncSearchInputActions(input)
              hideSuggestions()
              openSearchSuggestion(suggestion)
            }
            return
          }

          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            hideSuggestions()
            if (state.searchSettings.webSearchEnabled === false) {
              return
            }
            executeWebSearch(input.value, true)
            return
          }

          if (event.key !== 'Escape') {
            return
          }

          // The open inspector owns Escape. Let its dismissal run without
          // also clearing or blurring the non-modal background search field.
          if (isSettingsDrawerOpen()) {
            return
          }

          event.preventDefault()
          if (searchSuggestions.length || searchPanelVisible || suggestionDebounceTimer) {
            hideSuggestions()
            return
          }

          if (input.value) {
            hideSuggestions()
            input.value = ''
            syncSearchInputActions(input)
            return
          }

          input.blur()
        },
        onRootBlur: () => {
          window.setTimeout(() => {
            // Portal mounting can move focus through an intermediate element.
            // Check the settled destination, not the earlier blur event.
            const slot = getSearchSlot()
            if (slot && !hasSearchInteraction()) {
              hideSuggestions()
            }
          }, 0)
        },
        onSubmit: (event) => {
          const input = getSearchInput()
          event.preventDefault()
          if (searchInputComposing) return
          hideSuggestions()
          if (!input || state.searchSettings.webSearchEnabled === false) {
            return
          }
          executeWebSearch(input.value)
        },
        onToggleNatural: () => {
          const input = getSearchInput()
          if (!input) {
            return
          }
          void toggleNewTabNaturalSearch({
            input,
            updateNaturalButton,
            scheduleSuggestionsRender
          })
        }
      }
    })
  }

  const renderSearchComboboxState = () => {
    patchNewtabSearchWidgetView({
      combobox: {
        activeDescendantId: activeSearchDescendantId,
        expanded: searchComboboxExpanded
      }
    })
  }
  const openSearchCombobox = () => {
    searchComboboxExpanded = true
    renderSearchComboboxState()
  }
  const closeSearchCombobox = () => {
    searchComboboxExpanded = false
    activeSearchDescendantId = ''
    renderSearchComboboxState()
  }
  const setActiveSearchDescendant = (id: string) => {
    activeSearchDescendantId = id
    renderSearchComboboxState()
  }
  const syncSearchWidgetPanelState = () => {
    patchNewtabSearchWidgetView({
      panel: {
        panelVisible: searchPanelVisible,
        suggestionsVisible: searchSuggestionListVisible
      }
    })
  }
  const hideSearchPanel = () => {
    searchPanelVisible = false
    syncSearchWidgetPanelState()
  }
  const showSearchPanel = () => {
    searchPanelVisible = true
    syncSearchWidgetPanelState()
  }
  const setSearchSuggestionsListVisible = (visible: boolean) => {
    searchSuggestionListVisible = visible
    syncSearchWidgetPanelState()
  }

  const hideSuggestions = () => {
    dismissedSearchQuery = getSearchInput()?.value ?? ''
    suggestionRequestId += 1
    abortNewTabNaturalSearchRequest()
    window.clearTimeout(suggestionDebounceTimer)
    suggestionDebounceTimer = 0
    searchSuggestions = []
    visibleSuggestionQuery = ''
    activeSuggestionIndex = -1
    patchNewtabSearchWidgetView({
      chips: [],
      hint: { type: 'empty' },
      sectionLabel: '书签匹配',
      suggestions: []
    })
    setSearchSuggestionsListVisible(true)
    hideSearchPanel()
    closeSearchCombobox()
  }

  const renderSuggestions = (suggestionList: NewTabSearchSuggestion[], {
    preserveActive = false,
    query = getSearchInput()?.value || ''
  }: {
    preserveActive?: boolean
    query?: string
  } = {}) => {
    const input = getSearchInput()
    if (!input) {
      return
    }
    const trimmedQuery = String(query || '').trim()
    if (!ownsWidget() || input.value !== query) return
    const previousActive = preserveActive && activeSuggestionIndex >= 0 ? searchSuggestions[activeSuggestionIndex] : null
    const advancedSearch = isNewTabAdvancedSearchQuery(trimmedQuery)
    const chips = createNewTabSearchChips(trimmedQuery)
    searchSuggestions = suggestionList
    visibleSuggestionQuery = query
    visibleSuggestionIndex = state.preparedSearchIndex
    if (!searchSuggestions.length) {
      activeSuggestionIndex = -1
      patchNewtabSearchWidgetView({
        chips,
        suggestions: []
      })
      setSearchSuggestionsListVisible(false)
      setActiveSearchDescendant('')
      if (!trimmedQuery) {
        hideSuggestions()
        return
      }

      if (state.searchSettings.webSearchEnabled === false) {
        patchNewtabSearchWidgetView({
          hint: {
            type: 'text',
            text: '未找到本地书签。网页搜索已关闭，可在设置中重新启用。'
          },
          sectionLabel: advancedSearch ? '语法搜索匹配' : '关键词书签匹配'
        })
        showSearchPanel()
        openSearchCombobox()
        return
      }

      patchNewtabSearchWidgetView({
        hint: createSearchWebFallbackState(trimmedQuery),
        sectionLabel: '网页搜索'
      })
      showSearchPanel()
      openSearchCombobox()
      return
    }

    setSearchSuggestionsListVisible(true)
    const sectionLabel = searchSuggestions.some(isCommandSuggestion)
      ? '书签与命令'
      : advancedSearch
        ? '语法搜索匹配'
        : '关键词书签匹配'
    activeSuggestionIndex = previousActive
      ? searchSuggestions.findIndex(item => suggestionIdentity(item) === suggestionIdentity(previousActive)) : -1

    const onSelectSuggestion = (selectedSuggestion: NewTabSearchSuggestion) => {
      const currentInput = getSearchInput()
      if (!currentInput || !ownsWidget() || currentInput.value !== query || visibleSuggestionQuery !== query ||
        visibleSuggestionIndex !== state.preparedSearchIndex || !state.searchIndexReady ||
        !searchSuggestions.some(item => suggestionIdentity(item) === suggestionIdentity(selectedSuggestion))) {
        return
      }
      currentInput.value = selectedSuggestion.title
      syncSearchInputActions(currentInput)
      hideSuggestions()
      openSearchSuggestion(selectedSuggestion)
    }

    patchNewtabSearchWidgetView({
      chips,
      hint: {
        type: 'text',
        text: getSearchSuggestionHintText()
      },
      sectionLabel,
      suggestions: searchSuggestions.map((suggestion, index) =>
        createSearchSuggestionViewModel(
          suggestion,
          index,
          index === activeSuggestionIndex,
          onSelectSuggestion
        )
      )
    })
    showSearchPanel()
    openSearchCombobox()

    if (activeSuggestionIndex >= 0) {
      setActiveSearchDescendant(getSearchSuggestionElementId(activeSuggestionIndex))
    } else {
      setActiveSearchDescendant('')
    }
  }

  const scheduleSuggestionsRender = ({ preserveActive = false, immediate = false, passive = false } = {}) => {
    const input = getSearchInput()
    if (!input) {
      return
    }
    const query = input.value
    if (passive && dismissedSearchQuery === query) return
    if (!passive) dismissedSearchQuery = null
    const requestId = suggestionRequestId + 1
    suggestionRequestId = requestId
    window.clearTimeout(suggestionDebounceTimer)
    abortNewTabNaturalSearchRequest()
    if (!query.trim()) { hideSuggestions(); return }
    if (visibleSuggestionQuery !== query) {
      searchSuggestions = []
      activeSuggestionIndex = -1
      setActiveSearchDescendant('')
      patchNewtabSearchWidgetView({ suggestions: [], hint: { type: 'empty' }, chips: createNewTabSearchChips(query) })
    }
    if (searchInputComposing) return
    const requestedIndex = state.preparedSearchIndex
    const isCurrent = () => ownsWidget() && requestId === suggestionRequestId && getSearchInput()?.value === query &&
      state.searchIndexReady && requestedIndex === state.preparedSearchIndex

    const renderCurrentSuggestions = () => {
      const currentInput = getSearchInput()
      if (!currentInput) {
        return
      }
      if (!state.searchIndexReady && query.trim()) {
        renderSearchIndexPreparingState(query)
        void state.searchIndexReadyPromise.then(() => {
          const latestInput = getSearchInput()
          if (requestId !== suggestionRequestId || latestInput?.value !== query) {
            return
          }

          scheduleSuggestionsRender({ preserveActive, immediate: true })
        })
        return
      }

      if (query.trim() && state.preparedSearchIndex.fullTextEnabled && !state.preparedSearchIndex.fullTextReady) {
        searchSuggestions = []
        activeSuggestionIndex = -1
        setActiveSearchDescendant('')
        patchNewtabSearchWidgetView({ suggestions: [], hint: { type: 'text', text: '正在检索本地书签与正文…' } })
        showSearchPanel()
      }
      void getSearchBookmarkSuggestions(query).then((directSuggestions) => {
        if (!isCurrent()) {
          return
        }

        renderSuggestions(mergeNewTabCommandSuggestions(query, directSuggestions), { preserveActive, query })
        if (!shouldLoadNaturalSearchSuggestions(query, directSuggestions)) {
          return
        }

        const runSemantic = () => {
          suggestionDebounceTimer = 0
          if (!isCurrent()) return
          void getNaturalSearchBookmarkSuggestions(query, { onPendingChange: updateNaturalButton, isActive: isCurrent }).then((naturalSuggestions) => {
          if (!isCurrent()) {
            return
          }

          updateNaturalButton()
          renderSuggestions(mergeNewTabCommandSuggestions(query, naturalSuggestions), { preserveActive: true, query })
        }).catch(() => {
          // Keep the popup-aligned suggestions visible if the optional natural-search chunk fails to load.
        }).finally(() => {
          if (isCurrent()) {
            updateNaturalButton()
          }
        })
        }
        suggestionDebounceTimer = window.setTimeout(runSemantic, immediate ? 0 : 520)
      }).catch(() => {
        if (!isCurrent()) {
          return
        }
        patchNewtabSearchWidgetView({ hint: { type: 'text', text: '本地索引暂时无法读取，请重新输入以重试。' } })
        showSearchPanel()
      })
    }

    suggestionDebounceTimer = 0
    renderCurrentSuggestions()
  }

  const renderSearchIndexPreparingState = (query: string) => {
    const input = getSearchInput()
    const trimmedQuery = String(query || '').trim()
    if (!input) {
      return
    }
    if (!trimmedQuery) {
      hideSuggestions()
      return
    }

    searchSuggestions = []
    activeSuggestionIndex = -1
    patchNewtabSearchWidgetView({
      chips: createNewTabSearchChips(trimmedQuery),
      hint: {
        type: 'text',
        text: '正在准备索引…'
      },
      sectionLabel: '书签匹配',
      suggestions: []
    })
    setSearchSuggestionsListVisible(false)
    showSearchPanel()
    openSearchCombobox()
    setActiveSearchDescendant('')
  }

  refreshNewTabSearchSuggestionsAfterAiSettingsChange = () => {
    updateNaturalButton()
    scheduleSuggestionsRender({ preserveActive: true, immediate: true, passive: true })
  }

  const moveActiveSuggestion = (direction: 1 | -1) => {
    if (!searchSuggestions.length) {
      scheduleSuggestionsRender({ preserveActive: true, immediate: true })
    }
    if (!searchSuggestions.length) {
      return
    }

    activeSuggestionIndex = activeSuggestionIndex < 0
      ? (direction > 0 ? 0 : searchSuggestions.length - 1)
      : (activeSuggestionIndex + direction + searchSuggestions.length) % searchSuggestions.length
    renderSuggestions(searchSuggestions, { preserveActive: true, query: getSearchInput()?.value || '' })
  }

  dispatchNewtabSearchWidgetView({
    // Settings can rebuild this view without remounting its uncontrolled input.
    action: createSearchWidgetActionState(getSearchInput()?.value || ''),
    buttons: {
      natural: getNaturalSearchButtonState()
    },
    chips: [],
    combobox: {
      activeDescendantId: activeSearchDescendantId,
      expanded: searchComboboxExpanded
    },
    hint: { type: 'empty' },
    interactions: createDefaultSearchWidgetInteractionState(),
    panel: {
      panelVisible: searchPanelVisible,
      suggestionsVisible: searchSuggestionListVisible
    },
    sectionLabel: '书签匹配',
    shell: createSearchWidgetShellState(settings),
    onNodesChange: handleSearchWidgetNodesChange,
    suggestions: [],
    webSearchEnabled: settings.webSearchEnabled,
    webSearchError: ''
  })
  syncSearchWidgetInteractions()
  renderSearchComboboxState()
  syncSearchWidgetPanelState()
  return true

  function createSearchWebFallbackState(query: string): SearchHintState {
    const label = '未找到书签；按 Enter 用 Chrome 默认搜索引擎搜索网页'
    return {
      type: 'webFallback',
      ariaLabel: label,
      label,
      title: `搜索「${query}」`,
      onSelect: () => {
        hideSuggestions()
        if (state.searchSettings.webSearchEnabled === false) {
          return
        }
        executeWebSearch(query)
      }
    }
  }

  function getNaturalSearchButtonState() {
    const active = state.searchSettings.naturalSearchEnabled
    return {
      active,
      ariaLabel: active ? '关闭 AI 语义搜索' : '开启 AI 语义搜索',
      fallback: Boolean(state.naturalSearchError),
      label: !active
        ? '语义'
        : state.naturalSearchPending
          ? '思考中'
          : 'AI',
      pending: state.naturalSearchPending,
      title: active
        ? (state.naturalSearchError || 'AI 已改写查询；点击关闭语义搜索')
        : state.searchSettings.naturalSearchAiConfigured
          ? '开启 AI 语义搜索'
          : '需要先配置 AI 服务'
    }
  }

  function getSearchSuggestionHintText(): string {
    const mode = state.searchSettings.naturalSearchEnabled
      ? state.naturalSearchError ? '本地回退' : 'AI 改写'
      : '关键词匹配'
    const fallback = state.naturalSearchError ? `；${state.naturalSearchError}` : ''
    const webShortcut = state.searchSettings.webSearchEnabled === false
      ? '' : '；Cmd/Ctrl+Enter 在新标签页搜索网页'
    return `按 ↓ 选择书签，选中后 Enter 打开${webShortcut}；${mode}${fallback}`
  }
}

function createNewTabSearchChips(query: string): SearchChipViewModel[] {
  return parseSearchQuery(query).chips.map((chip) => ({
    kind: chip.kind,
    label: chip.label
  }))
}

function isNewTabAdvancedSearchQuery(query: string): boolean {
  const value = String(query || '').trim()
  if (!value) {
    return false
  }

  if (parseSearchQuery(value).chips.length > 0) {
    return true
  }

  return /\b(?:site|domain|url|folder|path|type|kind):\s*\S/i.test(value) ||
    /(^|\s)-(?=\S)/.test(value) ||
    /(最近\s*\d+\s*(?:天|日|周|星期|礼拜|个月|月|年)|今天|今日|昨天|昨日|前天|本周|这周|上周|本月|这个月|上月|上个月|今年)/.test(value)
}

async function toggleNewTabNaturalSearch({
  input,
  updateNaturalButton,
  scheduleSuggestionsRender
}: {
  input: HTMLInputElement
  updateNaturalButton: () => void
  scheduleSuggestionsRender: (options?: { preserveActive?: boolean; immediate?: boolean }) => void
}): Promise<void> {
  const version = ++newTabNaturalSearchToggleVersion
  const enabled = !state.searchSettings.naturalSearchEnabled

  if (enabled) {
    const naturalSearchAiConfigured = await refreshNewTabNaturalSearchAiConfiguredState()
    if (version !== newTabNaturalSearchToggleVersion || !newTabControllerStarted) return
    if (naturalSearchAiConfigured === null) {
      setSettingsSaveStatus('error', 'AI 配置暂时无法读取，请重试。')
      return
    }
    if (!naturalSearchAiConfigured) {
      state.searchSettings = normalizeSearchSettings({
        ...state.searchSettings,
        naturalSearchEnabled: false
      })
      abortNewTabNaturalSearchRequest()
      naturalSearchSuggestionCache.clear()
      state.naturalSearchPlan = null
      state.naturalSearchError = ''
      setSettingsSaveStatus('error', '请配置 AI 服务。')
      openAiProviderSettings()
      updateNaturalButton()
      input.focus()
      scheduleSearchSettingsSave()
      return
    }
  }

  state.searchSettings = normalizeSearchSettings({
    ...state.searchSettings,
    naturalSearchEnabled: enabled
  })
  abortNewTabNaturalSearchRequest()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlan = null
  state.naturalSearchError = ''
  scheduleSearchSettingsSave()
  updateNaturalButton()
  input.focus()
  scheduleSuggestionsRender({ preserveActive: true, immediate: true })
}

function createSearchSuggestionViewModel(
  suggestion: NewTabSearchSuggestion,
  index: number,
  active: boolean,
  onSelect: (suggestion: NewTabSearchSuggestion) => void
): SearchSuggestionViewModel {
  const command = isCommandSuggestion(suggestion)
  const source = command ? suggestion.command.subtitle : suggestion.folderPath || suggestion.folderTitle
  const meta = source && suggestion.url
    ? `${source} · ${formatSearchSuggestionUrl(suggestion.url)}`
    : source || formatSearchSuggestionUrl(suggestion.url)

  return {
    active,
    ariaLabel: `${command ? '执行命令' : '打开书签'}：${suggestion.title}`,
    command,
    elementId: getSearchSuggestionElementId(index),
    id: getSearchSuggestionKey(suggestion, index),
    mark: command ? '>' : getFallbackLabel(suggestion.title),
    meta,
    onSelect: () => {
      onSelect(suggestion)
    },
    title: suggestion.title
  }
}

function getSearchSuggestionKey(suggestion: NewTabSearchSuggestion, index: number): string {
  const type = isCommandSuggestion(suggestion) ? 'command' : 'bookmark'
  return `${type}:${suggestion.id}:${index}`
}

function syncSearchInputActions(input: HTMLInputElement): void {
  patchNewtabSearchWidgetView({
    action: createSearchWidgetActionState(input.value)
  })
}

function createSearchWidgetShellState(settings: typeof DEFAULT_SEARCH_SETTINGS): SearchWidgetShellState {
  const webSearchEnabled = settings.webSearchEnabled !== false
  // A shell that already revealed is the most trusted source for the current
  // position; otherwise a cached offset was measured in this exact viewport on a
  // settled layout. Either lets first paint skip the hidden measurement gate.
  const cachedAutoOffsetY = settings.autoVerticalCenter
    ? getRevealedAutoSearchShell()?.offsetY ?? readCachedAutoSearchOffsetYValue()
    : null
  const initialOffsetY = settings.autoVerticalCenter
    ? cachedAutoOffsetY ?? settings.offsetY
    : settings.offsetY

  return {
    ariaLabel: webSearchEnabled ? '搜索书签、网页或命令' : '搜索书签或命令',
    autoVerticalCenter: settings.autoVerticalCenter,
    backgroundAlpha: String(settings.background / 100),
    height: settings.height,
    inputAriaLabel: webSearchEnabled
      ? '输入关键词搜索书签，未选中书签时按 Enter 搜索网页'
      : '输入关键词搜索本地书签或命令',
    layoutReady: !settings.autoVerticalCenter || cachedAutoOffsetY !== null,
    offsetY: initialOffsetY,
    placeholder: getSearchPlaceholder(settings),
    width: settings.width
  }
}

function getAutoSearchOffsetCacheKey(): string {
  // Keyed by viewport: a centered offset is only valid for the layout it was measured in.
  return `${AUTO_SEARCH_OFFSET_CACHE_KEY}:${window.innerWidth}x${window.innerHeight}`
}

function readCachedAutoSearchOffsetYValue(): number | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.localStorage.getItem(getAutoSearchOffsetCacheKey())
    if (value === null) {
      return null
    }
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return null
    }
    return clampNumber(
      numericValue,
      SEARCH_OFFSET_ABSOLUTE_MIN,
      SEARCH_OFFSET_ABSOLUTE_MAX,
      DEFAULT_SEARCH_SETTINGS.offsetY
    )
  } catch {
    return null
  }
}

function writeCachedAutoSearchOffsetY(offsetY: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(offsetY)) {
    return
  }

  try {
    window.localStorage.removeItem(AUTO_SEARCH_OFFSET_CACHE_KEY)
    window.localStorage.setItem(getAutoSearchOffsetCacheKey(), String(Math.round(offsetY)))
  } catch {
    // Ignore storage failures; this cache only improves first-paint positioning.
  }
}

function patchSearchWidgetShellState(patch: Partial<SearchWidgetShellState>): void {
  const view = getNewtabSearchWidgetView()
  if (!view) {
    return
  }

  const shell = {
    ...view.shell,
    ...patch
  }
  if (isSearchWidgetShellStateEqual(view.shell, shell)) {
    return
  }

  patchNewtabSearchWidgetView({
    shell
  })
}

function isSearchWidgetShellStateEqual(
  left: SearchWidgetShellState,
  right: SearchWidgetShellState
): boolean {
  return left.ariaLabel === right.ariaLabel &&
    left.autoVerticalCenter === right.autoVerticalCenter &&
    left.backgroundAlpha === right.backgroundAlpha &&
    left.height === right.height &&
    left.inputAriaLabel === right.inputAriaLabel &&
    left.layoutReady === right.layoutReady &&
    left.offsetY === right.offsetY &&
    left.placeholder === right.placeholder &&
    left.width === right.width
}

function mergeNewTabCommandSuggestions(
  query: string,
  bookmarkSuggestions: SearchBookmarkSuggestion[]
): NewTabSearchSuggestion[] {
  const commandSuggestions = getNewTabCommandSuggestions(query)
  if (!commandSuggestions.length) {
    return bookmarkSuggestions
  }

  return [
    ...commandSuggestions,
    ...bookmarkSuggestions
  ].slice(0, SEARCH_SUGGESTION_LIMIT + NEWTAB_COMMAND_SUGGESTION_LIMIT)
}

function getNewTabCommandSuggestions(query: string): NewTabSearchSuggestion[] {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery) {
    return []
  }

  return NEWTAB_COMMAND_SUGGESTIONS
    .map((command, order) => {
      const score = getNewTabCommandScore(normalizedQuery, command)
      if (score < 0) {
        return null
      }
      return {
        suggestionType: 'command' as const,
        id: `command:${command.id}`,
        title: command.title,
        url: '',
        folderTitle: '命令',
        folderPath: command.subtitle,
        score: NEWTAB_COMMAND_SCORE - score,
        order,
        command
      }
    })
    .filter((suggestion): suggestion is NewTabCommandSearchSuggestion => Boolean(suggestion))
    .sort((left, right) => left.score - right.score || left.order - right.order)
    .slice(0, NEWTAB_COMMAND_SUGGESTION_LIMIT)
}

function getNewTabCommandScore(normalizedQuery: string, command: NewTabCommandSuggestion): number {
  const haystack = normalizeNewTabSearchText([
    command.title,
    command.subtitle,
    ...command.keywords
  ].join(' '))
  if (!haystack) {
    return -1
  }
  if (haystack.includes(normalizedQuery)) {
    return normalizedQuery.length >= 4 ? 100 : 80
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  if (terms.length && terms.every((term) => haystack.includes(term))) {
    return 70
  }
  if (/^[:：/>]/.test(normalizedQuery)) {
    const commandQuery = normalizeNewTabSearchText(normalizedQuery.replace(/^[:：/>]+/, ''))
    return commandQuery && haystack.includes(commandQuery) ? 90 : -1
  }
  return -1
}

interface SearchSuggestionCacheEntry {
  promise: Promise<SearchBookmarkSuggestion[]>
  updatedAt: number
  settled: boolean
}

interface NaturalSearchSuggestionOptions {
  onPendingChange?: () => void
  isActive?: () => boolean
}

const searchSuggestionCache = new Map<string, SearchSuggestionCacheEntry>()
const naturalSearchSuggestionCache = new Map<string, SearchSuggestionCacheEntry>()
const NEWTAB_COMMAND_SUGGESTIONS: NewTabCommandSuggestion[] = [
  {
    id: 'open-bookmark-manager',
    title: '打开书签管理',
    subtitle: '在全页浏览目录树、多选批量整理和排序书签',
    keywords: ['bookmarks', 'manager', '书签管理', '全部书签', '整理书签', '管理', '文件夹', '多选', '排序'],
    run: () => openOptionsHash('#bookmarks')
  },
  {
    id: 'open-settings',
    title: '打开设置',
    subtitle: '调整来源、布局、背景、搜索栏和 AI 设置',
    keywords: ['settings', '设置', '选项', 'options', '配置', '打开设置'],
    run: () => openSettingsDrawer()
  },
  {
    id: 'open-inbox',
    title: '打开待整理',
    subtitle: '查看待整理和自动分析记录',
    keywords: ['inbox', '收件箱', '待整理', '未分类', '临时收藏', '稍后整理'],
    run: () => openOptionsHash('#bookmark-history')
  }
]

function abortNewTabNaturalSearchRequest(): void {
  state.naturalSearchAbortController?.abort()
  state.naturalSearchAbortController = null
  state.naturalSearchPending = false
  for (const [key, entry] of naturalSearchSuggestionCache) {
    if (!entry.settled) naturalSearchSuggestionCache.delete(key)
  }
}

function isNewTabNaturalSearchAbortError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (
      (error as { name?: unknown }).name === 'AbortError' ||
      (error as { kind?: unknown }).kind === 'abort'
    )
  )
}

function throwIfNewTabNaturalSearchRequestStale(
  settingsGeneration: number,
  signal?: AbortSignal | null
): void {
  if (
    settingsGeneration !== newTabNaturalSearchSettingsGeneration ||
    signal?.aborted
  ) {
    throw new DOMException('AI 搜索请求已失效。', 'AbortError')
  }
}

async function refreshNewTabNaturalSearchAiConfiguredState(): Promise<boolean | null> {
  const generation = newTabNaturalSearchSettingsGeneration
  const session = newTabControllerGeneration
  try {
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (generation !== newTabNaturalSearchSettingsGeneration || session !== newTabControllerGeneration || !newTabControllerStarted) return null
    const naturalSearchAiConfigured = naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)
    state.searchSettings = normalizeSearchSettings({
      ...state.searchSettings,
      naturalSearchAiConfigured
    })
    return naturalSearchAiConfigured
  } catch {
    return null
  }
}

function getSearchBookmarkSuggestions(query: string): Promise<SearchBookmarkSuggestion[]> {
  if (!newTabControllerStarted) return Promise.resolve([])
  if (!state.searchIndexReady) {
    return state.searchIndexReadyPromise.then(() => getSearchBookmarkSuggestions(query))
  }

  const cacheKey = getSearchSuggestionCacheKey(query)
  const cached = getSearchSuggestionCacheEntry(searchSuggestionCache, cacheKey)
  if (cached) {
    return cached.promise
  }

  const suggestionsPromise = getPopupSearchBookmarkSuggestionsFromIndex(
    query,
    state.preparedSearchIndex,
    SEARCH_SUGGESTION_LIMIT
  )
  setSearchSuggestionCacheEntry(searchSuggestionCache, cacheKey, suggestionsPromise)
  return suggestionsPromise
}

function getNaturalSearchBookmarkSuggestions(
  query: string,
  options: NaturalSearchSuggestionOptions = {}
): Promise<SearchBookmarkSuggestion[]> {
  if (!newTabControllerStarted) return Promise.resolve([])
  if (!state.searchSettings.naturalSearchEnabled) {
    return Promise.resolve([])
  }

  if (!state.searchIndexReady) {
    return state.searchIndexReadyPromise.then(() => getNaturalSearchBookmarkSuggestions(query, options))
  }

  const cacheKey = getSearchSuggestionCacheKey(query)
  const cached = getSearchSuggestionCacheEntry(naturalSearchSuggestionCache, cacheKey)
  if (cached) {
    const plan = state.naturalSearchPlanCache.get(getNaturalSearchPlanCacheKey(parseSearchQuery(query).rawQuery))
    if (plan) { state.naturalSearchPlan = plan; state.naturalSearchError = '' }
    if (state.naturalSearchPending) {
      options.onPendingChange?.()
    }
    return cached.promise
  }

  const settingsGeneration = newTabNaturalSearchSettingsGeneration
  const suggestionsPromise = resolveNewTabNaturalSearchPlan(query, options, settingsGeneration)
    .then(async (plan) => {
      throwIfNewTabNaturalSearchRequestStale(settingsGeneration)
      if (options.isActive && !options.isActive()) throw new DOMException('搜索已失效', 'AbortError')
      const suggestions = await getNaturalSearchBookmarkSuggestionsFromIndex(
        query,
        state.preparedSearchIndex,
        SEARCH_SUGGESTION_LIMIT,
        { naturalSearchPlan: plan }
      )
      throwIfNewTabNaturalSearchRequestStale(settingsGeneration)
      if (options.isActive && !options.isActive()) throw new DOMException('搜索已失效', 'AbortError')
      if (plan.source !== 'ai') naturalSearchSuggestionCache.delete(cacheKey)
      return suggestions
    })
  setSearchSuggestionCacheEntry(naturalSearchSuggestionCache, cacheKey, suggestionsPromise)
  return suggestionsPromise
}

async function resolveNewTabNaturalSearchPlan(
  query: string,
  options: NaturalSearchSuggestionOptions = {},
  settingsGeneration = newTabNaturalSearchSettingsGeneration
): Promise<NaturalSearchPlan> {
  const naturalSearch = await import('../popup/natural-search.js')
  const localPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
  const normalizedQuery = localPlan.rawQuery

  throwIfNewTabNaturalSearchRequestStale(settingsGeneration)
  if (options.isActive && !options.isActive()) throw new DOMException('搜索已失效', 'AbortError')

  if (!state.searchSettings.naturalSearchEnabled) {
    state.naturalSearchPlan = null
    return localPlan
  }

  const planCacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const cachedPlan = state.naturalSearchPlanCache.get(planCacheKey)
  if (cachedPlan) {
    state.naturalSearchPlan = cachedPlan
    state.naturalSearchError = ''
    return cachedPlan
  }

  state.naturalSearchAbortController?.abort()
  const controller = new AbortController()
  state.naturalSearchAbortController = controller
  state.naturalSearchPending = true
  state.naturalSearchError = ''
  options.onPendingChange?.()

  try {
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      state.searchSettings = normalizeSearchSettings({
        ...state.searchSettings,
        naturalSearchEnabled: false,
        naturalSearchAiConfigured: false
      })
      state.naturalSearchError = ''
      state.naturalSearchPlan = null
      setSettingsSaveStatus('error', '请配置 AI 服务。')
      openAiProviderSettings()
      scheduleSearchSettingsSave()
      return localPlan
    }
    state.searchSettings = normalizeSearchSettings({
      ...state.searchSettings,
      naturalSearchAiConfigured: true
    })

    const plan = await naturalSearchAi.requestNaturalSearchAiPlan({
      query,
      localPlan,
      settings,
      signal: controller.signal
    })
    throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)
    state.naturalSearchPlan = plan
    state.naturalSearchError = ''
    if (plan.source === 'ai') {
      state.naturalSearchPlanCache.set(planCacheKey, plan)
      while (state.naturalSearchPlanCache.size > SEARCH_SUGGESTION_CACHE_LIMIT) {
        state.naturalSearchPlanCache.delete(state.naturalSearchPlanCache.keys().next().value!)
      }
    }
    return plan
  } catch (error) {
    if (
      settingsGeneration !== newTabNaturalSearchSettingsGeneration ||
      controller.signal.aborted ||
      isNewTabNaturalSearchAbortError(error)
    ) {
      throw error
    }
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)
    state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    state.naturalSearchPlan = localPlan
    return localPlan
  } finally {
    if (state.naturalSearchAbortController === controller) {
      state.naturalSearchAbortController = null
      state.naturalSearchPending = false
      options.onPendingChange?.()
    }
  }
}

function getSearchSuggestionCacheEntry(
  cache: Map<string, SearchSuggestionCacheEntry>,
  cacheKey: string,
  now = Date.now()
): SearchSuggestionCacheEntry | null {
  const cached = cache.get(cacheKey)
  if (!cached) {
    return null
  }

  if (now - cached.updatedAt > SEARCH_SUGGESTION_CACHE_TTL_MS) {
    cache.delete(cacheKey)
    return null
  }

  cache.delete(cacheKey)
  cache.set(cacheKey, cached)
  return cached
}

function setSearchSuggestionCacheEntry(
  cache: Map<string, SearchSuggestionCacheEntry>,
  cacheKey: string,
  promise: Promise<SearchBookmarkSuggestion[]>
): void {
  cache.set(cacheKey, {
    promise,
    updatedAt: Date.now(),
    settled: false
  })
  promise.then(() => {
    const entry = cache.get(cacheKey)
    if (entry?.promise === promise) entry.settled = true
  }, () => {
    if (cache.get(cacheKey)?.promise === promise) {
      cache.delete(cacheKey)
    }
  })
  pruneSearchSuggestionCache(cache)
}

function pruneSearchSuggestionCache(
  cache: Map<string, SearchSuggestionCacheEntry>,
  now = Date.now()
): void {
  for (const [cacheKey, entry] of cache.entries()) {
    if (now - entry.updatedAt > SEARCH_SUGGESTION_CACHE_TTL_MS) {
      cache.delete(cacheKey)
    }
  }

  while (cache.size > SEARCH_SUGGESTION_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) {
      break
    }
    cache.delete(oldestKey)
  }
}

function shouldLoadNaturalSearchSuggestions(
  query: string,
  directSuggestions: SearchBookmarkSuggestion[]
): boolean {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery) {
    return false
  }
  if (state.searchSettings.naturalSearchEnabled) {
    return true
  }
  return false
}

function normalizeNewTabBookmarkTagIndex(raw: unknown): BookmarkTagIndex {
  const source = raw && typeof raw === 'object'
    ? raw as { updatedAt?: unknown; records?: unknown }
    : {}
  const rawRecords = source.records && typeof source.records === 'object'
    ? source.records as Record<string, unknown>
    : {}
  const records: BookmarkTagIndex['records'] = {}

  for (const [fallbackBookmarkId, rawRecord] of Object.entries(rawRecords)) {
    const record = normalizeNewTabBookmarkTagRecord(rawRecord, fallbackBookmarkId)
    if (record) {
      records[record.bookmarkId] = record
    }
  }

  return {
    version: 1,
    updatedAt: normalizeNewTabTimestamp(source.updatedAt) || getLatestNewTabBookmarkTagUpdatedAt(records),
    records
  }
}

function normalizeNewTabBookmarkTagRecord(raw: unknown, fallbackBookmarkId: string): BookmarkTagRecord | null {
  const source = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {}
  const bookmarkId = normalizeNewTabTagText(source.bookmarkId || fallbackBookmarkId)
  const url = normalizeNewTabTagText(source.url)
  if (!bookmarkId || !url) {
    return null
  }

  const generatedAt = normalizeNewTabTimestamp(source.generatedAt) || Date.now()
  const updatedAt = normalizeNewTabTimestamp(source.updatedAt) || generatedAt
  const manualTags = normalizeNewTabBookmarkTagList(source.manualTags, 12)
  const record: BookmarkTagRecord = {
    schemaVersion: 1,
    bookmarkId,
    url,
    normalizedUrl: normalizeNewTabTagText(source.normalizedUrl || url),
    duplicateKey: normalizeNewTabTagText(source.duplicateKey || source.normalizedUrl || url),
    title: normalizeNewTabTagText(source.title, 180),
    path: normalizeNewTabTagText(source.path, 240),
    summary: normalizeNewTabTagText(source.summary, 500),
    contentType: normalizeNewTabTagText(source.contentType || source.content_type, 40),
    topics: normalizeNewTabTagTextList(source.topics, 8, 40),
    tags: normalizeNewTabBookmarkTagList(source.tags, 12),
    aliases: normalizeNewTabTagTextList(source.aliases, 20, 40),
    confidence: normalizeNewTabTagConfidence(source.confidence),
    source: normalizeNewTabBookmarkTagSource(source.source),
    model: normalizeNewTabTagText(source.model, 120),
    extraction: normalizeNewTabBookmarkTagExtraction(source.extraction),
    generatedAt,
    updatedAt
  }

  if (manualTags.length) {
    record.manualTags = manualTags
    record.manualUpdatedAt = normalizeNewTabTimestamp(source.manualUpdatedAt) || updatedAt
  }

  return record
}

function normalizeNewTabBookmarkTagExtraction(raw: unknown): BookmarkTagExtraction {
  const source = raw && typeof raw === 'object'
    ? raw as { status?: unknown; source?: unknown; warnings?: unknown }
    : {}

  return {
    status: normalizeNewTabTagText(source.status, 40),
    source: normalizeNewTabTagText(source.source, 80),
    warnings: normalizeNewTabTagTextList(source.warnings, 4, 40)
  }
}

function normalizeNewTabBookmarkTagSource(value: unknown): BookmarkTagSource {
  const source = String(value || '').trim()
  return source === 'ai_naming' ||
    source === 'auto_analyze' ||
    source === 'popup_smart' ||
    source === 'imported' ||
    source === 'manual'
    ? source
    : 'imported'
}

function normalizeNewTabBookmarkTagList(value: unknown, limit: number): string[] {
  return normalizeNewTabTagTextList(value, limit, 24)
}

function normalizeNewTabTagTextList(value: unknown, limit: number, itemLimit: number): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set<string>()
  const output: string[] = []

  for (const item of values) {
    const text = normalizeNewTabTagText(item, itemLimit)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= limit) {
      break
    }
  }

  return output
}

function normalizeNewTabTagText(value: unknown, limit = 1000): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeNewTabTagConfidence(value: unknown): number {
  const rawNumber = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/%$/, ''))
  if (!Number.isFinite(rawNumber)) {
    return 0
  }
  const normalized = rawNumber > 1 && rawNumber <= 100 ? rawNumber / 100 : rawNumber
  return Math.max(0, Math.min(normalized, 1))
}

function normalizeNewTabTimestamp(value: unknown): number {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

function getLatestNewTabBookmarkTagUpdatedAt(records: BookmarkTagIndex['records']): number {
  return Object.values(records).reduce((latest, record) => Math.max(latest, Number(record.updatedAt) || 0), 0)
}

function normalizeNewTabContentSnapshotIndex(raw: unknown): ContentSnapshotIndex {
  const source = raw && typeof raw === 'object'
    ? raw as { updatedAt?: unknown; records?: unknown }
    : {}
  const rawRecords = source.records && typeof source.records === 'object'
    ? source.records as Record<string, unknown>
    : {}
  const records: ContentSnapshotIndex['records'] = {}

  for (const [fallbackBookmarkId, rawRecord] of Object.entries(rawRecords)) {
    const record = normalizeNewTabContentSnapshotRecord(rawRecord, fallbackBookmarkId)
    if (record.bookmarkId && record.snapshotId) {
      records[record.bookmarkId] = record
    }
  }

  return {
    version: 1,
    updatedAt: Number(source.updatedAt) || 0,
    records
  }
}

function normalizeNewTabContentSnapshotRecord(raw: unknown, fallbackBookmarkId: string): ContentSnapshotIndex['records'][string] {
  const source = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {}
  const bookmarkId = String(source.bookmarkId || fallbackBookmarkId || '').trim()
  const snapshotId = String(source.snapshotId || bookmarkId || '').trim()
  const fullTextStorage = ['local', 'idb'].includes(String(source.fullTextStorage))
    ? String(source.fullTextStorage) as ContentSnapshotIndex['records'][string]['fullTextStorage']
    : 'none'

  return {
    snapshotId,
    bookmarkId,
    url: String(source.url || '').trim(),
    title: normalizeNewTabSnapshotText(source.title),
    summary: normalizeNewTabSnapshotText(source.summary),
    headings: normalizeNewTabSnapshotTextList(source.headings, 28),
    canonicalUrl: String(source.canonicalUrl || '').trim(),
    finalUrl: String(source.finalUrl || '').trim(),
    contentType: normalizeNewTabSnapshotText(source.contentType),
    source: normalizeNewTabSnapshotText(source.source),
    extractionStatus: normalizeNewTabSnapshotText(source.extractionStatus),
    extractedAt: Number(source.extractedAt) || 0,
    hasFullText: source.hasFullText === true,
    fullTextBytes: Number(source.fullTextBytes) || 0,
    fullTextStorage,
    fullText: fullTextStorage === 'local' ? String(source.fullText || '') : undefined,
    fullTextRef: fullTextStorage === 'idb' ? String(source.fullTextRef || snapshotId || '').trim() : undefined,
    warnings: normalizeNewTabSnapshotTextList(source.warnings, 8)
  }
}

function normalizeNewTabSnapshotText(value: unknown, limit = 500): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeNewTabSnapshotTextList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.flatMap(item => { const mappedResult = normalizeNewTabSnapshotText(item, 120); return mappedResult ? [mappedResult] : [] }).slice(0, limit)
    : []
}

function getSearchSuggestionCacheKey(query: string): string {
  return [
    searchDateBucket(),
    state.preparedSearchIndex.entries.length,
    state.bookmarkTagIndex?.updatedAt || 0,
    state.searchSnapshotIndex?.updatedAt || 0,
    state.searchSettings.naturalSearchEnabled ? 'ai' : 'local',
    // The executable grammar preserves literal Unicode and punctuation. NFKC
    // would alias distinct quoted terms even though their result sets differ.
    parseSearchQuery(query).rawQuery
  ].join(':')
}

function getNaturalSearchDateBucket(): string {
  return formatNewTabLocalDate(Date.now())
}

function getNaturalSearchPlanCacheKey(normalizedQuery: string): string {
  return `${getNaturalSearchDateBucket()}\u0000${normalizedQuery}`
}

function getSearchSuggestionElementId(index: number): string {
  return `newtab-search-suggestion-${index}`
}

function formatSearchSuggestionUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname
    return `${parsedUrl.hostname}${pathname}`
  } catch {
    return url.replace(/^https?:\/\//i, '')
  }
}

function isCommandSuggestion(suggestion: NewTabSearchSuggestion): suggestion is NewTabCommandSearchSuggestion {
  return suggestion.suggestionType === 'command'
}

function openSearchSuggestion(suggestion: NewTabSearchSuggestion): void {
  if (isCommandSuggestion(suggestion)) {
    suggestion.command.run()
    return
  }

  openBookmarkSuggestion(suggestion)
}

function openBookmarkSuggestion(suggestion: SearchBookmarkSuggestion): void {
  const bookmark = state.allBookmarkMap.get(String(suggestion.id)) || getBookmarkById(suggestion.id)
  if (!bookmark) {
    return
  }

  void recordBookmarkOpen(bookmark)
  openSearchTarget(String(bookmark.url || suggestion.url))
}

function createBookmarkSections(sections: NewTabFolderSection[]): NewTabBookmarksModule {
  let speedDial = false
  for (const moduleKey of getVisibleNewTabModules(state.moduleSettings)) {
    const module = createConfigurableNewTabModule(moduleKey)
    if (module === 'speedDial') {
      speedDial = true
    }
  }

  if (state.folderSettings.browseMode === 'navigation') {
    return createBookmarkNavigationModule(speedDial)
  }

  const sourceNavigation = createSourceNavigation(sections)
  let renderedBookmarkIndex = 0
  const sectionModels: BookmarkFolderSectionViewModel[] = sections.map((section) => {
    const dragging = section.id === state.draggingFolderId && Boolean(state.folderDragOriginalOrderIds.length)
    const sectionModel: BookmarkFolderSectionViewModel = {
      anchorId: getNewTabSourceAnchorId(section.id),
      bookmarkCount: section.bookmarks.length,
      dragging,
      folderId: section.id,
      grid: null,
      onAddBookmark: openAddBookmarkMenuForElement,
      onClick: handleFolderHeaderClick,
      onContextMenu: (event) => {
        handleFolderContextMenu(section.id, event)
      },
      onDragPointerDown: (event) => {
        handleFolderDragPointerDown(section.id, event.currentTarget, event)
      },
      onReorderKeyDown: (event) => {
        handleFolderReorderKeyDown(section.id, event)
      },
      onOpenFolderSettings: openFolderSourceSettings,
      path: section.path,
      title: section.title
    }

    if (section.bookmarks.length) {
      const startIndex = renderedBookmarkIndex
      const initialVisibleCount = Math.min(
        section.bookmarks.length,
        Math.max(0, BOOKMARK_TILE_INITIAL_RENDER_LIMIT - startIndex)
      )
      sectionModel.grid = {
        ariaLabel: `${section.title || '文件夹'}书签`,
        busy: state.reorderingBookmarks,
        chunkSize: BOOKMARK_TILE_RENDER_CHUNK_SIZE,
        folderId: section.id,
        initialVisibleCount,
        items: section.bookmarks.map((bookmark, index) =>
          createBookmarkTileViewModel(bookmark, section.id, startIndex + index)
        )
      }
      renderedBookmarkIndex += section.bookmarks.length
    }

    return sectionModel
  })

  const reorderStatusMessage = state.bookmarkReorderError || state.folderReorderStatus
  const viewModel: BookmarkContentViewModel = {
    content: createBookmarkContentStyleState(),
    browseMode: 'expanded',
    navigation: null,
    portal: null,
    reorderStatus: reorderStatusMessage
      ? {
          message: reorderStatusMessage,
          tone: state.bookmarkReorderError ? 'error' : state.folderReorderStatusTone
        }
      : null,
    sections: sectionModels,
    sourceNavigation,
    speedDial
  }

  dispatchNewtabBookmarkContentView(viewModel)
  return {
    id: 'bookmarks',
    iconVerticalCenter: state.iconSettings.verticalCenter,
    kind: 'bookmarks',
    placement: 'primary'
  }
}

// 导航模式：把当前浏览层级渲染成单一扁平网格（子文件夹卡片在前、直属书签在后），
// 顶部一条面包屑。根层（path 空）用选中的来源文件夹作为子文件夹卡片；进入后
// 用该文件夹的直接子文件夹 + 直属书签。全程复用同一套书签卡片视觉，且不再有
// 任何竖向分组 section（形变从结构上消失）。
function createBookmarkNavigationModule(
  speedDial: boolean
): NewTabBookmarksModule {
  const level = resolveBookmarkNavigationLevel()
  const folderCards: BookmarkFolderCardViewModel[] = level.folders.map((folder) => ({
    bookmarkCount: getFolderBookmarkCounts(folder).totalBookmarkCount,
    folderId: String(folder.id),
    onContextMenu: (event) => {
      handleFolderContextMenu(String(folder.id), event)
    },
    onOpen: (event) => {
      event.preventDefault()
      event.stopPropagation()
      enterBookmarkNavigationFolder(String(folder.id))
    },
    title: String(folder.title || '未命名文件夹').trim() || '未命名文件夹'
  }))

  const items = level.bookmarks.map((bookmark, index) =>
    createBookmarkTileViewModel(bookmark, level.folderId, folderCards.length + index)
  )
  const initialVisibleCount = Math.min(items.length, Math.max(0, BOOKMARK_TILE_INITIAL_RENDER_LIMIT - folderCards.length))

  const navigation: BookmarkNavigationViewModel = {
    ariaLabel: `${level.title || '书签'}导航`,
    breadcrumb: level.breadcrumb,
    chunkSize: BOOKMARK_TILE_RENDER_CHUNK_SIZE,
    folderCards,
    initialVisibleCount,
    items
  }

  const reorderStatusMessage = state.bookmarkReorderError || state.folderReorderStatus
  const viewModel: BookmarkContentViewModel = {
    content: createBookmarkContentStyleState(),
    browseMode: 'navigation',
    navigation,
    portal: null,
    reorderStatus: reorderStatusMessage
      ? {
          message: reorderStatusMessage,
          tone: state.bookmarkReorderError ? 'error' : state.folderReorderStatusTone
        }
      : null,
    sections: [],
    sourceNavigation: null,
    speedDial
  }

  dispatchNewtabBookmarkContentView(viewModel)
  return {
    id: 'bookmarks',
    iconVerticalCenter: state.iconSettings.verticalCenter,
    kind: 'bookmarks',
    placement: 'primary'
  }
}

interface BookmarkNavigationLevel {
  breadcrumb: BookmarkNavigationViewModel['breadcrumb']
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  folderId: string
  folders: chrome.bookmarks.BookmarkTreeNode[]
  title: string
}

// 依据 state.bookmarkNavigationPath 解析当前层级。路径里失效的 folderId 会被截断，
// 保证始终落在一个有效层级（最坏回到根来源层）。根层直接用选中的来源文件夹作为
// 文件夹卡片（不用展开模式那套 getDisplayableNewTabSourceFolders 扁平化结果，否则
// 嵌套子文件夹会错误地平铺到根层）。
function resolveBookmarkNavigationLevel(): BookmarkNavigationLevel {
  const rootBreadcrumb = {
    folderId: '',
    onNavigate: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      exitBookmarkNavigationToRoot()
    },
    title: '书签'
  }

  const rootSourceFolders = (): chrome.bookmarks.BookmarkTreeNode[] => {
    const seen = new Set<string>()
    const folders: chrome.bookmarks.BookmarkTreeNode[] = []
    for (const folderId of normalizeFolderIds(state.folderSettings.selectedFolderIds)) {
      const node = state.folderNodeMap.get(folderId) || null
      if (!node || node.url || seen.has(String(node.id))) {
        continue
      }
      seen.add(String(node.id))
      folders.push(node)
    }
    return folders
  }

  const path = state.bookmarkNavigationPath
  if (!path.length) {
    return {
      breadcrumb: [rootBreadcrumb],
      bookmarks: [],
      folderId: '',
      folders: rootSourceFolders(),
      title: '书签'
    }
  }

  const breadcrumb: BookmarkNavigationViewModel['breadcrumb'] = [rootBreadcrumb]
  let currentNode: chrome.bookmarks.BookmarkTreeNode | null = null
  const validatedPath: string[] = []
  for (const folderId of path) {
    const node = state.folderNodeMap.get(folderId) || null
    if (!node || node.url) {
      break
    }
    validatedPath.push(folderId)
    currentNode = node
    breadcrumb.push({
      folderId,
      onNavigate: (event) => {
        event.preventDefault()
        event.stopPropagation()
        navigateBookmarkNavigationTo(folderId)
      },
      title: String(node.title || '未命名文件夹').trim() || '未命名文件夹'
    })
  }
  if (validatedPath.length !== path.length) {
    state.bookmarkNavigationPath = validatedPath
  }

  if (!currentNode) {
    return {
      breadcrumb: [rootBreadcrumb],
      bookmarks: [],
      folderId: '',
      folders: rootSourceFolders(),
      title: '书签'
    }
  }

  const children = currentNode.children || []
  return {
    breadcrumb,
    bookmarks: children.filter((child) => Boolean(child.url)),
    folderId: String(currentNode.id),
    folders: children.filter((child) => !child.url),
    title: String(currentNode.title || '未命名文件夹').trim() || '未命名文件夹'
  }
}

function enterBookmarkNavigationFolder(folderId: string): void {
  const id = String(folderId || '').trim()
  if (!id || !state.folderNodeMap.has(id)) {
    return
  }
  state.bookmarkNavigationPath = [...state.bookmarkNavigationPath, id]
  rerenderBookmarkNavigation()
}

function navigateBookmarkNavigationTo(folderId: string): void {
  const index = state.bookmarkNavigationPath.indexOf(String(folderId))
  if (index < 0) {
    return
  }
  state.bookmarkNavigationPath = state.bookmarkNavigationPath.slice(0, index + 1)
  rerenderBookmarkNavigation()
}

function exitBookmarkNavigationToRoot(): void {
  if (!state.bookmarkNavigationPath.length) {
    return
  }
  state.bookmarkNavigationPath = []
  rerenderBookmarkNavigation()
}

function rerenderBookmarkNavigation(): void {
  if (!renderBookmarkSections()) {
    render()
  }
  scheduleAdaptiveNewTabLayoutUpdate()
}

function createBookmarkContentStyleState(): BookmarkContentStyleState {
  const gridSettings = {
    ...state.iconSettings,
    columns: getResponsiveIconColumns(state.iconSettings)
  }

  return {
    columnGap: getIconGapPx(state.iconSettings.columnGap),
    columns: gridSettings.columns,
    fixedGridWidth: getFixedIconGridWidthPx(gridSettings),
    folderGap: getFolderGapPx(state.iconSettings.folderGap),
    iconShellSize: state.iconSettings.iconShellSize,
    layoutMode: state.iconSettings.layoutMode,
    pageWidth: getIconPageWidthPx(state.iconSettings.pageWidth),
    reordering: state.reorderingBookmarks,
    rowGap: getIconRowGapPx(state.iconSettings.rowGap),
    showTitles: state.iconSettings.showTitles,
    tileWidth: getEffectiveIconTileWidthPx(state.iconSettings),
    titleLines: state.iconSettings.titleLines,
    verticalCenter: state.iconSettings.verticalCenter
  }
}

function createConfigurableNewTabModule(key: NewTabModuleSettingKey): 'speedDial' | null {
  if (key === 'speedDial') {
    return createSpeedDialPanel()
  }
  return null
}

function getActiveWorkspacePinnedIds(): string[] {
  return getActiveNewTabWorkspace(state.workspaceSettings).pinnedIds
}

function isBookmarkPinnedInSpeedDial(pinnedIds: string[], bookmarkId: string): boolean {
  const id = String(bookmarkId || '').trim()
  return Boolean(id && pinnedIds.includes(id))
}

function getSpeedDialPinActionCopyLocal(isPinned: boolean): {
  label: string
  status: string
  ariaLabel: string
} {
  return isPinned
    ? {
        label: '取消固定',
        status: '已取消固定入口',
        ariaLabel: '取消固定入口'
      }
    : {
        label: '设为固定入口',
        status: '已添加固定入口',
        ariaLabel: '将书签设为固定入口'
      }
}

function createSpeedDialPanel(): 'speedDial' | null {
  if (!state.moduleSettings.speedDial) {
    dispatchNewtabSpeedDialView(null)
    return null
  }

  hydrateSpeedDialPanel()
  return 'speedDial'
}

function hydrateSpeedDialPanel(): void {
  if (!state.moduleSettings.speedDial) {
    return
  }
  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const items = buildSpeedDialItems({
    pinnedIds: activeWorkspace.pinnedIds,
    bookmarks: state.allBookmarkMap
  })
  renderSpeedDialPanel(items)
}

function refreshSpeedDialPanel(): void {
  if (state.moduleSettings.speedDial) {
    hydrateSpeedDialPanel()
  } else {
    dispatchNewtabSpeedDialView(null)
  }
}

function renderSpeedDialPanel(
  items: SpeedDialItem[]
): void {
  if (!items.length) {
    dispatchNewtabSpeedDialView({
      ariaBusy: false,
      content: {
        type: 'empty',
        state: createSpeedDialEmptyState()
      },
      meta: getSpeedDialStatus(false, state.speedDialReorderError),
      metaTone: state.speedDialReorderError ? 'error' : ''
    })
    return
  }

  const cardModels: SpeedDialCardViewModel[] = []
  for (const item of items) {
    const bookmark = getBookmarkById(item.id)
    if (!bookmark?.url) {
      continue
    }
    const renderIndex = cardModels.length
    cardModels.push(createSpeedDialCardViewModel(item, bookmark, renderIndex))
  }

  dispatchNewtabSpeedDialView({
    ariaBusy: false,
    content: {
      type: 'items',
      busy: state.reorderingSpeedDial,
      items: cardModels
    },
    meta: getSpeedDialStatus(state.reorderingSpeedDial, state.speedDialReorderError),
    metaTone: state.speedDialReorderError ? 'error' : ''
  })
}

function createSpeedDialCardViewModel(
  item: SpeedDialItem,
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  renderIndex = 0
): SpeedDialCardViewModel {
  const customIcon = state.customIcons[String(item.id)]
  const faviconLoadAttributes = getSpeedDialFaviconLoadAttributes(renderIndex)
  return {
    customIcon: Boolean(customIcon),
    detail: item.detail,
    dragging: String(item.id) === state.speedDialDraggingBookmarkId && Boolean(state.speedDialDragOriginalOrderIds.length),
    fallbackLabel: item.fallbackLabel,
    favicon: {
      fetchpriority: faviconLoadAttributes.fetchpriority,
      loading: faviconLoadAttributes.loading,
      pageUrl: item.url,
      src: customIcon || getFaviconUrl(item.url, item.id)
    },
    id: item.id,
    onContextMenu: (event) => {
      handleBookmarkContextMenu(item.id, event)
    },
    onDragPointerDown: (event) => {
      const card = getNewtabSpeedDialNodes().cards.get(String(item.id)) || event.currentTarget
      handleSpeedDialDragPointerDown(item.id, card, event)
    },
    onReorderKeyDown: (event) => {
      handleSpeedDialReorderKeyDown(String(item.id), event)
    },
    onNavigate: (event) => {
      handleBookmarkNavigation(event, bookmark, item.url)
    },
    title: item.title,
    url: item.url
  }
}

function createSourceNavigation(sections: NewTabFolderSection[]): SourceNavigationState | null {
  if (!state.generalSettings.showSourceNavigation || sections.length < 2) {
    return null
  }

  const items = buildNewTabSourceNavigationItems(sections)
  if (items.length < 2) {
    return null
  }

  return {
    items
  }
}

function getResponsiveIconColumns(settings: IconSettings): number {
  return getResponsiveFixedIconColumns(
    settings,
    getNewtabViewportWidth()
  )
}

function getNewtabViewportWidth(): number {
  return window.innerWidth || 1280
}

function getNewtabViewportHeight(): number {
  return window.innerHeight || 0
}

function getNewtabViewportRect(): DOMRect {
  return new DOMRect(0, 0, getNewtabViewportWidth(), getNewtabViewportHeight())
}

function createBookmarkTileViewModel(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  folderId: string,
  renderIndex = 0
): BookmarkTileViewModel {
  const url = String(bookmark.url || '')
  const title = String(bookmark.title || '').trim() || url
  const bookmarkId = String(bookmark.id)
  const customIcon = state.customIcons[bookmarkId]
  let faviconSrc: string | undefined
  return {
    customIcon: Boolean(customIcon),
    dragging: bookmarkId === state.draggingBookmarkId && Boolean(state.dragOriginalOrderIds.length),
    fallbackLabel: getFallbackLabel(title),
    favicon: {
      fetchpriority: renderIndex < HIGH_PRIORITY_FAVICON_LIMIT ? 'high' : 'low',
      loading: renderIndex < EAGER_FAVICON_LIMIT ? 'eager' : 'lazy',
      pageUrl: url,
      // Offscreen tiles need no Chrome favicon URL until the grid mounts them.
      get src() { return faviconSrc ??= customIcon || getFaviconUrl(url, bookmarkId) }
    },
    folderId,
    id: bookmarkId,
    onContextMenu: (event) => {
      handleBookmarkContextMenu(bookmarkId, event)
    },
    onDragPointerDown: (event) => {
      const tile = getNewtabBookmarkContentNodes().tiles.get(bookmarkId) || event.currentTarget
      handleBookmarkDragPointerDown(bookmarkId, folderId, tile, event)
    },
    // The visible "…" trigger opens the same menu as a right-click, anchored
    // at the pointer position.
    onOpenMenu: (event) => {
      handleBookmarkContextMenu(bookmarkId, event)
    },
    onReorderKeyDown: (event) => {
      handleBookmarkReorderKeyDown(bookmarkId, folderId, event)
    },
    onNavigate: (event) => {
      handleBookmarkNavigation(event, bookmark, url)
    },
    title,
    url
  }
}

function cleanupNewTabController(): void {
  searchWidgetGeneration += 1
  dismissedSearchQuery = null
  state.deleteToastBusy = false
  state.deleteToastTitle = ''
  state.deleteToastTone = 'success'
  if (settingsPersistence.hasPending()) {
    // A just-edited layout may not have reached the measured preboot snapshot.
    // Do not replay its previous geometry while recovering the final settings.
    clearNewtabBookmarkPrebootSnapshot()
    try { window.localStorage.removeItem(getAutoSearchOffsetCacheKey()) } catch { /* Startup caches are optional. */ }
  }
  settingsPersistence.flushOnExit()
  newTabControllerStarted = false
  newTabControllerGeneration += 1
  searchIndexBuildVersion += 1
  searchIndexRebuildScheduled = false
  resolveSearchIndexReady()
  backgroundApplyToken += 1
  backgroundUploadVersion += 1
  newTabRefreshVersion += 1
  newTabSearchHydrationVersion += 1
  customIconLoadVersion += 1
  newTabNaturalSearchSettingsGeneration += 1
  newTabNaturalSearchToggleVersion += 1
  newTabRefreshStorageChanges = null
  clearTimeout(newTabMetadataRefreshTimer)
  newTabMetadataRefreshTimer = undefined
  closeBookmarkMenu({ animate: false })
  closeAddBookmarkMenu({ animate: false })
  refreshNewTabSearchSuggestionsAfterAiSettingsChange = null
  if (newTabStorageEventsBound) {
    chrome.storage.onChanged.removeListener(handleNewTabStorageChanged)
    newTabStorageEventsBound = false
  }
  activeFaviconResolutionUnsubscribe?.()
  activeFaviconResolutionUnsubscribe = null
  unregisterNewtabContentShellActions()
  unregisterNewtabContentShellActions = () => {}
  unregisterNewtabContentLayoutNodes()
  unregisterNewtabContentLayoutNodes = () => {}
  unregisterNewtabKeyboardActions()
  unregisterNewtabKeyboardActions = () => {}
  unregisterNewtabLifecycleActions()
  unregisterNewtabLifecycleActions = () => {}
  unregisterNewtabSettingsDrawerNodes()
  unregisterNewtabSettingsDrawerNodes = () => {}
  unregisterNewtabWindowActions()
  unregisterNewtabWindowActions = () => {}
  syncDragWindowListeners()
  unregisterNewtabBookmarkEventActions()
  unregisterNewtabBookmarkEventActions = () => {}
  window.clearTimeout(backgroundStartupCacheTimer)
  backgroundStartupCacheTimer = 0
  backgroundStartupCacheRequestId += 1
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = 0
  window.clearTimeout(searchSettingsSettleTimer)
  searchSettingsSettleTimer = 0
  window.clearTimeout(iconSettingsSaveTimer)
  iconSettingsSaveTimer = 0
  window.clearTimeout(settingsSaveStatusTimer)
  settingsSaveStatusTimer = 0
  window.clearTimeout(folderReorderStatusTimer)
  folderReorderStatusTimer = 0
  window.clearTimeout(bookmarkChangeRefreshTimer)
  bookmarkChangeRefreshTimer = 0
  window.clearTimeout(state.dragLongPressTimer)
  state.dragLongPressTimer = 0
  window.clearTimeout(state.speedDialDragLongPressTimer)
  state.speedDialDragLongPressTimer = 0
  window.clearTimeout(state.folderDragLongPressTimer)
  state.folderDragLongPressTimer = 0
  window.cancelAnimationFrame(resizeLayoutFrame)
  resizeLayoutFrame = 0
  window.cancelAnimationFrame(verticalCenterCollisionFrame)
  verticalCenterCollisionFrame = 0
  window.cancelAnimationFrame(autoSearchLayoutRevealFrame)
  autoSearchLayoutRevealFrame = 0
  lastMeasuredSearchSlot = null
  window.cancelAnimationFrame(verticalCenterContentSettleFrame)
  verticalCenterContentSettleFrame = 0
  settledVerticalCenterContent = null
  window.cancelAnimationFrame(deferredRenderFrame)
  deferredRenderFrame = 0
  window.cancelAnimationFrame(bookmarkDropCommitFrame)
  bookmarkDropCommitFrame = 0
  resetAutoSearchLayoutSettle()
  setAutoSearchLayoutPending(false)
  removeBookmarkDragGhost()
  removeSpeedDialDragGhost()
  removeFolderDragGhost()
  setActiveBackgroundObjectUrl('')
  clearBackgroundMedia()
  abortNewTabNaturalSearchRequest()
  searchSuggestionCache.clear()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlanCache.clear()
}

function handleBookmarkNavigation(
  event: MouseEvent | ReactMouseEvent<HTMLAnchorElement>,
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  fallbackUrl = ''
): void {
  const bookmarkId = String(bookmark.id || '').trim()
  const currentBookmark = state.allBookmarkMap.get(bookmarkId) || getBookmarkById(bookmarkId) || bookmark
  const url = String(currentBookmark.url || fallbackUrl || '').trim()
  if (!url) {
    return
  }

  if (shouldSuppressNewtabActionClick()) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    void recordBookmarkOpen(currentBookmark)
    return
  }

  event.preventDefault()
  if (state.generalSettings.openBookmarksInNewTab) {
    const opened = window.open(url, '_blank', 'noopener')
    if (opened) {
      opened.opener = null
    }
    void recordBookmarkOpen(currentBookmark)
    return
  }

  void recordBookmarkOpen(currentBookmark)
  window.location.assign(url)
}

function shouldSuppressNewtabActionClick(): boolean {
  return Boolean(
    state.dragSuppressClick ||
    state.speedDialDragSuppressClick ||
    state.folderDragSuppressClick ||
    state.draggingBookmarkId ||
    state.speedDialDraggingBookmarkId ||
    state.draggingFolderId
  )
}

function buildFolderNodeMap(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
  if (!rootNode) {
    return map
  }

  const walk = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    if (!node.url) {
      map.set(String(node.id), node)
      for (const child of node.children || []) {
        if (!child.url) {
          walk(child)
        }
      }
    }
  }

  walk(rootNode)
  return map
}

function buildAllBookmarks(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  return collectPortalBookmarkSourceItems(rootNode) as chrome.bookmarks.BookmarkTreeNode[]
}

function buildNewTabFolderSections(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null,
  settings: NewTabFolderSettings,
  folderData = state.folderData,
  folderNodeMap = state.folderNodeMap
): NewTabFolderSection[] {
  if (!rootNode) {
    return []
  }

  const resolvedFolderData = folderData || getBookmarkCatalog(rootNode).extracted
  const resolvedFolderNodeMap = folderNodeMap.size ? folderNodeMap : buildFolderNodeMap(rootNode)
  const selectedIds = normalizeFolderIds(settings.selectedFolderIds)
  const sections: NewTabFolderSection[] = []
  const seenSectionIds = new Set<string>()

  for (const folderId of selectedIds) {
    const node = resolvedFolderNodeMap.get(folderId) || null
    if (!node || node.url) {
      continue
    }

    for (const displayNode of getDisplayableNewTabSourceFolders(node)) {
      const sectionId = String(displayNode.id || '').trim()
      if (!sectionId || seenSectionIds.has(sectionId)) {
        continue
      }

      const folder = resolvedFolderData.folderMap.get(sectionId)
      sections.push(createFolderSection(displayNode, folder, folderId))
      seenSectionIds.add(sectionId)
    }
  }

  return sections
}

function createFolderSection(
  node: chrome.bookmarks.BookmarkTreeNode,
  folder?: FolderRecord,
  sourceId = String(node.id)
): NewTabFolderSection {
  const title = String(folder?.title || node.title || '未命名文件夹').trim() || '未命名文件夹'
  const counts = getFolderBookmarkCounts(node)
  return {
    id: String(node.id),
    sourceId,
    title,
    path: String(folder?.path || title),
    node,
    bookmarks: getDirectBookmarks(node),
    directBookmarkCount: counts.directBookmarkCount,
    totalBookmarkCount: counts.totalBookmarkCount
  }
}

function getDirectBookmarks(
  folderNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  return (folderNode?.children || []).filter((child) => Boolean(child.url))
}

function getAllSectionBookmarks(): chrome.bookmarks.BookmarkTreeNode[] {
  return state.folderSections.flatMap((section) => section.bookmarks)
}

function refreshDerivedBookmarkState(): void {
  state.folderNode = state.folderSections[0]?.node || null
  state.bookmarks = getAllSectionBookmarks()
  state.bookmarkMap = new Map(state.bookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  state.allBookmarks = buildAllBookmarks(state.rootNode)
  state.allBookmarkMap = new Map(state.allBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
}

function rebuildNewTabSearchIndex(): void {
  const catalog = getBookmarkCatalog()
  if (
    state.searchIndex &&
    lastBuiltSearchIndexCatalogVersion &&
    lastBuiltSearchIndexCatalogVersion === catalog.version
  ) {
    state.searchIndexReady = true
    state.searchIndexReadyPromise = searchIndexReadyPromise
    resolveSearchIndexReady()
    return
  }
  state.searchIndex = buildNewTabSearchIndex({
    bookmarks: catalog.extracted.bookmarks,
    tagIndex: state.bookmarkTagIndex,
    snapshotIndex: state.searchSnapshotIndex
  })
  lastBuiltSearchIndexCatalogVersion = catalog.version
  state.preparedSearchIndex = prepareNewTabSearchIndex(state.searchIndex, state.searchSnapshotSettings?.fullTextSearchEnabled === true)
  schedulePreparedNewTabSearchWarmup(state.preparedSearchIndex)
  searchSuggestionCache.clear()
  naturalSearchSuggestionCache.clear()
  state.searchIndexReady = true
  state.searchIndexReadyPromise = searchIndexReadyPromise
  resolveSearchIndexReady()
  if (getNewtabSearchWidgetNodes().input === document.activeElement) {
    refreshNewTabSearchSuggestionsAfterAiSettingsChange?.()
  }
  perfMark('newtab.searchReady')
  perfMeasure('newtab.searchReadyMs', 'newtab.domContentLoaded', 'newtab.searchReady')
}

function getBookmarkById(bookmarkId: string): chrome.bookmarks.BookmarkTreeNode | null {
  return state.bookmarkMap.get(String(bookmarkId)) || state.allBookmarkMap.get(String(bookmarkId)) || null
}

function getBookmarkFolderPath(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const parentId = String(bookmark.parentId || '')
  return state.folderSections.find((section) => section.id === parentId)?.path ||
    state.folderData?.folderMap.get(parentId)?.path ||
    ''
}

async function recordBookmarkOpen(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
  const bookmarkId = String(bookmark.id || '').trim()
  const url = String(bookmark.url || '').trim()
  if (!bookmarkId || !url) {
    return
  }

  const now = Date.now()
  const previousRecord = state.activity.records[bookmarkId]
  const nextRecord: NewTabActivityRecord = {
    bookmarkId,
    title: String(bookmark.title || '').trim() || url,
    url,
    openCount: Math.min((previousRecord?.openCount || 0) + 1, 9999),
    firstOpenedAt: previousRecord?.firstOpenedAt || now,
    lastOpenedAt: now
  }
  state.activity = normalizeNewTabActivity({
    ...state.activity,
    records: {
      ...state.activity.records,
      [bookmarkId]: nextRecord
    }
  }, state.allBookmarks)

  await saveNewTabActivityRecord(nextRecord).catch((error) => {
    console.warn('新标签页打开记录保存失败。', error)
  })
}

async function removeBookmarkFromActivity(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  const session = newTabControllerGeneration
  const activity = await saveNewTabActivityRemoval(normalizedId)
  if (session === newTabControllerGeneration && newTabControllerStarted) state.activity = activity
}

async function removeBookmarkFromWorkspacePins(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  state.workspaceSettings = await persistNewtabWorkspaceMutation({ type: 'pin', bookmarkId: normalizedId, pinned: false })
}

async function saveNewTabActivityRecord(record: NewTabActivityRecord): Promise<void> {
  const session = newTabControllerGeneration
  const activity = await withNewTabActivityMutation(async transaction => {
    const repository = await loadNewTabActivityRepositoryLazy()
    const latest = await repository.loadNewTabActivityFromRepository(repository.normalizeNewTabActivityRepositoryState, transaction)
    const previous = latest.records[record.bookmarkId]
    return repository.upsertNewTabActivityRecordInRepository(latest, {
      ...record,
      openCount: Math.min((previous?.openCount || 0) + 1, 9999),
      firstOpenedAt: previous?.firstOpenedAt || record.firstOpenedAt,
      lastOpenedAt: Math.max(previous?.lastOpenedAt || 0, record.lastOpenedAt)
    }, repository.normalizeNewTabActivityRepositoryState, transaction)
  })
  if (session === newTabControllerGeneration && newTabControllerStarted) state.activity = normalizeNewTabActivityForCurrentBookmarks(activity)
}

async function saveNewTabActivityRemoval(bookmarkId: string): Promise<NewTabActivityState> {
  return withNewTabActivityMutation(async transaction => {
    const repository = await loadNewTabActivityRepositoryLazy()
    const latest = await repository.loadNewTabActivityFromRepository(repository.normalizeNewTabActivityRepositoryState, transaction)
    const activity = await repository.removeNewTabActivityRecordInRepository(latest, bookmarkId, repository.normalizeNewTabActivityRepositoryState, transaction)
    return normalizeNewTabActivityForCurrentBookmarks(activity)
  })
}

function withNewTabActivityMutation<T>(task: (transaction: LocalStorageTransaction) => Promise<T>): Promise<T> {
  const queued = newTabActivityWriteQueue.then(() => withLocalStorageTransaction(task))
  newTabActivityWriteQueue = queued.then(() => {}, () => {})
  return queued
}

async function loadNewTabActivityRepositoryLazy(): Promise<NewTabActivityRepositoryModule> {
  return import('../shared/repositories/activity-repository.js')
}

function normalizeNewTabActivityForCurrentBookmarks(rawActivity: unknown): NewTabActivityState {
  return normalizeNewTabActivity(rawActivity, state.allBookmarks)
}

async function saveNewTabModuleSettings(): Promise<void> {
  state.moduleSettings = normalizeNewTabModuleSettings(state.moduleSettings)
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabModuleSettings]: state.moduleSettings
  })
}

function normalizeNewTabActivity(
  rawActivity: unknown,
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
): NewTabActivityState {
  const validIds = new Set(bookmarks.map((bookmark) => String(bookmark.id)))
  const source = rawActivity && typeof rawActivity === 'object' && !Array.isArray(rawActivity)
    ? rawActivity as Record<string, unknown>
    : {}
  const pinnedIds = Array.isArray(source.pinnedIds)
    ? uniqueActivityIds(source.pinnedIds, validIds).slice(0, QUICK_ACCESS_ITEM_LIMIT)
    : []
  const rawRecords = source.records && typeof source.records === 'object' && !Array.isArray(source.records)
    ? source.records as Record<string, unknown>
    : {}
  const records: Record<string, NewTabActivityRecord> = {}

  const normalizedRecords = Object.entries(rawRecords)
    .map(([bookmarkId, value]) => normalizeActivityRecord(bookmarkId, value, validIds))
    .filter((record): record is NewTabActivityRecord => Boolean(record))
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, ACTIVITY_RECORD_LIMIT)

  for (const record of normalizedRecords) {
    records[record.bookmarkId] = record
  }

  return { pinnedIds, records }
}

function uniqueActivityIds(values: unknown[], validIds: Set<string>): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const id = String(value || '').trim()
    if (!id || seen.has(id) || !validIds.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function normalizeActivityRecord(
  bookmarkId: string,
  value: unknown,
  validIds: Set<string>
): NewTabActivityRecord | null {
  const id = String(bookmarkId || '').trim()
  if (!id || !validIds.has(id) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  const openCount = Math.max(0, Math.min(Math.floor(Number(source.openCount) || 0), 9999))
  const lastOpenedAt = Number(source.lastOpenedAt) || 0
  if (openCount <= 0 || lastOpenedAt <= 0) {
    return null
  }

  return {
    bookmarkId: id,
    title: String(source.title || '').trim().slice(0, 160),
    url: String(source.url || '').trim().slice(0, 2048),
    openCount,
    firstOpenedAt: Number(source.firstOpenedAt) || lastOpenedAt,
    lastOpenedAt
  }
}

function getActiveMenuBookmark(): chrome.bookmarks.BookmarkTreeNode | null {
  return state.activeMenuBookmarkId ? getBookmarkById(state.activeMenuBookmarkId) : null
}

function isCurrentBookmarkMenuSession(session: number): boolean {
  return session === bookmarkMenuSession && Boolean(state.activeMenuBookmarkId)
}

function renderBookmarkMenu({ focusFirst = true, focusAction = '' } = {}): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    dispatchNewtabBookmarkEditMenuView(null)
    return
  }

  const bookmarkLabel = getBookmarkActionLabelContext(bookmark)
  const pinCopy = getSpeedDialPinActionCopyLocal(isActiveMenuBookmarkPinned())
  const session = bookmarkMenuSession
  dispatchNewtabBookmarkEditMenuView({
    sessionId: session,
    closing: false,
    focusAction,
    focusFirst,
    onExitComplete: finalizeBookmarkMenuClose,
    menu: {
      actions: [
        createMenuActionViewModel('保存更改', 'save', saveBookmarkMenuChanges, {
          actionId: 'save-bookmark',
          ariaLabel: `保存书签更改：${bookmarkLabel}`
        }),
        createMenuActionViewModel(
          pinCopy.label,
          'pin',
          toggleActiveMenuBookmarkPin,
          { actionId: 'toggle-pin', ariaLabel: `${pinCopy.ariaLabel}：${bookmarkLabel}`, separatorBefore: true }
        ),
        {
          ...createMenuActionViewModel('复制链接', 'copy', copyActiveMenuBookmarkUrl, {
            actionId: 'copy-url',
            ariaLabel: `复制书签链接：${bookmarkLabel}`
          }),
          feedback: bookmarkCopyFeedback
        },
        createMenuActionViewModel('刷新图标', 'refresh', refreshActiveMenuIcon, {
          actionId: 'refresh-icon',
          ariaLabel: `刷新书签图标：${bookmarkLabel}`
        }),
        createMenuActionViewModel('在书签管理中定位', 'folder-open', () => {
          closeBookmarkMenu({ animate: false })
          openOptionsHash(buildBookmarkManagerHash({ bookmarkId: bookmark.id }))
        }, {
          actionId: 'locate-bookmark-in-manager',
          ariaLabel: `在全部书签中定位：${bookmarkLabel}`
        }),
        {
          ...createMenuActionViewModel('移动到', 'move', () => {}, {
            actionId: 'move-bookmark',
            ariaLabel: `移动书签：${bookmarkLabel}`,
            disabled: state.menuBusy || bookmark.unmodifiable === 'managed'
          }),
          children: () => buildBookmarkMoveActions(
            state.rootNode?.children || [],
            bookmark.parentId || '',
            folderId => {
              if (isCurrentBookmarkMenuSession(session)) return moveActiveMenuBookmark(folderId)
            }
          )
        },
        createMenuActionViewModel(
          '删除',
          'trash',
          deleteActiveMenuBookmark,
          { actionId: 'delete-bookmark', variant: 'danger', ariaLabel: `删除书签：${bookmarkLabel}`, separatorBefore: true }
        )
      ],
      error: state.menuError,
      fields: [
        createMenuTextFieldViewModel('标题', 'Example', state.editTitle, (value) => {
          state.editTitle = value
        }),
        createMenuTextFieldViewModel('链接', 'https://example.com/', state.editUrl, (value) => {
          state.editUrl = value
        })
      ],
      iconMode: state.editIconMode === 'custom' ? 'custom' : 'website',
      iconModeDisabled: state.menuBusy,
      onCustomIconFileSelect: (file) => {
        if (isCurrentBookmarkMenuSession(session)) return handleCustomIconFileSelect(file)
      },
      onCloseRequest: () => closeBookmarkMenu({ restoreFocus: true }),
      onIconModeChange: handleIconModeChange,
      status: state.menuStatus,
      x: state.menuX,
      y: state.menuY
    }
  })
}

function renderAddBookmarkMenu({ focusFirst = true } = {}): void {
  if (!state.addMenuOpen) {
    dispatchNewtabBookmarkAddMenuView(null)
    return
  }

  dispatchNewtabBookmarkAddMenuView({
    sessionId: addBookmarkMenuSession,
    closing: false,
    focusFirst,
    onExitComplete: finalizeAddBookmarkMenuClose,
    menu: {
      actions: [
        createMenuActionViewModel('添加书签', 'plus', saveAddedBookmark, {
          disabled: state.addMenuBusy
        })
      ],
      error: state.addMenuError,
      expanded: state.addMenuExpanded,
      fields: [
        createMenuTextFieldViewModel('标题', 'Example', state.addTitle, (value) => {
          state.addTitle = value
        }, {
          disabled: state.addMenuBusy,
          onEnter: saveAddedBookmark
        }),
        createMenuTextFieldViewModel('链接', 'https://example.com', state.addUrl, (value) => {
          state.addUrl = value
        }, {
          disabled: state.addMenuBusy,
          onEnter: saveAddedBookmark
        })
      ],
      folderAction: createMenuActionViewModel('创建文件夹', 'folder-plus', saveAddedFolder, {
        actionId: 'create-folder',
        ariaLabel: '创建新文件夹',
        disabled: state.addMenuBusy
      }),
      folderField: createMenuTextFieldViewModel('名称', '输入文件夹名称', state.addFolderTitle, (value) => {
        state.addFolderTitle = value
        state.addMenuError = ''
      }, {
        disabled: state.addMenuBusy,
        onEnter: saveAddedFolder
      }),
      mode: state.addMenuMode,
      onCloseRequest: closeAddBookmarkMenu,
      onExpand: expandAddBookmarkMenu,
      onExpandFolder: expandAddFolderMenu,
      onOpenManager: () => {
        closeAddBookmarkMenu({ animate: false })
        openOptionsHash('#bookmarks')
      },
      x: state.addMenuX,
      y: state.addMenuY
    }
  })
}

function handleIconModeChange(nextMode: 'website' | 'custom'): void {
  if (state.menuBusy) return
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  if (nextMode === 'website') {
    state.editIconMode = 'website'
    state.pendingCustomIconDataUrl = ''
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu({ focusFirst: false })
    return
  }

  renderBookmarkMenu({ focusFirst: false })
}

async function handleCustomIconFileSelect(file: File | null): Promise<void> {
  if (state.menuBusy || !file) return
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  const session = bookmarkMenuSession
  state.menuBusy = true
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu({ focusFirst: false })

  try {
    const dataUrl = await readCustomIconFile(file)
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.editIconMode = 'custom'
    state.pendingCustomIconDataUrl = dataUrl
    renderBookmarkMenu({ focusFirst: false })
  } catch (error) {
    if (!isCurrentBookmarkMenuSession(session)) return
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError =
      error instanceof Error ? error.message : '自定义图片读取失败，请重试。'
    renderBookmarkMenu({ focusFirst: false })
  }
}

function createMenuTextFieldViewModel(
  label: string,
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
  {
    disabled = state.menuBusy,
    onEnter = saveBookmarkMenuChanges
  }: {
    disabled?: boolean
    onEnter?: () => void | Promise<void>
  } = {}
): BookmarkMenuTextFieldViewModel {
  return {
    disabled,
    id: label === '链接' ? 'url' : 'title',
    label,
    onChange(value: string) {
      onInput(value)
    },
    onEnter,
    placeholder,
    type: label === '链接' ? 'url' : 'text',
    value
  }
}

function createMenuActionViewModel(
  label: string,
  icon: MenuActionIcon,
  action: () => void | Promise<void>,
  {
    disabled = state.menuBusy,
    actionId = '',
    variant = '',
    ariaLabel = label,
    separatorBefore = false
  }: {
    disabled?: boolean
    actionId?: string
    variant?: 'danger' | ''
    ariaLabel?: string
    separatorBefore?: boolean
  } = {}
): BookmarkMenuActionViewModel {
  return {
    actionId,
    ariaLabel,
    disabled,
    icon,
    id: actionId || `${icon}:${label}`,
    label,
    separatorBefore,
    onSelect: action,
    variant
  }
}

function normalizeBookmarkInputUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) {
    throw new Error('链接不能为空。')
  }

  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`

  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('unsupported protocol')
    }
    return parsedUrl.href
  } catch {
    throw new Error('请输入有效链接。')
  }
}

function getCustomIconChoice(bookmarkId: string): string | null {
  let iconData: string | null = null
  if (state.editIconMode === 'custom') {
    iconData = state.pendingCustomIconDataUrl || state.customIcons[bookmarkId]
    if (!iconData) {
      throw new Error('请选择自定义图片，或切回网站图标。')
    }
  }
  return iconData
}

async function persistCustomIconChoice(bookmarkId: string, iconData: string | null): Promise<void> {
  const session = newTabControllerGeneration
  await setBookmarkCustomIcon(bookmarkId, iconData)
  if (session !== newTabControllerGeneration || !newTabControllerStarted) return
  if (iconData) state.customIcons = { ...state.customIcons, [bookmarkId]: iconData }
  else {
    const next = { ...state.customIcons }
    delete next[bookmarkId]
    state.customIcons = next
  }
}

function normalizeBackgroundSettings(rawSettings: unknown): typeof DEFAULT_BACKGROUND_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_BACKGROUND_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const type = normalizeNewtabBackgroundType(settings.type)
  return {
    ...normalizeTextureSettings(settings),
    type,
    color: normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    imageName: String(settings.imageName || '').trim(),
    videoName: String(settings.videoName || '').trim(),
    url: String(settings.url || '').trim(),
    ...toWallpaperAdjustmentFields(readWallpaperAdjustments(settings))
  }
}

function syncBackgroundSettingsControls(): void {
  const settings = state.backgroundSettings
  updateBackgroundStartupCacheStatus(settings)
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
}

function createBackgroundSettingsView() {
  return createNewtabBackgroundSettingsView(state.backgroundSettings, {
    ready: backgroundSettingsHydrated,
    backgroundStatus: state.backgroundStatus,
    backgroundStatusTone: state.backgroundStatusTone
  })
}

async function saveBackgroundSettings(): Promise<void> {
  syncInstantWallpaperTargetForSettings(state.backgroundSettings)
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabBackgroundSettings]: state.backgroundSettings
  })
  preloadedBackgroundSettings = state.backgroundSettings
}

async function ensureCurrentBackgroundStartupCache(
  settings = state.backgroundSettings,
  mediaSignature = getBackgroundMediaSignature(settings)
): Promise<void> {
  if (!mediaSignature || isProceduralBackgroundType(settings.type)) {
    return
  }
  if (hasCurrentInstantWallpaperStartupImage(mediaSignature, settings)) {
    updateBackgroundStartupCacheStatus(settings)
    return
  }

  if (settings.type === 'image' || settings.type === 'video') {
    const mediaRecord = await getBackgroundMedia(settings.type).catch(() => null)
    if (mediaRecord?.blob) {
      await updateInstantWallpaperFromBlob(mediaRecord.blob, mediaSignature, settings)
    }
    return
  }

  if (isRemoteBackgroundType(settings.type)) {
    const imageUrl = getRemoteBackgroundImageUrl(settings)
    if (!imageUrl) {
      return
    }
    await ensureBackgroundImageFetchPermission(imageUrl)
    await cacheBackgroundUrlImage(imageUrl, mediaSignature, settings)
  }
}

function scheduleCurrentBackgroundStartupCache(
  settings = state.backgroundSettings,
  { delay = BACKGROUND_STARTUP_CACHE_IDLE_DELAY_MS }: { delay?: number } = {}
): void {
  window.clearTimeout(backgroundStartupCacheTimer)
  backgroundStartupCacheTimer = 0
  const requestId = ++backgroundStartupCacheRequestId
  if (!getBackgroundMediaSignature(settings) || isProceduralBackgroundType(settings.type)) {
    return
  }
  if (hasCurrentInstantWallpaperStartupImage(getBackgroundMediaSignature(settings), settings)) {
    updateBackgroundStartupCacheStatus(settings)
    return
  }

  backgroundStartupCacheTimer = window.setTimeout(() => {
    backgroundStartupCacheTimer = 0
    runIdle(() => {
      if (requestId !== backgroundStartupCacheRequestId) {
        return
      }
      void ensureCurrentBackgroundStartupCache(settings)
    }, { timeout: 6000 })
  }, Math.max(0, delay))
}

function shouldClearBackgroundUrlCache(
  previousSettings: typeof DEFAULT_BACKGROUND_SETTINGS,
  nextSettings: typeof DEFAULT_BACKGROUND_SETTINGS
): boolean {
  void previousSettings
  void nextSettings
  return false
}

function getBackgroundMediaSignature(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  if (settings.type === 'texture') return `texture|${settings.texturePreset}`
  const signatureParts = [
    settings.type,
    normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    settings.imageName,
    settings.videoName,
    normalizeBackgroundImageUrl(settings.url)
  ]
  return signatureParts.join('|')
}

function setBackgroundStatus(
  message: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  state.backgroundStatus = message
  state.backgroundStatusTone = tone
}

/** Fire-and-forget with a visible failure path: background work must never
 * fail silently, or the UI keeps showing the previous state with no reason. */
function runBackgroundTask(task: Promise<unknown>, failureMessage: string): void {
  const session = newTabControllerGeneration
  const version = backgroundMediaMutationVersion
  void task.catch((error) => {
    console.warn(failureMessage, error)
    if (!newTabControllerStarted || session !== newTabControllerGeneration || version !== backgroundMediaMutationVersion) return
    const detail = error instanceof Error && error.message ? `：${error.message}` : ''
    setBackgroundStatus(`${failureMessage}${detail}`, 'error')
    render()
  })
}

function getBackgroundMediaSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/quota|storage|空间|容量/i.test(message)) {
    return '保存失败：浏览器本地存储空间可能不足，请换用更小文件或清理空间后重试。'
  }
  return '保存失败：请确认文件可读取，或换用更小的图片/视频后重试。'
}

function updateBackgroundStartupCacheStatus(settings = state.backgroundSettings): void {
  const mediaKey = getBackgroundMediaSignature(settings)
  const cacheRequired = !isProceduralBackgroundType(settings.type)
  const cacheReady = !cacheRequired || hasCurrentInstantWallpaperStartupImage(mediaKey, settings)

  if (!cacheRequired) {
    state.backgroundUrlCacheStatus = ''
    return
  }

  state.backgroundUrlCacheStatus = cacheReady
    ? '首屏缓存已准备'
    : '首屏缓存准备中...'
}

function hasAppliedBackgroundMedia(settings: typeof DEFAULT_BACKGROUND_SETTINGS): boolean {
  const media = getNewtabBackgroundMediaView()
  if (isProceduralBackgroundType(settings.type)) {
    return true
  }
  if (settings.type === 'video') {
    return media.kind === 'video' && Boolean(media.src)
  }
  if (settings.type === 'image' || settings.type === 'urls') {
    return media.kind === 'image' && Boolean(media.src)
  }
  return true
}

function setWallpaperPlaceholderColor(color = getBackgroundPlaceholderColor(state.backgroundSettings)): void {
  const normalizedColor = normalizeInstantWallpaperColor(color)
  dispatchNewtabInstantWallpaperView({
    backgroundColor: normalizedColor,
    placeholderColor: normalizedColor
  })
}

function getBackgroundPlaceholderColor(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  if (settings.type === 'texture') return TEXTURE_BACKGROUND_COLOR
  const allowDarkColor = settings.type === 'color'
  const color = normalizeInstantWallpaperColor(settings.color || getInstantWallpaperFallbackColor())
  return allowDarkColor ? color : getNonBlackPlaceholderColor(color)
}

function markWallpaperReady(): void {
  dispatchNewtabInstantWallpaperView({
    booting: false,
    loading: false,
    pending: false,
    loaderVisible: false
  })
  recordNewTabBackgroundReady()
}

function markWallpaperPending(): void {
  const instantWallpaper = getNewtabInstantWallpaperView()
  dispatchNewtabInstantWallpaperView({
    loading: true,
    pending: true,
    ready: hasUsableInstantWallpaperPreview(instantWallpaper.previewImage),
    remoteReady: false
  })
}

function markRuntimeWallpaperApplied(): void {
  dispatchNewtabInstantWallpaperView({
    booting: false
  })
}

function hasUsableInstantWallpaperPreview(previewImage: string): boolean {
  const normalizedPreviewImage = String(previewImage || '').trim()
  return Boolean(normalizedPreviewImage && normalizedPreviewImage !== 'none')
}

function markInstantWallpaperRemoteReady(mediaKey = lastAppliedBackgroundMediaSignature): void {
  if (!mediaKey) {
    return
  }
  const instantWallpaper = getNewtabInstantWallpaperView()
  const wallpaperKey = instantWallpaper.signature
  if (wallpaperKey && wallpaperKey !== mediaKey) {
    return
  }
  dispatchNewtabInstantWallpaperView({
    remoteReady: true
  })
}

function getCurrentInstantWallpaper(mediaKey: string): ReturnType<typeof readInstantWallpaper> {
  const instantWallpaper = readInstantWallpaper()
  const wallpaperKey = instantWallpaper?.signature || ''
  return (
    mediaKey &&
    wallpaperKey === mediaKey &&
    instantWallpaper.ready !== false
  ) ? instantWallpaper : null
}

function hasCurrentInstantWallpaperStartupImage(
  mediaKey: string,
  settings = state.backgroundSettings
): boolean {
  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  if (!instantWallpaper) {
    return false
  }
  if (readInstantWallpaperImageDataUrl(instantWallpaper) || readInstantWallpaperDataUrl(instantWallpaper)) {
    return true
  }
  return isRemoteBackgroundType(settings.type) && Boolean(getRemoteBackgroundImageUrl(settings))
}

function getStoredInstantWallpaperDataUrl(mediaKey: string): string {
  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  if (!instantWallpaper) {
    return ''
  }
  // The full-size stored image is preferred; the smaller startup preview is a
  // paint-first fallback for profiles that never produced the larger copy.
  return readInstantWallpaperImageDataUrl(instantWallpaper) ||
    readInstantWallpaperDataUrl(instantWallpaper)
}

function ensureInstantWallpaperFallbackStyles(mediaKey: string): boolean {
  const instantWallpaperView = getNewtabInstantWallpaperView()
  const wallpaperKey = instantWallpaperView.signature
  if (
    instantWallpaperView.remoteReady &&
    wallpaperKey === mediaKey
  ) {
    dispatchNewtabInstantWallpaperView({
      pending: false,
      ready: true
    })
    return true
  }

  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  if (!instantWallpaper) {
    return false
  }
  const imageDataUrl = readInstantWallpaperImageDataUrl(instantWallpaper)
  const dataUrl = imageDataUrl || readInstantWallpaperDataUrl(instantWallpaper)
  if (!dataUrl) {
    return false
  }

  const placeholderColor = normalizeInstantWallpaperColor(
    instantWallpaper.placeholderColor || getBackgroundPlaceholderColor(state.backgroundSettings)
  )
  dispatchNewtabInstantWallpaperView({
    backgroundColor: placeholderColor,
    image: imageDataUrl ? `url("${escapeCssUrl(imageDataUrl)}")` : '',
    pending: false,
    placeholderColor,
    position: instantWallpaper.backgroundPosition || 'center',
    previewImage: `url("${escapeCssUrl(dataUrl)}")`,
    ready: true,
    remoteReady: false,
    signature: mediaKey,
    size: normalizeStoredBackgroundSizeCss(instantWallpaper.backgroundSize)
  })
  return true
}

async function applyBackgroundSettings(): Promise<void> {
  const applyToken = ++backgroundApplyToken
  const settings = state.backgroundSettings
  const mediaKey = getBackgroundMediaSignature(settings)
  const appliedMediaKey = lastAppliedBackgroundMediaSignature
  applyBackgroundDisplayStyles()
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))

  if (
    mediaKey === appliedMediaKey &&
    hasAppliedBackgroundMedia(settings)
  ) {
    if (settings.type === 'video' || getNewtabInstantWallpaperView().remoteReady) {
      markInstantWallpaperRemoteReady(mediaKey)
    }
    markWallpaperReady()
    return
  }

  if (isProceduralBackgroundType(settings.type)) {
    clearBackgroundMedia()
    setActiveBackgroundObjectUrl('')
    markRuntimeWallpaperApplied()
    clearInstantWallpaperIfSignatureChanged('')
    syncInstantWallpaperTargetForSettings(settings, mediaKey)
    setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))
    lastAppliedBackgroundMediaSignature = mediaKey
    markWallpaperReady()
    return
  }

  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))

  if (isRemoteBackgroundType(settings.type)) {
    const imageUrl = getRemoteBackgroundImageUrl(settings)
    if (imageUrl) {
      syncInstantWallpaperTargetForSettings(settings, mediaKey)
      clearBackgroundMedia()
      setActiveBackgroundObjectUrl('')
      const hasInstantWallpaperFallback = ensureInstantWallpaperFallbackStyles(mediaKey)
      const instantPreviewDataUrl = getStoredInstantWallpaperDataUrl(mediaKey)
      if (!hasInstantWallpaperFallback) {
        markWallpaperPending()
      }
      applyDirectRemoteBackgroundImage(imageUrl, mediaKey, {
        previewDataUrl: instantPreviewDataUrl,
        revealWhenReady: !hasInstantWallpaperFallback
      })
      // A stored preview already matches the saved wallpaper, so the shell does
      // not wait for the network copy; the cached copy still replaces it later.
      if (hasInstantWallpaperFallback || instantPreviewDataUrl) {
        markWallpaperReady()
      }
      void applyUrlBackgroundImage(imageUrl, applyToken, mediaKey, settings)
    } else {
      clearBackgroundMedia()
      setActiveBackgroundObjectUrl('')
      markRuntimeWallpaperApplied()
      clearInstantWallpaperIfSignatureChanged('')
      syncInstantWallpaperTargetForSettings(settings, mediaKey)
      lastAppliedBackgroundMediaSignature = mediaKey
      markWallpaperReady()
    }
    return
  }

  if (settings.type !== 'image' && settings.type !== 'video') {
    lastAppliedBackgroundMediaSignature = mediaKey
    markWallpaperReady()
    return
  }

  clearBackgroundMedia()
  setActiveBackgroundObjectUrl('')
  clearInstantWallpaperIfSignatureChanged(mediaKey)
  syncInstantWallpaperTargetForSettings(settings, mediaKey)
  if (ensureInstantWallpaperFallbackStyles(mediaKey)) {
    markWallpaperReady()
  } else {
    markWallpaperPending()
  }

  const mediaType = settings.type
  let mediaRecord: Awaited<ReturnType<typeof getBackgroundMedia>>
  try {
    mediaRecord = await getBackgroundMedia(mediaType)
  } catch {
    if (applyToken === backgroundApplyToken) {
      setBackgroundStatus('背景文件读取失败，请重新选择文件或稍后重试。', 'error')
      syncBackgroundSettingsControls()
      markWallpaperReady()
    }
    return
  }
  if (applyToken !== backgroundApplyToken || !mediaRecord) {
    if (applyToken === backgroundApplyToken) {
      setBackgroundStatus('本地背景文件不存在，请重新选择文件。', 'warning')
      syncBackgroundSettingsControls()
      markWallpaperReady()
    }
    return
  }

  const objectUrl = URL.createObjectURL(mediaRecord.blob)
  setActiveBackgroundObjectUrl(objectUrl)
  if (mediaType === 'image') {
    if (applyToken !== backgroundApplyToken) {
      return
    }
    const readyImage = await waitForBackgroundImageReady(objectUrl, applyToken)
    if (applyToken !== backgroundApplyToken) return
    if (readyImage) {
      setBackgroundImageMedia(objectUrl)
      markRuntimeWallpaperApplied()
      lastAppliedBackgroundMediaSignature = mediaKey
      runBackgroundTask(updateInstantWallpaperFromBlob(mediaRecord.blob, mediaKey), '壁纸更新失败')
    } else {
      setActiveBackgroundObjectUrl('')
      setBackgroundStatus('无法解码这张背景图片，请选择其他图片。', 'error')
      syncBackgroundSettingsControls()
    }
    markWallpaperReady()
    return
  }
  if (applyToken !== backgroundApplyToken) {
    return
  }

  const ready = await waitForBackgroundVideoSourceReady(objectUrl)
  if (applyToken !== backgroundApplyToken) return
  if (ready) {
    setBackgroundVideoMedia(objectUrl, mediaKey)
    markRuntimeWallpaperApplied()
    lastAppliedBackgroundMediaSignature = mediaKey
    runBackgroundTask(updateInstantWallpaperFromBlob(mediaRecord.blob, mediaKey), '壁纸更新失败')
  } else {
    setActiveBackgroundObjectUrl('')
    setBackgroundStatus('无法播放这个背景视频，请选择受支持的视频文件。', 'error')
    syncBackgroundSettingsControls()
  }
  markWallpaperReady()
}

function waitForBackgroundImageReady(
  imageUrl: string,
  applyToken: number,
  timeoutMs = BACKGROUND_IMAGE_READY_TIMEOUT_MS
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timeout = 0

    const settle = (readyImage: HTMLImageElement | null) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      resolve(applyToken === backgroundApplyToken ? readyImage : null)
    }

    timeout = window.setTimeout(() => {
      settle(null)
    }, timeoutMs)
    image.onload = () => {
      settle(image)
    }
    image.onerror = () => {
      settle(null)
    }
    image.src = imageUrl
  })
}

async function applyUrlBackgroundImage(
  imageUrl: string,
  applyToken: number,
  mediaSignature: string,
  settings = state.backgroundSettings
): Promise<void> {
  try {
    if (applyToken !== backgroundApplyToken) {
      return
    }
    const cachedRecord = await getBackgroundUrlCache(imageUrl)

    if (cachedRecord) {
      if (applyToken !== backgroundApplyToken) {
        return
      }
      const ready = await setBackgroundImageFromBlob(cachedRecord.blob, applyToken, {
        preserveCurrentUntilReady: true
      }, mediaSignature)
      if (applyToken !== backgroundApplyToken) return
      if (ready) {
        lastAppliedBackgroundMediaSignature = mediaSignature
        await updateInstantWallpaperFromBlob(cachedRecord.blob, mediaSignature, settings)
      }
      if (applyToken === backgroundApplyToken) markWallpaperReady()
      return
    }

    void cacheBackgroundUrlImage(imageUrl, mediaSignature, settings)
  } catch {
    if (applyToken === backgroundApplyToken) {
      applyDirectRemoteBackgroundImage(imageUrl, mediaSignature)
      markWallpaperReady()
      void cacheBackgroundUrlImage(imageUrl, mediaSignature, settings)
    }
  }
}

function applyDirectRemoteBackgroundImage(
  imageUrl: string,
  mediaKey: string,
  {
    markApplied = true,
    previewDataUrl = '',
    revealWhenReady = false
  }: {
    markApplied?: boolean
    previewDataUrl?: string
    revealWhenReady?: boolean
  } = {}
): void {
  const applyToken = backgroundApplyToken
  clearBackgroundMedia()
  setActiveBackgroundObjectUrl('')
  applyBackgroundDisplayStyles()
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, mediaKey)
  setBackgroundImageMedia(imageUrl)
  if (previewDataUrl) {
    // Paint the cached wallpaper immediately while the network copy decodes;
    // the full-resolution image replaces it in the same layer once ready.
    applyInstantWallpaperPreviewStyles(mediaKey, previewDataUrl)
  }
  markRuntimeWallpaperApplied()
  if (markApplied) {
    lastAppliedBackgroundMediaSignature = mediaKey
    if (revealWhenReady) {
      void waitForBackgroundImageReady(imageUrl, applyToken).then(() => {
        const appliedMediaKey = lastAppliedBackgroundMediaSignature
        if (applyToken !== backgroundApplyToken || mediaKey !== appliedMediaKey) {
          return
        }
        markWallpaperReady()
      })
    }
  }
}

function applyInstantWallpaperPreviewStyles(mediaKey: string, previewDataUrl: string): void {
  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  const imageDataUrl = instantWallpaper ? readInstantWallpaperImageDataUrl(instantWallpaper) : ''
  const placeholderColor = normalizeInstantWallpaperColor(
    instantWallpaper?.placeholderColor || getBackgroundPlaceholderColor(state.backgroundSettings)
  )
  dispatchNewtabInstantWallpaperView({
    backgroundColor: placeholderColor,
    image: imageDataUrl ? `url("${escapeCssUrl(imageDataUrl)}")` : '',
    placeholderColor,
    position: instantWallpaper?.backgroundPosition || 'center',
    previewImage: `url("${escapeCssUrl(previewDataUrl)}")`,
    ready: true,
    size: normalizeStoredBackgroundSizeCss(instantWallpaper?.backgroundSize)
  })
}

async function cacheBackgroundUrlImage(
  imageUrl: string,
  mediaSignature = '',
  settings = state.backgroundSettings,
  options: { applyToCurrentPage?: boolean; applyToken?: number } = {}
): Promise<void> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return
  }

  const applyToken = options.applyToken ?? backgroundApplyToken
  const shouldApplyToCurrentPage = options.applyToCurrentPage === true && Boolean(mediaSignature)
  const cachedRecord = await getBackgroundUrlCache(normalizedUrl)
  if (cachedRecord) {
    if (mediaSignature) {
      await updateInstantWallpaperFromBlob(cachedRecord.blob, mediaSignature, settings)
    }
    if (shouldApplyToCurrentPage) {
      await applyCachedRemoteBackgroundBlobToCurrentPage(cachedRecord.blob, mediaSignature, applyToken)
    }
    state.backgroundUrlCacheStatus = `已缓存 ${formatBytes(cachedRecord.blob.size)}`
    updateBackgroundStartupCacheStatus(settings)
    syncBackgroundSettingsControls()
    return
  }

  const permissionGranted = await ensureBackgroundImageFetchPermission(normalizedUrl)
  if (!permissionGranted) {
    state.backgroundUrlCacheStatus = '未授权该图片域名，首屏缓存可能无法准备。'
    updateBackgroundStartupCacheStatus(settings)
    syncBackgroundSettingsControls()
    return
  }

  let cacheTask = backgroundUrlCacheTaskByUrl.get(normalizedUrl)
  if (!cacheTask) {
    cacheTask = createBackgroundUrlCacheTask(normalizedUrl)
    backgroundUrlCacheTaskByUrl.set(normalizedUrl, cacheTask)
    state.backgroundUrlCachePendingUrls.add(normalizedUrl)
    state.backgroundUrlCacheBusy = state.backgroundUrlCachePendingUrls.size > 0
    state.backgroundUrlCacheStatus = '下载中...'
  }

  try {
    const startupBlob = await cacheTask.startupBlob
    if (mediaSignature) {
      await updateInstantWallpaperFromBlob(startupBlob, mediaSignature, settings)
    }
    if (shouldApplyToCurrentPage) {
      await applyCachedRemoteBackgroundBlobToCurrentPage(startupBlob, mediaSignature, applyToken)
    }

    state.backgroundUrlCacheStatus = mediaSignature ? '首屏缓存已准备' : `已缓存 ${formatBytes(startupBlob.size)}`
    updateBackgroundStartupCacheStatus(settings)
    syncBackgroundSettingsControls()

    const durableBlob = await cacheTask.durableBlob.catch(() => startupBlob)
    if (mediaSignature) {
      await updateInstantWallpaperFromBlob(durableBlob, mediaSignature, settings)
    }
    if (shouldApplyToCurrentPage && durableBlob !== startupBlob) {
      await applyCachedRemoteBackgroundBlobToCurrentPage(durableBlob, mediaSignature, applyToken)
    }
    state.backgroundUrlCacheStatus = `已缓存 ${formatBytes(durableBlob.size)}`
    syncBackgroundSettingsControls()
  } catch (error) {
    state.backgroundUrlCacheStatus = '首屏缓存准备失败'
    syncBackgroundSettingsControls()
    console.warn('新标签页背景首屏缓存准备失败。', error)
  } finally {
    if (backgroundUrlCacheTaskByUrl.get(normalizedUrl) === cacheTask) {
      backgroundUrlCacheTaskByUrl.delete(normalizedUrl)
      state.backgroundUrlCachePendingUrls.delete(normalizedUrl)
      state.backgroundUrlCacheBusy = state.backgroundUrlCachePendingUrls.size > 0
    }
  }
}

function createBackgroundUrlCacheTask(imageUrl: string): BackgroundUrlCacheTask {
  const startupBlob = fetchBackgroundUrlImage(imageUrl)
  const durableBlob = startupBlob.then(async (blob) => {
    try {
      await saveBackgroundUrlCache(imageUrl, blob)
    } catch {
      // The visible wallpaper and instant startup cache are more important than the durable cache.
    }
    return blob
  })
  durableBlob.catch(() => {})

  return {
    startupBlob,
    durableBlob
  }
}

async function applyCachedRemoteBackgroundBlobToCurrentPage(
  blob: Blob,
  mediaKey: string,
  applyToken: number
): Promise<boolean> {
  const currentMediaKey = getBackgroundMediaSignature(state.backgroundSettings)
  if (
    applyToken !== backgroundApplyToken ||
    !mediaKey ||
    mediaKey !== currentMediaKey
  ) {
    return false
  }

  const ready = await setBackgroundImageFromBlob(blob, applyToken, {
    preserveCurrentUntilReady: true
  }, mediaKey)
  const nextMediaKey = getBackgroundMediaSignature(state.backgroundSettings)
  if (
    !ready ||
    applyToken !== backgroundApplyToken ||
    mediaKey !== nextMediaKey
  ) {
    return false
  }

  lastAppliedBackgroundMediaSignature = mediaKey
  markWallpaperReady()
  return true
}

async function ensureBackgroundImageFetchPermission(
  imageUrl: string,
  { request = false }: { request?: boolean } = {}
): Promise<boolean> {
  const originPattern = getBackgroundImageOriginPattern(imageUrl)
  if (!originPattern || !chrome.permissions?.contains) {
    return true
  }
  const query = { origins: [originPattern] }
  if (await containsChromePermissions(query)) {
    return true
  }
  if (!request || !chrome.permissions?.request) {
    return false
  }
  return requestChromePermissions(query)
}

function getBackgroundImageOriginPattern(imageUrl: string): string {
  try {
    const url = new URL(imageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return ''
    }
    return `${url.protocol}//${url.host}/*`
  } catch {
    return ''
  }
}

async function setBackgroundImageFromBlob(
  blob: Blob,
  applyToken = backgroundApplyToken,
  { preserveCurrentUntilReady = false }: { preserveCurrentUntilReady?: boolean } = {},
  mediaSignature = ''
): Promise<boolean> {
  void mediaSignature
  const objectUrl = URL.createObjectURL(blob)
  if (!preserveCurrentUntilReady) {
    setActiveBackgroundObjectUrl(objectUrl)
  }
  const readyImage = await waitForBackgroundImageReady(objectUrl, applyToken)
  const backgroundApplyStillCurrent = applyToken === backgroundApplyToken
  if (!backgroundApplyStillCurrent) {
    if (preserveCurrentUntilReady) {
      URL.revokeObjectURL(objectUrl)
    }
    return false
  }
  if (readyImage) {
    if (preserveCurrentUntilReady) {
      setActiveBackgroundObjectUrl(objectUrl)
    }
    applyBackgroundDisplayStyles()
    setBackgroundImageMedia(objectUrl)
    markRuntimeWallpaperApplied()
  } else {
    if (preserveCurrentUntilReady) {
      URL.revokeObjectURL(objectUrl)
    } else {
      setActiveBackgroundObjectUrl('')
    }
  }
  return Boolean(readyImage)
}

async function updateInstantWallpaperFromBlob(
  blob: Blob,
  mediaSignature: string,
  settings = state.backgroundSettings
): Promise<void> {
  const session = newTabControllerGeneration
  const uploadVersion = backgroundUploadVersion
  const isCurrent = () => newTabControllerStarted && session === newTabControllerGeneration &&
    uploadVersion === backgroundUploadVersion && mediaSignature === getBackgroundMediaSignature(state.backgroundSettings)
  if (!mediaSignature || !isCurrent()) {
    return
  }

  const isVideoWallpaper = settings.type === 'video' || String(blob.type || '').toLowerCase().startsWith('video/')
  const [dataUrl, imageDataUrl] = isVideoWallpaper
    ? ['', await createInstantWallpaperVideoPosterDataUrl(blob, { force: true })]
    : await Promise.all([
        createFirstInstantWallpaperDataUrl(blob),
        createInstantWallpaperImageDataUrl(blob)
      ])
  if (!isCurrent()) return
  settings = state.backgroundSettings
  const displayCss = getBackgroundDisplayCssForSettings(settings)
  const recordBase = {
    signature: mediaSignature,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    placeholderColor: getBackgroundPlaceholderColor(settings),
    updatedAt: Date.now(),
    ready: true
  }
  const previewImageDataUrl = dataUrl || imageDataUrl
  if ((previewImageDataUrl || imageDataUrl) && saveInstantWallpaper({
    ...recordBase,
    dataUrl: previewImageDataUrl || undefined,
    imageDataUrl: imageDataUrl || undefined
  })) {
    syncInstantWallpaperTargetForSettings(settings, mediaSignature)
    updateBackgroundStartupCacheStatus(settings)
    return
  }

  syncInstantWallpaperTargetForSettings(settings, mediaSignature)
  updateBackgroundStartupCacheStatus(settings)
}

async function createFirstInstantWallpaperDataUrl(blob: Blob, attemptIndex = 0): Promise<string | null> {
  const attempt = INSTANT_WALLPAPER_STARTUP_CACHE_ATTEMPTS[attemptIndex]
  if (!attempt) {
    return null
  }
  const dataUrl = await createInstantWallpaperDataUrl(blob, attempt)
  return dataUrl || createFirstInstantWallpaperDataUrl(blob, attemptIndex + 1)
}

function syncInstantWallpaperTargetForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaSignature = getBackgroundMediaSignature(settings)
): void {
  syncTextureBackground(settings)
  saveWallpaperAdjustmentsSnapshot(getEffectiveWallpaperAdjustments(settings))
  const target = buildInstantWallpaperTargetForSettings(settings, mediaSignature)
  if (!target) {
    clearInstantWallpaperTarget()
    clearInstantWallpaperIfSignatureChanged('')
    return
  }

  const existingTarget = readInstantWallpaperTarget()
  saveInstantWallpaperTarget(target)
  const existingTargetKey = existingTarget?.signature
  const nextTargetKey = target.signature
  if (existingTargetKey && existingTargetKey !== nextTargetKey) {
    clearInstantWallpaperFallbackStyles()
  }
  clearInstantWallpaperIfSignatureChanged(nextTargetKey)
}

function buildInstantWallpaperTargetForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaKey = getBackgroundMediaSignature(settings)
): InstantWallpaperTargetRecord | null {
  if (!mediaKey || settings.type === 'texture') {
    return null
  }

  const displayCss = getBackgroundDisplayCssForSettings(settings)
  const instantWallpaper = readInstantWallpaper()
  const existingTarget = readInstantWallpaperTarget()
  const existingTargetKey = existingTarget?.signature
  const existingTargetMatches = existingTargetKey === mediaKey
  const resolvedImageUrl = isRemoteBackgroundType(settings.type) ? getRemoteBackgroundImageUrl(settings) : ''
  const imageUrl = resolvedImageUrl || (existingTargetMatches ? existingTarget.imageUrl : '')
  const imageDataUrlRef = instantWallpaper?.imageDataUrlRef ||
    (existingTargetMatches ? existingTarget.imageDataUrlRef : '') ||
    ''
  const previewUrl = existingTargetMatches ? existingTarget.previewUrl : ''
  return {
    signature: mediaKey,
    imageUrl,
    imageDataUrlRef,
    previewUrl,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    placeholderColor: getBackgroundPlaceholderColor(settings),
    cacheRequired: !isProceduralBackgroundType(settings.type),
    cacheReady: hasCurrentInstantWallpaperStartupImage(mediaKey, settings),
    updatedAt: Date.now()
  }
}

function getBackgroundDisplayCssForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS
): BackgroundDisplayCss {
  void settings
  return {
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
}

function normalizeStoredBackgroundSizeCss(value: unknown): string {
  const backgroundSize = String(value || '').trim()
  return /^\d+(?:\.\d+)?%\s+auto$/i.test(backgroundSize)
    ? 'cover'
    : backgroundSize || 'cover'
}

function clearInstantWallpaperIfSignatureChanged(mediaKey: string): void {
  const instantWallpaper = readInstantWallpaper()
  const instantWallpaperKey = instantWallpaper?.signature
  if (instantWallpaper && instantWallpaperKey !== mediaKey) {
    clearInstantWallpaper()
    clearInstantWallpaperFallbackStyles()
  }
}

function clearInstantWallpaperFallbackStyles(): void {
  dispatchNewtabInstantWallpaperView({
    image: '',
    pending: false,
    position: 'center',
    previewImage: '',
    ready: false,
    remoteReady: false,
    signature: '',
    size: 'cover'
  })
}

function getNonBlackPlaceholderColor(value: unknown): string {
  const color = normalizeInstantWallpaperColor(value)
  const parsed = parseHexColor(color)
  if (!parsed) {
    return getInstantWallpaperFallbackColor()
  }
  const luminance = (0.2126 * parsed.red + 0.7152 * parsed.green + 0.0722 * parsed.blue) / 255
  return luminance < 0.035 ? getInstantWallpaperFallbackColor() : color
}

function parseHexColor(value: string): { red: number; green: number; blue: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) {
    return null
  }
  const raw = match[1]
  return {
    red: Number.parseInt(raw.slice(0, 2), 16),
    green: Number.parseInt(raw.slice(2, 4), 16),
    blue: Number.parseInt(raw.slice(4, 6), 16)
  }
}

function clearBackgroundMedia(): void {
  dispatchNewtabBackgroundMediaView({ kind: 'none', poster: '', src: '' })
}

function setBackgroundImageMedia(src: string): void {
  const displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
  dispatchNewtabBackgroundMediaView({
    backgroundPosition: displayCss.backgroundPosition,
    backgroundSize: displayCss.backgroundSize,
    kind: 'image',
    poster: '',
    src
  })
}

function setBackgroundVideoMedia(src: string, mediaKey: string): void {
  dispatchNewtabBackgroundMediaView({
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    kind: 'video',
    poster: getInstantWallpaperPosterUrl(mediaKey),
    src
  })
}

function getInstantWallpaperPosterUrl(mediaKey: string): string {
  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  if (!instantWallpaper) {
    return ''
  }
  return readInstantWallpaperImageDataUrl(instantWallpaper) || readInstantWallpaperDataUrl(instantWallpaper)
}

function setActiveBackgroundObjectUrl(nextUrl: string): void {
  if (activeBackgroundObjectUrl && activeBackgroundObjectUrl !== nextUrl) {
    URL.revokeObjectURL(activeBackgroundObjectUrl)
  }
  activeBackgroundObjectUrl = nextUrl
}

function normalizeBackgroundImageUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) {
    return ''
  }

  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ''
    }
    return parsedUrl.href
  } catch {
    return ''
  }
}

function isRemoteBackgroundType(type: unknown): boolean {
  return type === 'urls'
}

function getRemoteBackgroundImageUrl(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  if (settings.type === 'urls') {
    return normalizeBackgroundImageUrl(settings.url)
  }

  return ''
}

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

function openBackgroundMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKGROUND_MEDIA_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BACKGROUND_MEDIA_STORE)) {
        db.createObjectStore(BACKGROUND_MEDIA_STORE)
      }
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error || new Error('背景媒体数据库打开失败。'))
    }
  })
}

async function saveBackgroundMedia(mediaType: 'image' | 'video', file: File): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      transaction.objectStore(BACKGROUND_MEDIA_STORE).put({
        blob: file,
        name: file.name,
        type: file.type,
        updatedAt: Date.now()
      }, mediaType)
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景媒体保存失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景媒体保存失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function getBackgroundMedia(mediaType: 'image' | 'video'): Promise<{
  blob: Blob
  name: string
  type: string
  updatedAt: number
} | null> {
  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const request = transaction.objectStore(BACKGROUND_MEDIA_STORE).get(mediaType)
      request.onsuccess = () => {
        const record = request.result as {
          blob?: unknown
          name?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined
        if (!record?.blob || !(record.blob instanceof Blob)) {
          resolve(null)
          return
        }
        resolve({
          blob: record.blob,
          name: String(record.name || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        })
      }
      request.onerror = () => {
        reject(request.error || new Error('背景媒体读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function getBackgroundUrlCache(imageUrl: string): Promise<{
  blob: Blob
  url: string
  type: string
  updatedAt: number
} | null> {
  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const request = store.get(getBackgroundUrlCacheKey(imageUrl))
      const resolveCacheRecord = (record: {
        blob?: unknown
        url?: unknown
        type?: unknown
        updatedAt?: unknown
      } | undefined) => {
        if (
          !record?.blob ||
          !(record.blob instanceof Blob) ||
          String(record.url || '') !== imageUrl
        ) {
          return null
        }
        return {
          blob: record.blob,
          url: String(record.url || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        }
      }
      request.onsuccess = () => {
        const cached = resolveCacheRecord(request.result as {
          blob?: unknown
          url?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined)
        if (cached) {
          resolve(cached)
          return
        }

        const legacyRequest = store.get(BACKGROUND_URL_CACHE_KEY)
        legacyRequest.onsuccess = () => {
          resolve(resolveCacheRecord(legacyRequest.result as {
            blob?: unknown
            url?: unknown
            type?: unknown
            updatedAt?: unknown
          } | undefined))
        }
        legacyRequest.onerror = () => {
          resolve(null)
        }
      }
      request.onerror = () => {
        reject(request.error || new Error('背景 URL 缓存读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function saveBackgroundUrlCache(imageUrl: string, blob: Blob): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      transaction.objectStore(BACKGROUND_MEDIA_STORE).put({
        blob,
        url: imageUrl,
        type: blob.type,
        updatedAt: Date.now()
      }, getBackgroundUrlCacheKey(imageUrl))
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景 URL 缓存保存失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景 URL 缓存保存失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function clearBackgroundUrlCache(): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const key = getBackgroundUrlCacheKey()
      if (key) {
        store.delete(key)
      } else {
        store.delete(BACKGROUND_URL_CACHE_KEY)
      }
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景 URL 缓存清除失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景 URL 缓存清除失败。'))
      }
    })
  } finally {
    db.close()
  }
}

function getBackgroundUrlCacheKey(imageUrl = normalizeBackgroundImageUrl(state.backgroundSettings.url)): string {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  return `${BACKGROUND_URL_CACHE_KEY_PREFIX}${normalizedUrl}`
}

async function fetchBackgroundUrlImage(
  imageUrl: string,
  { maxBytes = BACKGROUND_URL_FULL_MAX_BYTES }: { maxBytes?: number } = {}
): Promise<Blob> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => {
    controller.abort()
  }, BACKGROUND_URL_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(imageUrl, {
      cache: 'force-cache',
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`图片请求失败：${response.status}`)
    }

    const declaredSize = validateBackgroundContentLength(
      response.headers.get('content-length'),
      maxBytes
    )
    if (!declaredSize.allowed) {
      throw new Error(declaredSize.message)
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || blob.type
    if (!blob.size || !isBackgroundImageResponse(contentType, imageUrl)) {
      throw new Error('链接返回的内容不是图片。')
    }

    const finalSize = validateBackgroundBlobSize(blob.size, maxBytes)
    if (!finalSize.allowed) {
      throw new Error(finalSize.message)
    }

    const optimizedBlob = await createOptimizedBackgroundImageBlob(blob)
    const optimizedSize = validateBackgroundBlobSize(optimizedBlob.size, BACKGROUND_URL_PREVIEW_MAX_BYTES)
    if (!optimizedSize.allowed) {
      throw new Error(optimizedSize.message)
    }
    return optimizedBlob
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('远程图片下载超时。')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function isBackgroundImageResponse(contentType: unknown, imageUrl: string): boolean {
  const normalizedType = String(contentType || '').toLowerCase()
  if (normalizedType.includes('image/svg+xml') || /\.svg(?:$|[?#])/i.test(imageUrl)) {
    return false
  }
  if (normalizedType.startsWith('image/')) {
    return true
  }

  return isKnownImageUrlWithoutContentType(imageUrl)
}

function isKnownImageUrlWithoutContentType(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    if (url.hostname === 'ids.si.edu' && /^\/ids\/(?:deliveryService|download)$/i.test(url.pathname)) {
      return true
    }
    return /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(url.pathname)
  } catch {
    return false
  }
}

function normalizeSearchSettings(rawSettings: unknown): typeof DEFAULT_SEARCH_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_SEARCH_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const placeholder = Object.prototype.hasOwnProperty.call(settings, 'placeholder')
    ? String(settings.placeholder ?? '').trim()
    : DEFAULT_SEARCH_SETTINGS.placeholder
  return {
    enabled: settings.enabled !== false,
    webSearchEnabled: settings.webSearchEnabled !== false,
    openInNewTab: settings.openInNewTab === true,
    placeholder,
    naturalSearchEnabled: settings.naturalSearchEnabled === true,
    naturalSearchAiConfigured: settings.naturalSearchAiConfigured === true,
    autoVerticalCenter: settings.autoVerticalCenter === true,
    width: clampNumber(settings.width, SEARCH_WIDTH_MIN_VW, SEARCH_WIDTH_MAX_VW, DEFAULT_SEARCH_SETTINGS.width),
    height: normalizeSearchHeight(settings.height),
    offsetY: clampNumber(
      settings.offsetY,
      SEARCH_OFFSET_ABSOLUTE_MIN,
      SEARCH_OFFSET_ABSOLUTE_MAX,
      DEFAULT_SEARCH_SETTINGS.offsetY
    ),
    background: clampNumber(settings.background, 0, 92, DEFAULT_SEARCH_SETTINGS.background)
  }
}

function getSearchPlaceholder(settings: typeof DEFAULT_SEARCH_SETTINGS): string {
  const placeholder = String(settings.placeholder ?? '').trim()
  return !settings.webSearchEnabled && placeholder === DEFAULT_SEARCH_SETTINGS.placeholder
    ? '搜索书签，或输入 / 执行命令'
    : placeholder
}

function syncSearchSettingsControls(): void {
  const settings = state.searchSettings
  const widthBounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  const offsetBounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  dispatchNewtabSearchSettingsView(createNewtabSearchSettingsView(settings, {
    offset: offsetBounds,
    width: widthBounds
  }))
  syncSearchWidthControl()
  syncSearchOffsetControl()
}

function syncSearchWidthControl(): void {
  const bounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  dispatchNewtabSearchSettingsView(createNewtabSearchSettingsView(state.searchSettings, {
    offset: state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK,
    width: bounds
  }))
}

function syncSearchOffsetControl(): void {
  const bounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  dispatchNewtabSearchSettingsView(createNewtabSearchSettingsView(state.searchSettings, {
    offset: bounds,
    width: state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  }))
}

async function saveSearchSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabSearchSettings]: state.searchSettings
  })
}

function scheduleSearchSettingsSave(): void {
  settingsPersistence.stage({ [STORAGE_KEYS.newTabSearchSettings]: state.searchSettings })
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = window.setTimeout(() => {
    searchSettingsSaveTimer = 0
    void saveSearchSettings().catch((error) => {
      console.warn('新标签页搜索设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function flushSearchSettingsSave(): void {
  if (!searchSettingsSaveTimer) {
    return
  }
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = 0
  void saveSearchSettings().catch((error) => {
    console.warn('新标签页搜索设置保存失败。', error)
  })
}

function normalizeGeneralSettings(rawSettings: unknown): typeof DEFAULT_GENERAL_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_GENERAL_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const legacyQuickAccess = settings.showFrequentBookmarks !== false || settings.showRecentBookmarks !== false
  return {
    hideSettingsTrigger: settings.hideSettingsTrigger === true,
    showQuickAccess: typeof settings.showQuickAccess === 'boolean'
      ? settings.showQuickAccess
      : legacyQuickAccess,
    // Off for new users. A stored record predates that default, so a missing
    // field keeps the earlier on state; an explicit choice always wins.
    showSourceNavigation: settings.showSourceNavigation !== false,
    openBookmarksInNewTab: settings.openBookmarksInNewTab === true
  }
}

function syncGeneralSettingsControls(): void {
  dispatchNewtabFolderSourceView(createFolderSourceView())
}

async function saveGeneralSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabGeneralSettings]: state.generalSettings
  })
}

function applyGeneralSettings(): void {
  dispatchNewtabFolderSourceView(createFolderSourceView())
}

function syncFolderSettingsControls(): void {
  measureNow('newtab.syncFolderSettingsControls', () => {
    dispatchNewtabFolderSourceView(createFolderSourceView())
  })
}

function syncNewTabModernSettingsControls(): void {
  syncModuleSettingsControls()
}

function syncModuleSettingsControls(): void {
  const rows = buildNewTabModuleSettingRows(state.moduleSettings)
  dispatchNewtabModuleSettingsView({
    rows: rows.map((setting) => createModuleSettingRowViewModel(setting))
  })
}

function createModuleSettingRowViewModel(
  setting: ReturnType<typeof buildNewTabModuleSettingRows>[number]
): NewtabModuleSettingRowView {
  return {
    description: setting.description,
    enabled: setting.enabled,
    key: setting.key,
    label: setting.label
  }
}

function handleModuleSettingToggle(key: NewTabModuleSettingKey, enabled: boolean): void {
  if (!key || !(key in state.moduleSettings)) {
    return
  }

  state.moduleSettings = normalizeNewTabModuleSettings({
    ...state.moduleSettings,
    [key]: enabled
  })
  void saveNewTabModuleSettings().catch((error) => {
    console.warn('新标签页模块设置保存失败。', error)
  })
  syncNewTabModernSettingsControls()
  scheduleRender()
}

function createFolderSourceView() {
  return {
    candidateQuery: state.folderCandidateQuery,
    candidates: createFolderCandidateControlsState(),
    candidatesExpanded: state.folderCandidatesExpanded,
    general: {
      hideSettingsTrigger: state.generalSettings.hideSettingsTrigger,
      openBookmarksInNewTab: state.generalSettings.openBookmarksInNewTab,
      showQuickAccess: state.generalSettings.showQuickAccess,
      showSourceNavigation: state.generalSettings.showSourceNavigation
    },
    hideFolderNames: state.folderSettings.hideFolderNames,
    browseMode: state.folderSettings.browseMode,
    selected: createSelectedFolderControlsState(),
    selectedCount: state.folderSettings.selectedFolderIds.length
  }
}

function createSelectedFolderControlsState(): NewtabSelectedFolderSourceState {
  const selectedIds = state.folderSettings.selectedFolderIds
  if (!selectedIds.length) {
    return {
      type: 'empty',
      message: '未选择来源文件夹。选择来源只会决定新标签页显示哪些书签，不会移动、删除或重排原有书签。'
    }
  }

  const folders = getFolderCandidateMap()
  const items: NewtabSelectedFolderSourceItemView[] = selectedIds.map((folderId) => {
    const folder = folders.get(folderId)
    return {
      affectedCount: folder?.totalBookmarkCount || 0,
      folderId,
      path: folder?.path || folderId,
      stats: folder ? formatFolderCandidateCountSummary(folder) : '来源不可用',
      title: folder?.title || '已删除的文件夹'
    }
  })
  return { type: 'items', items }
}

function createFolderCandidateControlsState(): NewtabFolderCandidateState {
  const candidates = getFilteredFolderCandidates()
  if (!candidates.length) {
    return {
      type: 'empty',
      message: '没有匹配的文件夹。请清空搜索词，或选择其他来源文件夹。'
    }
  }

  const selectedIds = new Set(state.folderSettings.selectedFolderIds)
  const activeId = resolveFolderCandidateActiveId(candidates)
  const items: NewtabFolderCandidateItemView[] = candidates.map((folder) => {
    const selected = selectedIds.has(folder.id)
    return {
      active: folder.id === activeId,
      badge: selected ? '已选' : String(folder.totalBookmarkCount),
      folderId: folder.id,
      path: folder.path,
      selected,
      stats: formatFolderCandidateCountSummary(folder),
      title: folder.title || '未命名文件夹'
    }
  })
  return { type: 'items', items }
}

function getFilteredFolderCandidates(): NewTabFolderCandidate[] {
  const query = normalizeSettingSearchText(state.folderCandidateQuery)
  return getFolderCandidatesForCurrentRender().filter((folder) => {
    if (!query) {
      return true
    }

    return folder.normalizedTitle.includes(query) || folder.normalizedPath.includes(query)
  })
}

function getFolderCandidatesForCurrentRender(): NewTabFolderCandidate[] {
  const cacheKey = buildFolderCandidateRenderKey({
    rootNode: state.rootNode,
    folderData: state.folderData,
    folderNodeMap: state.folderNodeMap,
    folderCandidateQuery: state.folderCandidateQuery,
    selectedFolderIds: state.folderSettings.selectedFolderIds,
    folderCandidatesExpanded: state.folderCandidatesExpanded
  })
  return getCachedFolderCandidates(state.folderCandidateCache, cacheKey, getFolderCandidates)
}

function getFolderCandidates(): NewTabFolderCandidate[] {
  if (!state.rootNode) {
    return []
  }

  const folderData = state.folderData || getBookmarkCatalog().extracted
  const folderNodeMap = state.folderNodeMap.size ? state.folderNodeMap : buildFolderNodeMap(state.rootNode)
  return folderData.folders.map((folder) => {
    const counts = getFolderBookmarkCounts(folderNodeMap.get(folder.id) || null)
    return {
      id: folder.id,
      title: folder.title,
      path: folder.path,
      normalizedTitle: folder.normalizedTitle,
      normalizedPath: folder.normalizedPath,
      directBookmarkCount: counts.directBookmarkCount,
      totalBookmarkCount: counts.totalBookmarkCount
    }
  })
}

function getFolderCandidateMap(): Map<string, NewTabFolderCandidate> {
  return new Map(getFolderCandidatesForCurrentRender().map((folder) => [folder.id, folder]))
}

function formatFolderCandidateCountSummary(folder: NewTabFolderCandidate): string {
  if (folder.directBookmarkCount === folder.totalBookmarkCount) {
    return `${folder.totalBookmarkCount} 个书签`
  }
  return `直属 ${folder.directBookmarkCount} / 合计 ${folder.totalBookmarkCount}`
}

function normalizeSettingSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function saveFolderSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabFolderSettings]: state.folderSettings
  })
}

function setFolderReorderStatus(message: string, tone: 'success' | 'error'): void {
  window.clearTimeout(folderReorderStatusTimer)
  state.folderReorderStatus = message
  state.folderReorderStatusTone = tone
  render()

  folderReorderStatusTimer = window.setTimeout(() => {
    clearFolderReorderStatus()
    render()
  }, tone === 'success' ? 1800 : 4200)
}

function clearFolderReorderStatus(): void {
  window.clearTimeout(folderReorderStatusTimer)
  folderReorderStatusTimer = 0
  state.folderReorderStatus = ''
  state.folderReorderStatusTone = 'success'
}

function applyFolderSettings(): void {
  dispatchNewtabFolderSourceView(createFolderSourceView())
}

function syncIconSettingsControls(): void {
  measureNow('newtab.syncIconSettingsControls', () => {
    renderIconPreviewIfNeeded()
  })
}

async function saveIconSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabIconSettings]: state.iconSettings
  })
}

function scheduleIconSettingsSave(): void {
  settingsPersistence.stage({ [STORAGE_KEYS.newTabIconSettings]: state.iconSettings })
  window.clearTimeout(iconSettingsSaveTimer)
  iconSettingsSaveTimer = window.setTimeout(() => {
    iconSettingsSaveTimer = 0
    void saveIconSettings().catch((error) => {
      console.warn('新标签页图标设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function commitIconSettings(nextSettings: IconSettings): void {
  state.iconSettings = withDetectedIconPreset(nextSettings)
  scheduleIconSettingsSave()
  applyIconSettingsLive()
  syncIconSettingsControls()
}

function applyIconSettingsLive(): void {
  const contentStyle = createBookmarkContentStyleState()
  const bookmarkView = getNewtabBookmarkContentView()
  if (!bookmarkView) {
    // The empty/loading page has no bookmark geometry to update. Rebuilding
    // its search module here makes every layout click repaint the shell.
    return
  }

  patchNewtabBookmarkContentView((view) => ({
    ...view,
    content: contentStyle
  }))
  patchNewtabContentView((view) => {
    if (view.type !== 'page' || view.iconVerticalCenter === String(state.iconSettings.verticalCenter)) {
      return view
    }
    return {
      ...view,
      iconVerticalCenter: String(state.iconSettings.verticalCenter),
      modules: view.modules.map((module) =>
        module.kind === 'bookmarks'
          ? { ...module, iconVerticalCenter: state.iconSettings.verticalCenter }
          : module
      )
    }
  })
  scheduleAdaptiveNewTabLayoutUpdate()
}

function withDetectedIconPreset(settings: IconSettings): IconSettings {
  const { preset: _preset, ...presetValues } = settings
  return {
    ...settings,
    preset: detectPresetFromValues(presetValues)
  }
}

function applyIconPreset(presetKey: IconLayoutPresetKey): void {
  state.iconSettings = applyIconLayoutPreset(state.iconSettings, presetKey)
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标预设保存失败。', error)
  })
  applyIconSettingsLive()
  syncIconSettingsControls()
}

function resetIconSettingsToDefaults(): void {
  state.iconSettings = normalizeIconSettings(DEFAULT_ICON_SETTINGS)
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标默认布局保存失败。', error)
  })
  applyIconSettingsLive()
  syncIconSettingsControls()
}

async function saveSettingsWithFeedback(values: Record<string, unknown>): Promise<void> {
  try {
    await settingsPersistence.save(values)
    // A successful write only resolves its own keys, not another section's failure.
    if (!settingsPersistence.hasPending()) clearSettingsSaveStatus()
  } catch (error) {
    if (settingsPersistence.hasPending()) {
      setSettingsSaveStatus('error', '保存失败，已保留本次调整；再次修改或打开新标签页时会重试。')
    }
    throw error
  }
}

function clearSettingsSaveStatus(): void {
  window.clearTimeout(settingsSaveStatusTimer)
  state.settingsSaveState = 'idle'
  state.settingsSaveMessage = ''
  syncSettingsSaveStatus()
}

function setSettingsSaveStatus(nextState: SettingsSaveState, message: string): void {
  window.clearTimeout(settingsSaveStatusTimer)
  state.settingsSaveState = nextState
  state.settingsSaveMessage = message
  syncSettingsSaveStatus()

  if (nextState === 'saved') {
    settingsSaveStatusTimer = window.setTimeout(() => {
      state.settingsSaveState = 'idle'
      state.settingsSaveMessage = ''
      syncSettingsSaveStatus()
    }, 1800)
  }
}

function syncSettingsSaveStatus(): void {
  dispatchNewtabSettingsDrawerSaveStatus(state.settingsSaveState, state.settingsSaveMessage)
}

function renderIconPreviewIfNeeded(): void {
  const previewKey = getIconPreviewSignature(state.iconSettings)
  if (lastIconPreviewKey === previewKey) {
    return
  }

  lastIconPreviewKey = previewKey
  renderIconPreview()
}

function renderIconPreview(): void {
  dispatchIconPreviewViewForSettings(state.iconSettings)
}

function applyBackgroundDisplayStyles(): void {
  const displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
  dispatchNewtabInstantWallpaperView({
    backgroundColor: getBackgroundPlaceholderColor(state.backgroundSettings),
    placeholderColor: getBackgroundPlaceholderColor(state.backgroundSettings),
    position: displayCss.backgroundPosition,
    size: displayCss.backgroundSize
  })
  dispatchNewtabBackgroundMediaView({
    backgroundPosition: displayCss.backgroundPosition,
    backgroundSize: displayCss.backgroundSize
  })
  updateInstantWallpaperDisplayCss(lastAppliedBackgroundMediaSignature, displayCss)
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, lastAppliedBackgroundMediaSignature || undefined)
}

function updateInstantWallpaperDisplayCss(
  mediaKey: string,
  displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
): void {
  if (!mediaKey) {
    return
  }
  const instantWallpaper = readInstantWallpaper()
  const instantWallpaperKey = instantWallpaper?.signature
  if (!instantWallpaper || instantWallpaperKey !== mediaKey) {
    return
  }
  saveInstantWallpaper({
    ...instantWallpaper,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    updatedAt: Date.now()
  })
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, mediaKey)
}

function containsChromePermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains(query, (granted) => {
      if (chrome.runtime.lastError) {
        resolve(false)
        return
      }
      resolve(Boolean(granted))
    })
  })
}

function requestChromePermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request(query, (granted) => {
      if (chrome.runtime.lastError) {
        resolve(false)
        return
      }
      resolve(Boolean(granted))
    })
  })
}

async function submitSearch(value: string, forceNewTab = false): Promise<void> {
  const query = String(value || '').trim()
  if (!query) {
    return
  }

  const directUrl = getDirectNavigationUrl(query)
  if (directUrl) {
    openSearchTarget(directUrl, forceNewTab)
    return
  }

  if (state.searchSettings.webSearchEnabled === false) {
    return
  }

  await searchWithBrowserDefault(query, forceNewTab || state.searchSettings.openInNewTab)
}

function getDirectNavigationUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl || /\s/.test(rawUrl)) {
    return ''
  }

  const hasScheme = /^[a-z][a-z\d+\-.]*:\/\//i.test(rawUrl)
  const looksLikeDomain =
    rawUrl.includes('.') ||
    /^localhost(?::\d+)?(?:\/|$)/i.test(rawUrl) ||
    /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(rawUrl)
  if (!hasScheme && !looksLikeDomain) {
    return ''
  }

  const candidate = hasScheme ? rawUrl : `https://${rawUrl}`
  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ''
    }
    return parsedUrl.href
  } catch {
    return ''
  }
}

function openSearchTarget(targetUrl: string, forceNewTab = false): void {
  if (!targetUrl) return
  if (forceNewTab || state.searchSettings.openInNewTab) {
    const opened = window.open(targetUrl, '_blank', 'noopener')
    if (opened) {
      opened.opener = null
    }
    return
  }

  window.location.assign(targetUrl)
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const color = String(value || '').trim()
  if (/^#[\da-f]{6}$/i.test(color)) {
    return color.toLowerCase()
  }
  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map((char) => `${char}${char}`).join('')}`.toLowerCase()
  }
  return fallback
}

function getFaviconUrl(url: string, bookmarkId = ''): string {
  const activeSource = getActiveFaviconSource(url)
  if (activeSource) {
    return activeSource
  }
  const refreshToken = bookmarkId ? state.faviconRefreshTokens.get(bookmarkId) : 0
  return buildChromeFaviconUrl(
    chrome.runtime.getURL('/_favicon/'),
    url,
    {
      size: FAVICON_SIZE,
      cacheToken: refreshToken
    }
  )
}

function getFallbackLabel(title: string): string {
  const trimmed = title.trim()
  return (trimmed[0] || '*').toUpperCase()
}

function formatNewTabLocalDate(value: unknown): string {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


