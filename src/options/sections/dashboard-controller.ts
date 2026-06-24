import type { BookmarkRecord, FolderRecord } from '../../shared/types.js'
import {
  buildBookmarkPathSegments,
  formatBookmarkPath,
  formatFolderPath
} from '../../shared/bookmark-path.js'
import {
  clearAiBookmarkTags,
  getEffectiveBookmarkTags,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTags,
  saveManualBookmarkTags,
  type BookmarkTagIndex,
  type BookmarkTagRecord
} from '../../shared/bookmark-tags.js'
import { displayUrl, normalizeText } from '../../shared/text.js'
import { moveBookmark } from '../../shared/bookmarks-api.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { createMemoryCache, type MemoryCache } from '../../shared/cache.js'
import { prefersReducedMotion } from '../../shared/motion.js'
import {
  buildSearchTextQuery,
  parseSearchQuery
} from '../../shared/search-query.js'
import {
  buildContentSnapshotSearchMapWithFullText,
  type ContentSnapshotIndex
} from '../../shared/content-snapshots.js'
import {
  BOOKMARKS_BAR_ID,
  NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE,
  NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE,
  STORAGE_KEYS,
  type NewTabSpeedDialStateMessage,
  type NewTabToggleSpeedDialMessage
} from '../../shared/constants.js'
import { getLocalStorage, setLocalStorage } from '../../shared/storage.js'
import { runIdle } from '../../shared/idle.js'
import {
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  toggleNewTabWorkspacePin
} from '../../shared/newtab-workspace-settings.js'
import {
  buildDashboardFolderBookmarkCounts,
  buildDashboardModel,
  filterDashboardItems,
  sortDashboardItems,
  type DashboardFilters,
  type DashboardFolderTarget,
  type DashboardItem,
  type DashboardModel,
  type DashboardSortKey
} from '../../shared/dashboard-model.js'
import {
  createDashboardSearchKey,
  getDashboardSearchResultLimit,
  getDashboardStructuralCandidateItems,
  mapDashboardSearchIdsToItems,
  sortDashboardCandidates
} from '../../shared/dashboard-query.js'
import { aiNamingState, availabilityState, contentSnapshotState, dashboardState, managerState } from '../shared-options/state.js'
import {
  getDashboardViewSnapshot,
  publishDashboardViewState
} from '../components/dashboard-view-store.js'
import { notifyDashboardViewReady } from '../components/dashboard-view-ready-store.js'
import type { DashboardViewActionDetail } from '../components/dashboard-view-types.js'
import {
  LOADING_LABEL_STATUS_LOADER_CLASS,
  LOADING_LABEL_STATUS_WRAPPER_CLASS
} from '../components/loading-label-classes.js'
import {
  type DashboardCardFaviconViewModel,
  type DashboardCardViewModel,
  type DashboardBreadcrumbSegmentViewModel,
  type DashboardDragOverlayState,
  type DashboardFolderDropTargetViewModel,
  type DashboardFolderSidebarItemViewModel,
  type DashboardLoadingLabelState,
  type DashboardPanelChromeState,
  type DashboardSearchChipViewModel,
  type DashboardTagEditorActionsState,
  type DashboardTagEditorFieldState
} from '../components/dashboard-view-types.js'
import { deleteBookmarksToRecycle } from './recycle.js'
import type { NaturalSearchPlan, NaturalSearchResultSet } from '../../popup/natural-search.js'
import {
  indexBookmarkForSearch,
  searchBookmarksTopK,
  searchBookmarksUnbounded,
  type PopupSearchBookmark,
  type PopupSearchResult
} from '../../popup/search.js'
import { measureNow as perfMeasureNow, logCount as perfLogCount } from '../../shared/perf.js'
import { queryLooksLikePinyin } from '../../shared/search/pinyin-query.js'
import type {
  DashboardSearchWorkerRequest,
  DashboardSearchWorkerResponse,
  DashboardSearchWorkerStructuralFilters
} from '../../shared/search/search-worker-contract.js'
export {
  computeDashboardVirtualWindow,
  getDashboardVirtualColumnCount,
  getDashboardVirtualOverscanRows,
  getDashboardVirtualRenderedCount
} from './dashboard-virtual.js'
import {
  DASHBOARD_CARD_HEIGHT,
  DASHBOARD_CARD_MIN_WIDTH,
  DASHBOARD_GRID_GAP,
  DASHBOARD_VIRTUAL_FAST_SCROLL_PX_PER_MS,
  DASHBOARD_VIRTUAL_MIN_READY_HEIGHT,
  DASHBOARD_VIRTUAL_MIN_READY_WIDTH,
  computeDashboardVirtualWindow,
  getDashboardVirtualColumnCount,
  type DashboardVirtualWindow
} from './dashboard-virtual.js'
import {
  DASHBOARD_FAVICON_FETCH_VERSION,
  DASHBOARD_FAVICON_SIZE,
  DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS,
  DASHBOARD_FAVICON_WARMUP_BATCH_SIZE,
  DASHBOARD_FAVICON_WARMUP_CONCURRENCY,
  DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS,
  buildDashboardFaviconUrl,
  clampDashboardInteger,
  createDashboardFaviconWarmupQueue,
  getDashboardCachedFaviconEntry as getDashboardCachedFaviconEntryFromCache,
  getDashboardFaviconCacheKey,
  getDashboardFaviconEndpointUrl,
  isDashboardSafeImageUrl,
  normalizeDashboardFaviconCache,
  warmDashboardFavicon,
  type DashboardFaviconCache,
  type DashboardFaviconCacheEntry,
  type DashboardFaviconWarmupQueue
} from './dashboard-favicons.js'
export {
  buildDashboardFaviconWarmupItems,
  createDashboardFaviconWarmupQueue,
  type DashboardFaviconWarmupItem
} from './dashboard-favicons.js'

export interface DashboardDragStateSnapshot {
  armed: boolean
  active: boolean
  moving: boolean
  bookmarkId: string
  pointerId: number
  hoverFolderId: string
  hoverDeleteTarget: boolean
  originX: number
  originY: number
  currentX: number
  currentY: number
}

interface DashboardDragState extends DashboardDragStateSnapshot {
  captureElement: HTMLElement | null
}

interface DashboardVirtualState {
  items: DashboardItem[]
  filterKey: string
  scrollResetKey: string
  filterChangeReason: DashboardVirtualFilterChangeReason
  scrollTop: number
  contentWidth: number
  containerHeight: number
  columnCount: number
  rowStride: number
  cardHeight: number
  minCardWidth: number
  renderedStartIndex: number
  renderedEndIndex: number
  renderedColumnCount: number
  renderedTotalHeight: number
  renderedOffsetY: number
  renderedStateKey: string
  renderedStaticListKey: string
  renderedItems: DashboardItem[] | null
  frame: number
  sectionFrame: number
  resultsMounted: boolean
  resetScrollOnNextRender: boolean
  pendingInitialMeasure: boolean
  measureRetryFrame: number
  lastResizeWidth: number
  lastResizeHeight: number
  lastResizeColumnCount: number
  lastScrollTop: number
  lastScrollAt: number
  isFastScrolling: boolean
  scrollIdleTimer: number
  scrollSettleTimer: number
  resultsMetrics: DashboardResultsMetricsSnapshot | null
}

interface DashboardResultsMetricsSnapshot {
  clientHeight: number
  clientWidth: number
  scrollHeight: number
  scrollTop: number
}

interface DashboardModelCacheKey {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  tagIndex: BookmarkTagIndex | null
  tagRecords: BookmarkTagIndex['records'] | null
  tagUpdatedAt: number
  contentSnapshotIndex: ContentSnapshotIndex | null
  contentSnapshotRecords: ContentSnapshotIndex['records'] | null
  contentSnapshotUpdatedAt: number
  contentSnapshotSearchMap: Map<string, string> | null
  contentSnapshotSearchMapSize: number
  includeFullText: boolean
}

type DashboardVirtualFilterChangeReason = 'folder' | 'query' | 'filter' | 'append'

interface DashboardRenderCache {
  modelKey: DashboardModelCacheKey | null
  model: DashboardModel | null
  visibleModel: DashboardModel | null
  visibleNaturalPlan: NaturalSearchPlan | null
  visibleQuery: string
  visibleFolderId: string
  visibleDomain: string
  visibleMonth: string
  visibleSortKey: DashboardSortKey
  visibleItems: DashboardItem[] | null
  folderCountsModel: DashboardModel | null
  folderBookmarkCounts: Map<string, number> | null
  sidebarModel: DashboardModel | null
  sidebarSelectedFolderId: string
  sidebarItems: DashboardFolderSidebarItemViewModel[] | null
  sidebarTotalFolders: number
}

interface DashboardNaturalSearchCacheEntry {
  plan: NaturalSearchPlan
  results: PopupSearchResult[]
}

interface DashboardPopupSearchIndexCache {
  model: DashboardModel | null
  tagRecords: BookmarkTagIndex['records'] | null
  tagUpdatedAt: number
  bookmarks: PopupSearchBookmark[] | null
  bookmarkById: Map<string, PopupSearchBookmark> | null
  pinyinReady: boolean
  pinyinPending: boolean
  pinyinRunId: number
  pinyinPriorityKey: string
  pinyinPriorityPending: boolean
}

interface DashboardSearchWorkerState {
  worker: Worker | null
  model: DashboardModel | null
  tagRecords: BookmarkTagIndex['records'] | null
  tagUpdatedAt: number
  pinyinReady: boolean
  indexReady: boolean
  indexSize: number
  initRequestId: number
  requestId: number
  pendingSearchKey: string
  limitByKey: Map<string, number>
  resultCache: Map<string, string[]>
  error: string
}

interface DashboardFaviconWarmupDebugSummary {
  skipped: number
  firstPageUrl: string
  firstError: string
}

interface DashboardCallbacks {
  renderAvailabilitySection: () => void
  hydrateAvailabilityCatalog: (options?: { preserveResults?: boolean }) => Promise<void>
  regenerateAiTags: (bookmark: BookmarkRecord, signal?: AbortSignal) => Promise<void>
  openMoveModal: (source: string) => void
  closeMoveModal: () => void
  exitDashboard?: () => void
  confirm: (options: {
    title: string
    copy: string
    confirmLabel: string
    label: string
    tone: string
  }) => Promise<boolean>
  recycleCallbacks: any
}

export const DASHBOARD_DRAG_MOVE_THRESHOLD = 4
const DASHBOARD_VIRTUAL_THRESHOLD = 90
const DASHBOARD_NEWTAB_EMBED_PARAM = 'newtab-dashboard'
const DASHBOARD_NATURAL_SEARCH_CACHE_LIMIT = 24
const DASHBOARD_NATURAL_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
const DASHBOARD_SEARCH_WORKER_THRESHOLD = 3000
const DASHBOARD_SEARCH_INITIAL_LIMIT = 240
const DASHBOARD_SEARCH_INCREMENT = 240
const DASHBOARD_SEARCH_MAX_SYNC_LIMIT = 1000
const DASHBOARD_SEARCH_SCROLL_PREFETCH_PX = 1200
const DASHBOARD_SEARCH_SCROLL_PREFETCH_MIN_INTERVAL_MS = 450
const DASHBOARD_SEARCH_SCROLL_PREFETCH_IDLE_TIMEOUT_MS = 650
const DASHBOARD_SCROLL_IDLE_MS = 110
const DASHBOARD_SCROLL_SETTLE_MS = 160
const DASHBOARD_FAVICON_DIRTY_SYNC_DELAY_MS = 160
const DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS = 220
const DASHBOARD_FAVICON_WARMUP_DEBUG_DELAY_MS = 1400
const dashboardDebugConsole = console

let dashboardStatusTimer = 0
let dashboardResultsStableFrame = 0
let dashboardResultsScrollRequestId = 0
let dashboardVirtualResizeFrame = 0
let dashboardTagRegenerateController: AbortController | null = null
let closingDashboardTagEditor = false
let dashboardSectionActive = false
let dashboardViewReady = false
let dashboardViewRevealFrame = 0
let dashboardViewRevealRenderVersion = 0
let dashboardCardsRenderVersion = 0
let dashboardCardsCommittedRenderVersion = 0
let dashboardListRenderFrame = 0
let dashboardListRenderPendingForScroll = false
let pendingDashboardFolderFocusId = ''
let dashboardSearchFocusRequestId = 0
let dashboardTagEditorFocusRequestId = 0
let dashboardCardMenuFocusRequestId = 0
let dashboardTagEditorPositionRequestId = 0
let dashboardFaviconWarmupQueue: DashboardFaviconWarmupQueue | null = null
let dashboardFaviconWarmupItems: DashboardItem[] | null = null
let dashboardFaviconWarmupKey = ''
let dashboardFaviconWarmupStartIndex = -1
let dashboardFaviconWarmupEndIndex = -1
let dashboardFaviconWarmupEndpointUrl = ''
let dashboardFaviconWarmupPendingItems: DashboardItem[] | null = null
let dashboardFaviconWarmupPendingStartIndex = -1
let dashboardFaviconWarmupPendingEndIndex = -1
let dashboardFaviconLoadSyncFrame = 0
let dashboardFaviconLoadSyncTimer = 0
let dashboardFaviconDirtySyncTimer = 0
const dashboardFaviconDirtyPageUrls = new Set<string>()
const dashboardFailedFaviconKeys = new Set<string>()
let dashboardFaviconCache: DashboardFaviconCache = {}
let dashboardFaviconCacheHydrated = false
let dashboardFaviconCacheSaveTimer = 0
let dashboardFaviconDebugSummaryTimer = 0
let dashboardFaviconWarmupDebugSummary: DashboardFaviconWarmupDebugSummary | null = null
let dashboardDragOverlayCloseTimer = 0
let dashboardDragOverlayCloseToken = 0
let dashboardSearchPrefetchIdleScheduled = false
let dashboardSearchPrefetchRetryTimer = 0
let dashboardSearchPrefetchLastRequestedAt = 0
let dashboardSearchPrefetchPendingKey = ''
let dashboardNaturalSearchModulePromise: Promise<typeof import('../../popup/natural-search.js')> | null = null
let dashboardNaturalSearchAiModulePromise: Promise<typeof import('../../popup/natural-search-ai.js')> | null = null
let dashboardActiveSearchKey = ''
let dashboardActiveSearchLimit = 0
let dashboardActiveSearchResultCount = 0
const dashboardPopupSearchIndexCache: DashboardPopupSearchIndexCache = {
  model: null,
  tagRecords: null,
  tagUpdatedAt: 0,
  bookmarks: null,
  bookmarkById: null,
  pinyinReady: false,
  pinyinPending: false,
  pinyinRunId: 0,
  pinyinPriorityKey: '',
  pinyinPriorityPending: false
}
const dashboardSearchWorkerState: DashboardSearchWorkerState = {
  worker: null,
  model: null,
  tagRecords: null,
  tagUpdatedAt: 0,
  pinyinReady: false,
  indexReady: false,
  indexSize: 0,
  initRequestId: 0,
  requestId: 0,
  pendingSearchKey: '',
  limitByKey: new Map(),
  resultCache: new Map(),
  error: ''
}
const dashboardNaturalSearchCache: MemoryCache<string, DashboardNaturalSearchCacheEntry> = createMemoryCache({
  maxEntries: DASHBOARD_NATURAL_SEARCH_CACHE_LIMIT,
  ttlMs: DASHBOARD_NATURAL_SEARCH_CACHE_TTL_MS,
  version: 'dashboard-natural-search-v1'
})
const EMPTY_DASHBOARD_TAG_RECORDS: BookmarkTagIndex['records'] = {}
const dashboardRenderCache: DashboardRenderCache = {
  modelKey: null,
  model: null,
  visibleModel: null,
  visibleNaturalPlan: null,
  visibleQuery: '',
  visibleFolderId: '',
  visibleDomain: '',
  visibleMonth: '',
  visibleSortKey: 'date-desc',
  visibleItems: null,
  folderCountsModel: null,
  folderBookmarkCounts: null,
  sidebarModel: null,
  sidebarSelectedFolderId: '',
  sidebarItems: null,
  sidebarTotalFolders: -1
}

const virtualState: DashboardVirtualState = {
  items: [],
  filterKey: '',
  scrollResetKey: '',
  filterChangeReason: 'filter',
  scrollTop: 0,
  contentWidth: 0,
  containerHeight: 0,
  columnCount: 1,
  rowStride: DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP,
  cardHeight: DASHBOARD_CARD_HEIGHT,
  minCardWidth: DASHBOARD_CARD_MIN_WIDTH,
  renderedStartIndex: -1,
  renderedEndIndex: -1,
  renderedColumnCount: 0,
  renderedTotalHeight: -1,
  renderedOffsetY: -1,
  renderedStateKey: '',
  renderedStaticListKey: '',
  renderedItems: null,
  frame: 0,
  sectionFrame: 0,
  resultsMounted: false,
  resetScrollOnNextRender: false,
  pendingInitialMeasure: false,
  measureRetryFrame: 0,
  lastResizeWidth: 0,
  lastResizeHeight: 0,
  lastResizeColumnCount: 0,
  lastScrollTop: 0,
  lastScrollAt: 0,
  isFastScrolling: false,
  scrollIdleTimer: 0,
  scrollSettleTimer: 0,
  resultsMetrics: null
}

function loadDashboardNaturalSearchModule(): Promise<typeof import('../../popup/natural-search.js')> {
  dashboardNaturalSearchModulePromise ||= import('../../popup/natural-search.js')
  return dashboardNaturalSearchModulePromise
}

function loadDashboardNaturalSearchAiModule(): Promise<typeof import('../../popup/natural-search-ai.js')> {
  dashboardNaturalSearchAiModulePromise ||= import('../../popup/natural-search-ai.js')
  return dashboardNaturalSearchAiModulePromise
}

const dragState: DashboardDragState = {
  ...createDashboardDragState(),
  captureElement: null
}

export function createDashboardDragState(
  overrides: Partial<DashboardDragStateSnapshot> = {}
): DashboardDragStateSnapshot {
  return {
    armed: false,
    active: false,
    moving: false,
    bookmarkId: '',
    pointerId: -1,
    hoverFolderId: '',
    hoverDeleteTarget: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    ...overrides
  }
}

export function hasDashboardDragPassedThreshold(
  state: DashboardDragStateSnapshot,
  x: number,
  y: number,
  threshold = DASHBOARD_DRAG_MOVE_THRESHOLD
): boolean {
  return Math.hypot(x - state.originX, y - state.originY) > threshold
}

export function updateDashboardDragHover(
  state: DashboardDragStateSnapshot,
  hoverFolderId: string
): DashboardDragStateSnapshot {
  return {
    ...state,
    hoverFolderId: String(hoverFolderId || '').trim()
  }
}

export function getDashboardSelectionLabel(
  item: Pick<DashboardItem, 'title' | 'path' | 'url'>
): string {
  const title = String(item.title || '').replace(/\s+/g, ' ').trim() || '未命名书签'
  const context = String(item.path || displayUrl(item.url) || '')
    .replace(/\s+/g, ' ')
    .trim()

  return context
    ? `选择书签：${title}，位置：${context}`
    : `选择书签：${title}`
}

