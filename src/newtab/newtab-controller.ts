import { useEffect, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import {
  BOOKMARKS_BAR_ID,
  NEWTAB_DASHBOARD_OPEN_MESSAGE_TYPE,
  NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE,
  NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE,
  STORAGE_KEYS
} from '../shared/constants.js'
import {
  findBookmarksBar
} from '../shared/bookmark-tree.js'
import { buildBookmarkCatalogSnapshot, type BookmarkCatalogSnapshot } from '../shared/bookmark-catalog.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'
import { isBookmarkMenuInteractionTarget } from './bookmark-menu-interactions.js'
import {
  getSettingsGroupControlSyncActions,
  normalizeSettingsDrawerSection,
  type SettingsDrawerSection
} from './settings-group-sync.js'
import type { BookmarkRecord, ExtractedBookmarkData, FolderRecord } from '../shared/types.js'
import {
  buildFolderCandidateRenderSignature,
  getCachedFolderCandidates,
  type FolderCandidateCacheState,
  type NewTabFolderCandidate
} from './folder-candidate-cache.js'
import {
  deleteSavedSearch,
  getSavedSearchesForScope,
  loadSavedSearchIndex,
  parseSearchQuery,
  saveSearch,
  type SavedSearchIndex
} from '../shared/search-query.js'
import type { NaturalSearchPlan } from '../popup/natural-search.js'
import type {
  BookmarkTagExtraction,
  BookmarkTagIndex,
  BookmarkTagRecord,
  BookmarkTagSource
} from '../shared/bookmark-tags.js'
import type { ContentSnapshotIndex } from '../shared/content-snapshots.js'
import {
  DEFAULT_ICON_SETTINGS,
  ICON_LAYOUT_PRESETS,
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
  getIconPreviewSignature,
  renderIconPreviewElement
} from './icon-preview.js'
import {
  buildNewTabSearchIndex,
  buildNewTabSourceNavigationItems,
  createMissingFolderView,
  createNewTabPage,
  createStateView,
  collectPortalBookmarkSourceItems,
  createLoadingStateView,
  getPortalQuickAccessItems,
  getNaturalSearchBookmarkSuggestionsFromIndex,
  getNewTabSourceAnchorId,
  getAutoCenteredSearchOffsetY,
  getPopupSearchBookmarkSuggestionsFromIndex,
  prepareNewTabSearchIndex,
  getAdaptiveSearchOffsetBounds,
  getAdaptiveSearchWidthBounds,
  getVerticalCenterCollisionOffset,
  normalizeNewTabSearchText,
  type AdaptiveSearchOffsetBounds,
  type NewTabContentState,
  type NewTabContentView,
  type NewTabElementModule,
  type PortalQuickAccessItem,
  resolveNewTabContentState,
  type NewTabPageModule,
  type NewTabSearchIndexEntry,
  type NewTabPreparedSearchIndex,
  type SearchBookmarkSuggestion
} from './content-state.js'
import {
  DEFAULT_FOLDER_SETTINGS,
  DEFAULT_NEW_TAB_FOLDER_TITLE,
  type NewTabFolderSettings,
  findNewTabFolder,
  getDisplayableNewTabSourceFolders,
  getFolderBookmarkCounts,
  normalizeFolderIds,
  normalizeFolderSettings,
  normalizeFolderSettingsWithDefault
} from './folder-settings.js'
import {
  buildChromeFaviconUrl,
  formatFaviconAccentCssRgb,
  getFaviconAccentCacheEntry,
  normalizeFaviconAccentCache,
  removeFaviconAccentCacheEntry,
  type FaviconAccentCache,
  type FaviconAccentColor
} from './favicon-cache.js'
import {
  BACKGROUND_URL_FETCH_TIMEOUT_MS,
  BACKGROUND_URL_FULL_MAX_BYTES,
  BACKGROUND_URL_PREVIEW_MAX_BYTES,
  applyBookmarkMoveOperationsToChildren,
  buildBookmarkOrderAfterInsert,
  buildMinimalBookmarkMoveOperations,
  resolveRestorableBookmarkParentId,
  resolveBookmarkDragInsertIndex,
  type BookmarkMoveOperation,
  type BookmarkDragSlotRectLike,
  validateBackgroundBlobSize,
  validateBackgroundContentLength
} from './interactions.js'
import {
  DEFAULT_ENABLED_SEARCH_ENGINE_IDS,
  SEARCH_ENGINE_CONFIG_BY_ID,
  SEARCH_MULTI_OPEN_LIMIT,
  normalizeEnabledSearchEngineIds,
  normalizeSearchEngineId,
  planSearchOpenTargets,
  type SearchEngineId
} from './search-engines.js'
import type { NewTabTimeSettings } from './time-settings.js'
import {
  buildNewTabModuleSettingRows,
  DEFAULT_NEW_TAB_MODULE_SETTINGS,
  getVisibleNewTabModules,
  moveNewTabModuleSetting,
  normalizeNewTabModuleSettings,
  type NewTabModuleSettingKey,
  type NewTabModuleSettings
} from './module-settings.js'
import {
  DEFAULT_FEATURED_BACKGROUND_PREFERENCES,
  FEATURED_BACKGROUND_DISPLAY_LIMITS,
  getFeaturedBackgroundDisplayCss,
  normalizeFeaturedBackgroundPreferences,
  type FeaturedBackgroundDisplayCss,
  type FeaturedBackgroundPreferences
} from './featured-gallery-preferences.js'
import { openFeaturedBackgroundPickerContent } from './featured-gallery-picker.js'
import {
  buildFeaturedBackgroundPickerItems,
  buildFeaturedBackgroundPickerSections,
  type FeaturedBackgroundPickerSections
} from './featured-gallery-list.js'
import { createFeaturedBackgroundCardPreviewRegistry } from './featured-gallery-preview-registry.js'
import { getSpeedDialFaviconLoadAttributes } from './speed-dial-load-attributes.js'
import type { SpeedDialEmptyState, SpeedDialItem } from './speed-dial-types.js'
import {
  createFolderDragSectionRectSnapshotFromElements,
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
import type { FeaturedBackgroundItem } from './background-gallery.js'
import {
  clearInstantWallpaper,
  clearInstantWallpaperTarget,
  createInstantWallpaperDataUrl,
  readInstantWallpaper,
  readInstantWallpaperDataUrl,
  readInstantWallpaperTarget,
  saveInstantWallpaper,
  saveInstantWallpaperTarget,
  getInstantWallpaperFallbackColor,
  normalizeInstantWallpaperColor,
  type InstantWallpaperTargetRecord
} from './instant-wallpaper.js'
import { createBackgroundObjectUrlCache } from './background-media-cache.js'
import {
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  toggleNewTabWorkspacePin,
  updateNewTabWorkspace,
  type NewTabWorkspaceSettings
} from '../shared/newtab-workspace-settings.js'
import { mark as perfMark, measure as perfMeasure, measureNow } from '../shared/perf.js'
import { runIdle, runMicroIdle } from '../shared/idle.js'
import {
  appendBookmarkTileIslandElements,
  createBookmarkContentIslandElement,
  createBookmarkTileIslandElement,
  createSearchWidgetIslandElement,
  mountNewTabDragGhostBridge,
  renderNewTabSavedSearchesIsland,
  renderNewTabSearchChipsIsland,
  renderNewTabSearchHintIsland,
  renderNewTabSearchSectionLabelIsland,
  renderNewTabSearchSuggestionsIsland,
  renderBookmarkTileIslandElement,
  renderSearchWidgetActionStateIsland,
  renderSearchWidgetButtonStatesIsland,
  renderSearchWidgetComboboxStateIsland,
  renderSearchWidgetEngineMenuStateIsland,
  renderSearchWidgetInteractionStateIsland,
  renderSearchWidgetPanelStateIsland,
  replaceBookmarkContentIslandChildren,
  type BookmarkContentViewModel,
  type BookmarkFolderSectionViewModel,
  type BookmarkTileViewModel,
  type FeaturedBackgroundPickerCardViewModel,
  type FeaturedBackgroundPickerGridSectionViewModel,
  type FeaturedBackgroundPickerProviderGroupViewModel,
  type FeaturedBackgroundPickerState,
  type PortalPanelState,
  type QuickAccessGroupViewModel,
  type QuickAccessPanelState,
  type SavedSearchesState,
  type SearchChipViewModel,
  type SearchEngineMenuItemViewModel,
  type SourceNavigationState,
  type SearchWidgetEngineMenuState,
  type SearchHintState,
  type SearchSuggestionViewModel,
  type SpeedDialCardViewModel
} from './components/RuntimeIslands.js'
import {
  dispatchNewtabModuleSettingsView,
  registerNewtabModuleSettingsActions,
  type NewtabModuleSettingRowView
} from './newtab-module-settings-store.js'
import {
  dispatchNewtabFolderSourceView,
  registerNewtabFolderSourceActions,
  type NewtabFolderCandidateItemView,
  type NewtabFolderCandidateState,
  type NewtabGeneralSettingToggleKey,
  type NewtabSelectedFolderSourceItemView,
  type NewtabSelectedFolderSourceState
} from './newtab-folder-source-store.js'
import type {
  BookmarkAddMenuViewModel,
  BookmarkEditMenuViewModel,
  BookmarkMenuActionIcon,
  BookmarkMenuActionViewModel,
  BookmarkMenuTextFieldViewModel
} from './bookmark-menu-view-models.js'
import {
  dispatchNewtabSettingsDrawerActiveGroup,
  getNewtabSettingsDrawerView,
  dispatchNewtabSettingsDrawerOpen,
  dispatchNewtabSettingsDrawerSaveStatus,
  registerNewtabSettingsDrawerActions
} from './newtab-settings-drawer-store.js'
import {
  dispatchNewtabFeaturedBackgroundModalControls,
  dispatchNewtabFeaturedBackgroundModalOpen,
  getNewtabFeaturedBackgroundModalOpen,
  registerNewtabFeaturedBackgroundModalActions
} from './newtab-featured-background-modal-store.js'
import {
  dispatchNewtabFeaturedBackgroundHoverPreviewBackgroundImage,
  dispatchNewtabFeaturedBackgroundHoverPreviewHidden,
  dispatchNewtabFeaturedBackgroundHoverPreviewView
} from './newtab-featured-background-hover-preview-store.js'
import {
  dispatchNewtabDashboardOverlayControls,
  registerNewtabDashboardOverlayActions
} from './newtab-dashboard-overlay-store.js'
import { dispatchNewtabContentView } from './newtab-content-store.js'
import { dispatchNewtabClockView, type NewtabClockView } from './newtab-clock-store.js'
import {
  dispatchNewtabSpeedDialView,
  getNewtabSpeedDialView
} from './newtab-speed-dial-store.js'
import { dispatchNewtabFeaturedBackgroundPickerView } from './newtab-featured-background-picker-store.js'
import {
  dispatchNewtabDeleteToastView,
  registerNewtabDeleteToastActions
} from './newtab-delete-toast-store.js'
import {
  dispatchNewtabBookmarkAddMenuClosing,
  dispatchNewtabBookmarkAddMenuView,
  dispatchNewtabBookmarkEditMenuClosing,
  dispatchNewtabBookmarkEditMenuView
} from './newtab-bookmark-menu-store.js'
import {
  registerNewtabIconSettingsActions,
  type NewtabIconSettingsFieldKey
} from './newtab-icon-preview-store.js'
import {
  createNewtabTimeSettingsView,
  dispatchNewtabTimeSettingsView,
  registerNewtabTimeSettingsActions,
  type NewtabTimeSettingsFieldKey,
  type NewtabTimeSettingsToggleKey
} from './newtab-time-settings-store.js'
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
import { dispatchNewtabDragUiView } from './newtab-drag-ui-store.js'
const FAVICON_SIZE = 64
const BOOKMARK_DRAG_LONG_PRESS_MS = 320
const FOLDER_DRAG_LONG_PRESS_MS = BOOKMARK_DRAG_LONG_PRESS_MS
const SETTINGS_SAVE_DEBOUNCE_MS = 260
const EAGER_FAVICON_LIMIT = 12
const HIGH_PRIORITY_FAVICON_LIMIT = 6
const BACKGROUND_MEDIA_DB_NAME = 'curatorNewTabBackgroundMedia'
const BACKGROUND_MEDIA_STORE = 'media'
const BACKGROUND_URL_CACHE_KEY = 'urlImage'
const BACKGROUND_URL_CACHE_KEY_PREFIX = `${BACKGROUND_URL_CACHE_KEY}:`
const FEATURED_BACKGROUND_PREVIEW_CACHE_KEY_PREFIX = 'featuredPreview:'
const BACKGROUND_URL_CACHE_MAX_DIMENSION = 2560
const BACKGROUND_URL_CACHE_QUALITY = 0.86
const FEATURED_BACKGROUND_PREVIEW_OBJECT_URL_WARM_CONCURRENCY = 2
const BACKGROUND_IMAGE_READY_TIMEOUT_MS = 2200
const REMOTE_BACKGROUND_READY_TIMEOUT_MS = 900
const BACKGROUND_VIDEO_READY_TIMEOUT_MS = 2800
const BACKGROUND_STARTUP_CACHE_IDLE_DELAY_MS = 2400
const INSTANT_WALLPAPER_REMOTE_READY_FALLBACK_MS = 1400
const INSTANT_WALLPAPER_STARTUP_CACHE_ATTEMPTS = [
  { maxDimension: 320, quality: 0.54 },
  { maxDimension: 224, quality: 0.5 },
  { maxDimension: 144, quality: 0.46 }
] as const
const FEATURED_BACKGROUND_DAILY_REFRESH_GRACE_MS = 1500
const DEFAULT_BACKGROUND_SETTINGS = {
  type: 'color',
  color: '#101013',
  imageName: '',
  videoName: '',
  url: '',
  featuredId: '',
  maskEnabled: false,
  maskStyle: 'dark',
  maskBlur: 12
}
const DEFAULT_FEATURED_BACKGROUND_PLACEHOLDER_COLOR = '#18200f'
const SUPPORTED_BACKGROUND_TYPES = new Set(['featured', 'image', 'video', 'urls', 'color'])
const SUPPORTED_BACKGROUND_MASK_STYLES = new Set(['dark', 'frosted', 'noise', 'light'])
const DEFAULT_SEARCH_SETTINGS = {
  enabled: true,
  webSearchEnabled: true,
  openInNewTab: false,
  engine: 'google' as SearchEngineId,
  enabledEngines: DEFAULT_ENABLED_SEARCH_ENGINE_IDS,
  placeholder: '搜索书签、网页，或输入 / 执行命令',
  naturalSearchEnabled: false,
  naturalSearchAiConfigured: false,
  autoVerticalCenter: false,
  width: 44,
  height: 40,
  offsetY: 0,
  background: 30
}
const DEFAULT_TIME_SETTINGS: NewTabTimeSettings = {
  enabled: true,
  showSeconds: false,
  hour12: false,
  clockSize: 100,
  dateFormat: 'year-month-day-weekday',
  timeZone: 'auto',
  displayMode: 'time-date',
  density: 'balanced'
}
const SEARCH_OFFSET_BOUNDS_FALLBACK: AdaptiveSearchOffsetBounds = { min: -32, max: 72 }
const SEARCH_OFFSET_ABSOLUTE_MIN = -240
const SEARCH_OFFSET_ABSOLUTE_MAX = 240
const SEARCH_WIDTH_BOUNDS_FALLBACK = { min: 16, max: 72 }
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
type BackgroundGalleryModule = typeof import('./background-gallery.js')
type BackgroundGalleryRefreshModule = typeof import('./background-gallery-refresh.js')
type SpeedDialModule = typeof import('./speed-dial.js')
type TimeSettingsModule = typeof import('./time-settings.js')
type CustomIconPickerModule = typeof import('./custom-icon-picker.js')

let backgroundGalleryModulePromise: Promise<BackgroundGalleryModule> | null = null
let backgroundGalleryModule: BackgroundGalleryModule | null = null
let backgroundGalleryRefreshModulePromise: Promise<BackgroundGalleryRefreshModule> | null = null
let speedDialModulePromise: Promise<SpeedDialModule> | null = null
let timeSettingsModulePromise: Promise<TimeSettingsModule> | null = null
let timeSettingsModule: TimeSettingsModule | null = null
let customIconPickerModulePromise: Promise<CustomIconPickerModule> | null = null
let featuredBackgroundUiVersion = 0
let featuredBackgroundPickerRenderSignature = ''
let speedDialRenderVersion = 0
let clockHydrationVersion = 0

const SEARCH_SUGGESTION_LIMIT = 6
const SEARCH_SUGGESTION_DEBOUNCE_MS = 120
const SEARCH_SUGGESTION_CACHE_LIMIT = 24
const SEARCH_SUGGESTION_CACHE_TTL_MS = 2 * 60 * 1000

function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tree)
    })
  })
}

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

async function removeRecycleEntryLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').removeRecycleEntry>
): ReturnType<typeof import('../shared/recycle-bin.js').removeRecycleEntry> {
  const { removeRecycleEntry } = await import('../shared/recycle-bin.js')
  return removeRecycleEntry(...args)
}

function loadBackgroundGalleryModule(): Promise<BackgroundGalleryModule> {
  backgroundGalleryModulePromise ||= import('./background-gallery.js').then((mod) => {
    backgroundGalleryModule = mod
    migrateStoredFeaturedBackgroundId(mod)
    return mod
  })
  return backgroundGalleryModulePromise
}

function loadBackgroundGalleryRefreshModule(): Promise<BackgroundGalleryRefreshModule> {
  backgroundGalleryRefreshModulePromise ||= import('./background-gallery-refresh.js')
  return backgroundGalleryRefreshModulePromise
}

function loadSpeedDialModule(): Promise<SpeedDialModule> {
  speedDialModulePromise ||= import('./speed-dial.js')
  return speedDialModulePromise
}

function loadTimeSettingsModule(): Promise<TimeSettingsModule> {
  timeSettingsModulePromise ||= import('./time-settings.js').then((mod) => {
    timeSettingsModule = mod
    return mod
  })
  return timeSettingsModulePromise
}

function loadCustomIconPickerModule(): Promise<CustomIconPickerModule> {
  customIconPickerModulePromise ||= import('./custom-icon-picker.js')
  return customIconPickerModulePromise
}

const BOOKMARK_TILE_INITIAL_RENDER_LIMIT = 72
const BOOKMARK_TILE_RENDER_CHUNK_SIZE = 48
const BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS = 320
const FEATURED_GALLERY_HIGH_PRIORITY_PREVIEW_LIMIT = 12
const FEATURED_GALLERY_INITIAL_PREVIEW_HYDRATION_LIMIT = 16
const FEATURED_GALLERY_PREVIEW_HYDRATION_CHUNK_SIZE = 6
const FEATURED_BACKGROUND_HOVER_PREVIEW_DELAY_MS = 220
const QUICK_ACCESS_ITEM_LIMIT = 6
const ACTIVITY_RECORD_LIMIT = 160
const DASHBOARD_FRAME_READY_TIMEOUT_MS = 12000
const DEFAULT_GENERAL_SETTINGS = {
  hideSettingsTrigger: false,
  showQuickAccess: true,
  showSourceNavigation: true,
  openBookmarksInNewTab: false
}
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

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

interface QuickAccessItem {
  id: string
  title: string
  url: string
  detail: string
  badge: string
  reason: PortalQuickAccessItem['reason']
  bookmark: chrome.bookmarks.BookmarkTreeNode
}

interface BookmarkLazyExpansionTarget {
  section: NewTabFolderSection
  nextIndex: number
  renderedBookmarkIndex: number
  renderVersion: number
}

type MenuActionIcon = BookmarkMenuActionIcon
type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'

interface LastDeletedBookmarkState {
  bookmark: chrome.bookmarks.BookmarkTreeNode
  recycleId: string
  deletedAt: number
  customIcon?: string
}

interface BackgroundImageNaturalSize {
  width: number
  height: number
}

type BackgroundDisplayCss = Pick<FeaturedBackgroundDisplayCss, 'backgroundSize' | 'backgroundPosition'>

const state = {
  loading: true,
  creatingFolder: false,
  error: '',
  rootNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderData: null as ExtractedBookmarkData | null,
  bookmarkCatalog: null as BookmarkCatalogSnapshot | null,
  bookmarkTagIndex: null as BookmarkTagIndex | null,
  searchSnapshotIndex: null as ContentSnapshotIndex | null,
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
  savedSearches: null as SavedSearchIndex | null,
  savedSearchesLoaded: false,
  savedSearchesError: '',
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
  pendingDeleteBookmarkId: '',
  lastDeletedBookmark: null as LastDeletedBookmarkState | null,
  deleteToastStatus: '',
  deleteToastBusy: false,
  addMenuOpen: false,
  addMenuExpanded: false,
  addFolderId: '',
  addMenuX: 0,
  addMenuY: 0,
  addTitle: '',
  addUrl: '',
  addMenuBusy: false,
  addMenuError: '',
  customIcons: {} as Record<string, string>,
  faviconAccentCache: {} as FaviconAccentCache,
  backgroundUrlCacheBusy: false,
  backgroundUrlCacheStatus: '',
  backgroundUrlCachePendingUrls: new Set<string>(),
  backgroundStatus: '',
  backgroundStatusTone: 'info' as 'info' | 'success' | 'warning' | 'error',
  featuredBackgroundGallery: [] as FeaturedBackgroundItem[],
  featuredBackgroundFavoriteIds: [] as string[],
  featuredBackgroundGalleryHydrated: false,
  featuredBackgroundPreferences: { ...DEFAULT_FEATURED_BACKGROUND_PREFERENCES } as FeaturedBackgroundPreferences,
  featuredBackgroundRefreshing: false,
  featuredBackgroundStatus: '',
  featuredBackgroundStatusTone: 'info' as 'info' | 'success' | 'warning' | 'error',
  draggingBookmarkId: '',
  dragPointerId: 0,
  dragLongPressTimer: 0,
  dragClientX: 0,
  dragClientY: 0,
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
  folderCandidateCache: {
    signature: '',
    candidates: []
  } as FolderCandidateCacheState,
  activity: {
    pinnedIds: [],
    records: {}
  } as NewTabActivityState,
  folderCandidatesExpanded: false,
  folderCandidateQuery: '',
  folderCandidateActiveId: '',
  timeSettings: { ...DEFAULT_TIME_SETTINGS } as NewTabTimeSettings,
  settingsSaveState: 'idle' as SettingsSaveState,
  settingsSaveMessage: '',
  activeSettingsGroup: 'source' as SettingsDrawerSection,
  dashboardOpen: false,
  dashboardFrameLoaded: false,
  dashboardFrameReady: false,
  dashboardFrameError: '',
  searchOffsetBounds: { ...SEARCH_OFFSET_BOUNDS_FALLBACK } as AdaptiveSearchOffsetBounds,
  searchWidthBounds: { ...SEARCH_WIDTH_BOUNDS_FALLBACK },
  faviconRefreshTokens: new Map<string, number>()
}

let onboardingCompleted = false

const elementByIdCache = new Map<string, HTMLElement>()

function cachedEl<T extends HTMLElement = HTMLElement>(id: string): T | null {
  const existing = elementByIdCache.get(id)
  if (existing) return existing as T
  const found = document.getElementById(id) as T | null
  if (found) elementByIdCache.set(id, found)
  return found
}

function isValueControl(element: unknown): element is HTMLInputElement | HTMLSelectElement {
  return element instanceof HTMLInputElement || element instanceof HTMLSelectElement
}

const root = cachedEl('newtab-root')
const dashboardTrigger = cachedEl('newtab-dashboard-trigger')
let dashboardOverlay: HTMLElement | null = null
let dashboardFrame: HTMLIFrameElement | null = null
const settingsTrigger = cachedEl('newtab-settings-trigger')
let settingsDrawer: HTMLElement | null = null
const settingsBackdrop = cachedEl('newtab-settings-backdrop')
let featuredBackgroundModal: HTMLElement | null = null
let featuredBackgroundModalGrid: HTMLElement | null = null
let featuredBackgroundModalClose: HTMLElement | null = null
let featuredBackgroundPicker: HTMLElement | null = null
let clockTimer = 0
let featuredBackgroundRefreshTimer = 0
let featuredBackgroundPreferencesSaveTimer = 0
let featuredBackgroundPreviewTimer = 0
let backgroundApplyToken = 0
let activeBackgroundObjectUrl = ''
let lastAppliedBackgroundMediaSignature = ''
let bookmarkDragGhost: HTMLElement | null = null
let bookmarkDragGhostFrame = 0
let speedDialDragGhost: HTMLElement | null = null
let speedDialDragGhostFrame = 0
let folderDragGhost: HTMLElement | null = null
let folderDragGhostFrame = 0
let folderDragSectionRectSnapshot: FolderDragSectionRectSnapshot | null = null
let resizeLayoutFrame = 0
let verticalCenterCollisionFrame = 0
let deferredRenderFrame = 0
let bookmarkTileRenderVersion = 0
let settingsDrawerReturnFocusElement: HTMLElement | null = null
let featuredBackgroundModalReturnFocusElement: HTMLElement | null = null
let featuredBackgroundPreviewCard: HTMLElement | null = null
let featuredBackgroundCardPreviewObserver: IntersectionObserver | null = null
let featuredBackgroundCardPreviewObservedRoot: HTMLElement | null = null
const featuredBackgroundGalleryObjectUrlCache = createBackgroundObjectUrlCache()
const featuredBackgroundGalleryPreviewObjectUrlCache = createBackgroundObjectUrlCache()
const featuredBackgroundCardPreviewRegistry = createFeaturedBackgroundCardPreviewRegistry()
let featuredBackgroundGalleryPreviewObjectUrlWarmTask: Promise<void> | null = null
let featuredBackgroundGalleryPreviewObjectUrlWarmSignature = ''
let featuredBackgroundGalleryPreviewWarmTimer = 0
let instantWallpaperRemoteReadyFallbackTimer = 0
let deferredRenderClockUpdate = false
let searchSettingsSaveTimer = 0
let searchSettingsSettleTimer = 0
let iconSettingsSaveTimer = 0
let timeSettingsSaveTimer = 0
let settingsSaveStatusTimer = 0
let bookmarkMenuCloseTimer = 0
let addBookmarkMenuCloseTimer = 0
let folderReorderStatusTimer = 0
let bookmarkChangeRefreshTimer = 0
let bookmarkChangeRefreshInFlight = false
let bookmarkChangeRefreshQueued = false
let dashboardFrameReadyTimeout = 0
let backgroundStartupCacheTimer = 0
let backgroundStartupCacheRequestId = 0
let backgroundUrlCacheTaskByUrl = new Map<string, BackgroundUrlCacheTask>()
let activeBackgroundImageNaturalSize: BackgroundImageNaturalSize | null = null
let activeBackgroundImageNaturalSizeSignature = ''
const backgroundImageNaturalSizeByUrl = new Map<string, BackgroundImageNaturalSize>()
let preloadedBackgroundSettings: typeof DEFAULT_BACKGROUND_SETTINGS | null = null
let backgroundSettingsMutationVersion = 0
let backgroundUiAppliedFromPreload = false
let featuredBackgroundOptionsHydratedDateSeed = ''
let bookmarkDragSlotRects = new Map<string, DOMRect>()
let bookmarkDragSlotOrderIds: string[] = []
let speedDialDragSlotRects = new Map<string, DOMRect>()
let speedDialDragSlotOrderIds: string[] = []
let dashboardReturnFocusTarget: HTMLElement | null = null
let newTabDomContentLoadedRecorded = false
let newTabSkeletonRenderRecorded = false
let newTabFirstRenderRecorded = false
let newTabBackgroundReadyRecorded = false
let newTabRefreshVersion = 0
let searchIndexBuildVersion = 0
let searchIndexRebuildScheduled = false
let lastBuiltSearchIndexCatalogVersion = ''
let resolveSearchIndexReady: () => void = () => {}
let searchIndexReadyPromise: Promise<void> = createSearchIndexReadyPromise()
let lastRenderedContentSignature = ''

function refreshBookmarkCatalog(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null = state.rootNode
): BookmarkCatalogSnapshot {
  const snapshot = buildBookmarkCatalogSnapshot({
    rootNode,
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
let lastRenderedShellSignature = ''
let bookmarkLazyExpansionObserver: IntersectionObserver | null = null
let bookmarkLazyExpansionTargets = new WeakMap<HTMLElement, BookmarkLazyExpansionTarget>()
const backgroundPreloadPromise = preloadBackgroundSettings()

state.searchIndexReadyPromise = searchIndexReadyPromise

interface BackgroundUrlCacheTask {
  startupBlob: Promise<Blob>
  durableBlob: Promise<Blob>
}

let newTabControllerStarted = false

export function useNewtabController(): void {
  useEffect(() => {
    startNewTabController()
  }, [])
}

function startNewTabController(): void {
  if (newTabControllerStarted) {
    return
  }
  newTabControllerStarted = true

  recordNewTabDomContentLoaded()
  bindEvents()
  hydrateFeaturedBackgroundOptions()
  void backgroundPreloadPromise
  void hydrateNewTabSavedSearches()
  void refreshNewTab()
  document.addEventListener('visibilitychange', handleNewTabVisibilityChange)
  window.addEventListener('pagehide', cleanupNewTabController)
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

function markSearchIndexDirty({ schedule = true } = {}): void {
  state.bookmarkCatalog = null
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
    searchIndexRebuildScheduled = false
    if (version !== searchIndexBuildVersion) {
      return
    }

    rebuildNewTabSearchIndex()
  })
}

function recordNewTabDomContentLoaded(): void {
  if (newTabDomContentLoadedRecorded) {
    return
  }

  newTabDomContentLoadedRecorded = true
  perfMark('newtab.domContentLoaded')
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
    onFeaturedPickerClick: () => {
      void openFeaturedBackgroundPicker()
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
  registerNewtabFeaturedBackgroundModalActions({
    onCloseRequest: handleFeaturedBackgroundModalCloseRequest,
    onGridScroll: () => {
      clearFeaturedBackgroundHoverPreview()
    },
    onModalPointerDownCapture: handleFeaturedBackgroundModalPointerDown,
    onReady: initializeFeaturedBackgroundModal,
    onRefreshClick: () => {
      void refreshFeaturedBackgroundGallery()
    }
  })
  registerNewtabDashboardOverlayActions({
    onCloseRequest: closeDashboardRoute,
    onFallbackRetry: retryDashboardFrame,
    onFallbackReturn: closeDashboardRoute,
    onFrameError: () => {
      setDashboardFrameError('书签仪表盘加载失败。你可以返回新标签页，或重试打开仪表盘。')
    },
    onOpenRequest: openDashboardRoute,
    onReady: initializeDashboardOverlay
  })
  registerNewtabDeleteToastActions({
    onOpenRecycle: openRecycleBin,
    onUndo: () => {
      void undoLastDeletedBookmark()
    }
  })
  registerNewtabModuleSettingsActions({
    onMove: handleModuleSettingMove,
    onToggle: handleModuleSettingToggle
  })
  registerNewtabFolderSourceActions({
    onCandidateFocus: handleFolderCandidateFocus,
    onCandidateKeyDown: handleFolderCandidateListKeydown,
    onCandidateSearchKeyDown: handleFolderCandidateSearchKeydown,
    onCandidateSelect: handleFolderCandidateSelect,
    onCandidateQueryChange: handleFolderCandidateSearch,
    onFolderHideNamesToggle: handleFolderHideNamesToggle,
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
  registerNewtabTimeSettingsActions({
    onFieldChange: handleTimeSettingFieldChange,
    onToggle: handleTimeSettingToggle
  })
  registerNewtabSearchSettingsActions({
    onFieldChange: handleSearchSettingFieldChange,
    onToggle: handleSearchSettingToggle
  })
  registerNewtabBackgroundSettingsActions({
    onFileSelect: (mediaType, file) => {
      void handleBackgroundFileChange(mediaType, file)
    },
    onFieldChange: handleBackgroundSettingFieldChange,
    onMaskToggle: handleBackgroundMaskToggle,
    onUrlCommit: () => {
      void handleBackgroundUrlCommit()
    }
  })
  initializeSettingsDrawer()
  initializeFeaturedBackgroundModal()
  initializeDashboardOverlay()

  window.addEventListener('hashchange', syncDashboardRoute)
  window.addEventListener('message', handleDashboardMessage)
  syncDashboardRoute()
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element) || (!state.activeMenuBookmarkId && !state.addMenuOpen)) {
      return
    }

    if (isBookmarkMenuInteractionTarget(target)) {
      return
    }

    closeBookmarkMenu()
    closeAddBookmarkMenu()
  })
  window.addEventListener('resize', () => {
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    cancelSpeedDialDrag()
    cancelBookmarkDrag()
    cancelFolderDrag()
    if (!resizeLayoutFrame) {
      resizeLayoutFrame = window.requestAnimationFrame(() => {
        resizeLayoutFrame = 0
        applyIconSettingsLive()
        updateClockText()
      })
    }
  })

  root?.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (
      (state.dragSuppressClick && target.closest('[data-bookmark-id]')) ||
      (state.speedDialDragSuppressClick && target.closest('[data-speed-dial-bookmark-id]')) ||
      (state.folderDragSuppressClick && target.closest('[data-folder-drag-handle]'))
    ) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
  })

  root?.addEventListener('pointerdown', handleSpeedDialPointerDown)
  root?.addEventListener('pointerdown', handleFolderPointerDown)
  root?.addEventListener('pointerdown', handleBookmarkPointerDown)
  window.addEventListener('pointermove', handleNewTabPointerMove)
  window.addEventListener('pointerup', (event) => {
    void finishSpeedDialDrag(event)
    void finishBookmarkDrag(event)
    void finishFolderDrag(event)
  })
  window.addEventListener('pointercancel', () => {
    cancelSpeedDialDrag({ keepSuppressClick: true })
    cancelBookmarkDrag({ keepSuppressClick: true })
    cancelFolderDrag({ keepSuppressClick: true })
  })
  root?.addEventListener('contextmenu', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

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

    const bookmarkTarget = target.closest('[data-bookmark-id]')
    if (bookmarkTarget instanceof HTMLElement) {
      event.preventDefault()
      closeAddBookmarkMenu({ animate: false })
      openBookmarkMenu(
        String(bookmarkTarget.dataset.bookmarkId || ''),
        event.clientX,
        event.clientY
      )
      return
    }

    if (target.closest('.newtab-search')) {
      return
  }

  event.preventDefault()
  closeBookmarkMenu({ animate: false })
  openAddBookmarkMenu(event.clientX, event.clientY)
})

  chrome.bookmarks?.onCreated?.addListener(handleBookmarkCreated)
  chrome.bookmarks?.onRemoved?.addListener(handleBookmarkRemoved)
  chrome.bookmarks?.onChanged?.addListener(handleBookmarkChanged)
  chrome.bookmarks?.onMoved?.addListener(handleBookmarkMoved)

  window.clearTimeout(clockTimer)
  scheduleClockTick()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Tab' && trapFeaturedBackgroundModalFocus(event)) {
    return
  }

  if (event.key === 'Tab' && trapDashboardOverlayFocus(event)) {
    return
  }

  if (event.key === 'Tab' && trapSettingsDrawerFocus(event)) {
    return
  }

  if (event.key === 'Escape') {
    if (isFeaturedBackgroundPickerOpen()) {
      event.preventDefault()
      closeFeaturedBackgroundPicker()
      return
    }
    if (state.dashboardOpen) {
      event.preventDefault()
      closeDashboardRoute()
      return
    }
    if (isSettingsDrawerOpen()) {
      event.preventDefault()
      closeSettingsDrawer()
    }
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    cancelFolderDrag()
    return
  }

  if (shouldOpenDashboardFromKeydown(event)) {
    event.preventDefault()
    openDashboardRoute()
    return
  }

  if (!shouldFocusSearchFromKeydown(event)) {
    return
  }

  const input = document.querySelector<HTMLInputElement>('.newtab-search-input')
  if (!input) {
    return
  }

  event.preventDefault()
  input.focus()

  if (event.key === '/') {
    input.select()
    return
  }

  if (event.key.length === 1) {
    input.value = event.key
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function shouldFocusSearchFromKeydown(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    !state.searchSettings.enabled ||
    state.draggingBookmarkId ||
    state.draggingFolderId ||
    state.activeMenuBookmarkId ||
    state.addMenuOpen ||
    isSettingsDrawerOpen()
  ) {
    return false
  }

  const activeElement = document.activeElement
  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    (activeElement instanceof HTMLElement && activeElement.getAttribute('role') === 'combobox') ||
    activeElement instanceof HTMLButtonElement ||
    activeElement instanceof HTMLAnchorElement ||
    activeElement?.getAttribute('contenteditable') === 'true'
  ) {
    return false
  }

  return event.key === '/'
}

