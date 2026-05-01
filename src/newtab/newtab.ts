import {
  BOOKMARKS_BAR_ID,
  STORAGE_KEYS
} from '../shared/constants.js'
import {
  createBookmark,
  getBookmarkTree,
  moveBookmark,
  removeBookmark,
  updateBookmark
} from '../shared/bookmarks-api.js'
import {
  extractBookmarkData,
  findBookmarksBar,
  findNodeById
} from '../shared/bookmark-tree.js'
import { appendRecycleEntry } from '../shared/recycle-bin.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'
import type { FolderRecord } from '../shared/types.js'
import { cancelExitMotion, closeWithExitMotion } from '../shared/motion.js'
import {
  DEFAULT_ICON_SETTINGS,
  ICON_LAYOUT_PRESETS,
  ICON_PRESET_META,
  type IconLayoutPresetKey,
  type IconSettings,
  detectPresetFromValues,
  getFixedIconGridWidthPx,
  getFolderGapPx,
  getIconGapPx,
  getIconPageWidthPx,
  getIconRowGapPx,
  normalizeIconSettings
} from './icon-settings.js'
import {
  createMissingFolderView,
  createNewTabPage,
  createStateView,
  resolveNewTabContentState,
  type NewTabPageModule
} from './content-state.js'

const DEFAULT_NEW_TAB_FOLDER_TITLE = '标签页'
const FAVICON_SIZE = 64
const CUSTOM_ICON_MAX_BYTES = 2 * 1024 * 1024
const BOOKMARK_DRAG_LONG_PRESS_MS = 320
const FOLDER_DRAG_LONG_PRESS_MS = BOOKMARK_DRAG_LONG_PRESS_MS
const SETTINGS_SAVE_DEBOUNCE_MS = 260
const EAGER_FAVICON_LIMIT = 40
const HIGH_PRIORITY_FAVICON_LIMIT = 12
const BACKGROUND_MEDIA_DB_NAME = 'curatorNewTabBackgroundMedia'
const BACKGROUND_MEDIA_STORE = 'media'
const BACKGROUND_URL_CACHE_KEY = 'urlImage'
const BACKGROUND_URL_CACHE_MAX_DIMENSION = 2560
const BACKGROUND_URL_CACHE_QUALITY = 0.86
const DEFAULT_BACKGROUND_SETTINGS = {
  type: 'color',
  color: '#000000',
  imageName: '',
  videoName: '',
  url: '',
  maskEnabled: false,
  maskStyle: 'dark',
  maskBlur: 12
}
const SUPPORTED_BACKGROUND_TYPES = new Set(['image', 'video', 'urls', 'color'])
const SUPPORTED_BACKGROUND_MASK_STYLES = new Set(['dark', 'frosted', 'light'])
const DEFAULT_SEARCH_SETTINGS = {
  enabled: true,
  openInNewTab: false,
  engine: 'default',
  placeholder: '搜索网页或书签',
  width: 44,
  height: 34,
  offsetY: 0,
  background: 58
}
const SUPPORTED_SEARCH_ENGINES = new Set(['default', 'google', 'bing', 'baidu', 'duckduckgo'])
const SEARCH_SUGGESTION_LIMIT = 6
const NEW_TAB_ACTIVITY_STORAGE_KEY = 'curatorBookmarkNewTabActivity'
const QUICK_ACCESS_ITEM_LIMIT = 8
const ACTIVITY_RECORD_LIMIT = 160
const DEFAULT_GENERAL_SETTINGS = {
  hideSettingsTrigger: false,
  showFrequentBookmarks: true,
  showRecentBookmarks: true
}
const DEFAULT_FOLDER_SETTINGS = {
  selectedFolderIds: [] as string[],
  hideFolderNames: false
}
const DEFAULT_TIME_SETTINGS = {
  enabled: true,
  showSeconds: false,
  hour12: false,
  clockSize: 100,
  dateFormat: 'year-month-day-weekday',
  timeZone: 'auto',
  displayMode: 'time-date'
}
const TIME_ZONE_LABELS: Record<string, string> = {
  auto: '本地',
  'Asia/Shanghai': '北京',
  'Asia/Tokyo': '东京',
  'Asia/Singapore': '新加坡',
  'Europe/London': '伦敦',
  'Europe/Paris': '巴黎',
  'America/New_York': '纽约',
  'America/Los_Angeles': '洛杉矶'
}
const SUPPORTED_TIME_ZONES = new Set([
  'auto',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles'
])
const SUPPORTED_DATE_FORMATS = new Set([
  'year-month-day-weekday',
  'weekday-day-month',
  'weekday-month-day',
  'month-day-weekday'
])
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

type NewTabFolderSettings = typeof DEFAULT_FOLDER_SETTINGS

interface NewTabFolderSection {
  id: string
  title: string
  path: string
  node: chrome.bookmarks.BookmarkTreeNode
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
}

interface SearchBookmarkSuggestion {
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  score: number
  order: number
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

interface QuickAccessItem {
  id: string
  title: string
  url: string
  detail: string
  badge: string
  bookmark: chrome.bookmarks.BookmarkTreeNode
}

type MenuActionIcon = 'trash' | 'refresh' | 'save' | 'plus' | 'copy' | 'pin'

const state = {
  loading: true,
  creatingFolder: false,
  error: '',
  rootNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderSections: [] as NewTabFolderSection[],
  bookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
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
  addMenuOpen: false,
  addMenuExpanded: false,
  addMenuX: 0,
  addMenuY: 0,
  addTitle: '',
  addUrl: '',
  addMenuBusy: false,
  addMenuError: '',
  customIcons: {} as Record<string, string>,
  backgroundUrlCacheBusy: false,
  backgroundUrlCacheStatus: '',
  backgroundStatus: '',
  backgroundStatusTone: 'info' as 'info' | 'success' | 'warning' | 'error',
  draggingBookmarkId: '',
  dragPointerId: 0,
  dragLongPressTimer: 0,
  dragClientX: 0,
  dragClientY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0,
  draggingBookmarkFolderId: '',
  dragOriginalOrderIds: [] as string[],
  dragSuppressClick: false,
  draggingFolderId: '',
  folderDragPointerId: 0,
  folderDragLongPressTimer: 0,
  folderDragClientX: 0,
  folderDragClientY: 0,
  folderDragOffsetX: 0,
  folderDragOffsetY: 0,
  folderDragOriginalOrderIds: [] as string[],
  folderDragSuppressClick: false,
  reorderingBookmarks: false,
  backgroundSettings: { ...DEFAULT_BACKGROUND_SETTINGS },
  searchSettings: { ...DEFAULT_SEARCH_SETTINGS },
  iconSettings: { ...DEFAULT_ICON_SETTINGS },
  generalSettings: { ...DEFAULT_GENERAL_SETTINGS },
  folderSettings: { ...DEFAULT_FOLDER_SETTINGS } as NewTabFolderSettings,
  activity: {
    pinnedIds: [],
    records: {}
  } as NewTabActivityState,
  folderCandidatesExpanded: false,
  folderCandidateQuery: '',
  timeSettings: { ...DEFAULT_TIME_SETTINGS },
  faviconRefreshTokens: new Map<string, number>()
}

const root = document.getElementById('newtab-root')
const settingsTrigger = document.getElementById('newtab-settings-trigger')
const settingsDrawer = document.getElementById('newtab-settings-drawer')
const settingsBackdrop = document.getElementById('newtab-settings-backdrop')
const settingsClose = document.getElementById('newtab-settings-close')
let clockTimer = 0
let backgroundApplyToken = 0
let activeBackgroundObjectUrl = ''
let lastAppliedBackgroundMediaSignature = ''
let bookmarkDragGhost: HTMLElement | null = null
let bookmarkDragGhostFrame = 0
let folderDragGhost: HTMLElement | null = null
let folderDragGhostFrame = 0
let resizeLayoutFrame = 0
let deferredRenderFrame = 0
let settingsDrawerReturnFocusElement: HTMLElement | null = null
let deferredRenderClockUpdate = false
let searchSettingsSaveTimer = 0
let iconSettingsSaveTimer = 0
let timeSettingsSaveTimer = 0

document.addEventListener('DOMContentLoaded', () => {
  bindEvents()
  renderIconPresetCards()
  void preloadBackgroundSettings()
  void refreshNewTab()
})

function bindEvents(): void {
  bindGeneralSettingsEvents()
  bindFolderSettingsEvents()
  bindBackgroundSettingsEvents()
  bindSearchSettingsEvents()
  bindIconSettingsEvents()
  bindTimeSettingsEvents()
  bindSettingsRangeVisuals()
  settingsTrigger?.addEventListener('click', () => {
    openSettingsDrawer()
  })
  settingsClose?.addEventListener('click', closeSettingsDrawer)
  settingsBackdrop?.addEventListener('click', closeSettingsDrawer)
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element) || (!state.activeMenuBookmarkId && !state.addMenuOpen)) {
      return
    }

    if (
      target.closest('.bookmark-edit-menu') ||
      target.closest('.bookmark-add-menu') ||
      target.closest('[data-bookmark-id]')
    ) {
      return
    }

    closeBookmarkMenu()
    closeAddBookmarkMenu()
  })
  window.addEventListener('resize', () => {
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    cancelBookmarkDrag()
    cancelFolderDrag()
    if (!resizeLayoutFrame) {
      resizeLayoutFrame = window.requestAnimationFrame(() => {
        resizeLayoutFrame = 0
        render()
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
      (state.folderDragSuppressClick && target.closest('[data-folder-drag-handle]'))
    ) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
  })
  root?.addEventListener('pointerdown', handleFolderPointerDown)
  root?.addEventListener('pointerdown', handleBookmarkPointerDown)
  window.addEventListener('pointermove', handleBookmarkPointerMove)
  window.addEventListener('pointermove', handleFolderPointerMove)
  window.addEventListener('pointerup', (event) => {
    void finishBookmarkDrag(event)
    void finishFolderDrag(event)
  })
  window.addEventListener('pointercancel', () => {
    cancelBookmarkDrag()
    cancelFolderDrag()
  })
  root?.addEventListener('contextmenu', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (
      state.draggingBookmarkId ||
      state.dragSuppressClick ||
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

  chrome.bookmarks?.onCreated?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onRemoved?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onChanged?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onMoved?.addListener(handleBookmarksChanged)

  window.clearTimeout(clockTimer)
  scheduleClockTick()
}

function bindSettingsRangeVisuals(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('.setting-range')) {
    input.addEventListener('input', () => {
      updateSettingRangeVisual(input)
    })
    updateSettingRangeVisual(input)
  }
}

function updateAllSettingRangeVisuals(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('.setting-range')) {
    updateSettingRangeVisual(input)
  }
}

function updateSettingRangeVisual(input: HTMLInputElement): void {
  const min = Number(input.min || 0)
  const max = Number(input.max || 100)
  const value = Number(input.value || min)
  const progress = max > min
    ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100
    : 0
  input.style.setProperty('--range-progress', `${progress}%`)
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Tab' && trapSettingsDrawerFocus(event)) {
    return
  }

  if (event.key === 'Escape') {
    if (isSettingsDrawerOpen()) {
      event.preventDefault()
      closeSettingsDrawer()
    }
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    cancelFolderDrag()
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
    document.body.classList.contains('settings-open')
  ) {
    return false
  }

  const activeElement = document.activeElement
  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    activeElement instanceof HTMLButtonElement ||
    activeElement instanceof HTMLAnchorElement ||
    activeElement?.getAttribute('contenteditable') === 'true'
  ) {
    return false
  }

  return event.key === '/' || (event.key.length === 1 && Boolean(event.key.trim()))
}

function bindTimeSettingsEvents(): void {
  document.getElementById('time-enabled')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-show-seconds')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-hour12')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-date-format')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-time-zone')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-display-mode')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-clock-size')?.addEventListener('input', handleTimeSettingsChange)
}

function bindBackgroundSettingsEvents(): void {
  document.getElementById('background-type')?.addEventListener('change', handleBackgroundSettingsChange)
  document.getElementById('background-color')?.addEventListener('input', handleBackgroundSettingsChange)
  document.getElementById('background-url')?.addEventListener('input', handleBackgroundSettingsChange)
  document.getElementById('background-mask-enabled')?.addEventListener('change', handleBackgroundSettingsChange)
  document.getElementById('background-mask-style')?.addEventListener('change', handleBackgroundSettingsChange)
  document.getElementById('background-mask-blur')?.addEventListener('input', handleBackgroundSettingsChange)
  document.getElementById('background-url-cache-button')?.addEventListener('click', () => {
    void handleBackgroundUrlCacheClick()
  })
  document.getElementById('background-image-picker')?.addEventListener('click', () => {
    const input = document.getElementById('background-image-file')
    if (input instanceof HTMLInputElement) {
      input.click()
    }
  })
  document.getElementById('background-video-picker')?.addEventListener('click', () => {
    const input = document.getElementById('background-video-file')
    if (input instanceof HTMLInputElement) {
      input.click()
    }
  })
  document.getElementById('background-image-file')?.addEventListener('change', (event) => {
    void handleBackgroundFileChange('image', event)
  })
  document.getElementById('background-video-file')?.addEventListener('change', (event) => {
    void handleBackgroundFileChange('video', event)
  })
}

function bindSearchSettingsEvents(): void {
  document.getElementById('search-enabled')?.addEventListener('change', handleSearchSettingsChange)
  document.getElementById('search-open-new-tab')?.addEventListener('change', handleSearchSettingsChange)
  document.getElementById('search-engine')?.addEventListener('change', handleSearchSettingsChange)
  document.getElementById('search-placeholder')?.addEventListener('input', handleSearchSettingsChange)
  document.getElementById('search-width')?.addEventListener('input', handleSearchSettingsChange)
  document.getElementById('search-height')?.addEventListener('input', handleSearchSettingsChange)
  document.getElementById('search-offset-y')?.addEventListener('input', handleSearchSettingsChange)
  document.getElementById('search-background')?.addEventListener('input', handleSearchSettingsChange)
}

function bindIconSettingsEvents(): void {
  document.getElementById('icon-page-width')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-shell-size')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-column-gap')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-row-gap')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-folder-gap')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-columns')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-vertical-center')?.addEventListener('change', handleIconSettingsChange)
  document.getElementById('icon-show-titles')?.addEventListener('change', handleIconSettingsChange)
  document.getElementById('icon-layout-control')?.addEventListener('click', handleIconLayoutModeClick)
  document.getElementById('icon-title-lines-control')?.addEventListener('click', handleIconTitleLinesClick)
  document.getElementById('icon-advanced-toggle')?.addEventListener('click', toggleIconAdvanced)
  document.getElementById('icon-preset-row')?.addEventListener('click', handlePresetCardClick)
}

function bindGeneralSettingsEvents(): void {
  document
    .getElementById('general-hide-settings-trigger')
    ?.addEventListener('change', handleGeneralSettingsChange)
  document
    .getElementById('general-show-frequent')
    ?.addEventListener('change', handleGeneralSettingsChange)
  document
    .getElementById('general-show-recent')
    ?.addEventListener('change', handleGeneralSettingsChange)
}

function bindFolderSettingsEvents(): void {
  document
    .getElementById('folder-hide-names')
    ?.addEventListener('change', handleFolderSettingsChange)
  document
    .getElementById('folder-candidates-toggle')
    ?.addEventListener('click', toggleFolderCandidates)
  document
    .getElementById('folder-candidate-search')
    ?.addEventListener('input', handleFolderCandidateSearch)
  document
    .getElementById('folder-candidate-list')
    ?.addEventListener('click', handleFolderCandidateClick)
  document
    .getElementById('folder-selected-list')
    ?.addEventListener('click', handleSelectedFolderClick)
}

function handleGeneralSettingsChange(): void {
  state.generalSettings = readGeneralSettingsFromControls()
  void saveGeneralSettings()
  syncGeneralSettingsControls()
  applyGeneralSettings()
  render()
  updateClockText()
}

function handleFolderSettingsChange(): void {
  state.folderSettings = readFolderSettingsFromControls()
  void saveFolderSettings()
  syncFolderSettingsControls()
  applyFolderSettings()
  render()
  updateClockText()
}

function toggleFolderCandidates(): void {
  state.folderCandidatesExpanded = !state.folderCandidatesExpanded
  syncFolderSettingsControls()
}

function handleFolderCandidateSearch(event: Event): void {
  const target = event.target
  state.folderCandidateQuery = target instanceof HTMLInputElement ? target.value : ''
  syncFolderSettingsControls()
}