export function getDashboardCardActionLabel(
  action: string,
  item: Pick<DashboardItem, 'title' | 'url'>
): string {
  const title = String(item.title || displayUrl(item.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}…` : title

  return `${action}：${safeTitle || '未命名书签'}`
}

export function createNewTabToggleSpeedDialMessage(bookmarkId: string): NewTabToggleSpeedDialMessage {
  return {
    type: NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE,
    bookmarkId: String(bookmarkId || '').trim()
  }
}

export function applyNewTabSpeedDialStateMessage(
  message: unknown
): boolean {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return false
  }

  const payload = message as Partial<NewTabSpeedDialStateMessage>
  if (payload.type !== NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE || !Array.isArray(payload.pinnedIds)) {
    return false
  }

  dashboardState.speedDialPinnedIds = new Set(
    payload.pinnedIds
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )
  renderDashboardSection()
  return true
}

export function isNewTabDashboardEmbed(search = window.location.search): boolean {
  return new URLSearchParams(search).get('embed') === DASHBOARD_NEWTAB_EMBED_PARAM
}

export function resetDashboardDragStateSnapshot(): DashboardDragStateSnapshot {
  return createDashboardDragState()
}

export function syncDashboardSelection(selection: Set<string>, validIds: Set<string>): Set<string> {
  for (const selectedId of [...selection]) {
    if (!validIds.has(String(selectedId))) {
      selection.delete(String(selectedId))
    }
  }
  return selection
}

export interface DashboardVirtualMetricsSnapshot {
  contentWidth: number
  containerHeight: number
  columnCount: number
}

function updateDashboardResultsMetricsSnapshot(detail: Partial<DashboardResultsMetricsSnapshot>): DashboardResultsMetricsSnapshot {
  const previous = virtualState.resultsMetrics || {
    clientHeight: 0,
    clientWidth: 0,
    scrollHeight: 0,
    scrollTop: 0
  }
  const next = {
    clientHeight: Math.max(0, Number(detail.clientHeight ?? previous.clientHeight) || 0),
    clientWidth: Math.max(0, Number(detail.clientWidth ?? previous.clientWidth) || 0),
    scrollHeight: Math.max(0, Number(detail.scrollHeight ?? previous.scrollHeight) || 0),
    scrollTop: Math.max(0, Number(detail.scrollTop ?? previous.scrollTop) || 0)
  }
  virtualState.resultsMetrics = next
  return next
}

function getDashboardVirtualMetricsFromResultsSnapshot(
  fallbackWidth = virtualState.contentWidth,
  fallbackHeight = virtualState.containerHeight
): DashboardVirtualMetricsSnapshot {
  const snapshot = virtualState.resultsMetrics
  if (!snapshot) {
    return {
      contentWidth: 0,
      containerHeight: 0,
      columnCount: 1
    }
  }

  const contentWidth = snapshot.clientWidth >= DASHBOARD_VIRTUAL_MIN_READY_WIDTH
    ? snapshot.clientWidth
    : Math.max(snapshot.clientWidth, Number(fallbackWidth) || 0)
  const containerHeight = snapshot.clientHeight >= DASHBOARD_VIRTUAL_MIN_READY_HEIGHT
    ? snapshot.clientHeight
    : Math.max(snapshot.clientHeight, Number(fallbackHeight) || 0)

  return {
    contentWidth,
    containerHeight,
    columnCount: getDashboardVirtualColumnCount(contentWidth, DASHBOARD_CARD_MIN_WIDTH)
  }
}

function getDashboardVirtualMetricsForController(): DashboardVirtualMetricsSnapshot {
  return getDashboardVirtualMetricsFromResultsSnapshot()
}

function getDashboardVirtualScrollTop(): number {
  const snapshotScrollTop = Math.max(0, Number(virtualState.resultsMetrics?.scrollTop) || 0)
  if (virtualState.resultsMetrics) {
    return snapshotScrollTop
  }
  return Math.max(0, Number(virtualState.scrollTop) || 0)
}

export function isDashboardVirtualMetricsReady(metrics: DashboardVirtualMetricsSnapshot): boolean {
  return (
    metrics.contentWidth >= DASHBOARD_VIRTUAL_MIN_READY_WIDTH &&
    metrics.containerHeight >= DASHBOARD_VIRTUAL_MIN_READY_HEIGHT
  )
}

function hasDashboardVirtualMetricsChanged(metrics: DashboardVirtualMetricsSnapshot): boolean {
  return (
    Math.round(metrics.contentWidth) !== Math.round(virtualState.lastResizeWidth) ||
    Math.round(metrics.containerHeight) !== Math.round(virtualState.lastResizeHeight) ||
    metrics.columnCount !== virtualState.lastResizeColumnCount
  )
}

export function shouldResetDashboardPanelRevealForRender({
  catalogLoading,
  viewReady
}: {
  catalogLoading: boolean
  viewReady: boolean
}): boolean {
  return Boolean(catalogLoading && viewReady)
}

export function shouldResetDashboardPanelRevealForSectionEntry({
  previousSectionKey,
  nextSectionKey
}: {
  previousSectionKey: string
  nextSectionKey: string
}): boolean {
  return previousSectionKey !== 'dashboard' && nextSectionKey === 'dashboard'
}

export function shouldRevealDashboardPanelAfterRender({
  catalogLoading,
  viewReady,
  revealFramePending,
  latestRenderVersion,
  revealRenderVersion,
  committedRenderVersion
}: {
  catalogLoading: boolean
  viewReady: boolean
  revealFramePending: boolean
  latestRenderVersion: number
  revealRenderVersion: number
  committedRenderVersion: number
}): boolean {
  const safeLatestVersion = Math.max(0, Math.floor(Number(latestRenderVersion) || 0))
  const safeRevealVersion = Math.max(0, Math.floor(Number(revealRenderVersion) || 0))
  const safeCommittedVersion = Math.max(0, Math.floor(Number(committedRenderVersion) || 0))

  return (
    !catalogLoading &&
    !viewReady &&
    !revealFramePending &&
    safeRevealVersion > 0 &&
    safeRevealVersion === safeLatestVersion &&
    safeCommittedVersion === safeRevealVersion
  )
}

export function shouldResetDashboardVirtualScrollForFilterChange({
  previousKey,
  nextKey,
  reason
}: {
  previousKey: string
  nextKey: string
  reason: DashboardVirtualFilterChangeReason
}): boolean {
  if (!nextKey || previousKey === nextKey) {
    return false
  }

  return reason !== 'folder' && reason !== 'append'
}

export function getSelectedDashboardBookmarks(): BookmarkRecord[] {
  return [...dashboardState.selectedIds]
    .map((id) => availabilityState.bookmarkMap.get(String(id)))
    .filter(Boolean)
}

function applyDashboardSelection(bookmarkId: string, checked: boolean): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return false
  }

  const isChecked = Boolean(checked)
  const isSelected = dashboardState.selectedIds.has(normalizedBookmarkId)
  if (isChecked === isSelected) {
    return false
  }

  if (isChecked) {
    dashboardState.selectedIds.add(normalizedBookmarkId)
  } else {
    dashboardState.selectedIds.delete(normalizedBookmarkId)
  }
  closeOpenDashboardCardMenu()
  return true
}

function toggleDashboardTagPopoverById(bookmarkId: string): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return false
  }

  closeOpenDashboardCardMenu()
  if (dashboardState.expandedTagIds.has(normalizedBookmarkId)) {
    closeDashboardTagPopover()
    return true
  }

  openDashboardTagPopoverById(normalizedBookmarkId)
  return true
}

function openDashboardTagPopoverById(bookmarkId: string): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return false
  }

  if (dashboardState.expandedTagIds.has(normalizedBookmarkId)) {
    return true
  }

  closeOpenDashboardCardMenu()
  dashboardState.expandedTagIds.clear()
  dashboardState.expandedTagIds.add(normalizedBookmarkId)
  renderDashboardSection()
  return true
}

function closeDashboardTagPopoverForId(bookmarkId: string): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId || !dashboardState.expandedTagIds.has(normalizedBookmarkId)) {
    return false
  }

  return closeDashboardTagPopover()
}

export function syncDashboardSelectionOnly(changedIds?: Set<string>): void {
  if (!dashboardSectionActive) {
    return
  }

  const { model, visibleItems } = getDashboardRenderData()
  if (changedIds?.size) {
    for (const bookmarkId of changedIds) {
      if (!availabilityState.bookmarkMap.has(String(bookmarkId))) {
        dashboardState.selectedIds.delete(String(bookmarkId))
      }
    }
  } else {
    syncDashboardSelection(
      dashboardState.selectedIds,
      new Set(model.items.map((item) => String(item.id)))
    )
  }
  renderDashboardSelectionBar(visibleItems)
  renderDashboardCards(visibleItems)
}

function syncDashboardCardMenuOnly(changedIds?: Set<string>): void {
  void changedIds
  renderDashboardSection()
}

export function __resetDashboardSearchCachesForTest(): void {
  invalidateDashboardPopupSearchCaches()
}

function getDashboardScopeTitle(folderId: string): string {
  const folder = folderId ? availabilityState.folderMap.get(folderId) : null
  if (!folder) {
    return '书签栏'
  }

  return formatFolderPath(folder, availabilityState.folderMap) || folder.title || '书签栏'
}

export function removeDashboardSelectionIds(bookmarkIds: unknown[]): void {
  for (const bookmarkId of bookmarkIds) {
    dashboardState.selectedIds.delete(String(bookmarkId))
  }
}

export function renderDashboardSection(): void {
  if (!dashboardSectionActive) {
    return
  }

  if (shouldResetDashboardPanelRevealForRender({
    catalogLoading: availabilityState.catalogLoading,
    viewReady: dashboardViewReady
  })) {
    resetDashboardPanelReveal()
  }
  const { model, visibleItems } = getDashboardRenderData()
  syncDashboardPanelReadyState()

  syncDashboardSelection(
    dashboardState.selectedIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  syncDashboardSelection(
    dashboardState.expandedTagIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  if (
    dashboardState.activeCardMenuBookmarkId &&
    !visibleItems.some((item) => String(item.id) === dashboardState.activeCardMenuBookmarkId)
  ) {
    dashboardState.activeCardMenuBookmarkId = ''
  }

  const effectiveFolderId = getDashboardEffectiveFolderId()
  const scopeTitle = getDashboardScopeTitle(effectiveFolderId)
  const scopedCountText = `(${visibleItems.length})`
  publishDashboardViewState({
    title: {
      countText: scopedCountText,
      title: scopeTitle
    },
    cardsTitle: scopeTitle
  })
  renderDashboardStatusOnly()
  renderDashboardSearchTools()
  renderDashboardFolderBreadcrumbs()
  renderDashboardFolderSidebar(model)

  renderDashboardSelectionBar(visibleItems)
  const renderVersion = beginDashboardCardsRender()
  renderDashboardCards(visibleItems, renderVersion)
  renderDashboardTagEditor(model)

  if (dragState.active) {
    renderDashboardDragOverlay(model)
  }
}

export function isDashboardViewReady(): boolean {
  return !availabilityState.catalogLoading && dashboardViewReady
}

export function prepareDashboardSectionEntry(): void {
  dashboardSectionActive = true
  resetDashboardPanelReveal()
  dashboardFaviconWarmupItems = null
  dashboardFaviconWarmupKey = ''
  clearPendingDashboardFaviconWarmup()
  scheduleDashboardFaviconLoadSync()
  startDashboardNaturalSearch()
}

export function teardownDashboardSectionExit(): void {
  dashboardSectionActive = false
  cancelDashboardDrag({ silent: true })
  resetDashboardSearchWorker()
  clearPendingDashboardFaviconWarmup()
  dashboardFaviconWarmupItems = null
  dashboardFaviconWarmupKey = ''
  releaseDashboardCaches()
}

export function releaseDashboardCaches(): void {
  clearStableDashboardResultsUpdate()
  resetDashboardVirtualRenderCache({ clearItems: true })
  invalidateDashboardPopupSearchCaches()
  dashboardNaturalSearchCache.clear()
  dashboardState.naturalSearchAbortController?.abort()
  dashboardState.naturalSearchAbortController = null
  dashboardState.naturalSearchPending = false
  dashboardState.naturalSearchPlan = null
  dashboardState.naturalSearchError = ''
  dashboardRenderCache.modelKey = null
  dashboardRenderCache.model = null
  dashboardRenderCache.visibleModel = null
  dashboardRenderCache.visibleNaturalPlan = null
  dashboardRenderCache.visibleQuery = ''
  dashboardRenderCache.visibleFolderId = ''
  dashboardRenderCache.visibleDomain = ''
  dashboardRenderCache.visibleMonth = ''
  dashboardRenderCache.visibleSortKey = 'date-desc'
  dashboardRenderCache.visibleItems = null
  dashboardRenderCache.folderCountsModel = null
  dashboardRenderCache.folderBookmarkCounts = null
  dashboardRenderCache.sidebarModel = null
  dashboardRenderCache.sidebarSelectedFolderId = ''
  dashboardRenderCache.sidebarItems = null
  dashboardRenderCache.sidebarTotalFolders = -1
  if (dashboardStatusTimer) {
    window.clearTimeout(dashboardStatusTimer)
    dashboardStatusTimer = 0
  }
  if (dashboardVirtualResizeFrame) {
    window.cancelAnimationFrame(dashboardVirtualResizeFrame)
    dashboardVirtualResizeFrame = 0
  }
  if (dashboardViewRevealFrame) {
    window.cancelAnimationFrame(dashboardViewRevealFrame)
    dashboardViewRevealFrame = 0
  }
  if (dashboardListRenderFrame) {
    window.cancelAnimationFrame(dashboardListRenderFrame)
    dashboardListRenderFrame = 0
  }
  pendingDashboardFolderFocusId = ''
  dashboardListRenderPendingForScroll = false
}

export function hydrateDashboardFaviconCache(rawCache: unknown, now = Date.now()): void {
  dashboardFaviconCache = normalizeDashboardFaviconCache(rawCache, { now })
  dashboardFaviconCacheHydrated = true
}

function requestDashboardSearchFocus(): void {
  dashboardSearchFocusRequestId += 1
  renderDashboardSearchTools()
}

export function updateDashboardSearchQuery(query: string): void {
  dashboardState.query = query
  ensureDashboardFullTextSearchMapForQuery()
  startDashboardNaturalSearch()
  invalidateDashboardVisibleItemCacheForSearchKey()
  markDashboardVirtualFilterChange('query')
  renderDashboardSearchTools()
  scheduleDashboardSectionRender()
}

export function updateDashboardTagEditorDraft(value: string): void {
  dashboardState.tagEditorDraft = value
  dashboardState.tagEditorStatus = ''
}

function closeOpenDashboardCardMenu({ restoreFocus = false }: { restoreFocus?: boolean } = {}): boolean {
  const activeBookmarkId = String(dashboardState.activeCardMenuBookmarkId || '').trim()
  if (!activeBookmarkId) {
    return false
  }

  dashboardState.activeCardMenuBookmarkId = ''
  renderDashboardSection()
  if (restoreFocus) {
    requestDashboardCardMenuFocus(activeBookmarkId)
  }
  return true
}

export function handleDashboardKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  if (event.key === 'Escape' && closeOpenDashboardCardMenu({ restoreFocus: true })) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  if (event.key === 'Escape' && dashboardState.expandedTagIds.size) {
    if (closeDashboardTagPopover()) {
      event.preventDefault()
      event.stopPropagation()
    }
    return
  }

  if (dashboardState.tagEditorBookmarkId && isDashboardTagEditorEvent(event)) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeDashboardTagEditor()
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void saveDashboardTagEditor()
    }
    return
  }

}

export async function handleDashboardViewAction(
  detail: DashboardViewActionDetail,
  callbacks: DashboardCallbacks
): Promise<void> {
  if (detail.action === 'query-change') {
    updateDashboardSearchQuery(detail.value)
    return
  }

  if (detail.action === 'card-menu-open-change') {
    if (detail.open) {
      const previousBookmarkId = String(dashboardState.activeCardMenuBookmarkId || '').trim()
      if (previousBookmarkId !== detail.bookmarkId) {
        dashboardState.activeCardMenuBookmarkId = detail.bookmarkId
        renderDashboardSection()
      }
    } else if (dashboardState.activeCardMenuBookmarkId === detail.bookmarkId) {
      dashboardState.activeCardMenuBookmarkId = ''
      renderDashboardSection()
    }
    return
  }

  if (detail.action === 'tag-editor-draft-change') {
    updateDashboardTagEditorDraft(detail.value)
    return
  }

  if (detail.action === 'results-mounted') {
    const metrics = updateDashboardResultsMetricsSnapshot(detail)
    handleDashboardVirtualResultsMounted(metrics.scrollTop)
  } else if (detail.action === 'results-unmounted') {
    handleDashboardVirtualResultsUnmounted()
  } else if (detail.action === 'results-resize') {
    updateDashboardResultsMetricsSnapshot(detail)
    handleDashboardVirtualResize()
  } else if (detail.action === 'results-scroll') {
    handleDashboardVirtualScroll(detail)
  } else if (detail.action === 'results-scroll-sync') {
    handleDashboardVirtualScrollSync(detail)
  } else if (detail.action === 'drag-hover-delete') {
    setDashboardDeleteDropHover(detail.active)
    if (detail.active) {
      setDashboardDropHover('')
    }
  } else if (detail.action === 'drag-hover-folder') {
    setDashboardDeleteDropHover(false)
    setDashboardDropHover(detail.bookmarkId)
  } else if (detail.action === 'drag-start-card') {
    handleDashboardCardDragStart(detail)
  } else if (detail.action === 'drag-pointer-move') {
    handleDashboardPointerMove(detail.event)
  } else if (detail.action === 'drag-pointer-up') {
    await handleDashboardPointerUp(detail.event, callbacks)
  } else if (detail.action === 'drag-pointer-cancel') {
    handleDashboardPointerCancel()
  } else if (detail.action === 'folder-filter') {
    applyDashboardFolderFilter(detail.bookmarkId)
  } else if (detail.action === 'folder-filter-focus') {
    applyDashboardFolderFilter(detail.bookmarkId, { restoreFocus: true })
  } else if (detail.action === 'toggle-selection') {
    if (applyDashboardSelection(detail.bookmarkId, detail.checked)) {
      syncDashboardSelectionOnly(new Set([detail.bookmarkId]))
    }
  } else if (detail.action === 'toggle-tags') {
    toggleDashboardTagPopoverById(detail.bookmarkId)
  } else if (detail.action === 'tag-hover-open') {
    openDashboardTagPopoverById(detail.bookmarkId)
  } else if (detail.action === 'tag-hover-close') {
    closeDashboardTagPopoverForId(detail.bookmarkId)
  } else if (detail.action === 'favicon-load') {
    handleDashboardFaviconLoaded(detail)
  } else if (detail.action === 'favicon-error') {
    handleDashboardFaviconError(detail)
  } else if (detail.action === 'copy-bookmark') {
    await copyDashboardBookmarkUrl(detail.bookmarkId)
  } else if (detail.action === 'select-visible') {
    selectVisibleDashboardItems()
  } else if (detail.action === 'clear-selection') {
    if (dashboardState.selectedIds.size) {
      dashboardState.selectedIds.clear()
      syncDashboardSelectionOnly()
    }
    closeOpenDashboardCardMenu()
  } else if (detail.action === 'move-selected') {
    callbacks.openMoveModal('dashboard')
  } else if (detail.action === 'delete-selected') {
    await deleteSelectedDashboardItems(callbacks)
  } else if (detail.action === 'move-one') {
    closeOpenDashboardCardMenu()
    moveSingleDashboardItem(detail.bookmarkId, callbacks)
  } else if (detail.action === 'delete-one') {
    closeOpenDashboardCardMenu()
    await deleteDashboardBookmarkFromCard(detail.bookmarkId, callbacks)
  } else if (detail.action === 'toggle-speed-dial') {
    closeOpenDashboardCardMenu()
    await toggleDashboardBookmarkSpeedDial(detail.bookmarkId)
  } else if (detail.action === 'exit-dashboard') {
    if (callbacks.exitDashboard) {
      callbacks.exitDashboard()
    } else {
      window.location.hash = '#general'
    }
  } else if (detail.action === 'edit-tags') {
    closeOpenDashboardCardMenu()
    openDashboardTagEditor(detail.bookmarkId)
  } else if (detail.action === 'toggle-natural-search') {
    await toggleDashboardNaturalSearch()
  } else if (detail.action === 'clear-search') {
    applyDashboardSearchQuery('')
    requestDashboardSearchFocus()
  } else if (detail.action === 'close-tag-editor') {
    if (!cancelDashboardTagRegeneration()) {
      closeDashboardTagEditor()
    }
  } else if (detail.action === 'save-tags') {
    await saveDashboardTagEditor()
  } else if (detail.action === 'clear-ai-tags') {
    await clearDashboardAiTags()
  } else if (detail.action === 'regenerate-ai-tags') {
    await regenerateDashboardAiTags(callbacks)
  }
}

export function handleDashboardPanelClick(event: MouseEvent): void {
  if (isDashboardCardMenuEvent(event)) {
    return
  }
  closeOpenDashboardCardMenu()

  if (dashboardState.tagEditorBookmarkId && !isDashboardTagEditorEvent(event)) {
    if (!dashboardState.tagEditorSaving) {
      closeDashboardTagEditor()
    }
    return
  }

  if (!dashboardState.expandedTagIds.size) {
    return
  }

  if (isDashboardTagPopoverEvent(event)) {
    return
  }

  closeDashboardTagPopover()
}

export function handleDashboardPanelFocusIn(event: FocusEvent): void {
  if (isDashboardCardMenuEvent(event)) {
    return
  }
  closeOpenDashboardCardMenu()

  if (!dashboardState.expandedTagIds.size) {
    return
  }

  if (isDashboardTagPopoverEvent(event)) {
    return
  }

  closeDashboardTagPopover()
}

export function closeDashboardTagPopover(): boolean {
  if (!dashboardState.expandedTagIds.size) {
    return false
  }

  dashboardState.expandedTagIds.clear()
  renderDashboardSection()
  return true
}

export function closeDashboardTagEditor(): boolean {
  const closingBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (!closingBookmarkId) {
    return false
  }
  if (dashboardState.tagEditorBusyAction === 'regenerate-ai' && dashboardState.tagEditorSaving) {
    return cancelDashboardTagRegeneration()
  }
  if (dashboardState.tagEditorSaving) {
    return false
  }

  if (closingDashboardTagEditor) {
    return true
  }

  if (!getDashboardViewSnapshot().tagEditor.visible) {
    clearDashboardTagEditorState()
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
    return true
  }

  closingDashboardTagEditor = true
  publishDashboardTagEditorClosingState(true)
  const closeDelay = prefersReducedMotion() ? 0 : 220
  window.setTimeout(() => {
    clearDashboardTagEditorState()
    closingDashboardTagEditor = false
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
  }, closeDelay)
  return true
}

function clearDashboardTagEditorState(): void {
  dashboardState.tagEditorBookmarkId = ''
  dashboardState.tagEditorDraft = ''
  dashboardState.tagEditorStatus = ''
  dashboardState.tagEditorSaving = false
  dashboardState.tagEditorBusyAction = ''
  dashboardState.tagEditorReturnFocusId = ''
  dashboardTagRegenerateController = null
}

function clearIdleDashboardTagEditorForFilterChange(): void {
  if (!dashboardState.tagEditorBookmarkId || dashboardState.tagEditorSaving) {
    return
  }

  clearDashboardTagEditorState()
}

function restoreDashboardTagEditorFocus(bookmarkId: string): void {
  const returnFocusId = String(dashboardState.tagEditorReturnFocusId || bookmarkId || '').trim()
  if (!returnFocusId) {
    return
  }

  requestDashboardCardMenuFocus(returnFocusId)
}

function requestDashboardCardMenuFocus(bookmarkId: string): void {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return
  }

  dashboardCardMenuFocusRequestId += 1
  publishDashboardViewState({
    cardMenuFocusRequest: {
      bookmarkId: normalizedBookmarkId,
      requestId: dashboardCardMenuFocusRequestId
    }
  })
}

export function openDashboardTagEditor(bookmarkId: string): void {
  const { model } = getDashboardRenderData()
  const item = model.items.find((entry) => String(entry.id) === String(bookmarkId))
  if (!item) {
    return
  }

  dashboardState.expandedTagIds.clear()
  dashboardState.activeCardMenuBookmarkId = ''
  dashboardState.tagEditorBookmarkId = String(item.id)
  dashboardState.tagEditorReturnFocusId = String(item.id)
  dashboardState.tagEditorDraft = item.tags.join('\n')
  dashboardState.tagEditorStatus = item.hasManualTags
    ? '当前显示的是手动标签，AI 标签仍可单独重新生成或清除。'
    : item.tags.length
      ? '当前显示的是 AI 标签，保存后会作为手动标签保留。'
      : '当前没有标签，保存后会创建手动标签。'
  dashboardState.tagEditorSaving = false
  dashboardState.tagEditorBusyAction = ''
  dashboardTagRegenerateController = null
  closingDashboardTagEditor = false
  dashboardTagEditorFocusRequestId += 1
  renderDashboardSection()
}

export async function saveDashboardTagEditor(): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(dashboardState.tagEditorBookmarkId))
  if (!bookmark || dashboardState.tagEditorSaving) {
    return
  }

  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'save'
  dashboardState.tagEditorStatus = '正在保存标签...'
  renderDashboardTagEditor()

  try {
    const manualTags = normalizeBookmarkTags(dashboardState.tagEditorDraft)
    const savedIndex = await saveManualBookmarkTags(bookmark, dashboardState.tagEditorDraft)
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(savedIndex)
    const savedRecord = aiNamingState.tagIndex.records[String(bookmark.id)] || null
    dashboardState.statusMessage = manualTags.length
      ? '标签已保存。'
      : savedRecord?.tags?.length
        ? '已清除手动标签，显示 AI 标签。'
        : '已清除手动标签。'
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    closeDashboardTagEditor()
    renderDashboardSection()
  } catch (error) {
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardState.tagEditorStatus = error instanceof Error ? error.message : '标签保存失败。'
    renderDashboardTagEditor()
  }
}

export async function clearDashboardAiTags(): Promise<void> {
  const bookmarkId = String(dashboardState.tagEditorBookmarkId || '').trim()
  if (!bookmarkId || dashboardState.tagEditorSaving) {
    return
  }

  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'clear-ai'
  dashboardState.tagEditorStatus = '正在清除 AI 标签...'
  renderDashboardTagEditor()

  try {
    const savedIndex = await clearAiBookmarkTags(bookmarkId)
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(savedIndex)
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    const record = aiNamingState.tagIndex.records[bookmarkId] || null
    if (!record?.manualTags?.length) {
      dashboardState.tagEditorDraft = ''
    }
    dashboardState.tagEditorStatus = record?.manualTags?.length
      ? '已清除 AI 标签，当前仍显示手动标签。'
      : '已清除 AI 标签，当前没有标签。'
    dashboardState.statusMessage = '已清除 AI 标签。'
    renderDashboardSection()
  } catch (error) {
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardState.tagEditorStatus = error instanceof Error ? error.message : 'AI 标签清除失败。'
    renderDashboardTagEditor()
  }
}

export async function regenerateDashboardAiTags(callbacks: DashboardCallbacks): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(dashboardState.tagEditorBookmarkId))
  if (!bookmark || dashboardState.tagEditorSaving) {
    return
  }

  dashboardTagRegenerateController?.abort()
  dashboardTagRegenerateController = new AbortController()
  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'regenerate-ai'
  dashboardState.tagEditorStatus = '正在重新生成 AI 标签...'
  renderDashboardTagEditor()

  try {
    await callbacks.regenerateAiTags(bookmark, dashboardTagRegenerateController.signal)
    const bookmarkId = String(bookmark.id)
    const record = aiNamingState.tagIndex.records[bookmarkId] || null
    if (!record?.manualTags?.length) {
      dashboardState.tagEditorDraft = getEffectiveBookmarkTags(record).join('\n')
    }
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardTagRegenerateController = null
    dashboardState.tagEditorStatus = record?.manualTags?.length
      ? 'AI 标签已重新生成，当前仍显示手动标签。'
      : getEffectiveBookmarkTags(record).length
        ? 'AI 标签已重新生成。'
        : 'AI 已完成分析，但没有生成可展示的标签。'
    dashboardState.statusMessage = 'AI 标签已重新生成。'
    renderDashboardSection()
  } catch (error) {
    const wasCancelled = dashboardTagRegenerateController?.signal.aborted === true
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardTagRegenerateController = null
    dashboardState.tagEditorStatus = wasCancelled && isAbortError(error)
      ? '已取消重新生成 AI 标签。'
      : error instanceof Error ? error.message : 'AI 标签重新生成失败。'
    renderDashboardTagEditor()
  }
}

export function cancelDashboardTagRegeneration(): boolean {
  if (dashboardState.tagEditorBusyAction !== 'regenerate-ai' || !dashboardState.tagEditorSaving) {
    return false
  }

  dashboardState.tagEditorStatus = '正在取消重新生成 AI 标签...'
  dashboardTagRegenerateController?.abort()
  renderDashboardTagEditor()
  return true
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isDashboardTagPopoverEvent(event: Event): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      isDashboardTagsPopoverEventTarget(item)
  })
}

function isDashboardTagEditorEvent(event: Event): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      (isDashboardCardMenuEventTarget(item) ||
        item.id === 'dashboard-tag-editor')
  })
}

function isDashboardCardMenuEvent(event: Event): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      isDashboardCardMenuEventTarget(item)
  })
}

function isDashboardCardMenuEventTarget(target: HTMLElement): boolean {
  return target.getAttribute('aria-haspopup') === 'menu' ||
    target.getAttribute('role') === 'menu'
}

function isDashboardTagsPopoverEventTarget(target: HTMLElement | null): boolean {
  if (!target) {
    return false
  }

  return (
    target.id.startsWith('dashboard-tags-panel-') ||
    String(target.getAttribute('aria-controls') || '').startsWith('dashboard-tags-panel-')
  )
}

function handleDashboardCardDragStart(
  detail: Extract<DashboardViewActionDetail, { action: 'drag-start-card' }>
): void {
  const event = detail.event
  if (
    event.button !== 0 ||
    !event.isPrimary ||
    availabilityState.catalogLoading ||
    availabilityState.deleting ||
    dragState.moving
  ) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  const card = detail.captureElement
  const bookmarkId = String(detail.bookmarkId || '').trim()
  if (!card.isConnected || !card.contains(target) || !bookmarkId || !availabilityState.bookmarkMap.has(bookmarkId)) {
    return
  }

  suppressDashboardNativeDragTextSelection(event)
  cancelDashboardDrag({ silent: true })

  dragState.armed = true
  dragState.active = false
  dragState.bookmarkId = bookmarkId
  dragState.pointerId = event.pointerId
  dragState.originX = event.clientX
  dragState.originY = event.clientY
  dragState.currentX = event.clientX
  dragState.currentY = event.clientY
  dragState.hoverFolderId = ''
  dragState.hoverDeleteTarget = false
  dragState.captureElement = card

  try {
    card.setPointerCapture(event.pointerId)
  } catch {
    // Some synthetic events and older Chromium edge cases cannot capture; drag still works via bubbling.
  }
}

export function handleDashboardPointerMove(event: PointerEvent): void {
  if (!isDashboardDragPointer(event)) {
    return
  }

  if (event.pointerType !== 'touch') {
    suppressDashboardNativeDragTextSelection(event)
  }

  dragState.currentX = event.clientX
  dragState.currentY = event.clientY

  if (
    dragState.armed &&
    !dragState.active &&
    hasDashboardDragPassedThreshold(dragState, event.clientX, event.clientY)
  ) {
    startDashboardDrag()
  }

  if (!dragState.active) {
    return
  }

  suppressDashboardNativeDragTextSelection(event)
  updateDashboardDragPreviewPosition()
}

export async function handleDashboardPointerUp(event: PointerEvent, callbacks: DashboardCallbacks): Promise<void> {
  if (!isDashboardDragPointer(event)) {
    return
  }

  if (!dragState.active) {
    cancelDashboardDrag({ silent: true })
    return
  }

  suppressDashboardNativeDragTextSelection(event)

  const bookmarkId = dragState.bookmarkId
  const dropOnDeleteTarget = dragState.hoverDeleteTarget
  const folderId = dragState.hoverFolderId
  if (dropOnDeleteTarget) {
    dragState.moving = true
    publishDashboardDragOverlayState({ moving: true })
    renderDashboardDragHint('等待确认删除...')

    await closeDashboardDragForFollowUp({ silent: true })
    await deleteDashboardBookmarkFromDrop(bookmarkId, callbacks)
    return
  }

  if (!folderId) {
    cancelDashboardDrag({ silent: true })
    return
  }

  dragState.moving = true
  publishDashboardDragOverlayState({ moving: true })
  renderDashboardDragHint('正在移动书签...')

  await moveDashboardBookmarkToFolder(bookmarkId, folderId, callbacks)
  cancelDashboardDrag({ silent: true })
}

export function handleDashboardPointerCancel(): void {
  cancelDashboardDrag({ silent: true })
}

export function cancelDashboardDrag({ silent = false }: { silent?: boolean } = {}): boolean {
  const wasActive = resetDashboardDragState()
  void hideDashboardDragOverlay()

  if (wasActive && !silent) {
    setDashboardStatus('已取消移动。')
  }

  return wasActive
}

export function selectVisibleDashboardItems(): void {
  const { visibleItems } = getDashboardRenderData()
  let changed = false
  for (const item of visibleItems) {
    const bookmarkId = String(item.id)
    if (!dashboardState.selectedIds.has(bookmarkId)) {
      dashboardState.selectedIds.add(bookmarkId)
      changed = true
    }
  }
  if (changed) {
    syncDashboardSelectionOnly()
  }
}

export async function deleteSelectedDashboardItems(callbacks: DashboardCallbacks): Promise<void> {
  const selectedBookmarks = getSelectedDashboardBookmarks()
  if (!selectedBookmarks.length || availabilityState.deleting) {
    return
  }

  const confirmed = await callbacks.confirm({
    title: `删除 ${selectedBookmarks.length} 条书签？`,
    copy: '这些书签会从 Chrome 书签中移除并进入回收站。你仍可在回收站里恢复它们。',
    confirmLabel: '删除并移入回收站',
    label: '移入回收站',
    tone: 'danger'
  })
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(
    selectedBookmarks.map((bookmark) => bookmark.id),
    '书签仪表盘批量删除',
    callbacks.recycleCallbacks
  )
}

async function deleteDashboardBookmarkFromDrop(
  bookmarkId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  await deleteDashboardBookmark(bookmarkId, callbacks, {
    reason: '书签仪表盘拖拽删除',
    cancelledStatus: '已取消删除。'
  })
}

export async function deleteDashboardBookmarkFromCard(
  bookmarkId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  await deleteDashboardBookmark(bookmarkId, callbacks, {
    reason: '书签仪表盘卡片删除',
    cancelledStatus: '已取消删除。'
  })
}

async function deleteDashboardBookmark(
  bookmarkId: string,
  callbacks: DashboardCallbacks,
  {
    reason,
    cancelledStatus
  }: {
    reason: string
    cancelledStatus: string
  }
): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url) {
    setDashboardStatus('删除失败：书签不存在。')
    return
  }

  const confirmed = await callbacks.confirm({
    title: '删除这个书签？',
    copy: `“${bookmark.title || '未命名书签'}” 会从 Chrome 书签中移除并进入回收站，可在回收站恢复。`,
    confirmLabel: '删除并移入回收站',
    label: '移入回收站',
    tone: 'danger'
  })
  if (!confirmed) {
    setDashboardStatus(cancelledStatus)
    return
  }

  dashboardState.selectedIds.delete(String(bookmarkId))
  await deleteBookmarksToRecycle([bookmarkId], reason, callbacks.recycleCallbacks)
  setDashboardStatus(
    availabilityState.bookmarkMap.has(String(bookmarkId))
      ? (availabilityState.lastError || '删除失败，请稍后重试。')
      : '已删除书签，并移入回收站。'
  )
}

export function moveSingleDashboardItem(bookmarkId: string, callbacks: DashboardCallbacks): void {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url || availabilityState.deleting) {
    return
  }

  managerState.moveDashboardBookmarkId = String(bookmarkId)
  callbacks.openMoveModal('dashboard-single')
}

export async function hydrateDashboardSpeedDialState(): Promise<void> {
  if (isNewTabDashboardEmbed()) {
    return
  }

  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    applyDashboardSpeedDialWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings])
  } catch {
    dashboardState.speedDialPinnedIds = new Set()
  }
}

function applyDashboardSpeedDialWorkspaceSettings(rawSettings: unknown): void {
  const settings = normalizeNewTabWorkspaceSettings(rawSettings, {
    validBookmarkIds: availabilityState.bookmarkMap.keys()
  })
  dashboardState.speedDialPinnedIds = new Set(getActiveNewTabWorkspace(settings).pinnedIds)
}

export async function toggleDashboardBookmarkSpeedDial(bookmarkId: string): Promise<void> {
  const safeBookmarkId = String(bookmarkId || '').trim()
  if (!safeBookmarkId || !availabilityState.bookmarkMap.has(safeBookmarkId)) {
    setDashboardStatus('添加失败：书签不存在。')
    return
  }

  if (isNewTabDashboardEmbed()) {
    window.parent.postMessage(createNewTabToggleSpeedDialMessage(safeBookmarkId), window.location.origin)
    if (dashboardState.speedDialPinnedIds.has(safeBookmarkId)) {
      dashboardState.speedDialPinnedIds.delete(safeBookmarkId)
    } else {
      dashboardState.speedDialPinnedIds.add(safeBookmarkId)
    }
    renderDashboardSection()
    setDashboardStatus('已切换 Speed Dial 固定状态。', '', { render: false })
    return
  }

  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    const settings = normalizeNewTabWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings], {
      validBookmarkIds: availabilityState.bookmarkMap.keys()
    })
    const activeWorkspace = getActiveNewTabWorkspace(settings)
    const nextSettings = toggleNewTabWorkspacePin(settings, activeWorkspace.id, safeBookmarkId, {
      validBookmarkIds: availabilityState.bookmarkMap.keys()
    })
    await setLocalStorage({
      [STORAGE_KEYS.newTabWorkspaceSettings]: nextSettings
    })
    dashboardState.speedDialPinnedIds = new Set(getActiveNewTabWorkspace(nextSettings).pinnedIds)
    renderDashboardSection()
    setDashboardStatus(
      dashboardState.speedDialPinnedIds.has(safeBookmarkId)
        ? '已添加到 Speed Dial。'
        : '已从 Speed Dial 移除。',
      '',
      { render: false }
    )
  } catch (error) {
    setDashboardStatus(error instanceof Error ? error.message : 'Speed Dial 状态更新失败，请稍后重试。')
  }
}

export function getSingleDashboardMoveBookmark(): BookmarkRecord | null {
  const bookmarkId = String(managerState.moveDashboardBookmarkId || '').trim()
  if (!bookmarkId) {
    return null
  }
  return availabilityState.bookmarkMap.get(bookmarkId) || null
}

export async function moveSelectedDashboardBookmarks(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const selectedBookmarks = getSelectedDashboardBookmarks()
  if (!selectedBookmarks.length) {
    callbacks.closeMoveModal()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const movedIds: string[] = []
  let moveError: unknown = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: `书签仪表盘批量移动 ${selectedBookmarks.length} 条`,
      targetBookmarkIds: selectedBookmarks.map((bookmark) => String(bookmark.id)),
      targetFolderIds: [folderId],
      estimatedChangeCount: selectedBookmarks.length
    })

    for (const bookmark of selectedBookmarks) {
      if (String(bookmark.parentId || '') === folderId) {
        continue
      }
      await moveBookmark(bookmark.id, folderId)
      movedIds.push(bookmark.id)
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    callbacks.closeMoveModal()

    if (movedIds.length) {
      removeDashboardSelectionIds(movedIds)
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    const targetFolder = availabilityState.folderMap.get(folderId)
    if (moveError) {
      availabilityState.lastError = moveError instanceof Error
        ? `仪表盘批量移动过程中断，已移动 ${movedIds.length} 条：${moveError.message}`
        : `仪表盘批量移动过程中断，已移动 ${movedIds.length} 条。`
    } else if (movedIds.length) {
      availabilityState.lastError = `已将 ${movedIds.length} 条书签移动到 ${targetFolder?.path || targetFolder?.title || '目标文件夹'}。`
    } else {
      availabilityState.lastError = '所选书签已在目标文件夹。'
    }

    callbacks.renderAvailabilitySection()
  }
}

export async function moveSingleDashboardBookmark(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const bookmarkId = String(managerState.moveDashboardBookmarkId || '').trim()
  const bookmark = bookmarkId ? availabilityState.bookmarkMap.get(bookmarkId) : null
  const targetFolder = availabilityState.folderMap.get(String(folderId))
  if (!bookmark?.url || !targetFolder) {
    callbacks.closeMoveModal()
    setDashboardStatus('移动失败：目标书签或文件夹不存在。')
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  let moved = false
  let moveError: unknown = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: '书签仪表盘单项移动',
      targetBookmarkIds: [bookmarkId],
      targetFolderIds: [folderId],
      estimatedChangeCount: 1
    })

    if (String(bookmark.parentId || '') !== folderId) {
      await moveBookmark(bookmarkId, folderId)
      moved = true
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    callbacks.closeMoveModal()

    if (moved) {
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (moveError) {
      setDashboardStatus(moveError instanceof Error ? `移动失败：${moveError.message}` : '移动失败，请稍后重试。')
    } else if (moved) {
      setDashboardStatus(`已移动到 ${targetFolder.path || targetFolder.title}。`)
    } else {
      setDashboardStatus('书签已在该文件夹。')
    }
  }
}

export function getDashboardRenderData() {
  const model = perfMeasureNow('dashboard.modelBuildMs', () => getCachedDashboardModel({
    bookmarks: availabilityState.allBookmarks,
    folders: availabilityState.allFolders,
    tagIndex: (aiNamingState.tagIndex as BookmarkTagIndex) || null,
    contentSnapshotIndex: contentSnapshotState.index,
    contentSnapshotSearchMap: contentSnapshotState.searchTextMap,
    includeFullText: contentSnapshotState.settings.fullTextSearchEnabled
  }))
  const effectiveFolderId = getDashboardEffectiveFolderId()
  const visibleItems = perfMeasureNow('dashboard.filterMs', () => getCachedDashboardVisibleItems(model, {
    query: dashboardState.query,
    folderId: effectiveFolderId,
    domain: dashboardState.domain,
    month: dashboardState.month,
    sortKey: dashboardState.sortKey
  }))
  perfLogCount('dashboard.visibleCount', visibleItems.length)

  return {
    model,
    visibleItems
  }
}

function getCachedDashboardModel({
  bookmarks,
  folders,
  tagIndex,
  contentSnapshotIndex,
  contentSnapshotSearchMap,
  includeFullText
}: {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  tagIndex: BookmarkTagIndex | null
  contentSnapshotIndex: ContentSnapshotIndex | null
  contentSnapshotSearchMap: Map<string, string> | null
  includeFullText: boolean
}): DashboardModel {
  const key: DashboardModelCacheKey = {
    bookmarks,
    folders,
    tagIndex,
    tagRecords: tagIndex?.records || null,
    tagUpdatedAt: Number(tagIndex?.updatedAt) || 0,
    contentSnapshotIndex,
    contentSnapshotRecords: contentSnapshotIndex?.records || null,
    contentSnapshotUpdatedAt: Number(contentSnapshotIndex?.updatedAt) || 0,
    contentSnapshotSearchMap,
    contentSnapshotSearchMapSize: contentSnapshotSearchMap?.size || 0,
    includeFullText
  }

  if (dashboardRenderCache.model && dashboardRenderCache.modelKey && isDashboardModelCacheKeyEqual(dashboardRenderCache.modelKey, key)) {
    return dashboardRenderCache.model
  }

  const model = buildDashboardModel({
    bookmarks,
    folders,
    tagIndex,
    contentSnapshotIndex,
    contentSnapshotSearchMap,
    includeFullText
  })
  dashboardRenderCache.modelKey = key
  dashboardRenderCache.model = model
  dashboardRenderCache.visibleItems = null
  dashboardRenderCache.visibleModel = null
  dashboardRenderCache.visibleNaturalPlan = null
  dashboardRenderCache.folderCountsModel = null
  dashboardRenderCache.folderBookmarkCounts = null
  dashboardRenderCache.sidebarModel = null
  dashboardRenderCache.sidebarItems = null
  dashboardPopupSearchIndexCache.model = null
  dashboardPopupSearchIndexCache.bookmarks = null
  dashboardPopupSearchIndexCache.bookmarkById = null
  dashboardPopupSearchIndexCache.pinyinReady = false
  dashboardPopupSearchIndexCache.pinyinPending = false
  dashboardPopupSearchIndexCache.pinyinRunId += 1
  dashboardPopupSearchIndexCache.pinyinPriorityKey = ''
  dashboardPopupSearchIndexCache.pinyinPriorityPending = false
  resetDashboardSearchWorker()
  return model
}

function ensureDashboardFullTextSearchMapForQuery(): void {
  if (
    !contentSnapshotState.settings.fullTextSearchEnabled ||
    contentSnapshotState.searchTextMapIncludesFullText ||
    contentSnapshotState.searchTextMapLoadingFullText ||
    !parseSearchQuery(dashboardState.query).textTerms.length
  ) {
    return
  }

  contentSnapshotState.searchTextMapLoadingFullText = true
  void buildContentSnapshotSearchMapWithFullText(contentSnapshotState.index, {
    includeFullText: true,
    maxRecords: 1000
  })
    .then((searchMap) => {
      contentSnapshotState.searchTextMap = searchMap
      contentSnapshotState.searchTextMapIncludesFullText = true
      dashboardRenderCache.modelKey = null
      dashboardRenderCache.model = null
      markDashboardVirtualFilterChange('append')
      scheduleDashboardListRender()
    })
    .catch(() => {
      contentSnapshotState.searchTextMapIncludesFullText = false
      contentSnapshotState.searchTextMapFullTextRetryCount = 0
    })
    .finally(() => {
      contentSnapshotState.searchTextMapLoadingFullText = false
    })
}

function invalidateDashboardVisibleItemCache(): void {
  dashboardRenderCache.visibleItems = null
  dashboardRenderCache.visibleModel = null
  dashboardRenderCache.visibleNaturalPlan = null
}

function invalidateDashboardVisibleItemCacheForSearchKey(searchKey = ''): void {
  invalidateDashboardVisibleItemCache()
  if (searchKey) {
    dashboardSearchWorkerState.resultCache.delete(searchKey)
    dashboardSearchWorkerState.limitByKey.delete(searchKey)
  } else {
    dashboardSearchWorkerState.resultCache.clear()
    dashboardSearchWorkerState.limitByKey.clear()
  }
}

function invalidateDashboardPopupSearchCaches(): void {
  invalidateDashboardVisibleItemCache()
  dashboardActiveSearchKey = ''
  dashboardActiveSearchLimit = 0
  dashboardActiveSearchResultCount = 0
  dashboardPopupSearchIndexCache.model = null
  dashboardPopupSearchIndexCache.tagRecords = null
  dashboardPopupSearchIndexCache.tagUpdatedAt = 0
  dashboardPopupSearchIndexCache.bookmarks = null
  dashboardPopupSearchIndexCache.bookmarkById = null
  dashboardPopupSearchIndexCache.pinyinReady = false
  dashboardPopupSearchIndexCache.pinyinPending = false
  dashboardPopupSearchIndexCache.pinyinRunId += 1
  dashboardPopupSearchIndexCache.pinyinPriorityKey = ''
  dashboardPopupSearchIndexCache.pinyinPriorityPending = false
  resetDashboardSearchWorker()
}

function isDashboardModelCacheKeyEqual(left: DashboardModelCacheKey, right: DashboardModelCacheKey): boolean {
  return (
    left.bookmarks === right.bookmarks &&
    left.folders === right.folders &&
    left.tagIndex === right.tagIndex &&
    left.tagRecords === right.tagRecords &&
    left.tagUpdatedAt === right.tagUpdatedAt &&
    left.contentSnapshotIndex === right.contentSnapshotIndex &&
    left.contentSnapshotRecords === right.contentSnapshotRecords &&
    left.contentSnapshotUpdatedAt === right.contentSnapshotUpdatedAt &&
    left.contentSnapshotSearchMap === right.contentSnapshotSearchMap &&
    left.contentSnapshotSearchMapSize === right.contentSnapshotSearchMapSize &&
    left.includeFullText === right.includeFullText
  )
}

function getCachedDashboardVisibleItems(
  model: DashboardModel,
  filters: DashboardFilters = {}
): DashboardItem[] {
  const query = String(filters.query || '')
  const naturalPlan = getDashboardVisibleNaturalSearchPlan(query)
  const folderId = String(filters.folderId || '')
  const domain = String(filters.domain || '')
  const month = String(filters.month || '')
  const sortKey = filters.sortKey || 'date-desc'

  if (
    dashboardRenderCache.visibleItems &&
    dashboardRenderCache.visibleModel === model &&
    dashboardRenderCache.visibleNaturalPlan === naturalPlan &&
    dashboardRenderCache.visibleQuery === query &&
    dashboardRenderCache.visibleFolderId === folderId &&
    dashboardRenderCache.visibleDomain === domain &&
    dashboardRenderCache.visibleMonth === month &&
    dashboardRenderCache.visibleSortKey === sortKey
  ) {
    return dashboardRenderCache.visibleItems
  }

  const visibleItems = naturalPlan
    ? getNaturalDashboardVisibleItems(model, naturalPlan, {
      query,
      folderId,
      domain,
      month,
      sortKey
    })
    : getPopupDashboardVisibleItems(model, {
      query,
      folderId,
      domain,
      month,
      sortKey
    })
  dashboardRenderCache.visibleModel = model
  dashboardRenderCache.visibleNaturalPlan = naturalPlan
  dashboardRenderCache.visibleQuery = query
  dashboardRenderCache.visibleFolderId = folderId
  dashboardRenderCache.visibleDomain = domain
  dashboardRenderCache.visibleMonth = month
  dashboardRenderCache.visibleSortKey = sortKey
  dashboardRenderCache.visibleItems = visibleItems
  return visibleItems
}

function getPopupDashboardVisibleItems(
  model: DashboardModel,
  filters: DashboardFilters = {}
): DashboardItem[] {
  const query = String(filters.query || '').trim()
  const normalizedQuery = normalizeDashboardSearchText(query)
  const isPinyinQuery = queryLooksLikePinyin(normalizedQuery)
  const structurallyFiltered = getDashboardStructuralCandidateItems(model, filters)
  if (!query) {
    dashboardActiveSearchKey = ''
    dashboardActiveSearchLimit = 0
    dashboardActiveSearchResultCount = 0
  }
  if (!query) {
    return sortDashboardCandidates(structurallyFiltered, filters)
  }

  const searchKey = createDashboardSearchKey({ model, filters, query, itemCount: structurallyFiltered.length })
  const limit = getDashboardSearchResultLimit({
    requestedLimit: dashboardSearchWorkerState.limitByKey.get(searchKey) || 0,
    cachedResultCount: dashboardSearchWorkerState.resultCache.get(searchKey)?.length || 0,
    initialLimit: DASHBOARD_SEARCH_INITIAL_LIMIT,
    maxLimit: DASHBOARD_SEARCH_MAX_SYNC_LIMIT
  })
  dashboardActiveSearchKey = searchKey
  dashboardActiveSearchLimit = limit
  dashboardActiveSearchResultCount = structurallyFiltered.length

  if (isPinyinQuery) {
    const popupBookmarks = getDashboardPopupSearchBookmarksFromItems(model, structurallyFiltered)
    const results = searchDashboardPinyinBookmarks(query, searchKey, popupBookmarks, limit)
    dashboardActiveSearchResultCount = results.length < limit ? results.length : structurallyFiltered.length
    return mapDashboardSearchIdsToItems(structurallyFiltered, results.map((result) => result.id))
  }

  if (shouldUseDashboardSearchWorker(structurallyFiltered.length)) {
    const cachedIds = getDashboardWorkerSearchResultIds({
      model,
      filters,
      query,
      searchKey,
      limit
    })
    dashboardActiveSearchResultCount = cachedIds.length < limit ? cachedIds.length : structurallyFiltered.length
    return mapDashboardSearchIdsToItems(structurallyFiltered, cachedIds)
  }

  const popupBookmarks = getDashboardPopupSearchBookmarksFromItems(model, structurallyFiltered)
  const results = searchBookmarksTopK(query, popupBookmarks, limit)
  dashboardActiveSearchResultCount = results.length < limit ? results.length : structurallyFiltered.length
  return mapDashboardSearchIdsToItems(structurallyFiltered, results.map((result) => result.id))
}

function getNextDashboardSearchResultLimit(searchKey: string): number {
  const currentLimit = getDashboardSearchResultLimit({
    requestedLimit: dashboardSearchWorkerState.limitByKey.get(searchKey) || 0,
    cachedResultCount: dashboardSearchWorkerState.resultCache.get(searchKey)?.length || 0,
    initialLimit: DASHBOARD_SEARCH_INITIAL_LIMIT,
    maxLimit: DASHBOARD_SEARCH_MAX_SYNC_LIMIT
  })
  return Math.min(
    DASHBOARD_SEARCH_MAX_SYNC_LIMIT,
    Math.max(DASHBOARD_SEARCH_INITIAL_LIMIT, currentLimit + DASHBOARD_SEARCH_INCREMENT)
  )
}

function shouldUseDashboardSearchWorker(itemCount: number): boolean {
  return itemCount > DASHBOARD_SEARCH_WORKER_THRESHOLD && typeof Worker !== 'undefined'
}

function searchDashboardPinyinBookmarks(
  query: string,
  searchKey: string,
  bookmarks: PopupSearchBookmark[],
  limit: number
): PopupSearchResult[] {
  if (!dashboardPopupSearchIndexCache.pinyinReady) {
    ensureDashboardPinyinForQuery(query, searchKey, bookmarks)
  }
  return searchBookmarksTopK(query, bookmarks, limit)
}

function collectDashboardPendingPinyinTargets(bookmarks: PopupSearchBookmark[]): PopupSearchBookmark[] {
  return bookmarks.filter((bookmark) => bookmark.pinyinEnriched !== true)
}

function getDashboardWorkerSearchResultIds({
  model,
  filters,
  query,
  searchKey,
  limit
}: {
  model: DashboardModel
  filters: DashboardFilters
  query: string
  searchKey: string
  limit: number
}): string[] {
  ensureDashboardSearchWorker(model)
  if (dashboardSearchWorkerState.error) {
    const popupBookmarks = getDashboardPopupSearchBookmarksFromItems(
      model,
      getDashboardStructuralCandidateItems(model, filters)
    )
    ensureDashboardPinyinForQuery(query, searchKey, popupBookmarks)
    return searchBookmarksTopK(query, popupBookmarks, limit).map((result) => String(result.id))
  }

  const cachedIds = dashboardSearchWorkerState.resultCache.get(searchKey)
  if (!cachedIds || cachedIds.length < limit) {
    requestDashboardWorkerSearch({
      searchKey,
      query,
      filters,
      limit
    })
  }

  return cachedIds ? cachedIds.slice(0, limit) : []
}

function ensureDashboardSearchWorker(model: DashboardModel): Worker | null {
  const tagIndex = (aiNamingState.tagIndex as BookmarkTagIndex | null) || null
  const tagRecords = tagIndex?.records || EMPTY_DASHBOARD_TAG_RECORDS
  const tagUpdatedAt = Number(tagIndex?.updatedAt) || 0
  const state = dashboardSearchWorkerState
  ensureDashboardPopupSearchIndexPinyin()

  if (
    state.worker &&
    state.model === model &&
    state.tagRecords === tagRecords &&
    state.tagUpdatedAt === tagUpdatedAt &&
    state.pinyinReady === dashboardPopupSearchIndexCache.pinyinReady
  ) {
    return state.worker
  }

  resetDashboardSearchWorker()
  if (typeof Worker === 'undefined') {
    return null
  }

  const worker = new Worker(new URL('../../shared/search/search-worker.ts', import.meta.url), {
    type: 'module',
    name: 'dashboard-search'
  })
  state.worker = worker
  state.model = model
  state.tagRecords = tagRecords
  state.tagUpdatedAt = tagUpdatedAt
  state.pinyinReady = dashboardPopupSearchIndexCache.pinyinReady
  state.indexReady = false
  state.indexSize = 0
  state.error = ''
  state.initRequestId += 1
  worker.onmessage = handleDashboardSearchWorkerMessage
  worker.onerror = handleDashboardSearchWorkerError
  postDashboardSearchWorkerMessage({
    type: 'init',
    requestId: state.initRequestId,
    bookmarks: getDashboardPopupSearchBookmarks(model)
  })
  return worker
}

function requestDashboardWorkerSearch({
  searchKey,
  query,
  filters,
  limit
}: {
  searchKey: string
  query: string
  filters: DashboardFilters
  limit: number
}): void {
  const state = dashboardSearchWorkerState
  if (!state.worker) {
    return
  }

  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0))
  if (!safeLimit) {
    return
  }

  state.limitByKey.set(searchKey, safeLimit)
  if (!state.indexReady) {
    state.pendingSearchKey = searchKey
    return
  }

  state.pendingSearchKey = searchKey
  state.requestId += 1
  postDashboardSearchWorkerMessage({
    type: 'query',
    requestId: state.requestId,
    searchKey,
    query,
    limit: safeLimit,
    offset: 0,
    filters: getDashboardSearchWorkerStructuralFilters(filters)
  })
}

function postDashboardSearchWorkerMessage(message: DashboardSearchWorkerRequest): void {
  dashboardSearchWorkerState.worker?.postMessage(message)
}

function getDashboardSearchWorkerStructuralFilters(filters: DashboardFilters): DashboardSearchWorkerStructuralFilters {
  return {
    folderId: String(filters.folderId || ''),
    domain: String(filters.domain || ''),
    month: String(filters.month || '')
  }
}

function handleDashboardSearchWorkerMessage(event: MessageEvent<DashboardSearchWorkerResponse>): void {
  const message = event.data
  const state = dashboardSearchWorkerState
  if (!message || typeof message !== 'object') {
    return
  }

  if (message.type === 'ready') {
    if (message.requestId !== state.initRequestId) {
      return
    }
    state.indexReady = true
    state.indexSize = message.indexSize
    invalidateDashboardVisibleItemCache()
    scheduleDashboardListRender()
    return
  }

  if (message.type === 'partial' || message.type === 'final') {
    if (message.requestId !== state.requestId) {
      return
    }

    state.resultCache.set(message.searchKey, message.ids)
    if (message.type === 'final' || message.complete) {
      state.pendingSearchKey = ''
    }
    invalidateDashboardVisibleItemCache()
    markDashboardVirtualFilterChange('append')
    scheduleDashboardListRender()
    return
  }

  if (message.type === 'cancelled') {
    if (message.requestId === state.requestId) {
      state.pendingSearchKey = ''
    }
    return
  }

  if (message.type === 'error' && message.requestId === state.requestId) {
    state.error = message.message
    state.pendingSearchKey = ''
  }
}

function handleDashboardSearchWorkerError(event: ErrorEvent): void {
  dashboardSearchWorkerState.error = event.message || 'Dashboard search worker failed.'
  dashboardSearchWorkerState.pendingSearchKey = ''
}

function resetDashboardSearchWorker(): void {
  const state = dashboardSearchWorkerState
  state.worker?.terminate()
  state.worker = null
  state.model = null
  state.tagRecords = null
  state.tagUpdatedAt = 0
  state.pinyinReady = false
  state.indexReady = false
  state.indexSize = 0
  state.pendingSearchKey = ''
  state.limitByKey.clear()
  state.resultCache.clear()
  state.error = ''
  dashboardSearchPrefetchPendingKey = ''
  dashboardSearchPrefetchIdleScheduled = false
  if (dashboardSearchPrefetchRetryTimer) {
    globalThis.clearTimeout(dashboardSearchPrefetchRetryTimer)
    dashboardSearchPrefetchRetryTimer = 0
  }
}

function getDashboardVisibleNaturalSearchPlan(query: string): NaturalSearchPlan | null {
  const normalizedQuery = normalizeDashboardSearchText(query)
  if (!normalizedQuery || !dashboardState.naturalSearchEnabled || queryLooksLikePinyin(normalizedQuery)) {
    return null
  }

  if (dashboardState.naturalSearchPlan?.rawQuery === String(query || '').trim()) {
    return dashboardState.naturalSearchPlan
  }

  const cachedEntry = dashboardNaturalSearchCache.get(getDashboardNaturalSearchCacheKey(normalizedQuery))
  if (cachedEntry) {
    dashboardState.naturalSearchPlan = cachedEntry.plan
    return cachedEntry.plan
  }

  return null
}

function getNaturalDashboardVisibleItems(
  model: DashboardModel,
  plan: NaturalSearchPlan,
  filters: DashboardFilters = {}
): DashboardItem[] {
  const normalizedQuery = normalizeDashboardSearchText(filters.query || plan.rawQuery)
  const cachedEntry = dashboardNaturalSearchCache.get(getDashboardNaturalSearchCacheKey(normalizedQuery))
  const rankedIds = cachedEntry && cachedEntry.plan === plan
    ? cachedEntry.results.map((result) => String(result.id))
    : []
  const parsedQueries = createDashboardNaturalParsedQueries(plan)
  const candidatesById = new Map<string, DashboardItem>()
  const candidateOrder = new Map<string, number>()

  for (const parsedQuery of parsedQueries) {
    const matches = filterDashboardItems(model.items, {
      ...filters,
      query: buildSearchTextQuery(parsedQuery),
      parsedQuery,
      textMatchMode: 'any'
    })
    for (const item of matches) {
      const id = String(item.id)
      if (!candidatesById.has(id)) {
        candidatesById.set(id, item)
        candidateOrder.set(id, candidateOrder.size)
      }
    }
  }

  const rankedItems: DashboardItem[] = []
  for (const id of rankedIds) {
    const item = candidatesById.get(id)
    if (!item) {
      continue
    }
    rankedItems.push(item)
    candidatesById.delete(id)
  }

  const fallbackItems = sortDashboardCandidates([...candidatesById.values()], filters)
  const rankOffset = rankedItems.length
  const rankMap = new Map(rankedIds.map((id, index) => [id, index]))
  return [...rankedItems, ...fallbackItems].sort((left, right) => {
    const leftRank = rankMap.get(String(left.id))
    const rightRank = rankMap.get(String(right.id))
    const leftKnownRank = leftRank !== undefined
    const rightKnownRank = rightRank !== undefined
    if (leftKnownRank || rightKnownRank) {
      return (leftKnownRank ? leftRank : rankOffset + (candidateOrder.get(String(left.id)) || 0)) -
        (rightKnownRank ? rightRank : rankOffset + (candidateOrder.get(String(right.id)) || 0))
    }
    return 0
  })
}

function createDashboardNaturalParsedQueries(plan: NaturalSearchPlan) {
  const queries = [
    plan.rawQuery,
    plan.highlightQuery,
    ...plan.queries
  ].filter(Boolean)

  return queries.map((query) => {
    const parsed = parseSearchQuery(query)
    return {
      ...parsed,
      dateRange: plan.dateRange || parsed.dateRange,
      excludedTerms: [...new Set([...parsed.excludedTerms, ...plan.excludedTerms])]
    }
  })
}

function getDashboardTagRecord(bookmarkId: string): BookmarkTagRecord | null {
  const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex)
  return tagIndex.records[String(bookmarkId)] || null
}

function renderDashboardSearchTools(): void {
  const parsed = parseSearchQuery(dashboardState.query)
  const chips = parsed.chips
  renderDashboardNaturalSearchToggle()

  publishDashboardViewState({
    searchChips: chips.map((chip): DashboardSearchChipViewModel => ({
        kind: String(chip.kind || ''),
        label: String(chip.label || '')
    }))
  })
}

function renderDashboardNaturalSearchToggle(): void {
  const active = dashboardState.naturalSearchEnabled
  const pending = dashboardState.naturalSearchPending
  const fallback = Boolean(active && dashboardState.naturalSearchError)
  const view = getDashboardViewSnapshot()
  publishDashboardViewState({
    searchControls: {
      focusRequestId: dashboardSearchFocusRequestId,
      natural: {
        active,
        ariaLabel: active ? '关闭 Dashboard AI 语义搜索' : '开启 Dashboard AI 语义搜索',
        fallback,
        label: getDashboardNaturalSearchToggleText(),
        pending,
        title: getDashboardNaturalSearchToggleTitle()
      },
      query: dashboardState.query,
      searchHelpOpen: view.searchControls.searchHelpOpen,
      showClearSearch: Boolean(String(dashboardState.query || '').trim())
    }
  })
}

export function applyDashboardSearchQuery(query: string): void {
  dashboardState.query = query
  dashboardState.selectedIds.clear()
  dashboardState.expandedTagIds.clear()
  dashboardState.activeCardMenuBookmarkId = ''
  clearIdleDashboardTagEditorForFilterChange()
  ensureDashboardFullTextSearchMapForQuery()
  startDashboardNaturalSearch()
  invalidateDashboardVisibleItemCacheForSearchKey()
  markDashboardVirtualFilterChange('query')
  renderDashboardSearchTools()
  scheduleDashboardSectionRender()
}

async function toggleDashboardNaturalSearch(): Promise<void> {
  const enabled = !dashboardState.naturalSearchEnabled

  if (enabled) {
    await refreshDashboardNaturalSearchAiConfiguredState()
    if (!dashboardState.naturalSearchAiConfigured) {
      dashboardState.naturalSearchEnabled = false
      dashboardState.naturalSearchError = ''
      dashboardState.naturalSearchPlan = null
      dashboardState.naturalSearchPending = false
      abortDashboardNaturalSearchRequest()
      setDashboardStatus('请配置 AI 渠道。')
      openDashboardAiProviderSettings()
      renderDashboardSearchTools()
      requestDashboardSearchFocus()
      return
    }
  }

  dashboardState.naturalSearchEnabled = enabled
  dashboardState.naturalSearchError = ''
  dashboardState.naturalSearchPlan = null
  abortDashboardNaturalSearchRequest()
  invalidateDashboardVisibleItemCache()
  if (!dashboardState.naturalSearchEnabled) {
    dashboardNaturalSearchCache.clear()
    ensureDashboardFullTextSearchMapForQuery()
    markDashboardVirtualFilterChange('query')
    scheduleDashboardSectionRender()
    requestDashboardSearchFocus()
    return
  }

  ensureDashboardFullTextSearchMapForQuery()
  startDashboardNaturalSearch()
  markDashboardVirtualFilterChange('query')
  scheduleDashboardSectionRender()
  requestDashboardSearchFocus()
  await prepareDashboardNaturalSearchAi()
  if (!dashboardState.naturalSearchEnabled) {
    renderDashboardSearchTools()
    return
  }
  startDashboardNaturalSearch()
  markDashboardVirtualFilterChange('query')
  scheduleDashboardSectionRender()
}

async function prepareDashboardNaturalSearchAi(): Promise<void> {
  try {
    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      dashboardState.naturalSearchAiConfigured = false
      dashboardState.naturalSearchAiConfigChecked = true
      dashboardState.naturalSearchEnabled = false
      dashboardState.naturalSearchError = ''
      setDashboardStatus('请配置 AI 渠道。')
      openDashboardAiProviderSettings()
      return
    }

    dashboardState.naturalSearchAiConfigured = true
    dashboardState.naturalSearchAiConfigChecked = true
    naturalSearchAi.validateNaturalSearchAiProvider(settings)
    await naturalSearchAi.ensureNaturalSearchAiPermissions(settings, { interactive: true })
  } catch {
    dashboardState.naturalSearchError = 'AI 未就绪，请检查 AI 渠道配置或授权。'
  }
}

async function refreshDashboardNaturalSearchAiConfiguredState(): Promise<void> {
  try {
    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    dashboardState.naturalSearchAiConfigured = naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)
  } catch {
    dashboardState.naturalSearchAiConfigured = false
  } finally {
    dashboardState.naturalSearchAiConfigChecked = true
  }
}

function openDashboardAiProviderSettings(): void {
  window.location.hash = '#general:ai-provider'
}

function startDashboardNaturalSearch(): void {
  const query = String(dashboardState.query || '').trim()
  const normalizedQuery = normalizeDashboardSearchText(query)
  if (!dashboardState.naturalSearchEnabled || !normalizedQuery) {
    abortDashboardNaturalSearchRequest()
    dashboardState.naturalSearchPending = false
    dashboardState.naturalSearchError = ''
    dashboardState.naturalSearchPlan = null
    invalidateDashboardVisibleItemCache()
    return
  }

  const cacheKey = getDashboardNaturalSearchCacheKey(normalizedQuery)
  const cachedEntry = dashboardNaturalSearchCache.get(cacheKey)
  if (cachedEntry) {
    dashboardState.naturalSearchPlan = cachedEntry.plan
    dashboardState.naturalSearchPending = false
    dashboardState.naturalSearchError = ''
    invalidateDashboardVisibleItemCache()
    return
  }

  void resolveDashboardNaturalSearch(query, normalizedQuery, cacheKey)
}

async function resolveDashboardNaturalSearch(
  query: string,
  normalizedQuery: string,
  cacheKey: string
): Promise<void> {
  abortDashboardNaturalSearchRequest()
  const controller = new AbortController()
  dashboardState.naturalSearchAbortController = controller
  dashboardState.naturalSearchPending = true
  dashboardState.naturalSearchError = ''
  renderDashboardSearchTools()

  try {
    const naturalSearch = await loadDashboardNaturalSearchModule()
    if (!isCurrentDashboardNaturalSearchRequest(controller, normalizedQuery)) {
      return
    }

    const effectiveLocalPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      dashboardState.naturalSearchAiConfigured = false
      dashboardState.naturalSearchAiConfigChecked = true
      dashboardState.naturalSearchEnabled = false
      dashboardState.naturalSearchPending = false
      dashboardState.naturalSearchError = ''
      dashboardState.naturalSearchPlan = null
      setDashboardStatus('请配置 AI 渠道。')
      openDashboardAiProviderSettings()
      return
    }
    dashboardState.naturalSearchAiConfigured = true
    dashboardState.naturalSearchAiConfigChecked = true

    const plan = await naturalSearchAi.requestNaturalSearchAiPlan({
      query,
      localPlan: effectiveLocalPlan,
      settings,
      signal: controller.signal
    })
    dashboardState.naturalSearchError = ''

    const results = await searchDashboardNaturalPlan(plan)
    if (!isCurrentDashboardNaturalSearchRequest(controller, normalizedQuery)) {
      return
    }

    dashboardState.naturalSearchPlan = plan
    dashboardNaturalSearchCache.set(cacheKey, { plan, results })
    invalidateDashboardVisibleItemCache()
    markDashboardVirtualFilterChange('append')
    scheduleDashboardListRender()
  } catch (error) {
    if (!isCurrentDashboardNaturalSearchRequest(controller, normalizedQuery) || isDashboardNaturalSearchAbortError(error)) {
      return
    }

    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    dashboardState.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    dashboardState.naturalSearchPlan = null
    invalidateDashboardVisibleItemCache()
    markDashboardVirtualFilterChange('append')
    scheduleDashboardListRender()
  } finally {
    if (dashboardState.naturalSearchAbortController === controller) {
      dashboardState.naturalSearchAbortController = null
    }
    if (normalizeDashboardSearchText(dashboardState.query) === normalizedQuery) {
      dashboardState.naturalSearchPending = false
      renderDashboardSearchTools()
    }
  }
}

async function searchDashboardNaturalPlan(plan: NaturalSearchPlan): Promise<PopupSearchResult[]> {
  const naturalSearch = await loadDashboardNaturalSearchModule()
  const model = getDashboardRenderData().model
  const popupBookmarks = getDashboardPopupSearchBookmarks(model)
  const bookmarks = naturalSearch.filterBookmarksByNaturalDateRange(popupBookmarks, plan)
  const resultSets: NaturalSearchResultSet[] = []
  const seenQueries = new Set<string>()

  for (const query of [plan.rawQuery, ...plan.queries]) {
    const normalizedQuery = normalizeDashboardSearchText(query)
    if (!normalizedQuery || seenQueries.has(normalizedQuery)) {
      continue
    }
    seenQueries.add(normalizedQuery)
    const results = searchBookmarksUnbounded(query, bookmarks)
    if (results.length) {
      resultSets.push({ query, results })
    }
  }

  return resultSets.length ? naturalSearch.mergeNaturalSearchResultSets(plan, resultSets) : []
}

function getDashboardPopupSearchBookmarks(model: DashboardModel): PopupSearchBookmark[] {
  return getDashboardPopupSearchBookmarksFromItems(model, model.items)
}

function getDashboardPopupSearchBookmarksFromItems(
  model: DashboardModel,
  items: DashboardItem[]
): PopupSearchBookmark[] {
  const fullIndex = getDashboardPopupSearchIndex(model)
  if (items === model.items) {
    return fullIndex
  }

  const bookmarkById = dashboardPopupSearchIndexCache.bookmarkById
  if (!bookmarkById) {
    return []
  }

  const popupBookmarks: PopupSearchBookmark[] = []
  for (const item of items) {
    const indexed = bookmarkById.get(String(item.id))
    if (indexed) {
      popupBookmarks.push(indexed)
    }
  }
  return popupBookmarks
}

function getDashboardPopupSearchIndex(model: DashboardModel): PopupSearchBookmark[] {
  const tagIndex = (aiNamingState.tagIndex as BookmarkTagIndex | null) || null
  const tagRecords = tagIndex?.records || EMPTY_DASHBOARD_TAG_RECORDS
  const tagUpdatedAt = Number(tagIndex?.updatedAt) || 0
  if (
    dashboardPopupSearchIndexCache.model === model &&
    dashboardPopupSearchIndexCache.tagRecords === tagRecords &&
    dashboardPopupSearchIndexCache.tagUpdatedAt === tagUpdatedAt &&
    dashboardPopupSearchIndexCache.bookmarks
  ) {
    return dashboardPopupSearchIndexCache.bookmarks
  }

  const popupBookmarks: PopupSearchBookmark[] = []
  const bookmarkById = new Map<string, PopupSearchBookmark>()
  for (const item of model.items) {
    const tagRecord = tagRecords[String(item.id)] || null
    const indexed = indexBookmarkForSearch(item, tagRecord)
    popupBookmarks.push(indexed)
    bookmarkById.set(String(item.id), indexed)
  }
  dashboardPopupSearchIndexCache.model = model
  dashboardPopupSearchIndexCache.tagRecords = tagRecords
  dashboardPopupSearchIndexCache.tagUpdatedAt = tagUpdatedAt
  dashboardPopupSearchIndexCache.bookmarks = popupBookmarks
  dashboardPopupSearchIndexCache.bookmarkById = bookmarkById
  dashboardPopupSearchIndexCache.pinyinReady = false
  dashboardPopupSearchIndexCache.pinyinPending = false
  dashboardPopupSearchIndexCache.pinyinRunId += 1
  dashboardPopupSearchIndexCache.pinyinPriorityKey = ''
  dashboardPopupSearchIndexCache.pinyinPriorityPending = false
  return popupBookmarks
}

function ensureDashboardPopupSearchIndexPinyin(): void {
  const cache = dashboardPopupSearchIndexCache
  if (cache.pinyinReady || cache.pinyinPending || !cache.bookmarks?.length) {
    return
  }

  const pendingTargets = collectDashboardPendingPinyinTargets(cache.bookmarks)
  if (!pendingTargets.length) {
    cache.pinyinReady = true
    resetDashboardSearchWorker()
    return
  }

  const runId = cache.pinyinRunId
  cache.pinyinPending = true
  window.setTimeout(() => {
    if (cache.pinyinRunId !== runId || !cache.bookmarks) {
      cache.pinyinPending = false
      return
    }

    void import('../../shared/search/pinyin.js')
      .then(({ enrichPinyinTokensCooperatively }) =>
        enrichPinyinTokensCooperatively(
          collectDashboardPendingPinyinTargets(cache.bookmarks || []),
          {
            isActive: () => cache.pinyinRunId === runId
          }
        )
      )
      .then((result) => {
        if (cache.pinyinRunId !== runId) {
          return
        }

        cache.pinyinPending = false
        if (result.aborted) {
          return
        }

        cache.pinyinReady = true
        resetDashboardSearchWorker()
        invalidateDashboardVisibleItemCacheForSearchKey()
        if (dashboardState.query.trim()) {
          markDashboardVirtualFilterChange('append')
          scheduleDashboardListRender()
        }
      })
      .catch(() => {
        if (cache.pinyinRunId !== runId) {
          return
        }
        cache.pinyinPending = false
      })
  }, 0)
}

function ensureDashboardPinyinForQuery(
  query: string,
  searchKey: string,
  bookmarks: PopupSearchBookmark[]
): void {
  const normalizedQuery = normalizeDashboardSearchText(query)
  const cache = dashboardPopupSearchIndexCache
  const pendingTargets = collectDashboardPendingPinyinTargets(bookmarks)
  if (
    cache.pinyinReady ||
    !queryLooksLikePinyin(normalizedQuery) ||
    !pendingTargets.length
  ) {
    return
  }

  const runId = cache.pinyinRunId
  const targets = pendingTargets.slice()
  cache.pinyinPriorityKey = searchKey
  cache.pinyinPriorityPending = true

  void import('../../shared/search/pinyin.js')
    .then(({ enrichPinyinTokensCooperatively }) =>
      enrichPinyinTokensCooperatively(targets, {
        isActive: () => cache.pinyinRunId === runId,
        batchSize: Math.min(250, Math.max(50, targets.length))
      })
    )
    .then((result) => {
      if (cache.pinyinRunId !== runId) {
        return
      }

      cache.pinyinPriorityPending = false
      if (result.aborted) {
        return
      }

      resetDashboardSearchWorker()
      invalidateDashboardVisibleItemCacheForSearchKey(searchKey)
      if (normalizeDashboardSearchText(dashboardState.query) === normalizedQuery) {
        markDashboardVirtualFilterChange('append')
        scheduleDashboardListRender()
      } else if (queryLooksLikePinyin(normalizeDashboardSearchText(dashboardState.query))) {
        invalidateDashboardVisibleItemCacheForSearchKey()
        scheduleDashboardListRender()
      }
    })
    .catch(() => {
      if (cache.pinyinRunId !== runId) {
        return
      }
      cache.pinyinPriorityPending = false
    })
}

function abortDashboardNaturalSearchRequest(): void {
  dashboardState.naturalSearchAbortController?.abort()
  dashboardState.naturalSearchAbortController = null
  dashboardState.naturalSearchPending = false
}

function isCurrentDashboardNaturalSearchRequest(controller: AbortController, normalizedQuery: string): boolean {
  return (
    dashboardState.naturalSearchAbortController === controller &&
    dashboardState.naturalSearchEnabled &&
    normalizeDashboardSearchText(dashboardState.query) === normalizedQuery
  )
}

function isDashboardNaturalSearchAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getDashboardNaturalSearchCacheKey(normalizedQuery: string): string {
  return `${formatDashboardLocalDate(Date.now())}\u0000${normalizedQuery}`
}

function getDashboardNaturalSearchToggleText(): string {
  if (!dashboardState.naturalSearchEnabled) {
    return '语义'
  }

  if (dashboardState.naturalSearchPending) {
    return '思考中'
  }

  return 'AI'
}

function getDashboardNaturalSearchToggleTitle(): string {
  if (!dashboardState.naturalSearchEnabled) {
    return dashboardState.naturalSearchAiConfigured
      ? '开启 AI 语义搜索'
      : '需要先配置 AI 渠道'
  }

  if (dashboardState.naturalSearchPending) {
    return '正在用 AI 理解搜索意图，点击关闭'
  }

  if (dashboardState.naturalSearchError) {
    return `${dashboardState.naturalSearchError}；点击关闭`
  }

  if (dashboardState.naturalSearchPlan?.source === 'ai') {
    return 'AI 已改写查询；点击关闭语义搜索'
  }

  return '点击关闭 AI 语义搜索'
}

function normalizeDashboardSearchText(value: unknown): string {
  return normalizeText(value).trim()
}

function formatDashboardLocalDate(value: unknown): string {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function renderDashboardFolderBreadcrumbs(): void {
  const selectedFolderId = getDashboardEffectiveFolderId()
  const selectedFolder = selectedFolderId
    ? availabilityState.folderMap.get(selectedFolderId)
    : null

  publishDashboardViewState({
    breadcrumbs: selectedFolder ? getDashboardFolderBreadcrumbSegments(selectedFolder) : []
  })
}

function getDashboardFolderBreadcrumbSegments(folder: FolderRecord): DashboardBreadcrumbSegmentViewModel[] {
  const segments = buildBookmarkPathSegments(folder, availabilityState.folderMap)
  if (!segments.length) {
    return []
  }

  return segments.map((segment) => ({
    current: Boolean(segment.current || !segment.id),
    id: String(segment.id || ''),
    label: String(segment.label || ''),
    path: String(segment.path || '')
  }))
}

function renderDashboardFolderSidebar(model: DashboardModel): void {
  const selectedFolderId = getDashboardEffectiveFolderId()
  const folderBookmarkCounts = getCachedDashboardFolderBookmarkCounts(model)
  const folderItems = getCachedDashboardFolderSidebarItems(model, selectedFolderId, folderBookmarkCounts)
  const folderCountText = `${model.totalFolders} 个文件夹`

  publishDashboardViewState({
    folderSidebar: {
      countText: folderCountText,
      focusRequestId: pendingDashboardFolderFocusId,
      items: folderItems
    }
  })
  window.requestAnimationFrame(() => {
    pendingDashboardFolderFocusId = ''
  })
}

function getCachedDashboardFolderSidebarItems(
  model: DashboardModel,
  selectedFolderId: string,
  folderBookmarkCounts: Map<string, number>
): DashboardFolderSidebarItemViewModel[] {
  if (
    dashboardRenderCache.sidebarModel === model &&
    dashboardRenderCache.sidebarSelectedFolderId === selectedFolderId &&
    dashboardRenderCache.sidebarTotalFolders === model.totalFolders &&
    dashboardRenderCache.sidebarItems
  ) {
    return dashboardRenderCache.sidebarItems
  }

  const items = model.folderTargets
    .map((folder) => {
      const folderRecord = availabilityState.folderMap.get(String(folder.id))
      const depth = Number(folderRecord?.depth) || getDashboardFolderPathDepth(folder.path)
      return {
        active: selectedFolderId === String(folder.id),
        count: folderBookmarkCounts.get(String(folder.id)) || 0,
        depth: Math.max(0, depth - 1),
        id: folder.id,
        path: formatFolderPath(folderRecord || folder, availabilityState.folderMap) || folder.path || folder.title,
        title: folder.title
      }
    })

  dashboardRenderCache.sidebarModel = model
  dashboardRenderCache.sidebarSelectedFolderId = selectedFolderId
  dashboardRenderCache.sidebarItems = items
  dashboardRenderCache.sidebarTotalFolders = model.totalFolders
  return items
}

function getCachedDashboardFolderBookmarkCounts(model: DashboardModel): Map<string, number> {
  if (dashboardRenderCache.folderCountsModel === model && dashboardRenderCache.folderBookmarkCounts) {
    return dashboardRenderCache.folderBookmarkCounts
  }
  const counts = buildDashboardFolderBookmarkCounts(model.items)
  dashboardRenderCache.folderCountsModel = model
  dashboardRenderCache.folderBookmarkCounts = counts
  return counts
}

function getDashboardFolderPathDepth(path: string): number {
  return String(path || '')
    .split(/\s*(?:\/|>|›|»|\\)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .length
}

function renderDashboardSelectionBar(visibleItems: DashboardItem[]): void {
  const selectedCount = getSelectedDashboardBookmarks().length
  const state = {
    canSelectVisible: !availabilityState.deleting && visibleItems.length > 0,
    selectedCount,
    selectionActionsDisabled: availabilityState.deleting || selectedCount === 0
  }

  publishDashboardViewState({
    selectionBar: state
  })
}

function applyDashboardFolderFilter(folderId: unknown, { restoreFocus = false }: { restoreFocus?: boolean } = {}): void {
  const normalizedFolderId = String(folderId || '').trim()
  const selectedFolder = normalizedFolderId
    ? availabilityState.folderMap.get(normalizedFolderId)
    : null

  const nextFolderId = selectedFolder ? normalizedFolderId : getDashboardDefaultFolderId()
  if (restoreFocus) {
    pendingDashboardFolderFocusId = nextFolderId
  }
  if (getDashboardEffectiveFolderId() === nextFolderId) {
    return
  }

  dashboardState.folderId = nextFolderId
  dashboardState.selectedIds.clear()
  dashboardState.expandedTagIds.clear()
  dashboardState.activeCardMenuBookmarkId = ''
  clearIdleDashboardTagEditorForFilterChange()
  beginStableDashboardResultsUpdate()
  markDashboardVirtualFilterChange('folder')
  setDashboardStatus(selectedFolder
    ? `已筛选：${formatFolderPath(selectedFolder, availabilityState.folderMap) || selectedFolder.title}`
    : '已显示书签栏', '', { render: false })
  scheduleDashboardSectionRender()
}

function getDashboardEffectiveFolderId(): string {
  const selectedFolderId = String(dashboardState.folderId || '').trim()
  if (selectedFolderId && availabilityState.folderMap.has(selectedFolderId)) {
    return selectedFolderId
  }

  return getDashboardDefaultFolderId()
}

function getDashboardDefaultFolderId(): string {
  return availabilityState.folderMap.has(BOOKMARKS_BAR_ID) ? BOOKMARKS_BAR_ID : ''
}

function renderDashboardCards(items: DashboardItem[], renderVersion = beginDashboardCardsRender()): void {
  if (availabilityState.catalogLoading) {
    resetDashboardVirtualRenderCache({ clearItems: true })
    clearStableDashboardResultsUpdate()
    renderDashboardEmptyState('正在读取书签目录。', { loading: true })
    commitDashboardCardsRender(renderVersion)
    return
  }

  if (!items.length) {
    resetDashboardVirtualRenderCache({ clearItems: true })
    if (isDashboardWorkerSearchPending()) {
      renderDashboardEmptyState('正在搜索书签。', { loading: true })
    } else {
      renderDashboardEmptyState(dashboardState.query ? '当前搜索没有匹配的书签。' : '没有可展示的书签。')
    }
    endStableDashboardResultsUpdate()
    commitDashboardCardsRender(renderVersion)
    return
  }

  ensureDashboardVirtualGrid()
  virtualState.items = items

  applyDashboardVirtualFilterReset(items)
  const metricsReady = updateDashboardVirtualMetrics()

  if (items.length < DASHBOARD_VIRTUAL_THRESHOLD) {
    virtualState.items = items
    const renderedIds = new Set(items.map((item) => String(item.id)))
    const stateKey = getDashboardVirtualRenderStateKey(items)
    const staticListKey = getDashboardStaticListRenderKey(items, stateKey)
    const canReuseStaticList =
      virtualState.renderedStartIndex === 0 &&
      virtualState.renderedEndIndex === items.length &&
      virtualState.renderedStaticListKey === staticListKey &&
      !isDashboardResultsVirtualized()

    if (!canReuseStaticList) {
      resetDashboardVirtualRenderCache({ preserveItems: true })
      virtualState.items = items
      publishDashboardResultsVirtualizedState(false)
      publishDashboardViewState({
        results: {
          mode: 'static',
          cards: items.map(buildDashboardCardViewModel)
        }
      })
      virtualState.renderedStartIndex = 0
      virtualState.renderedEndIndex = items.length
      virtualState.renderedStateKey = stateKey
      virtualState.renderedStaticListKey = staticListKey
    }
    virtualState.renderedItems = items

    if (isDashboardLargeVirtualSet(items)) {
      stopDashboardFaviconWarmup()
    } else {
      syncDashboardFaviconWarmup(items)
    }
    reconcileDashboardTransientUiWithRenderedItems(renderedIds)
    updateDashboardFloatingEditorPosition(renderedIds)
    endStableDashboardResultsUpdate()
    commitDashboardCardsRender(renderVersion)
    return
  }

  publishDashboardResultsVirtualizedState(true)
  if (!metricsReady) {
    virtualState.pendingInitialMeasure = true
    scheduleDashboardVirtualMeasureRetry(renderVersion)
    return
  }

  virtualState.pendingInitialMeasure = false
  const scrollTop = virtualState.resetScrollOnNextRender ? 0 : getDashboardVirtualScrollTop()
  const virtualWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    fastScrolling: virtualState.isFastScrolling
  })
  const viewportWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    overscanRows: 0
  })

  if (getDashboardVirtualScrollTop() !== virtualWindow.scrollTop) {
    publishDashboardResultsScrollRequest(virtualWindow.scrollTop)
  }
  updateDashboardResultsMetricsSnapshot({ scrollTop: virtualWindow.scrollTop })
  virtualState.resetScrollOnNextRender = false
  virtualState.scrollTop = virtualWindow.scrollTop
  virtualState.columnCount = virtualWindow.columnCount
  virtualState.rowStride = virtualWindow.rowStride
  if (isDashboardLargeVirtualSet(items)) {
    stopDashboardFaviconWarmup()
  } else {
    scheduleDashboardFaviconWarmup(
      items,
      getDashboardFaviconWarmupStartIndex(viewportWindow),
      getDashboardFaviconWarmupEndIndex(viewportWindow, items.length)
    )
  }

  if (canReuseDashboardVirtualShell(items, virtualWindow, viewportWindow)) {
    syncDashboardVirtualRenderedShellGeometry(virtualWindow)
    reconcileDashboardVirtualTransientUiAfterScroll(items)
    endStableDashboardResultsUpdate()
    commitDashboardCardsRender(renderVersion)
    return
  }

  const renderedIds = commitDashboardVirtualWindow(items, virtualWindow)
  endStableDashboardResultsUpdate()
  updateDashboardFloatingEditorPosition(renderedIds)
  commitDashboardCardsRender(renderVersion)
}

function canReuseDashboardVirtualShell(
  items: DashboardItem[],
  virtualWindow: DashboardVirtualWindow,
  viewportWindow: DashboardVirtualWindow,
  {
    validateRenderKey = true,
    allowAnchoredGeometry = false
  }: {
    validateRenderKey?: boolean
    allowAnchoredGeometry?: boolean
  } = {}
): boolean {
  if (
    virtualState.renderedStartIndex < 0 ||
    virtualState.renderedEndIndex <= virtualState.renderedStartIndex ||
    virtualState.renderedColumnCount !== virtualWindow.columnCount ||
    (!allowAnchoredGeometry && virtualState.renderedTotalHeight !== virtualWindow.totalHeight)
  ) {
    return false
  }

  const viewportStartIndex = viewportWindow.startIndex
  const viewportEndIndex = viewportWindow.endIndex
  if (
    virtualState.renderedStartIndex > viewportStartIndex ||
    virtualState.renderedEndIndex < viewportEndIndex
  ) {
    return false
  }

  if (!validateRenderKey) {
    return true
  }

  const renderedItems = items.slice(virtualState.renderedStartIndex, virtualState.renderedEndIndex)
  const stateKey = getDashboardVirtualRenderStateKey(renderedItems)
  return virtualState.renderedStaticListKey === getDashboardStaticListRenderKey(renderedItems, stateKey)
}

function renderDashboardVirtualScrollFrame(): void {
  renderDashboardVirtualScrollWindow()
}

function renderDashboardVirtualScrollWindow(
  scrollTopOverride?: number,
  {
    syncContainerScroll = true
  }: {
    syncContainerScroll?: boolean
  } = {}
): void {
  const items = virtualState.items
  if (
    !isDashboardResultsVirtualized() ||
    !items.length ||
    virtualState.pendingInitialMeasure ||
    virtualState.contentWidth < DASHBOARD_VIRTUAL_MIN_READY_WIDTH ||
    virtualState.containerHeight < DASHBOARD_VIRTUAL_MIN_READY_HEIGHT
  ) {
    return
  }

  const scrollTop = scrollTopOverride == null ? getDashboardVirtualScrollTop() : scrollTopOverride
  const viewportWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    overscanRows: 0
  })

  const shouldRefreshScrollCards = getDashboardRenderedCardMode() === 'scroll' &&
    getDashboardVirtualCardRenderMode() === 'full'
  if (
    !shouldRefreshScrollCards &&
    canReuseDashboardVirtualShell(items, viewportWindow, viewportWindow, {
      validateRenderKey: false,
      allowAnchoredGeometry: true
    })
  ) {
    virtualState.scrollTop = viewportWindow.scrollTop
    virtualState.columnCount = viewportWindow.columnCount
    virtualState.rowStride = viewportWindow.rowStride
    scheduleDashboardFaviconWarmupForViewport(items, viewportWindow)
    return
  }

  const virtualWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    fastScrolling: virtualState.isFastScrolling
  })

  if (syncContainerScroll && getDashboardVirtualScrollTop() !== virtualWindow.scrollTop) {
    publishDashboardResultsScrollRequest(virtualWindow.scrollTop)
  }
  if (syncContainerScroll) {
    updateDashboardResultsMetricsSnapshot({ scrollTop: virtualWindow.scrollTop })
  }
  virtualState.scrollTop = virtualWindow.scrollTop
  virtualState.columnCount = virtualWindow.columnCount
  virtualState.rowStride = virtualWindow.rowStride

  scheduleDashboardFaviconWarmupForViewport(items, viewportWindow)

  if (
    !shouldRefreshScrollCards &&
    canReuseDashboardVirtualShell(items, virtualWindow, viewportWindow, { validateRenderKey: false })
  ) {
    syncDashboardVirtualRenderedShellGeometry(virtualWindow)
    reconcileDashboardVirtualTransientUiAfterScroll(items)
    return
  }

  const renderedIds = commitDashboardVirtualWindow(items, virtualWindow)
  updateDashboardFloatingEditorPosition(renderedIds)
}

function isDashboardLargeVirtualSet(items = virtualState.items): boolean {
  return items.length >= 500
}

function scheduleDashboardFaviconWarmupForViewport(
  items: DashboardItem[],
  viewportWindow: DashboardVirtualWindow
): void {
  if (isDashboardLargeVirtualSet(items)) {
    stopDashboardFaviconWarmup()
    return
  }

  scheduleDashboardFaviconWarmup(
    items,
    getDashboardFaviconWarmupStartIndex(viewportWindow),
    getDashboardFaviconWarmupEndIndex(viewportWindow, items.length)
  )
}

function commitDashboardVirtualWindow(
  items: DashboardItem[],
  virtualWindow: DashboardVirtualWindow
): Set<string> {
  const renderedItems = items.slice(virtualWindow.startIndex, virtualWindow.endIndex)
  const renderedIds = new Set(renderedItems.map((item) => String(item.id)))
  reconcileDashboardTransientUiWithRenderedItems(renderedIds)

  const stateKey = getDashboardVirtualRenderStateKey(renderedItems)
  const virtualWindowKey = getDashboardStaticListRenderKey(renderedItems, stateKey)
  const canReuseShell =
    virtualState.renderedStartIndex === virtualWindow.startIndex &&
    virtualState.renderedEndIndex === virtualWindow.endIndex &&
    virtualState.renderedColumnCount === virtualWindow.columnCount &&
    virtualState.renderedTotalHeight === virtualWindow.totalHeight &&
    virtualState.renderedOffsetY === virtualWindow.offsetY &&
    virtualState.renderedStaticListKey === virtualWindowKey

  if (!canReuseShell) {
    renderDashboardVirtualWindow({
      renderedItems,
      totalHeight: virtualWindow.totalHeight,
      offsetY: virtualWindow.offsetY,
      columnCount: virtualWindow.columnCount
    })
  } else {
    updateDashboardVirtualShellGeometry(virtualWindow)
  }
  virtualState.renderedItems = items
  virtualState.renderedStartIndex = virtualWindow.startIndex
  virtualState.renderedEndIndex = virtualWindow.endIndex
  virtualState.renderedColumnCount = virtualWindow.columnCount
  virtualState.renderedTotalHeight = virtualWindow.totalHeight
  virtualState.renderedOffsetY = virtualWindow.offsetY
  virtualState.renderedStateKey = stateKey
  virtualState.renderedStaticListKey = virtualWindowKey
  return renderedIds
}

function syncDashboardVirtualRenderedShellGeometry(virtualWindow: DashboardVirtualWindow): void {
  const anchoredOffsetY = virtualState.renderedOffsetY >= 0
    ? virtualState.renderedOffsetY
    : virtualWindow.offsetY
  const anchoredColumnCount = virtualState.renderedColumnCount || virtualWindow.columnCount
  updateDashboardVirtualShellGeometry({
    ...virtualWindow,
    columnCount: anchoredColumnCount,
    offsetY: anchoredOffsetY
  }, { updateRenderedOffset: false })
}

function updateDashboardVirtualShellGeometry(
  virtualWindow: DashboardVirtualWindow,
  {
    updateRenderedOffset = true
  }: {
    updateRenderedOffset?: boolean
  } = {}
): void {
  const view = getDashboardViewSnapshot()
  const currentResults = view.results
  if (
    currentResults.mode === 'virtual' &&
    currentResults.columnCount === virtualWindow.columnCount &&
    currentResults.offsetY === virtualWindow.offsetY &&
    currentResults.totalHeight === virtualWindow.totalHeight
  ) {
    return
  }

  const renderedItems = virtualState.items.slice(virtualState.renderedStartIndex, virtualState.renderedEndIndex)
  const cards = currentResults.mode === 'virtual'
    ? currentResults.cards
    : renderedItems.map(buildDashboardCardViewModel)
  publishDashboardViewState({
    results: {
      mode: 'virtual',
      cards,
      columnCount: virtualWindow.columnCount,
      offsetY: virtualWindow.offsetY,
      totalHeight: virtualWindow.totalHeight
    }
  })
  virtualState.renderedTotalHeight = virtualWindow.totalHeight
  if (updateRenderedOffset) {
    virtualState.renderedOffsetY = virtualWindow.offsetY
  }
}

function reconcileDashboardVirtualTransientUiAfterScroll(items: DashboardItem[]): void {
  if (!dashboardState.expandedTagIds.size && !dashboardState.tagEditorBookmarkId) {
    return
  }

  const stableRenderedItems = items.slice(virtualState.renderedStartIndex, virtualState.renderedEndIndex)
  const stableRenderedIds = new Set(stableRenderedItems.map((item) => String(item.id)))
  reconcileDashboardTransientUiWithRenderedItems(stableRenderedIds)
  updateDashboardFloatingEditorPosition(stableRenderedIds)
}

function getDashboardStaticListRenderKey(items: DashboardItem[], stateKey: string): string {
  if (stateKey.startsWith('scroll\u0001')) {
    return [
      stateKey,
      items.length,
      items[0]?.id || '',
      items[items.length - 1]?.id || ''
    ].join('\u0001')
  }

  return [
    stateKey,
    items.length,
    ...items.map(getDashboardCardRenderKey)
  ].join('\u0001')
}

function getDashboardCardRenderKey(item: DashboardItem): string {
  return [
    getDashboardVirtualCardRenderMode(),
    item.id,
    item.title,
    item.url,
    item.parentId,
    item.path,
    dashboardState.activeCardMenuBookmarkId === String(item.id) ? 'menu:on' : 'menu:off',
    dashboardState.selectedIds.has(String(item.id)) ? 'selection:on' : 'selection:off',
    dashboardState.expandedTagIds.has(String(item.id)) ? 'tags:on' : 'tags:off',
    dashboardState.copyFeedbackId === String(item.id) ? 'copied' : 'copy-idle',
    dashboardState.speedDialPinnedIds.has(String(item.id)) ? 'speed-dial' : 'not-speed-dial',
    availabilityState.deleting ? 'deleting' : 'idle',
    item.hasManualTags ? 'manual' : 'auto',
    item.aiTags.length,
    ...item.tags
  ].map((value) => String(value || '')).join('\u0002')
}

function getDashboardVirtualCardRenderMode(): 'full' | 'scroll' {
  return virtualState.isFastScrolling ? 'scroll' : 'full'
}

function getDashboardRenderedCardMode(): 'full' | 'scroll' {
  return virtualState.renderedStateKey.startsWith('scroll\u0001') ? 'scroll' : 'full'
}

function getDashboardFaviconWarmupStartIndex(window: DashboardVirtualWindow): number {
  const startRow = Math.max(0, window.startRow - DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS)
  return startRow * Math.max(1, window.columnCount)
}

function getDashboardFaviconWarmupEndIndex(window: DashboardVirtualWindow, itemCount: number): number {
  const endRow = Math.max(window.endRow, window.startRow + 1) + DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS
  return Math.min(Math.max(0, itemCount), endRow * Math.max(1, window.columnCount))
}

function renderDashboardVirtualWindow({
  renderedItems,
  totalHeight,
  offsetY,
  columnCount
}: {
  renderedItems: DashboardItem[]
  totalHeight: number
  offsetY: number
  columnCount: number
}): void {
  publishDashboardViewState({
    results: {
      mode: 'virtual',
      cards: renderedItems.map(buildDashboardCardViewModel),
      columnCount,
      offsetY,
      totalHeight
    }
  })
}

function resetDashboardVirtualRenderCache({
  clearItems = false,
  preserveItems = false
}: {
  clearItems?: boolean
  preserveItems?: boolean
} = {}): void {
  if (clearItems) {
    virtualState.items = []
    virtualState.filterKey = ''
    virtualState.scrollResetKey = ''
    virtualState.filterChangeReason = 'filter'
  } else if (!preserveItems) {
    virtualState.items = []
  }
  virtualState.renderedItems = null
  virtualState.renderedStartIndex = -1
  virtualState.renderedEndIndex = -1
  virtualState.renderedColumnCount = 0
  virtualState.renderedTotalHeight = -1
  virtualState.renderedOffsetY = -1
  virtualState.renderedStateKey = ''
  virtualState.renderedStaticListKey = ''
  virtualState.pendingInitialMeasure = false
  virtualState.isFastScrolling = false
  virtualState.lastScrollTop = 0
  virtualState.lastScrollAt = 0
  if (virtualState.scrollIdleTimer) {
    window.clearTimeout(virtualState.scrollIdleTimer)
    virtualState.scrollIdleTimer = 0
  }
  if (virtualState.scrollSettleTimer) {
    window.clearTimeout(virtualState.scrollSettleTimer)
    virtualState.scrollSettleTimer = 0
  }
  if (virtualState.measureRetryFrame) {
    window.cancelAnimationFrame(virtualState.measureRetryFrame)
    virtualState.measureRetryFrame = 0
  }
  publishDashboardResultsVirtualizedState(false)
}

function applyDashboardVirtualFilterReset(items: DashboardItem[]): void {
  const filterKey = getDashboardVirtualFilterKey(items)
  if (virtualState.filterKey === filterKey) {
    return
  }

  virtualState.filterKey = filterKey
  if (shouldResetDashboardVirtualScrollForFilterChange({
    previousKey: virtualState.scrollResetKey,
    nextKey: filterKey,
    reason: virtualState.filterChangeReason
  })) {
    virtualState.scrollResetKey = filterKey
    resetDashboardVirtualScroll()
    virtualState.filterChangeReason = 'filter'
    return
  }

  virtualState.scrollResetKey = filterKey
  virtualState.filterChangeReason = 'filter'
  resetDashboardVirtualRenderCache({ preserveItems: true })
}

function getDashboardVirtualFilterKey(items: DashboardItem[]): string {
  return [
    dashboardState.query,
    getDashboardEffectiveFolderId(),
    dashboardState.domain,
    dashboardState.month,
    dashboardState.sortKey,
    items.length,
    items[0]?.id || '',
    items[items.length - 1]?.id || ''
  ].map((value) => String(value || '')).join('\u0001')
}

function getDashboardVirtualScrollResetKey(): string {
  return [
    dashboardState.query,
    dashboardState.domain,
    dashboardState.month,
    dashboardState.sortKey
  ].map((value) => String(value || '')).join('\u0001')
}

function markDashboardVirtualFilterChange(reason: DashboardVirtualFilterChangeReason): void {
  virtualState.filterChangeReason = reason
  if (reason !== 'folder') {
    virtualState.scrollResetKey = ''
    return
  }

  virtualState.scrollResetKey = getDashboardVirtualScrollResetKey()
}

function getDashboardVirtualRenderStateKey(renderedItems: DashboardItem[]): string {
  if (getDashboardVirtualCardRenderMode() === 'scroll') {
    return [
      'scroll',
      availabilityState.deleting ? 'deleting' : 'idle',
      renderedItems.length,
      renderedItems[0]?.id || '',
      renderedItems[renderedItems.length - 1]?.id || ''
    ].join('\u0001')
  }

  const itemState = renderedItems.map((item) => {
    const id = String(item.id)
    return [
      id,
      dashboardState.copyFeedbackId === id ? '1' : '0',
      dashboardState.speedDialPinnedIds.has(id) ? '1' : '0'
    ].join(':')
  }).join('|')

  return [
    getDashboardVirtualCardRenderMode(),
    availabilityState.deleting ? 'deleting' : 'idle',
    itemState
  ].join('\u0001')
}

function ensureDashboardVirtualGrid(): void {
  handleDashboardVirtualResultsMounted(getDashboardVirtualScrollTop())
}

function handleDashboardVirtualResultsMounted(scrollTop: number): void {
  const safeScrollTop = Math.max(0, Number(scrollTop) || 0)
  if (virtualState.resultsMounted) {
    virtualState.lastScrollTop = safeScrollTop
    return
  }

  virtualState.resultsMounted = true
  virtualState.lastScrollTop = safeScrollTop
  virtualState.lastScrollAt = 0
  virtualState.isFastScrolling = false
}

function handleDashboardVirtualResultsUnmounted(): void {
  virtualState.resultsMounted = false
  virtualState.resultsMetrics = null
  if (virtualState.frame) {
    window.cancelAnimationFrame(virtualState.frame)
    virtualState.frame = 0
  }
  if (virtualState.scrollIdleTimer) {
    window.clearTimeout(virtualState.scrollIdleTimer)
    virtualState.scrollIdleTimer = 0
  }
  if (virtualState.scrollSettleTimer) {
    window.clearTimeout(virtualState.scrollSettleTimer)
    virtualState.scrollSettleTimer = 0
  }
  if (virtualState.measureRetryFrame) {
    window.cancelAnimationFrame(virtualState.measureRetryFrame)
    virtualState.measureRetryFrame = 0
  }
  if (dashboardVirtualResizeFrame) {
    window.cancelAnimationFrame(dashboardVirtualResizeFrame)
    dashboardVirtualResizeFrame = 0
  }
  virtualState.lastResizeWidth = 0
  virtualState.lastResizeHeight = 0
  virtualState.lastResizeColumnCount = 0
  virtualState.lastScrollTop = 0
  virtualState.lastScrollAt = 0
  virtualState.isFastScrolling = false
}

function handleDashboardVirtualResize(): void {
  const metrics = getDashboardVirtualMetricsForController()
  if (!isDashboardVirtualMetricsReady(metrics) && virtualState.items.length >= DASHBOARD_VIRTUAL_THRESHOLD) {
    virtualState.pendingInitialMeasure = true
    scheduleDashboardVirtualMeasureRetry()
    return
  }

  if (!hasDashboardVirtualMetricsChanged(metrics) && !virtualState.pendingInitialMeasure) {
    return
  }

  scheduleDashboardVirtualResize()
}

function scheduleDashboardVirtualResize({
  showMask = true
}: {
  showMask?: boolean
} = {}): void {
  if (dashboardVirtualResizeFrame) {
    return
  }

  dashboardVirtualResizeFrame = window.requestAnimationFrame(() => {
    dashboardVirtualResizeFrame = 0
    commitDashboardVirtualResize({ showMask })
  })
}

function commitDashboardVirtualResize({
  showMask = true,
  preserveRenderedWindow = false
}: {
  showMask?: boolean
  preserveRenderedWindow?: boolean
} = {}): void {
  if (virtualState.frame) {
    window.cancelAnimationFrame(virtualState.frame)
    virtualState.frame = 0
  }
  const metrics = getDashboardVirtualMetricsForController()
  if (!isDashboardVirtualMetricsReady(metrics) && virtualState.items.length >= DASHBOARD_VIRTUAL_THRESHOLD) {
    virtualState.pendingInitialMeasure = true
    scheduleDashboardVirtualMeasureRetry()
    return
  }
  if (!hasDashboardVirtualMetricsChanged(metrics) && !virtualState.pendingInitialMeasure && !preserveRenderedWindow) {
    clearStableDashboardResultsUpdate()
    return
  }
  if (showMask) {
    beginStableDashboardResultsUpdate()
  }
  if (preserveRenderedWindow) {
    updateDashboardVirtualMetrics()
    return
  }
  resetDashboardVirtualRenderCache({ preserveItems: true })
  if (virtualState.items.length) {
    renderDashboardCards(virtualState.items)
  }
}

function handleDashboardVirtualScroll(detail: Extract<DashboardViewActionDetail, { action: 'results-scroll' }>): void {
  if (!isDashboardResultsVirtualized()) {
    updateDashboardResultsMetricsSnapshot(detail)
    return
  }

  const now = getDashboardNow()
  const metrics = updateDashboardResultsMetricsSnapshot(detail)
  const nextScrollTop = metrics.scrollTop
  const previousScrollTop = virtualState.lastScrollTop
  const previousScrollAt = virtualState.lastScrollAt
  const elapsedMs = previousScrollAt ? Math.max(1, now - previousScrollAt) : Number.POSITIVE_INFINITY
  const velocity = Math.abs(nextScrollTop - previousScrollTop) / elapsedMs

  virtualState.scrollTop = nextScrollTop
  virtualState.lastScrollTop = nextScrollTop
  virtualState.lastScrollAt = now
  virtualState.isFastScrolling = velocity >= DASHBOARD_VIRTUAL_FAST_SCROLL_PX_PER_MS
  scheduleDashboardScrollIdle()
  maybePrefetchDashboardSearchResults(detail)
  scheduleDashboardVirtualRender()
}

function handleDashboardVirtualScrollSync(detail: Extract<DashboardViewActionDetail, { action: 'results-scroll-sync' }>): void {
  const metrics = updateDashboardResultsMetricsSnapshot(detail)
  virtualState.scrollTop = metrics.scrollTop
  virtualState.lastScrollTop = metrics.scrollTop
}

function getDashboardNow(): number {
  try {
    return performance.now()
  } catch {
    return Date.now()
  }
}

function scheduleDashboardScrollIdle(): void {
  if (virtualState.scrollIdleTimer) {
    window.clearTimeout(virtualState.scrollIdleTimer)
  }
  if (virtualState.scrollSettleTimer) {
    window.clearTimeout(virtualState.scrollSettleTimer)
    virtualState.scrollSettleTimer = 0
  }
  if (dashboardListRenderFrame) {
    window.cancelAnimationFrame(dashboardListRenderFrame)
    dashboardListRenderFrame = 0
    dashboardListRenderPendingForScroll = true
  }
  virtualState.scrollIdleTimer = window.setTimeout(() => {
    virtualState.scrollIdleTimer = 0
    const wasFastScrolling = virtualState.isFastScrolling
    virtualState.isFastScrolling = false
    if (dashboardListRenderPendingForScroll) {
      dashboardListRenderPendingForScroll = false
      scheduleDashboardListRender()
    }
    virtualState.scrollSettleTimer = window.setTimeout(() => {
      virtualState.scrollSettleTimer = 0
      flushPendingDashboardFaviconWarmup()
      flushDashboardFaviconDirtySync()
      if (
        virtualState.items.length >= DASHBOARD_VIRTUAL_THRESHOLD &&
        (wasFastScrolling || getDashboardRenderedCardMode() === 'scroll')
      ) {
        scheduleDashboardVirtualRender()
      }
    }, DASHBOARD_SCROLL_SETTLE_MS)
  }, DASHBOARD_SCROLL_IDLE_MS)
}

function maybePrefetchDashboardSearchResults({
  scrollTop
}: {
  scrollTop: number
}): void {
  if (!dashboardActiveSearchKey || !dashboardState.query.trim()) {
    return
  }

  if (
    dashboardActiveSearchLimit >= DASHBOARD_SEARCH_MAX_SYNC_LIMIT ||
    dashboardActiveSearchResultCount <= dashboardActiveSearchLimit
  ) {
    return
  }

  const clientHeight = virtualState.resultsMetrics?.clientHeight || virtualState.containerHeight
  const scrollHeight = virtualState.resultsMetrics?.scrollHeight || 0
  const remainingPx = Math.max(
    0,
    (Number(scrollHeight) || 0) - (Number(scrollTop) || 0) - (Number(clientHeight) || 0)
  )
  if (remainingPx > DASHBOARD_SEARCH_SCROLL_PREFETCH_PX) {
    return
  }

  const nextLimit = getNextDashboardSearchResultLimit(dashboardActiveSearchKey)
  if (nextLimit <= dashboardActiveSearchLimit) {
    return
  }

  dashboardSearchPrefetchPendingKey = dashboardActiveSearchKey
  scheduleDashboardSearchPrefetchLimitIncrease()
}

function scheduleDashboardSearchPrefetchLimitIncrease(): void {
  if (dashboardSearchPrefetchIdleScheduled || !dashboardSearchPrefetchPendingKey) {
    return
  }

  dashboardSearchPrefetchIdleScheduled = true
  runIdle(() => {
    dashboardSearchPrefetchIdleScheduled = false
    applyPendingDashboardSearchPrefetchLimitIncrease()
  }, { timeout: DASHBOARD_SEARCH_SCROLL_PREFETCH_IDLE_TIMEOUT_MS })
}

function applyPendingDashboardSearchPrefetchLimitIncrease(): void {
  const searchKey = dashboardSearchPrefetchPendingKey
  dashboardSearchPrefetchPendingKey = ''
  if (!searchKey || searchKey !== dashboardActiveSearchKey || !dashboardState.query.trim()) {
    return
  }

  const now = getDashboardNow()
  if (now - dashboardSearchPrefetchLastRequestedAt < DASHBOARD_SEARCH_SCROLL_PREFETCH_MIN_INTERVAL_MS) {
    dashboardSearchPrefetchPendingKey = searchKey
    if (!dashboardSearchPrefetchRetryTimer) {
      dashboardSearchPrefetchRetryTimer = window.setTimeout(() => {
        dashboardSearchPrefetchRetryTimer = 0
        scheduleDashboardSearchPrefetchLimitIncrease()
      }, DASHBOARD_SEARCH_SCROLL_PREFETCH_MIN_INTERVAL_MS)
    }
    return
  }

  const nextLimit = getNextDashboardSearchResultLimit(searchKey)
  if (
    nextLimit <= dashboardActiveSearchLimit ||
    dashboardActiveSearchLimit >= DASHBOARD_SEARCH_MAX_SYNC_LIMIT ||
    dashboardActiveSearchResultCount <= dashboardActiveSearchLimit
  ) {
    return
  }

  dashboardSearchPrefetchLastRequestedAt = now
  dashboardSearchWorkerState.limitByKey.set(searchKey, nextLimit)
  invalidateDashboardVisibleItemCache()
  markDashboardVirtualFilterChange('append')
  scheduleDashboardListRender()
}

function isDashboardWorkerSearchPending(): boolean {
  return Boolean(
    dashboardActiveSearchKey &&
    dashboardSearchWorkerState.pendingSearchKey === dashboardActiveSearchKey &&
    !dashboardSearchWorkerState.resultCache.has(dashboardActiveSearchKey) &&
    !dashboardSearchWorkerState.error
  )
}

function scheduleDashboardVirtualRender(): void {
  if (virtualState.frame) {
    return
  }

  virtualState.frame = window.requestAnimationFrame(() => {
    virtualState.frame = 0
    if (virtualState.items.length) {
      renderDashboardVirtualScrollFrame()
    }
  })
}

function scheduleDashboardVirtualMeasureRetry(renderVersion = dashboardCardsRenderVersion): void {
  if (virtualState.measureRetryFrame) {
    return
  }

  virtualState.measureRetryFrame = window.requestAnimationFrame(() => {
    virtualState.measureRetryFrame = 0
    if (!virtualState.items.length || renderVersion !== dashboardCardsRenderVersion) {
      return
    }

    renderDashboardCards(virtualState.items, renderVersion)
  })
}

function scheduleDashboardSectionRender(): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return
  }

  if (virtualState.sectionFrame) {
    return
  }

  virtualState.sectionFrame = window.requestAnimationFrame(() => {
    virtualState.sectionFrame = 0
    renderDashboardSection()
  })
}

function scheduleDashboardListRender(): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return
  }

  if (virtualState.scrollIdleTimer) {
    dashboardListRenderPendingForScroll = true
    return
  }

  if (dashboardListRenderFrame) {
    return
  }

  dashboardListRenderFrame = window.requestAnimationFrame(() => {
    dashboardListRenderFrame = 0
    renderDashboardListOnly()
  })
}

function renderDashboardListOnly(): void {
  if (!dashboardSectionActive) {
    return
  }

  const { model, visibleItems } = getDashboardRenderData()
  syncDashboardSelection(
    dashboardState.selectedIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  syncDashboardSelection(
    dashboardState.expandedTagIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  renderDashboardStatusOnly()
  renderDashboardSelectionBar(visibleItems)
  const renderVersion = beginDashboardCardsRender()
  renderDashboardCards(visibleItems, renderVersion)
  renderDashboardTagEditor(model)
  if (dragState.active) {
    renderDashboardDragOverlay(model)
  }
}

function beginStableDashboardResultsUpdate(): void {
  const stableHeight = getDashboardResultsStableHeight()
  if (stableHeight <= 0) {
    return
  }

  publishDashboardResultsUpdateState({
    resultsStableHeight: `${stableHeight}px`,
    resultsUpdating: true
  })
  if (dashboardResultsStableFrame) {
    window.cancelAnimationFrame(dashboardResultsStableFrame)
  }
  dashboardResultsStableFrame = window.requestAnimationFrame(() => {
    dashboardResultsStableFrame = window.requestAnimationFrame(() => {
      dashboardResultsStableFrame = 0
      clearStableDashboardResultsUpdate()
    })
  })
}

function getDashboardResultsStableHeight(): number {
  const snapshotHeight = Math.ceil(Number(virtualState.resultsMetrics?.clientHeight) || 0)
  if (snapshotHeight > 0) {
    return snapshotHeight
  }

  return 0
}

function endStableDashboardResultsUpdate(): void {
  if (!getDashboardViewSnapshot().panelChrome.resultsUpdating) {
    return
  }

  if (dashboardResultsStableFrame) {
    window.cancelAnimationFrame(dashboardResultsStableFrame)
  }
  dashboardResultsStableFrame = window.requestAnimationFrame(() => {
    dashboardResultsStableFrame = 0
    clearStableDashboardResultsUpdate()
  })
}

function clearStableDashboardResultsUpdate(): void {
  if (dashboardResultsStableFrame) {
    window.cancelAnimationFrame(dashboardResultsStableFrame)
    dashboardResultsStableFrame = 0
  }
  publishDashboardResultsUpdateState({
    resultsStableHeight: '',
    resultsUpdating: false
  })
}

function isDashboardResultsVirtualized(): boolean {
  return getDashboardViewSnapshot().panelChrome.resultsVirtualized
}

function publishDashboardResultsVirtualizedState(resultsVirtualized: boolean): void {
  const view = getDashboardViewSnapshot()
  if (view.panelChrome.resultsVirtualized === resultsVirtualized) {
    return
  }

  publishDashboardPanelChromeState({ resultsVirtualized })
}

function publishDashboardResultsUpdateState(patch: Pick<DashboardPanelChromeState, 'resultsStableHeight' | 'resultsUpdating'>): void {
  publishDashboardPanelChromeState(patch)
}

function publishDashboardPanelChromeState(patch: Partial<DashboardPanelChromeState>): void {
  const view = getDashboardViewSnapshot()
  publishDashboardViewState({
    panelChrome: {
      ...view.panelChrome,
      ...patch
    }
  })
}

function publishDashboardResultsScrollRequest(scrollTop: number): void {
  const safeScrollTop = Math.max(0, Number(scrollTop) || 0)
  dashboardResultsScrollRequestId += 1
  const view = getDashboardViewSnapshot()
  publishDashboardViewState({
    resultsScrollRequest: {
      ...view.resultsScrollRequest,
      requestId: dashboardResultsScrollRequestId,
      scrollTop: safeScrollTop
    }
  })
}

function syncDashboardPanelReadyState(): void {
  const view = getDashboardViewSnapshot()
  publishDashboardViewState({
    panelChrome: {
      ...view.panelChrome,
      ready: isDashboardViewReady()
    }
  })
}

function beginDashboardCardsRender(): number {
  dashboardCardsRenderVersion += 1
  return dashboardCardsRenderVersion
}

function commitDashboardCardsRender(renderVersion: number): void {
  const safeRenderVersion = Math.max(0, Math.floor(Number(renderVersion) || 0))
  if (!safeRenderVersion || safeRenderVersion !== dashboardCardsRenderVersion) {
    return
  }

  dashboardCardsCommittedRenderVersion = safeRenderVersion
  scheduleDashboardFaviconLoadSync()
  scheduleDashboardPanelReveal(safeRenderVersion)
}

function scheduleDashboardPanelReveal(renderVersion: number): void {
  if (availabilityState.catalogLoading || dashboardViewReady) {
    return
  }

  const safeRenderVersion = Math.max(0, Math.floor(Number(renderVersion) || 0))
  if (
    dashboardCardsCommittedRenderVersion !== safeRenderVersion ||
    dashboardCardsRenderVersion !== safeRenderVersion
  ) {
    return
  }

  if (dashboardViewRevealFrame) {
    if (dashboardViewRevealRenderVersion === safeRenderVersion) {
      return
    }
    window.cancelAnimationFrame(dashboardViewRevealFrame)
    dashboardViewRevealFrame = 0
  }

  dashboardViewRevealRenderVersion = safeRenderVersion
  dashboardViewRevealFrame = window.requestAnimationFrame(() => {
    dashboardViewRevealFrame = window.requestAnimationFrame(() => {
      const revealRenderVersion = dashboardViewRevealRenderVersion
      dashboardViewRevealFrame = 0
      if (!shouldRevealDashboardPanelAfterRender({
        catalogLoading: availabilityState.catalogLoading,
        viewReady: dashboardViewReady,
        revealFramePending: false,
        latestRenderVersion: dashboardCardsRenderVersion,
        revealRenderVersion,
        committedRenderVersion: dashboardCardsCommittedRenderVersion
      })) {
        if (
          !availabilityState.catalogLoading &&
          !dashboardViewReady &&
          dashboardCardsCommittedRenderVersion === dashboardCardsRenderVersion
        ) {
          scheduleDashboardPanelReveal(dashboardCardsRenderVersion)
        }
        return
      }
      dashboardViewReady = true
      syncDashboardPanelReadyState()
      if (isDashboardViewReady()) {
        notifyDashboardViewReady()
      }
    })
  })
}

function resetDashboardPanelReveal(): void {
  dashboardViewReady = false
  dashboardViewRevealRenderVersion = 0
  if (dashboardViewRevealFrame) {
    window.cancelAnimationFrame(dashboardViewRevealFrame)
    dashboardViewRevealFrame = 0
  }
  syncDashboardPanelReadyState()
}

function resetDashboardVirtualScroll(): void {
  virtualState.scrollTop = 0
  if (virtualState.resultsMetrics) {
    updateDashboardResultsMetricsSnapshot({ scrollTop: 0 })
  }
  resetDashboardVirtualRenderCache({ preserveItems: true })
  if (virtualState.resultsMounted) {
    publishDashboardResultsScrollRequest(0)
    virtualState.resetScrollOnNextRender = false
    return
  }

  virtualState.resetScrollOnNextRender = true
}

function updateDashboardVirtualMetrics(): boolean {
  if (!virtualState.resultsMetrics) {
    virtualState.containerHeight = 0
    virtualState.columnCount = 1
    virtualState.contentWidth = 0
    virtualState.cardHeight = DASHBOARD_CARD_HEIGHT
    virtualState.minCardWidth = DASHBOARD_CARD_MIN_WIDTH
    virtualState.rowStride = virtualState.cardHeight + DASHBOARD_GRID_GAP
    return false
  }

  if (virtualState.resetScrollOnNextRender) {
    if (virtualState.resultsMetrics) {
      updateDashboardResultsMetricsSnapshot({ scrollTop: 0 })
    }
    if (virtualState.resultsMounted) {
      publishDashboardResultsScrollRequest(0)
    }
    virtualState.resetScrollOnNextRender = false
  }

  const metrics = getDashboardVirtualMetricsForController()

  virtualState.cardHeight = DASHBOARD_CARD_HEIGHT
  virtualState.minCardWidth = DASHBOARD_CARD_MIN_WIDTH
  virtualState.containerHeight = Math.max(1, metrics.containerHeight)
  virtualState.contentWidth = Math.max(1, metrics.contentWidth)
  virtualState.columnCount = metrics.columnCount
  virtualState.rowStride = virtualState.cardHeight + DASHBOARD_GRID_GAP
  virtualState.lastResizeWidth = virtualState.contentWidth
  virtualState.lastResizeHeight = virtualState.containerHeight
  virtualState.lastResizeColumnCount = virtualState.columnCount
  return isDashboardVirtualMetricsReady(metrics)
}

function reconcileDashboardTransientUiWithRenderedItems(renderedIds: Set<string>): void {
  for (const expandedId of [...dashboardState.expandedTagIds]) {
    if (!renderedIds.has(String(expandedId))) {
      dashboardState.expandedTagIds.delete(String(expandedId))
    }
  }

  const editorBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (
    editorBookmarkId &&
    !dashboardState.tagEditorSaving &&
    !renderedIds.has(editorBookmarkId)
  ) {
    clearDashboardTagEditorState()
    publishDashboardViewState({
      tagEditor: getHiddenDashboardTagEditorState()
    })
  }
}

function updateDashboardFloatingEditorPosition(renderedIds: Set<string>): void {
  const editorBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (editorBookmarkId && renderedIds.has(editorBookmarkId)) {
    requestDashboardTagEditorPosition()
  }
}

function renderDashboardTagEditor(existingModel?: DashboardModel): void {
  const bookmarkId = String(dashboardState.tagEditorBookmarkId || '').trim()
  if (!bookmarkId) {
    publishDashboardViewState({
      tagEditor: getHiddenDashboardTagEditorState()
    })
    return
  }

  const model = existingModel || getDashboardRenderData().model
  const item = model.items.find((entry) => String(entry.id) === bookmarkId)
  if (!item) {
    closeDashboardTagEditor()
    return
  }

  requestDashboardTagEditorPosition()
  const statusText = dashboardState.tagEditorStatus || '用逗号、顿号或换行分隔标签。'

  publishDashboardViewState({
    tagEditor: {
      actions: getDashboardTagEditorActionsState(),
      bookmarkId,
      closing: closingDashboardTagEditor,
      field: getDashboardTagEditorFieldState(),
      meta: `${displayUrl(item.url)} · ${item.path || '未归档路径'}`,
      positionRequestId: dashboardTagEditorPositionRequestId,
      status: statusText,
      title: item.title || '未命名书签',
      visible: true
    }
  })
}

function getDashboardTagEditorFieldState(): DashboardTagEditorFieldState {
  return {
    disabled: dashboardState.tagEditorSaving,
    focusRequestId: dashboardTagEditorFocusRequestId,
    value: dashboardState.tagEditorDraft
  }
}

function getDashboardTagEditorActionsState(): DashboardTagEditorActionsState {
  const busyAction = String(dashboardState.tagEditorBusyAction || '')
  const record = getDashboardTagRecord(String(dashboardState.tagEditorBookmarkId || ''))
  const hasAiTags = Boolean(record?.tags?.length)
  const canCancelGeneration = busyAction === 'regenerate-ai' && dashboardState.tagEditorSaving
  return {
    cancelDanger: canCancelGeneration,
    cancelDisabled: dashboardState.tagEditorSaving && !canCancelGeneration,
    cancelLabel: canCancelGeneration ? '取消生成' : '取消',
    clearAiBusy: busyAction === 'clear-ai',
    clearAiDisabled: dashboardState.tagEditorSaving || !hasAiTags,
    regenerateAiBusy: busyAction === 'regenerate-ai',
    regenerateAiDisabled: (
      dashboardState.tagEditorSaving ||
      availabilityState.catalogLoading ||
      aiNamingState.running ||
      aiNamingState.applying
    ),
    saveBusy: busyAction === 'save',
    saveDisabled: dashboardState.tagEditorSaving
  }
}

function getHiddenDashboardTagEditorState() {
  return {
    actions: getDashboardTagEditorActionsState(),
    bookmarkId: '',
    closing: false,
    field: {
      disabled: false,
      focusRequestId: 0,
      value: ''
    },
    meta: '',
    positionRequestId: dashboardTagEditorPositionRequestId,
    status: '',
    title: '修改标签',
    visible: false
  }
}

function requestDashboardTagEditorPosition(): void {
  dashboardTagEditorPositionRequestId += 1
}

function publishDashboardTagEditorClosingState(closing: boolean): void {
  const view = getDashboardViewSnapshot()
  if (!view.tagEditor.visible) {
    return
  }

  publishDashboardViewState({
    tagEditor: {
      ...view.tagEditor,
      closing
    }
  })
}

function buildDashboardCardViewModel(item: DashboardItem): DashboardCardViewModel {
  const renderMode = getDashboardVirtualCardRenderMode()
  const selected = dashboardState.selectedIds.has(String(item.id))
  if (renderMode === 'scroll') {
    return {
      activeMenu: false,
      bookmarkId: String(item.id),
      copyActionLabel: '',
      copyText: '',
      copyTooltip: '',
      deleting: availabilityState.deleting,
      deleteLabel: '',
      displayUrl: displayUrl(item.url),
      editTagsLabel: '',
      expanded: false,
      fallbackLabel: getFallbackLabel(item.title),
      favicon: null,
      hiddenTagCount: 0,
      itemPath: formatBookmarkPath(item.path) || '未归档路径',
      moreLabel: '',
      moveLabel: '',
      openLabel: '',
      parentId: String(item.parentId || ''),
      renderMode,
      selected,
      selectionLabel: '',
      speedDialActionLabel: '',
      speedDialActionText: '',
      speedDialPinned: false,
      tagStatusTitle: '',
      tags: [],
      title: item.title || '未命名书签',
      url: item.url,
      visibleTags: []
    }
  }

  const expanded = dashboardState.expandedTagIds.has(String(item.id))
  const selectionLabel = getDashboardSelectionLabel(item)
  const openLabel = getDashboardCardActionLabel('打开书签', item)
  const copyActionLabel = getDashboardCardActionLabel('复制书签链接', item)
  const editTagsLabel = getDashboardCardActionLabel('修改书签标签', item)
  const moveLabel = getDashboardCardActionLabel('移动书签', item)
  const deleteLabel = getDashboardCardActionLabel('删除书签', item)
  const speedDialPinned = dashboardState.speedDialPinnedIds.has(String(item.id))
  const speedDialActionText = speedDialPinned ? '从 Speed Dial 移除' : '添加进 Speed Dial'
  const speedDialTooltip = speedDialPinned ? '从 Speed Dial 移除' : '添加进 Speed Dial'
  const speedDialActionLabel = getDashboardCardActionLabel(speedDialTooltip, item)
  const moreLabel = getDashboardCardActionLabel('更多操作', item)
  const visibleTagLimit = 1
  const tags = item.tags.slice(0, visibleTagLimit)
  const hiddenTagCount = Math.max(0, item.tags.length - tags.length)
  const copyLabel = dashboardState.copyFeedbackId === String(item.id) ? '已复制' : '复制'
  const tagStatusTitle = item.hasManualTags
    ? '已有手动标签'
    : item.aiTags.length
      ? '已有 AI 标签'
      : '未生成 AI 标签'
  const itemPath = formatBookmarkPath(item.path) || '未归档路径'

  return {
    activeMenu: dashboardState.activeCardMenuBookmarkId === String(item.id),
    bookmarkId: String(item.id),
    copyActionLabel,
    copyText: copyLabel,
    copyTooltip: copyLabel === '已复制' ? '已复制' : '复制链接',
    deleting: availabilityState.deleting,
    deleteLabel,
    displayUrl: displayUrl(item.url),
    editTagsLabel,
    expanded,
    fallbackLabel: getFallbackLabel(item.title),
    favicon: getDashboardFaviconImageViewModel(item.url),
    hiddenTagCount,
    itemPath,
    moreLabel,
    moveLabel,
    openLabel,
    parentId: String(item.parentId || ''),
    renderMode,
    selected,
    selectionLabel,
    speedDialActionLabel,
    speedDialActionText,
    speedDialPinned,
    tagStatusTitle,
    tags: item.tags,
    title: item.title || '未命名书签',
    url: item.url,
    visibleTags: tags
  }
}

async function copyDashboardBookmarkUrl(bookmarkId: string): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url) {
    return
  }

  try {
    await navigator.clipboard.writeText(bookmark.url)
    setDashboardStatus('链接已复制。', bookmarkId)
  } catch {
    setDashboardStatus('复制失败，请手动复制链接。')
  }
}

function handleDashboardFaviconLoaded(detail: Extract<DashboardViewActionDetail, { action: 'favicon-load' }>): void {
  const key = getDashboardFaviconRenderKey(detail.pageUrl, detail.source, detail.src)
  if (key) {
    dashboardFailedFaviconKeys.delete(key)
  }
}

function handleDashboardFaviconError(detail: Extract<DashboardViewActionDetail, { action: 'favicon-error' }>): void {
  const pageUrl = String(detail.pageUrl || '').trim()
  const failedSource = detail.source
  const key = getDashboardFaviconRenderKey(pageUrl, failedSource, detail.src)
  if (key) {
    dashboardFailedFaviconKeys.add(key)
  }

  if (failedSource === 'cache' && pageUrl) {
    removeDashboardRemoteFavicon(pageUrl)
  }

  scheduleDashboardListRender()
}

function scheduleDashboardFaviconLoadSync(): void {
  if (dashboardFaviconLoadSyncFrame || dashboardFaviconLoadSyncTimer || typeof window === 'undefined') {
    return
  }

  dashboardFaviconLoadSyncTimer = window.setTimeout(() => {
    dashboardFaviconLoadSyncTimer = 0
    dashboardFaviconLoadSyncFrame = window.requestAnimationFrame(() => {
      dashboardFaviconLoadSyncFrame = 0
      scheduleDashboardListRender()
    })
  }, virtualState.scrollIdleTimer ? DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS : 0)
}

async function moveDashboardBookmarkToFolder(
  bookmarkId: string,
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  const targetFolder = availabilityState.folderMap.get(String(folderId))
  if (!bookmark?.url || !targetFolder) {
    setDashboardStatus('移动失败：目标书签或文件夹不存在。')
    return
  }

  if (String(bookmark.parentId || '') === folderId) {
    setDashboardStatus('书签已在该文件夹。')
    return
  }

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: '书签仪表盘拖拽移动',
      targetBookmarkIds: [bookmarkId],
      targetFolderIds: [folderId],
      estimatedChangeCount: 1
    })
    await moveBookmark(bookmarkId, folderId)
    dashboardState.selectedIds.delete(bookmarkId)
    await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    setDashboardStatus(`已移动到 ${targetFolder.path || targetFolder.title}。`)
  } catch (error) {
    setDashboardStatus(error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。')
  }
}

function setDashboardStatus(
  message: string,
  copiedId = '',
  { render = true }: { render?: boolean } = {}
): void {
  const previousCopiedId = String(dashboardState.copyFeedbackId || '')
  dashboardState.statusMessage = message
  dashboardState.copyFeedbackId = copiedId
  renderDashboardStatusOnly()
  if (render) {
    if (previousCopiedId || copiedId) {
      renderDashboardSection()
    }
  }

  if (dashboardStatusTimer) {
    window.clearTimeout(dashboardStatusTimer)
  }

  dashboardStatusTimer = window.setTimeout(() => {
    const clearingCopiedId = String(dashboardState.copyFeedbackId || '')
    dashboardState.statusMessage = ''
    dashboardState.copyFeedbackId = ''
    renderDashboardStatusOnly()
    if (clearingCopiedId) {
      renderDashboardSection()
    }
  }, 1800)
}

function renderDashboardStatusOnly(): void {
  publishDashboardViewState({
    status: createDashboardLoadingLabelState(
      availabilityState.deleting
        ? '正在处理所选书签...'
        : dashboardState.statusMessage || '',
      {
        busy: availabilityState.deleting,
        loaderClass: LOADING_LABEL_STATUS_LOADER_CLASS
      }
    )
  })
}

function createDashboardLoadingLabelState(
  label: string,
  {
    busy = false,
    variant = 'bar',
    wrapperClass = LOADING_LABEL_STATUS_WRAPPER_CLASS,
    loaderClass = LOADING_LABEL_STATUS_LOADER_CLASS
  }: {
    busy?: boolean
    variant?: 'bar' | 'spiral'
    wrapperClass?: string
    loaderClass?: string
  } = {}
): DashboardLoadingLabelState {
  return {
    busy,
    label,
    loaderClass,
    variant,
    wrapperClass
  }
}

function renderDashboardEmptyState(label: string, { loading = false }: { loading?: boolean } = {}): void {
  publishDashboardViewState({
    results: {
      mode: 'empty',
      empty: {
        loading,
        message: label
      }
    }
  })
}

function startDashboardDrag(): void {
  if (!dragState.armed || dragState.active || dragState.moving) {
    return
  }

  const bookmark = availabilityState.bookmarkMap.get(String(dragState.bookmarkId))
  if (!bookmark?.url) {
    cancelDashboardDrag({ silent: true })
    return
  }

  dragState.armed = false
  dragState.active = true
  releaseDashboardPointerCapture()
  dragState.captureElement = null
  renderDashboardDragOverlay()
  updateDashboardDragPreviewPosition()
}

function getDashboardDragPreviewTransform(): string {
  return dragState.active
    ? `translate3d(${dragState.currentX}px, ${dragState.currentY}px, 0) translate3d(-50%, -50%, 0)`
    : ''
}

function publishDashboardDragOverlayState(patch: Partial<DashboardDragOverlayState>): void {
  const view = getDashboardViewSnapshot()
  publishDashboardViewState({
    dragOverlay: {
      ...view.dragOverlay,
      ...patch
    }
  })
}

function createDashboardDragHintState(label: string, { busy = false }: { busy?: boolean } = {}): DashboardLoadingLabelState {
  return createDashboardLoadingLabelState(label, {
    busy,
    wrapperClass: LOADING_LABEL_STATUS_WRAPPER_CLASS,
    loaderClass: LOADING_LABEL_STATUS_LOADER_CLASS
  })
}

function cancelDashboardDragOverlayClose(): void {
  if (dashboardDragOverlayCloseTimer) {
    window.clearTimeout(dashboardDragOverlayCloseTimer)
    dashboardDragOverlayCloseTimer = 0
  }
  dashboardDragOverlayCloseToken += 1
}

function renderDashboardDragOverlay(existingModel?: DashboardModel): void {
  cancelDashboardDragOverlayClose()
  const model = existingModel || buildDashboardModel({
    bookmarks: availabilityState.allBookmarks,
    folders: availabilityState.allFolders,
    tagIndex: (aiNamingState.tagIndex as BookmarkTagIndex) || null,
    contentSnapshotIndex: contentSnapshotState.index,
    contentSnapshotSearchMap: contentSnapshotState.searchTextMap,
    includeFullText: contentSnapshotState.settings.fullTextSearchEnabled
  })
  const bookmark = availabilityState.bookmarkMap.get(String(dragState.bookmarkId))

  const view = getDashboardViewSnapshot()
  publishDashboardViewState({
    dragOverlay: {
      ...view.dragOverlay,
      closing: false,
      deleteTargetActive: dragState.hoverDeleteTarget,
      dragHint: createDashboardDragHintState(
        dragState.moving ? '正在移动书签...' : '选择目标文件夹后松开即可移动。',
        { busy: dragState.moving }
      ),
      dropTargets: model.folderTargets.map((folder): DashboardFolderDropTargetViewModel => ({
        active: dragState.hoverFolderId === folder.id,
        bookmarkCount: folder.bookmarkCount,
        folderCount: folder.folderCount,
        id: String(folder.id || ''),
        path: folder.path || '',
        title: folder.title || '未命名文件夹'
      })),
      dragPreview: {
        fallbackLabel: getFallbackLabel(bookmark?.title || ''),
        favicon: getDashboardFaviconImageViewModel(bookmark?.url || ''),
        title: bookmark?.title || '未命名书签'
      },
      moving: dragState.moving,
      previewTransform: getDashboardDragPreviewTransform(),
      visible: true
    }
  })
  scheduleDashboardFaviconLoadSync()
}

function updateDashboardDragPreviewPosition(): void {
  if (!dragState.active) {
    return
  }

  publishDashboardDragOverlayState({
    previewTransform: getDashboardDragPreviewTransform()
  })
}

function renderDashboardDragHint(label: string, { busy = false }: { busy?: boolean } = {}): void {
  publishDashboardDragOverlayState({
    dragHint: createDashboardDragHintState(label, { busy })
  })
}

function setDashboardDeleteDropHover(active: boolean): void {
  dragState.hoverDeleteTarget = active
  publishDashboardDragOverlayState({
    deleteTargetActive: active
  })
}

function setDashboardDropHover(folderId: string): void {
  const nextFolderId = String(folderId || '').trim()
  if (dragState.hoverFolderId === nextFolderId) {
    return
  }

  dragState.hoverFolderId = nextFolderId
  const view = getDashboardViewSnapshot()
  publishDashboardViewState({
    dragOverlay: {
      ...view.dragOverlay,
      dropTargets: view.dragOverlay.dropTargets.map((target) => ({
        ...target,
        active: target.id === nextFolderId
      }))
    }
  })
}

function hideDashboardDragOverlay(): Promise<void> {
  const overlayVisible = getDashboardViewSnapshot().dragOverlay.visible
  if (!overlayVisible) {
    clearDashboardDragOverlayContent()
    return Promise.resolve()
  }

  const closeDelay = prefersReducedMotion() ? 0 : 220
  const closeToken = dashboardDragOverlayCloseToken + 1
  dashboardDragOverlayCloseToken = closeToken
  publishDashboardDragOverlayState({
    closing: true,
    moving: false
  })

  return new Promise((resolve) => {
    if (dashboardDragOverlayCloseTimer) {
      window.clearTimeout(dashboardDragOverlayCloseTimer)
    }
    dashboardDragOverlayCloseTimer = window.setTimeout(() => {
      dashboardDragOverlayCloseTimer = 0
      if (dashboardDragOverlayCloseToken === closeToken) {
        clearDashboardDragOverlayContent()
      }
      resolve()
    }, closeDelay)
  })
}

function clearDashboardDragOverlayContent(): void {
  dragState.hoverDeleteTarget = false
  dragState.hoverFolderId = ''
  publishDashboardDragOverlayState({
    closing: false,
    deleteTargetActive: false,
    dragPreview: null,
    dropTargets: [],
    moving: false,
    previewTransform: '',
    visible: false
  })
}

function releaseDashboardPointerCapture(): void {
  const captureElement = dragState.captureElement
  if (!captureElement || dragState.pointerId < 0) {
    return
  }

  try {
    if (captureElement.hasPointerCapture(dragState.pointerId)) {
      captureElement.releasePointerCapture(dragState.pointerId)
    }
  } catch {
    // Capture may already be gone after DOM updates.
  }
}

function resetDashboardDragState(): boolean {
  const wasActive = dragState.active || dragState.armed
  releaseDashboardPointerCapture()
  Object.assign(dragState, createDashboardDragState(), {
    captureElement: null
  })
  return wasActive
}

async function closeDashboardDragForFollowUp({ silent = false }: { silent?: boolean } = {}): Promise<boolean> {
  const wasActive = resetDashboardDragState()
  await hideDashboardDragOverlay()

  if (wasActive && !silent) {
    setDashboardStatus('已取消移动。')
  }

  return wasActive
}

function isDashboardDragPointer(event: PointerEvent): boolean {
  return dragState.pointerId === event.pointerId && (dragState.armed || dragState.active)
}

function suppressDashboardNativeDragTextSelection(event?: Event): void {
  if (event?.cancelable) {
    event.preventDefault()
  }
}

export function getDashboardFaviconFallbackUrl(url: string): string {
  const endpointUrl = getDashboardFaviconEndpointUrl()
  if (!endpointUrl || !url) {
    return ''
  }
  return buildDashboardFaviconUrl(endpointUrl, url, { size: DASHBOARD_FAVICON_SIZE })
}

function getDashboardFaviconImageViewModel(pageUrl: string): DashboardCardFaviconViewModel | null {
  const normalizedPageUrl = String(pageUrl || '').trim()
  if (!normalizedPageUrl) {
    return null
  }

  const remoteEntry = getDashboardCachedFaviconEntry(normalizedPageUrl)
  if (
    remoteEntry?.iconUrl &&
    !dashboardFailedFaviconKeys.has(getDashboardFaviconRenderKey(normalizedPageUrl, 'cache', remoteEntry.iconUrl))
  ) {
    return {
      src: remoteEntry.iconUrl,
      source: 'cache',
      pageUrl: normalizedPageUrl
    }
  }

  const chromeFaviconUrl = getDashboardFaviconFallbackUrl(normalizedPageUrl)
  if (!chromeFaviconUrl) {
    return null
  }

  if (dashboardFailedFaviconKeys.has(getDashboardFaviconRenderKey(normalizedPageUrl, 'chrome', chromeFaviconUrl))) {
    return null
  }

  return {
    src: chromeFaviconUrl,
    source: 'chrome',
    pageUrl: normalizedPageUrl
  }
}

function getDashboardFaviconRenderKey(pageUrl: string, source: string, src: string): string {
  const normalizedPageUrl = getDashboardFaviconCacheKey(pageUrl)
  const normalizedSource = String(source || '').trim()
  const normalizedSrc = String(src || '').trim()
  if (!normalizedPageUrl || !normalizedSource || !normalizedSrc) {
    return ''
  }
  return `${normalizedSource}\u0001${normalizedPageUrl}\u0001${normalizedSrc}`
}

function getFallbackLabel(title: string): string {
  const trimmed = String(title || '').trim()
  return (trimmed[0] || '*').toUpperCase()
}

function syncDashboardFaviconWarmup(
  items: DashboardItem[],
  startIndex = 0,
  endIndex = items.length
): void {
  if (availabilityState.catalogLoading || !dashboardSectionActive) {
    stopDashboardFaviconWarmup()
    return
  }

  const endpointUrl = getDashboardFaviconEndpointUrl()
  const safeStartIndex = clampDashboardInteger(startIndex, 0, items.length, 0)
  const safeEndIndex = clampDashboardInteger(endIndex, safeStartIndex, items.length, items.length)
  if (
    endpointUrl &&
    dashboardFaviconWarmupQueue &&
    dashboardFaviconWarmupItems === items &&
    dashboardFaviconWarmupEndpointUrl === endpointUrl &&
    safeStartIndex === dashboardFaviconWarmupStartIndex &&
    safeEndIndex === dashboardFaviconWarmupEndIndex
  ) {
    return
  }

  const warmupItems = items.slice(safeStartIndex, safeEndIndex)
  if (!endpointUrl || !warmupItems.length) {
    stopDashboardFaviconWarmup()
    return
  }
  const warmupKey = getDashboardFaviconWarmupStableKey(warmupItems)

  if (
    warmupKey === dashboardFaviconWarmupKey &&
    safeStartIndex === dashboardFaviconWarmupStartIndex &&
    safeEndIndex === dashboardFaviconWarmupEndIndex &&
    dashboardFaviconWarmupQueue
  ) {
    return
  }

  stopDashboardFaviconWarmup()
  dashboardFaviconWarmupItems = items
  dashboardFaviconWarmupKey = warmupKey
  dashboardFaviconWarmupStartIndex = safeStartIndex
  dashboardFaviconWarmupEndIndex = safeEndIndex
  dashboardFaviconWarmupEndpointUrl = endpointUrl
  dashboardFaviconWarmupQueue = createDashboardFaviconWarmupQueue({
    bookmarks: warmupItems,
    faviconEndpointUrl: endpointUrl,
    remoteCache: dashboardFaviconCache,
    size: DASHBOARD_FAVICON_SIZE,
    maxConcurrent: DASHBOARD_FAVICON_WARMUP_CONCURRENCY,
    batchSize: DASHBOARD_FAVICON_WARMUP_BATCH_SIZE,
    batchDelayMs: DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS,
    loadFavicon: (chromeFaviconUrl, item) => warmDashboardFavicon(chromeFaviconUrl, item, {
      getCache: () => dashboardFaviconCache,
      upsert: upsertDashboardRemoteFavicon,
      markFailed: markDashboardRemoteFaviconFailed
    }, {
      canFetchRemote: canFetchDashboardRemoteFavicon
    }),
    onWarm: (item) => {
      scheduleDashboardFaviconForPageUrlSync(item.pageUrl)
    },
    onError: (item, error) => {
      aggregateDashboardFaviconWarmupError(item.pageUrl, error)
    }
  })
  dashboardFaviconWarmupQueue.start()
}

function scheduleDashboardFaviconWarmup(
  items: DashboardItem[],
  startIndex = 0,
  endIndex = items.length
): void {
  if (!virtualState.scrollIdleTimer) {
    syncDashboardFaviconWarmup(items, startIndex, endIndex)
    return
  }

  dashboardFaviconWarmupPendingItems = items
  dashboardFaviconWarmupPendingStartIndex = startIndex
  dashboardFaviconWarmupPendingEndIndex = endIndex
}

function flushPendingDashboardFaviconWarmup(): void {
  const items = dashboardFaviconWarmupPendingItems
  if (!items) {
    return
  }

  const startIndex = dashboardFaviconWarmupPendingStartIndex
  const endIndex = dashboardFaviconWarmupPendingEndIndex
  clearPendingDashboardFaviconWarmup()
  syncDashboardFaviconWarmup(items, startIndex, endIndex)
}

function clearPendingDashboardFaviconWarmup(): void {
  dashboardFaviconWarmupPendingItems = null
  dashboardFaviconWarmupPendingStartIndex = -1
  dashboardFaviconWarmupPendingEndIndex = -1
}

function stopDashboardFaviconWarmup(): void {
  dashboardFaviconWarmupQueue?.cancel()
  dashboardFaviconWarmupQueue = null
  dashboardFaviconWarmupItems = null
  dashboardFaviconWarmupKey = ''
  dashboardFaviconWarmupStartIndex = -1
  dashboardFaviconWarmupEndIndex = -1
  dashboardFaviconWarmupEndpointUrl = ''
  clearPendingDashboardFaviconWarmup()
  dashboardFaviconDirtyPageUrls.clear()
  if (dashboardFaviconDirtySyncTimer) {
    globalThis.clearTimeout(dashboardFaviconDirtySyncTimer)
    dashboardFaviconDirtySyncTimer = 0
  }
  flushDashboardFaviconWarmupDebugSummary()
}

function getDashboardFaviconWarmupStableKey(items: DashboardItem[]): string {
  return items.map((item) => `${String(item.id || '')}\u0002${String(item.url || '')}`).join('\u0001')
}

function syncDashboardFaviconsForPageUrls(pageUrls: Iterable<string>): void {
  if (!dashboardSectionActive || availabilityState.catalogLoading || !virtualState.items.length) {
    return
  }

  const dirtyPageUrlKeys = new Set<string>()
  for (const pageUrl of pageUrls) {
    const cacheKey = getDashboardFaviconCacheKey(pageUrl)
    if (!cacheKey || dirtyPageUrlKeys.has(cacheKey)) {
      continue
    }
    const entry = getDashboardCachedFaviconEntry(cacheKey)
    if (entry?.iconUrl) {
      dirtyPageUrlKeys.add(cacheKey)
    }
  }
  if (!dirtyPageUrlKeys.size) {
    return
  }

  if (!virtualState.items.some((item) => dirtyPageUrlKeys.has(getDashboardFaviconCacheKey(item.url)))) {
    return
  }

  scheduleDashboardListRender()
}

function scheduleDashboardFaviconForPageUrlSync(pageUrl: string): void {
  const normalizedPageUrl = getDashboardFaviconCacheKey(pageUrl)
  if (!normalizedPageUrl) {
    return
  }

  dashboardFaviconDirtyPageUrls.add(normalizedPageUrl)
  if (typeof window === 'undefined') {
    flushDashboardFaviconDirtySync()
    return
  }
  if (dashboardFaviconDirtySyncTimer) {
    return
  }

  dashboardFaviconDirtySyncTimer = window.setTimeout(
    () => flushDashboardFaviconDirtySync(),
    virtualState.scrollIdleTimer
      ? DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS
      : DASHBOARD_FAVICON_DIRTY_SYNC_DELAY_MS
  )
}

function flushDashboardFaviconDirtySync(): void {
  if (dashboardFaviconDirtySyncTimer) {
    window.clearTimeout(dashboardFaviconDirtySyncTimer)
    dashboardFaviconDirtySyncTimer = 0
  }
  if (!dashboardFaviconDirtyPageUrls.size) {
    return
  }

  const dirtyPageUrls = [...dashboardFaviconDirtyPageUrls]
  dashboardFaviconDirtyPageUrls.clear()
  runIdle(() => {
    syncDashboardFaviconsForPageUrls(dirtyPageUrls)
  }, { timeout: DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS })
}

function getDashboardCachedFaviconEntry(pageUrl: string, now = Date.now()): DashboardFaviconCacheEntry | null {
  return getDashboardCachedFaviconEntryFromCache(dashboardFaviconCache, pageUrl, now)
}

function upsertDashboardRemoteFavicon(pageUrl: string, iconUrl: string, now = Date.now()): void {
  const key = getDashboardFaviconCacheKey(pageUrl)
  if (!key || !isDashboardSafeImageUrl(iconUrl)) {
    return
  }

  dashboardFaviconCache = normalizeDashboardFaviconCache({
    ...dashboardFaviconCache,
    [key]: {
      pageUrl: key,
      iconUrl,
      updatedAt: now,
      version: DASHBOARD_FAVICON_FETCH_VERSION
    }
  }, { now })
  scheduleDashboardFaviconCacheSave()
}

function markDashboardRemoteFaviconFailed(pageUrl: string, now = Date.now()): void {
  const key = getDashboardFaviconCacheKey(pageUrl)
  if (!key) {
    return
  }

  dashboardFaviconCache = normalizeDashboardFaviconCache({
    ...dashboardFaviconCache,
    [key]: {
      pageUrl: key,
      iconUrl: '',
      updatedAt: 0,
      failedAt: now,
      version: DASHBOARD_FAVICON_FETCH_VERSION
    }
  }, { now })
  scheduleDashboardFaviconCacheSave()
}

function removeDashboardRemoteFavicon(pageUrl: string): void {
  const key = getDashboardFaviconCacheKey(pageUrl)
  if (!key || !dashboardFaviconCache[key]) {
    return
  }

  dashboardFaviconCache = { ...dashboardFaviconCache }
  delete dashboardFaviconCache[key]
  scheduleDashboardFaviconCacheSave()
}

function scheduleDashboardFaviconCacheSave(): void {
  if (!dashboardFaviconCacheHydrated) {
    return
  }

  if (dashboardFaviconCacheSaveTimer) {
    window.clearTimeout(dashboardFaviconCacheSaveTimer)
  }

  dashboardFaviconCacheSaveTimer = window.setTimeout(() => {
    dashboardFaviconCacheSaveTimer = 0
    void setLocalStorage({
      [STORAGE_KEYS.dashboardFaviconCache]: dashboardFaviconCache
    }).catch((error) => {
      logDashboardFaviconDebug('[Curator] Dashboard favicon cache save skipped', error)
    })
  }, 600)
}

async function canFetchDashboardRemoteFavicon(pageUrl: string): Promise<boolean> {
  const originPattern = getDashboardRemoteFaviconOriginPattern(pageUrl)
  if (!originPattern || typeof chrome === 'undefined' || !chrome.permissions?.contains) {
    return false
  }

  try {
    return await chrome.permissions.contains({ origins: [originPattern] })
  } catch {
    return false
  }
}

function getDashboardRemoteFaviconOriginPattern(pageUrl: string): string {
  try {
    const parsedUrl = new URL(pageUrl)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return ''
    }
    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

function aggregateDashboardFaviconWarmupError(pageUrl: string, error: unknown): void {
  if (!isDashboardFaviconDebugEnabled()) {
    return
  }

  dashboardFaviconWarmupDebugSummary = {
    skipped: (dashboardFaviconWarmupDebugSummary?.skipped || 0) + 1,
    firstPageUrl: dashboardFaviconWarmupDebugSummary?.firstPageUrl || String(pageUrl || ''),
    firstError: dashboardFaviconWarmupDebugSummary?.firstError || getDashboardFaviconErrorSummary(error)
  }
  if (dashboardFaviconDebugSummaryTimer || typeof window === 'undefined') {
    return
  }

  dashboardFaviconDebugSummaryTimer = window.setTimeout(
    () => flushDashboardFaviconWarmupDebugSummary(),
    DASHBOARD_FAVICON_WARMUP_DEBUG_DELAY_MS
  )
}

function flushDashboardFaviconWarmupDebugSummary(): void {
  if (dashboardFaviconDebugSummaryTimer) {
    window.clearTimeout(dashboardFaviconDebugSummaryTimer)
    dashboardFaviconDebugSummaryTimer = 0
  }
  const summary = dashboardFaviconWarmupDebugSummary
  dashboardFaviconWarmupDebugSummary = null
  if (!summary || !isDashboardFaviconDebugEnabled()) {
    return
  }

  dashboardDebugConsole.debug?.('[Curator] Dashboard favicon warmup skipped', {
    count: summary.skipped,
    sampleUrl: summary.firstPageUrl,
    sampleError: summary.firstError
  })
}

function getDashboardFaviconErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error || 'unknown error')
}

function logDashboardFaviconDebug(message: string, payload: unknown): void {
  if (!isDashboardFaviconDebugEnabled()) {
    return
  }
  dashboardDebugConsole.debug?.(message, payload)
}

function isDashboardFaviconDebugEnabled(): boolean {
  try {
    const globalFlags = globalThis as {
      __CURATOR_DASHBOARD_DEBUG__?: boolean
      __CURATOR_PERF__?: boolean
    }
    if (globalFlags.__CURATOR_DASHBOARD_DEBUG__ === true || globalFlags.__CURATOR_PERF__ === true) {
      return true
    }
  } catch {
    // ignore
  }

  try {
    return globalThis.localStorage?.getItem('curator_dashboard_debug') === '1'
  } catch {
    return false
  }
}