function shouldOpenDashboardFromKeydown(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.shiftKey || isEditableEventTarget(event.target)) {
    return false
  }

  return Boolean(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
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
    scheduleRender({ updateClock: true })
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
  updateClockText()
}

function toggleFolderCandidates(): void {
  state.folderCandidatesExpanded = !state.folderCandidatesExpanded
  syncFolderSettingsControls()
  if (state.folderCandidatesExpanded) {
    window.requestAnimationFrame(() => {
      const searchInput = cachedEl('folder-candidate-search')
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus({ preventScroll: true })
      }
    })
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
  if (!candidates.length) {
    return false
  }

  focusFolderCandidateOption(key === 'ArrowDown' ? 'first' : 'last')
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

function handleFolderCandidateListKeydown(key: string): boolean {
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
    cachedEl('folder-candidate-search')?.focus()
    return true
  }

  if (key === 'Home') {
    focusFolderCandidateOption('first')
  } else if (key === 'End') {
    focusFolderCandidateOption('last')
  } else {
    focusFolderCandidateOption(key === 'ArrowDown' ? 1 : -1)
  }
  return true
}

function getFolderCandidateOptionButtons(): HTMLButtonElement[] {
  const candidateList = cachedEl('folder-candidate-list')
  if (!(candidateList instanceof HTMLElement)) {
    return []
  }

  return [...candidateList.querySelectorAll<HTMLButtonElement>('[data-folder-candidate-id]')]
}

function focusFolderCandidateOptionById(folderId: string): boolean {
  let targetButton: HTMLButtonElement | null = null
  for (const candidateButton of getFolderCandidateOptionButtons()) {
    const isTarget = candidateButton.dataset.folderCandidateId === folderId
    candidateButton.tabIndex = isTarget ? 0 : -1
    if (isTarget) {
      targetButton = candidateButton
    }
  }

  if (!targetButton) {
    return false
  }

  state.folderCandidateActiveId = folderId
  targetButton.focus()
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

function syncFolderCandidateOptionTabStops(activeId: string): void {
  for (const candidateButton of getFolderCandidateOptionButtons()) {
    candidateButton.tabIndex = candidateButton.dataset.folderCandidateId === activeId ? 0 : -1
  }
}

function focusFolderCandidateOption(direction: 1 | -1 | 'first' | 'last'): void {
  const buttons = getFolderCandidateOptionButtons()
  if (!buttons.length) {
    return
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement)
  let nextIndex = state.folderCandidateActiveId
    ? buttons.findIndex((button) => button.dataset.folderCandidateId === state.folderCandidateActiveId)
    : -1

  if (direction === 'first') {
    nextIndex = 0
  } else if (direction === 'last') {
    nextIndex = buttons.length - 1
  } else if (currentIndex >= 0) {
    nextIndex = (currentIndex + direction + buttons.length) % buttons.length
  } else if (nextIndex < 0) {
    nextIndex = direction > 0 ? 0 : buttons.length - 1
  }

  const button = buttons[Math.max(0, nextIndex)]
  const folderId = String(button?.dataset.folderCandidateId || '')
  if (folderId) {
    focusFolderCandidateOptionById(folderId)
  }
}

function handleFolderCandidateFocus(folderId: string): void {
  if (!folderId) {
    return
  }

  state.folderCandidateActiveId = folderId
  syncFolderCandidateOptionTabStops(state.folderCandidateActiveId)
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
  const candidateList = cachedEl('folder-candidate-list')
  const previousScrollTop = preserveCandidateScroll && candidateList instanceof HTMLElement
    ? candidateList.scrollTop
    : 0
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
    state.folderSections = previousSections
    refreshDerivedBookmarkState()
    markSearchIndexDirty()
    render()
    syncFolderSettingsControls()
    applyFolderSettings()
    updateClockText()
    setSettingsSaveStatus('error', '来源保存失败，已恢复到上次已保存状态')
    console.warn('新标签页来源设置保存失败，已回滚。', error)
    return
  }

  render()
  syncFolderSettingsControls()
  applyFolderSettings()
  updateClockText()

  if (preserveCandidateScroll || restoreCandidateFocus) {
    window.requestAnimationFrame(() => {
      const nextList = cachedEl('folder-candidate-list')
      if (nextList instanceof HTMLElement) {
        nextList.scrollTop = previousScrollTop
      }
      if (restoreCandidateFocus) {
        focusFolderCandidateOptionById(focusCandidateId || state.folderCandidateActiveId)
      }
    })
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
    scheduleRender({ updateClock: true })
  }
  if (options.syncControls !== false) {
    syncSearchSettingsControls()
  }
}

function applySearchSettingsLive(): void {
  const settings = state.searchSettings
  const widthBounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  const offsetBounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  const slot = root?.querySelector<HTMLElement>('.newtab-search-slot')
  const form = slot?.querySelector<HTMLElement>('.newtab-search')
  const width = clampNumber(settings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)
  const offsetY = clampNumber(settings.offsetY, offsetBounds.min, offsetBounds.max, DEFAULT_SEARCH_SETTINGS.offsetY)

  slot?.style.setProperty('--search-width', `${width}vw`)
  slot?.style.setProperty('--search-height', `${settings.height}px`)
  if (settings.autoVerticalCenter) {
    if (slot) {
      slot.dataset.searchAutoVerticalCenter = 'true'
    }
    scheduleAdaptiveNewTabLayoutUpdate()
  } else if (slot) {
    slot.dataset.searchAutoVerticalCenter = 'false'
    slot.style.setProperty('--search-offset-y', `${offsetY}px`)
  }
  form?.style.setProperty('--search-width', `${width}vw`)
  form?.style.setProperty('--search-height', `${settings.height}px`)
  form?.style.setProperty('--search-bg-alpha', String(settings.background / 100))
}

function scheduleSearchSettingsSettle(): void {
  window.clearTimeout(searchSettingsSettleTimer)
  searchSettingsSettleTimer = window.setTimeout(() => {
    searchSettingsSettleTimer = 0
    scheduleAdaptiveNewTabLayoutUpdate()
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function handleBackgroundMaskToggle(enabled: boolean): void {
  const previousSettings = state.backgroundSettings
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    maskEnabled: enabled
  })
  commitBackgroundSettings(previousSettings, nextSettings)
}

function handleBackgroundSettingFieldChange(
  key: NewtabBackgroundSettingsFieldKey,
  value: number | string
): void {
  if (key === 'displaySize' || key === 'positionX' || key === 'positionY') {
    state.featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences({
      ...state.featuredBackgroundPreferences,
      [key]: value
    })
    applyFeaturedBackgroundDisplayPreferences()
    syncBackgroundSettingsControls()
    scheduleFeaturedBackgroundPreferencesSave()
    return
  }

  const previousSettings = state.backgroundSettings
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    [key]: value
  })
  commitBackgroundSettings(previousSettings, nextSettings)
}

function commitBackgroundSettings(
  previousSettings: typeof DEFAULT_BACKGROUND_SETTINGS,
  nextSettings: typeof DEFAULT_BACKGROUND_SETTINGS
): void {
  const shouldClearUrlCache = shouldClearBackgroundUrlCache(previousSettings, nextSettings)
  state.backgroundSettings = nextSettings
  updateBackgroundStartupCacheStatus(nextSettings)
  backgroundSettingsMutationVersion += 1
  preloadedBackgroundSettings = nextSettings
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(nextSettings))
  syncInstantWallpaperTargetForSettings(nextSettings)
  void saveBackgroundSettings().catch((error) => {
    console.warn('新标签页背景设置保存失败。', error)
  })
  syncBackgroundSettingsControls()
  scheduleFeaturedBackgroundDailyRefresh()
  scheduleCurrentBackgroundStartupCache(nextSettings)
  void applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache)
}

async function handleBackgroundUrlCommit(): Promise<void> {
  if (state.backgroundSettings.type !== 'urls') {
    return
  }

  const imageUrl = getRemoteBackgroundImageUrl(state.backgroundSettings)
  if (!imageUrl) {
    return
  }

  const permissionGranted = await ensureBackgroundImageFetchPermission(imageUrl, { request: true })
  if (!permissionGranted) {
    setBackgroundStatus('未授权该图片域名，首屏缓存可能无法准备。', 'warning')
    syncBackgroundSettingsControls()
    return
  }
  await ensureCurrentBackgroundStartupCache(state.backgroundSettings)
}

async function applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache: boolean): Promise<void> {
  if (shouldClearUrlCache) {
    await clearBackgroundUrlCache()
  }
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

  try {
    const previousSettings = state.backgroundSettings
    setBackgroundStatus('正在保存背景文件...', 'info')
    syncBackgroundSettingsControls()
    await saveBackgroundMedia(mediaType, file)
    state.backgroundSettings = normalizeBackgroundSettings({
      ...state.backgroundSettings,
      type: mediaType,
      imageName: mediaType === 'image' ? file.name : state.backgroundSettings.imageName,
      videoName: mediaType === 'video' ? file.name : state.backgroundSettings.videoName
    })
    backgroundSettingsMutationVersion += 1
    preloadedBackgroundSettings = state.backgroundSettings
    await saveBackgroundSettings()
    await ensureCurrentBackgroundStartupCache(state.backgroundSettings)
    if (shouldClearBackgroundUrlCache(previousSettings, state.backgroundSettings)) {
      await clearBackgroundUrlCache()
    }
    syncBackgroundSettingsControls()
    scheduleFeaturedBackgroundDailyRefresh()
    await applyBackgroundSettings()
    setBackgroundStatus(
      mediaType === 'image' ? '背景图片已保存。' : '背景视频已保存。',
      'success'
    )
    syncBackgroundSettingsControls()
  } catch (error) {
    setBackgroundStatus(getBackgroundMediaSaveErrorMessage(error), 'error')
    syncBackgroundSettingsControls()
  }
}

function handleTimeSettingToggle(key: NewtabTimeSettingsToggleKey, enabled: boolean): void {
  commitTimeSettings(normalizeTimeSettingsLocal({
    ...state.timeSettings,
    [key]: enabled
  }))
}

function handleTimeSettingFieldChange(key: NewtabTimeSettingsFieldKey, value: number | string): void {
  commitTimeSettings(normalizeTimeSettingsLocal({
    ...state.timeSettings,
    [key]: value
  }))
}

function commitTimeSettings(nextSettings: NewTabTimeSettings): void {
  state.timeSettings = nextSettings
  scheduleTimeSettingsSave()
  scheduleRender({ updateClock: true })
  syncTimeSettingsControls()
  scheduleClockTick()
}

function syncActiveSettingsGroupControls(group: SettingsDrawerSection = state.activeSettingsGroup): void {
  for (const action of getSettingsGroupControlSyncActions(group)) {
    switch (action) {
      case 'folder':
        syncFolderSettingsControls()
        break
      case 'background':
        syncBackgroundSettingsControls()
        break
      case 'featuredBackgroundDisplay':
        syncFeaturedBackgroundDisplayPreferenceControls()
        break
      case 'search':
        syncSearchSettingsControls()
        break
      case 'modules':
        syncNewTabModernSettingsControls()
        break
      case 'general':
        syncGeneralSettingsControls()
        break
      case 'icon':
        syncIconSettingsControls()
        break
      case 'time':
        syncTimeSettingsControls()
        break
    }
  }
}

let settingsDrawerReady = false
let settingsDrawerReadyPromise: Promise<void> | null = null
let resolveSettingsDrawerReady: (() => void) | null = null

function ensureSettingsDrawerReady(): Promise<void> {
  if (settingsDrawerReady) return Promise.resolve()
  if (!settingsDrawerReadyPromise) {
    settingsDrawerReadyPromise = new Promise<void>((resolve) => {
      resolveSettingsDrawerReady = resolve
    })
  }
  return settingsDrawerReadyPromise
}

function initializeSettingsDrawer(): void {
  if (settingsDrawerReady) return
  settingsDrawer = cachedEl('newtab-settings-drawer')
  if (!settingsDrawer) {
    window.requestAnimationFrame(initializeSettingsDrawer)
    return
  }

  bindGeneralSettingsEvents()
  bindFolderSettingsEvents()
  settingsDrawerReady = true
  resolveSettingsDrawerReady?.()
  hydrateFeaturedBackgroundOptions()
  syncBackgroundSettingsControls()
  syncSearchSettingsControls()
  syncGeneralSettingsControls()
  syncFolderSettingsControls()
  syncIconSettingsControls()
  syncTimeSettingsControls()
}

function openSettingsDrawer(options?: { focusFirstControl?: boolean; section?: SettingsDrawerSection }): void {
  void ensureSettingsDrawerReady().then(() => {
    const firstOpenAfterMount = !isSettingsDrawerOpen()
    if (firstOpenAfterMount) {
      primeSettingsDrawerOpenTransition()
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          runOpenSettingsDrawer(options)
        })
      })
      return
    }
    runOpenSettingsDrawer(options)
  })
}

function primeSettingsDrawerOpenTransition(): void {
  if (settingsDrawer) {
    settingsDrawer.getBoundingClientRect()
  }
  if (settingsBackdrop) {
    settingsBackdrop.getBoundingClientRect()
  }
  dispatchNewtabSettingsDrawerOpen(false, 'opening')
}

function runOpenSettingsDrawer(options?: { focusFirstControl?: boolean; section?: SettingsDrawerSection }): void {
  measureNow('newtab.openSettingsDrawer', () => {
    const focusFirstControl = options?.focusFirstControl !== false
    setActiveSettingsGroup(options?.section || state.activeSettingsGroup || 'source', { scrollToTop: false })
    settingsDrawerReturnFocusElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    syncSettingsSaveStatus()
    scheduleAdaptiveNewTabLayoutUpdate()
    dispatchNewtabSettingsDrawerOpen(true, 'open')
    if (focusFirstControl) {
      window.requestAnimationFrame(() => {
        focusFirstSettingsDrawerControl()
      })
    }
    if (options?.section) {
      window.requestAnimationFrame(() => {
        focusSettingsSection(options.section)
      })
    }
  })
}

function openFolderSourceSettings(): void {
  state.folderCandidatesExpanded = true
  state.folderCandidateQuery = ''
  openSettingsDrawer({ focusFirstControl: false, section: 'source' })
}

function focusSettingsSection(section: SettingsDrawerSection): void {
  const titleIdBySection: Record<SettingsDrawerSection, string> = {
    source: 'settings-folder-title',
    appearance: 'settings-background-title',
    search: 'settings-search-title',
    modules: 'settings-speed-dial-title',
    advanced: 'settings-general-title'
  }
  const targetSection = cachedEl(titleIdBySection[section])?.closest('.settings-section')
  targetSection?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  if (section === 'source') {
    const searchInput = cachedEl('folder-candidate-search')
    if (searchInput instanceof HTMLInputElement) {
      searchInput.focus()
    }
    return
  }

  const firstControl = targetSection?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  firstControl?.focus()
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
      const scrollHost = settingsDrawer?.querySelector<HTMLElement>('.settings-drawer-scroll')
      scrollHost?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    syncActiveSettingsGroupControls(nextSection)
  })
}

function closeSettingsDrawer(): void {
  if (!isSettingsDrawerOpen()) {
    return
  }

  dispatchNewtabSettingsDrawerOpen(false, 'closing')
  window.setTimeout(() => {
    if (getNewtabSettingsDrawerView().phase === 'closing') {
      dispatchNewtabSettingsDrawerOpen(false, 'closed')
    }
  }, 260)
  restoreSettingsDrawerFocus()
}

function isSettingsDrawerOpen(): boolean {
  return getNewtabSettingsDrawerView().open
}

function focusFirstSettingsDrawerControl(): void {
  if (!settingsDrawer || !isSettingsDrawerOpen()) {
    return
  }

  const [firstElement] = getFocusableElements(settingsDrawer)
  ;(firstElement || settingsDrawer).focus()
}

function restoreSettingsDrawerFocus(): void {
  const returnElement = settingsDrawerReturnFocusElement
  settingsDrawerReturnFocusElement = null

  if (returnElement?.isConnected && !returnElement.hasAttribute('disabled')) {
    returnElement.focus()
    return
  }

  settingsTrigger?.focus()
}

function trapSettingsDrawerFocus(event: KeyboardEvent): boolean {
  if (!settingsDrawer || !isSettingsDrawerOpen() || isFeaturedBackgroundPickerOpen()) {
    return false
  }

  const focusableElements = getFocusableElements(settingsDrawer)
  const firstElement = focusableElements[0] || settingsDrawer
  const lastElement = focusableElements[focusableElements.length - 1] || settingsDrawer
  const activeElement = document.activeElement

  if (!settingsDrawer.contains(activeElement)) {
    event.preventDefault()
    ;(event.shiftKey ? lastElement : firstElement).focus()
    return true
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return true
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
    return true
  }

  return false
}

function trapFeaturedBackgroundModalFocus(event: KeyboardEvent): boolean {
  if (!featuredBackgroundModal || !isFeaturedBackgroundPickerOpen()) {
    return false
  }

  const focusableElements = getFocusableElements(featuredBackgroundModal)
  const firstElement = focusableElements[0] || featuredBackgroundModal
  const lastElement = focusableElements[focusableElements.length - 1] || featuredBackgroundModal
  const activeElement = document.activeElement

  if (!featuredBackgroundModal.contains(activeElement)) {
    event.preventDefault()
    ;(event.shiftKey ? lastElement : firstElement).focus()
    return true
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return true
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
    return true
  }

  return false
}

function trapDashboardOverlayFocus(event: KeyboardEvent): boolean {
  if (!dashboardOverlay || !state.dashboardOpen) {
    return false
  }

  const focusableElements = getFocusableElements(dashboardOverlay)
  const firstElement = focusableElements[0] || dashboardOverlay
  const lastElement = focusableElements[focusableElements.length - 1] || dashboardOverlay
  const activeElement = document.activeElement

  if (!dashboardOverlay.contains(activeElement)) {
    event.preventDefault()
    ;(event.shiftKey ? lastElement : firstElement).focus()
    return true
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return true
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
    return true
  }

  return false
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
    return !element.hasAttribute('disabled') &&
      !element.getAttribute('aria-hidden') &&
      element.offsetParent !== null
  })
}

function openBookmarkMenu(bookmarkId: string, clientX: number, clientY: number): void {
  const bookmark = getBookmarkById(bookmarkId)
  if (!bookmark?.url) {
    return
  }

  window.clearTimeout(bookmarkMenuCloseTimer)
  state.activeMenuBookmarkId = bookmarkId
  state.menuX = clientX
  state.menuY = clientY
  state.editTitle = String(bookmark.title || '').trim() || String(bookmark.url || '')
  state.editUrl = String(bookmark.url || '').trim()
  state.editIconMode = state.customIcons[bookmarkId] ? 'custom' : 'website'
  state.pendingCustomIconDataUrl = ''
  state.pendingDeleteBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu()
}

function openAddBookmarkMenu(clientX: number, clientY: number): void {
  closeBookmarkMenu({ animate: false })
  window.clearTimeout(addBookmarkMenuCloseTimer)
  state.addMenuOpen = true
  state.addMenuExpanded = false
  state.addFolderId = ''
  state.addMenuX = clientX
  state.addMenuY = clientY
  state.addTitle = ''
  state.addUrl = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function openAddBookmarkMenuForElement(anchor: HTMLElement, folderId: string): void {
  const rect = anchor.getBoundingClientRect()
  closeBookmarkMenu({ animate: false })
  window.clearTimeout(addBookmarkMenuCloseTimer)
  state.addMenuOpen = true
  state.addMenuExpanded = true
  state.addFolderId = folderId
  state.addMenuX = rect.right
  state.addMenuY = rect.bottom + 8
  state.addTitle = ''
  state.addUrl = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function closeBookmarkMenu({ animate = true } = {}): void {
  window.clearTimeout(bookmarkMenuCloseTimer)
  state.activeMenuBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  state.pendingCustomIconDataUrl = ''
  state.pendingDeleteBookmarkId = ''
  if (animate) {
    dispatchNewtabBookmarkEditMenuClosing()
    bookmarkMenuCloseTimer = window.setTimeout(() => {
      dispatchNewtabBookmarkEditMenuView(null)
      bookmarkMenuCloseTimer = 0
    }, 180)
  } else {
    dispatchNewtabBookmarkEditMenuView(null)
  }
}

function closeAddBookmarkMenu({ animate = true } = {}): void {
  window.clearTimeout(addBookmarkMenuCloseTimer)
  state.addMenuOpen = false
  state.addMenuExpanded = false
  state.addFolderId = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  if (animate) {
    dispatchNewtabBookmarkAddMenuClosing()
    addBookmarkMenuCloseTimer = window.setTimeout(() => {
      dispatchNewtabBookmarkAddMenuView(null)
      addBookmarkMenuCloseTimer = 0
    }, 180)
  } else {
    dispatchNewtabBookmarkAddMenuView(null)
  }
}

function handleSpeedDialPointerDown(event: PointerEvent): void {
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

  const target = event.target
  if (!(target instanceof Element) || target.closest('.bookmark-edit-menu')) {
    return
  }

  const card = target.closest('[data-speed-dial-bookmark-id]')
  if (!(card instanceof HTMLElement)) {
    return
  }

  const bookmarkId = String(card.dataset.speedDialBookmarkId || '').trim()
  if (!bookmarkId || !getBookmarkById(bookmarkId)) {
    return
  }

  cancelSpeedDialDrag({ keepSuppressClick: true })
  state.speedDialDragPointerId = event.pointerId
  state.speedDialDraggingBookmarkId = bookmarkId
  state.speedDialDragClientX = event.clientX
  state.speedDialDragClientY = event.clientY
  try {
    card.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture can fail if the browser has already released this pointer.
  }
  state.speedDialDragLongPressTimer = window.setTimeout(() => {
    beginSpeedDialDrag()
  }, BOOKMARK_DRAG_LONG_PRESS_MS)
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
  dispatchNewtabDragUiView({ speedDialDragging: true })
  const sourceCard = getActiveSpeedDialDragCard()
  createSpeedDialDragGhost(sourceCard)
  captureSpeedDialDragLayout()
  sourceCard?.classList.add('dragging')
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

  if (state.speedDialDragLongPressTimer) {
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

  const wasDragging = Boolean(state.speedDialDragOriginalOrderIds.length)
  const originalOrderIds = [...state.speedDialDragOriginalOrderIds]
  const pendingInsertIndex = state.speedDialDragPendingInsertIndex >= 0
    ? state.speedDialDragPendingInsertIndex
    : getSpeedDialInsertIndex(event.clientX, event.clientY)
  const finalOrderIds = wasDragging && pendingInsertIndex >= 0
    ? applyDraggedSpeedDialInsertInState(pendingInsertIndex)
    : getActiveWorkspacePinnedIds()
  clearSpeedDialDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

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
  updateClockText()
}

function clearSpeedDialDragState({ keepSuppressClick = false } = {}): void {
  getActiveSpeedDialDragCard()?.classList.remove('dragging')
  state.speedDialDraggingBookmarkId = ''
  state.speedDialDragPointerId = 0
  state.speedDialDragLongPressTimer = 0
  state.speedDialDragClientX = 0
  state.speedDialDragClientY = 0
  state.speedDialDragOffsetX = 0
  state.speedDialDragOffsetY = 0
  state.speedDialDragOriginalOrderIds = []
  state.speedDialDragPendingInsertIndex = -1
  removeSpeedDialDragGhost()
  clearSpeedDialDragVisualPreview()
  dispatchNewtabDragUiView({
    previewInitializing: false,
    speedDialDragging: false
  })

  if (keepSuppressClick) {
    state.speedDialDragSuppressClick = true
    window.setTimeout(() => {
      state.speedDialDragSuppressClick = false
    }, 250)
  } else {
    state.speedDialDragSuppressClick = false
  }
}

function createSpeedDialDragGhost(sourceCard = getActiveSpeedDialDragCard()): void {
  removeSpeedDialDragGhost()

  if (!sourceCard) {
    return
  }

  const rect = sourceCard.getBoundingClientRect()
  const ghost = sourceCard.cloneNode(true) as HTMLElement
  ghost.classList.remove('dragging')
  ghost.classList.add('speed-dial-drag-ghost')
  ghost.removeAttribute('href')
  ghost.removeAttribute('data-speed-dial-bookmark-id')
  ghost.setAttribute('aria-hidden', 'true')
  copyBookmarkDragGhostVariables(sourceCard, ghost)
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  ghost.style.visibility = 'hidden'
  speedDialDragGhost = ghost
  mountNewTabDragGhostBridge(ghost)
  syncSpeedDialDragOffsetToGhostIcon(ghost, rect)
  updateSpeedDialDragGhost({ immediate: true })
  ghost.style.visibility = ''
}

function syncSpeedDialDragOffsetToGhostIcon(ghost: HTMLElement, sourceRect: DOMRect): void {
  const ghostRect = ghost.getBoundingClientRect()
  const iconRect = ghost.querySelector('.bookmark-icon-shell')?.getBoundingClientRect()
  if (iconRect && ghostRect.width && ghostRect.height) {
    state.speedDialDragOffsetX = iconRect.left + iconRect.width / 2 - ghostRect.left
    state.speedDialDragOffsetY = iconRect.top + iconRect.height / 2 - ghostRect.top
    return
  }

  state.speedDialDragOffsetX = sourceRect.width / 2
  state.speedDialDragOffsetY = sourceRect.height / 2
}

function getActiveSpeedDialDragCard(): HTMLElement | null {
  if (!state.speedDialDraggingBookmarkId) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.newtab-speed-dial-card[data-speed-dial-bookmark-id="${CSS.escape(state.speedDialDraggingBookmarkId)}"]`
  )
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
  if (!speedDialDragGhost) {
    return
  }

  const left = state.speedDialDragClientX - state.speedDialDragOffsetX
  const top = state.speedDialDragClientY - state.speedDialDragOffsetY
  speedDialDragGhost.style.transform = `translate3d(${left}px, ${top}px, 0)`
}

function removeSpeedDialDragGhost(): void {
  window.cancelAnimationFrame(speedDialDragGhostFrame)
  speedDialDragGhostFrame = 0
  speedDialDragGhost?.remove()
  speedDialDragGhost = null
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
  const grid = getSpeedDialGrid()
  if (!grid) {
    return
  }

  for (const card of grid.querySelectorAll<HTMLElement>(':scope > .newtab-speed-dial-card[data-speed-dial-bookmark-id]')) {
    const bookmarkId = String(card.dataset.speedDialBookmarkId || '').trim()
    if (!bookmarkId) {
      continue
    }
    speedDialDragSlotOrderIds.push(bookmarkId)
    speedDialDragSlotRects.set(bookmarkId, card.getBoundingClientRect())
  }
}

function getSpeedDialGrid(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.newtab-speed-dial-grid')
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

  const grid = getSpeedDialGrid()
  if (!grid) {
    return []
  }

  return Array
    .from(grid.querySelectorAll<HTMLElement>(':scope > .newtab-speed-dial-card[data-speed-dial-bookmark-id]'))
    .map((card) => {
      const rect = card.getBoundingClientRect()
      return {
        id: String(card.dataset.speedDialBookmarkId || ''),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
    .filter((slot) => slot.id)
}

function syncSpeedDialDragVisualPreview(): void {
  const grid = getSpeedDialGrid()
  if (!grid || !speedDialDragSlotOrderIds.length) {
    return
  }

  const cardByBookmarkId = new Map<string, HTMLElement>()
  for (const card of grid.querySelectorAll<HTMLElement>(':scope > .newtab-speed-dial-card[data-speed-dial-bookmark-id]')) {
    const bookmarkId = String(card.dataset.speedDialBookmarkId || '').trim()
    if (bookmarkId) {
      cardByBookmarkId.set(bookmarkId, card)
    }
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

  for (const bookmarkId of targetOrderIds) {
    const card = cardByBookmarkId.get(bookmarkId)
    const originalRect = speedDialDragSlotRects.get(bookmarkId)
    const targetRect = targetSlotByBookmarkId.get(bookmarkId)
    if (!card || !originalRect || !targetRect) {
      continue
    }

    const deltaX = targetRect.left - originalRect.left
    const deltaY = targetRect.top - originalRect.top
    const isDraggedCard = bookmarkId === state.speedDialDraggingBookmarkId
    card.style.transform = buildBookmarkPreviewTransform(deltaX, deltaY, isDraggedCard)
    card.style.zIndex = isDraggedCard ? '1' : ''
  }
}

function clearSpeedDialDragVisualPreview(): void {
  for (const card of document.querySelectorAll<HTMLElement>('.newtab-speed-dial-card[data-speed-dial-bookmark-id]')) {
    card.style.transform = ''
    card.style.zIndex = ''
  }
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
    await saveNewTabWorkspaceSettings()
    postDashboardSpeedDialState()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Speed Dial 排序保存失败，请刷新后重试。'
    const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
    state.workspaceSettings = updateNewTabWorkspace(
      state.workspaceSettings,
      activeWorkspace.id,
      { pinnedIds: originalBookmarkIds },
      { validBookmarkIds: state.allBookmarkMap.keys() }
    )
    state.speedDialReorderError = message
    render()
    updateClockText()
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
    meta: state.speedDialReorderError || current.meta,
    metaTone: state.speedDialReorderError ? 'error' : current.metaTone
  })
}

function handleBookmarkPointerDown(event: PointerEvent): void {
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

  const target = event.target
  if (!(target instanceof Element) || target.closest('.bookmark-edit-menu')) {
    return
  }

  const bookmarkTarget = target.closest('[data-bookmark-id]')
  if (!(bookmarkTarget instanceof HTMLElement)) {
    return
  }

  const bookmarkId = String(bookmarkTarget.dataset.bookmarkId || '')
  if (!getBookmarkById(bookmarkId)) {
    return
  }
  const folderId = String(bookmarkTarget.dataset.folderId || '').trim()
  if (!folderId) {
    return
  }

  cancelBookmarkDrag({ keepSuppressClick: true })
  state.dragPointerId = event.pointerId
  state.draggingBookmarkId = bookmarkId
  state.draggingBookmarkFolderId = folderId
  state.dragClientX = event.clientX
  state.dragClientY = event.clientY
  try {
    bookmarkTarget.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture can fail if the browser has already released this pointer.
  }
  state.dragLongPressTimer = window.setTimeout(() => {
    beginBookmarkDrag()
  }, BOOKMARK_DRAG_LONG_PRESS_MS)
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
  dispatchNewtabDragUiView({ bookmarkDragging: true })
  const sourceTile = getActiveDragTile()
  createBookmarkDragGhost(sourceTile)
  captureBookmarkDragLayout()
  sourceTile?.classList.add('dragging')
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

  if (state.dragLongPressTimer) {
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

  const wasDragging = Boolean(state.dragOriginalOrderIds.length)
  const folderId = state.draggingBookmarkFolderId
  const originalOrderIds = [...state.dragOriginalOrderIds]
  const pendingInsertIndex = state.dragPendingInsertIndex >= 0
    ? state.dragPendingInsertIndex
    : getBookmarkInsertIndex(event.clientX, event.clientY)
  const finalOrderIds = wasDragging && pendingInsertIndex >= 0
    ? applyDraggedBookmarkInsertInState(pendingInsertIndex)
    : getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  clearBookmarkDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

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
  updateClockText()
}

function clearBookmarkDragState({ keepSuppressClick = false } = {}): void {
  getActiveDragTile()?.classList.remove('dragging')
  state.draggingBookmarkId = ''
  state.dragPointerId = 0
  state.dragLongPressTimer = 0
  state.dragClientX = 0
  state.dragClientY = 0
  state.dragOffsetX = 0
  state.dragOffsetY = 0
  state.draggingBookmarkFolderId = ''
  state.dragOriginalOrderIds = []
  state.dragPendingInsertIndex = -1
  removeBookmarkDragGhost()
  clearBookmarkDragVisualPreview()
  dispatchNewtabDragUiView({
    bookmarkDragging: false,
    previewInitializing: false
  })

  if (keepSuppressClick) {
    state.dragSuppressClick = true
    window.setTimeout(() => {
      state.dragSuppressClick = false
    }, 250)
  } else {
    state.dragSuppressClick = false
  }
}

function createBookmarkDragGhost(sourceTile = getActiveDragTile()): void {
  removeBookmarkDragGhost()

  if (!sourceTile) {
    return
  }

  const rect = sourceTile.getBoundingClientRect()
  const ghost = sourceTile.cloneNode(true) as HTMLElement
  ghost.classList.remove('dragging')
  ghost.classList.add('bookmark-drag-ghost')
  ghost.removeAttribute('href')
  ghost.removeAttribute('data-bookmark-id')
  ghost.removeAttribute('data-folder-id')
  ghost.setAttribute('aria-hidden', 'true')
  copyBookmarkDragGhostVariables(sourceTile, ghost)
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  ghost.style.visibility = 'hidden'
  bookmarkDragGhost = ghost
  mountNewTabDragGhostBridge(ghost)
  syncBookmarkDragOffsetToGhostIcon(ghost, rect)
  updateBookmarkDragGhost({ immediate: true })
  ghost.style.visibility = ''
}

function copyBookmarkDragGhostVariables(sourceTile: HTMLElement, ghost: HTMLElement): void {
  const sourceStyles = window.getComputedStyle(sourceTile)
  const inheritedVariableNames = [
    '--icon-shell-size',
    '--icon-title-lines',
    '--bookmark-card-rgb',
    '--bookmark-card-bg-alpha',
    '--bookmark-card-border-alpha',
    '--bookmark-card-hover-alpha'
  ]

  for (const variableName of inheritedVariableNames) {
    const value = sourceStyles.getPropertyValue(variableName).trim()
    if (value) {
      ghost.style.setProperty(variableName, value)
    }
  }
}

function syncBookmarkDragOffsetToGhostIcon(ghost: HTMLElement, sourceRect: DOMRect): void {
  const ghostRect = ghost.getBoundingClientRect()
  const iconRect = ghost.querySelector('.bookmark-icon-shell')?.getBoundingClientRect()
  if (iconRect && ghostRect.width && ghostRect.height) {
    state.dragOffsetX = iconRect.left + iconRect.width / 2 - ghostRect.left
    state.dragOffsetY = iconRect.top + iconRect.height / 2 - ghostRect.top
    return
  }

  state.dragOffsetX = sourceRect.width / 2
  state.dragOffsetY = sourceRect.height / 2
}

function getActiveDragTile(): HTMLElement | null {
  if (!state.draggingBookmarkId) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.bookmark-tile[data-bookmark-id="${CSS.escape(state.draggingBookmarkId)}"]`
  )
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
  if (!bookmarkDragGhost) {
    return
  }

  const left = state.dragClientX - state.dragOffsetX
  const top = state.dragClientY - state.dragOffsetY
  bookmarkDragGhost.style.transform = `translate3d(${left}px, ${top}px, 0)`
}

function removeBookmarkDragGhost(): void {
  window.cancelAnimationFrame(bookmarkDragGhostFrame)
  bookmarkDragGhostFrame = 0
  bookmarkDragGhost?.remove()
  bookmarkDragGhost = null
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
  const grid = getActiveBookmarkGrid()
  if (!grid) {
    return
  }

  for (const tile of grid.querySelectorAll<HTMLElement>(':scope > .bookmark-tile[data-bookmark-id]')) {
    const bookmarkId = String(tile.dataset.bookmarkId || '')
    if (!bookmarkId) {
      continue
    }
    bookmarkDragSlotOrderIds.push(bookmarkId)
    bookmarkDragSlotRects.set(bookmarkId, tile.getBoundingClientRect())
  }
}

function getActiveBookmarkGrid(): HTMLElement | null {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.bookmark-grid[data-bookmark-grid-folder-id="${CSS.escape(section.id)}"]`
  )
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

  const grid = getActiveBookmarkGrid()
  if (!grid) {
    return []
  }

  return Array
    .from(grid.querySelectorAll<HTMLElement>(':scope > .bookmark-tile[data-bookmark-id]'))
    .map((tile) => {
      const rect = tile.getBoundingClientRect()
      return {
        id: String(tile.dataset.bookmarkId || ''),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
    .filter((slot) => slot.id)
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

  const tileByBookmarkId = new Map<string, HTMLElement>()
  for (const tile of grid.querySelectorAll<HTMLElement>(':scope > .bookmark-tile[data-bookmark-id]')) {
    const bookmarkId = String(tile.dataset.bookmarkId || '')
    if (bookmarkId) {
      tileByBookmarkId.set(bookmarkId, tile)
    }
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

  for (const bookmarkId of getPreviewBookmarkOrderIds()) {
    const tile = tileByBookmarkId.get(bookmarkId)
    const originalRect = bookmarkDragSlotRects.get(bookmarkId)
    const targetRect = targetSlotByBookmarkId.get(bookmarkId)
    if (!tile || !originalRect || !targetRect) {
      continue
    }

    const deltaX = targetRect.left - originalRect.left
    const deltaY = targetRect.top - originalRect.top
    const isDraggedTile = bookmarkId === state.draggingBookmarkId
    tile.style.transform = buildBookmarkPreviewTransform(deltaX, deltaY, isDraggedTile)
    tile.style.zIndex = isDraggedTile ? '1' : ''
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
  for (const tile of document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]')) {
    tile.style.transform = ''
    tile.style.zIndex = ''
  }
  bookmarkDragSlotRects = new Map()
  bookmarkDragSlotOrderIds = []
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
    folderId
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
    for (const operation of operations) {
      await moveBookmarkLazy(operation.id, operation.parentId, operation.index)
    }

    if (!syncPersistedBookmarkOrderInState(folderId, operations, finalBookmarkIds)) {
      await refreshNewTab()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '书签排序保存失败，请刷新后重试。'
    await refreshNewTab()
    state.bookmarkReorderError = message
    render()
    updateClockText()
  } finally {
    state.reorderingBookmarks = false
    syncBookmarkReorderBusyState()
  }
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

  const nextBookmarkIds = nextChildren
    .filter((child) => Boolean(child.url))
    .map((child) => String(child.id))
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
  updateClockText()
  return true
}

function syncBookmarkReorderBusyState(): void {
  const busy = state.reorderingBookmarks ? 'true' : 'false'
  document.querySelector<HTMLElement>('.newtab-content')?.setAttribute('aria-busy', busy)
  document.querySelectorAll<HTMLElement>('.bookmark-grid').forEach((grid) => {
    grid.setAttribute('aria-busy', busy)
  })
}

function handleFolderPointerDown(event: PointerEvent): void {
  if (state.draggingBookmarkId || state.dragLongPressTimer) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const target = event.target
  if (!(target instanceof Element) || target.closest('.bookmark-edit-menu')) {
    return
  }

  const folderTarget = target.closest('[data-folder-drag-handle]')
  if (!(folderTarget instanceof HTMLElement)) {
    return
  }

  const folderId = String(folderTarget.dataset.folderDragHandle || '').trim()
  if (!folderId || !state.folderSections.some((section) => section.id === folderId)) {
    return
  }

  cancelFolderDrag({ keepSuppressClick: true })
  state.folderDragPointerId = event.pointerId
  state.draggingFolderId = folderId
  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY
  try {
    folderTarget.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture can fail if the browser has already released this pointer.
  }
  state.folderDragLongPressTimer = window.setTimeout(() => {
    beginFolderDrag()
  }, FOLDER_DRAG_LONG_PRESS_MS)
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
  folderDragSectionRectSnapshot = createFolderDragSectionRectSnapshot(
    Array.from(document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]'))
      .map((section) => {
        const rect = section.getBoundingClientRect()
        return {
          id: String(section.dataset.folderSectionId || ''),
          top: rect.top,
          height: rect.height
        }
      })
  )
  state.folderDragSuppressClick = true
  dispatchNewtabDragUiView({ folderOrderDragging: true })
  const sourceHeader = getActiveFolderDragHeader()
  createFolderDragGhost(sourceHeader)
  sourceHeader?.classList.add('dragging')
}

function handleFolderPointerMove(event: PointerEvent): void {
  if (!state.draggingFolderId || event.pointerId !== state.folderDragPointerId) {
    return
  }

  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY

  if (state.folderDragLongPressTimer) {
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

  const wasDragging = Boolean(state.folderDragOriginalOrderIds.length)
  const finalOrderIds = state.folderSections.map((section) => section.id)
  const originalOrderIds = [...state.folderDragOriginalOrderIds]
  const originalSections = [...state.folderDragOriginalSections]
  clearFolderDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

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
  updateClockText()
}

function clearFolderDragState({ keepSuppressClick = false } = {}): void {
  getActiveFolderDragHeader()?.classList.remove('dragging')
  state.draggingFolderId = ''
  state.folderDragPointerId = 0
  state.folderDragLongPressTimer = 0
  state.folderDragClientX = 0
  state.folderDragClientY = 0
  state.folderDragOffsetX = 0
  state.folderDragOffsetY = 0
  state.folderDragOriginalOrderIds = []
  state.folderDragOriginalSections = []
  folderDragSectionRectSnapshot = null
  removeFolderDragGhost()
  dispatchNewtabDragUiView({ folderOrderDragging: false })

  if (keepSuppressClick) {
    state.folderDragSuppressClick = true
    window.setTimeout(() => {
      state.folderDragSuppressClick = false
    }, 250)
  } else {
    state.folderDragSuppressClick = false
  }
}

function createFolderDragGhost(sourceHeader = getActiveFolderDragHeader()): void {
  removeFolderDragGhost()

  if (!sourceHeader) {
    return
  }

  const rect = sourceHeader.getBoundingClientRect()
  state.folderDragOffsetX = rect.width / 2
  state.folderDragOffsetY = rect.height / 2

  const ghost = sourceHeader.cloneNode(true) as HTMLElement
  ghost.classList.remove('dragging')
  ghost.classList.add('folder-drag-ghost')
  ghost.removeAttribute('data-folder-drag-handle')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  folderDragGhost = ghost
  mountNewTabDragGhostBridge(ghost)
  updateFolderDragGhost({ immediate: true })
}

function getActiveFolderDragHeader(): HTMLElement | null {
  if (!state.draggingFolderId) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.folder-section-header[data-folder-drag-handle="${CSS.escape(state.draggingFolderId)}"]`
  )
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
  if (!folderDragGhost) {
    return
  }

  const left = state.folderDragClientX - state.folderDragOffsetX
  const top = state.folderDragClientY - state.folderDragOffsetY
  folderDragGhost.style.transform = `translate3d(${left}px, ${top}px, 0)`
}

function removeFolderDragGhost(): void {
  window.cancelAnimationFrame(folderDragGhostFrame)
  folderDragGhostFrame = 0
  folderDragGhost?.remove()
  folderDragGhost = null
}

function getFolderSectionRects(): FolderDragSectionRectSnapshot {
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]')
  )
  return createFolderDragSectionRectSnapshotFromElements(sections)
}