function handleFolderCandidateClick(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const button = target.closest('[data-folder-candidate-id]')
  if (!(button instanceof HTMLElement)) {
    return
  }

  const folderId = String(button.dataset.folderCandidateId || '').trim()
  if (!folderId) {
    return
  }

  void toggleSelectedFolder(folderId, { preserveCandidateScroll: true })
}

function handleSelectedFolderClick(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const button = target.closest('[data-folder-remove-id]')
  if (!(button instanceof HTMLElement)) {
    return
  }

  const folderId = String(button.dataset.folderRemoveId || '').trim()
  if (!folderId) {
    return
  }

  void removeSelectedFolder(folderId)
}

async function toggleSelectedFolder(
  folderId: string,
  { preserveCandidateScroll = false } = {}
): Promise<void> {
  const currentIds = state.folderSettings.selectedFolderIds
  const nextIds = currentIds.includes(folderId)
    ? currentIds.filter((id) => id !== folderId)
    : [...currentIds, folderId]
  await updateSelectedFolders(nextIds, { preserveCandidateScroll })
}

async function removeSelectedFolder(folderId: string): Promise<void> {
  await updateSelectedFolders(
    state.folderSettings.selectedFolderIds.filter((id) => id !== folderId)
  )
}

async function updateSelectedFolders(
  folderIds: string[],
  { preserveCandidateScroll = false } = {}
): Promise<void> {
  const candidateList = document.getElementById('folder-candidate-list')
  const previousScrollTop = preserveCandidateScroll && candidateList instanceof HTMLElement
    ? candidateList.scrollTop
    : 0

  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: folderIds
  })
  state.folderSections = buildNewTabFolderSections(state.rootNode, state.folderSettings)
  state.folderNode = state.folderSections[0]?.node || null
  state.bookmarks = getAllSectionBookmarks()

  await saveFolderSettings()
  render()
  syncFolderSettingsControls()
  applyFolderSettings()
  updateClockText()

  if (preserveCandidateScroll) {
    window.requestAnimationFrame(() => {
      const nextList = document.getElementById('folder-candidate-list')
      if (nextList instanceof HTMLElement) {
        nextList.scrollTop = previousScrollTop
      }
    })
  }
}

function handleIconSettingsChange(): void {
  commitIconSettings(readIconSettingsFromControls())
}

function handleIconLayoutModeClick(event: Event): void {
  const target = event.target
  const button = target instanceof Element
    ? target.closest<HTMLElement>('[data-icon-layout-mode]')
    : null
  const layoutMode = button?.dataset.iconLayoutMode
  if (layoutMode !== 'auto' && layoutMode !== 'fixed') {
    return
  }

  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    layoutMode,
    preset: ''
  }))
}

function handleIconTitleLinesClick(event: Event): void {
  const target = event.target
  const button = target instanceof Element
    ? target.closest<HTMLElement>('[data-icon-title-lines]')
    : null
  if (!button || button.getAttribute('aria-disabled') === 'true') {
    return
  }

  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    titleLines: Number(button.dataset.iconTitleLines),
    preset: ''
  }))
}

function handleSearchSettingsChange(): void {
  state.searchSettings = readSearchSettingsFromControls()
  scheduleSearchSettingsSave()
  scheduleRender({ updateClock: true })
  syncSearchSettingsControls()
}

function handleBackgroundSettingsChange(): void {
  const previousSettings = state.backgroundSettings
  const nextSettings = readBackgroundSettingsFromControls()
  const shouldClearUrlCache = shouldClearBackgroundUrlCache(previousSettings, nextSettings)
  if (shouldClearUrlCache) {
    state.backgroundUrlCacheStatus = ''
  }
  state.backgroundSettings = nextSettings
  void saveBackgroundSettings()
  syncBackgroundSettingsControls()
  void applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache)
}

async function applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache: boolean): Promise<void> {
  if (shouldClearUrlCache) {
    await clearBackgroundUrlCache()
  }
  await applyBackgroundSettings()
}

async function handleBackgroundFileChange(
  mediaType: 'image' | 'video',
  event: Event
): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }

  const file = input.files?.[0] || null
  input.value = ''
  if (!file) {
    return
  }

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
    await saveBackgroundSettings()
    if (shouldClearBackgroundUrlCache(previousSettings, state.backgroundSettings)) {
      await clearBackgroundUrlCache()
    }
    syncBackgroundSettingsControls()
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

async function handleBackgroundUrlCacheClick(): Promise<void> {
  if (state.backgroundUrlCacheBusy) {
    return
  }

  const imageUrl = normalizeBackgroundImageUrl(state.backgroundSettings.url)
  if (state.backgroundSettings.type !== 'urls' || !imageUrl) {
    setBackgroundStatus('请输入有效的 http 或 https 图片链接后再缓存。', 'warning')
    syncBackgroundSettingsControls()
    return
  }

  state.backgroundUrlCacheBusy = true
  state.backgroundUrlCacheStatus = '请求授权...'
  setBackgroundStatus('正在请求图片域名授权...', 'info')
  syncBackgroundSettingsControls()
  try {
    const granted = await requestOriginPermission(imageUrl)
    if (!granted) {
      state.backgroundUrlCacheStatus = '未授权'
      setBackgroundStatus('未获得图片域名授权：请允许访问当前图片来源后重试。', 'warning')
      return
    }
    if (!isCurrentBackgroundUrl(imageUrl)) {
      return
    }

    state.backgroundUrlCacheStatus = '下载中...'
    syncBackgroundSettingsControls()
    const blob = await fetchBackgroundUrlImage(imageUrl)
    if (!isCurrentBackgroundUrl(imageUrl)) {
      return
    }

    state.backgroundUrlCacheStatus = '写入缓存...'
    syncBackgroundSettingsControls()
    await saveBackgroundUrlCache(imageUrl, blob)
    if (!isCurrentBackgroundUrl(imageUrl)) {
      return
    }

    setBackgroundImageFromBlob(blob)
    lastAppliedBackgroundMediaSignature = getBackgroundMediaSignature(state.backgroundSettings)
    state.backgroundUrlCacheStatus = `已缓存 ${formatBytes(blob.size)}`
    setBackgroundStatus('远程图片已缓存到本地。', 'success')
  } catch (error) {
    state.backgroundUrlCacheStatus = '缓存失败'
    setBackgroundStatus(getBackgroundUrlCacheErrorMessage(error), 'error')
  } finally {
    state.backgroundUrlCacheBusy = false
    syncBackgroundSettingsControls()
  }
}

function handleTimeSettingsChange(): void {
  state.timeSettings = readTimeSettingsFromControls()
  scheduleTimeSettingsSave()
  scheduleRender({ updateClock: true })
  syncTimeSettingsControls()
  scheduleClockTick()
}

function openSettingsDrawer(options?: { focusFirstControl?: boolean }): void {
  const focusFirstControl = options?.focusFirstControl !== false
  settingsDrawerReturnFocusElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  if (settingsDrawer) {
    cancelExitMotion(settingsDrawer)
  }
  if (settingsBackdrop) {
    cancelExitMotion(settingsBackdrop)
  }
  syncGeneralSettingsControls()
  syncFolderSettingsControls()
  syncBackgroundSettingsControls()
  syncSearchSettingsControls()
  syncIconSettingsControls()
  syncTimeSettingsControls()
  updateAllSettingRangeVisuals()
  settingsDrawer?.classList.add('open')
  settingsBackdrop?.classList.add('open')
  settingsDrawer?.setAttribute('aria-hidden', 'false')
  settingsTrigger?.setAttribute('aria-expanded', 'true')
  document.body.classList.add('settings-open')
  if (focusFirstControl) {
    window.requestAnimationFrame(() => {
      focusFirstSettingsDrawerControl()
    })
  }
}

function openFolderSourceSettings(): void {
  state.folderCandidatesExpanded = true
  state.folderCandidateQuery = ''
  openSettingsDrawer({ focusFirstControl: false })
  syncFolderSettingsControls()
  window.requestAnimationFrame(() => {
    const section = document.getElementById('settings-folder-title')?.closest('.settings-section')
    const searchInput = document.getElementById('folder-candidate-search')

    section?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    if (searchInput instanceof HTMLInputElement) {
      searchInput.focus()
    }
  })
}

function closeSettingsDrawer(): void {
  if (!isSettingsDrawerOpen()) {
    return
  }

  settingsDrawer?.classList.remove('open')
  settingsBackdrop?.classList.remove('open')
  settingsDrawer?.classList.add('is-closing')
  settingsBackdrop?.classList.add('is-closing')
  settingsDrawer?.setAttribute('aria-hidden', 'true')
  settingsTrigger?.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('settings-open')
  window.setTimeout(() => {
    settingsDrawer?.classList.remove('is-closing')
    settingsBackdrop?.classList.remove('is-closing')
  }, 260)
  restoreSettingsDrawerFocus()
}

function isSettingsDrawerOpen(): boolean {
  return document.body.classList.contains('settings-open')
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
  if (!settingsDrawer || !isSettingsDrawerOpen()) {
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
  state.addMenuOpen = true
  state.addMenuExpanded = false
  state.addMenuX = clientX
  state.addMenuY = clientY
  state.addTitle = ''
  state.addUrl = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function closeBookmarkMenu({ animate = true } = {}): void {
  state.activeMenuBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  state.pendingCustomIconDataUrl = ''
  state.pendingDeleteBookmarkId = ''
  const menu = document.querySelector<HTMLElement>('.bookmark-edit-menu')
  if (menu) {
    if (animate) {
      void closeWithExitMotion(menu, 'is-closing', () => menu.remove(), 180)
    } else {
      cancelExitMotion(menu)
      menu.remove()
    }
  }
}

function closeAddBookmarkMenu({ animate = true } = {}): void {
  state.addMenuOpen = false
  state.addMenuExpanded = false
  state.addMenuBusy = false
  state.addMenuError = ''
  const menu = document.querySelector<HTMLElement>('.bookmark-add-menu')
  if (menu) {
    if (animate) {
      void closeWithExitMotion(menu, 'is-closing', () => menu.remove(), 180)
    } else {
      cancelExitMotion(menu)
      menu.remove()
    }
  }
}

function handleBookmarkPointerDown(event: PointerEvent): void {
  if (state.draggingFolderId || state.folderDragLongPressTimer) {
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
  document.body.classList.add('bookmark-dragging')
  const sourceTile = getActiveDragTile()
  createBookmarkDragGhost(sourceTile)
  sourceTile?.classList.add('dragging')
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
  if (insertIndex < 0) {
    return
  }

  if (moveDraggedBookmarkInState(insertIndex)) {
    renderWithBookmarkFlip()
    updateBookmarkDragGhost({ immediate: true })
  }
}

async function finishBookmarkDrag(event: PointerEvent): Promise<void> {
  if (!state.draggingBookmarkId || event.pointerId !== state.dragPointerId) {
    return
  }

  window.clearTimeout(state.dragLongPressTimer)
  state.dragLongPressTimer = 0

  const wasDragging = Boolean(state.dragOriginalOrderIds.length)
  const folderId = state.draggingBookmarkFolderId
  const finalOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  const originalOrderIds = [...state.dragOriginalOrderIds]
  clearBookmarkDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  await persistBookmarkOrder(folderId, finalOrderIds)
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
  removeBookmarkDragGhost()
  document.body.classList.remove('bookmark-dragging')

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
  const iconRect = sourceTile.querySelector('.bookmark-icon-shell')?.getBoundingClientRect()
  state.dragOffsetX = iconRect
    ? iconRect.left + iconRect.width / 2 - rect.left
    : rect.width / 2
  state.dragOffsetY = iconRect
    ? iconRect.top + iconRect.height / 2 - rect.top
    : rect.height / 2

  const ghost = sourceTile.cloneNode(true) as HTMLElement
  ghost.classList.remove('dragging')
  ghost.classList.add('bookmark-drag-ghost')
  ghost.removeAttribute('href')
  ghost.removeAttribute('data-bookmark-id')
  ghost.removeAttribute('data-folder-id')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  bookmarkDragGhost = ghost
  document.body.appendChild(ghost)
  updateBookmarkDragGhost({ immediate: true })
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
  state.bookmarks = getAllSectionBookmarks()
}

function getBookmarkTileRects(): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>()
  for (const tile of document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]')) {
    const bookmarkId = String(tile.dataset.bookmarkId || '')
    if (bookmarkId) {
      rects.set(bookmarkId, tile.getBoundingClientRect())
    }
  }
  return rects
}

function renderWithBookmarkFlip(): void {
  const previousRects = getBookmarkTileRects()
  render()
  updateClockText()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  for (const tile of document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]')) {
    const bookmarkId = String(tile.dataset.bookmarkId || '')
    if (!bookmarkId || bookmarkId === state.draggingBookmarkId) {
      continue
    }

    const previousRect = previousRects.get(bookmarkId)
    if (!previousRect) {
      continue
    }

    const currentRect = tile.getBoundingClientRect()
    const deltaX = previousRect.left - currentRect.left
    const deltaY = previousRect.top - currentRect.top
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
      continue
    }

    tile.animate(
      [
        { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ],
      {
        duration: 180,
        easing: 'cubic-bezier(0.22, 0.72, 0.18, 1)'
      }
    )
  }
}

function getBookmarkInsertIndex(clientX: number, clientY: number): number {
  const folderId = state.draggingBookmarkFolderId
  if (!folderId) {
    return -1
  }

  const tiles = Array.from(document.querySelectorAll<HTMLElement>(
    `.bookmark-tile[data-bookmark-id][data-folder-id="${CSS.escape(folderId)}"]`
  ))
  if (!tiles.length) {
    return -1
  }

  let closestTile: HTMLElement | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const tile of tiles) {
    const rect = tile.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distance = (clientX - centerX) ** 2 + (clientY - centerY) ** 2
    if (distance < closestDistance) {
      closestDistance = distance
      closestTile = tile
    }
  }

  if (!closestTile) {
    return -1
  }

  const bookmarkId = String(closestTile.dataset.bookmarkId || '')
  const targetIndex = getActiveBookmarkFolderBookmarks()
    .findIndex((bookmark) => String(bookmark.id) === bookmarkId)
  if (targetIndex < 0) {
    return -1
  }

  const rect = closestTile.getBoundingClientRect()
  const insertAfter =
    clientY > rect.top + rect.height / 2 ||
    clientX > rect.left + rect.width / 2
  return targetIndex + (insertAfter ? 1 : 0)
}

function moveDraggedBookmarkInState(insertIndex: number): boolean {
  const currentBookmarks = getActiveBookmarkFolderBookmarks()
  const currentIndex = currentBookmarks.findIndex(
    (bookmark) => String(bookmark.id) === state.draggingBookmarkId
  )
  if (currentIndex < 0) {
    return false
  }

  const nextBookmarks = [...currentBookmarks]
  const [draggedBookmark] = nextBookmarks.splice(currentIndex, 1)
  const normalizedIndex = Math.max(
    0,
    Math.min(
      currentIndex < insertIndex ? insertIndex - 1 : insertIndex,
      nextBookmarks.length
    )
  )

  if (currentIndex === normalizedIndex) {
    return false
  }

  nextBookmarks.splice(normalizedIndex, 0, draggedBookmark)
  setActiveBookmarkFolderBookmarks(nextBookmarks)
  return true
}

async function persistBookmarkOrder(folderId: string, bookmarkIds: string[]): Promise<void> {
  if (!folderId) {
    return
  }

  state.reorderingBookmarks = true
  try {
    for (let index = 0; index < bookmarkIds.length; index += 1) {
      await moveBookmark(bookmarkIds[index], String(folderId), index)
    }
    await refreshNewTab()
  } catch (error) {
    state.error = error instanceof Error ? error.message : '书签排序保存失败，请刷新后重试。'
    await refreshNewTab()
  } finally {
    state.reorderingBookmarks = false
  }
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
  state.folderDragLongPressTimer = 0
  state.folderDragOriginalOrderIds = state.folderSections.map((section) => section.id)
  state.folderDragSuppressClick = true
  document.body.classList.add('folder-order-dragging')
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
  await saveFolderSettings()
  syncFolderSettingsControls()
}

function cancelFolderDrag({ keepSuppressClick = false } = {}): void {
  if (!state.draggingFolderId && !state.folderDragLongPressTimer) {
    return
  }

  window.clearTimeout(state.folderDragLongPressTimer)
  clearFolderDragState({ keepSuppressClick })
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
  removeFolderDragGhost()
  document.body.classList.remove('folder-order-dragging')

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
  document.body.appendChild(ghost)
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

function getFolderSectionRects(): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>()
  for (const section of document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]')) {
    const folderId = String(section.dataset.folderSectionId || '')
    if (folderId) {
      rects.set(folderId, section.getBoundingClientRect())
    }
  }
  return rects
}

function renderWithFolderFlip(): void {
  const previousRects = getFolderSectionRects()
  render()
  updateClockText()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  for (const section of document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]')) {
    const folderId = String(section.dataset.folderSectionId || '')
    if (!folderId || folderId === state.draggingFolderId) {
      continue
    }

    const previousRect = previousRects.get(folderId)
    if (!previousRect) {
      continue
    }

    const currentRect = section.getBoundingClientRect()
    const deltaY = previousRect.top - currentRect.top
    if (Math.abs(deltaY) < 0.5) {
      continue
    }

    section.animate(
      [
        { transform: `translate3d(0, ${deltaY}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ],
      {
        duration: 180,
        easing: 'cubic-bezier(0.22, 0.72, 0.18, 1)'
      }
    )
  }
}

function getFolderInsertIndex(clientY: number): number {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]'))
  if (!sections.length) {
    return -1
  }

  let closestSection: HTMLElement | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const section of sections) {
    const rect = section.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    const distance = Math.abs(clientY - centerY)
    if (distance < closestDistance) {
      closestDistance = distance
      closestSection = section
    }
  }

  if (!closestSection) {
    return -1
  }

  const folderId = String(closestSection.dataset.folderSectionId || '')
  const targetIndex = state.folderSections.findIndex((section) => section.id === folderId)
  if (targetIndex < 0) {
    return -1
  }

  const rect = closestSection.getBoundingClientRect()
  return targetIndex + (clientY > rect.top + rect.height / 2 ? 1 : 0)
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
  state.folderNode = state.folderSections[0]?.node || null
  state.bookmarks = getAllSectionBookmarks()
  return true
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function handleBookmarksChanged(): void {
  if (state.reorderingBookmarks) {
    return
  }

  void refreshNewTab()
}

function isActiveMenuBookmarkPinned(): boolean {
  const bookmark = getActiveMenuBookmark()
  return Boolean(bookmark && state.activity.pinnedIds.includes(String(bookmark.id)))
}

async function toggleActiveMenuBookmarkPin(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id)
  const pinned = state.activity.pinnedIds.includes(bookmarkId)
  state.activity = {
    ...state.activity,
    pinnedIds: pinned
      ? state.activity.pinnedIds.filter((id) => id !== bookmarkId)
      : [bookmarkId, ...state.activity.pinnedIds.filter((id) => id !== bookmarkId)]
  }

  try {
    state.pendingDeleteBookmarkId = ''
    await saveNewTabActivity()
    state.menuError = ''
    state.menuStatus = pinned ? '已取消固定' : '已固定到常用'
    render()
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
    const title = state.editTitle.trim() || state.editUrl.trim()
    const url = normalizeBookmarkInputUrl(state.editUrl)
    state.pendingDeleteBookmarkId = ''
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu()

    await updateBookmark(bookmark.id, { title, url })
    await persistCustomIconChoice(bookmark.id)
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

    await removeBookmark(bookmark.id)
    await appendRecycleEntry({
      recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      bookmarkId: String(bookmark.id),
      title: bookmark.title || '未命名书签',
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: getBookmarkFolderPath(bookmark) || DEFAULT_NEW_TAB_FOLDER_TITLE,
      source: '新标签页删除',
      deletedAt: Date.now()
    })
    if (state.customIcons[bookmark.id]) {
      const nextIcons = { ...state.customIcons }
      delete nextIcons[bookmark.id]
      await saveCustomIcons(nextIcons)
    }
    await removeBookmarkFromActivity(bookmark.id).catch((error) => {
      console.warn('新标签页打开记录清理失败。', error)
    })

    state.pendingDeleteBookmarkId = ''
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

function getBookmarkDisplayTitle(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  return String(bookmark.title || '').trim() || String(bookmark.url || '').trim() || '未命名书签'
}

function refreshActiveMenuIcon(): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  state.pendingDeleteBookmarkId = ''
  state.faviconRefreshTokens.set(bookmark.id, Date.now())
  render()
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

    const folderId = await ensureNewTabFolder()
    await createBookmark({
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
  state.loading = true
  state.error = ''
  render()

  try {
    const [tree, stored] = await Promise.all([
      getBookmarkTree(),
      getLocalStorage([
        STORAGE_KEYS.newTabCustomIcons,
        STORAGE_KEYS.newTabBackgroundSettings,
        STORAGE_KEYS.newTabSearchSettings,
        STORAGE_KEYS.newTabIconSettings,
        STORAGE_KEYS.newTabGeneralSettings,
        STORAGE_KEYS.newTabFolderSettings,
        STORAGE_KEYS.newTabTimeSettings,
        NEW_TAB_ACTIVITY_STORAGE_KEY
      ])
    ])
    const rootNode = tree[0] || null
    const folderSettings = normalizeFolderSettingsWithDefault(
      stored[STORAGE_KEYS.newTabFolderSettings],
      rootNode
    )
    const folderSections = buildNewTabFolderSections(rootNode, folderSettings)

    state.rootNode = rootNode
    state.folderSettings = folderSettings
    state.folderSections = folderSections
    state.folderNode = folderSections[0]?.node || null
    state.bookmarks = getAllSectionBookmarks()
    state.customIcons = normalizeCustomIcons(stored[STORAGE_KEYS.newTabCustomIcons])
    state.activity = normalizeNewTabActivity(stored[NEW_TAB_ACTIVITY_STORAGE_KEY], state.bookmarks)
    state.backgroundSettings = normalizeBackgroundSettings(stored[STORAGE_KEYS.newTabBackgroundSettings])
    state.searchSettings = normalizeSearchSettings(stored[STORAGE_KEYS.newTabSearchSettings])
    state.iconSettings = normalizeIconSettings(stored[STORAGE_KEYS.newTabIconSettings])
    state.generalSettings = normalizeGeneralSettings(stored[STORAGE_KEYS.newTabGeneralSettings])
    state.timeSettings = normalizeTimeSettings(stored[STORAGE_KEYS.newTabTimeSettings])
  } catch (error) {
    state.error = error instanceof Error ? error.message : '新标签页加载失败，请刷新后重试。'
  } finally {
    state.loading = false
    render()
    syncBackgroundSettingsControls()
    void applyBackgroundSettings()
    syncSearchSettingsControls()
    syncIconSettingsControls()
    syncGeneralSettingsControls()
    applyGeneralSettings()
    syncFolderSettingsControls()
    applyFolderSettings()
    syncTimeSettingsControls()
    updateAllSettingRangeVisuals()
    updateClockText()
    scheduleClockTick()
  }
}

async function preloadBackgroundSettings(): Promise<void> {
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabBackgroundSettings])
    state.backgroundSettings = normalizeBackgroundSettings(stored[STORAGE_KEYS.newTabBackgroundSettings])
    syncBackgroundSettingsControls()
    await applyBackgroundSettings()
  } catch (error) {
    console.warn('新标签页背景预加载失败。', error)
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
    const createdFolder = await createBookmark({
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
    state.folderNode = state.folderSections[0]?.node || existingFolder
    state.bookmarks = getAllSectionBookmarks()
    await saveFolderSettings()
    return String(existingFolder.id)
  }

  const bookmarksBar = findBookmarksBar(rootNode)
  const createdFolder = await createBookmark({
    parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
    title: DEFAULT_NEW_TAB_FOLDER_TITLE
  })
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: [String(createdFolder.id)]
  })
  state.folderSections = buildNewTabFolderSections(rootNode, state.folderSettings)
  state.folderNode = state.folderSections[0]?.node || createdFolder
  state.bookmarks = getAllSectionBookmarks()
  await saveFolderSettings()
  return String(createdFolder.id)
}

function render(): void {
  if (!root) {
    return
  }

  root.replaceChildren()
  const contentState = resolveNewTabContentState({
    loading: state.loading,
    error: state.error,
    selectedFolderCount: state.folderSettings.selectedFolderIds.length,
    visibleFolderCount: state.folderSections.length
  })

  if (contentState.type === 'loading') {
    root.appendChild(createStateView('正在加载'))
    return
  }

  if (contentState.type === 'error') {
    root.appendChild(createStateView(contentState.message, '重新加载', () => {
      void refreshNewTab()
    }))
    return
  }

  if (contentState.type === 'missing-folder') {
    root.appendChild(createNewTabLayout(createMissingFolderView({
      creatingFolder: state.creatingFolder,
      reason: contentState.reason,
      onCreateFolder: () => {
        void createNewTabFolder()
      },
      onOpenFolderSettings: openFolderSourceSettings
    })))
    return
  }

  root.appendChild(createNewTabLayout(createBookmarkSections(state.folderSections)))
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

function createNewTabLayout(primaryContent: HTMLElement): HTMLElement {
  const modules: NewTabPageModule[] = []

  const clock = createClockWidget()
  if (clock) {
    modules.push({
      id: 'clock',
      element: clock,
      placement: 'utility'
    })
  } else {
    const spacer = document.createElement('div')
    spacer.className = 'newtab-clock-spacer'
    modules.push({
      id: 'clock-spacer',
      element: spacer,
      placement: 'utility'
    })
  }

  const search = createSearchWidget()
  if (search) {
    modules.push({
      id: 'search',
      element: search,
      placement: 'utility'
    })
  }

  modules.push({
    id: primaryContent.classList.contains('newtab-content') ? 'bookmarks' : 'state',
    element: primaryContent,
    placement: 'primary'
  })

  return createNewTabPage({ modules })
}

function createSearchWidget(): HTMLElement | null {
  const settings = state.searchSettings
  if (!settings.enabled) {
    return null
  }

  const slot = document.createElement('section')
  slot.className = 'newtab-search-slot'
  slot.style.setProperty('--search-width', `${settings.width}vw`)
  slot.style.setProperty('--search-height', `${settings.height}px`)
  slot.style.setProperty('--search-offset-y', `${settings.offsetY}px`)
  slot.setAttribute('aria-label', '搜索网页或书签')

  const form = document.createElement('form')
  form.className = 'newtab-search'
  form.style.setProperty('--search-width', `${settings.width}vw`)
  form.style.setProperty('--search-height', `${settings.height}px`)
  form.style.setProperty('--search-bg-alpha', String(settings.background / 100))
  form.setAttribute('role', 'search')
  form.setAttribute('aria-label', '搜索网页或书签')

  const input = document.createElement('input')
  const searchPlaceholder = getSearchPlaceholder(settings)
  input.className = 'newtab-search-input'
  input.type = 'search'
  input.autocomplete = 'off'
  input.enterKeyHint = 'search'
  input.placeholder = searchPlaceholder
  input.spellcheck = false
  input.setAttribute('aria-label', '输入关键词搜索书签，或按 Enter 搜索网页')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-controls', 'newtab-search-suggestions')
  input.setAttribute('aria-expanded', 'false')

  const clearButton = document.createElement('button')
  clearButton.className = 'newtab-search-clear hidden'
  clearButton.type = 'button'
  clearButton.setAttribute('aria-label', '清空搜索')
  clearButton.textContent = '×'

  const separator = document.createElement('span')
  separator.className = 'newtab-search-separator hidden'
  separator.setAttribute('aria-hidden', 'true')

  const submitButton = document.createElement('button')
  submitButton.className = 'newtab-search-submit'
  submitButton.type = 'submit'
  submitButton.setAttribute('aria-label', '搜索网页')
  submitButton.title = '搜索网页'
  submitButton.disabled = true

  const icon = document.createElement('span')
  icon.className = 'newtab-search-icon'
  icon.setAttribute('aria-hidden', 'true')
  submitButton.appendChild(icon)

  const suggestionsPanel = document.createElement('div')
  suggestionsPanel.id = 'newtab-search-suggestions-panel'
  suggestionsPanel.className = 'newtab-search-suggestions-panel hidden'

  const suggestions = document.createElement('div')
  suggestions.id = 'newtab-search-suggestions'
  suggestions.className = 'newtab-search-suggestions'
  suggestions.setAttribute('role', 'listbox')
  suggestions.setAttribute('aria-label', '匹配的书签')

  const suggestionsHeading = document.createElement('div')
  suggestionsHeading.className = 'newtab-search-section-label'
  suggestionsHeading.textContent = '书签匹配'

  const searchHint = document.createElement('div')
  searchHint.className = 'newtab-search-hint'
  searchHint.setAttribute('aria-live', 'polite')
  searchHint.textContent = ''
  suggestionsPanel.append(suggestionsHeading, suggestions, searchHint)

  let searchSuggestions: SearchBookmarkSuggestion[] = []
  let activeSuggestionIndex = -1

  const hideSuggestions = () => {
    searchSuggestions = []
    activeSuggestionIndex = -1
    suggestions.replaceChildren()
    searchHint.textContent = ''
    suggestionsPanel.classList.add('hidden')
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
  }

  const renderSuggestions = ({ preserveActive = false } = {}) => {
    const query = input.value.trim()
    const previousActiveIndex = activeSuggestionIndex
    searchSuggestions = getSearchBookmarkSuggestions(input.value)
    if (!searchSuggestions.length) {
      activeSuggestionIndex = -1
      suggestions.replaceChildren()
      input.removeAttribute('aria-activedescendant')
      input.setAttribute('aria-expanded', 'false')
      if (!query) {
        hideSuggestions()
        return
      }

      searchHint.textContent = `没有匹配的书签。按 Enter 使用网页搜索：${query}`
      suggestionsPanel.classList.remove('hidden')
      suggestionsHeading.hidden = true
      input.setAttribute('aria-expanded', 'true')
      return
    }

    activeSuggestionIndex = preserveActive
      ? Math.max(0, Math.min(previousActiveIndex, searchSuggestions.length - 1))
      : 0

    suggestions.replaceChildren(...searchSuggestions.map((suggestion, index) =>
      createSearchSuggestionButton(
        suggestion,
        index,
        index === activeSuggestionIndex,
        (selectedSuggestion) => {
          input.value = selectedSuggestion.title
          syncSearchInputActions(input, clearButton, separator, submitButton)
          hideSuggestions()
          openBookmarkSuggestion(selectedSuggestion)
        }
      )
    ))
    suggestionsPanel.classList.remove('hidden')
    suggestionsHeading.hidden = false
    input.setAttribute('aria-expanded', 'true')
    searchHint.textContent = getSearchEnterHint(searchSuggestions[activeSuggestionIndex])

    if (activeSuggestionIndex >= 0) {
      input.setAttribute('aria-activedescendant', getSearchSuggestionElementId(activeSuggestionIndex))
    } else {
      input.removeAttribute('aria-activedescendant')
    }
  }

  const moveActiveSuggestion = (direction: 1 | -1) => {
    if (!searchSuggestions.length) {
      renderSuggestions({ preserveActive: true })
    }
    if (!searchSuggestions.length) {
      return
    }

    activeSuggestionIndex = activeSuggestionIndex < 0
      ? (direction > 0 ? 0 : searchSuggestions.length - 1)
      : (activeSuggestionIndex + direction + searchSuggestions.length) % searchSuggestions.length
    renderSuggestions({ preserveActive: true })
  }

  input.addEventListener('input', () => {
    syncSearchInputActions(input, clearButton, separator, submitButton)
    renderSuggestions()
  })
  input.addEventListener('focus', () => {
    renderSuggestions()
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1)
      return
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      const suggestion = searchSuggestions[activeSuggestionIndex]
      if (suggestion) {
        event.preventDefault()
        input.value = suggestion.title
        syncSearchInputActions(input, clearButton, separator, submitButton)
        hideSuggestions()
        openBookmarkSuggestion(suggestion)
      }
      return
    }

    if (event.key !== 'Escape') {
      return
    }

    event.preventDefault()
    if (searchSuggestions.length) {
      hideSuggestions()
      return
    }

    if (input.value) {
      input.value = ''
      syncSearchInputActions(input, clearButton, separator, submitButton)
      return
    }

    input.blur()
  })
  clearButton.addEventListener('click', () => {
    input.value = ''
    syncSearchInputActions(input, clearButton, separator, submitButton)
    hideSuggestions()
    input.focus()
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    hideSuggestions()
    submitSearch(input.value)
  })
  slot.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!slot.contains(document.activeElement)) {
        hideSuggestions()
      }
    }, 0)
  })

  form.append(input, clearButton, separator, submitButton)
  syncSearchInputActions(input, clearButton, separator, submitButton)
  slot.append(form, suggestionsPanel)
  return slot
}

function syncSearchInputActions(
  input: HTMLInputElement,
  clearButton: HTMLButtonElement,
  separator: HTMLElement,
  submitButton: HTMLButtonElement
): void {
  const hasValue = Boolean(input.value.trim())
  clearButton.classList.toggle('hidden', !input.value)
  separator.classList.toggle('hidden', !input.value)
  submitButton.disabled = !hasValue
  submitButton.setAttribute('aria-disabled', String(!hasValue))
}

function getSearchBookmarkSuggestions(query: string): SearchBookmarkSuggestion[] {
  const normalizedQuery = normalizeBookmarkSuggestionText(query)
  if (!normalizedQuery) {
    return []
  }

  const suggestions: SearchBookmarkSuggestion[] = []
  let order = 0
  for (const section of state.folderSections) {
    for (const bookmark of section.bookmarks) {
      const url = String(bookmark.url || '').trim()
      if (!url) {
        continue
      }

      const title = String(bookmark.title || '').trim() || url
      const score = getSearchSuggestionScore(
        normalizedQuery,
        normalizeBookmarkSuggestionText(title),
        normalizeBookmarkSuggestionText(url),
        normalizeBookmarkSuggestionText(section.title)
      )
      if (score < 0) {
        order += 1
        continue
      }

      suggestions.push({
        id: String(bookmark.id),
        title,
        url,
        folderTitle: section.title || '未命名文件夹',
        folderPath: section.path || section.title || '',
        score,
        order
      })
      order += 1
    }
  }

  return suggestions
    .sort((left, right) => left.score - right.score || left.order - right.order)
    .slice(0, SEARCH_SUGGESTION_LIMIT)
}

function getSearchEnterHint(suggestion: SearchBookmarkSuggestion | undefined): string {
  if (!suggestion) {
    return 'Enter 搜索网页'
  }

  return `Enter 打开「${suggestion.title}」；搜索图标搜索网页`
}

function getSearchSuggestionScore(
  query: string,
  title: string,
  url: string,
  folderTitle: string
): number {
  if (title === query) {
    return 0
  }
  if (title.startsWith(query)) {
    return 1
  }
  if (title.includes(query)) {
    return 2
  }
  if (url.includes(query)) {
    return 3
  }
  if (folderTitle.includes(query)) {
    return 4
  }
  return -1
}

function normalizeBookmarkSuggestionText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function createSearchSuggestionButton(
  suggestion: SearchBookmarkSuggestion,
  index: number,
  active: boolean,
  onSelect: (suggestion: SearchBookmarkSuggestion) => void
): HTMLButtonElement {
  const button = document.createElement('button')
  button.id = getSearchSuggestionElementId(index)
  button.className = `newtab-search-suggestion${active ? ' active' : ''}`
  button.type = 'button'
  button.setAttribute('role', 'option')
  button.setAttribute('aria-selected', String(active))
  button.setAttribute('aria-label', `打开书签：${suggestion.title}`)
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
  })
  button.addEventListener('click', () => {
    onSelect(suggestion)
  })

  const mark = document.createElement('span')
  mark.className = 'newtab-search-suggestion-mark'
  mark.setAttribute('aria-hidden', 'true')
  mark.textContent = getFallbackLabel(suggestion.title)

  const copy = document.createElement('span')
  copy.className = 'newtab-search-suggestion-copy'

  const title = document.createElement('strong')
  title.textContent = suggestion.title

  const meta = document.createElement('span')
  const source = suggestion.folderPath || suggestion.folderTitle
  meta.textContent = source
    ? `${source} · ${formatSearchSuggestionUrl(suggestion.url)}`
    : formatSearchSuggestionUrl(suggestion.url)

  copy.append(title, meta)
  button.append(mark, copy)
  return button
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

function openBookmarkSuggestion(suggestion: SearchBookmarkSuggestion): void {
  const bookmark = getBookmarkById(suggestion.id)
  if (!bookmark) {
    openSearchTarget(suggestion.url)
    return
  }

  void recordBookmarkOpen(bookmark).finally(() => {
    openSearchTarget(suggestion.url)
  })
}

function createClockWidget(): HTMLElement | null {
  const settings = state.timeSettings
  if (!settings.enabled || settings.displayMode === 'none') {
    return null
  }

  const clock = document.createElement('section')
  clock.className = 'newtab-clock'
  clock.style.setProperty('--clock-scale', String(settings.clockSize / 100))
  const now = new Date()
  clock.dataset.clockDisplayMode = settings.displayMode
  clock.dataset.clockShowSeconds = String(settings.showSeconds && settings.displayMode !== 'date')
  clock.dataset.clockHour12 = String(settings.hour12 && settings.displayMode !== 'date')
  clock.setAttribute('aria-label', getClockAriaLabel(now))

  if (settings.displayMode !== 'date') {
    const timeGroup = document.createElement('span')
    timeGroup.className = 'newtab-clock-time-group'

    const time = document.createElement('time')
    time.className = 'newtab-clock-time'
    time.dataset.clockTime = 'true'
    time.dateTime = formatClockTimeDateTime(now)
    time.textContent = formatClockTime(now)
    timeGroup.appendChild(time)

    if (settings.hour12) {
      const period = document.createElement('span')
      period.className = 'newtab-clock-period'
      period.dataset.clockPeriod = 'true'
      period.textContent = formatClockPeriod(now)
      timeGroup.appendChild(period)
    }

    clock.appendChild(timeGroup)
  }

  if (settings.displayMode !== 'time') {
    const date = document.createElement('time')
    date.className = 'newtab-clock-date'
    date.dataset.clockDate = 'true'
    date.dateTime = formatClockDateTime(now)
    date.textContent = formatClockDate(now)
    clock.appendChild(date)
  }

  const zone = document.createElement('span')
  zone.className = 'newtab-clock-zone'
  zone.dataset.clockZone = 'true'
  zone.textContent = getClockZoneLabel()
  clock.appendChild(zone)

  return clock
}

function createBookmarkSections(sections: NewTabFolderSection[]): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-content'
  const gridSettings = {
    ...state.iconSettings,
    columns: getResponsiveIconColumns(state.iconSettings)
  }
  view.style.setProperty('--icon-page-width', `${getIconPageWidthPx(state.iconSettings.pageWidth)}px`)
  view.style.setProperty('--icon-column-gap', `${getIconGapPx(state.iconSettings.columnGap)}px`)
  view.style.setProperty('--icon-row-gap', `${getIconRowGapPx(state.iconSettings.rowGap)}px`)
  view.style.setProperty('--icon-folder-gap', `${getFolderGapPx(state.iconSettings.folderGap)}px`)
  view.style.setProperty('--icon-tile-width', `${state.iconSettings.tileWidth}px`)
  view.style.setProperty('--icon-shell-size', `${state.iconSettings.iconShellSize}px`)
  view.style.setProperty('--icon-fixed-grid-width', `${getFixedIconGridWidthPx(gridSettings)}px`)
  view.style.setProperty('--icon-columns', String(gridSettings.columns))
  view.style.setProperty('--icon-title-lines', String(state.iconSettings.titleLines))
  view.dataset.iconLayoutMode = state.iconSettings.layoutMode
  view.dataset.iconShowTitles = String(state.iconSettings.showTitles)
  view.dataset.iconVerticalCenter = String(state.iconSettings.verticalCenter)

  const quickAccess = createQuickAccessPanel()
  if (quickAccess) {
    view.appendChild(quickAccess)
  }

  const groupList = document.createElement('div')
  groupList.className = 'bookmark-folder-sections'
  let renderedBookmarkIndex = 0

  for (const section of sections) {
    const sectionNode = document.createElement('section')
    sectionNode.className = 'bookmark-folder-section'
    sectionNode.dataset.folderSectionId = section.id
    if (section.id === state.draggingFolderId && state.folderDragOriginalOrderIds.length) {
      sectionNode.classList.add('dragging-folder')
    }

    const header = document.createElement('button')
    header.className = 'folder-section-header'
    header.type = 'button'
    header.dataset.folderDragHandle = section.id
    header.title = section.path || section.title
    header.setAttribute('aria-label', `${section.title}，长按拖拽调整文件夹顺序`)
    if (section.id === state.draggingFolderId && state.folderDragOriginalOrderIds.length) {
      header.classList.add('dragging')
    }

    const title = document.createElement('span')
    title.className = 'folder-section-title'
    title.textContent = section.title || '未命名文件夹'

    const count = document.createElement('span')
    count.className = 'folder-section-count'
    count.textContent = String(section.bookmarks.length)

    header.append(title, count)
    sectionNode.appendChild(header)

    if (section.bookmarks.length) {
      const list = document.createElement('nav')
      list.className = 'bookmark-grid'
      list.setAttribute('aria-label', `${section.title || '文件夹'}书签`)

      for (const bookmark of section.bookmarks) {
        list.appendChild(createBookmarkTile(bookmark, section.id, renderedBookmarkIndex))
        renderedBookmarkIndex += 1
      }

      sectionNode.appendChild(list)
    } else {
      const empty = document.createElement('p')
      empty.className = 'bookmark-folder-empty'
      empty.textContent = '此文件夹还没有书签'
      sectionNode.appendChild(empty)
    }

    groupList.appendChild(sectionNode)
  }

  view.appendChild(groupList)
  return view
}

function createQuickAccessPanel(): HTMLElement | null {
  const showFrequent = state.generalSettings.showFrequentBookmarks
  const showRecent = state.generalSettings.showRecentBookmarks
  if (!showFrequent && !showRecent) {
    return null
  }

  const frequentItems = showFrequent ? getFrequentQuickAccessItems() : []
  const recentItems = showRecent
    ? getRecentQuickAccessItems(new Set(frequentItems.map((item) => item.id)))
    : []

  if (!frequentItems.length && !recentItems.length) {
    return null
  }

  const panel = document.createElement('section')
  panel.className = 'newtab-quick-access'
  panel.setAttribute('aria-label', '常用和最近书签')

  if (frequentItems.length) {
    panel.appendChild(createQuickAccessGroup('常用', frequentItems))
  }
  if (recentItems.length) {
    panel.appendChild(createQuickAccessGroup('最近', recentItems))
  }

  return panel
}

function createQuickAccessGroup(label: string, items: QuickAccessItem[]): HTMLElement {
  const group = document.createElement('section')
  group.className = 'newtab-quick-group'
  group.setAttribute('aria-label', `${label}书签`)

  const header = document.createElement('div')
  header.className = 'newtab-quick-heading'
  header.textContent = label

  const list = document.createElement('div')
  list.className = 'newtab-quick-list'

  for (const item of items) {
    list.appendChild(createQuickAccessLink(item))
  }

  group.append(header, list)
  return group
}

function createQuickAccessLink(item: QuickAccessItem): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'newtab-quick-link'
  link.href = item.url
  link.title = `${item.title} · ${item.detail}`
  link.draggable = false
  link.dataset.bookmarkId = item.id
  bindBookmarkNavigation(link, item.bookmark)

  const mark = document.createElement('span')
  mark.className = 'newtab-quick-mark'
  mark.textContent = item.badge
  mark.setAttribute('aria-hidden', 'true')

  const copy = document.createElement('span')
  copy.className = 'newtab-quick-copy'

  const title = document.createElement('strong')
  title.textContent = item.title

  const detail = document.createElement('span')
  detail.textContent = item.detail

  copy.append(title, detail)
  link.append(mark, copy)
  return link
}

function getFrequentQuickAccessItems(): QuickAccessItem[] {
  const bookmarkMap = getBookmarkNodeMap()
  const items: QuickAccessItem[] = []
  const usedIds = new Set<string>()

  for (const bookmarkId of state.activity.pinnedIds) {
    const bookmark = bookmarkMap.get(bookmarkId)
    if (!bookmark?.url || usedIds.has(bookmarkId)) {
      continue
    }

    items.push(createQuickAccessItem(bookmark, '已固定', '固'))
    usedIds.add(bookmarkId)
    if (items.length >= QUICK_ACCESS_ITEM_LIMIT) {
      return items
    }
  }

  const frequentRecords = Object.values(state.activity.records)
    .filter((record) => record.openCount > 0 && !usedIds.has(record.bookmarkId))
    .sort((left, right) =>
      right.openCount - left.openCount ||
      right.lastOpenedAt - left.lastOpenedAt ||
      left.title.localeCompare(right.title, 'zh-Hans-CN')
    )

  for (const record of frequentRecords) {
    const bookmark = bookmarkMap.get(record.bookmarkId)
    if (!bookmark?.url) {
      continue
    }

    items.push(createQuickAccessItem(bookmark, `打开 ${record.openCount} 次`, '常'))
    usedIds.add(record.bookmarkId)
    if (items.length >= QUICK_ACCESS_ITEM_LIMIT) {
      break
    }
  }

  return items
}

function getRecentQuickAccessItems(excludedIds: Set<string>): QuickAccessItem[] {
  const bookmarkMap = getBookmarkNodeMap()
  const items: QuickAccessItem[] = []
  const usedIds = new Set(excludedIds)

  const recentlyOpened = Object.values(state.activity.records)
    .filter((record) => record.lastOpenedAt > 0 && !usedIds.has(record.bookmarkId))
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)

  for (const record of recentlyOpened) {
    const bookmark = bookmarkMap.get(record.bookmarkId)
    if (!bookmark?.url) {
      continue
    }

    items.push(createQuickAccessItem(bookmark, formatRelativeActivityTime(record.lastOpenedAt, '打开'), '开'))
    usedIds.add(record.bookmarkId)
    if (items.length >= QUICK_ACCESS_ITEM_LIMIT) {
      return items
    }
  }

  const recentlyAdded = state.bookmarks
    .filter((bookmark) => Number.isFinite(Number(bookmark.dateAdded)) && !usedIds.has(String(bookmark.id)))
    .sort((left, right) => Number(right.dateAdded || 0) - Number(left.dateAdded || 0))

  for (const bookmark of recentlyAdded) {
    if (!bookmark.url) {
      continue
    }

    items.push(createQuickAccessItem(bookmark, formatRelativeActivityTime(Number(bookmark.dateAdded), '添加'), '新'))
    usedIds.add(String(bookmark.id))
    if (items.length >= QUICK_ACCESS_ITEM_LIMIT) {
      break
    }
  }

  return items
}

function createQuickAccessItem(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  detail: string,
  badge: string
): QuickAccessItem {
  const url = String(bookmark.url || '').trim()
  const title = String(bookmark.title || '').trim() || url
  return {
    id: String(bookmark.id),
    title,
    url,
    detail,
    badge,
    bookmark
  }
}

function getBookmarkNodeMap(): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  return new Map(state.bookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
}

function formatRelativeActivityTime(timestamp: number, label: string): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return `${label}时间未知`
  }

  const diffMs = Date.now() - timestamp
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < hourMs) {
    return `${label}于刚刚`
  }
  if (diffMs < dayMs) {
    return `${label}于 ${Math.max(1, Math.floor(diffMs / hourMs))} 小时前`
  }
  if (diffMs < 30 * dayMs) {
    return `${label}于 ${Math.max(1, Math.floor(diffMs / dayMs))} 天前`
  }

  const date = new Date(timestamp)
  return `${label}于 ${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function getResponsiveIconColumns(settings: IconSettings): number {
  if (settings.layoutMode !== 'fixed') {
    return settings.columns
  }

  const viewportWidth = Math.max(
    320,
    document.documentElement.clientWidth || window.innerWidth || 1280
  )
  const horizontalShellPadding = Math.max(48, Math.min(viewportWidth * 0.1, 144))
  const availablePageWidth = Math.max(
    settings.tileWidth,
    Math.min(getIconPageWidthPx(settings.pageWidth), 1280, viewportWidth - horizontalShellPadding)
  )
  const gap = getIconGapPx(settings.columnGap)
  const maxColumns = Math.max(
    1,
    Math.floor((availablePageWidth + gap) / (settings.tileWidth + gap))
  )

  return Math.max(1, Math.min(settings.columns, maxColumns))
}

function createBookmarkTile(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  folderId: string,
  renderIndex = 0
): HTMLAnchorElement {
  const url = String(bookmark.url || '')
  const title = String(bookmark.title || '').trim() || url
  const item = document.createElement('a')
  item.className = 'bookmark-tile'
  item.href = url
  item.title = title
  item.draggable = false
  item.dataset.bookmarkId = String(bookmark.id)
  item.dataset.folderId = folderId
  bindBookmarkNavigation(item, bookmark)
  if (String(bookmark.id) === state.draggingBookmarkId && state.dragOriginalOrderIds.length) {
    item.classList.add('dragging')
  }

  const iconShell = document.createElement('span')
  iconShell.className = 'bookmark-icon-shell'
  iconShell.setAttribute('aria-hidden', 'true')

  const icon = document.createElement('img')
  const customIcon = state.customIcons[String(bookmark.id)]
  icon.className = 'bookmark-favicon'
  if (customIcon) {
    icon.classList.add('custom-icon')
  }
  icon.src = customIcon || getFaviconUrl(url, String(bookmark.id))
  icon.alt = ''
  icon.draggable = false
  icon.loading = renderIndex < EAGER_FAVICON_LIMIT ? 'eager' : 'lazy'
  icon.decoding = 'async'
  icon.setAttribute(
    'fetchpriority',
    renderIndex < HIGH_PRIORITY_FAVICON_LIMIT ? 'high' : 'low'
  )
  icon.addEventListener('error', () => {
    iconShell.classList.add('favicon-missing')
  })

  const fallback = document.createElement('span')
  fallback.className = 'bookmark-fallback'
  fallback.textContent = getFallbackLabel(title)

  const label = document.createElement('span')
  label.className = 'bookmark-title'
  label.textContent = title

  iconShell.append(icon, fallback)
  item.append(iconShell, label)
  return item
}

function bindBookmarkNavigation(
  link: HTMLAnchorElement,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  const url = String(bookmark.url || '').trim()
  if (!url) {
    return
  }

  link.addEventListener('click', (event) => {
    if (
      state.dragSuppressClick ||
      state.folderDragSuppressClick ||
      state.draggingBookmarkId ||
      state.draggingFolderId
    ) {
      return
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      void recordBookmarkOpen(bookmark)
      return
    }

    event.preventDefault()
    void recordBookmarkOpen(bookmark).finally(() => {
      window.location.assign(url)
    })
  })
}

function findNewTabFolder(
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

function buildNewTabFolderSections(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null,
  settings: NewTabFolderSettings
): NewTabFolderSection[] {
  if (!rootNode) {
    return []
  }

  const folderData = extractBookmarkData(rootNode)
  const selectedIds = normalizeFolderIds(settings.selectedFolderIds)
  const sections: NewTabFolderSection[] = []

  for (const folderId of selectedIds) {
    const node = findNodeById(rootNode, folderId)
    if (!node || node.url) {
      continue
    }

    const folder = folderData.folderMap.get(folderId)
    sections.push(createFolderSection(node, folder))
  }

  return sections
}

function createFolderSection(
  node: chrome.bookmarks.BookmarkTreeNode,
  folder?: FolderRecord
): NewTabFolderSection {
  const title = String(folder?.title || node.title || '未命名文件夹').trim() || '未命名文件夹'
  return {
    id: String(node.id),
    title,
    path: String(folder?.path || title),
    node,
    bookmarks: getDirectBookmarks(node)
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

function getBookmarkById(bookmarkId: string): chrome.bookmarks.BookmarkTreeNode | null {
  return state.bookmarks.find((bookmark) => String(bookmark.id) === String(bookmarkId)) || null
}

function getBookmarkFolderPath(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const parentId = String(bookmark.parentId || '')
  return state.folderSections.find((section) => section.id === parentId)?.path || ''
}

async function recordBookmarkOpen(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
  const bookmarkId = String(bookmark.id || '').trim()
  const url = String(bookmark.url || '').trim()
  if (!bookmarkId || !url) {
    return
  }

  const now = Date.now()
  const previousRecord = state.activity.records[bookmarkId]
  state.activity = normalizeNewTabActivity({
    ...state.activity,
    records: {
      ...state.activity.records,
      [bookmarkId]: {
        bookmarkId,
        title: String(bookmark.title || '').trim() || url,
        url,
        openCount: Math.min((previousRecord?.openCount || 0) + 1, 9999),
        firstOpenedAt: previousRecord?.firstOpenedAt || now,
        lastOpenedAt: now
      }
    }
  }, state.bookmarks)

  await saveNewTabActivity().catch((error) => {
    console.warn('新标签页打开记录保存失败。', error)
  })
}

async function removeBookmarkFromActivity(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  const records = { ...state.activity.records }
  delete records[normalizedId]
  state.activity = {
    pinnedIds: state.activity.pinnedIds.filter((id) => id !== normalizedId),
    records
  }
  await saveNewTabActivity()
}

async function saveNewTabActivity(): Promise<void> {
  await setLocalStorage({
    [NEW_TAB_ACTIVITY_STORAGE_KEY]: normalizeNewTabActivity(state.activity, state.bookmarks)
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
  const existingMenu = document.querySelector<HTMLElement>('.bookmark-edit-menu')
  if (existingMenu) {
    cancelExitMotion(existingMenu)
    existingMenu.remove()
  }

  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    return
  }

  const menu = document.createElement('section')
  menu.className = 'bookmark-edit-menu'
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-label', '书签设置')
  menu.style.left = `${state.menuX}px`
  menu.style.top = `${state.menuY}px`

  const titleField = createMenuTextField('标题', 'Example', state.editTitle, (value) => {
    state.editTitle = value
  })
  const urlField = createMenuTextField('链接', 'https://example.com/', state.editUrl, (value) => {
    state.editUrl = value
  })

  const iconRow = document.createElement('label')
  iconRow.className = 'bookmark-menu-row'
  const iconLabel = document.createElement('span')
  iconLabel.textContent = '图标'
  const iconSelect = document.createElement('select')
  iconSelect.className = 'bookmark-menu-select'
  iconSelect.disabled = state.menuBusy
  const websiteOption = document.createElement('option')
  websiteOption.value = 'website'
  websiteOption.textContent = '网站图标'
  const customOption = document.createElement('option')
  customOption.value = 'custom'
  customOption.textContent = '自定义图片'
  iconSelect.append(websiteOption, customOption)
  iconSelect.value = state.editIconMode === 'custom' ? 'custom' : 'website'
  iconSelect.addEventListener('change', () => {
    void handleIconModeChange(iconSelect.value)
  })
  iconRow.append(iconLabel, iconSelect)

  const separator = document.createElement('div')
  separator.className = 'bookmark-menu-separator'

  const actionList = document.createElement('div')
  actionList.className = 'bookmark-menu-actions'
  actionList.setAttribute('role', 'menu')
  actionList.setAttribute('aria-label', '书签操作')
  actionList.addEventListener('keydown', handleMenuActionsKeydown)
  actionList.append(
    createMenuAction(
      isActiveMenuBookmarkPinned() ? '取消固定' : '固定到常用',
      'pin',
      toggleActiveMenuBookmarkPin,
      { actionId: 'toggle-pin' }
    ),
    createMenuAction('复制链接', 'copy', copyActiveMenuBookmarkUrl, { actionId: 'copy-url' }),
    createMenuAction(
      state.pendingDeleteBookmarkId === String(bookmark.id) ? '确认删除 1 个' : '删除链接',
      'trash',
      deleteActiveMenuBookmark,
      { actionId: 'delete-bookmark', variant: 'danger' }
    ),
    createMenuAction('刷新图标', 'refresh', refreshActiveMenuIcon, { actionId: 'refresh-icon' }),
    createMenuAction('保存更改', 'save', saveBookmarkMenuChanges, { actionId: 'save-bookmark' })
  )

  menu.append(titleField, urlField, iconRow, separator, actionList)

  if (state.menuError) {
    const error = document.createElement('p')
    error.className = 'bookmark-menu-error'
    error.textContent = state.menuError
    menu.appendChild(error)
  }

  if (state.menuStatus) {
    const status = document.createElement('p')
    status.className = 'bookmark-menu-status'
    if (state.pendingDeleteBookmarkId === String(bookmark.id)) {
      status.classList.add('is-warning')
    }
    status.textContent = state.menuStatus
    menu.appendChild(status)
  }

  document.body.appendChild(menu)
  positionBookmarkMenu(menu)

  const focusedAction = focusAction
    ? menu.querySelector<HTMLButtonElement>(`[data-menu-action="${focusAction}"]`)
    : null
  if (focusedAction && !focusedAction.disabled) {
    focusedAction.focus()
    return
  }

  const firstInput = menu.querySelector('input')
  if (focusFirst && firstInput instanceof HTMLInputElement) {
    firstInput.focus()
    firstInput.select()
  }
}

function renderAddBookmarkMenu({ focusFirst = true } = {}): void {
  const existingMenu = document.querySelector<HTMLElement>('.bookmark-add-menu')
  if (existingMenu) {
    cancelExitMotion(existingMenu)
    existingMenu.remove()
  }

  if (!state.addMenuOpen) {
    return
  }

  const menu = document.createElement('section')
  menu.className = `bookmark-add-menu ${state.addMenuExpanded ? 'expanded' : ''}`
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-label', '添加新标签页书签')
  menu.style.left = `${state.addMenuX}px`
  menu.style.top = `${state.addMenuY}px`

  if (!state.addMenuExpanded) {
    const addButton = document.createElement('button')
    addButton.className = 'bookmark-add-trigger'
    addButton.type = 'button'
    addButton.append(createMenuActionIcon('plus'), document.createTextNode('添加书签'))
    addButton.addEventListener('click', expandAddBookmarkMenu)
    menu.appendChild(addButton)
  } else {
    const titleField = createMenuTextField('标题', 'Example', state.addTitle, (value) => {
      state.addTitle = value
    }, {
      disabled: state.addMenuBusy,
      onEnter: saveAddedBookmark
    })
    const urlField = createMenuTextField('链接', 'https://example.com', state.addUrl, (value) => {
      state.addUrl = value
    }, {
      disabled: state.addMenuBusy,
      onEnter: saveAddedBookmark
    })
    const separator = document.createElement('div')
    separator.className = 'bookmark-menu-separator'
    const actionList = document.createElement('div')
    actionList.className = 'bookmark-menu-actions'
    actionList.setAttribute('role', 'menu')
    actionList.setAttribute('aria-label', '添加书签操作')
    actionList.addEventListener('keydown', handleMenuActionsKeydown)
    actionList.append(createMenuAction('添加书签', 'plus', saveAddedBookmark, {
      disabled: state.addMenuBusy
    }))
    menu.append(titleField, urlField, separator, actionList)
  }

  if (state.addMenuError) {
    const error = document.createElement('p')
    error.className = 'bookmark-menu-error'
    error.textContent = state.addMenuError
    menu.appendChild(error)
  }

  document.body.appendChild(menu)
  positionMenu(menu, state.addMenuX, state.addMenuY)

  const firstInput = menu.querySelector('input')
  if (focusFirst && firstInput instanceof HTMLInputElement) {
    firstInput.focus()
    firstInput.select()
  }
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
    const dataUrl = await pickCustomIconImage()
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

function createMenuTextField(
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
): HTMLLabelElement {
  const field = document.createElement('label')
  field.className = 'bookmark-menu-row'

  const labelNode = document.createElement('span')
  labelNode.textContent = label

  const input = document.createElement('input')
  input.className = 'bookmark-menu-input'
  input.type = label === '链接' ? 'url' : 'text'
  input.placeholder = placeholder
  input.value = value
  input.disabled = disabled
  input.spellcheck = false
  input.addEventListener('input', () => {
    state.pendingDeleteBookmarkId = ''
    onInput(input.value)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void onEnter()
    }
  })

  field.append(labelNode, input)
  return field
}

function createMenuAction(
  label: string,
  icon: MenuActionIcon,
  action: () => void | Promise<void>,
  {
    disabled = state.menuBusy,
    actionId = '',
    variant = ''
  }: {
    disabled?: boolean
    actionId?: string
    variant?: 'danger' | ''
  } = {}
): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = `bookmark-menu-action${variant ? ` ${variant}` : ''}`
  button.type = 'button'
  button.disabled = disabled
  button.setAttribute('role', 'menuitem')
  button.setAttribute('aria-label', label)
  if (actionId) {
    button.dataset.menuAction = actionId
  }
  button.append(createMenuActionIcon(icon), document.createTextNode(label))
  button.addEventListener('click', () => {
    void action()
  })
  return button
}

function handleMenuActionsKeydown(event: KeyboardEvent): void {
  if (
    event.key !== 'ArrowUp' &&
    event.key !== 'ArrowDown' &&
    event.key !== 'ArrowLeft' &&
    event.key !== 'ArrowRight' &&
    event.key !== 'Home' &&
    event.key !== 'End'
  ) {
    return
  }

  const actionList = event.currentTarget
  if (!(actionList instanceof HTMLElement)) {
    return
  }

  const actions = Array.from(
    actionList.querySelectorAll<HTMLButtonElement>('.bookmark-menu-action:not(:disabled)')
  )
  if (!actions.length) {
    return
  }

  const currentIndex = actions.findIndex((action) => action === document.activeElement)
  const fallbackIndex = currentIndex >= 0 ? currentIndex : 0
  let nextIndex = fallbackIndex

  if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = actions.length - 1
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    nextIndex = (fallbackIndex - 1 + actions.length) % actions.length
  } else {
    nextIndex = (fallbackIndex + 1) % actions.length
  }

  event.preventDefault()
  actions[nextIndex]?.focus()
}

function createMenuActionIcon(icon: MenuActionIcon): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')

  const paths: Record<MenuActionIcon, string[]> = {
    trash: [
      'M4 7h16',
      'M10 11v6',
      'M14 11v6',
      'M6 7l1 14h10l1-14',
      'M9 7V4h6v3'
    ],
    refresh: [
      'M20 12a8 8 0 0 1-13.7 5.7',
      'M4 12A8 8 0 0 1 17.7 6.3',
      'M17.7 2.8v3.5h-3.5',
      'M6.3 21.2v-3.5h3.5'
    ],
    save: [
      'M5 3h12l2 2v16H5z',
      'M8 3v6h8V3',
      'M8 21v-7h8v7'
    ],
    plus: [
      'M12 5v14',
      'M5 12h14'
    ],
    copy: [
      'M8 8h11v11H8z',
      'M5 16H4V5h11v1'
    ],
    pin: [
      'M7 4h10',
      'M9 4l1 7-3 3v2h10v-2l-3-3 1-7',
      'M12 16v5'
    ]
  }

  for (const value of paths[icon]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', value)
    svg.appendChild(path)
  }

  return svg
}

function positionBookmarkMenu(menu: HTMLElement): void {
  positionMenu(menu, state.menuX, state.menuY)
}

function positionMenu(menu: HTMLElement, menuX: number, menuY: number): void {
  const margin = 8
  const rect = menu.getBoundingClientRect()
  const left = Math.max(
    margin,
    Math.min(menuX, window.innerWidth - rect.width - margin)
  )
  const top = Math.max(
    margin,
    Math.min(menuY, window.innerHeight - rect.height - margin)
  )
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
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
  return {
    type,
    color: normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    imageName: String(settings.imageName || '').trim(),
    videoName: String(settings.videoName || '').trim(),
    url: String(settings.url || '').trim(),
    maskEnabled: settings.maskEnabled === true,
    maskStyle: SUPPORTED_BACKGROUND_MASK_STYLES.has(String(settings.maskStyle))
      ? String(settings.maskStyle)
      : DEFAULT_BACKGROUND_SETTINGS.maskStyle,
    maskBlur: clampNumber(settings.maskBlur, 0, 32, DEFAULT_BACKGROUND_SETTINGS.maskBlur)
  }
}

function readBackgroundSettingsFromControls(): typeof DEFAULT_BACKGROUND_SETTINGS {
  const typeInput = document.getElementById('background-type')
  const colorInput = document.getElementById('background-color')
  const urlInput = document.getElementById('background-url')
  const maskEnabledInput = document.getElementById('background-mask-enabled')
  const maskStyleInput = document.getElementById('background-mask-style')
  const maskBlurInput = document.getElementById('background-mask-blur')

  return normalizeBackgroundSettings({
    type: typeInput instanceof HTMLSelectElement ? typeInput.value : state.backgroundSettings.type,
    color: colorInput instanceof HTMLInputElement ? colorInput.value : state.backgroundSettings.color,
    imageName: state.backgroundSettings.imageName,
    videoName: state.backgroundSettings.videoName,
    url: urlInput instanceof HTMLInputElement ? urlInput.value : state.backgroundSettings.url,
    maskEnabled: maskEnabledInput instanceof HTMLInputElement
      ? maskEnabledInput.checked
      : state.backgroundSettings.maskEnabled,
    maskStyle: maskStyleInput instanceof HTMLSelectElement
      ? maskStyleInput.value
      : state.backgroundSettings.maskStyle,
    maskBlur: maskBlurInput instanceof HTMLInputElement
      ? Number(maskBlurInput.value)
      : state.backgroundSettings.maskBlur
  })
}

function syncBackgroundSettingsControls(): void {
  const settings = state.backgroundSettings
  const typeInput = document.getElementById('background-type')
  const colorInput = document.getElementById('background-color')
  const urlInput = document.getElementById('background-url')
  const colorRow = document.getElementById('background-color-row')
  const imageRow = document.getElementById('background-image-row')
  const videoRow = document.getElementById('background-video-row')
  const urlRow = document.getElementById('background-url-row')
  const urlCacheRow = document.getElementById('background-url-cache-row')
  const urlCacheButton = document.getElementById('background-url-cache-button')
  const urlCacheStatus = document.getElementById('background-url-cache-status')
  const backgroundStatus = document.getElementById('background-status')
  const colorControl = document.getElementById('background-color-control')
  const colorValue = document.getElementById('background-color-value')
  const imageButton = document.getElementById('background-image-picker')
  const videoButton = document.getElementById('background-video-picker')
  const maskEnabledInput = document.getElementById('background-mask-enabled')
  const maskStyleInput = document.getElementById('background-mask-style')
  const maskBlurInput = document.getElementById('background-mask-blur')
  const maskStyleRow = document.getElementById('background-mask-style-row')
  const maskBlurRow = document.getElementById('background-mask-blur-row')

  if (typeInput instanceof HTMLSelectElement) {
    typeInput.value = settings.type
  }
  if (colorInput instanceof HTMLInputElement) {
    colorInput.value = settings.color
  }
  if (urlInput instanceof HTMLInputElement) {
    urlInput.value = settings.url
  }
  if (colorRow instanceof HTMLElement) {
    colorRow.hidden = settings.type !== 'color'
  }
  if (imageRow instanceof HTMLElement) {
    imageRow.hidden = settings.type !== 'image'
  }
  if (videoRow instanceof HTMLElement) {
    videoRow.hidden = settings.type !== 'video'
  }
  if (urlRow instanceof HTMLElement) {
    urlRow.hidden = settings.type !== 'urls'
  }
  if (urlCacheRow instanceof HTMLElement) {
    urlCacheRow.hidden = settings.type !== 'urls'
  }
  if (urlCacheButton instanceof HTMLButtonElement) {
    const imageUrl = normalizeBackgroundImageUrl(settings.url)
    urlCacheButton.disabled = settings.type !== 'urls' || !imageUrl || state.backgroundUrlCacheBusy
    urlCacheButton.textContent = state.backgroundUrlCacheBusy ? '缓存中...' : '授权并缓存'
    urlCacheButton.title = imageUrl ? '授权当前图片域名并生成本地压缩缓存' : '请输入图片链接'
  }
  if (urlCacheStatus instanceof HTMLElement) {
    urlCacheStatus.textContent = settings.type === 'urls' ? state.backgroundUrlCacheStatus : ''
  }
  if (backgroundStatus instanceof HTMLElement) {
    backgroundStatus.textContent = state.backgroundStatus
    backgroundStatus.hidden = !state.backgroundStatus
    backgroundStatus.dataset.tone = state.backgroundStatusTone
  }
  if (colorControl instanceof HTMLElement) {
    colorControl.style.backgroundColor = settings.color
    colorControl.style.color = getReadableTextColor(settings.color)
  }
  if (colorValue) {
    colorValue.textContent = settings.color.toUpperCase()
  }
  if (imageButton) {
    imageButton.textContent = settings.imageName ? '更换图片' : '选择图片'
    if (settings.imageName) {
      imageButton.setAttribute('title', settings.imageName)
    } else {
      imageButton.removeAttribute('title')
    }
  }
  if (videoButton) {
    videoButton.textContent = settings.videoName ? '更换视频' : '选择视频'
    if (settings.videoName) {
      videoButton.setAttribute('title', settings.videoName)
    } else {
      videoButton.removeAttribute('title')
    }
  }
  if (maskEnabledInput instanceof HTMLInputElement) {
    maskEnabledInput.checked = settings.maskEnabled
  }
  if (maskStyleInput instanceof HTMLSelectElement) {
    maskStyleInput.value = settings.maskStyle
    maskStyleInput.disabled = !settings.maskEnabled
  }
  if (maskBlurInput instanceof HTMLInputElement) {
    maskBlurInput.value = String(settings.maskBlur)
    maskBlurInput.disabled = !settings.maskEnabled
  }
  if (maskStyleRow instanceof HTMLElement) {
    maskStyleRow.hidden = !settings.maskEnabled
  }
  if (maskBlurRow instanceof HTMLElement) {
    maskBlurRow.hidden = !settings.maskEnabled
  }
}

async function saveBackgroundSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabBackgroundSettings]: state.backgroundSettings
  })
}

function shouldClearBackgroundUrlCache(
  previousSettings: typeof DEFAULT_BACKGROUND_SETTINGS,
  nextSettings: typeof DEFAULT_BACKGROUND_SETTINGS
): boolean {
  if (previousSettings.type !== nextSettings.type) {
    return true
  }

  return normalizeBackgroundImageUrl(previousSettings.url) !== normalizeBackgroundImageUrl(nextSettings.url)
}

function getBackgroundMediaSignature(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  return [
    settings.type,
    normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    settings.imageName,
    settings.videoName,
    normalizeBackgroundImageUrl(settings.url)
  ].join('|')
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

function getBackgroundUrlCacheErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/不是图片|content/i.test(message)) {
    return '远程缓存失败：链接返回的不是图片，请换用直连图片地址。'
  }
  if (/请求失败|status|404|403|401|500/i.test(message)) {
    return '远程缓存失败：图片请求失败，请检查链接是否可访问或重新授权后重试。'
  }
  if (/quota|storage|空间|容量/i.test(message)) {
    return '远程缓存失败：本地存储空间可能不足，请清理空间后重试。'
  }
  return '远程缓存失败：仍会使用原图片链接，请检查网络、图片地址或授权后重试。'
}

function hasAppliedBackgroundMedia(settings: typeof DEFAULT_BACKGROUND_SETTINGS): boolean {
  if (settings.type === 'color') {
    return true
  }
  if (settings.type === 'video') {
    return Boolean(document.querySelector('.newtab-background-video'))
  }
  if (settings.type === 'image' || settings.type === 'urls') {
    return Boolean(document.body.style.backgroundImage)
  }
  return true
}

async function applyBackgroundSettings(): Promise<void> {
  const applyToken = ++backgroundApplyToken
  const settings = state.backgroundSettings
  const mediaSignature = getBackgroundMediaSignature(settings)
  applyBackgroundMaskSettings(settings)

  if (
    mediaSignature === lastAppliedBackgroundMediaSignature &&
    hasAppliedBackgroundMedia(settings)
  ) {
    return
  }

  clearVideoBackground()
  setActiveBackgroundObjectUrl('')
  document.body.style.backgroundImage = ''

  if (settings.type === 'color') {
    document.documentElement.style.setProperty('--bg', settings.color)
    lastAppliedBackgroundMediaSignature = mediaSignature
    return
  }

  document.documentElement.style.setProperty('--bg', DEFAULT_BACKGROUND_SETTINGS.color)

  if (settings.type === 'urls') {
    const imageUrl = normalizeBackgroundImageUrl(settings.url)
    if (imageUrl) {
      await applyUrlBackgroundImage(imageUrl, applyToken, mediaSignature)
    } else {
      lastAppliedBackgroundMediaSignature = mediaSignature
    }
    return
  }

  if (settings.type !== 'image' && settings.type !== 'video') {
    lastAppliedBackgroundMediaSignature = mediaSignature
    return
  }

  const mediaType = settings.type
  let mediaRecord: Awaited<ReturnType<typeof getBackgroundMedia>>
  try {
    mediaRecord = await getBackgroundMedia(mediaType)
  } catch (error) {
    console.error(error)
    return
  }
  if (applyToken !== backgroundApplyToken || !mediaRecord) {
    return
  }

  const objectUrl = URL.createObjectURL(mediaRecord.blob)
  setActiveBackgroundObjectUrl(objectUrl)
  if (mediaType === 'image') {
    document.body.style.backgroundImage = `url("${escapeCssUrl(objectUrl)}")`
    lastAppliedBackgroundMediaSignature = mediaSignature
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
  void video.play()
  lastAppliedBackgroundMediaSignature = mediaSignature
}

async function applyUrlBackgroundImage(
  imageUrl: string,
  applyToken: number,
  mediaSignature: string
): Promise<void> {
  try {
    const cachedRecord = await getBackgroundUrlCache(imageUrl)
    if (applyToken !== backgroundApplyToken) {
      return
    }

    if (cachedRecord) {
      setBackgroundImageFromBlob(cachedRecord.blob)
      lastAppliedBackgroundMediaSignature = mediaSignature
      return
    }

    document.body.style.backgroundImage = `url("${escapeCssUrl(imageUrl)}")`
    lastAppliedBackgroundMediaSignature = mediaSignature
    void cacheBackgroundUrlImage(imageUrl)
  } catch {
    if (applyToken === backgroundApplyToken) {
      document.body.style.backgroundImage = `url("${escapeCssUrl(imageUrl)}")`
      lastAppliedBackgroundMediaSignature = mediaSignature
    }
  }
}

async function cacheBackgroundUrlImage(imageUrl: string): Promise<void> {
  try {
    const hasPermission = await hasOriginPermission(imageUrl)
    if (!hasPermission || !isCurrentBackgroundUrl(imageUrl)) {
      return
    }

    const blob = await fetchBackgroundUrlImage(imageUrl)
    if (!isCurrentBackgroundUrl(imageUrl)) {
      return
    }

    await saveBackgroundUrlCache(imageUrl, blob)
  } catch {
    // 缓存是增强能力，失败时继续使用原图片链接，不向扩展错误页写入噪音。
  }
}

function isCurrentBackgroundUrl(imageUrl: string): boolean {
  return state.backgroundSettings.type === 'urls' &&
    normalizeBackgroundImageUrl(state.backgroundSettings.url) === imageUrl
}

function setBackgroundImageFromBlob(blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob)
  setActiveBackgroundObjectUrl(objectUrl)
  document.body.style.backgroundImage = `url("${escapeCssUrl(objectUrl)}")`
}

function applyBackgroundMaskSettings(settings = state.backgroundSettings): void {
  const mask = document.getElementById('newtab-background-mask')
  document.body.classList.toggle('background-mask-enabled', settings.maskEnabled)
  document.body.dataset.backgroundMaskStyle = settings.maskStyle
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

function getOriginPermissionPattern(url: string): string {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ''
    }

    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

function hasOriginPermission(url: string): Promise<boolean> {
  const originPattern = getOriginPermissionPattern(url)
  if (!originPattern || !chrome.permissions?.contains) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [originPattern] }, (granted) => {
      const error = chrome.runtime.lastError
      resolve(!error && Boolean(granted))
    })
  })
}