function renderWithFolderFlip(): void {
  const previousRects = folderDragSectionRectSnapshot || getFolderSectionRects()
  render()
  updateClockText()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  const currentSnapshot = projectFolderDragSectionRectSnapshot(previousRects, state.folderSections.map((section) => section.id))
  for (const delta of getFolderFlipDeltasFromSnapshots(
    previousRects,
    currentSnapshot,
    state.draggingFolderId
  )) {
    const section = document.querySelector<HTMLElement>(
      `.bookmark-folder-section[data-folder-section-id="${CSS.escape(delta.folderId)}"]`
    )
    section?.animate(
      [
        { transform: `translate3d(0, ${delta.deltaY}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ],
      {
        duration: 180,
        easing: 'cubic-bezier(0.22, 0.72, 0.18, 1)'
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
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function isFolderRelevantToNewTab(folderId: string | null | undefined): boolean {
  const id = String(folderId || '').trim()
  if (!id) {
    return true
  }
  const selectedIds = state.folderSettings?.selectedFolderIds
  if (!selectedIds || !selectedIds.length) {
    return true
  }
  if (!state.folderNodeMap || state.folderNodeMap.size === 0) {
    return true
  }
  const selectedSet = new Set(selectedIds.map((value) => String(value)))
  let current = state.folderNodeMap.get(id) || null
  let guard = 0
  while (current && guard < 256) {
    if (selectedSet.has(String(current.id))) {
      return true
    }
    const parentId = current.parentId ? String(current.parentId) : ''
    if (!parentId) {
      break
    }
    current = state.folderNodeMap.get(parentId) || null
    guard += 1
  }
  return false
}

function handleBookmarkCreated(
  _bookmarkId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  if (state.reorderingBookmarks) {
    return
  }

  const parentId = bookmark && bookmark.parentId ? String(bookmark.parentId) : ''
  const createdBookmark = Boolean(bookmark?.url)
  const parentRelevant = !parentId || isFolderRelevantToNewTab(parentId)
  if (!parentRelevant) {
    return
  }

  const insertedLocally = createdBookmark ? insertBookmarkInPlace(bookmark) : false
  const result = getBookmarkCreationIncrementalResult({
    createdBookmark,
    parentRelevant,
    insertedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function handleBookmarkChanged(bookmarkId: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo): void {
  if (state.reorderingBookmarks) {
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
  if (!targetSection || !parentNode) {
    return false
  }

  const existingChildren = Array.isArray(parentNode.children) ? parentNode.children : []
  if (!existingChildren.some((child) => String(child.id) === bookmarkId)) {
    const nextChildren = [...existingChildren]
    const insertIndex = typeof bookmark.index === 'number'
      ? Math.max(0, Math.min(bookmark.index, nextChildren.length))
      : nextChildren.length
    nextChildren.splice(insertIndex, 0, bookmark)
    parentNode.children = nextChildren
  }

  state.folderSections = state.folderSections.map((section) => {
    if (section.id !== parentId) {
      return section
    }

    const nextBookmarks = section.bookmarks.some((item) => String(item.id) === bookmarkId)
      ? section.bookmarks
      : insertBookmarkByIndex(section.bookmarks, bookmark)
    return {
      ...section,
      bookmarks: nextBookmarks,
      directBookmarkCount: nextBookmarks.length,
      totalBookmarkCount: Math.max(section.totalBookmarkCount + 1, nextBookmarks.length)
    }
  })
  state.bookmarks = getAllSectionBookmarks()
  state.bookmarkMap = new Map(state.bookmarks.map((item) => [String(item.id), item]))
  state.allBookmarks = buildAllBookmarks(state.rootNode)
  state.allBookmarkMap = new Map(state.allBookmarks.map((item) => [String(item.id), item]))
  invalidateQuickAccessCache()
  markSearchIndexDirty({ schedule: true })
  renderBookmarkSections()
  return true
}

function insertBookmarkByIndex(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  bookmark: chrome.bookmarks.BookmarkTreeNode
): chrome.bookmarks.BookmarkTreeNode[] {
  const nextBookmarks = bookmarks.filter((item) => String(item.id) !== String(bookmark.id))
  const insertIndex = typeof bookmark.index === 'number'
    ? Math.max(0, Math.min(bookmark.index, nextBookmarks.length))
    : nextBookmarks.length
  nextBookmarks.splice(insertIndex, 0, bookmark)
  return nextBookmarks
}

function patchBookmarkInPlace(
  bookmarkId: string,
  changeInfo: chrome.bookmarks.BookmarkChangeInfo
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

  let updatedTiles = 0
  const tiles = document.querySelectorAll<HTMLAnchorElement>(
    `.bookmark-tile[data-bookmark-id="${CSS.escape(bookmarkId)}"]`
  )
  tiles.forEach((tile) => {
    const folderId = String(tile.dataset.folderId || node.parentId || '').trim()
    renderBookmarkTileIslandElement(tile, createBookmarkTileViewModel(node, folderId))
    if (!state.customIcons[bookmarkId]) {
      applyCachedFaviconAccent(tile, bookmarkId, String(node.url || ''))
    }
    updatedTiles += 1
  })

  const speedDialCards = document.querySelectorAll<HTMLAnchorElement>(
    `.newtab-speed-dial-card[data-speed-dial-bookmark-id="${CSS.escape(bookmarkId)}"]`
  )
  const updatedSpeedDial = speedDialCards.length > 0
  if (updatedSpeedDial) {
    refreshSpeedDialPanel()
  }

  invalidateQuickAccessCache()
  return updatedTiles > 0 || updatedSpeedDial
}

function invalidateQuickAccessCache(): void {
  quickAccessViewModelCache = null
}

function handleBookmarkRemoved(bookmarkId: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo): void {
  if (state.reorderingBookmarks) {
    return
  }

  const removedBookmark = Boolean(removeInfo.node?.url)
  if (!removedBookmark) {
    scheduleBookmarkChangeRefresh()
    return
  }

  const removedLocally = removeBookmarkTilesInPlace(String(bookmarkId || ''))
  const result = getBookmarkRemovalIncrementalResult({
    removedBookmark,
    removedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function removeBookmarkTilesInPlace(bookmarkId: string): boolean {
  if (!bookmarkId) {
    return false
  }

  let removedAny = false
  document.querySelectorAll<HTMLElement>(
    `.bookmark-tile[data-bookmark-id="${CSS.escape(bookmarkId)}"]`
  ).forEach((tile) => {
    tile.remove()
    removedAny = true
  })
  document.querySelectorAll<HTMLElement>(
    `.newtab-speed-dial-card[data-speed-dial-bookmark-id="${CSS.escape(bookmarkId)}"]`
  ).forEach((card) => {
    card.remove()
    removedAny = true
  })

  forgetBookmarkFromLocalMaps(bookmarkId)

  if (removedAny) {
    invalidateQuickAccessCache()
    markSearchIndexDirty({ schedule: true })
    renderBookmarkSections()
    postDashboardSpeedDialState()
  }
  return removedAny
}

function forgetBookmarkFromLocalMaps(bookmarkId: string): void {
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
}

function handleBookmarkMoved(
  bookmarkId: string,
  moveInfo?: chrome.bookmarks.BookmarkMoveInfo
): void {
  if (isSelfBookmarkMoveEvent(bookmarkId)) {
    return
  }

  const newParentRelevant = moveInfo
    ? isFolderRelevantToNewTab(moveInfo.parentId)
    : true
  const oldParentRelevant = moveInfo
    ? isFolderRelevantToNewTab(moveInfo.oldParentId)
    : true
  if (moveInfo && !newParentRelevant && !oldParentRelevant) {
    return
  }

  const movedLocally = moveInfo
    ? moveBookmarkInPlace(String(bookmarkId || ''), moveInfo, {
        oldParentRelevant,
        newParentRelevant
      })
    : false
  const result = getBookmarkMoveIncrementalResult({
    movedBookmark: Boolean(getBookmarkById(bookmarkId)?.url),
    oldParentRelevant,
    newParentRelevant,
    movedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function moveBookmarkInPlace(
  bookmarkId: string,
  moveInfo: chrome.bookmarks.BookmarkMoveInfo,
  relevance: {
    oldParentRelevant: boolean
    newParentRelevant: boolean
  }
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
    (relevance.oldParentRelevant && !oldSection) ||
    (relevance.newParentRelevant && !newSection)
  ) {
    return false
  }
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

  const nextBookmark: chrome.bookmarks.BookmarkTreeNode = {
    ...movedNode,
    parentId: newParentId
  }
  if (typeof moveInfo.index === 'number') {
    nextBookmark.index = moveInfo.index
  }

  insertBookmarkIntoParentNode(newParentNode, nextBookmark, moveInfo.index)

  let sectionChanged = false
  state.folderSections = state.folderSections.map((section) => {
    if (section.id !== oldParentId && section.id !== newParentId) {
      return section
    }

    let nextBookmarks = section.bookmarks
    if (section.id === oldParentId) {
      nextBookmarks = nextBookmarks.filter((bookmark) => String(bookmark.id) !== normalizedBookmarkId)
    }
    if (section.id === newParentId) {
      nextBookmarks = insertBookmarkByIndex(nextBookmarks, nextBookmark)
    }

    if (nextBookmarks === section.bookmarks) {
      return section
    }

    sectionChanged = true
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
  invalidateQuickAccessCache()
  markSearchIndexDirty({ schedule: true })
  renderBookmarkSections()
  if (isBookmarkPinnedInSpeedDial(getActiveWorkspacePinnedIds(), normalizedBookmarkId)) {
    postDashboardSpeedDialState()
  }
  return sectionChanged
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
  bookmarkChangeRefreshQueued = true
  if (bookmarkChangeRefreshTimer || bookmarkChangeRefreshInFlight) {
    return
  }

  bookmarkChangeRefreshTimer = window.setTimeout(() => {
    bookmarkChangeRefreshTimer = 0
    void flushBookmarkChangeRefresh()
  }, BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS)
}

async function flushBookmarkChangeRefresh(): Promise<void> {
  if (bookmarkChangeRefreshInFlight || !bookmarkChangeRefreshQueued) {
    return
  }

  bookmarkChangeRefreshQueued = false
  bookmarkChangeRefreshInFlight = true
  try {
    await refreshNewTab()
  } finally {
    bookmarkChangeRefreshInFlight = false
    if (bookmarkChangeRefreshQueued) {
      scheduleBookmarkChangeRefresh()
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
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id)
  const workspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const pinned = isBookmarkPinnedInSpeedDial(workspace.pinnedIds, bookmarkId)
  state.workspaceSettings = toggleNewTabWorkspacePin(
    state.workspaceSettings,
    workspace.id,
    bookmarkId,
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )

  try {
    state.pendingDeleteBookmarkId = ''
    await saveNewTabWorkspaceSettings()
    const copy = getSpeedDialPinActionCopyLocal(pinned)
    state.menuError = ''
    state.menuStatus = copy.status
    scheduleRender({ updateClock: true })
    updateClockText()
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  } catch (error) {
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '固定状态保存失败，请稍后重试。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  }
}

async function saveBookmarkMenuChanges(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  try {
    const previousUrl = String(bookmark.url || '').trim()
    const title = state.editTitle.trim() || state.editUrl.trim()
    const url = normalizeBookmarkInputUrl(state.editUrl)
    state.pendingDeleteBookmarkId = ''
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu()

    await updateBookmarkLazy(bookmark.id, { title, url })
    await persistCustomIconChoice(bookmark.id)
    if (previousUrl !== url) {
      await deleteFaviconAccentCacheEntry(bookmark.id)
      state.faviconRefreshTokens.set(bookmark.id, Date.now())
    }
    closeBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '保存失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

async function copyActiveMenuBookmarkUrl(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  try {
    state.pendingDeleteBookmarkId = ''
    await writeClipboardText(bookmark.url)
    state.menuError = ''
    state.menuStatus = '链接已复制'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  } catch (error) {
    state.menuStatus = ''
    state.menuError = error instanceof Error ? `复制失败：${error.message}` : '复制失败，请手动复制链接。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  }
}

function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('浏览器拒绝写入剪贴板。')
    }
    return Promise.resolve()
  } catch (error) {
    return Promise.reject(error)
  } finally {
    textarea.remove()
  }
}

async function deleteActiveMenuBookmark(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id || '')
  if (state.pendingDeleteBookmarkId !== bookmarkId) {
    state.pendingDeleteBookmarkId = bookmarkId
    state.menuError = ''
    state.menuStatus = getDeleteBookmarkConfirmationText(bookmark)
    renderBookmarkMenu({ focusFirst: false, focusAction: 'delete-bookmark' })
    return
  }

  try {
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = `正在删除 1 个书签：「${getBookmarkDisplayTitle(bookmark)}」...`
    renderBookmarkMenu({ focusFirst: false, focusAction: 'delete-bookmark' })

    const recycleId = `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    await deleteBookmarkToRecycleLazy(bookmark.id, {
      recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title || '未命名书签',
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: getBookmarkFolderPath(bookmark) || DEFAULT_NEW_TAB_FOLDER_TITLE,
      source: '新标签页删除',
      deletedAt: Date.now()
    })
    const deletedCustomIcon = state.customIcons[bookmark.id]
    if (deletedCustomIcon) {
      const nextIcons = { ...state.customIcons }
      delete nextIcons[bookmark.id]
      await saveCustomIcons(nextIcons).catch((error) => {
        console.warn('新标签页自定义图标清理失败。', error)
      })
    }
    await deleteFaviconAccentCacheEntry(bookmark.id).catch((error) => {
      console.warn('新标签页网站图标色彩缓存清理失败。', error)
    })
    await removeBookmarkFromActivity(bookmark.id).catch((error) => {
      console.warn('新标签页打开记录清理失败。', error)
    })
    await removeBookmarkFromWorkspacePins(bookmark.id).catch((error) => {
      console.warn('新标签页 workspace 固定入口清理失败。', error)
    })

    state.pendingDeleteBookmarkId = ''
    state.lastDeletedBookmark = {
      bookmark,
      recycleId,
      deletedAt: Date.now(),
      customIcon: deletedCustomIcon
    }
    state.deleteToastStatus = ''
    closeBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.pendingDeleteBookmarkId = ''
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '删除失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

function getDeleteBookmarkConfirmationText(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const title = getBookmarkDisplayTitle(bookmark)
  const folderPath = getBookmarkFolderPath(bookmark) || DEFAULT_NEW_TAB_FOLDER_TITLE
  return `再点一次“确认删除 1 个”会从 Chrome 书签中删除「${title}」，位置：${folderPath}。删除记录会进入回收站，可从回收站恢复。`
}

async function undoLastDeletedBookmark(): Promise<void> {
  const deleted = state.lastDeletedBookmark
  if (!deleted || state.deleteToastBusy) {
    return
  }

  state.deleteToastBusy = true
  state.deleteToastStatus = '正在恢复...'
  renderDeleteToast()

  try {
    const bookmark = deleted.bookmark
    const parentId = await getRestorableParentId(bookmark.parentId)
    const createdBookmark = await createBookmarkLazy({
      parentId,
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : undefined,
      title: bookmark.title || '未命名书签',
      url: bookmark.url
    })
    await removeRecycleEntryLazy(deleted.recycleId).catch((error) => {
      console.warn('新标签页撤销删除时清理回收站记录失败。', error)
    })
    if (deleted.customIcon) {
      await saveCustomIcons({
        ...state.customIcons,
        [String(createdBookmark.id)]: deleted.customIcon
      }).catch((error) => {
        console.warn('新标签页撤销删除时恢复自定义图标失败。', error)
      })
    }

    state.lastDeletedBookmark = null
    state.deleteToastBusy = false
    state.deleteToastStatus = ''
    await refreshNewTab()
    renderDeleteToast()
  } catch (error) {
    state.deleteToastBusy = false
    state.deleteToastStatus = error instanceof Error ? error.message : '恢复失败，请打开回收站处理。'
    renderDeleteToast()
  }
}

async function getRestorableParentId(parentId: string | undefined): Promise<string> {
  try {
    const rootNode = (await getBookmarkTree())[0] || null
    const bookmarksBar = findBookmarksBar(rootNode)
    return resolveRestorableBookmarkParentId(parentId, rootNode, bookmarksBar?.id || BOOKMARKS_BAR_ID)
  } catch {
    return BOOKMARKS_BAR_ID
  }
}

function openRecycleBin(): void {
  const url = chrome.runtime.getURL('src/options/options.html#recycle')
  void chrome.tabs?.create?.({ url })
  state.lastDeletedBookmark = null
  state.deleteToastStatus = ''
  renderDeleteToast()
}

function openOptionsHash(hash: string): void {
  const normalizedHash = String(hash || '').startsWith('#') ? String(hash) : `#${String(hash || '').trim()}`
  const url = chrome.runtime.getURL(`src/options/options.html${normalizedHash}`)
  void chrome.tabs?.create?.({ url })
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

  state.pendingDeleteBookmarkId = ''
  state.faviconRefreshTokens.set(bookmark.id, Date.now())
  void deleteFaviconAccentCacheEntry(bookmark.id).catch((error) => {
    console.warn('新标签页网站图标色彩缓存刷新失败。', error)
  })
  if (!renderBookmarkSections()) {
    render()
  }
  scheduleAdaptiveNewTabLayoutUpdate()
  updateClockText()
  renderBookmarkMenu({ focusFirst: false, focusAction: 'refresh-icon' })
}

function expandAddBookmarkMenu(): void {
  state.addMenuExpanded = true
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

async function saveAddedBookmark(): Promise<void> {
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
    closeAddBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.addMenuBusy = false
    state.addMenuError =
      error instanceof Error ? error.message : '添加失败，请稍后重试。'
    renderAddBookmarkMenu({ focusFirst: false })
  }
}

async function refreshNewTab(): Promise<void> {
  const refreshVersion = ++newTabRefreshVersion
  const backgroundMutationVersionAtStart = backgroundSettingsMutationVersion
  state.loading = true
  state.error = ''
  state.bookmarkReorderError = ''
  clearFolderReorderStatus()
  resetSearchIndexReadyState()
  render()

  try {
    void backgroundPreloadPromise
    const [tree, stored] = await Promise.all([
      getBookmarkTree(),
      getLocalStorage([
        STORAGE_KEYS.newTabCustomIcons,
        STORAGE_KEYS.newTabFeaturedBackgroundGallery,
        STORAGE_KEYS.newTabFeaturedBackgroundFavorites,
        STORAGE_KEYS.newTabFeaturedBackgroundPreferences,
        STORAGE_KEYS.newTabSearchSettings,
        STORAGE_KEYS.newTabIconSettings,
        STORAGE_KEYS.newTabFaviconAccentCache,
        STORAGE_KEYS.newTabGeneralSettings,
        STORAGE_KEYS.newTabFolderSettings,
        STORAGE_KEYS.newTabTimeSettings,
        STORAGE_KEYS.newTabWorkspaceSettings,
        STORAGE_KEYS.newTabModuleSettings,
        STORAGE_KEYS.onboardingState
      ])
    ])
    perfMark('newtab.storageLoaded')
    const rootNode = tree[0] || null
    state.rootNode = rootNode
    state.bookmarkCatalog = null
    state.bookmarkTagIndex = null
    state.searchSnapshotIndex = null
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
    state.customIcons = normalizeCustomIcons(stored[STORAGE_KEYS.newTabCustomIcons])
    const featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences(
      stored[STORAGE_KEYS.newTabFeaturedBackgroundPreferences]
    )
    state.featuredBackgroundGallery = normalizeFeaturedBackgroundGallery(stored[STORAGE_KEYS.newTabFeaturedBackgroundGallery])
    state.featuredBackgroundFavoriteIds = normalizeFeaturedBackgroundFavoriteIds(stored[STORAGE_KEYS.newTabFeaturedBackgroundFavorites])
    state.featuredBackgroundGalleryHydrated = true
    state.featuredBackgroundPreferences = featuredBackgroundPreferences
    state.faviconAccentCache = normalizeFaviconAccentCache(stored[STORAGE_KEYS.newTabFaviconAccentCache])
    state.activity = normalizeNewTabActivity(null, state.allBookmarks)
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings], {
      validBookmarkIds: state.allBookmarkMap.keys()
    })
    state.moduleSettings = normalizeNewTabModuleSettings(stored[STORAGE_KEYS.newTabModuleSettings])
    if (backgroundMutationVersionAtStart === backgroundSettingsMutationVersion) {
      state.backgroundSettings = preloadedBackgroundSettings || state.backgroundSettings
    }
    migrateStoredFeaturedBackgroundId()
    state.searchSettings = normalizeSearchSettings(stored[STORAGE_KEYS.newTabSearchSettings])
    state.iconSettings = normalizeIconSettings(stored[STORAGE_KEYS.newTabIconSettings])
    state.generalSettings = normalizeGeneralSettings(stored[STORAGE_KEYS.newTabGeneralSettings])
    state.timeSettings = normalizeTimeSettingsLocal(stored[STORAGE_KEYS.newTabTimeSettings])
    onboardingCompleted = normalizeNewTabOnboardingCompleted(stored[STORAGE_KEYS.onboardingState])
  } catch (error) {
    state.error = error instanceof Error ? error.message : '新标签页加载失败，请刷新后重试。'
    resolveSearchIndexReady()
  } finally {
    state.loading = false
    render()
    renderDeleteToast()
    const skipBackgroundUiSync = backgroundUiAppliedFromPreload
    backgroundUiAppliedFromPreload = false
    if (!skipBackgroundUiSync) {
      scheduleFeaturedBackgroundDailyRefresh()
    }
    if (!skipBackgroundUiSync) {
      void applyBackgroundSettings()
    }
    applyGeneralSettings()
    applyFolderSettings()
    if (!skipBackgroundUiSync) {
      syncBackgroundSettingsControls()
      syncFeaturedBackgroundDisplayPreferenceControls()
    }
    syncSearchSettingsControls()
    syncIconSettingsControls()
    syncGeneralSettingsControls()
    syncFolderSettingsControls()
    syncNewTabModernSettingsControls()
    syncTimeSettingsControls()
    updateClockText()
    scheduleClockTick()
    runIdle(() => {
      void hydrateNewTabSearchAndTags(refreshVersion)
    })
    runIdle(() => {
      void refreshNewTabNaturalSearchAiConfiguredState().then(() => {
        if (!state.searchSettings.naturalSearchAiConfigured && state.searchSettings.naturalSearchEnabled) {
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
  try {
    const [tagIndex, snapshotIndex, activity] = await Promise.all([
      loadNewTabBookmarkTagIndexLazy(),
      loadNewTabContentSnapshotIndexLazy(),
      loadNewTabActivityLazy()
    ])
    if (refreshVersion !== newTabRefreshVersion) {
      return
    }

    state.bookmarkTagIndex = normalizeNewTabBookmarkTagIndex(tagIndex)
    state.searchSnapshotIndex = normalizeNewTabContentSnapshotIndex(snapshotIndex)
    state.activity = activity
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(state.workspaceSettings, {
      validBookmarkIds: state.allBookmarkMap.keys(),
      legacyPinnedIds: state.activity.pinnedIds
    })
    scheduleNewTabSearchIndexRebuild()
    render()
  } catch (error) {
    console.warn('新标签页 idle 数据加载失败。', error)
    scheduleNewTabSearchIndexRebuild()
    resolveSearchIndexReady()
  }
}

async function loadNewTabBookmarkTagIndexLazy(): Promise<BookmarkTagIndex | null> {
  try {
    const { loadBookmarkTagIndex } = await import('../shared/bookmark-tags.js')
    return await loadBookmarkTagIndex()
  } catch {
    return null
  }
}

async function loadNewTabContentSnapshotIndexLazy(): Promise<ContentSnapshotIndex | null> {
  try {
    const { loadContentSnapshotIndex } = await import('../shared/content-snapshots.js')
    return await loadContentSnapshotIndex()
  } catch {
    return null
  }
}

async function loadNewTabActivityLazy(): Promise<NewTabActivityState> {
  try {
    const activityRepository = await loadNewTabActivityRepositoryLazy()
    return activityRepository.loadNewTabActivityFromRepository(normalizeNewTabActivityForCurrentBookmarks)
  } catch {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabActivity]).catch(() => ({}))
    return normalizeNewTabActivity(stored[STORAGE_KEYS.newTabActivity], state.allBookmarks)
  }
}

async function preloadBackgroundSettings(): Promise<typeof DEFAULT_BACKGROUND_SETTINGS | null> {
  const backgroundMutationVersionAtStart = backgroundSettingsMutationVersion
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabBackgroundSettings])
    const nextSettings = normalizeBackgroundSettings(stored[STORAGE_KEYS.newTabBackgroundSettings])
    if (backgroundMutationVersionAtStart === backgroundSettingsMutationVersion) {
      state.backgroundSettings = nextSettings
      preloadedBackgroundSettings = nextSettings
      setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(state.backgroundSettings))
      syncInstantWallpaperTargetForSettings(nextSettings)
      scheduleCurrentBackgroundStartupCache(nextSettings, { delay: 0 })
      syncBackgroundSettingsControls()
      syncFeaturedBackgroundDisplayPreferenceControls()
      scheduleFeaturedBackgroundDailyRefresh()
      void applyBackgroundSettings()
      backgroundUiAppliedFromPreload = true
    }
    return nextSettings
  } catch (error) {
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
  if (!root) {
    return
  }

  const contentState = resolveNewTabContentState({
    loading: state.loading,
    error: state.error,
    selectedFolderCount: state.folderSettings.selectedFolderIds.length,
    visibleFolderCount: state.folderSections.length
  })
  const contentSignature = getContentStateSignature(contentState)
  const shellSignature = getNewTabShellSignature()

  if (
    contentState.type === 'bookmarks' &&
    lastRenderedContentSignature === 'bookmarks' &&
    lastRenderedShellSignature === shellSignature &&
    renderBookmarkSections()
  ) {
    scheduleAdaptiveNewTabLayoutUpdate()
    recordNewTabFirstBookmarksRendered()
    return
  }

  bookmarkTileRenderVersion += 1
  disconnectBookmarkLazyExpansionObserver()
  cancelScheduledAdaptiveNewTabLayoutUpdate()
  dispatchNewtabContentView(createContentStateView(contentState))
  lastRenderedContentSignature = contentSignature
  lastRenderedShellSignature = shellSignature
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
  const content = root?.querySelector<HTMLElement>('.newtab-content')
  if (!content) {
    return false
  }

  bookmarkTileRenderVersion += 1
  disconnectBookmarkLazyExpansionObserver()
  const nextContent = createBookmarkSections(state.folderSections)
  replaceBookmarkContentIslandChildren(content, nextContent)
  return true
}

function getBookmarkLazyExpansionObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') {
    return null
  }

  if (!bookmarkLazyExpansionObserver) {
    bookmarkLazyExpansionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }

        const placeholder = entry.target
        if (placeholder instanceof HTMLElement) {
          expandBookmarkSectionPlaceholder(placeholder)
        }
      }
    }, { rootMargin: '360px 0px' })
  }

  return bookmarkLazyExpansionObserver
}