async function requestOriginPermission(url: string): Promise<boolean> {
  if (await hasOriginPermission(url)) {
    return true
  }

  const originPattern = getOriginPermissionPattern(url)
  if (!originPattern || !chrome.permissions?.request) {
    return false
  }

  return new Promise((resolve) => {
    chrome.permissions.request({ origins: [originPattern] }, (granted) => {
      const error = chrome.runtime.lastError
      resolve(!error && Boolean(granted))
    })
  })
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
      const request = transaction.objectStore(BACKGROUND_MEDIA_STORE).get(BACKGROUND_URL_CACHE_KEY)
      request.onsuccess = () => {
        const record = request.result as {
          blob?: unknown
          url?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined
        if (
          !record?.blob ||
          !(record.blob instanceof Blob) ||
          String(record.url || '') !== imageUrl
        ) {
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
      }, BACKGROUND_URL_CACHE_KEY)
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
      transaction.objectStore(BACKGROUND_MEDIA_STORE).delete(BACKGROUND_URL_CACHE_KEY)
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

async function fetchBackgroundUrlImage(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl, {
    cache: 'force-cache'
  })
  if (!response.ok) {
    throw new Error(`图片请求失败：${response.status}`)
  }

  const blob = await response.blob()
  const contentType = response.headers.get('content-type') || blob.type
  if (!blob.size || !contentType.toLowerCase().startsWith('image/')) {
    throw new Error('链接返回的内容不是图片。')
  }

  return await createOptimizedBackgroundImageBlob(blob)
}

async function createOptimizedBackgroundImageBlob(blob: Blob): Promise<Blob> {
  if (['image/gif', 'image/svg+xml'].includes(blob.type.toLowerCase())) {
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
  return {
    enabled: settings.enabled !== false,
    openInNewTab: settings.openInNewTab === true,
    engine: SUPPORTED_SEARCH_ENGINES.has(String(settings.engine))
      ? String(settings.engine)
      : DEFAULT_SEARCH_SETTINGS.engine,
    placeholder,
    width: clampNumber(settings.width, 16, 72, DEFAULT_SEARCH_SETTINGS.width),
    height: clampNumber(settings.height, 28, 56, DEFAULT_SEARCH_SETTINGS.height),
    offsetY: clampNumber(settings.offsetY, -32, 72, DEFAULT_SEARCH_SETTINGS.offsetY),
    background: clampNumber(settings.background, 36, 76, DEFAULT_SEARCH_SETTINGS.background)
  }
}

function getSearchPlaceholder(settings: typeof DEFAULT_SEARCH_SETTINGS): string {
  return String(settings.placeholder || '').trim() || DEFAULT_SEARCH_SETTINGS.placeholder
}

function readSearchSettingsFromControls(): typeof DEFAULT_SEARCH_SETTINGS {
  const enabledInput = document.getElementById('search-enabled')
  const openInput = document.getElementById('search-open-new-tab')
  const engineInput = document.getElementById('search-engine')
  const placeholderInput = document.getElementById('search-placeholder')
  const widthInput = document.getElementById('search-width')
  const heightInput = document.getElementById('search-height')
  const offsetYInput = document.getElementById('search-offset-y')
  const backgroundInput = document.getElementById('search-background')

  return normalizeSearchSettings({
    enabled: enabledInput instanceof HTMLInputElement ? enabledInput.checked : state.searchSettings.enabled,
    openInNewTab: openInput instanceof HTMLInputElement ? openInput.checked : state.searchSettings.openInNewTab,
    engine: engineInput instanceof HTMLSelectElement ? engineInput.value : state.searchSettings.engine,
    placeholder: placeholderInput instanceof HTMLInputElement ? placeholderInput.value : state.searchSettings.placeholder,
    width: widthInput instanceof HTMLInputElement ? Number(widthInput.value) : state.searchSettings.width,
    height: heightInput instanceof HTMLInputElement ? Number(heightInput.value) : state.searchSettings.height,
    offsetY: offsetYInput instanceof HTMLInputElement ? Number(offsetYInput.value) : state.searchSettings.offsetY,
    background: backgroundInput instanceof HTMLInputElement ? Number(backgroundInput.value) : state.searchSettings.background
  })
}

function syncSearchSettingsControls(): void {
  const settings = state.searchSettings
  const enabledInput = document.getElementById('search-enabled')
  const openInput = document.getElementById('search-open-new-tab')
  const engineInput = document.getElementById('search-engine')
  const placeholderInput = document.getElementById('search-placeholder')
  const widthInput = document.getElementById('search-width')
  const heightInput = document.getElementById('search-height')
  const offsetYInput = document.getElementById('search-offset-y')
  const backgroundInput = document.getElementById('search-background')

  if (enabledInput instanceof HTMLInputElement) {
    enabledInput.checked = settings.enabled
  }
  if (openInput instanceof HTMLInputElement) {
    openInput.checked = settings.openInNewTab
    openInput.disabled = !settings.enabled
  }
  if (engineInput instanceof HTMLSelectElement) {
    engineInput.value = settings.engine
    engineInput.disabled = !settings.enabled
  }
  if (placeholderInput instanceof HTMLInputElement) {
    placeholderInput.value = settings.placeholder
    placeholderInput.disabled = !settings.enabled
  }
  if (widthInput instanceof HTMLInputElement) {
    widthInput.value = String(settings.width)
    widthInput.disabled = !settings.enabled
  }
  if (heightInput instanceof HTMLInputElement) {
    heightInput.value = String(settings.height)
    heightInput.disabled = !settings.enabled
  }
  if (offsetYInput instanceof HTMLInputElement) {
    offsetYInput.value = String(settings.offsetY)
    offsetYInput.disabled = !settings.enabled
  }
  if (backgroundInput instanceof HTMLInputElement) {
    backgroundInput.value = String(settings.background)
    backgroundInput.disabled = !settings.enabled
  }
}

async function saveSearchSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabSearchSettings]: state.searchSettings
  })
}

function scheduleSearchSettingsSave(): void {
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = window.setTimeout(() => {
    searchSettingsSaveTimer = 0
    void saveSearchSettings()
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function normalizeGeneralSettings(rawSettings: unknown): typeof DEFAULT_GENERAL_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_GENERAL_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  return {
    hideSettingsTrigger: settings.hideSettingsTrigger === true,
    showFrequentBookmarks: settings.showFrequentBookmarks !== false,
    showRecentBookmarks: settings.showRecentBookmarks !== false
  }
}

function readGeneralSettingsFromControls(): typeof DEFAULT_GENERAL_SETTINGS {
  const hideInput = document.getElementById('general-hide-settings-trigger')
  const showFrequentInput = document.getElementById('general-show-frequent')
  const showRecentInput = document.getElementById('general-show-recent')

  return normalizeGeneralSettings({
    hideSettingsTrigger: hideInput instanceof HTMLInputElement
      ? hideInput.checked
      : state.generalSettings.hideSettingsTrigger,
    showFrequentBookmarks: showFrequentInput instanceof HTMLInputElement
      ? showFrequentInput.checked
      : state.generalSettings.showFrequentBookmarks,
    showRecentBookmarks: showRecentInput instanceof HTMLInputElement
      ? showRecentInput.checked
      : state.generalSettings.showRecentBookmarks
  })
}

function syncGeneralSettingsControls(): void {
  const hideInput = document.getElementById('general-hide-settings-trigger')
  const showFrequentInput = document.getElementById('general-show-frequent')
  const showRecentInput = document.getElementById('general-show-recent')

  if (hideInput instanceof HTMLInputElement) {
    hideInput.checked = state.generalSettings.hideSettingsTrigger
  }
  if (showFrequentInput instanceof HTMLInputElement) {
    showFrequentInput.checked = state.generalSettings.showFrequentBookmarks
  }
  if (showRecentInput instanceof HTMLInputElement) {
    showRecentInput.checked = state.generalSettings.showRecentBookmarks
  }
}

async function saveGeneralSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabGeneralSettings]: state.generalSettings
  })
}