function observeBookmarkSectionPlaceholder(
  placeholder: HTMLElement,
  target: BookmarkLazyExpansionTarget
): void {
  bookmarkLazyExpansionTargets.set(placeholder, target)
  const observer = getBookmarkLazyExpansionObserver()
  if (!observer) {
    runMicroIdle(() => expandBookmarkSectionPlaceholder(placeholder))
    return
  }

  observer.observe(placeholder)
}

function disconnectBookmarkLazyExpansionObserver(): void {
  bookmarkLazyExpansionObserver?.disconnect()
  bookmarkLazyExpansionObserver = null
  bookmarkLazyExpansionTargets = new WeakMap<HTMLElement, BookmarkLazyExpansionTarget>()
}

function expandBookmarkSectionPlaceholder(placeholder: HTMLElement): void {
  const target = bookmarkLazyExpansionTargets.get(placeholder)
  if (!target) {
    return
  }

  bookmarkLazyExpansionTargets.delete(placeholder)
  bookmarkLazyExpansionObserver?.unobserve(placeholder)
  if (target.renderVersion !== bookmarkTileRenderVersion || !placeholder.isConnected) {
    return
  }

  const list = placeholder.closest<HTMLElement>('.bookmark-grid')
  if (!list) {
    placeholder.remove()
    return
  }

  scheduleBookmarkTileChunkRender(
    list,
    target.section,
    target.nextIndex,
    target.renderedBookmarkIndex,
    target.renderVersion,
    placeholder
  )
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
    state.searchSettings.enabled,
    state.searchSettings.webSearchEnabled,
    state.searchSettings.openInNewTab,
    state.searchSettings.engine,
    state.searchSettings.enabledEngines.join(','),
    state.searchSettings.placeholder,
    state.searchSettings.naturalSearchEnabled,
    state.searchSettings.autoVerticalCenter,
    state.searchSettings.width,
    state.searchSettings.height,
    state.searchSettings.offsetY,
    state.searchSettings.background,
    state.timeSettings.enabled,
    state.timeSettings.displayMode,
    state.timeSettings.hour12,
    state.timeSettings.showSeconds,
    state.timeSettings.dateFormat,
    state.timeSettings.clockSize,
    state.timeSettings.density
  ].join('|')
}

let dashboardOverlayReady = false
let dashboardOverlayReadyPromise: Promise<void> | null = null
let resolveDashboardOverlayReady: (() => void) | null = null

function ensureDashboardOverlayReady(): Promise<void> {
  if (dashboardOverlayReady) return Promise.resolve()
  if (!dashboardOverlayReadyPromise) {
    dashboardOverlayReadyPromise = new Promise<void>((resolve) => {
      resolveDashboardOverlayReady = resolve
    })
  }
  return dashboardOverlayReadyPromise
}

function initializeDashboardOverlay(): void {
  if (dashboardOverlayReady) return
  dashboardOverlay = cachedEl('newtab-dashboard-overlay')
  dashboardFrame = cachedEl('newtab-dashboard-frame') as HTMLIFrameElement | null
  if (!dashboardOverlay || !dashboardFrame) {
    window.requestAnimationFrame(initializeDashboardOverlay)
    return
  }

  dashboardOverlayReady = true
  resolveDashboardOverlayReady?.()
  renderDashboard()
  if (state.dashboardOpen) {
    ensureDashboardFrameLoaded()
  }
}

function syncDashboardRoute(): void {
  const shouldOpen = window.location.hash === '#dashboard'
  if (shouldOpen) {
    void ensureDashboardOverlayReady()
  }
  if (shouldOpen === state.dashboardOpen) {
    if (shouldOpen) {
      resetDashboardFrameReady()
      ensureDashboardFrameLoaded()
    }
    return
  }

  if (shouldOpen) {
    resetDashboardFrameReady()
  }
  state.dashboardOpen = shouldOpen
  renderDashboard()
  if (shouldOpen) {
    closeSettingsDrawer()
  }
}

function openDashboardRoute(): void {
  void ensureDashboardOverlayReady()
  dashboardReturnFocusTarget = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : dashboardTrigger instanceof HTMLElement
      ? dashboardTrigger
      : null

  if (window.location.hash === '#dashboard') {
    if (state.dashboardFrameError) {
      retryDashboardFrame()
    }
    syncDashboardRoute()
    return
  }

  window.location.hash = 'dashboard'
}

function closeDashboardRoute(): void {
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
  if (window.location.hash !== '#dashboard') {
    state.dashboardOpen = false
    renderDashboard()
    restoreDashboardFocus()
    return
  }

  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  syncDashboardRoute()
  restoreDashboardFocus()
}

function ensureDashboardFrameLoaded(): void {
  if (!dashboardFrame) {
    return
  }

  if (state.dashboardFrameLoaded) {
    if (
      state.dashboardOpen &&
      !state.dashboardFrameReady &&
      !state.dashboardFrameError &&
      !dashboardFrameReadyTimeout
    ) {
      scheduleDashboardFrameReadyTimeout()
    }
    if (state.dashboardOpen && !state.dashboardFrameReady && !state.dashboardFrameError) {
      postDashboardOpenMessage()
    }
    return
  }

  state.dashboardFrameReady = false
  state.dashboardFrameError = ''
  dashboardFrame.src = chrome.runtime.getURL('src/options/options.html?embed=newtab-dashboard#dashboard')
  state.dashboardFrameLoaded = true
  scheduleDashboardFrameReadyTimeout()
}

function resetDashboardFrameReady(): void {
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
  state.dashboardFrameReady = false
  state.dashboardFrameError = ''
}

function retryDashboardFrame(): void {
  if (!dashboardFrame) {
    setDashboardFrameError('书签仪表盘加载失败。请返回新标签页后再试。')
    return
  }

  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
  state.dashboardFrameLoaded = false
  state.dashboardFrameReady = false
  state.dashboardFrameError = ''
  dashboardFrame.removeAttribute('src')
  renderDashboard()
}

function scheduleDashboardFrameReadyTimeout(): void {
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = window.setTimeout(() => {
    if (!state.dashboardOpen || state.dashboardFrameReady) {
      return
    }

    setDashboardFrameError('书签仪表盘加载耗时过长。你可以返回新标签页，或重试打开仪表盘。')
  }, DASHBOARD_FRAME_READY_TIMEOUT_MS)
}

function setDashboardFrameError(message: string): void {
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
  state.dashboardFrameReady = false
  state.dashboardFrameError = message
  renderDashboard()
}

function renderDashboard(): void {
  if (!dashboardOverlay) {
    dispatchNewtabDashboardOverlayControls({
      errorMessage: state.dashboardFrameError,
      open: state.dashboardOpen,
      ready: state.dashboardFrameReady && !state.dashboardFrameError
    })
    return
  }

  const hasDashboardError = Boolean(state.dashboardFrameError)
  dispatchNewtabDashboardOverlayControls({
    errorMessage: state.dashboardFrameError,
    open: state.dashboardOpen,
    ready: state.dashboardFrameReady && !hasDashboardError
  })

  if (state.dashboardOpen) {
    ensureDashboardFrameLoaded()
    focusDashboardOverlay()
  }
}

function postDashboardOpenMessage(): void {
  if (!dashboardFrame || !state.dashboardOpen || !state.dashboardFrameLoaded) {
    return
  }

  dashboardFrame.contentWindow?.postMessage(
    { type: NEWTAB_DASHBOARD_OPEN_MESSAGE_TYPE },
    window.location.origin
  )
}

function focusDashboardOverlay(): void {
  window.setTimeout(() => {
    if (!state.dashboardOpen) {
      return
    }

    if (state.dashboardFrameReady && dashboardFrame) {
      dashboardFrame.focus()
      return
    }

    dashboardOverlay?.focus()
  }, 0)
}

function restoreDashboardFocus(): void {
  const focusTarget = dashboardReturnFocusTarget?.isConnected
    ? dashboardReturnFocusTarget
    : dashboardTrigger instanceof HTMLElement
      ? dashboardTrigger
      : null
  dashboardReturnFocusTarget = null
  focusTarget?.focus()
}

function handleDashboardMessage(event: MessageEvent): void {
  if (!dashboardFrame || event.source !== dashboardFrame.contentWindow) {
    return
  }

  if (event.origin !== window.location.origin) {
    return
  }

  if (event.data?.type === 'curator:newtab-dashboard-close') {
    closeDashboardRoute()
    return
  }

  if (event.data?.type === 'curator:newtab-dashboard-ready') {
    window.clearTimeout(dashboardFrameReadyTimeout)
    dashboardFrameReadyTimeout = 0
    state.dashboardFrameError = ''
    state.dashboardFrameReady = true
    postDashboardSpeedDialState()
    renderDashboard()
    return
  }

  if (event.data?.type === NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE) {
    const bookmarkId = String(event.data?.bookmarkId || '').trim()
    void toggleDashboardBookmarkSpeedDial(bookmarkId)
  }
}

function postDashboardSpeedDialState(): void {
  if (!dashboardFrame || !state.dashboardFrameReady || !state.dashboardOpen) {
    return
  }

  dashboardFrame.contentWindow?.postMessage({
    type: NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE,
    pinnedIds: getActiveWorkspacePinnedIds()
  }, window.location.origin)
}

async function toggleDashboardBookmarkSpeedDial(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  const bookmark = normalizedId ? getBookmarkById(normalizedId) : null
  if (!bookmark?.url) {
    return
  }

  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  state.workspaceSettings = toggleNewTabWorkspacePin(
    state.workspaceSettings,
    activeWorkspace.id,
    normalizedId,
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )

  try {
    await saveNewTabWorkspaceSettings()
    render()
    postDashboardSpeedDialState()
    updateClockText()
  } catch (error) {
    console.warn('从书签仪表盘切换 Speed Dial 固定状态失败。', error)
  }
}

function renderDeleteToast(): void {
  const deleted = state.lastDeletedBookmark
  if (!deleted) {
    dispatchNewtabDeleteToastView(null)
    return
  }
  const bookmarkLabel = getBookmarkActionLabelContext(deleted.bookmark)
  dispatchNewtabDeleteToastView({
    bookmarkLabel,
    busy: state.deleteToastBusy,
    detail: state.deleteToastStatus || getBookmarkDisplayTitle(deleted.bookmark)
  })
}

function scheduleRender({ updateClock = false } = {}): void {
  deferredRenderClockUpdate = deferredRenderClockUpdate || updateClock
  if (deferredRenderFrame) {
    return
  }

  deferredRenderFrame = window.requestAnimationFrame(() => {
    deferredRenderFrame = 0
    const shouldUpdateClock = deferredRenderClockUpdate
    deferredRenderClockUpdate = false
    render()
    if (shouldUpdateClock) {
      updateClockText()
    }
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

function runBatchedAdaptiveLayoutUpdate(): void {
  const page = root?.querySelector<HTMLElement>('.newtab-page')
  const slot = page?.querySelector<HTMLElement>('.newtab-search-slot')
  if (!page || !slot) {
    state.searchOffsetBounds = { ...SEARCH_OFFSET_BOUNDS_FALLBACK }
    state.searchWidthBounds = { ...SEARCH_WIDTH_BOUNDS_FALLBACK }
    syncSearchWidthControl()
    syncSearchOffsetControl()
    return
  }

  const previousModule = slot.previousElementSibling instanceof HTMLElement
    ? slot.previousElementSibling
    : null
  const iconVerticalCenter = page.dataset.iconVerticalCenter === 'true'
  const primaryContent = iconVerticalCenter
    ? page.querySelector<HTMLElement>(':scope > .newtab-primary-slot > .newtab-content')
    : null
  const collisionUtilityStack = iconVerticalCenter
    ? page.querySelector<HTMLElement>(':scope > .newtab-utility-stack')
    : null

  const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 1280
  const shellRect = root?.getBoundingClientRect()
  const slotRect = slot.getBoundingClientRect()
  const previousModuleRect = previousModule?.getBoundingClientRect()
  const nextModuleRect = iconVerticalCenter
    ? getSearchAutoVerticalCenterNextModule(page, slot)?.getBoundingClientRect()
    : null
  const primaryContentRect = primaryContent?.getBoundingClientRect()
  const collisionUtilityRect = collisionUtilityStack?.getBoundingClientRect()
  const currentOffsetY = getCurrentSearchOffsetY(slot)

  const viewportTop = shellRect?.top ?? 0
  const viewportBottom = shellRect?.bottom ??
    (document.documentElement.clientHeight || window.innerHeight || 0)
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
    containerWidth: slotRect.width
  })

  let collisionWriteAction: 'apply' | 'remove' | 'noop' = 'noop'
  let collisionOffset = 0
  if (iconVerticalCenter) {
    if (collisionUtilityRect && primaryContentRect) {
      collisionOffset = getVerticalCenterCollisionOffset({
        utilityBottom: collisionUtilityRect.bottom,
        contentTop: primaryContentRect.top
      })
      collisionWriteAction = collisionOffset > 0 ? 'apply' : 'remove'
    } else {
      collisionWriteAction = 'remove'
    }
  }

  state.searchOffsetBounds = bounds
  state.searchWidthBounds = widthBounds
  slot.style.setProperty(
    '--search-width',
    `${clampNumber(state.searchSettings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)}vw`
  )
  if (!state.searchSettings.autoVerticalCenter) {
    slot.style.setProperty(
      '--search-offset-y',
      `${clampNumber(state.searchSettings.offsetY, bounds.min, bounds.max, DEFAULT_SEARCH_SETTINGS.offsetY)}px`
    )
  } else {
    const offsetY = getAutoCenteredSearchOffsetY({
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
    slot.dataset.searchAutoVerticalCenter = 'true'
    slot.style.setProperty('--search-offset-y', `${offsetY}px`)
  }
  if (collisionWriteAction === 'apply') {
    page.style.setProperty('--primary-collision-offset-y', `${collisionOffset}px`)
  } else if (collisionWriteAction === 'remove') {
    page.style.removeProperty('--primary-collision-offset-y')
  }
  syncSearchWidthControl()
  syncSearchOffsetControl()
}

function getCurrentSearchOffsetY(slot: HTMLElement): number {
  const value = Number.parseFloat(slot.style.getPropertyValue('--search-offset-y'))
  if (Number.isFinite(value)) {
    return value
  }
  return state.searchSettings.offsetY
}

function getSearchAutoVerticalCenterNextModule(page: HTMLElement, slot: HTMLElement): HTMLElement | null {
  const nextUtilityModule = slot.nextElementSibling instanceof HTMLElement
    ? slot.nextElementSibling
    : null
  if (nextUtilityModule) {
    return nextUtilityModule
  }

  return page.querySelector<HTMLElement>(':scope > .newtab-primary-slot > :first-child')
}

function createNewTabLayout(primaryContent: HTMLElement | NewTabPageModule): NewTabContentView {
  const modules: NewTabPageModule[] = []

  const onboarding = createNewTabOnboardingStrip()
  if (onboarding) {
    modules.push(onboarding)
  }

  const clock = createClockModule()
  if (clock) {
    modules.push(clock)
  } else {
    modules.push({
      id: 'clock-spacer',
      kind: 'clock-spacer',
      placement: 'utility'
    })
  }

  const search = createSearchWidget()
  if (search) {
    modules.push({
      kind: 'element',
      id: 'search',
      element: search,
      placement: 'utility'
    })
  }

  modules.push(toPrimaryNewTabModule(primaryContent))

  return createNewTabPage({ modules })
}

function toPrimaryNewTabModule(primaryContent: HTMLElement | NewTabPageModule): NewTabPageModule {
  if (!(primaryContent instanceof HTMLElement)) {
    return primaryContent
  }

  return {
    kind: 'element',
    id: primaryContent.classList.contains('newtab-content') ? 'bookmarks' : 'state',
    element: primaryContent,
    placement: 'primary'
  } satisfies NewTabElementModule
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

function createSearchWidget(): HTMLElement | null {
  const settings = state.searchSettings
  if (!settings.enabled) {
    return null
  }
  const webSearchEnabled = settings.webSearchEnabled !== false
  const searchPlaceholder = getSearchPlaceholder(settings)
  let engineMenuExpanded = false

  const slot = createSearchWidgetIslandElement({
    ariaLabel: webSearchEnabled ? '搜索书签、网页或命令' : '搜索书签或命令',
    autoVerticalCenter: settings.autoVerticalCenter,
    backgroundAlpha: String(settings.background / 100),
    engine: getSearchEngineButtonState(),
    height: settings.height,
    inputAriaLabel: webSearchEnabled
      ? '输入关键词搜索书签，未选中书签时按 Enter 搜索网页'
      : '输入关键词搜索本地书签或命令',
    natural: getNaturalSearchButtonState(),
    offsetY: settings.offsetY,
    placeholder: searchPlaceholder,
    width: settings.width
  })
  const input = slot.querySelector<HTMLInputElement>('.newtab-search-input')
  const engineButton = slot.querySelector<HTMLButtonElement>('.newtab-search-engine')
  const suggestions = slot.querySelector<HTMLElement>('#newtab-search-suggestions')
  const suggestionsHeading = slot.querySelector<HTMLElement>('.newtab-search-section-label')
  const suggestionsHint = slot.querySelector<HTMLElement>('.newtab-search-hint')
  const searchChips = slot.querySelector<HTMLElement>('.newtab-search-chips')
  const savedSearches = slot.querySelector<HTMLElement>('.newtab-saved-searches')
  if (
    !input ||
    !engineButton ||
    !suggestions ||
    !suggestionsHeading ||
    !suggestionsHint ||
    !searchChips ||
    !savedSearches
  ) {
    return slot
  }

  const renderSearchWidgetButtons = () => {
    renderSearchWidgetButtonStatesIsland(slot, {
      engine: getSearchEngineButtonState(),
      natural: getNaturalSearchButtonState()
    })
  }
  const updateEngineButton = renderSearchWidgetButtons
  const updateNaturalButton = renderSearchWidgetButtons
  const renderSearchWidgetInteractions = () => {
    renderSearchWidgetInteractionStateIsland(slot, {
      onClear: () => {
        input.value = ''
        syncSearchInputActions(slot, input)
        hideSuggestions()
        input.focus()
      },
      onEngineKeyDown: (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
          return
        }

        event.preventDefault()
        renderEngineMenu(event.key === 'ArrowDown' ? 'first' : 'last')
      },
      onEngineToggle: () => {
        if (state.searchSettings.webSearchEnabled === false) {
          return
        }
        if (engineMenuExpanded) {
          closeEngineMenu()
          return
        }
        renderEngineMenu('active')
      },
      onInputFocus: () => {
        scheduleSuggestionsRender({ immediate: true })
      },
      onInputInput: () => {
        syncSearchInputActions(slot, input)
        scheduleSuggestionsRender()
      },
      onInputKeyDown: (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1)
          return
        }

        if (event.key === 'Enter' && activeSuggestionIndex >= 0 && !event.metaKey && !event.ctrlKey) {
          const suggestion = searchSuggestions[activeSuggestionIndex]
          if (suggestion) {
            event.preventDefault()
            input.value = suggestion.title
            syncSearchInputActions(slot, input)
            hideSuggestions()
            openSearchSuggestion(suggestion)
          }
          return
        }

        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          closeEngineMenu()
          hideSuggestions()
          if (state.searchSettings.webSearchEnabled === false) {
            return
          }
          submitSearch(input.value, true)
          return
        }

        if (event.key !== 'Escape') {
          return
        }

        event.preventDefault()
        if (searchSuggestions.length || searchPanelVisible) {
          hideSuggestions()
          return
        }

        if (input.value) {
          input.value = ''
          syncSearchInputActions(slot, input)
          return
        }

        input.blur()
      },
      onRootBlur: () => {
        window.setTimeout(() => {
          if (!slot.contains(document.activeElement)) {
            closeEngineMenu()
            hideSuggestions()
          }
        }, 0)
      },
      onSubmit: (event) => {
        event.preventDefault()
        closeEngineMenu()
        hideSuggestions()
        if (state.searchSettings.webSearchEnabled === false) {
          return
        }
        submitSearch(input.value)
      },
      onToggleNatural: () => {
        void toggleNewTabNaturalSearch({
          input,
          updateNaturalButton,
          scheduleSuggestionsRender
        })
      }
    })
  }
  let searchEngineMenuState: SearchWidgetEngineMenuState = {
    hint: '',
    items: [],
    open: false
  }
  const renderSearchEngineMenuState = () => {
    renderSearchWidgetEngineMenuStateIsland(slot, searchEngineMenuState)
  }
  let searchComboboxExpanded = false
  let activeSearchDescendantId = ''
  const renderSearchComboboxState = () => {
    renderSearchWidgetComboboxStateIsland(slot, {
      activeDescendantId: activeSearchDescendantId,
      expanded: searchComboboxExpanded
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
  let searchPanelVisible = false
  let searchSuggestionListVisible = true
  const renderSearchWidgetPanelState = () => {
    renderSearchWidgetPanelStateIsland(slot, {
      panelVisible: searchPanelVisible,
      suggestionsVisible: searchSuggestionListVisible
    })
  }
  const hideSearchPanel = () => {
    searchPanelVisible = false
    renderSearchWidgetPanelState()
  }
  const showSearchPanel = () => {
    searchPanelVisible = true
    renderSearchWidgetPanelState()
  }
  const setSearchSuggestionsListVisible = (visible: boolean) => {
    searchSuggestionListVisible = visible
    renderSearchWidgetPanelState()
  }

  const closeEngineMenu = ({ restoreFocus = false } = {}) => {
    searchEngineMenuState = {
      ...searchEngineMenuState,
      open: false
    }
    renderSearchEngineMenuState()
    engineMenuExpanded = false
    updateEngineButton()
    if (restoreFocus) {
      engineButton.focus()
    }
  }

  const getCurrentEngineMenu = () => slot.querySelector<HTMLElement>('.newtab-search-engine-menu')

  const focusEngineMenuItem = (menu: HTMLElement, direction: 1 | -1 | 'first' | 'last') => {
    const items = [...menu.querySelectorAll<HTMLButtonElement>('.newtab-search-engine-item')]
    if (!items.length) {
      return
    }

    const activeElement = document.activeElement
    const currentIndex = items.findIndex((item) => item === activeElement)
    let nextIndex = items.findIndex((item) => item.classList.contains('active'))
    if (direction === 'first') {
      nextIndex = 0
    } else if (direction === 'last') {
      nextIndex = items.length - 1
    } else if (currentIndex >= 0) {
      nextIndex = (currentIndex + direction + items.length) % items.length
    } else if (nextIndex < 0) {
      nextIndex = direction > 0 ? 0 : items.length - 1
    }

    items[Math.max(0, nextIndex)]?.focus()
  }

  const renderEngineMenu = (initialFocus: 'active' | 'first' | 'last' | 'none' = 'none') => {
    closeEngineMenu()
    const items: SearchEngineMenuItemViewModel[] = []
    for (const engineId of state.searchSettings.enabledEngines) {
      const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(engineId)
      if (!engine) {
        continue
      }

      items.push({
        active: engineId === state.searchSettings.engine,
        id: engineId,
        label: engine.name,
        onSelect: () => {
          state.searchSettings = normalizeSearchSettings({
            ...state.searchSettings,
            engine: engineId
          })
          scheduleSearchSettingsSave()
          updateEngineButton()
          closeEngineMenu()
          input.focus()
          scheduleSuggestionsRender({ preserveActive: true, immediate: true })
        }
      })
    }

    const handleEngineMenuKeydown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const menu = getCurrentEngineMenu()
      if (!menu) {
        return
      }
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Home' &&
        event.key !== 'End' &&
        event.key !== 'Escape'
      ) {
        return
      }

      event.preventDefault()
      if (event.key === 'Escape') {
        closeEngineMenu({ restoreFocus: true })
        return
      }

      if (event.key === 'Home') {
        focusEngineMenuItem(menu, 'first')
      } else if (event.key === 'End') {
        focusEngineMenuItem(menu, 'last')
      } else {
        focusEngineMenuItem(menu, event.key === 'ArrowDown' ? 1 : -1)
      }
    }

    searchEngineMenuState = {
      hint: `Cmd/Ctrl+Enter 打开前 ${SEARCH_MULTI_OPEN_LIMIT} 个启用引擎`,
      items,
      onKeyDown: handleEngineMenuKeydown,
      open: true
    }
    renderSearchEngineMenuState()
    engineMenuExpanded = true
    updateEngineButton()

    if (initialFocus !== 'none') {
      const menu = getCurrentEngineMenu()
      if (!menu) {
        return
      }
      focusEngineMenuItem(menu, initialFocus === 'last' ? 'last' : initialFocus === 'first' ? 'first' : 1)
    }
  }

  let searchSuggestions: NewTabSearchSuggestion[] = []
  let activeSuggestionIndex = -1
  let suggestionDebounceTimer = 0
  let suggestionRequestId = 0

  const hideSuggestions = () => {
    window.clearTimeout(suggestionDebounceTimer)
    suggestionDebounceTimer = 0
    searchSuggestions = []
    activeSuggestionIndex = -1
    renderNewTabSearchSuggestionsIsland(suggestions, [])
    renderNewTabSearchChipsIsland(searchChips, [])
    renderNewTabSavedSearchesIsland(savedSearches, {
      canSaveCurrent: false,
      error: '',
      hasCurrentSaved: false,
      items: [],
      onSaveCurrent: () => undefined,
      show: false
    })
    setSearchSuggestionsListVisible(true)
    renderNewTabSearchSectionLabelIsland(suggestionsHeading, '书签匹配')
    renderNewTabSearchHintIsland(suggestionsHint, { type: 'empty' })
    hideSearchPanel()
    closeSearchCombobox()
  }

  const renderSuggestions = (suggestionList: NewTabSearchSuggestion[], {
    preserveActive = false,
    query = input.value
  }: {
    preserveActive?: boolean
    query?: string
  } = {}) => {
    const trimmedQuery = String(query || '').trim()
    const previousActiveIndex = activeSuggestionIndex
    const advancedSearch = isNewTabAdvancedSearchQuery(trimmedQuery)
    renderNewTabSearchChips(searchChips, trimmedQuery)
    renderNewTabSavedSearches(savedSearches, trimmedQuery, input, () => {
      syncSearchInputActions(slot, input)
      scheduleSuggestionsRender({ preserveActive: true, immediate: true })
    })
    searchSuggestions = suggestionList
    if (!searchSuggestions.length) {
      activeSuggestionIndex = -1
      renderNewTabSearchSuggestionsIsland(suggestions, [])
      setSearchSuggestionsListVisible(false)
      setActiveSearchDescendant('')
      if (!trimmedQuery) {
        hideSuggestions()
        return
      }

      if (state.searchSettings.webSearchEnabled === false) {
        renderNewTabSearchSectionLabelIsland(
          suggestionsHeading,
          advancedSearch ? '语法搜索匹配' : '关键词书签匹配'
        )
        renderNewTabSearchHintIsland(suggestionsHint, {
          type: 'text',
          text: '未找到本地书签。网页搜索已关闭，可在设置中重新启用。'
        })
        showSearchPanel()
        openSearchCombobox()
        return
      }

      renderNewTabSearchSectionLabelIsland(suggestionsHeading, '网页搜索')
      renderNewTabSearchHintIsland(suggestionsHint, createSearchWebFallbackState(trimmedQuery))
      showSearchPanel()
      openSearchCombobox()
      return
    }

    setSearchSuggestionsListVisible(true)
    renderNewTabSearchSectionLabelIsland(
      suggestionsHeading,
      searchSuggestions.some(isCommandSuggestion)
        ? '书签与命令'
        : advancedSearch
          ? '语法搜索匹配'
          : '关键词书签匹配'
    )
    activeSuggestionIndex = preserveActive && previousActiveIndex >= 0
      ? Math.min(previousActiveIndex, searchSuggestions.length - 1)
      : -1

    const onSelectSuggestion = (selectedSuggestion: NewTabSearchSuggestion) => {
      input.value = selectedSuggestion.title
      syncSearchInputActions(slot, input)
      hideSuggestions()
      openSearchSuggestion(selectedSuggestion)
    }

    renderNewTabSearchSuggestionsIsland(
      suggestions,
      searchSuggestions.map((suggestion, index) =>
        createSearchSuggestionViewModel(
          suggestion,
          index,
          index === activeSuggestionIndex,
          onSelectSuggestion
        )
      )
    )
    showSearchPanel()
    renderNewTabSearchHintIsland(suggestionsHint, {
      type: 'text',
      text: getSearchSuggestionHintText()
    })
    openSearchCombobox()

    if (activeSuggestionIndex >= 0) {
      setActiveSearchDescendant(getSearchSuggestionElementId(activeSuggestionIndex))
    } else {
      setActiveSearchDescendant('')
    }
  }

  const scheduleSuggestionsRender = ({ preserveActive = false, immediate = false } = {}) => {
    const query = input.value
    const requestId = suggestionRequestId + 1
    suggestionRequestId = requestId
    window.clearTimeout(suggestionDebounceTimer)

    const renderCurrentSuggestions = () => {
      if (!state.searchIndexReady && query.trim()) {
        renderSearchIndexPreparingState(query)
        void state.searchIndexReadyPromise.then(() => {
          if (requestId !== suggestionRequestId || input.value !== query) {
            return
          }

          scheduleSuggestionsRender({ preserveActive, immediate: true })
        })
        return
      }

      void getSearchBookmarkSuggestions(query).then((directSuggestions) => {
        if (requestId !== suggestionRequestId) {
          return
        }

        renderSuggestions(mergeNewTabCommandSuggestions(query, directSuggestions), { preserveActive, query })
        if (!shouldLoadNaturalSearchSuggestions(query, directSuggestions)) {
          return
        }

        void getNaturalSearchBookmarkSuggestions(query, { onPendingChange: updateNaturalButton }).then((naturalSuggestions) => {
          if (requestId !== suggestionRequestId) {
            return
          }

          updateNaturalButton()
          renderSuggestions(mergeNewTabCommandSuggestions(query, naturalSuggestions), { preserveActive: true, query })
        }).catch(() => {
          // Keep the popup-aligned suggestions visible if the optional natural-search chunk fails to load.
        }).finally(() => {
          if (requestId === suggestionRequestId) {
            updateNaturalButton()
          }
        })
      }).catch(() => {
        if (requestId !== suggestionRequestId) {
          return
        }

        renderSuggestions(mergeNewTabCommandSuggestions(query, []), { preserveActive, query })
      })
    }

    if (!query.trim() || immediate) {
      suggestionDebounceTimer = 0
      renderCurrentSuggestions()
      return
    }

    suggestionDebounceTimer = window.setTimeout(() => {
      suggestionDebounceTimer = 0
      if (requestId !== suggestionRequestId) {
        return
      }
      renderCurrentSuggestions()
    }, SEARCH_SUGGESTION_DEBOUNCE_MS)
  }

  const renderSearchIndexPreparingState = (query: string) => {
    const trimmedQuery = String(query || '').trim()
    if (!trimmedQuery) {
      hideSuggestions()
      return
    }

    searchSuggestions = []
    activeSuggestionIndex = -1
    renderNewTabSearchChips(searchChips, trimmedQuery)
    renderNewTabSavedSearches(savedSearches, trimmedQuery, input, () => {
      syncSearchInputActions(slot, input)
      scheduleSuggestionsRender({ preserveActive: true, immediate: true })
    })
    renderNewTabSearchSuggestionsIsland(suggestions, [])
    setSearchSuggestionsListVisible(false)
    renderNewTabSearchSectionLabelIsland(suggestionsHeading, '书签匹配')
    renderNewTabSearchHintIsland(suggestionsHint, {
      type: 'text',
      text: '正在准备索引…'
    })
    showSearchPanel()
    openSearchCombobox()
    setActiveSearchDescendant('')
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
    renderSuggestions(searchSuggestions, { preserveActive: true, query: input.value })
  }

  updateEngineButton()
  updateNaturalButton()
  renderSearchWidgetInteractions()
  renderSearchEngineMenuState()
  renderSearchComboboxState()
  renderSearchWidgetPanelState()
  syncSearchInputActions(slot, input)
  return slot

  function createSearchWebFallbackState(query: string): SearchHintState {
    const label = `未找到书签；按 Enter 仅在本页用 ${getSearchEngineDisplayName()} 搜索网页`
    return {
      type: 'webFallback',
      ariaLabel: label,
      label,
      title: `用 ${getSearchEngineDisplayName()} 搜索「${query}」`,
      onSelect: () => {
        closeEngineMenu()
        hideSuggestions()
        if (state.searchSettings.webSearchEnabled === false) {
          return
        }
        submitSearch(query)
      }
    }
  }

  function getSearchEngineDisplayName(): string {
    return SEARCH_ENGINE_CONFIG_BY_ID.get(state.searchSettings.engine)?.name || 'Google'
  }

  function getSearchEngineButtonState() {
    const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(state.searchSettings.engine)
    const label = engine?.shortName || '搜索'
    const disabled = state.searchSettings.webSearchEnabled === false
    return {
      ariaLabel: `选择搜索引擎，当前为 ${engine?.name || label}`,
      disabled,
      expanded: engineMenuExpanded,
      label,
      title: disabled
        ? '网页搜索已关闭。可在新标签页设置中重新启用。'
        : `当前引擎：${engine?.name || label}。Cmd/Ctrl+Enter 搜索前 ${SEARCH_MULTI_OPEN_LIMIT} 个启用引擎。`
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
          : '需要先配置 AI 渠道'
    }
  }

  function getSearchSuggestionHintText(): string {
    const mode = state.searchSettings.naturalSearchEnabled
      ? 'AI 改写'
      : 'popup 匹配'
    const fallback = state.naturalSearchError ? `；${state.naturalSearchError}` : ''
    return `按 ↓ 选择书签，选中后 Enter 打开；Cmd/Ctrl+Enter 用 ${getSearchEngineDisplayName()} 搜索网页；${mode}${fallback}`
  }
}

function renderNewTabSearchChips(container: HTMLElement, query: string): void {
  const chips: SearchChipViewModel[] = parseSearchQuery(query).chips.map((chip) => ({
    kind: chip.kind,
    label: chip.label
  }))
  renderNewTabSearchChipsIsland(container, chips)
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
  const enabled = !state.searchSettings.naturalSearchEnabled

  if (enabled) {
    await refreshNewTabNaturalSearchAiConfiguredState()
    if (!state.searchSettings.naturalSearchAiConfigured) {
      state.searchSettings = normalizeSearchSettings({
        ...state.searchSettings,
        naturalSearchEnabled: false
      })
      abortNewTabNaturalSearchRequest()
      naturalSearchSuggestionCache.clear()
      state.naturalSearchPlan = null
      state.naturalSearchError = ''
      setSettingsSaveStatus('error', '请配置 AI 渠道。')
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

function renderNewTabSavedSearches(
  container: HTMLElement,
  query: string,
  input: HTMLInputElement,
  onApply: () => void
): void {
  const savedSearches = state.savedSearches
    ? getSavedSearchesForScope(state.savedSearches, 'popup')
    : []
  const normalizedQuery = normalizeNewTabSearchText(query)
  const canSaveCurrent = Boolean(normalizedQuery && isNewTabAdvancedSearchQuery(query))
  const hasCurrentSaved = canSaveCurrent && savedSearches.some((item) => normalizeNewTabSearchText(item.query) === normalizedQuery)
  const show = Boolean(canSaveCurrent || savedSearches.length > 0 || state.savedSearchesError)

  const viewModel: SavedSearchesState = {
    canSaveCurrent,
    error: state.savedSearchesError,
    hasCurrentSaved,
    items: savedSearches.slice(0, 6).map((search) => ({
      id: search.id,
      label: search.name || search.query,
      query: search.query,
      onApply: () => {
        input.value = search.query
        onApply()
        input.focus()
      },
      onDelete: () => deleteNewTabSavedSearch(search.id).then(onApply)
    })),
    onSaveCurrent: () => saveNewTabCurrentSearch(query).then(onApply),
    show
  }
  renderNewTabSavedSearchesIsland(container, viewModel)
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

async function hydrateNewTabSavedSearches(): Promise<void> {
  if (state.savedSearchesLoaded) {
    return
  }

  try {
    state.savedSearches = await loadSavedSearchIndex()
    state.savedSearchesLoaded = true
    state.savedSearchesError = ''
  } catch {
    state.savedSearchesLoaded = true
    state.savedSearchesError = '保存搜索读取失败'
  }
}

async function ensureNewTabSavedSearchIndex(): Promise<SavedSearchIndex> {
  if (state.savedSearches) {
    return state.savedSearches
  }

  state.savedSearches = await loadSavedSearchIndex()
  state.savedSearchesLoaded = true
  return state.savedSearches
}

async function saveNewTabCurrentSearch(query: string): Promise<void> {
  const trimmedQuery = String(query || '').trim()
  if (!trimmedQuery) {
    return
  }

  try {
    const index = await ensureNewTabSavedSearchIndex()
    state.savedSearches = await saveSearch(index, {
      name: createNewTabSavedSearchName(trimmedQuery),
      query: trimmedQuery,
      scope: 'both'
    })
    state.savedSearchesLoaded = true
    state.savedSearchesError = ''
  } catch (error) {
    state.savedSearchesError = error instanceof Error ? error.message : '保存搜索失败'
  }
}

async function deleteNewTabSavedSearch(searchId: string): Promise<void> {
  try {
    const index = await ensureNewTabSavedSearchIndex()
    state.savedSearches = await deleteSavedSearch(index, String(searchId || ''))
    state.savedSearchesLoaded = true
    state.savedSearchesError = ''
  } catch (error) {
    state.savedSearchesError = error instanceof Error ? error.message : '删除保存搜索失败'
  }
}

function createNewTabSavedSearchName(query: string): string {
  const parsed = parseSearchQuery(query)
  const chipLabels = parsed.chips.map((chip) => chip.label.replace(/^[^：]+：/, '')).filter(Boolean)
  const terms = parsed.textTerms.join(' ')
  return truncateNewTabSearchText([...chipLabels, terms].filter(Boolean).join(' · ') || query, 60) || '未命名搜索'
}

function truncateNewTabSearchText(value: unknown, limit = 60): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function syncSearchInputActions(slot: HTMLElement, input: HTMLInputElement): void {
  renderSearchWidgetActionStateIsland(slot, {
    canSubmit: Boolean(input.value.trim()),
    hasInputValue: Boolean(input.value)
  })
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
}

interface NaturalSearchSuggestionOptions {
  onPendingChange?: () => void
}

const searchSuggestionCache = new Map<string, SearchSuggestionCacheEntry>()
const naturalSearchSuggestionCache = new Map<string, SearchSuggestionCacheEntry>()
const NEWTAB_COMMAND_SUGGESTIONS: NewTabCommandSuggestion[] = [
  {
    id: 'open-dashboard',
    title: '打开书签仪表盘',
    subtitle: '管理、搜索和批量整理书签库',
    keywords: ['dashboard', '仪表盘', '管理', '整理', '书签管理', 'dashboard 打开', 'open dashboard'],
    run: openDashboardRoute
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
    title: '打开 Inbox',
    subtitle: '查看待整理收藏和自动分析添加历史',
    keywords: ['inbox', '收件箱', '待整理', '未分类', '临时收藏', '稍后整理'],
    run: () => openOptionsHash('#bookmark-history')
  }
]

function abortNewTabNaturalSearchRequest(): void {
  state.naturalSearchAbortController?.abort()
  state.naturalSearchAbortController = null
  state.naturalSearchPending = false
}

async function refreshNewTabNaturalSearchAiConfiguredState(): Promise<void> {
  try {
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    state.searchSettings = normalizeSearchSettings({
      ...state.searchSettings,
      naturalSearchAiConfigured: naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)
    })
  } catch {
    state.searchSettings = normalizeSearchSettings({
      ...state.searchSettings,
      naturalSearchAiConfigured: false
    })
  }
}

function getSearchBookmarkSuggestions(query: string): Promise<SearchBookmarkSuggestion[]> {
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
  if (!state.searchSettings.naturalSearchEnabled) {
    return Promise.resolve([])
  }

  if (!state.searchIndexReady) {
    return state.searchIndexReadyPromise.then(() => getNaturalSearchBookmarkSuggestions(query, options))
  }

  const cacheKey = getSearchSuggestionCacheKey(query)
  const cached = getSearchSuggestionCacheEntry(naturalSearchSuggestionCache, cacheKey)
  if (cached) {
    if (state.naturalSearchPending) {
      options.onPendingChange?.()
    }
    return cached.promise
  }

  const suggestionsPromise = resolveNewTabNaturalSearchPlan(query, options)
    .then((plan) => getNaturalSearchBookmarkSuggestionsFromIndex(
      query,
      state.preparedSearchIndex,
      SEARCH_SUGGESTION_LIMIT,
      { naturalSearchPlan: plan }
    ))
  setSearchSuggestionCacheEntry(naturalSearchSuggestionCache, cacheKey, suggestionsPromise)
  return suggestionsPromise
}

async function resolveNewTabNaturalSearchPlan(
  query: string,
  options: NaturalSearchSuggestionOptions = {}
): Promise<NaturalSearchPlan> {
  const naturalSearch = await import('../popup/natural-search.js')
  const localPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
  const normalizedQuery = normalizeNewTabSearchText(query)

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

  abortNewTabNaturalSearchRequest()
  const controller = new AbortController()
  state.naturalSearchAbortController = controller
  state.naturalSearchPending = true
  state.naturalSearchError = ''
  options.onPendingChange?.()

  try {
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      state.searchSettings = normalizeSearchSettings({
        ...state.searchSettings,
        naturalSearchEnabled: false,
        naturalSearchAiConfigured: false
      })
      state.naturalSearchError = ''
      state.naturalSearchPlan = null
      setSettingsSaveStatus('error', '请配置 AI 渠道。')
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
    state.naturalSearchPlan = plan
    state.naturalSearchError = ''
    if (plan.source === 'ai') {
      state.naturalSearchPlanCache.set(planCacheKey, plan)
    }
    return plan
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    state.naturalSearchPlan = null
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
    updatedAt: Date.now()
  })
  promise.catch(() => {
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
    fullText: undefined,
    fullTextRef: fullTextStorage === 'idb' ? String(source.fullTextRef || snapshotId || '').trim() : undefined,
    warnings: normalizeNewTabSnapshotTextList(source.warnings, 8)
  }
}

function normalizeNewTabSnapshotText(value: unknown, limit = 500): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeNewTabSnapshotTextList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeNewTabSnapshotText(item, 120)).filter(Boolean).slice(0, limit)
    : []
}

function getSearchSuggestionCacheKey(query: string): string {
  return [
    state.preparedSearchIndex.entries.length,
    state.bookmarkTagIndex?.updatedAt || 0,
    state.searchSnapshotIndex?.updatedAt || 0,
    state.searchSettings.naturalSearchEnabled ? 'ai' : 'local',
    normalizeNewTabSearchText(query)
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
    openSearchTarget(suggestion.url)
    return
  }

  void recordBookmarkOpen(bookmark)
  openSearchTarget(suggestion.url)
}

function createClockModule(): NewTabPageModule | null {
  const settings = state.timeSettings
  if (!settings.enabled) {
    dispatchNewtabClockView(null)
    return null
  }

  dispatchNewtabClockView(createFallbackClockWidgetState(new Date(), settings))
  hydrateClockText()

  return {
    id: 'clock',
    kind: 'clock',
    placement: 'utility'
  }
}

function createBookmarkSections(sections: NewTabFolderSection[]): HTMLElement {
  const gridSettings = {
    ...state.iconSettings,
    columns: getResponsiveIconColumns(state.iconSettings)
  }

  const modules: HTMLElement[] = []
  let speedDial = false
  for (const moduleKey of getVisibleNewTabModules(state.moduleSettings)) {
    const module = createConfigurableNewTabModule(moduleKey)
    if (module === 'speedDial') {
      speedDial = true
    } else if (module) {
      modules.push(module)
    }
  }

  const portal = createPortalPanel()
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
      onOpenFolderSettings: openFolderSourceSettings,
      path: section.path,
      title: section.title
    }

    if (section.bookmarks.length) {
      const startIndex = renderedBookmarkIndex
      sectionModel.grid = {
        ariaLabel: `${section.title || '文件夹'}书签`,
        busy: state.reorderingBookmarks,
        folderId: section.id,
        onMount: (list) => {
          if (!list || list.dataset.bookmarkGridHydrated === 'true') {
            return
          }
          list.dataset.bookmarkGridHydrated = 'true'
          appendBookmarkTilesInChunks(
            list,
            section,
            startIndex,
            bookmarkTileRenderVersion,
            Math.max(0, BOOKMARK_TILE_INITIAL_RENDER_LIMIT - startIndex)
          )
        }
      }
      renderedBookmarkIndex += section.bookmarks.length
    }

    return sectionModel
  })

  const reorderStatusMessage = state.bookmarkReorderError || state.folderReorderStatus
  const viewModel: BookmarkContentViewModel = {
    content: {
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
    },
    modules,
    portal,
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
  return createBookmarkContentIslandElement(viewModel)
}