function applyGeneralSettings(): void {
  document.body.classList.toggle(
    'settings-trigger-auto-hide',
    state.generalSettings.hideSettingsTrigger
  )
}

function normalizeFolderSettings(rawSettings: unknown): NewTabFolderSettings {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_FOLDER_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  return {
    selectedFolderIds: normalizeFolderIds(settings.selectedFolderIds),
    hideFolderNames: settings.hideFolderNames === true
  }
}

function normalizeFolderSettingsWithDefault(
  rawSettings: unknown,
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): NewTabFolderSettings {
  const settings = normalizeFolderSettings(rawSettings)
  if (settings.selectedFolderIds.length) {
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

function normalizeFolderIds(value: unknown): string[] {
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

function readFolderSettingsFromControls(): NewTabFolderSettings {
  const hideInput = document.getElementById('folder-hide-names')

  return normalizeFolderSettings({
    selectedFolderIds: state.folderSettings.selectedFolderIds,
    hideFolderNames: hideInput instanceof HTMLInputElement
      ? hideInput.checked
      : state.folderSettings.hideFolderNames
  })
}

function syncFolderSettingsControls(): void {
  const hideInput = document.getElementById('folder-hide-names')
  const selectedList = document.getElementById('folder-selected-list')
  const selectedCount = document.getElementById('folder-selected-count')
  const toggle = document.getElementById('folder-candidates-toggle')
  const panel = document.getElementById('folder-candidates-panel')
  const searchInput = document.getElementById('folder-candidate-search')
  const candidateList = document.getElementById('folder-candidate-list')

  if (hideInput instanceof HTMLInputElement) {
    hideInput.checked = state.folderSettings.hideFolderNames
  }

  if (selectedCount) {
    selectedCount.textContent = String(state.folderSettings.selectedFolderIds.length)
  }

  if (selectedList instanceof HTMLElement) {
    selectedList.replaceChildren(...createSelectedFolderControls())
  }

  if (toggle instanceof HTMLButtonElement) {
    toggle.setAttribute('aria-expanded', String(state.folderCandidatesExpanded))
    toggle.classList.toggle('expanded', state.folderCandidatesExpanded)
    const label = toggle.querySelector('[data-folder-toggle-label]')
    if (label) {
      label.textContent = state.folderCandidatesExpanded ? '收起候选文件夹' : '展开候选文件夹'
    }
  }

  if (panel instanceof HTMLElement) {
    setRevealPanelExpanded(panel, state.folderCandidatesExpanded)
  }

  if (searchInput instanceof HTMLInputElement && searchInput.value !== state.folderCandidateQuery) {
    searchInput.value = state.folderCandidateQuery
  }

  if (candidateList instanceof HTMLElement) {
    candidateList.replaceChildren(...createFolderCandidateControls())
  }
}

function createSelectedFolderControls(): HTMLElement[] {
  const selectedIds = state.folderSettings.selectedFolderIds
  if (!selectedIds.length) {
    const empty = document.createElement('p')
    empty.className = 'folder-source-empty'
    empty.textContent = '未选择文件夹'
    return [empty]
  }

  const folders = getFolderCandidateMap()
  return selectedIds.map((folderId) => {
    const folder = folders.get(folderId)
    const row = document.createElement('div')
    row.className = 'folder-source-selected-item'

    const copy = document.createElement('span')
    copy.className = 'folder-source-selected-copy'

    const title = document.createElement('strong')
    title.textContent = folder?.title || '已删除的文件夹'

    const path = document.createElement('span')
    path.textContent = folder?.path || folderId

    copy.append(title, path)

    const remove = document.createElement('button')
    remove.className = 'folder-source-remove'
    remove.type = 'button'
    remove.dataset.folderRemoveId = folderId
    const folderTitle = folder?.title || '文件夹'
    const affectedCount = folder?.bookmarkCount || 0
    const removeLabel = `从新标签页移除「${folderTitle}」，将隐藏 ${affectedCount} 个书签，不会删除书签`
    remove.setAttribute('aria-label', removeLabel)
    remove.title = removeLabel
    remove.textContent = '×'

    row.append(copy, remove)
    return row
  })
}

function createFolderCandidateControls(): HTMLElement[] {
  const candidates = getFilteredFolderCandidates()
  if (!candidates.length) {
    const empty = document.createElement('p')
    empty.className = 'folder-source-empty'
    empty.textContent = '没有匹配的文件夹'
    return [empty]
  }

  const selectedIds = new Set(state.folderSettings.selectedFolderIds)
  return candidates.map((folder) => {
    const selected = selectedIds.has(folder.id)
    const button = document.createElement('button')
    button.className = `folder-candidate-card ${selected ? 'selected' : ''}`
    button.type = 'button'
    button.dataset.folderCandidateId = folder.id
    button.title = folder.path || folder.title
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(selected))

    const copy = document.createElement('span')
    copy.className = 'folder-candidate-copy'

    const title = document.createElement('strong')
    title.textContent = folder.title || '未命名文件夹'

    const path = document.createElement('span')
    path.textContent = folder.path || folder.title || '未命名文件夹'

    copy.append(title, path)

    const badge = document.createElement('span')
    badge.className = 'folder-candidate-badge'
    badge.textContent = selected ? '已选' : `${folder.bookmarkCount}`

    button.append(copy, badge)
    return button
  })
}

function getFilteredFolderCandidates(): FolderRecord[] {
  const query = normalizeSettingSearchText(state.folderCandidateQuery)
  return getFolderCandidates().filter((folder) => {
    if (!query) {
      return true
    }

    return folder.normalizedTitle.includes(query) || folder.normalizedPath.includes(query)
  })
}

function getFolderCandidates(): FolderRecord[] {
  if (!state.rootNode) {
    return []
  }

  return extractBookmarkData(state.rootNode).folders
}

function getFolderCandidateMap(): Map<string, FolderRecord> {
  const map = new Map<string, FolderRecord>()
  for (const folder of getFolderCandidates()) {
    map.set(folder.id, folder)
  }
  return map
}

function normalizeSettingSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function saveFolderSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabFolderSettings]: state.folderSettings
  })
}