function createConfigurableNewTabModule(key: NewTabModuleSettingKey): HTMLElement | 'speedDial' | null {
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
        status: '已从 Speed Dial 取消固定',
        ariaLabel: '从 Speed Dial 取消固定书签'
      }
    : {
        label: '固定到 Speed Dial',
        status: '已固定到 Speed Dial',
        ariaLabel: '固定书签到 Speed Dial'
      }
}

function createSpeedDialPanel(): 'speedDial' | null {
  if (!state.moduleSettings.speedDial) {
    dispatchNewtabSpeedDialView(null)
    return null
  }

  dispatchNewtabSpeedDialView({
    ariaBusy: true,
    content: { type: 'loading', label: '载入固定入口' },
    meta: '正在载入'
  })
  hydrateSpeedDialPanel()
  return 'speedDial'
}

function hydrateSpeedDialPanel(): void {
  const renderVersion = ++speedDialRenderVersion
  void loadSpeedDialModule()
    .then((speedDial) => {
      if (
        renderVersion !== speedDialRenderVersion ||
        !state.moduleSettings.speedDial
      ) {
        return
      }

      const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
      const items = speedDial.buildSpeedDialItems({
        pinnedIds: activeWorkspace.pinnedIds,
        bookmarks: state.allBookmarkMap
      })
      renderSpeedDialPanel(items, speedDial.createSpeedDialEmptyState)
    })
    .catch(() => {
      dispatchNewtabSpeedDialView({
        ariaBusy: false,
        content: { type: 'loading', label: '载入固定入口' },
        meta: '暂时无法载入',
        metaTone: 'error'
      })
    })
}

function refreshSpeedDialPanel(): void {
  if (state.moduleSettings.speedDial) {
    hydrateSpeedDialPanel()
  } else {
    dispatchNewtabSpeedDialView(null)
  }
}

function renderSpeedDialPanel(
  items: SpeedDialItem[],
  createSpeedDialEmptyState: SpeedDialModule['createSpeedDialEmptyState']
): void {
  if (!items.length) {
    dispatchNewtabSpeedDialView({
      ariaBusy: false,
      content: { type: 'empty', state: createSpeedDialEmptyState() },
      meta: state.speedDialReorderError || '0 个固定入口',
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
    meta: state.speedDialReorderError || `${items.length} 个固定入口`,
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
  const accentColor = !customIcon
    ? getCachedFaviconAccentCssRgb(String(item.id), String(bookmark.url || item.url || ''))
    : ''
  return {
    customIcon: Boolean(customIcon),
    detail: item.detail,
    dragging: String(item.id) === state.speedDialDraggingBookmarkId && Boolean(state.speedDialDragOriginalOrderIds.length),
    fallbackLabel: item.fallbackLabel,
    favicon: {
      fetchpriority: faviconLoadAttributes.fetchpriority,
      loading: faviconLoadAttributes.loading,
      src: customIcon || getFaviconUrl(item.url, item.id)
    },
    id: item.id,
    onNavigate: (event) => {
      handleBookmarkNavigation(event, bookmark, item.url)
    },
    style: accentColor
      ? { '--bookmark-card-rgb': accentColor } as CSSProperties
      : undefined,
    title: item.title,
    url: item.url
  }
}

function appendBookmarkTilesInChunks(
  list: HTMLElement,
  section: NewTabFolderSection,
  renderedBookmarkIndex: number,
  renderVersion: number,
  pageBudget: number = BOOKMARK_TILE_INITIAL_RENDER_LIMIT
): number {
  const perSectionLimit = Math.min(section.bookmarks.length, BOOKMARK_TILE_INITIAL_RENDER_LIMIT)
  const initialCount = Math.min(perSectionLimit, Math.max(0, pageBudget))
  appendBookmarkTiles(
    list,
    section.bookmarks.slice(0, initialCount),
    section.id,
    renderedBookmarkIndex
  )

  if (initialCount < section.bookmarks.length) {
    const remainingCount = section.bookmarks.length - initialCount
    const placeholder = createBookmarkSectionPlaceholder(section, remainingCount)
    list.dataset.incrementalRender = 'true'
    list.setAttribute('aria-busy', 'true')
    list.append(placeholder)
    observeBookmarkSectionPlaceholder(placeholder, {
      section,
      nextIndex: initialCount,
      renderedBookmarkIndex: renderedBookmarkIndex + initialCount,
      renderVersion
    })
  }

  return renderedBookmarkIndex + section.bookmarks.length
}

function createBookmarkSectionPlaceholder(
  section: NewTabFolderSection,
  remainingCount: number
): HTMLElement {
  const placeholder = document.createElement('div')
  placeholder.className = 'bookmark-grid-placeholder'
  syncBookmarkSectionPlaceholder(placeholder, section, remainingCount)
  return placeholder
}

function syncBookmarkSectionPlaceholder(
  placeholder: HTMLElement,
  section: NewTabFolderSection,
  remainingCount: number
): void {
  const count = Math.max(0, remainingCount)
  const folderTitle = section.title || '文件夹'
  placeholder.dataset.pendingBookmarks = String(count)
  placeholder.setAttribute('role', 'status')
  placeholder.setAttribute('aria-live', 'polite')
  placeholder.title = `${folderTitle}还有 ${count} 个书签将在滚动到此处时载入`
  placeholder.textContent = `继续载入 ${count} 个书签`
}

function scheduleBookmarkTileChunkRender(
  list: HTMLElement,
  section: NewTabFolderSection,
  nextIndex: number,
  renderedBookmarkIndex: number,
  renderVersion: number,
  placeholder?: HTMLElement
): void {
  window.requestAnimationFrame(() => {
    if (renderVersion !== bookmarkTileRenderVersion || !list.isConnected) {
      return
    }

    const endIndex = Math.min(section.bookmarks.length, nextIndex + BOOKMARK_TILE_RENDER_CHUNK_SIZE)
    appendBookmarkTiles(
      list,
      section.bookmarks.slice(nextIndex, endIndex),
      section.id,
      renderedBookmarkIndex,
      placeholder?.isConnected ? placeholder : null
    )

    if (endIndex < section.bookmarks.length) {
      if (placeholder?.isConnected) {
        syncBookmarkSectionPlaceholder(placeholder, section, section.bookmarks.length - endIndex)
      }
      scheduleBookmarkTileChunkRender(
        list,
        section,
        endIndex,
        renderedBookmarkIndex + (endIndex - nextIndex),
        renderVersion,
        placeholder
      )
      return
    }

    placeholder?.remove()
    delete list.dataset.incrementalRender
    list.setAttribute('aria-busy', state.reorderingBookmarks ? 'true' : 'false')
  })
}

function appendBookmarkTiles(
  list: HTMLElement,
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string,
  renderedBookmarkIndex: number,
  before?: ChildNode | null
): void {
  const tiles = appendBookmarkTileIslandElements(
    list,
    bookmarks.map((bookmark, index) =>
      createBookmarkTileViewModel(bookmark, folderId, renderedBookmarkIndex + index)
    ),
    { before }
  )

  tiles.forEach((tile, index) => {
    const bookmark = bookmarks[index]
    if (bookmark) {
      bindBookmarkTileRuntime(tile, bookmark, String(bookmark.id))
    }
  })
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
    items,
    onFocusSource: focusSourceSection
  }
}

function focusSourceSection(anchorId: string): void {
  const section = cachedEl(anchorId)
  if (!(section instanceof HTMLElement)) {
    return
  }

  section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  section.focus({ preventScroll: true })
}

function createPortalPanel(): PortalPanelState | null {
  const quickAccess = createQuickAccessPanel()
  if (!quickAccess) {
    return null
  }

  return { quickAccess }
}

interface QuickAccessViewModel {
  frequentItems: ReturnType<typeof getPortalQuickAccessItems>['frequentItems']
  recentItems: ReturnType<typeof getPortalQuickAccessItems>['recentItems']
}

let quickAccessViewModelCache: {
  bookmarksRef: typeof state.bookmarks | null
  recordsRef: typeof state.activity.records | null
  pinnedSignature: string
  showQuickAccess: boolean
  itemLimit: number
  model: QuickAccessViewModel
} | null = null

function computeQuickAccessViewModel(): QuickAccessViewModel {
  const pinnedIds = getActiveWorkspacePinnedIds()
  const pinnedSignature = pinnedIds.join(',')
  const show = state.generalSettings.showQuickAccess
  if (
    quickAccessViewModelCache &&
    quickAccessViewModelCache.bookmarksRef === state.bookmarks &&
    quickAccessViewModelCache.recordsRef === state.activity.records &&
    quickAccessViewModelCache.pinnedSignature === pinnedSignature &&
    quickAccessViewModelCache.showQuickAccess === show &&
    quickAccessViewModelCache.itemLimit === QUICK_ACCESS_ITEM_LIMIT
  ) {
    return quickAccessViewModelCache.model
  }

  const model = getPortalQuickAccessItems({
    bookmarks: state.bookmarks,
    pinnedIds,
    records: state.activity.records,
    now: Date.now(),
    itemLimit: QUICK_ACCESS_ITEM_LIMIT,
    showFrequent: show,
    showRecent: show
  })

  quickAccessViewModelCache = {
    bookmarksRef: state.bookmarks,
    recordsRef: state.activity.records,
    pinnedSignature,
    showQuickAccess: show,
    itemLimit: QUICK_ACCESS_ITEM_LIMIT,
    model
  }
  return model
}

function createQuickAccessPanel(): QuickAccessPanelState | null {
  const { frequentItems, recentItems } = computeQuickAccessViewModel()

  const frequentQuickAccessItems = frequentItems
    .map(createQuickAccessItemFromPortalItem)
    .filter((item): item is QuickAccessItem => Boolean(item))
  const recentQuickAccessItems = recentItems
    .map(createQuickAccessItemFromPortalItem)
    .filter((item): item is QuickAccessItem => Boolean(item))

  if (!frequentQuickAccessItems.length && !recentQuickAccessItems.length) {
    return null
  }

  const groups: QuickAccessGroupViewModel[] = []
  if (frequentQuickAccessItems.length) {
    groups.push(createQuickAccessGroup('Curator 常用', frequentQuickAccessItems))
  }
  if (recentQuickAccessItems.length) {
    groups.push(createQuickAccessGroup('新近添加', recentQuickAccessItems))
  }

  return { groups }
}

function createQuickAccessItemFromPortalItem(item: PortalQuickAccessItem): QuickAccessItem | null {
  const bookmark = state.allBookmarkMap.get(item.id)
  if (!bookmark?.url) {
    return null
  }

  return createQuickAccessItem(bookmark, item.detail, item.badge, item.reason)
}

function createQuickAccessGroup(label: string, items: QuickAccessItem[]): QuickAccessGroupViewModel {
  return {
    label,
    items: items.map((item) => ({
      badge: item.badge,
      detail: item.detail,
      id: item.id,
      onNavigate: (event) => {
        handleBookmarkNavigation(event, item.bookmark, item.url)
      },
      reason: item.reason,
      title: item.title,
      url: item.url
    }))
  }
}

function createQuickAccessItem(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  detail: string,
  badge: string,
  reason: PortalQuickAccessItem['reason']
): QuickAccessItem {
  const url = String(bookmark.url || '').trim()
  const title = String(bookmark.title || '').trim() || url
  return {
    id: String(bookmark.id),
    title,
    url,
    detail,
    badge,
    reason,
    bookmark
  }
}

function getResponsiveIconColumns(settings: IconSettings): number {
  return getResponsiveFixedIconColumns(
    settings,
    document.documentElement.clientWidth || window.innerWidth || 1280
  )
}

function createBookmarkTile(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  folderId: string,
  renderIndex = 0
): HTMLAnchorElement {
  const bookmarkId = String(bookmark.id)
  const tile = createBookmarkTileIslandElement(createBookmarkTileViewModel(bookmark, folderId, renderIndex))
  bindBookmarkTileRuntime(tile, bookmark, bookmarkId)
  return tile
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
  return {
    customIcon: Boolean(customIcon),
    dragging: bookmarkId === state.draggingBookmarkId && Boolean(state.dragOriginalOrderIds.length),
    fallbackLabel: getFallbackLabel(title),
    favicon: {
      fetchpriority: renderIndex < HIGH_PRIORITY_FAVICON_LIMIT ? 'high' : 'low',
      loading: renderIndex < EAGER_FAVICON_LIMIT ? 'eager' : 'lazy',
      src: customIcon || getFaviconUrl(url, bookmarkId)
    },
    folderId,
    id: bookmarkId,
    title,
    url
  }
}

function bindBookmarkTileRuntime(
  tile: HTMLAnchorElement,
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  bookmarkId: string
): void {
  syncBookmarkNavigation(tile, bookmark)
  const url = String(bookmark.url || '')
  if (!state.customIcons[bookmarkId]) {
    applyCachedFaviconAccent(tile, bookmarkId, url)
  }
}

function applyCachedFaviconAccent(item: HTMLElement, bookmarkId: string, url: string): void {
  const entry = getFaviconAccentCacheEntry(state.faviconAccentCache, bookmarkId, url)
  if (entry) {
    applyFaviconAccentToTile(item, entry.color)
    return
  }

  const fallback = getHostnameAccentColor(url)
  if (fallback) {
    applyFaviconAccentToTile(item, fallback)
  }
}

function getCachedFaviconAccentCssRgb(bookmarkId: string, url: string): string {
  const entry = getFaviconAccentCacheEntry(state.faviconAccentCache, bookmarkId, url)
  if (entry) {
    return formatFaviconAccentCssRgb(entry.color)
  }

  const fallback = getHostnameAccentColor(url)
  return fallback ? formatFaviconAccentCssRgb(fallback) : ''
}

const FAVICON_ACCENT_PALETTE: readonly FaviconAccentColor[] = [
  { r: 234, g: 200, b: 168 },
  { r: 200, g: 220, b: 255 },
  { r: 168, g: 220, b: 180 },
  { r: 255, g: 200, b: 200 },
  { r: 220, g: 200, b: 240 },
  { r: 240, g: 220, b: 160 },
  { r: 200, g: 230, b: 230 },
  { r: 240, g: 180, b: 200 },
  { r: 180, g: 200, b: 230 },
  { r: 230, g: 180, b: 180 },
  { r: 200, g: 240, b: 200 },
  { r: 220, g: 200, b: 180 }
]

function getHostnameAccentColor(url: string): FaviconAccentColor | null {
  const trimmed = String(url || '').trim()
  if (!trimmed) {
    return null
  }
  let host = ''
  try {
    host = new URL(trimmed).hostname.toLowerCase()
  } catch {
    host = trimmed.toLowerCase()
  }
  if (!host) {
    return null
  }
  let hash = 5381
  for (let index = 0; index < host.length; index += 1) {
    hash = ((hash << 5) + hash + host.charCodeAt(index)) >>> 0
  }
  return FAVICON_ACCENT_PALETTE[hash % FAVICON_ACCENT_PALETTE.length]
}

function applyFaviconAccentToTile(item: HTMLElement, color: FaviconAccentColor): void {
  item.style.setProperty('--bookmark-card-rgb', formatFaviconAccentCssRgb(color))
}

async function saveFaviconAccentCache(): Promise<void> {
  state.faviconAccentCache = normalizeFaviconAccentCache(state.faviconAccentCache)
  await setLocalStorage({
    [STORAGE_KEYS.newTabFaviconAccentCache]: state.faviconAccentCache
  })
}

function cleanupNewTabController(): void {
  newTabControllerStarted = false
  window.clearTimeout(clockTimer)
  clockTimer = 0
  window.clearTimeout(featuredBackgroundRefreshTimer)
  featuredBackgroundRefreshTimer = 0
  window.clearTimeout(featuredBackgroundPreferencesSaveTimer)
  featuredBackgroundPreferencesSaveTimer = 0
  clearFeaturedBackgroundPreviewWarmTimers()
  clearFeaturedBackgroundHoverPreview()
  clearFeaturedBackgroundCardPreviewRegistry()
  revokeFeaturedBackgroundGalleryObjectUrls()
  revokeFeaturedBackgroundGalleryPreviewObjectUrls()
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = 0
  window.clearTimeout(searchSettingsSettleTimer)
  searchSettingsSettleTimer = 0
  window.clearTimeout(iconSettingsSaveTimer)
  iconSettingsSaveTimer = 0
  window.clearTimeout(timeSettingsSaveTimer)
  timeSettingsSaveTimer = 0
  window.clearTimeout(settingsSaveStatusTimer)
  settingsSaveStatusTimer = 0
  window.clearTimeout(folderReorderStatusTimer)
  folderReorderStatusTimer = 0
  window.clearTimeout(bookmarkChangeRefreshTimer)
  bookmarkChangeRefreshTimer = 0
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
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
  window.cancelAnimationFrame(deferredRenderFrame)
  deferredRenderFrame = 0
  removeBookmarkDragGhost()
  removeSpeedDialDragGhost()
  removeFolderDragGhost()
  disconnectBookmarkLazyExpansionObserver()
  setActiveBackgroundObjectUrl('')
  clearVideoBackground()
  abortNewTabNaturalSearchRequest()
  searchSuggestionCache.clear()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlanCache.clear()
  if (dashboardFrame) {
    dashboardFrame.removeAttribute('src')
    state.dashboardFrameLoaded = false
    state.dashboardFrameReady = false
  }
}

function getFeaturedBackgroundPreviewCacheKey(imageUrl: string): string {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }
  return `${FEATURED_BACKGROUND_PREVIEW_CACHE_KEY_PREFIX}${normalizedUrl}`
}

function getFeaturedBackgroundPreviewCandidates(imageUrl: string, provider: FeaturedBackgroundItem['provider']): string[] {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return []
  }

  const urls = new Set<string>()
  const fallbackUrl = getFeaturedBackgroundPreviewImageUrl({ provider }, normalizedUrl)
  if (fallbackUrl) {
    urls.add(fallbackUrl)
  }
  urls.add(normalizedUrl)
  return [...urls]
}

async function getFeaturedBackgroundPreviewCacheRecord(imageUrl: string): Promise<{
  blob: Blob
  url: string
  type: string
  updatedAt: number
} | null> {
  const key = getFeaturedBackgroundPreviewCacheKey(imageUrl)
  if (!key) {
    return null
  }

  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const request = store.get(key)
      request.onsuccess = () => {
        const record = request.result as {
          blob?: unknown
          url?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined
        if (!record?.blob || !(record.blob instanceof Blob) || String(record.url || '') !== normalizeBackgroundImageUrl(imageUrl)) {
          resolve(null)
          return
        }
        resolve({
          blob: record.blob,
          url: String(record.url || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        })
      }
      request.onerror = () => {
        reject(request.error || new Error('精选图库预览缓存读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function clearFeaturedBackgroundPreviewCache(): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const prefix = FEATURED_BACKGROUND_PREVIEW_CACHE_KEY_PREFIX
      const request = store.openKeyCursor(IDBKeyRange.bound(prefix, `${prefix}\uffff`))
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve()
          return
        }
        store.delete(cursor.key)
        cursor.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('精选图库预览缓存清除失败。'))
      transaction.onabort = () => reject(transaction.error || new Error('精选图库预览缓存清除失败。'))
    })
  } finally {
    db.close()
  }
}

async function createFeaturedBackgroundPreviewObjectUrl(imageUrl: string): Promise<string> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  return featuredBackgroundGalleryPreviewObjectUrlCache.resolve(
    normalizedUrl,
    () => getFeaturedBackgroundPreviewCacheRecord(normalizedUrl).then((record) => record?.blob || null),
    { fallbackUrl: '' }
  )
}

function revokeFeaturedBackgroundGalleryPreviewObjectUrls(): void {
  featuredBackgroundGalleryPreviewObjectUrlCache.clear()
}