function applyFolderSettings(): void {
  document.body.classList.toggle(
    'folder-names-hidden',
    state.folderSettings.hideFolderNames
  )
}

function readIconSettingsFromControls(): IconSettings {
  const pageWidthInput = document.getElementById('icon-page-width')
  const iconShellSizeInput = document.getElementById('icon-shell-size')
  const columnGapInput = document.getElementById('icon-column-gap')
  const rowGapInput = document.getElementById('icon-row-gap')
  const folderGapInput = document.getElementById('icon-folder-gap')
  const columnsInput = document.getElementById('icon-columns')
  const verticalCenterInput = document.getElementById('icon-vertical-center')
  const showTitlesInput = document.getElementById('icon-show-titles')

  const settings = normalizeIconSettings({
    pageWidth: pageWidthInput instanceof HTMLInputElement
      ? Number(pageWidthInput.value)
      : state.iconSettings.pageWidth,
    tileWidth: state.iconSettings.tileWidth,
    iconShellSize: iconShellSizeInput instanceof HTMLInputElement
      ? Number(iconShellSizeInput.value)
      : state.iconSettings.iconShellSize,
    columnGap: columnGapInput instanceof HTMLInputElement
      ? Number(columnGapInput.value)
      : state.iconSettings.columnGap,
    rowGap: rowGapInput instanceof HTMLInputElement
      ? Number(rowGapInput.value)
      : state.iconSettings.rowGap,
    folderGap: folderGapInput instanceof HTMLInputElement
      ? Number(folderGapInput.value)
      : state.iconSettings.folderGap,
    layoutMode: state.iconSettings.layoutMode,
    columns: columnsInput instanceof HTMLInputElement
      ? Number(columnsInput.value)
      : state.iconSettings.columns,
    verticalCenter: verticalCenterInput instanceof HTMLInputElement
      ? verticalCenterInput.checked
      : state.iconSettings.verticalCenter,
    showTitles: showTitlesInput instanceof HTMLInputElement
      ? showTitlesInput.checked
      : state.iconSettings.showTitles,
    titleLines: state.iconSettings.titleLines,
    preset: ''
  })

  return withDetectedIconPreset(settings)
}

function syncIconSettingsControls(): void {
  const settings = state.iconSettings
  const pageWidthInput = document.getElementById('icon-page-width')
  const iconShellSizeInput = document.getElementById('icon-shell-size')
  const columnGapInput = document.getElementById('icon-column-gap')
  const rowGapInput = document.getElementById('icon-row-gap')
  const folderGapInput = document.getElementById('icon-folder-gap')
  const columnsInput = document.getElementById('icon-columns')
  const verticalCenterInput = document.getElementById('icon-vertical-center')
  const showTitlesInput = document.getElementById('icon-show-titles')
  const titleLinesRow = document.getElementById('icon-title-lines-row')
  const columnsRow = document.getElementById('icon-columns-row')

  if (pageWidthInput instanceof HTMLInputElement) {
    pageWidthInput.value = String(settings.pageWidth)
  }
  if (iconShellSizeInput instanceof HTMLInputElement) {
    iconShellSizeInput.value = String(settings.iconShellSize)
  }
  if (columnGapInput instanceof HTMLInputElement) {
    columnGapInput.value = String(settings.columnGap)
  }
  if (rowGapInput instanceof HTMLInputElement) {
    rowGapInput.value = String(settings.rowGap)
  }
  if (folderGapInput instanceof HTMLInputElement) {
    folderGapInput.value = String(settings.folderGap)
  }
  if (columnsInput instanceof HTMLInputElement) {
    columnsInput.value = String(settings.columns)
    columnsInput.disabled = settings.layoutMode !== 'fixed'
  }
  if (verticalCenterInput instanceof HTMLInputElement) {
    verticalCenterInput.checked = settings.verticalCenter
  }
  if (showTitlesInput instanceof HTMLInputElement) {
    showTitlesInput.checked = settings.showTitles
  }

  setTextContent('icon-page-width-value', `${settings.pageWidth}%`)
  setTextContent('icon-shell-size-value', `${settings.iconShellSize}px`)
  setTextContent('icon-column-gap-value', `${getIconGapPx(settings.columnGap)}px`)
  setTextContent('icon-row-gap-value', `${getIconRowGapPx(settings.rowGap)}px`)
  setTextContent('icon-folder-gap-value', `${getFolderGapPx(settings.folderGap)}px`)
  setTextContent('icon-columns-value', String(settings.columns))

  syncIconSegmentButtons('[data-icon-layout-mode]', settings.layoutMode)
  syncIconSegmentButtons('[data-icon-title-lines]', String(settings.titleLines), !settings.showTitles)
  titleLinesRow?.classList.toggle('setting-row-disabled', !settings.showTitles)
  columnsRow?.classList.toggle('setting-row-disabled', settings.layoutMode !== 'fixed')
  syncPresetCardSelection()
  syncIconAdvancedPanel()
  renderIconPreview()
}

async function saveIconSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabIconSettings]: state.iconSettings
  })
}

function scheduleIconSettingsSave(): void {
  window.clearTimeout(iconSettingsSaveTimer)
  iconSettingsSaveTimer = window.setTimeout(() => {
    iconSettingsSaveTimer = 0
    void saveIconSettings()
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function commitIconSettings(nextSettings: IconSettings): void {
  state.iconSettings = withDetectedIconPreset(nextSettings)
  scheduleIconSettingsSave()
  scheduleRender({ updateClock: true })
  syncIconSettingsControls()
  updateAllSettingRangeVisuals()
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
  void saveIconSettings()
  render()
  syncIconSettingsControls()
  updateAllSettingRangeVisuals()
  updateClockText()
}

function toggleIconAdvanced(): void {
  const toggle = document.getElementById('icon-advanced-toggle')
  const panel = document.getElementById('icon-advanced-panel')
  if (!toggle || !panel) return

  const expanded = toggle.getAttribute('aria-expanded') === 'true'
  toggle.setAttribute('aria-expanded', String(!expanded))
  toggle.classList.toggle('expanded', !expanded)
  setRevealPanelExpanded(panel, !expanded)
}

function setRevealPanelExpanded(panel: HTMLElement, expanded: boolean): void {
  panel.hidden = false
  panel.classList.toggle('is-expanded', expanded)
  panel.classList.toggle('is-collapsed', !expanded)
  panel.setAttribute('aria-hidden', String(!expanded))
  if (expanded) {
    panel.removeAttribute('inert')
  } else {
    panel.setAttribute('inert', '')
  }
}

function handlePresetCardClick(event: Event): void {
  const target = event.target
  const card = target instanceof HTMLElement ? target.closest<HTMLElement>('.icon-preset-card') : null
  if (!card) return

  const presetKey = card.dataset.preset as IconLayoutPresetKey | undefined
  if (presetKey && presetKey in ICON_LAYOUT_PRESETS) {
    applyIconPreset(presetKey)
  }
}

function syncPresetCardSelection(): void {
  const cards = document.querySelectorAll<HTMLElement>('.icon-preset-card')
  for (const card of cards) {
    card.classList.toggle('selected', card.dataset.preset === state.iconSettings.preset)
  }
}

function syncIconAdvancedPanel(): void {
  const columnsInput = document.getElementById('icon-columns')
  if (columnsInput instanceof HTMLInputElement) {
    columnsInput.title = state.iconSettings.layoutMode === 'fixed'
      ? ''
      : '固定列数模式下生效'
  }
}

function setTextContent(elementId: string, text: string): void {
  const element = document.getElementById(elementId)
  if (element) {
    element.textContent = text
  }
}

function syncIconSegmentButtons(selector: string, selectedValue: string, disabled = false): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(selector)) {
    const value = button.dataset.iconLayoutMode || button.dataset.iconTitleLines || ''
    const selected = value === selectedValue
    button.classList.toggle('selected', selected)
    button.setAttribute('aria-pressed', String(selected))
    button.disabled = disabled
    button.setAttribute('aria-disabled', String(disabled))
  }
}

function renderIconPreview(): void {
  const preview = document.getElementById('icon-live-preview')
  if (!preview) {
    return
  }

  const settings = state.iconSettings
  const previewColumnGap = Math.max(4, Math.round(getIconGapPx(settings.columnGap) * 0.2))
  const previewRowGap = Math.max(2, Math.round(getIconRowGapPx(settings.rowGap) * 0.2))
  const previewTileWidth = Math.max(42, Math.round(settings.tileWidth * 0.58))
  const previewShellSize = Math.max(22, Math.round(settings.iconShellSize * 0.58))
  const previewColumns = settings.layoutMode === 'fixed'
    ? Math.max(3, Math.min(8, settings.columns))
    : Math.max(3, Math.min(6, Math.round(settings.pageWidth / 14)))
  const sampleCount = Math.max(6, Math.min(8, previewColumns * 2))
  const summary = [
    settings.layoutMode === 'fixed' ? `${settings.columns} 列固定` : '自动适配',
    `${settings.iconShellSize}px 图标`,
    settings.showTitles ? `${settings.titleLines} 行标题` : '隐藏标题'
  ].join(' · ')

  preview.dataset.iconLayoutMode = settings.layoutMode
  preview.dataset.iconShowTitles = String(settings.showTitles)
  preview.style.setProperty('--preview-page-width', `${settings.pageWidth}%`)
  preview.style.setProperty('--preview-column-gap', `${previewColumnGap}px`)
  preview.style.setProperty('--preview-row-gap', `${previewRowGap}px`)
  preview.style.setProperty('--preview-tile-width', `${previewTileWidth}px`)
  preview.style.setProperty('--preview-shell-size', `${previewShellSize}px`)
  preview.style.setProperty('--preview-title-lines', String(settings.titleLines))
  setTextContent('icon-live-preview-summary', summary)

  const grid = document.createElement('div')
  grid.className = 'icon-live-preview-grid'
  grid.style.gridTemplateColumns = `repeat(${previewColumns}, minmax(0, var(--preview-tile-width)))`

  const names = ['阅读', '工作台', '邮箱', '文档', '设计', '数据', '日程', '收藏']
  for (let index = 0; index < sampleCount; index++) {
    const tile = document.createElement('span')
    tile.className = 'icon-live-preview-tile'

    const shell = document.createElement('span')
    shell.className = 'icon-live-preview-shell'
    const mark = document.createElement('span')
    mark.className = 'icon-live-preview-mark'
    mark.textContent = names[index].slice(0, 1)
    shell.appendChild(mark)

    const title = document.createElement('span')
    title.className = 'icon-live-preview-title'
    title.textContent = names[index]

    tile.append(shell, title)
    grid.appendChild(tile)
  }

  preview.replaceChildren(grid)
}

function renderIconPresetCards(): void {
  const row = document.getElementById('icon-preset-row')
  if (!row) return

  row.replaceChildren()
  for (const [key, meta] of Object.entries(ICON_PRESET_META)) {
    const card = document.createElement('button')
    card.className = 'icon-preset-card'
    card.type = 'button'
    card.dataset.preset = key

    const preview = document.createElement('div')
    preview.className = 'icon-preset-preview'
    preview.style.gridTemplateColumns = `repeat(${meta.cols}, 1fr)`
    preview.style.gap = key === 'compact' ? '2px' : key === 'spacious' ? '4px' : '3px'
    preview.style.padding = '0 4px'

    for (let i = 0; i < meta.cols * meta.rows; i++) {
      const cell = document.createElement('span')
      cell.className = 'icon-preset-preview-cell'
      cell.style.height = key === 'compact' ? '10px' : key === 'spacious' ? '14px' : '11px'
      preview.appendChild(cell)
    }

    const name = document.createElement('span')
    name.className = 'icon-preset-name'
    name.textContent = meta.name

    const desc = document.createElement('span')
    desc.className = 'icon-preset-desc'
    desc.textContent = meta.desc

    const detail = document.createElement('span')
    detail.className = 'icon-preset-detail'
    detail.textContent = meta.detail

    card.append(preview, name, desc, detail)
    row.appendChild(card)
  }
}

function submitSearch(value: string): void {
  const query = String(value || '').trim()
  if (!query) {
    return
  }

  const targetUrl = getDirectNavigationUrl(query) || getSearchUrl(query, state.searchSettings.engine)
  openSearchTarget(targetUrl)
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

function getSearchUrl(query: string, engine: string): string {
  const encodedQuery = encodeURIComponent(query)
  switch (engine) {
    case 'bing':
      return `https://www.bing.com/search?q=${encodedQuery}`
    case 'baidu':
      return `https://www.baidu.com/s?wd=${encodedQuery}`
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${encodedQuery}`
    case 'google':
    case 'default':
    default:
      return `https://www.google.com/search?q=${encodedQuery}`
  }
}

function openSearchTarget(targetUrl: string): void {
  if (state.searchSettings.openInNewTab) {
    const opened = window.open(targetUrl, '_blank', 'noopener')
    if (opened) {
      opened.opener = null
    }
    return
  }

  window.location.assign(targetUrl)
}

function normalizeTimeSettings(rawSettings: unknown): typeof DEFAULT_TIME_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_TIME_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const legacyDateFormat = String(settings.dateFormat)
  const dateFormat = ['auto', 'zh', 'iso'].includes(legacyDateFormat)
    ? 'month-day-weekday'
    : legacyDateFormat
  return {
    enabled: settings.enabled !== false,
    showSeconds: settings.showSeconds === true,
    hour12: settings.hour12 === true,
    clockSize: clampNumber(settings.clockSize, 70, 130, DEFAULT_TIME_SETTINGS.clockSize),
    dateFormat: SUPPORTED_DATE_FORMATS.has(dateFormat)
      ? dateFormat
      : DEFAULT_TIME_SETTINGS.dateFormat,
    timeZone: SUPPORTED_TIME_ZONES.has(String(settings.timeZone))
      ? String(settings.timeZone)
      : DEFAULT_TIME_SETTINGS.timeZone,
    displayMode: ['time-date', 'time', 'date'].includes(String(settings.displayMode))
      ? String(settings.displayMode)
      : DEFAULT_TIME_SETTINGS.displayMode
  }
}

function readTimeSettingsFromControls(): typeof DEFAULT_TIME_SETTINGS {
  const enabledInput = document.getElementById('time-enabled')
  const secondsInput = document.getElementById('time-show-seconds')
  const hour12Input = document.getElementById('time-hour12')
  const sizeInput = document.getElementById('time-clock-size')
  const dateFormatInput = document.getElementById('time-date-format')
  const timeZoneInput = document.getElementById('time-time-zone')
  const displayInput = document.getElementById('time-display-mode')

  return normalizeTimeSettings({
    enabled: enabledInput instanceof HTMLInputElement ? enabledInput.checked : state.timeSettings.enabled,
    showSeconds: secondsInput instanceof HTMLInputElement ? secondsInput.checked : state.timeSettings.showSeconds,
    hour12: hour12Input instanceof HTMLInputElement ? hour12Input.checked : state.timeSettings.hour12,
    clockSize: sizeInput instanceof HTMLInputElement ? Number(sizeInput.value) : state.timeSettings.clockSize,
    dateFormat: dateFormatInput instanceof HTMLSelectElement ? dateFormatInput.value : state.timeSettings.dateFormat,
    timeZone: timeZoneInput instanceof HTMLSelectElement ? timeZoneInput.value : state.timeSettings.timeZone,
    displayMode: displayInput instanceof HTMLSelectElement ? displayInput.value : state.timeSettings.displayMode
  })
}

function syncTimeSettingsControls(): void {
  const settings = state.timeSettings
  const enabledInput = document.getElementById('time-enabled')
  const secondsInput = document.getElementById('time-show-seconds')
  const hour12Input = document.getElementById('time-hour12')
  const sizeInput = document.getElementById('time-clock-size')
  const dateFormatInput = document.getElementById('time-date-format')
  const timeZoneInput = document.getElementById('time-time-zone')
  const displayInput = document.getElementById('time-display-mode')

  if (enabledInput instanceof HTMLInputElement) {
    enabledInput.checked = settings.enabled
  }
  if (secondsInput instanceof HTMLInputElement) {
    secondsInput.checked = settings.showSeconds
    secondsInput.disabled = !settings.enabled || settings.displayMode === 'date'
  }
  if (hour12Input instanceof HTMLInputElement) {
    hour12Input.checked = settings.hour12
    hour12Input.disabled = !settings.enabled || settings.displayMode === 'date'
  }
  if (sizeInput instanceof HTMLInputElement) {
    sizeInput.value = String(settings.clockSize)
    sizeInput.disabled = !settings.enabled
  }
  if (dateFormatInput instanceof HTMLSelectElement) {
    dateFormatInput.value = settings.dateFormat
    dateFormatInput.disabled = !settings.enabled || settings.displayMode === 'time'
  }
  if (timeZoneInput instanceof HTMLSelectElement) {
    timeZoneInput.value = settings.timeZone
    timeZoneInput.disabled = !settings.enabled
  }
  if (displayInput instanceof HTMLSelectElement) {
    displayInput.value = settings.displayMode
    displayInput.disabled = !settings.enabled
  }

  setTextContent('time-clock-size-value', `${settings.clockSize}%`)
}

async function saveTimeSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabTimeSettings]: state.timeSettings
  })
}

function scheduleTimeSettingsSave(): void {
  window.clearTimeout(timeSettingsSaveTimer)
  timeSettingsSaveTimer = window.setTimeout(() => {
    timeSettingsSaveTimer = 0
    void saveTimeSettings()
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function scheduleClockTick(): void {
  window.clearTimeout(clockTimer)
  if (!state.timeSettings.enabled || state.timeSettings.displayMode === 'none') {
    clockTimer = 0
    return
  }

  clockTimer = window.setTimeout(() => {
    clockTimer = 0
    updateClockText()
    scheduleClockTick()
  }, getClockUpdateDelay(new Date()))
}

function getClockUpdateDelay(date: Date): number {
  const milliseconds = date.getMilliseconds()
  if (state.timeSettings.showSeconds && state.timeSettings.displayMode !== 'date') {
    return Math.max(250, 1000 - milliseconds + 25)
  }

  return Math.max(1000, (60 - date.getSeconds()) * 1000 - milliseconds + 25)
}

function updateClockText(): void {
  const clockNode = document.querySelector('.newtab-clock')
  const timeNode = document.querySelector('[data-clock-time]')
  const dateNode = document.querySelector('[data-clock-date]')
  const periodNode = document.querySelector('[data-clock-period]')
  const zoneNode = document.querySelector('[data-clock-zone]')
  if (!timeNode && !dateNode && !periodNode && !zoneNode) {
    return
  }

  const now = new Date()
  if (clockNode instanceof HTMLElement) {
    clockNode.setAttribute('aria-label', getClockAriaLabel(now))
  }
  if (timeNode instanceof HTMLTimeElement) {
    timeNode.textContent = formatClockTime(now)
    timeNode.dateTime = formatClockTimeDateTime(now)
  }
  if (periodNode) {
    periodNode.textContent = formatClockPeriod(now)
  }
  if (dateNode instanceof HTMLTimeElement) {
    dateNode.textContent = formatClockDate(now)
    dateNode.dateTime = formatClockDateTime(now)
  }
  if (zoneNode) {
    zoneNode.textContent = getClockZoneLabel()
  }
}

function formatClockTime(date: Date): string {
  const settings = state.timeSettings
  const parts = getClockParts(date)
  let hours = parts.hours
  if (settings.hour12) {
    hours = hours % 12 || 12
  }

  const timeParts = [
    String(hours).padStart(2, '0'),
    String(parts.minutes).padStart(2, '0')
  ]
  if (settings.showSeconds) {
    timeParts.push(String(parts.seconds).padStart(2, '0'))
  }
  return timeParts.join(':')
}

function formatClockPeriod(date: Date): string {
  return getClockParts(date).hours < 12 ? 'AM' : 'PM'
}

function formatClockTimeDateTime(date: Date): string {
  const parts = getClockParts(date)
  return [
    String(parts.hours).padStart(2, '0'),
    String(parts.minutes).padStart(2, '0'),
    String(parts.seconds).padStart(2, '0')
  ].join(':')
}

function formatClockDateTime(date: Date): string {
  const parts = getClockParts(date)
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0')
  ].join('-')
}

function formatClockDate(date: Date): string {
  const settings = state.timeSettings
  const parts = getClockParts(date)
  const yearText = String(parts.year).padStart(4, '0')
  const monthText = String(parts.month).padStart(2, '0')
  const dayText = String(parts.day).padStart(2, '0')
  const weekdayText = parts.weekday.replace(/^星期/, '周')

  switch (settings.dateFormat) {
    case 'year-month-day-weekday':
      return `${yearText}.${monthText}.${dayText} ${weekdayText}`
    case 'weekday-day-month':
      return `${weekdayText} ${dayText}/${monthText}`
    case 'weekday-month-day':
      return `${weekdayText} ${monthText}/${dayText}`
    case 'month-day-weekday':
    default:
      return `${monthText}.${dayText} ${weekdayText}`
  }
}

function getClockAriaLabel(date: Date): string {
  const settings = state.timeSettings
  const parts: string[] = []
  if (settings.displayMode !== 'date') {
    parts.push(settings.hour12
      ? `${formatClockTime(date)} ${formatClockPeriod(date)}`
      : formatClockTime(date))
  }
  if (settings.displayMode !== 'time') {
    parts.push(formatClockDate(date))
  }
  parts.push(getClockZoneLabel())
  return parts.join('，')
}

function getClockZoneLabel(): string {
  return TIME_ZONE_LABELS[state.timeSettings.timeZone] || state.timeSettings.timeZone
}

function getClockParts(date: Date): {
  year: number
  month: number
  day: number
  weekday: string
  hours: number
  minutes: number
  seconds: number
} {
  const { timeZone } = state.timeSettings
  if (timeZone === 'auto') {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: weekdays[date.getDay()],
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds()
    }
  }

  const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-gregory', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23'
  })
  const formattedParts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    formattedParts.find((part) => part.type === type)?.value || ''

  return {
    year: Number(getPart('year')) || date.getFullYear(),
    month: Number(getPart('month')) || date.getMonth() + 1,
    day: Number(getPart('day')) || date.getDate(),
    weekday: getPart('weekday') || '',
    hours: Number(getPart('hour')) || 0,
    minutes: Number(getPart('minute')) || 0,
    seconds: Number(getPart('second')) || 0
  }
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

function pickCustomIconImage(): Promise<string | null> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.hidden = true

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      input.remove()
      window.removeEventListener('focus', handleWindowFocus)
    }

    const settle = (value: string | null) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }

    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) {
          settle(null)
        }
      }, 300)
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        settle(null)
        return
      }

      if (!file.type.startsWith('image/')) {
        fail(new Error('请选择图片文件。'))
        return
      }

      if (file.size > CUSTOM_ICON_MAX_BYTES) {
        fail(new Error('自定义图片不能超过 2MB。'))
        return
      }

      readFileAsDataUrl(file).then(settle, fail)
    })

    window.addEventListener('focus', handleWindowFocus)
    document.body.appendChild(input)
    input.click()
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const result = String(reader.result || '')
      if (!result.startsWith('data:image/')) {
        reject(new Error('图片读取失败，请换一张图片重试。'))
        return
      }
      resolve(result)
    })
    reader.addEventListener('error', () => {
      reject(new Error('图片读取失败，请换一张图片重试。'))
    })
    reader.readAsDataURL(file)
  })
}

function getFaviconUrl(url: string, bookmarkId = ''): string {
  const refreshToken = bookmarkId ? state.faviconRefreshTokens.get(bookmarkId) : 0
  const cacheSuffix = refreshToken ? `&refresh=${refreshToken}` : ''
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${FAVICON_SIZE}${cacheSuffix}`
}

function getFallbackLabel(title: string): string {
  const trimmed = title.trim()
  return (trimmed[0] || '*').toUpperCase()
}