function syncBookmarkNavigation(
  link: HTMLAnchorElement,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  const bookmarkId = String(bookmark.id || link.dataset.bookmarkId || '').trim()
  if (!bookmarkId || !String(bookmark.url || '').trim()) {
    link.onclick = null
    return
  }

  link.onclick = (event) => {
    handleBookmarkNavigation(event, bookmark, link.getAttribute('href') || link.href)
  }
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

  if (
    state.dragSuppressClick ||
    state.speedDialDragSuppressClick ||
    state.folderDragSuppressClick ||
    state.draggingBookmarkId ||
    state.speedDialDraggingBookmarkId ||
    state.draggingFolderId
  ) {
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
  state.preparedSearchIndex = prepareNewTabSearchIndex(state.searchIndex)
  searchSuggestionCache.clear()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlanCache.clear()
  state.searchIndexReady = true
  state.searchIndexReadyPromise = searchIndexReadyPromise
  resolveSearchIndexReady()
  perfMark('newtab.searchReady')
  perfMeasure('newtab.searchReadyMs', 'newtab.domContentLoaded', 'newtab.searchReady')
}

function getAllBookmarkRecords(): BookmarkRecord[] {
  const folderData = state.folderData || getBookmarkCatalog().extracted
  return folderData.bookmarks
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

  state.activity = await saveNewTabActivityRemoval(normalizedId)
}

async function removeBookmarkFromWorkspacePins(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  let nextSettings = state.workspaceSettings
  for (const workspace of state.workspaceSettings.workspaces) {
    if (!workspace.pinnedIds.includes(normalizedId)) {
      continue
    }
    nextSettings = updateNewTabWorkspace(
      nextSettings,
      workspace.id,
      { pinnedIds: workspace.pinnedIds.filter((id) => id !== normalizedId) },
      { validBookmarkIds: state.allBookmarkMap.keys() }
    )
  }

  state.workspaceSettings = nextSettings
  await saveNewTabWorkspaceSettings()
  postDashboardSpeedDialState()
}

async function saveNewTabActivityRecord(record: NewTabActivityRecord): Promise<void> {
  const activityRepository = await loadNewTabActivityRepositoryLazy()
  state.activity = await activityRepository.upsertNewTabActivityRecordInRepository(
    state.activity,
    record,
    normalizeNewTabActivityForCurrentBookmarks
  )
}

async function saveNewTabActivityRemoval(bookmarkId: string): Promise<NewTabActivityState> {
  const activityRepository = await loadNewTabActivityRepositoryLazy()
  return activityRepository.removeNewTabActivityRecordInRepository(
    state.activity,
    bookmarkId,
    normalizeNewTabActivityForCurrentBookmarks
  )
}

async function loadNewTabActivityRepositoryLazy(): Promise<NewTabActivityRepositoryModule> {
  return import('../shared/repositories/activity-repository.js')
}

function normalizeNewTabActivityForCurrentBookmarks(rawActivity: unknown): NewTabActivityState {
  return normalizeNewTabActivity(rawActivity, state.allBookmarks)
}

async function saveNewTabWorkspaceSettings(): Promise<void> {
  state.workspaceSettings = normalizeNewTabWorkspaceSettings(state.workspaceSettings, {
    validBookmarkIds: state.allBookmarkMap.keys()
  })
  await setLocalStorage({
    [STORAGE_KEYS.newTabWorkspaceSettings]: state.workspaceSettings
  })
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

function renderBookmarkMenu({ focusFirst = true, focusAction = '' } = {}): void {
  window.clearTimeout(bookmarkMenuCloseTimer)
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    dispatchNewtabBookmarkEditMenuView(null)
    return
  }

  const bookmarkLabel = getBookmarkActionLabelContext(bookmark)
  const pinCopy = getSpeedDialPinActionCopyLocal(isActiveMenuBookmarkPinned())
  const deleteLabel = state.pendingDeleteBookmarkId === String(bookmark.id) ? '确认删除书签' : '删除书签'
  dispatchNewtabBookmarkEditMenuView({
    closing: false,
    focusAction,
    focusFirst,
    menu: {
      actions: [
        createMenuActionViewModel(
          pinCopy.label,
          'pin',
          toggleActiveMenuBookmarkPin,
          { actionId: 'toggle-pin', ariaLabel: `${pinCopy.ariaLabel}：${bookmarkLabel}` }
        ),
        createMenuActionViewModel('复制链接', 'copy', copyActiveMenuBookmarkUrl, {
          actionId: 'copy-url',
          ariaLabel: `复制书签链接：${bookmarkLabel}`
        }),
        createMenuActionViewModel(
          state.pendingDeleteBookmarkId === String(bookmark.id) ? '确认删除 1 个' : '删除链接',
          'trash',
          deleteActiveMenuBookmark,
          { actionId: 'delete-bookmark', variant: 'danger', ariaLabel: `${deleteLabel}：${bookmarkLabel}` }
        ),
        createMenuActionViewModel('刷新图标', 'refresh', refreshActiveMenuIcon, {
          actionId: 'refresh-icon',
          ariaLabel: `刷新书签图标：${bookmarkLabel}`
        }),
        createMenuActionViewModel('保存更改', 'save', saveBookmarkMenuChanges, {
          actionId: 'save-bookmark',
          ariaLabel: `保存书签更改：${bookmarkLabel}`
        })
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
      onIconModeChange: handleIconModeChange,
      status: state.menuStatus,
      statusTone: state.pendingDeleteBookmarkId === String(bookmark.id) ? 'warning' : '',
      x: state.menuX,
      y: state.menuY
    }
  })
}

function renderAddBookmarkMenu({ focusFirst = true } = {}): void {
  window.clearTimeout(addBookmarkMenuCloseTimer)
  if (!state.addMenuOpen) {
    dispatchNewtabBookmarkAddMenuView(null)
    return
  }

  dispatchNewtabBookmarkAddMenuView({
    closing: false,
    focusFirst,
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
      onExpand: expandAddBookmarkMenu,
      x: state.addMenuX,
      y: state.addMenuY
    }
  })
}

async function handleIconModeChange(nextMode: string): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  if (nextMode === 'website') {
    state.editIconMode = 'website'
    state.pendingCustomIconDataUrl = ''
    state.pendingDeleteBookmarkId = ''
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu({ focusFirst: false })
    return
  }

  state.menuBusy = true
  state.pendingDeleteBookmarkId = ''
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu({ focusFirst: false })

  try {
    const customIconPicker = await loadCustomIconPickerModule()
    const dataUrl = await customIconPicker.pickCustomIconImage()
    state.menuBusy = false
    if (!dataUrl) {
      state.editIconMode = state.customIcons[bookmark.id] ? 'custom' : 'website'
      renderBookmarkMenu({ focusFirst: false })
      return
    }

    state.editIconMode = 'custom'
    state.pendingCustomIconDataUrl = dataUrl
    renderBookmarkMenu({ focusFirst: false })
  } catch (error) {
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError =
      error instanceof Error ? error.message : '自定义图片读取失败，请重试。'
    state.editIconMode = state.customIcons[bookmark.id] ? 'custom' : 'website'
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
      state.pendingDeleteBookmarkId = ''
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
    ariaLabel = label
  }: {
    disabled?: boolean
    actionId?: string
    variant?: 'danger' | ''
    ariaLabel?: string
  } = {}
): BookmarkMenuActionViewModel {
  return {
    actionId,
    ariaLabel,
    disabled,
    icon,
    id: actionId || `${icon}:${label}`,
    label,
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

async function persistCustomIconChoice(bookmarkId: string): Promise<void> {
  const nextIcons = { ...state.customIcons }

  if (state.editIconMode === 'custom') {
    const iconData = state.pendingCustomIconDataUrl || nextIcons[bookmarkId]
    if (!iconData) {
      throw new Error('请选择自定义图片，或切回网站图标。')
    }
    nextIcons[bookmarkId] = iconData
  } else {
    delete nextIcons[bookmarkId]
  }

  await saveCustomIcons(nextIcons)
}

async function saveCustomIcons(nextIcons: Record<string, string>): Promise<void> {
  state.customIcons = nextIcons
  await setLocalStorage({
    [STORAGE_KEYS.newTabCustomIcons]: nextIcons
  })
}

async function deleteFaviconAccentCacheEntry(bookmarkId: string): Promise<void> {
  const nextCache = removeFaviconAccentCacheEntry(state.faviconAccentCache, bookmarkId)
  if (nextCache === state.faviconAccentCache) {
    return
  }

  state.faviconAccentCache = nextCache
  await saveFaviconAccentCache()
}

function normalizeCustomIcons(rawIcons: unknown): Record<string, string> {
  if (!rawIcons || typeof rawIcons !== 'object' || Array.isArray(rawIcons)) {
    return {}
  }

  const normalized: Record<string, string> = {}
  for (const [bookmarkId, value] of Object.entries(rawIcons as Record<string, unknown>)) {
    const key = String(bookmarkId || '').trim()
    const dataUrl = String(value || '').trim()
    if (key && dataUrl.startsWith('data:image/')) {
      normalized[key] = dataUrl
    }
  }
  return normalized
}

function normalizeBackgroundSettings(rawSettings: unknown): typeof DEFAULT_BACKGROUND_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_BACKGROUND_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const type = SUPPORTED_BACKGROUND_TYPES.has(String(settings.type))
    ? String(settings.type)
    : DEFAULT_BACKGROUND_SETTINGS.type
  const featuredId = normalizeFeaturedBackgroundId(settings.featuredId)
  return {
    type,
    color: normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    imageName: String(settings.imageName || '').trim(),
    videoName: String(settings.videoName || '').trim(),
    url: String(settings.url || '').trim(),
    featuredId,
    maskEnabled: settings.maskEnabled === true,
    maskStyle: SUPPORTED_BACKGROUND_MASK_STYLES.has(String(settings.maskStyle))
      ? String(settings.maskStyle)
      : DEFAULT_BACKGROUND_SETTINGS.maskStyle,
    maskBlur: clampNumber(settings.maskBlur, 0, 32, DEFAULT_BACKGROUND_SETTINGS.maskBlur)
  }
}

function normalizeFeaturedBackgroundId(value: unknown): string {
  const id = String(value || '').trim()
  if (!id) {
    return ''
  }
  if (state.featuredBackgroundGallery.some((item) => item.id === id)) {
    return id
  }
  if (!backgroundGalleryModule || !state.featuredBackgroundGalleryHydrated) {
    return id
  }
  return backgroundGalleryModule.getFeaturedBackgroundItemById(id)?.id || ''
}

function normalizeFeaturedBackgroundGallery(rawItems: unknown): FeaturedBackgroundItem[] {
  if (!Array.isArray(rawItems)) {
    return []
  }

  const items: FeaturedBackgroundItem[] = []
  const seen = new Set<string>()
  for (const rawItem of rawItems) {
    const item = normalizeFeaturedBackgroundGalleryItem(rawItem)
    if (!item || seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    items.push(item)
  }
  return items.slice(0, 72)
}

function normalizeFeaturedBackgroundGalleryItem(rawItem: unknown): FeaturedBackgroundItem | null {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return null
  }

  const item = rawItem as Record<string, unknown>
  const id = String(item.id || '').trim()
  const title = String(item.title || '').trim()
  const provider = String(item.provider || '')
  const imageUrl = normalizeBackgroundImageUrl(String(item.imageUrl || ''))
  const sourceUrl = normalizeBackgroundImageUrl(String(item.sourceUrl || ''))
  const credit = String(item.credit || '').trim()
  const license = String(item.license || '').trim()
  if (!id || !title || !imageUrl || !sourceUrl || !credit || !license ||
    (provider !== 'nasa' &&
      provider !== 'met' &&
      provider !== 'wikimedia' &&
      provider !== 'artic' &&
      provider !== 'cleveland')) {
    return null
  }

  return {
    id,
    title,
    provider: provider as FeaturedBackgroundItem['provider'],
    imageUrl,
    sourceUrl,
    credit,
    license,
    accentColor: normalizeHexColor(item.accentColor, '#050506'),
    dynamic: item.dynamic === true,
    width: normalizePositiveDimension(item.width),
    height: normalizePositiveDimension(item.height)
  }
}

function normalizeFeaturedBackgroundFavoriteIds(rawIds: unknown): string[] {
  const source = Array.isArray(rawIds) ? rawIds : []
  return [...new Set(source.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 72)
}

function normalizePositiveDimension(value: unknown): number | undefined {
  const dimension = Math.round(Number(value))
  return Number.isFinite(dimension) && dimension > 0 ? dimension : undefined
}

function syncBackgroundSettingsControls(): void {
  const settings = state.backgroundSettings
  updateBackgroundStartupCacheStatus(settings)

  if (settings.type === 'featured') {
    void hydrateFeaturedBackgroundOptions()
  }
  syncFeaturedBackgroundDisplayPreferenceControls()
}

function createBackgroundSettingsView() {
  const settings = state.backgroundSettings
  const featuredItem = settings.type === 'featured'
    ? getActiveFeaturedBackgroundItemSync(settings)
    : null
  if (settings.type === 'featured' && !featuredItem) {
    void hydrateFeaturedBackgroundCredit(settings)
  }

  return createNewtabBackgroundSettingsView(
    settings,
    state.featuredBackgroundPreferences,
    FEATURED_BACKGROUND_DISPLAY_LIMITS,
    {
      backgroundStatus: state.backgroundStatus,
      backgroundStatusTone: state.backgroundStatusTone,
      featuredCreditHref: featuredItem?.sourceUrl || 'https://images.nasa.gov/',
      featuredCreditText: featuredItem ? `${featuredItem.title} · ${featuredItem.credit}` : '正在载入精选图库',
      featuredCreditTitle: featuredItem ? `${featuredItem.license} · ${featuredItem.sourceUrl}` : '',
      featuredPickerExpanded: isFeaturedBackgroundPickerOpen(),
      featuredPickerLabel: getFeaturedBackgroundPickerLabel(settings),
      featuredPickerSelected: Boolean(settings.featuredId)
    }
  )
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
  if (!mediaSignature || settings.type === 'color') {
    return
  }
  if (getCurrentInstantWallpaper(mediaSignature)) {
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
  if (!getBackgroundMediaSignature(settings) || settings.type === 'color') {
    return
  }
  if (getCurrentInstantWallpaper(getBackgroundMediaSignature(settings))) {
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

function migrateStoredFeaturedBackgroundId(gallery = backgroundGalleryModule): void {
  if (!gallery || state.backgroundSettings.type !== 'featured' || !state.backgroundSettings.featuredId) {
    return
  }

  if (gallery.getFeaturedBackgroundItemById(state.backgroundSettings.featuredId)) {
    return
  }
  if (getStoredFeaturedBackgroundItemById(state.backgroundSettings.featuredId) || !state.featuredBackgroundGalleryHydrated) {
    return
  }

  const previousSettings = state.backgroundSettings
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    featuredId: ''
  })
  state.backgroundSettings = nextSettings
  backgroundSettingsMutationVersion += 1
  preloadedBackgroundSettings = nextSettings
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(nextSettings))
  syncInstantWallpaperTargetForSettings(nextSettings)
  syncBackgroundSettingsControls()
  scheduleFeaturedBackgroundDailyRefresh()
  void saveBackgroundSettings().catch((error) => {
    console.warn('精选图库旧配置迁移失败。', error)
  })
  void applyBackgroundSettingsAfterCacheUpdate(shouldClearBackgroundUrlCache(previousSettings, nextSettings))
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
  const featuredItem = settings.type === 'featured'
    ? getActiveFeaturedBackgroundItemSync(settings)
    : null
  const signatureParts = [
    settings.type,
    normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    settings.imageName,
    settings.videoName,
    normalizeBackgroundImageUrl(settings.url),
    settings.type === 'featured' ? settings.featuredId : '',
    settings.type === 'featured' && !settings.featuredId ? getFeaturedBackgroundDateSeed() : '',
    settings.type === 'featured' ? featuredItem?.id || 'pending-featured' : ''
  ]
  if (settings.type === 'featured' && !featuredItem) {
    const reusableSignature = getReusableFeaturedBackgroundSignature(`${signatureParts.slice(0, -1).join('|')}|`)
    if (reusableSignature) {
      return reusableSignature
    }
  }
  return signatureParts.join('|')
}

function getReusableFeaturedBackgroundSignature(signaturePrefix: string): string {
  const targetSignature = readInstantWallpaperTarget()?.signature || ''
  if (isConcreteFeaturedBackgroundSignature(targetSignature, signaturePrefix)) {
    return targetSignature
  }
  const instantSignature = readInstantWallpaper()?.signature || ''
  if (isConcreteFeaturedBackgroundSignature(instantSignature, signaturePrefix)) {
    return instantSignature
  }
  return ''
}

function isConcreteFeaturedBackgroundSignature(signature: string, signaturePrefix: string): boolean {
  return Boolean(
    signature &&
    signature.startsWith(signaturePrefix) &&
    !signature.endsWith('|pending-featured')
  )
}

function setBackgroundStatus(
  message: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  state.backgroundStatus = message
  state.backgroundStatusTone = tone
}

function getBackgroundMediaSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/quota|storage|空间|容量/i.test(message)) {
    return '保存失败：浏览器本地存储空间可能不足，请换用更小文件或清理空间后重试。'
  }
  return '保存失败：请确认文件可读取，或换用更小的图片/视频后重试。'
}

function updateBackgroundStartupCacheStatus(settings = state.backgroundSettings): void {
  const mediaSignature = getBackgroundMediaSignature(settings)
  const instantWallpaper = readInstantWallpaper()
  const cacheRequired = settings.type !== 'color'
  const cacheReady = !cacheRequired ||
    (Boolean(mediaSignature) && instantWallpaper?.signature === mediaSignature && instantWallpaper.ready !== false)

  if (!cacheRequired) {
    state.backgroundUrlCacheStatus = ''
    return
  }

  state.backgroundUrlCacheStatus = cacheReady
    ? '首屏缓存已准备'
    : '首屏缓存准备中...'
}

function hasAppliedBackgroundMedia(settings: typeof DEFAULT_BACKGROUND_SETTINGS): boolean {
  if (settings.type === 'color') {
    return true
  }
  if (settings.type === 'video') {
    return Boolean(document.querySelector('.newtab-background-video'))
  }
  if (settings.type === 'image' || settings.type === 'urls' || settings.type === 'featured') {
    return Boolean(document.body.style.backgroundImage)
  }
  return true
}

function setWallpaperPlaceholderColor(color = getBackgroundPlaceholderColor(state.backgroundSettings)): void {
  document.documentElement.style.setProperty(
    '--wallpaper-placeholder-bg',
    normalizeInstantWallpaperColor(color)
  )
}

function getBackgroundPlaceholderColor(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  const allowDarkColor = settings.type === 'color'
  if (settings.type === 'featured') {
    return getNonBlackPlaceholderColor(
      getActiveFeaturedBackgroundItemSync(settings)?.accentColor ||
      settings.color ||
      DEFAULT_FEATURED_BACKGROUND_PLACEHOLDER_COLOR
    )
  }
  const color = normalizeInstantWallpaperColor(settings.color || getInstantWallpaperFallbackColor())
  return allowDarkColor ? color : getNonBlackPlaceholderColor(color)
}

function markWallpaperReady(): void {
  const rootElement = document.documentElement
  rootElement.classList.remove('loading-wallpaper', 'newtab-booting')
  delete rootElement.dataset.instantWallpaperPending
  recordNewTabBackgroundReady()
}

function markWallpaperPending(): void {
  const rootElement = document.documentElement
  rootElement.classList.add('loading-wallpaper')
  rootElement.classList.remove('instant-wallpaper-ready')
  rootElement.classList.remove('instant-wallpaper-remote-ready')
  rootElement.dataset.instantWallpaperPending = 'true'
  delete rootElement.dataset.instantWallpaperRemoteReady
}

function cleanupInstantWallpaperStartupStyle(): void {
  cachedEl('instant-wallpaper-startup-style')?.remove()
}

function markRuntimeWallpaperApplied(): void {
  cleanupInstantWallpaperStartupStyle()
}

function markInstantWallpaperRemoteReady(mediaSignature = lastAppliedBackgroundMediaSignature): void {
  if (!mediaSignature) {
    return
  }
  window.clearTimeout(instantWallpaperRemoteReadyFallbackTimer)
  instantWallpaperRemoteReadyFallbackTimer = 0
  const rootElement = document.documentElement
  if (rootElement.dataset.instantWallpaperSignature && rootElement.dataset.instantWallpaperSignature !== mediaSignature) {
    return
  }
  rootElement.classList.add('instant-wallpaper-remote-ready')
  rootElement.dataset.instantWallpaperRemoteReady = 'true'
}

function getCurrentInstantWallpaper(mediaSignature: string): ReturnType<typeof readInstantWallpaper> {
  const instantWallpaper = readInstantWallpaper()
  return (
    mediaSignature &&
    instantWallpaper?.signature === mediaSignature &&
    instantWallpaper.ready !== false
  ) ? instantWallpaper : null
}

function ensureInstantWallpaperFallbackStyles(mediaSignature: string): boolean {
  const rootElement = document.documentElement
  if (
    rootElement.dataset.instantWallpaperRemoteReady === 'true' &&
    rootElement.dataset.instantWallpaperSignature === mediaSignature
  ) {
    delete rootElement.dataset.instantWallpaperPending
    rootElement.classList.add('instant-wallpaper-ready')
    return true
  }

  const instantWallpaper = getCurrentInstantWallpaper(mediaSignature)
  if (!instantWallpaper) {
    return false
  }
  const dataUrl = readInstantWallpaperDataUrl(instantWallpaper)
  if (!dataUrl) {
    return false
  }

  rootElement.style.setProperty('--instant-wallpaper-image', `url("${escapeCssUrl(dataUrl)}")`)
  rootElement.style.setProperty('--instant-wallpaper-preview-image', `url("${escapeCssUrl(dataUrl)}")`)
  rootElement.style.setProperty('--instant-wallpaper-size', normalizeStoredBackgroundSizeCss(instantWallpaper.backgroundSize))
  rootElement.style.setProperty('--instant-wallpaper-position', instantWallpaper.backgroundPosition || 'center')
  rootElement.style.setProperty('--wallpaper-placeholder-bg', instantWallpaper.placeholderColor || getBackgroundPlaceholderColor(state.backgroundSettings))
  rootElement.dataset.instantWallpaperSignature = mediaSignature
  rootElement.classList.add('instant-wallpaper-ready')
  delete rootElement.dataset.instantWallpaperPending
  delete rootElement.dataset.instantWallpaperRemoteReady
  window.clearTimeout(instantWallpaperRemoteReadyFallbackTimer)
  instantWallpaperRemoteReadyFallbackTimer = window.setTimeout(() => {
    instantWallpaperRemoteReadyFallbackTimer = 0
    markInstantWallpaperRemoteReady(mediaSignature)
  }, INSTANT_WALLPAPER_REMOTE_READY_FALLBACK_MS)
  return true
}

async function applyBackgroundSettings(): Promise<void> {
  const applyToken = ++backgroundApplyToken
  const settings = state.backgroundSettings
  if (settings.type === 'featured' && !backgroundGalleryModule && !getActiveFeaturedBackgroundItemSync(settings)) {
    const mediaSignature = getBackgroundMediaSignature(settings)
    setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))
    syncInstantWallpaperTargetForSettings(settings, mediaSignature)
    ensureInstantWallpaperFallbackStyles(mediaSignature)
    markWallpaperReady()
    void loadBackgroundGalleryModule()
      .then(() => {
        if (applyToken === backgroundApplyToken && state.backgroundSettings.type === 'featured') {
          void applyBackgroundSettings()
        }
      })
      .catch(() => {})
    return
  }
  const mediaSignature = getBackgroundMediaSignature(settings)
  applyBackgroundMaskSettings(settings)
  applyFeaturedBackgroundDisplayPreferences()
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))

  if (
    mediaSignature === lastAppliedBackgroundMediaSignature &&
    hasAppliedBackgroundMedia(settings)
  ) {
    markInstantWallpaperRemoteReady(mediaSignature)
    markWallpaperReady()
    return
  }

  if (settings.type === 'color') {
    clearVideoBackground()
    setActiveBackgroundObjectUrl('')
    activeBackgroundImageNaturalSize = null
    activeBackgroundImageNaturalSizeSignature = ''
    document.body.style.backgroundImage = ''
    markRuntimeWallpaperApplied()
    clearInstantWallpaperIfSignatureChanged('')
    syncInstantWallpaperTargetForSettings(settings, mediaSignature)
    document.documentElement.style.setProperty('--bg', getBackgroundPlaceholderColor(settings))
    lastAppliedBackgroundMediaSignature = mediaSignature
    markWallpaperReady()
    return
  }

  document.documentElement.style.setProperty('--bg', getBackgroundPlaceholderColor(settings))

  if (isRemoteBackgroundType(settings.type)) {
    const imageUrl = getRemoteBackgroundImageUrl(settings)
    if (imageUrl) {
      syncInstantWallpaperTargetForSettings(settings, mediaSignature)
      clearVideoBackground()
      setActiveBackgroundObjectUrl('')
      activeBackgroundImageNaturalSize = getStoredBackgroundNaturalSizeForSettings(settings)
      activeBackgroundImageNaturalSizeSignature = activeBackgroundImageNaturalSize ? mediaSignature : ''
      const hasInstantWallpaperFallback = ensureInstantWallpaperFallbackStyles(mediaSignature)
      if (!hasInstantWallpaperFallback) {
        markWallpaperPending()
      }
      applyDirectRemoteBackgroundImage(imageUrl, mediaSignature, {
        revealWhenReady: !hasInstantWallpaperFallback
      })
      if (hasInstantWallpaperFallback) {
        markWallpaperReady()
      }
      void applyUrlBackgroundImage(imageUrl, applyToken, mediaSignature, settings)
    } else {
      clearVideoBackground()
      setActiveBackgroundObjectUrl('')
      activeBackgroundImageNaturalSize = null
      activeBackgroundImageNaturalSizeSignature = ''
      document.body.style.backgroundImage = ''
      markRuntimeWallpaperApplied()
      clearInstantWallpaperIfSignatureChanged('')
      syncInstantWallpaperTargetForSettings(settings, mediaSignature)
      lastAppliedBackgroundMediaSignature = mediaSignature
      markWallpaperReady()
    }
    return
  }

  if (settings.type !== 'image' && settings.type !== 'video') {
    lastAppliedBackgroundMediaSignature = mediaSignature
    markWallpaperReady()
    return
  }

  clearVideoBackground()
  setActiveBackgroundObjectUrl('')
  activeBackgroundImageNaturalSize = null
  activeBackgroundImageNaturalSizeSignature = ''
  document.body.style.backgroundImage = ''
  clearInstantWallpaperIfSignatureChanged('')
  syncInstantWallpaperTargetForSettings(settings, mediaSignature)
  if (ensureInstantWallpaperFallbackStyles(mediaSignature)) {
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
      markWallpaperReady()
    }
    return
  }
  if (applyToken !== backgroundApplyToken || !mediaRecord) {
    if (applyToken === backgroundApplyToken) {
      markWallpaperReady()
    }
    return
  }

  const objectUrl = URL.createObjectURL(mediaRecord.blob)
  setActiveBackgroundObjectUrl(objectUrl)
  if (mediaType === 'image') {
    const readyImage = await waitForBackgroundImageReady(objectUrl, applyToken)
    if (applyToken !== backgroundApplyToken) {
      return
    }
    if (readyImage) {
      document.body.style.backgroundImage = `url("${escapeCssUrl(objectUrl)}")`
      markRuntimeWallpaperApplied()
      lastAppliedBackgroundMediaSignature = mediaSignature
      void updateInstantWallpaperFromBlob(mediaRecord.blob, mediaSignature)
    } else {
      setActiveBackgroundObjectUrl('')
    }
    markWallpaperReady()
    return
  }

  const video = document.createElement('video')
  video.className = 'newtab-background-video'
  video.autoplay = true
  video.loop = true
  video.muted = true
  video.playsInline = true
  video.src = objectUrl
  document.body.prepend(video)
  const ready = await waitForBackgroundVideoReady(video, applyToken)
  if (applyToken !== backgroundApplyToken) {
    return
  }
  if (ready) {
    void video.play()
    markRuntimeWallpaperApplied()
    lastAppliedBackgroundMediaSignature = mediaSignature
  } else {
    video.remove()
    setActiveBackgroundObjectUrl('')
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

function waitForBackgroundVideoReady(video: HTMLVideoElement, applyToken: number): Promise<boolean> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve(applyToken === backgroundApplyToken)
  }

  return new Promise((resolve) => {
    let settled = false
    let timeout = 0

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', handleReady)
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('error', handleError)
    }

    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(ready && applyToken === backgroundApplyToken)
    }

    function handleReady(): void {
      settle(true)
    }

    function handleError(): void {
      settle(false)
    }

    timeout = window.setTimeout(() => {
      settle(false)
    }, BACKGROUND_VIDEO_READY_TIMEOUT_MS)
    video.addEventListener('loadedmetadata', handleReady, { once: true })
    video.addEventListener('canplay', handleReady, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

async function applyUrlBackgroundImage(
  imageUrl: string,
  applyToken: number,
  mediaSignature: string,
  settings = state.backgroundSettings
): Promise<void> {
  try {
    const cachedRecord = await getBackgroundUrlCache(imageUrl)
    if (applyToken !== backgroundApplyToken) {
      return
    }

    if (cachedRecord) {
      const ready = await setBackgroundImageFromBlob(cachedRecord.blob, applyToken, {
        preserveCurrentUntilReady: true
      }, mediaSignature)
      if (applyToken !== backgroundApplyToken) {
        return
      }
      if (ready) {
        clearVideoBackground()
        lastAppliedBackgroundMediaSignature = mediaSignature
        markInstantWallpaperRemoteReady(mediaSignature)
        await updateInstantWallpaperFromBlob(cachedRecord.blob, mediaSignature, settings)
      }
      markWallpaperReady()
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
  mediaSignature: string,
  {
    markApplied = true,
    revealWhenReady = false
  }: {
    markApplied?: boolean
    revealWhenReady?: boolean
  } = {}
): void {
  const applyToken = backgroundApplyToken
  clearVideoBackground()
  setActiveBackgroundObjectUrl('')
  applyFeaturedBackgroundDisplayPreferences()
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, mediaSignature)
  document.body.style.backgroundImage = `url("${escapeCssUrl(imageUrl)}")`
  markRuntimeWallpaperApplied()
  if (markApplied) {
    lastAppliedBackgroundMediaSignature = mediaSignature
    void waitForBackgroundImageReady(imageUrl, applyToken).then((readyImage) => {
      if (applyToken !== backgroundApplyToken || mediaSignature !== lastAppliedBackgroundMediaSignature) {
        return
      }
      if (readyImage) {
        setActiveBackgroundImageNaturalSize(imageUrl, readyImage, mediaSignature)
        applyFeaturedBackgroundDisplayPreferences()
        markInstantWallpaperRemoteReady(mediaSignature)
      }
      if (revealWhenReady) {
        markWallpaperReady()
      }
    })
  }
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
    cacheTask = createBackgroundUrlCacheTask(normalizedUrl, settings)
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

function createBackgroundUrlCacheTask(
  imageUrl: string,
  settings: typeof DEFAULT_BACKGROUND_SETTINGS
): BackgroundUrlCacheTask {
  const startupPreviewUrl = getStartupPreviewImageUrl(settings, imageUrl)
  const startupBlob = fetchStartupBackgroundUrlImage(startupPreviewUrl, imageUrl)
  const durableBlob = startupBlob.then(async (blob) => {
    let durable = blob
    if (startupPreviewUrl && startupPreviewUrl !== imageUrl) {
      try {
        durable = await fetchBackgroundUrlImage(imageUrl)
      } catch {
        durable = blob
      }
    }
    try {
      await saveBackgroundUrlCache(imageUrl, durable)
    } catch {
      // The visible wallpaper and instant startup cache are more important than the durable cache.
    }
    return durable
  })
  durableBlob.catch(() => {})

  return {
    startupBlob,
    durableBlob
  }
}

async function fetchStartupBackgroundUrlImage(previewUrl: string, imageUrl: string): Promise<Blob> {
  const normalizedPreviewUrl = normalizeBackgroundImageUrl(previewUrl)
  if (!normalizedPreviewUrl || normalizedPreviewUrl === imageUrl) {
    return fetchBackgroundUrlImage(imageUrl)
  }

  try {
    await ensureBackgroundImageFetchPermission(normalizedPreviewUrl)
    return await fetchBackgroundUrlImage(normalizedPreviewUrl)
  } catch {
    return fetchBackgroundUrlImage(imageUrl)
  }
}

async function applyCachedRemoteBackgroundBlobToCurrentPage(
  blob: Blob,
  mediaSignature: string,
  applyToken: number
): Promise<boolean> {
  if (
    applyToken !== backgroundApplyToken ||
    !mediaSignature ||
    mediaSignature !== getBackgroundMediaSignature(state.backgroundSettings)
  ) {
    return false
  }

  const ready = await setBackgroundImageFromBlob(blob, applyToken, {
    preserveCurrentUntilReady: true
  }, mediaSignature)
  if (
    !ready ||
    applyToken !== backgroundApplyToken ||
    mediaSignature !== getBackgroundMediaSignature(state.backgroundSettings)
  ) {
    return false
  }

  clearVideoBackground()
  lastAppliedBackgroundMediaSignature = mediaSignature
  markInstantWallpaperRemoteReady(mediaSignature)
  markWallpaperReady()
  return true
}

function scheduleFeaturedBackgroundGalleryPreviewObjectUrlWarm(): void {
  runIdle(() => {
    if (!backgroundGalleryModule) {
      return
    }
    void warmFeaturedBackgroundPickerPreviewObjectUrls(backgroundGalleryModule)
  }, { timeout: 1600 })
}

async function warmFeaturedBackgroundPickerPreviewObjectUrls(gallery: BackgroundGalleryModule): Promise<void> {
  const urls = getFeaturedBackgroundPickerPreviewUrls(gallery)
  const signature = urls.join('|')
  if (!signature) {
    return
  }
  if (
    featuredBackgroundGalleryPreviewObjectUrlWarmTask &&
    featuredBackgroundGalleryPreviewObjectUrlWarmSignature === signature
  ) {
    return featuredBackgroundGalleryPreviewObjectUrlWarmTask
  }

  featuredBackgroundGalleryPreviewObjectUrlWarmSignature = signature
  featuredBackgroundGalleryPreviewObjectUrlWarmTask = warmFeaturedBackgroundPreviewObjectUrls(urls).finally(() => {
    if (featuredBackgroundGalleryPreviewObjectUrlWarmSignature === signature) {
      featuredBackgroundGalleryPreviewObjectUrlWarmTask = null
    }
  })
  return featuredBackgroundGalleryPreviewObjectUrlWarmTask
}

async function warmFeaturedBackgroundPreviewObjectUrls(urls: string[]): Promise<void> {
  const workers = Array.from(
    { length: Math.min(FEATURED_BACKGROUND_PREVIEW_OBJECT_URL_WARM_CONCURRENCY, urls.length) },
    async (_, workerIndex) => {
      for (let index = workerIndex; index < urls.length; index += FEATURED_BACKGROUND_PREVIEW_OBJECT_URL_WARM_CONCURRENCY) {
        await createFeaturedBackgroundPreviewObjectUrl(urls[index])
      }
    }
  )
  await Promise.all(workers)
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

function getFeaturedBackgroundPickerPreviewUrls(gallery: BackgroundGalleryModule): string[] {
  const urls = new Set<string>()

  for (const item of getFeaturedBackgroundPickerItems(gallery)) {
    const previewUrl = getFeaturedBackgroundPreviewSourceUrl(item.provider, item.imageUrl)
    if (previewUrl) {
      urls.add(previewUrl)
    }
  }
  return [...urls]
}

async function setBackgroundImageFromBlob(
  blob: Blob,
  applyToken = backgroundApplyToken,
  { preserveCurrentUntilReady = false }: { preserveCurrentUntilReady?: boolean } = {},
  mediaSignature = ''
): Promise<boolean> {
  const objectUrl = URL.createObjectURL(blob)
  if (!preserveCurrentUntilReady) {
    setActiveBackgroundObjectUrl(objectUrl)
  }
  const readyImage = await waitForBackgroundImageReady(objectUrl, applyToken)
  if (applyToken !== backgroundApplyToken) {
    if (preserveCurrentUntilReady) {
      URL.revokeObjectURL(objectUrl)
    }
    return false
  }
  if (readyImage) {
    if (preserveCurrentUntilReady) {
      setActiveBackgroundObjectUrl(objectUrl)
    }
    setActiveBackgroundImageNaturalSize(objectUrl, readyImage, mediaSignature)
    applyFeaturedBackgroundDisplayPreferences()
    document.body.style.backgroundImage = `url("${escapeCssUrl(objectUrl)}")`
    markRuntimeWallpaperApplied()
    markInstantWallpaperRemoteReady(mediaSignature)
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
  if (!mediaSignature) {
    return
  }

  const displayCss = getBackgroundDisplayCssForSettings(settings)
  const recordBase = {
    signature: mediaSignature,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    placeholderColor: getBackgroundPlaceholderColor(settings),
    updatedAt: Date.now(),
    ready: true
  }

  for (const attempt of INSTANT_WALLPAPER_STARTUP_CACHE_ATTEMPTS) {
    const dataUrl = await createInstantWallpaperDataUrl(blob, attempt)
    if (!dataUrl) {
      continue
    }
    if (saveInstantWallpaper({
      ...recordBase,
      dataUrl
    })) {
      syncInstantWallpaperTargetForSettings(settings, mediaSignature)
      updateBackgroundStartupCacheStatus(settings)
      return
    }
  }

  syncInstantWallpaperTargetForSettings(settings, mediaSignature)
  updateBackgroundStartupCacheStatus(settings)
}

function syncInstantWallpaperTargetForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaSignature = getBackgroundMediaSignature(settings)
): void {
  const target = buildInstantWallpaperTargetForSettings(settings, mediaSignature)
  if (!target) {
    clearInstantWallpaperTarget()
    clearInstantWallpaperIfSignatureChanged('')
    return
  }

  const existingTarget = readInstantWallpaperTarget()
  saveInstantWallpaperTarget(target)
  if (existingTarget?.signature && existingTarget.signature !== target.signature) {
    clearInstantWallpaperFallbackStyles()
  }
  clearInstantWallpaperIfSignatureChanged(target.signature)
}

function buildInstantWallpaperTargetForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaSignature = getBackgroundMediaSignature(settings)
): InstantWallpaperTargetRecord | null {
  if (!mediaSignature) {
    return null
  }

  const displayCss = getBackgroundDisplayCssForSettings(settings)
  const instantWallpaper = readInstantWallpaper()
  const existingTarget = readInstantWallpaperTarget()
  const existingTargetMatches = existingTarget?.signature === mediaSignature
  const resolvedImageUrl = isRemoteBackgroundType(settings.type) ? getRemoteBackgroundImageUrl(settings) : ''
  const imageUrl = resolvedImageUrl || (existingTargetMatches ? existingTarget.imageUrl : '')
  const previewUrl = getStartupPreviewImageUrl(settings, imageUrl) ||
    (existingTargetMatches ? existingTarget.previewUrl : '')
  return {
    signature: mediaSignature,
    imageUrl,
    previewUrl,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    placeholderColor: getBackgroundPlaceholderColor(settings),
    cacheRequired: settings.type !== 'color',
    cacheReady: instantWallpaper?.signature === mediaSignature && instantWallpaper.ready !== false,
    updatedAt: Date.now()
  }
}

function getStartupPreviewImageUrl(settings: typeof DEFAULT_BACKGROUND_SETTINGS, imageUrl = getRemoteBackgroundImageUrl(settings)): string {
  if (settings.type !== 'featured') {
    return ''
  }

  const item = getActiveFeaturedBackgroundItemSync(settings)
  if (!item) {
    return ''
  }
  return getFeaturedBackgroundPreviewImageUrl(item, imageUrl)
}

function getFeaturedBackgroundPreviewImageUrl(
  item: Pick<FeaturedBackgroundItem, 'provider'>,
  imageUrl: string
): string {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  try {
    const url = new URL(normalizedUrl)
    if (item.provider === 'met' && url.hostname === 'images.metmuseum.org') {
      url.pathname = url.pathname.replace('/original/', '/web-large/')
      return url.href
    }
    if (item.provider === 'nasa' && url.hostname === 'images-assets.nasa.gov') {
      url.pathname = url.pathname.replace(/~(?:orig|large|medium)(\.[a-z0-9]+)$/i, '~small$1')
      return url.href
    }
    if (item.provider === 'wikimedia' && url.hostname === 'upload.wikimedia.org') {
      const pathParts = url.pathname.split('/')
      const filename = pathParts[pathParts.length - 1] || ''
      const resizedFilename = filename.replace(/^\d+px-/, '960px-')
      if (resizedFilename !== filename) {
        pathParts[pathParts.length - 1] = resizedFilename
        url.pathname = pathParts.join('/')
        return url.href
      }
      const commonsIndex = pathParts.findIndex((part) => part === 'commons')
      if (commonsIndex >= 0 && pathParts[commonsIndex + 1] !== 'thumb' && filename) {
        pathParts.splice(commonsIndex + 1, 0, 'thumb')
        pathParts.push(`960px-${filename}`)
        url.pathname = pathParts.join('/')
        return url.href
      }
    }
    if (item.provider === 'artic' && url.hostname === 'www.artic.edu') {
      url.pathname = url.pathname.replace('/full/2560,/', '/full/960,/')
      return url.href
    }
    if (item.provider === 'cleveland' && url.hostname === 'openaccess-cdn.clevelandart.org') {
      url.pathname = url.pathname.replace(/_print\.jpg$/i, '_web.jpg')
      return url.href
    }
  } catch {
    return ''
  }

  return ''
}

function getBackgroundDisplayCssForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS
): BackgroundDisplayCss {
  if (settings.type === 'featured') {
    return getFeaturedBackgroundDisplayCss(
      state.featuredBackgroundPreferences,
      getFeaturedBackgroundDisplayImageSize(settings, getBackgroundMediaSignature(settings))
    )
  }
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

function clearInstantWallpaperIfSignatureChanged(mediaSignature: string): void {
  const instantWallpaper = readInstantWallpaper()
  if (instantWallpaper && instantWallpaper.signature !== mediaSignature) {
    clearInstantWallpaper()
    clearInstantWallpaperFallbackStyles()
  }
}

function clearInstantWallpaperFallbackStyles(): void {
  const rootElement = document.documentElement
  window.clearTimeout(instantWallpaperRemoteReadyFallbackTimer)
  instantWallpaperRemoteReadyFallbackTimer = 0
  rootElement.classList.remove('instant-wallpaper-ready')
  rootElement.classList.remove('instant-wallpaper-remote-ready')
  delete rootElement.dataset.instantWallpaperSignature
  delete rootElement.dataset.instantWallpaperPending
  delete rootElement.dataset.instantWallpaperRemoteReady
  rootElement.style.removeProperty('--instant-wallpaper-image')
  rootElement.style.removeProperty('--instant-wallpaper-preview-image')
  rootElement.style.removeProperty('--instant-wallpaper-size')
  rootElement.style.removeProperty('--instant-wallpaper-position')
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

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`
}

function applyBackgroundMaskSettings(settings = state.backgroundSettings): void {
  const mask = cachedEl('newtab-background-mask')
  document.documentElement.style.setProperty('--background-mask-blur', `${settings.maskBlur}px`)

  if (mask instanceof HTMLElement) {
    mask.dataset.maskStyle = settings.maskStyle
  }
}

function clearVideoBackground(): void {
  document.querySelector('.newtab-background-video')?.remove()
}

function setActiveBackgroundObjectUrl(nextUrl: string): void {
  if (activeBackgroundObjectUrl && activeBackgroundObjectUrl !== nextUrl) {
    URL.revokeObjectURL(activeBackgroundObjectUrl)
  }
  activeBackgroundObjectUrl = nextUrl
}

function setActiveBackgroundImageNaturalSize(
  imageUrl: string,
  image: HTMLImageElement,
  mediaSignature = lastAppliedBackgroundMediaSignature
): void {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) {
    return
  }
  const naturalSize = { width, height }
  activeBackgroundImageNaturalSize = naturalSize
  activeBackgroundImageNaturalSizeSignature = mediaSignature
  if (imageUrl) {
    backgroundImageNaturalSizeByUrl.set(imageUrl, naturalSize)
  }
}

function getStoredBackgroundNaturalSizeForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS
): BackgroundImageNaturalSize | null {
  const imageUrl = isRemoteBackgroundType(settings.type) ? getRemoteBackgroundImageUrl(settings) : ''
  return imageUrl ? backgroundImageNaturalSizeByUrl.get(imageUrl) || null : null
}

function getFeaturedBackgroundDisplayImageSize(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaSignature = getBackgroundMediaSignature(settings)
): BackgroundImageNaturalSize | null {
  const activeItem = getActiveFeaturedBackgroundItemSync(settings)
  if (activeItem?.width && activeItem.height) {
    return {
      width: activeItem.width,
      height: activeItem.height
    }
  }
  if (
    activeBackgroundImageNaturalSize &&
    activeBackgroundImageNaturalSizeSignature === mediaSignature
  ) {
    return activeBackgroundImageNaturalSize
  }
  return getStoredBackgroundNaturalSizeForSettings(settings)
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
  return type === 'urls' || type === 'featured'
}

function getRemoteBackgroundImageUrl(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  if (settings.type === 'featured') {
    const featuredItem = getActiveFeaturedBackgroundItemSync(settings)
    if (featuredItem) {
      return featuredItem.imageUrl
    }
    void loadBackgroundGalleryModule().then(() => {
      if (settings === state.backgroundSettings) {
        void applyBackgroundSettings()
      }
    }).catch(() => {})
    return ''
  }

  if (settings.type === 'urls') {
    return normalizeBackgroundImageUrl(settings.url)
  }

  return ''
}

function getActiveFeaturedBackgroundItemSync(settings = state.backgroundSettings): FeaturedBackgroundItem | null {
  const galleryItem = getStoredFeaturedBackgroundItemById(settings.featuredId)
  if (galleryItem) {
    return galleryItem
  }
  if (!backgroundGalleryModule) {
    return null
  }
  return backgroundGalleryModule.getFeaturedBackgroundItemById(settings.featuredId) ||
    backgroundGalleryModule.selectFeaturedBackgroundItem(getFeaturedBackgroundDateSeed()) ||
    backgroundGalleryModule.getDefaultFeaturedBackgroundItem()
}

async function getActiveFeaturedBackgroundItem(settings = state.backgroundSettings): Promise<FeaturedBackgroundItem> {
  const galleryItem = getStoredFeaturedBackgroundItemById(settings.featuredId)
  if (galleryItem) {
    return galleryItem
  }
  const gallery = await loadBackgroundGalleryModule()
  return gallery.getFeaturedBackgroundItemById(settings.featuredId) ||
    gallery.selectFeaturedBackgroundItem(getFeaturedBackgroundDateSeed()) ||
    gallery.getDefaultFeaturedBackgroundItem()
}

function getStoredFeaturedBackgroundItemById(id: unknown): FeaturedBackgroundItem | null {
  const normalizedId = String(id || '').trim()
  if (!normalizedId) {
    return null
  }
  return state.featuredBackgroundGallery.find((item) => item.id === normalizedId) || null
}

function getFeaturedBackgroundDateSeed(): string {
  return formatNewTabLocalDate(Date.now())
}

function scheduleFeaturedBackgroundDailyRefresh(): void {
  window.clearTimeout(featuredBackgroundRefreshTimer)
  featuredBackgroundRefreshTimer = 0
  if (state.backgroundSettings.type !== 'featured' || hasExplicitFeaturedBackgroundSelection(state.backgroundSettings)) {
    return
  }

  const now = new Date()
  const nextMidnight = new Date(now)
  nextMidnight.setHours(24, 0, 0, 0)
  const delay = Math.max(1000, nextMidnight.getTime() - now.getTime() + FEATURED_BACKGROUND_DAILY_REFRESH_GRACE_MS)
  featuredBackgroundRefreshTimer = window.setTimeout(() => {
    featuredBackgroundRefreshTimer = 0
    applyFeaturedBackgroundDailyRefreshIfNeeded()
  }, delay)
}

function handleNewTabVisibilityChange(): void {
  if (document.visibilityState !== 'visible') {
    return
  }

  void hydrateFeaturedBackgroundOptions()
  applyFeaturedBackgroundDailyRefreshIfNeeded()
}

function applyFeaturedBackgroundDailyRefreshIfNeeded(): void {
  if (state.backgroundSettings.type !== 'featured' || hasExplicitFeaturedBackgroundSelection(state.backgroundSettings)) {
    return
  }

  const nextSignature = getBackgroundMediaSignature(state.backgroundSettings)
  if (nextSignature === lastAppliedBackgroundMediaSignature) {
    scheduleFeaturedBackgroundDailyRefresh()
    return
  }

  lastAppliedBackgroundMediaSignature = ''
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(state.backgroundSettings))
  void hydrateFeaturedBackgroundOptions(true)
  syncBackgroundSettingsControls()
  void applyBackgroundSettings()
  scheduleFeaturedBackgroundDailyRefresh()
}

function hasExplicitFeaturedBackgroundSelection(settings = state.backgroundSettings): boolean {
  const featuredId = String(settings.featuredId || '').trim()
  if (!featuredId) {
    return false
  }

  if (getStoredFeaturedBackgroundItemById(featuredId)) {
    return true
  }
  return backgroundGalleryModule
    ? Boolean(backgroundGalleryModule.getFeaturedBackgroundItemById(featuredId))
    : true
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

async function createOptimizedBackgroundImageBlob(blob: Blob): Promise<Blob> {
  if (blob.type.toLowerCase() === 'image/gif') {
    return blob
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return blob
  }

  try {
    const targetMaxDimension = getBackgroundCacheTargetDimension()
    const sourceMaxDimension = Math.max(bitmap.width, bitmap.height)
    if (!sourceMaxDimension || sourceMaxDimension <= targetMaxDimension) {
      return blob
    }

    const scale = targetMaxDimension / sourceMaxDimension
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) {
      return blob
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    const optimizedBlob = await canvasToBlob(canvas, 'image/webp', BACKGROUND_URL_CACHE_QUALITY)
    if (!optimizedBlob || optimizedBlob.size >= blob.size) {
      return blob
    }

    return optimizedBlob
  } finally {
    bitmap.close()
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

function getBackgroundCacheTargetDimension(): number {
  const viewportMaxDimension = Math.max(window.innerWidth || 0, window.innerHeight || 0, 1280)
  const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  return Math.min(BACKGROUND_URL_CACHE_MAX_DIMENSION, Math.ceil(viewportMaxDimension * pixelRatio))
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, type, quality)
  })
}

function normalizeSearchSettings(rawSettings: unknown): typeof DEFAULT_SEARCH_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_SEARCH_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const placeholder = String(settings.placeholder || '').trim() || DEFAULT_SEARCH_SETTINGS.placeholder
  const engine = normalizeSearchEngineId(settings.engine, DEFAULT_SEARCH_SETTINGS.engine)
  return {
    enabled: settings.enabled !== false,
    webSearchEnabled: settings.webSearchEnabled !== false,
    openInNewTab: settings.openInNewTab === true,
    engine,
    enabledEngines: normalizeEnabledSearchEngineIds(settings.enabledEngines, engine),
    placeholder,
    naturalSearchEnabled: settings.naturalSearchEnabled === true,
    naturalSearchAiConfigured: settings.naturalSearchAiConfigured === true,
    autoVerticalCenter: settings.autoVerticalCenter === true,
    width: clampNumber(settings.width, 16, 72, DEFAULT_SEARCH_SETTINGS.width),
    height: clampNumber(settings.height, 28, 56, DEFAULT_SEARCH_SETTINGS.height),
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
  return String(settings.placeholder || '').trim() || DEFAULT_SEARCH_SETTINGS.placeholder
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
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = window.setTimeout(() => {
    searchSettingsSaveTimer = 0
    void saveSearchSettings().catch((error) => {
      console.warn('新标签页搜索设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
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
    rows: rows.map((setting, index) => createModuleSettingRowViewModel(setting, index, rows.length))
  })
}

function createModuleSettingRowViewModel(
  setting: ReturnType<typeof buildNewTabModuleSettingRows>[number],
  index = 0,
  total = 1
): NewtabModuleSettingRowView {
  return {
    description: setting.description,
    enabled: setting.enabled,
    index,
    key: setting.key,
    label: setting.label,
    total
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
    setSettingsSaveStatus('error', error instanceof Error ? error.message : '模块设置保存失败')
  })
  syncNewTabModernSettingsControls()
  scheduleRender({ updateClock: true })
}

function handleModuleSettingMove(key: NewTabModuleSettingKey, direction: -1 | 1): void {
  if (!key || !(key in state.moduleSettings)) {
    return
  }

  state.moduleSettings = moveNewTabModuleSetting(state.moduleSettings, key, direction)
  void saveNewTabModuleSettings().catch((error) => {
    setSettingsSaveStatus('error', error instanceof Error ? error.message : '模块排序保存失败')
  })
  syncNewTabModernSettingsControls()
  scheduleRender({ updateClock: true })
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
  const signature = buildFolderCandidateRenderSignature({
    rootNode: state.rootNode,
    folderData: state.folderData,
    folderNodeMap: state.folderNodeMap,
    folderCandidateQuery: state.folderCandidateQuery,
    selectedFolderIds: state.folderSettings.selectedFolderIds,
    folderCandidatesExpanded: state.folderCandidatesExpanded
  })
  return getCachedFolderCandidates(state.folderCandidateCache, signature, getFolderCandidates)
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
  updateClockText()

  folderReorderStatusTimer = window.setTimeout(() => {
    clearFolderReorderStatus()
    render()
    updateClockText()
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
  const content = root?.querySelector<HTMLElement>('.newtab-content')
  const page = root?.querySelector<HTMLElement>('.newtab-page')
  if (!content) {
    scheduleRender({ updateClock: true })
    return
  }

  const gridSettings = {
    ...state.iconSettings,
    columns: getResponsiveIconColumns(state.iconSettings)
  }
  content.style.setProperty('--icon-page-width', `${getIconPageWidthPx(state.iconSettings.pageWidth)}px`)
  content.style.setProperty('--icon-column-gap', `${getIconGapPx(state.iconSettings.columnGap)}px`)
  content.style.setProperty('--icon-row-gap', `${getIconRowGapPx(state.iconSettings.rowGap)}px`)
  content.style.setProperty('--icon-folder-gap', `${getFolderGapPx(state.iconSettings.folderGap)}px`)
  content.style.setProperty('--icon-tile-width', `${getEffectiveIconTileWidthPx(state.iconSettings)}px`)
  content.style.setProperty('--icon-shell-size', `${state.iconSettings.iconShellSize}px`)
  content.style.setProperty('--icon-fixed-grid-width', `${getFixedIconGridWidthPx(gridSettings)}px`)
  content.style.setProperty('--icon-columns', String(gridSettings.columns))
  content.style.setProperty('--icon-title-lines', String(state.iconSettings.titleLines))
  content.dataset.iconLayoutMode = state.iconSettings.layoutMode
  content.dataset.iconShowTitles = String(state.iconSettings.showTitles)
  content.dataset.iconVerticalCenter = String(state.iconSettings.verticalCenter)
  if (page instanceof HTMLElement) {
    page.dataset.iconVerticalCenter = String(state.iconSettings.verticalCenter)
  }
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
  const preset = ICON_LAYOUT_PRESETS[presetKey]
  state.iconSettings = normalizeIconSettings({
    ...preset,
    verticalCenter: state.iconSettings.verticalCenter,
    preset: presetKey
  })
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标预设保存失败。', error)
  })
  applyIconSettingsLive()
  syncIconSettingsControls()
  updateClockText()
}

function resetIconSettingsToDefaults(): void {
  state.iconSettings = normalizeIconSettings(DEFAULT_ICON_SETTINGS)
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标默认布局保存失败。', error)
  })
  applyIconSettingsLive()
  syncIconSettingsControls()
  updateClockText()
}

async function saveSettingsWithFeedback(values: Record<string, unknown>): Promise<void> {
  clearSettingsSaveStatus()
  try {
    await setLocalStorage(values)
    clearSettingsSaveStatus()
  } catch (error) {
    setSettingsSaveStatus('error', '保存失败，本次调整仅临时生效；刷新后会恢复到上次已保存状态')
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
  const preview = cachedEl('icon-live-preview')
  if (!preview) {
    return
  }

  const signature = getIconPreviewSignature(state.iconSettings)
  if (preview.dataset.iconPreviewSignature === signature && preview.firstElementChild) {
    return
  }

  renderIconPreview()
}

function renderIconPreview(): void {
  const preview = cachedEl('icon-live-preview')
  if (!preview) {
    return
  }

  renderIconPreviewElement(
    preview,
    state.iconSettings
  )
}

async function hydrateFeaturedBackgroundOptions(force = false): Promise<void> {
  const dateSeed = getFeaturedBackgroundDateSeed()
  if (state.backgroundSettings.type !== 'featured' ||
    (!force && featuredBackgroundOptionsHydratedDateSeed === dateSeed)) {
    return
  }

  await loadBackgroundGalleryModule()
  const currentDateSeed = getFeaturedBackgroundDateSeed()
  if (!force && featuredBackgroundOptionsHydratedDateSeed === currentDateSeed) {
    return
  }

  featuredBackgroundOptionsHydratedDateSeed = currentDateSeed
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
}

let featuredBackgroundModalReady = false
let featuredBackgroundModalReadyPromise: Promise<void> | null = null
let resolveFeaturedBackgroundModalReady: (() => void) | null = null

function ensureFeaturedBackgroundModalReady(): Promise<void> {
  if (featuredBackgroundModalReady) return Promise.resolve()
  if (!featuredBackgroundModalReadyPromise) {
    featuredBackgroundModalReadyPromise = new Promise<void>((resolve) => {
      resolveFeaturedBackgroundModalReady = resolve
    })
  }
  return featuredBackgroundModalReadyPromise
}

function initializeFeaturedBackgroundModal(): void {
  if (featuredBackgroundModalReady) return
  featuredBackgroundModal = cachedEl('background-featured-modal')
  featuredBackgroundModalGrid = cachedEl('background-featured-modal-grid')
  featuredBackgroundModalClose = cachedEl('background-featured-modal-close')
  featuredBackgroundPicker = cachedEl('background-featured-picker')
  if (!featuredBackgroundModal || !featuredBackgroundModalGrid) {
    window.requestAnimationFrame(initializeFeaturedBackgroundModal)
    return
  }

  featuredBackgroundModalReady = true
  resolveFeaturedBackgroundModalReady?.()
  syncFeaturedBackgroundModalControls()
}

async function openFeaturedBackgroundPicker(): Promise<void> {
  await ensureFeaturedBackgroundModalReady()
  if (!(featuredBackgroundModal instanceof HTMLElement) ||
    !(featuredBackgroundModalGrid instanceof HTMLElement)) {
    return
  }

  featuredBackgroundModalReturnFocusElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  dispatchNewtabFeaturedBackgroundModalOpen(true)
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())

  await openFeaturedBackgroundPickerContent({
    getLoadedGallery: () => backgroundGalleryModule,
    loadGallery: loadBackgroundGalleryModule,
    isOpen: isFeaturedBackgroundPickerOpen,
    hasRenderedContent: () =>
      !!featuredBackgroundModalGrid?.querySelector('.featured-wallpaper-card'),
    showLoading: () => {
      dispatchNewtabFeaturedBackgroundPickerView({
        type: 'state',
        label: '正在载入精选图库'
      })
    },
    showError: () => {
      dispatchNewtabFeaturedBackgroundPickerView({
        type: 'state',
        label: '精选图库载入失败'
      })
    },
    render: renderFeaturedBackgroundPicker,
    focusInitialTarget: focusFeaturedBackgroundPickerInitialTarget,
    scheduleFrame: (callback) => {
      window.requestAnimationFrame(callback)
    },
    schedulePreviewWarm: (callback) => {
      scheduleFeaturedBackgroundPreviewWarm(callback)
    },
    warmPreviewObjectUrls: warmFeaturedBackgroundPickerPreviewObjectUrls
  })
}

function scheduleFeaturedBackgroundPreviewWarm(callback: () => void): void {
  window.clearTimeout(featuredBackgroundGalleryPreviewWarmTimer)
  featuredBackgroundGalleryPreviewWarmTimer = window.setTimeout(() => {
    featuredBackgroundGalleryPreviewWarmTimer = 0
    if (!isFeaturedBackgroundPickerOpen()) {
      return
    }
    runIdle(() => {
      if (isFeaturedBackgroundPickerOpen()) {
        callback()
      }
    }, { timeout: 1600 })
  }, 1600)
}

function clearFeaturedBackgroundPreviewWarmTimers(): void {
  window.clearTimeout(featuredBackgroundGalleryPreviewWarmTimer)
  featuredBackgroundGalleryPreviewWarmTimer = 0
}

function focusFeaturedBackgroundPickerInitialTarget(): void {
  if (!(featuredBackgroundModalGrid instanceof HTMLElement) || !isFeaturedBackgroundPickerOpen()) {
    return
  }
  const activeCard = featuredBackgroundModalGrid.querySelector<HTMLElement>('.featured-wallpaper-card.is-selected')
  const firstCard = featuredBackgroundModalGrid.querySelector<HTMLElement>('.featured-wallpaper-card')
  ;(activeCard || firstCard || featuredBackgroundModalClose as HTMLElement | null)?.focus()
}

function closeFeaturedBackgroundPicker(): void {
  if (!(featuredBackgroundModal instanceof HTMLElement) || !isFeaturedBackgroundPickerOpen()) {
    return
  }

  clearFeaturedBackgroundHoverPreview()
  clearFeaturedBackgroundPreviewWarmTimers()
  disconnectFeaturedBackgroundCardPreviewObserver()
  featuredBackgroundCardPreviewRegistry.resetVisibility()
  dispatchNewtabFeaturedBackgroundModalOpen(false)
  dispatchNewtabFeaturedBackgroundPickerView(null)
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())

  const returnElement = featuredBackgroundModalReturnFocusElement
  featuredBackgroundModalReturnFocusElement = null
  if (returnElement?.isConnected && !returnElement.hasAttribute('disabled')) {
    returnElement.focus()
    return
  }
  featuredBackgroundPicker?.focus()
}

function handleFeaturedBackgroundModalCloseRequest(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  closeFeaturedBackgroundPicker()
}

function handleFeaturedBackgroundModalPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (target === featuredBackgroundModal || target.closest('#background-featured-modal-close')) {
    handleFeaturedBackgroundModalCloseRequest(event)
  }
}

function isFeaturedBackgroundPickerOpen(): boolean {
  return featuredBackgroundModal instanceof HTMLElement && getNewtabFeaturedBackgroundModalOpen()
}

function getFeaturedBackgroundCardPreviewObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') {
    return null
  }

  if (!featuredBackgroundCardPreviewObserver) {
    featuredBackgroundCardPreviewObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) {
          continue
        }
        hydrateFeaturedBackgroundCardPreview(entry.target)
      }
    }, {
      root: featuredBackgroundModalGrid instanceof HTMLElement ? featuredBackgroundModalGrid : null,
      rootMargin: '280px 0px'
    })
    featuredBackgroundCardPreviewObservedRoot = featuredBackgroundModalGrid instanceof HTMLElement
      ? featuredBackgroundModalGrid
      : null
  } else if (featuredBackgroundCardPreviewObservedRoot !== featuredBackgroundModalGrid) {
    disconnectFeaturedBackgroundCardPreviewObserver()
    return getFeaturedBackgroundCardPreviewObserver()
  }

  return featuredBackgroundCardPreviewObserver
}

function disconnectFeaturedBackgroundCardPreviewObserver(): void {
  featuredBackgroundCardPreviewObserver?.disconnect()
  featuredBackgroundCardPreviewObserver = null
  featuredBackgroundCardPreviewObservedRoot = null
}

function observeFeaturedBackgroundCardPreview(card: HTMLElement): void {
  if (!card.isConnected) {
    return
  }
  const observer = getFeaturedBackgroundCardPreviewObserver()
  if (!observer) {
    runMicroIdle(() => {
      hydrateFeaturedBackgroundCardPreview(card)
    })
    return
  }
  observer.observe(card)
}

function hydrateFeaturedBackgroundCardPreview(card: HTMLElement): void {
  const entry = featuredBackgroundCardPreviewRegistry.markVisible(card)
  if (!entry) {
    return
  }
  featuredBackgroundCardPreviewObserver?.unobserve(card)
  const imageUrl = String(card.dataset.featuredBackgroundPreviewUrl || '')
  const remotePreviewUrl = String(entry.image.dataset.remotePreviewUrl || imageUrl)
  if (!imageUrl) {
    return
  }
  const image = entry.image as HTMLImageElement
  const cachedPreviewObjectUrl = featuredBackgroundGalleryPreviewObjectUrlCache.get(remotePreviewUrl)
  if (cachedPreviewObjectUrl && image.src !== cachedPreviewObjectUrl) {
    image.src = cachedPreviewObjectUrl
    card.dataset.featuredBackgroundResolvedPreviewUrl = cachedPreviewObjectUrl
    return
  }
  if (!image.src) {
    image.src = remotePreviewUrl
    card.dataset.featuredBackgroundResolvedPreviewUrl = remotePreviewUrl
  }
}

function observeFeaturedBackgroundCardPreviews(): void {
  if (!(featuredBackgroundModalGrid instanceof HTMLElement)) {
    return
  }
  const cards = featuredBackgroundModalGrid.querySelectorAll<HTMLElement>('.featured-wallpaper-card')
  hydrateFeaturedBackgroundInitialCardPreviews(cards)
  scheduleFeaturedBackgroundCardPreviewObservation(cards)
}

function hydrateFeaturedBackgroundInitialCardPreviews(cards: NodeListOf<HTMLElement>): void {
  let hydrated = 0
  for (const card of cards) {
    if (hydrated >= FEATURED_GALLERY_INITIAL_PREVIEW_HYDRATION_LIMIT) {
      return
    }
    hydrateFeaturedBackgroundCardPreview(card)
    hydrated += 1
  }
}

function scheduleFeaturedBackgroundCardPreviewObservation(cards: NodeListOf<HTMLElement>): void {
  let cursor = FEATURED_GALLERY_INITIAL_PREVIEW_HYDRATION_LIMIT
  const observeNextChunk = () => {
    if (!isFeaturedBackgroundPickerOpen()) {
      return
    }

    const end = Math.min(cursor + FEATURED_GALLERY_PREVIEW_HYDRATION_CHUNK_SIZE, cards.length)
    for (; cursor < end; cursor += 1) {
      observeFeaturedBackgroundCardPreview(cards[cursor])
    }
    if (cursor < cards.length) {
      runMicroIdle(observeNextChunk)
    }
  }

  runMicroIdle(observeNextChunk)
}

function renderFeaturedBackgroundPicker(gallery: BackgroundGalleryModule): void {
  if (!(featuredBackgroundModalGrid instanceof HTMLElement)) {
    return
  }

  clearFeaturedBackgroundHoverPreview()
  const staticFeaturedBackgroundIds = new Set(gallery.FEATURED_BACKGROUND_ITEMS.map((item) => item.id))
  const selectedId = state.backgroundSettings.featuredId
  const pickerSections = getFeaturedBackgroundPickerSections(gallery)
  const pickerItems = [...pickerSections.favorites, ...pickerSections.refreshed]
  const renderSignature = [
    selectedId,
    state.featuredBackgroundFavoriteIds.join(','),
    ...pickerItems.map((item) => `${item.id}:${item.imageUrl}`)
  ].join('|')
  if (featuredBackgroundPickerRenderSignature === renderSignature &&
    featuredBackgroundModalGrid.querySelector('.featured-wallpaper-card')) {
    syncFeaturedBackgroundModalControls()
    observeFeaturedBackgroundCardPreviews()
    return
  }

  clearFeaturedBackgroundCardPreviewRegistry()
  syncFeaturedBackgroundModalControls()

  const refreshedNasaItems = pickerSections.refreshed.filter((item) => item.provider === 'nasa')
  const refreshedWikimediaItems = pickerSections.refreshed.filter((item) => item.provider === 'wikimedia')
  dispatchNewtabFeaturedBackgroundPickerView({
    type: 'sections',
    sections: [
      {
        type: 'grid',
        section: createFeaturedBackgroundPickerGridSectionViewModel({
          title: '收藏壁纸',
          emptyText: '还没有收藏壁纸',
          items: pickerSections.favorites,
          staticFeaturedBackgroundIds,
          selectedId,
          renderIndexOffset: 0
        })
      },
      {
        type: 'providers',
        title: '刷新图库',
        groups: [
          createFeaturedBackgroundPickerProviderGroupViewModel({
            title: 'NASA',
            emptyText: '刷新图库后会显示 NASA 图片',
            items: refreshedNasaItems,
            staticFeaturedBackgroundIds,
            selectedId,
            renderIndexOffset: pickerSections.favorites.length
          }),
          createFeaturedBackgroundPickerProviderGroupViewModel({
            title: 'Wikimedia',
            emptyText: '刷新图库后会显示 Wikimedia 图片',
            items: refreshedWikimediaItems,
            staticFeaturedBackgroundIds,
            selectedId,
            renderIndexOffset: pickerSections.favorites.length + refreshedNasaItems.length
          })
        ]
      }
    ]
  })
  featuredBackgroundPickerRenderSignature = renderSignature
  window.requestAnimationFrame(() => {
    if (!(featuredBackgroundModalGrid instanceof HTMLElement) || !isFeaturedBackgroundPickerOpen()) {
      return
    }
    registerFeaturedBackgroundRenderedCards(featuredBackgroundModalGrid)
    observeFeaturedBackgroundCardPreviews()
  })
}

function createFeaturedBackgroundPickerProviderGroupViewModel(
  {
    title,
    emptyText,
    items,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset
  }: {
    title: string
    emptyText: string
    items: FeaturedBackgroundItem[]
    staticFeaturedBackgroundIds: Set<string>
    selectedId: string
    renderIndexOffset: number
  }
): FeaturedBackgroundPickerProviderGroupViewModel {
  return {
    title,
    emptyText,
    cards: createFeaturedBackgroundPickerCardViewModels({
      items,
      staticFeaturedBackgroundIds,
      selectedId,
      renderIndexOffset
    })
  }
}

function createFeaturedBackgroundPickerGridSectionViewModel(
  {
    title,
    emptyText,
    items,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset
  }: {
    title: string
    emptyText: string
    items: FeaturedBackgroundItem[]
    staticFeaturedBackgroundIds: Set<string>
    selectedId: string
    renderIndexOffset: number
  }
): FeaturedBackgroundPickerGridSectionViewModel {
  return {
    title,
    emptyText,
    cards: createFeaturedBackgroundPickerCardViewModels({
      items,
      staticFeaturedBackgroundIds,
      selectedId,
      renderIndexOffset
    })
  }
}

function createFeaturedBackgroundPickerCardViewModels(
  {
    items,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset
  }: {
    items: FeaturedBackgroundItem[]
    staticFeaturedBackgroundIds: Set<string>
    selectedId: string
    renderIndexOffset: number
  }
): FeaturedBackgroundPickerCardViewModel[] {
  return items.map((item, index) => createFeaturedBackgroundPickerCardViewModel({
    item,
    bundledPreviewUrl: staticFeaturedBackgroundIds.has(item.id)
      ? getFeaturedBackgroundBundledThumbnailUrl(item.id)
      : '',
    selected: selectedId === item.id,
    favorite: isFeaturedBackgroundFavorite(item.id),
    renderIndex: renderIndexOffset + index
  }))
}

function getFeaturedBackgroundPickerItems(gallery: BackgroundGalleryModule): FeaturedBackgroundItem[] {
  return buildFeaturedBackgroundPickerItems({
    storedItems: state.featuredBackgroundGallery,
    staticItems: gallery.FEATURED_BACKGROUND_ITEMS,
    favoriteIds: state.featuredBackgroundFavoriteIds,
    selectedId: state.backgroundSettings.featuredId
  })
}

function getFeaturedBackgroundPickerSections(gallery: BackgroundGalleryModule): FeaturedBackgroundPickerSections {
  return buildFeaturedBackgroundPickerSections({
    storedItems: state.featuredBackgroundGallery,
    staticItems: gallery.FEATURED_BACKGROUND_ITEMS,
    favoriteIds: state.featuredBackgroundFavoriteIds,
    selectedId: state.backgroundSettings.featuredId
  })
}

function getFeaturedBackgroundPreviewSourceUrl(
  itemOrProvider: FeaturedBackgroundItem['provider'] | Pick<FeaturedBackgroundItem, 'provider'>,
  imageUrl: string
): string {
  const provider = typeof itemOrProvider === 'string'
    ? itemOrProvider
    : itemOrProvider.provider
  const candidates = getFeaturedBackgroundPreviewCandidates(imageUrl, provider)
  return candidates[0] || ''
}

function getFeaturedBackgroundProviderForUrl(imageUrl: string): FeaturedBackgroundItem['provider'] {
  try {
    const url = new URL(normalizeBackgroundImageUrl(imageUrl))
    if (url.hostname === 'images-assets.nasa.gov') {
      return 'nasa'
    }
    if (url.hostname === 'images.metmuseum.org') {
      return 'met'
    }
    if (url.hostname === 'upload.wikimedia.org') {
      return 'wikimedia'
    }
    if (url.hostname === 'www.artic.edu') {
      return 'artic'
    }
    if (url.hostname === 'openaccess-cdn.clevelandart.org') {
      return 'cleveland'
    }
  } catch {
    // ignore
  }
  return 'wikimedia'
}

function getFeaturedBackgroundPreviewPlaceholderColor({
  provider,
  accentColor,
  imageUrl,
  title,
  credit
}: {
  provider: FeaturedBackgroundItem['provider']
  accentColor?: string
  imageUrl: string
  title: string
  credit: string
}): string {
  void imageUrl
  void title
  void credit
  if (typeof accentColor === 'string' && accentColor.trim()) {
    return getNonBlackPlaceholderColor(accentColor)
  }
  return getNonBlackPlaceholderColor(
    provider === 'met'
      ? '#18200f'
      : provider === 'nasa'
        ? '#06080d'
        : provider === 'artic'
          ? '#142026'
          : provider === 'cleveland'
            ? '#1c1518'
            : '#14191d'
  )
}

const FEATURED_BACKGROUND_BUNDLED_THUMBNAIL_URL_BY_ID: Record<string, string> = {
  'met-wheat-field-with-cypresses': 'featured-gallery-thumbnails/met-wheat-field-with-cypresses.jpg',
  'wikimedia-water-lilies-monet': 'featured-gallery-thumbnails/wikimedia-water-lilies-monet.jpg',
  'nasa-apollo-earthrise': 'featured-gallery-thumbnails/nasa-apollo-earthrise.jpg',
  'met-venice-from-the-porch': 'featured-gallery-thumbnails/met-venice-from-the-porch.jpg',
  'wikimedia-among-sierra-nevada': 'featured-gallery-thumbnails/wikimedia-among-sierra-nevada.jpg',
  'nasa-andromeda-infrared': 'featured-gallery-thumbnails/nasa-andromeda-infrared.jpg',
  'met-sunflowers': 'featured-gallery-thumbnails/met-sunflowers.jpg',
  'wikimedia-starry-night': 'featured-gallery-thumbnails/wikimedia-starry-night.jpg',
  'nasa-eagle-nebula-wise': 'featured-gallery-thumbnails/nasa-eagle-nebula-wise.jpg',
  'met-cypresses': 'featured-gallery-thumbnails/met-cypresses.jpg',
  'wikimedia-great-wave': 'featured-gallery-thumbnails/wikimedia-great-wave.jpg',
  'nasa-earth-limb-aurora': 'featured-gallery-thumbnails/nasa-earth-limb-aurora.jpg',
  'met-irises': 'featured-gallery-thumbnails/met-irises.jpg',
  'wikimedia-cotopaxi': 'featured-gallery-thumbnails/wikimedia-cotopaxi.jpg',
  'nasa-mars-landscape-curiosity': 'featured-gallery-thumbnails/nasa-mars-landscape-curiosity.jpg',
  'met-monet-family-garden': 'featured-gallery-thumbnails/met-monet-family-garden.jpg',
  'wikimedia-fighting-temeraire': 'featured-gallery-thumbnails/wikimedia-fighting-temeraire.jpg',
  'nasa-dust-devil-on-mars': 'featured-gallery-thumbnails/nasa-dust-devil-on-mars.jpg',
  'met-bouquet-flowers': 'featured-gallery-thumbnails/met-bouquet-flowers.jpg',
  'wikimedia-impression-sunrise': 'featured-gallery-thumbnails/wikimedia-impression-sunrise.jpg',
  'nasa-jupiter-southern-hemisphere': 'featured-gallery-thumbnails/nasa-jupiter-southern-hemisphere.jpg',
  'met-young-woman-water-pitcher': 'featured-gallery-thumbnails/met-young-woman-water-pitcher.jpg',
  'wikimedia-wanderer-sea-fog': 'featured-gallery-thumbnails/wikimedia-wanderer-sea-fog.jpg',
  'nasa-aurora-borealis-blankets-earth': 'featured-gallery-thumbnails/nasa-aurora-borealis-blankets-earth.jpg',
  'met-dance-class': 'featured-gallery-thumbnails/met-dance-class.jpg',
  'wikimedia-great-day-wrath': 'featured-gallery-thumbnails/wikimedia-great-day-wrath.jpg',
  'nasa-orion-nebula-infrared': 'featured-gallery-thumbnails/nasa-orion-nebula-infrared.jpg',
  'met-la-berceuse': 'featured-gallery-thumbnails/met-la-berceuse.jpg',
  'wikimedia-snow-storm-steamboat': 'featured-gallery-thumbnails/wikimedia-snow-storm-steamboat.jpg',
  'nasa-mars-cerberus-fossae': 'featured-gallery-thumbnails/nasa-mars-cerberus-fossae.jpg',
  'met-rembrandt-self-portrait': 'featured-gallery-thumbnails/met-rembrandt-self-portrait.jpg'
}

function getFeaturedBackgroundBundledThumbnailUrl(featuredId: string): string {
  const id = String(featuredId || '').trim()
  if (!id) return ''
  const path = FEATURED_BACKGROUND_BUNDLED_THUMBNAIL_URL_BY_ID[id]
  if (!path) return ''
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function') {
    return chrome.runtime.getURL(path)
  }
  return `/${path}`
}

async function resolveFeaturedBackgroundGalleryPreviewObjectUrlWithSource(
  imageUrl: string,
  { fallbackUrl = '' }: { fallbackUrl?: string } = {}
): Promise<string> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  const cachedObjectUrl = featuredBackgroundGalleryPreviewObjectUrlCache.get(normalizedUrl)
  if (cachedObjectUrl) {
    return cachedObjectUrl
  }

  return featuredBackgroundGalleryPreviewObjectUrlCache.resolve(
    normalizedUrl,
    async () => {
      const record = await getFeaturedBackgroundPreviewCacheRecord(normalizedUrl)
      if (record?.blob) {
        return record.blob
      }
      return null
    },
    { fallbackUrl: fallbackUrl || '' }
  )
}

async function resolveFeaturedBackgroundGalleryObjectUrl(imageUrl: string): Promise<string> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }
  return featuredBackgroundGalleryObjectUrlCache.resolve(
    normalizedUrl,
    () => getBackgroundUrlCache(normalizedUrl).then((record) => record?.blob || null),
    { fallbackUrl: '' }
  )
}

function revokeFeaturedBackgroundGalleryObjectUrls(): void {
  featuredBackgroundGalleryObjectUrlCache.clear()
}

function clearFeaturedBackgroundCardPreviewRegistry(): void {
  featuredBackgroundCardPreviewObserver?.disconnect()
  featuredBackgroundCardPreviewRegistry.clear()
  featuredBackgroundCardPreviewObserver = null
  featuredBackgroundCardPreviewObservedRoot = null
}

function createFeaturedBackgroundPickerCardViewModel({
  item,
  bundledPreviewUrl = '',
  selected,
  favorite = false,
  renderIndex = 0
}: {
  item: FeaturedBackgroundItem
  bundledPreviewUrl?: string
  selected: boolean
  favorite?: boolean
  renderIndex?: number
}): FeaturedBackgroundPickerCardViewModel {
  const imageUrl = item.imageUrl
  const title = item.title
  const previewAccentColor = getFeaturedBackgroundPreviewPlaceholderColor({
    provider: item.provider,
    accentColor: item.accentColor,
    imageUrl,
    title,
    credit: title
  })
  const remotePreviewUrl = getFeaturedBackgroundPreviewImageUrl({ provider: item.provider }, imageUrl) || imageUrl
  const previewFallbackUrls = [
    remotePreviewUrl,
    imageUrl
  ].filter((url, index, urls) => Boolean(url) && url !== bundledPreviewUrl && urls.indexOf(url) === index)
  const initialPreviewUrl = featuredBackgroundGalleryPreviewObjectUrlCache.get(remotePreviewUrl) ||
    bundledPreviewUrl ||
    remotePreviewUrl
  const resolutionText = formatFeaturedBackgroundResolution(item)

  return {
    favorite,
    fetchpriority: renderIndex < FEATURED_GALLERY_HIGH_PRIORITY_PREVIEW_LIMIT ? 'high' : 'auto',
    id: item.id,
    imageUrl,
    initialPreviewUrl,
    onClearHoverPreview: clearFeaturedBackgroundHoverPreview,
    onFavoriteToggle: (_card, id) => toggleFeaturedBackgroundFavorite(id),
    onSelect: (_card, id) => selectFeaturedBackgroundFromPicker(id),
    onScheduleHoverPreview: scheduleFeaturedBackgroundHoverPreview,
    previewAccentColor,
    previewFallbackUrls,
    remotePreviewUrl,
    resolutionState: resolutionText ? 'ready' : 'pending',
    resolutionText: resolutionText || '检测中',
    selected,
    title
  }
}

function registerFeaturedBackgroundRenderedCards(grid: HTMLElement): void {
  for (const card of grid.querySelectorAll<HTMLElement>('.featured-wallpaper-card')) {
    const preview = card.querySelector<HTMLElement>('.featured-wallpaper-preview')
    const image = card.querySelector<HTMLImageElement>('.featured-wallpaper-preview-image')
    if (!image) {
      continue
    }
    featuredBackgroundCardPreviewRegistry.register({
      card,
      image,
      accentColor: preview?.style.getPropertyValue('--featured-wallpaper-preview-placeholder') || ''
    })
    const initialPreviewUrl = card.dataset.featuredBackgroundResolvedPreviewUrl || image.currentSrc || image.src
    if (initialPreviewUrl) {
      card.dataset.featuredBackgroundResolvedPreviewUrl = initialPreviewUrl
    }
  }
}

function formatFeaturedBackgroundResolution(item: Pick<FeaturedBackgroundItem, 'width' | 'height'>): string {
  const width = Number(item.width)
  const height = Number(item.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `${Math.round(width)} x ${Math.round(height)}`
}

function scheduleFeaturedBackgroundHoverPreview(card: HTMLElement): void {
  if (!isFeaturedBackgroundPickerOpen()) {
    return
  }

  const imageUrl = card.dataset.featuredBackgroundPreviewUrl || ''
  if (!imageUrl) {
    return
  }

  if (featuredBackgroundPreviewCard === card) {
    return
  }

  window.clearTimeout(featuredBackgroundPreviewTimer)
  featuredBackgroundPreviewTimer = window.setTimeout(() => {
    featuredBackgroundPreviewTimer = 0
    showFeaturedBackgroundHoverPreview(card)
  }, FEATURED_BACKGROUND_HOVER_PREVIEW_DELAY_MS)
}

function showFeaturedBackgroundHoverPreview(card: HTMLElement): void {
  if (!isFeaturedBackgroundPickerOpen() || !card.isConnected) {
    clearFeaturedBackgroundHoverPreview(card)
    return
  }

  const imageUrl = card.dataset.featuredBackgroundPreviewUrl || ''
  if (!imageUrl) {
    return
  }

  const fallbackUrl = card.dataset.featuredBackgroundResolvedPreviewUrl || imageUrl
  const position = getFeaturedBackgroundHoverPreviewPosition(card)
  featuredBackgroundPreviewCard = card
  dispatchNewtabFeaturedBackgroundHoverPreviewView({
    ariaLabel: `${card.dataset.featuredBackgroundPreviewTitle || '精选图库壁纸'} 大图预览`,
    backgroundImage: `url("${escapeCssUrl(fallbackUrl)}")`,
    height: position.height,
    left: position.left,
    top: position.top,
    visible: true,
    width: position.width
  })
  void resolveFeaturedBackgroundGalleryObjectUrl(imageUrl).then((cachedUrl) => {
    if (!cachedUrl || featuredBackgroundPreviewCard !== card) {
      return
    }
    dispatchNewtabFeaturedBackgroundHoverPreviewBackgroundImage(`url("${escapeCssUrl(cachedUrl)}")`)
  })
}

function getFeaturedBackgroundHoverPreviewPosition(card: HTMLElement): {
  height: number
  left: number
  top: number
  width: number
} {
  const cardRect = card.getBoundingClientRect()
  const modalRect = featuredBackgroundModal instanceof HTMLElement
    ? featuredBackgroundModal.getBoundingClientRect()
    : document.documentElement.getBoundingClientRect()
  const previewWidth = Math.max(180, Math.min(560, window.innerWidth - 32))
  const previewHeight = Math.round(previewWidth * 0.625)
  const gap = 14
  const minLeft = modalRect.left + 16
  const maxLeft = modalRect.right - previewWidth - 16
  const left = Math.min(
    Math.max(cardRect.right + gap, minLeft),
    Math.max(minLeft, maxLeft)
  )
  const belowTop = cardRect.bottom + gap
  const aboveTop = cardRect.top - previewHeight - gap
  const maxTop = modalRect.bottom - previewHeight - 16
  const top = belowTop <= maxTop
    ? belowTop
    : Math.max(modalRect.top + 16, aboveTop)

  return {
    height: previewHeight,
    left,
    top,
    width: previewWidth
  }
}

function clearFeaturedBackgroundHoverPreview(card?: HTMLElement): void {
  if (card && featuredBackgroundPreviewCard && featuredBackgroundPreviewCard !== card) {
    return
  }

  window.clearTimeout(featuredBackgroundPreviewTimer)
  featuredBackgroundPreviewTimer = 0
  featuredBackgroundPreviewCard = null
  dispatchNewtabFeaturedBackgroundHoverPreviewHidden()
}

function applyFeaturedBackgroundDisplayPreferences(): void {
  const displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
  document.documentElement.style.setProperty('--instant-wallpaper-size', displayCss.backgroundSize)
  document.documentElement.style.setProperty('--instant-wallpaper-position', displayCss.backgroundPosition)
  document.body.style.backgroundSize = displayCss.backgroundSize
  document.body.style.backgroundPosition = displayCss.backgroundPosition
  updateInstantWallpaperDisplayCss(lastAppliedBackgroundMediaSignature, displayCss)
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, lastAppliedBackgroundMediaSignature || undefined)
}

function updateInstantWallpaperDisplayCss(
  mediaSignature: string,
  displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
): void {
  if (!mediaSignature) {
    return
  }
  const instantWallpaper = readInstantWallpaper()
  if (!instantWallpaper || instantWallpaper.signature !== mediaSignature) {
    return
  }
  saveInstantWallpaper({
    ...instantWallpaper,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    updatedAt: Date.now()
  })
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, mediaSignature)
}

function syncFeaturedBackgroundDisplayPreferenceControls(): void {
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
}

function syncFeaturedBackgroundModalControls(): void {
  state.featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences(state.featuredBackgroundPreferences)
  syncFeaturedBackgroundDisplayPreferenceControls()
  dispatchNewtabFeaturedBackgroundModalControls({
    refreshing: state.featuredBackgroundRefreshing,
    status: state.featuredBackgroundStatus,
    statusTone: state.featuredBackgroundStatusTone
  })
}

function isFeaturedBackgroundFavorite(featuredId: string): boolean {
  return state.featuredBackgroundFavoriteIds.includes(featuredId)
}

function scheduleFeaturedBackgroundPreferencesSave(): void {
  window.clearTimeout(featuredBackgroundPreferencesSaveTimer)
  featuredBackgroundPreferencesSaveTimer = window.setTimeout(() => {
    featuredBackgroundPreferencesSaveTimer = 0
    void saveFeaturedBackgroundPreferences().catch((error) => {
      console.warn('精选图库显示设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

async function saveFeaturedBackgroundPreferences(): Promise<void> {
  window.clearTimeout(featuredBackgroundPreferencesSaveTimer)
  featuredBackgroundPreferencesSaveTimer = 0
  state.featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences(state.featuredBackgroundPreferences)
  await setLocalStorage({
    [STORAGE_KEYS.newTabFeaturedBackgroundPreferences]: state.featuredBackgroundPreferences
  })
}

async function toggleFeaturedBackgroundFavorite(featuredId: string): Promise<void> {
  const id = String(featuredId || '').trim()
  if (!id) {
    return
  }

  const favoriteSet = new Set(state.featuredBackgroundFavoriteIds)
  if (favoriteSet.has(id)) {
    favoriteSet.delete(id)
  } else {
    favoriteSet.add(id)
  }
  state.featuredBackgroundFavoriteIds = [...favoriteSet]
  await saveFeaturedBackgroundFavorites()
  const gallery = await loadBackgroundGalleryModule()
  if (isFeaturedBackgroundPickerOpen()) {
    renderFeaturedBackgroundPicker(gallery)
  }
}

async function saveFeaturedBackgroundFavorites(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabFeaturedBackgroundFavorites]: state.featuredBackgroundFavoriteIds
  })
}

async function saveFeaturedBackgroundGallery(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabFeaturedBackgroundGallery]: state.featuredBackgroundGallery
  })
}

async function refreshFeaturedBackgroundGallery(): Promise<void> {
  if (state.featuredBackgroundRefreshing) {
    return
  }

  state.featuredBackgroundRefreshing = true
  setFeaturedBackgroundStatus('正在从 NASA、Wikimedia 拉取高清图...', 'info')
  syncFeaturedBackgroundModalControls()
  try {
    const permissionGranted = await ensureFeaturedBackgroundPermissions()
    if (!permissionGranted) {
      setFeaturedBackgroundStatus('未完成图库访问授权，暂时无法刷新。', 'warning')
      return
    }
    const refreshModule = await loadBackgroundGalleryRefreshModule()
    const fetchedItems = await refreshModule.fetchFreshFeaturedBackgroundItems({
      fetchJson,
      getImageSize: getRemoteImageSize
    }, {
      refreshSeed: `${getFeaturedBackgroundDateSeed()}:${Date.now()}`
    })
    if (!fetchedItems.length) {
      setFeaturedBackgroundStatus('没有拉取到满足高清要求的新图片。', 'warning')
      return
    }

    state.featuredBackgroundGallery = refreshModule.mergeFeaturedGalleryRefresh({
      existingItems: state.featuredBackgroundGallery,
      favoriteIds: state.featuredBackgroundFavoriteIds,
      fetchedItems
    })
    await saveFeaturedBackgroundGallery()
    setFeaturedBackgroundStatus(
      `已拉取 ${fetchedItems.length} 张高分辨率图片，收藏图片已保留。`,
      'success'
    )
    featuredBackgroundPickerRenderSignature = ''
    await renderFeaturedBackgroundPickerAfterRefresh()
    void clearFeaturedBackgroundPreviewCache().catch((cacheError) => {
      console.warn('精选图库预览缓存清除失败。', cacheError)
    })
  } catch (error) {
    setFeaturedBackgroundStatus(getFeaturedBackgroundRefreshErrorMessage(error), 'error')
  } finally {
    state.featuredBackgroundRefreshing = false
    syncFeaturedBackgroundModalControls()
  }
}

async function renderFeaturedBackgroundPickerAfterRefresh(): Promise<void> {
  try {
    const gallery = await loadBackgroundGalleryModule()
    renderFeaturedBackgroundPicker(gallery)
  } catch (error) {
    console.warn('精选图库已刷新，但弹窗列表更新失败。', error)
  }
}

async function ensureFeaturedBackgroundPermissions(): Promise<boolean> {
  if (!chrome.permissions?.contains || !chrome.permissions?.request) {
    return true
  }
  const refreshModule = await loadBackgroundGalleryRefreshModule()
  const query = { origins: refreshModule.getFeaturedBackgroundRefreshRequestOrigins() }
  if (await containsChromePermissions(query)) {
    return true
  }
  return requestChromePermissions(query)
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

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }
  return response.json()
}

function getRemoteImageSize(imageUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timeout = 0

    const settle = (size: { width: number; height: number } | null) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      resolve(size)
    }

    timeout = window.setTimeout(() => settle(null), REMOTE_BACKGROUND_READY_TIMEOUT_MS)
    image.onload = () => {
      settle({
        width: image.naturalWidth,
        height: image.naturalHeight
      })
    }
    image.onerror = () => settle(null)
    image.src = imageUrl
  })
}

function setFeaturedBackgroundStatus(
  message: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  state.featuredBackgroundStatus = message
  state.featuredBackgroundStatusTone = tone
}

function getFeaturedBackgroundRefreshErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/permission|denied|权限/i.test(message)) {
    return '图库刷新失败：没有第三方图库访问权限。'
  }
  if (/请求失败|status|404|403|401|500/i.test(message)) {
    return '图库刷新失败：图库接口暂时不可用，请稍后重试。'
  }
  return '图库刷新失败：请检查网络后重试。'
}

function selectFeaturedBackgroundFromPicker(featuredId: string): void {
  handleBackgroundSettingFieldChange('featuredId', featuredId)
  closeFeaturedBackgroundPicker()
}

function getFeaturedBackgroundPickerLabel(settings = state.backgroundSettings): string {
  const activeItem = getActiveFeaturedBackgroundItemSync(settings)
  if (!settings.featuredId) {
    return activeItem ? `精选图库 · ${activeItem.title}` : '选择壁纸'
  }

  return activeItem?.title || '当前精选图片'
}

async function hydrateFeaturedBackgroundCredit(settings: typeof DEFAULT_BACKGROUND_SETTINGS): Promise<void> {
  const hydrateVersion = ++featuredBackgroundUiVersion
  try {
    await getActiveFeaturedBackgroundItem(settings)
    if (hydrateVersion !== featuredBackgroundUiVersion) {
      return
    }
    dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
  } catch {
    // The credit link is an enhancement for featured backgrounds; keep the generic source link if loading fails.
  }
}

function submitSearch(value: string, openAllEnabled = false): void {
  const query = String(value || '').trim()
  if (!query) {
    return
  }

  const directUrl = getDirectNavigationUrl(query)
  if (directUrl) {
    openSearchTarget(directUrl)
    return
  }

  if (state.searchSettings.webSearchEnabled === false) {
    return
  }

  const targets = planSearchOpenTargets(
    query,
    state.searchSettings.engine,
    state.searchSettings.enabledEngines,
    openAllEnabled,
    SEARCH_MULTI_OPEN_LIMIT
  )
  openSearchTargets(targets.map((target) => target.url))
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

function openSearchTarget(targetUrl: string): void {
  openSearchTargets([targetUrl])
}

function openSearchTargets(targetUrls: string[]): void {
  const urls = targetUrls.filter(Boolean)
  if (!urls.length) {
    return
  }

  if (urls.length > 1) {
    for (const url of urls.slice(0, SEARCH_MULTI_OPEN_LIMIT)) {
      const opened = window.open(url, '_blank', 'noopener')
      if (opened) {
        opened.opener = null
      }
    }
    return
  }

  const targetUrl = urls[0]
  if (state.searchSettings.openInNewTab) {
    const opened = window.open(targetUrl, '_blank', 'noopener')
    if (opened) {
      opened.opener = null
    }
    return
  }

  window.location.assign(targetUrl)
}

function normalizeTimeSettingsLocal(rawSettings: unknown): NewTabTimeSettings {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_TIME_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const rawDateFormat = String(settings.dateFormat)
  const dateFormat = rawDateFormat === 'iso'
    ? 'year-month-day'
    : rawDateFormat === 'auto' || rawDateFormat === 'zh'
      ? 'month-day-weekday'
      : rawDateFormat
  const timeZone = String(settings.timeZone)
  const displayMode = String(settings.displayMode)
  const density = String(settings.density)

  return {
    enabled: settings.enabled !== false,
    showSeconds: settings.showSeconds === true,
    hour12: settings.hour12 === true,
    clockSize: clampNumber(settings.clockSize, 70, 140, DEFAULT_TIME_SETTINGS.clockSize),
    dateFormat: (dateFormat || DEFAULT_TIME_SETTINGS.dateFormat) as NewTabTimeSettings['dateFormat'],
    timeZone: (timeZone || DEFAULT_TIME_SETTINGS.timeZone) as NewTabTimeSettings['timeZone'],
    displayMode: displayMode === 'time' || displayMode === 'date' || displayMode === 'time-date'
      ? displayMode as NewTabTimeSettings['displayMode']
      : DEFAULT_TIME_SETTINGS.displayMode,
    density: density === 'compact' || density === 'balanced' || density === 'comfortable'
      ? density as NewTabTimeSettings['density']
      : DEFAULT_TIME_SETTINGS.density
  }
}

function syncTimeSettingsControls(): void {
  const settings = state.timeSettings
  dispatchNewtabTimeSettingsView(createNewtabTimeSettingsView(settings))
}

async function saveTimeSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabTimeSettings]: state.timeSettings
  })
}

function scheduleTimeSettingsSave(): void {
  window.clearTimeout(timeSettingsSaveTimer)
  timeSettingsSaveTimer = window.setTimeout(() => {
    timeSettingsSaveTimer = 0
    void saveTimeSettings().catch((error) => {
      console.warn('新标签页时间设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function scheduleClockTick(): void {
  window.clearTimeout(clockTimer)
  const delay = getClockUpdateDelayLocal(new Date(), state.timeSettings)
  if (delay <= 0) {
    clockTimer = 0
    return
  }

  clockTimer = window.setTimeout(() => {
    clockTimer = 0
    updateClockText()
    scheduleClockTick()
  }, delay)
}

function updateClockText(): void {
  if (!timeSettingsModule) {
    updateClockTextFallback()
    void hydrateClockText()
    return
  }

  const now = new Date()
  const settings = timeSettingsModule.normalizeTimeSettings(state.timeSettings)
  state.timeSettings = settings
  dispatchNewtabClockView({
    ariaLabel: timeSettingsModule.getClockAriaLabel(now, settings),
    dateDateTime: timeSettingsModule.formatClockDateTime(now, settings),
    dateText: timeSettingsModule.formatClockDate(now, settings),
    periodText: timeSettingsModule.formatClockPeriod(now, settings),
    settings,
    timeDateTime: timeSettingsModule.formatClockTimeDateTime(now, settings),
    timeText: timeSettingsModule.formatClockTime(now, settings)
  })
}

function updateClockTextFallback(): void {
  const now = new Date()
  dispatchNewtabClockView(createFallbackClockWidgetState(now, state.timeSettings))
}

function createFallbackClockWidgetState(
  date: Date,
  settings: NewTabTimeSettings
): NewtabClockView {
  return {
    ariaLabel: getFallbackClockAriaLabel(date, settings),
    dateDateTime: getFallbackClockDateTime(date),
    dateText: formatFallbackClockDate(date),
    periodText: formatFallbackClockPeriod(date),
    settings,
    timeDateTime: getFallbackClockTimeDateTime(date),
    timeText: formatFallbackClockTime(date, settings)
  }
}

function hydrateClockText(): void {
  const hydrateVersion = ++clockHydrationVersion
  void loadTimeSettingsModule()
    .then((timeSettings) => {
      if (hydrateVersion !== clockHydrationVersion) {
        return
      }
      updateClockText()
      scheduleClockTick()
    })
    .catch(() => {
      scheduleClockTick()
    })
}

function getClockUpdateDelayLocal(date: Date, settings: NewTabTimeSettings): number {
  if (!settings.enabled) {
    return 0
  }
  if (timeSettingsModule) {
    return timeSettingsModule.getClockUpdateDelay(date, settings)
  }
  const milliseconds = date.getMilliseconds()
  if (settings.displayMode === 'date') {
    return 60 * 60 * 1000
  }
  if (settings.showSeconds) {
    return Math.max(250, 1000 - milliseconds + 25)
  }
  return Math.max(1000, (60 - date.getSeconds()) * 1000 - milliseconds + 25)
}

function formatFallbackClockTime(date: Date, settings: NewTabTimeSettings): string {
  let hours = date.getHours()
  if (settings.hour12) {
    hours = hours % 12 || 12
  }
  const parts = [
    String(hours).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0')
  ]
  if (settings.showSeconds) {
    parts.push(String(date.getSeconds()).padStart(2, '0'))
  }
  return parts.join(':')
}

function formatFallbackClockPeriod(date: Date): string {
  return date.getHours() < 12 ? 'AM' : 'PM'
}

function formatFallbackClockDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getFullYear()}.${month}.${day} ${weekday}`
}

function getFallbackClockAriaLabel(date: Date, settings: NewTabTimeSettings): string {
  const parts: string[] = []
  if (settings.displayMode !== 'date') {
    parts.push(settings.hour12
      ? `${formatFallbackClockTime(date, settings)} ${formatFallbackClockPeriod(date)}`
      : formatFallbackClockTime(date, settings))
  }
  if (settings.displayMode !== 'time') {
    parts.push(formatFallbackClockDate(date))
  }
  return parts.join('，')
}

function getFallbackClockTimeDateTime(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join(':')
}

function getFallbackClockDateTime(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

function formatBytes(bytes: number): string {
  const size = Math.max(0, Number(bytes) || 0)
  if (size < 1024) {
    return `${Math.round(size)} B`
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
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

function getReadableTextColor(hexColor: string): string {
  const color = normalizeHexColor(hexColor, DEFAULT_BACKGROUND_SETTINGS.color).slice(1)
  const red = parseInt(color.slice(0, 2), 16)
  const green = parseInt(color.slice(2, 4), 16)
  const blue = parseInt(color.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000
  return luminance > 150 ? '#111111' : '#ffffff'
}

function getFaviconUrl(url: string, bookmarkId = ''): string {
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

