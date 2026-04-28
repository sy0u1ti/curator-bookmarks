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
  findBookmarksBar
} from '../shared/bookmark-tree.js'
import { appendRecycleEntry } from '../shared/recycle-bin.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'

const NEW_TAB_FOLDER_TITLE = '标签页'
const FAVICON_SIZE = 64
const CUSTOM_ICON_MAX_BYTES = 2 * 1024 * 1024
const BOOKMARK_DRAG_LONG_PRESS_MS = 320
const ICON_PAGE_WIDTH_REFERENCE_PX = 1920
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
  placeholder: '',
  width: 44,
  background: 58
}
const SUPPORTED_SEARCH_ENGINES = new Set(['default', 'google', 'bing', 'baidu', 'duckduckgo'])
const DEFAULT_ICON_SETTINGS = {
  pageWidth: 64,
  columnGap: 18,
  rowGap: 18
}
const DEFAULT_GENERAL_SETTINGS = {
  hideSettingsTrigger: false
}
const DEFAULT_TIME_SETTINGS = {
  enabled: true,
  showSeconds: false,
  hour12: false,
  clockSize: 100,
  dateFormat: 'month-day-weekday',
  timeZone: 'auto',
  displayMode: 'time-date'
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
  'weekday-day-month',
  'weekday-month-day',
  'month-day-weekday'
])

const state = {
  loading: true,
  creatingFolder: false,
  error: '',
  rootNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  bookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
  activeMenuBookmarkId: '',
  menuX: 0,
  menuY: 0,
  editTitle: '',
  editUrl: '',
  menuBusy: false,
  menuError: '',
  editIconMode: 'website',
  pendingCustomIconDataUrl: '',
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
  draggingBookmarkId: '',
  dragPointerId: 0,
  dragLongPressTimer: 0,
  dragClientX: 0,
  dragClientY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragOriginalOrderIds: [] as string[],
  dragSuppressClick: false,
  reorderingBookmarks: false,
  backgroundSettings: { ...DEFAULT_BACKGROUND_SETTINGS },
  searchSettings: { ...DEFAULT_SEARCH_SETTINGS },
  iconSettings: { ...DEFAULT_ICON_SETTINGS },
  generalSettings: { ...DEFAULT_GENERAL_SETTINGS },
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

document.addEventListener('DOMContentLoaded', () => {
  bindEvents()
  void preloadBackgroundSettings()
  void refreshNewTab()
})

function bindEvents(): void {
  bindGeneralSettingsEvents()
  bindBackgroundSettingsEvents()
  bindSearchSettingsEvents()
  bindIconSettingsEvents()
  bindTimeSettingsEvents()
  bindSettingsRangeVisuals()
  settingsTrigger?.addEventListener('click', openSettingsDrawer)
  settingsClose?.addEventListener('click', closeSettingsDrawer)
  settingsBackdrop?.addEventListener('click', closeSettingsDrawer)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSettingsDrawer()
      closeBookmarkMenu()
      closeAddBookmarkMenu()
    }
  })
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
  })

  root?.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (state.dragSuppressClick && target.closest('[data-bookmark-id]')) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (target.closest('[data-create-folder]')) {
      event.preventDefault()
      void createNewTabFolder()
    }
  })
  root?.addEventListener('pointerdown', handleBookmarkPointerDown)
  window.addEventListener('pointermove', handleBookmarkPointerMove)
  window.addEventListener('pointerup', (event) => {
    void finishBookmarkDrag(event)
  })
  window.addEventListener('pointercancel', () => {
    cancelBookmarkDrag()
  })
  root?.addEventListener('contextmenu', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (state.draggingBookmarkId || state.dragSuppressClick) {
      event.preventDefault()
      return
    }

    const bookmarkTarget = target.closest('[data-bookmark-id]')
    if (bookmarkTarget instanceof HTMLElement) {
      event.preventDefault()
      closeAddBookmarkMenu()
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
    closeBookmarkMenu()
    openAddBookmarkMenu(event.clientX, event.clientY)
  })

  chrome.bookmarks?.onCreated?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onRemoved?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onChanged?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onMoved?.addListener(handleBookmarksChanged)

  window.clearInterval(clockTimer)
  clockTimer = window.setInterval(updateClockText, 1000)
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
  document.getElementById('search-background')?.addEventListener('input', handleSearchSettingsChange)
}

function bindIconSettingsEvents(): void {
  document.getElementById('icon-page-width')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-column-gap')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-row-gap')?.addEventListener('input', handleIconSettingsChange)
}

function bindGeneralSettingsEvents(): void {
  document
    .getElementById('general-hide-settings-trigger')
    ?.addEventListener('change', handleGeneralSettingsChange)
}

function handleGeneralSettingsChange(): void {
  state.generalSettings = readGeneralSettingsFromControls()
  void saveGeneralSettings()
  syncGeneralSettingsControls()
  applyGeneralSettings()
}

function handleIconSettingsChange(): void {
  state.iconSettings = readIconSettingsFromControls()
  void saveIconSettings()
  render()
  syncIconSettingsControls()
  updateClockText()
}

function handleSearchSettingsChange(): void {
  state.searchSettings = readSearchSettingsFromControls()
  void saveSearchSettings()
  render()
  syncSearchSettingsControls()
  updateClockText()
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
    return
  }

  try {
    const previousSettings = state.backgroundSettings
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
  } catch (error) {
    console.error(error)
  }
}

async function handleBackgroundUrlCacheClick(): Promise<void> {
  if (state.backgroundUrlCacheBusy) {
    return
  }

  const imageUrl = normalizeBackgroundImageUrl(state.backgroundSettings.url)
  if (state.backgroundSettings.type !== 'urls' || !imageUrl) {
    return
  }

  state.backgroundUrlCacheBusy = true
  state.backgroundUrlCacheStatus = '请求授权...'
  syncBackgroundSettingsControls()
  try {
    const granted = await requestOriginPermission(imageUrl)
    if (!granted) {
      state.backgroundUrlCacheStatus = '未授权'
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
  } catch {
    state.backgroundUrlCacheStatus = '缓存失败'
    // 缓存失败时保持当前 URL 背景显示，不向扩展错误页写入噪音。
  } finally {
    state.backgroundUrlCacheBusy = false
    syncBackgroundSettingsControls()
  }
}

function handleTimeSettingsChange(): void {
  state.timeSettings = readTimeSettingsFromControls()
  void saveTimeSettings()
  render()
  syncTimeSettingsControls()
  updateClockText()
}

function openSettingsDrawer(): void {
  syncGeneralSettingsControls()
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
}

function closeSettingsDrawer(): void {
  settingsDrawer?.classList.remove('open')
  settingsBackdrop?.classList.remove('open')
  settingsDrawer?.setAttribute('aria-hidden', 'true')
  settingsTrigger?.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('settings-open')
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
  state.menuBusy = false
  state.menuError = ''
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

function closeBookmarkMenu(): void {
  state.activeMenuBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.pendingCustomIconDataUrl = ''
  document.querySelector('.bookmark-edit-menu')?.remove()
}

function closeAddBookmarkMenu(): void {
  state.addMenuOpen = false
  state.addMenuExpanded = false
  state.addMenuBusy = false
  state.addMenuError = ''
  document.querySelector('.bookmark-add-menu')?.remove()
}

function handleBookmarkPointerDown(event: PointerEvent): void {
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

  cancelBookmarkDrag({ keepSuppressClick: true })
  state.dragPointerId = event.pointerId
  state.draggingBookmarkId = bookmarkId
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
  state.dragOriginalOrderIds = state.bookmarks.map((bookmark) => String(bookmark.id))
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
  const finalOrderIds = state.bookmarks.map((bookmark) => String(bookmark.id))
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

  await persistBookmarkOrder(finalOrderIds)
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
  const tiles = Array.from(document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]'))
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
  const targetIndex = state.bookmarks.findIndex((bookmark) => String(bookmark.id) === bookmarkId)
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
  const currentIndex = state.bookmarks.findIndex(
    (bookmark) => String(bookmark.id) === state.draggingBookmarkId
  )
  if (currentIndex < 0) {
    return false
  }

  const nextBookmarks = [...state.bookmarks]
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
  state.bookmarks = nextBookmarks
  return true
}

async function persistBookmarkOrder(bookmarkIds: string[]): Promise<void> {
  const folderId = state.folderNode?.id
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

async function saveBookmarkMenuChanges(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  try {
    const title = state.editTitle.trim() || state.editUrl.trim()
    const url = normalizeBookmarkInputUrl(state.editUrl)
    state.menuBusy = true
    state.menuError = ''
    renderBookmarkMenu()

    await updateBookmark(bookmark.id, { title, url })
    await persistCustomIconChoice(bookmark.id)
    closeBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.menuBusy = false
    state.menuError = error instanceof Error ? error.message : '保存失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

async function deleteActiveMenuBookmark(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  try {
    state.menuBusy = true
    state.menuError = ''
    renderBookmarkMenu()

    await removeBookmark(bookmark.id)
    await appendRecycleEntry({
      recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      bookmarkId: String(bookmark.id),
      title: bookmark.title || '未命名书签',
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: NEW_TAB_FOLDER_TITLE,
      source: '新标签页删除',
      deletedAt: Date.now()
    })
    if (state.customIcons[bookmark.id]) {
      const nextIcons = { ...state.customIcons }
      delete nextIcons[bookmark.id]
      await saveCustomIcons(nextIcons)
    }

    closeBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.menuBusy = false
    state.menuError = error instanceof Error ? error.message : '删除失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

function refreshActiveMenuIcon(): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  state.faviconRefreshTokens.set(bookmark.id, Date.now())
  render()
  updateClockText()
  renderBookmarkMenu()
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
        STORAGE_KEYS.newTabTimeSettings
      ])
    ])
    const rootNode = tree[0] || null
    const folderNode = findNewTabFolder(rootNode)

    state.rootNode = rootNode
    state.folderNode = folderNode
    state.bookmarks = getDirectBookmarks(folderNode)
    state.customIcons = normalizeCustomIcons(stored[STORAGE_KEYS.newTabCustomIcons])
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
    syncTimeSettingsControls()
    updateAllSettingRangeVisuals()
    updateClockText()
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
    await createBookmark({
      parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
      title: NEW_TAB_FOLDER_TITLE
    })
    await refreshNewTab()
  } catch (error) {
    state.error = error instanceof Error ? error.message : '标签页文件夹创建失败，请稍后重试。'
    render()
  } finally {
    state.creatingFolder = false
    render()
  }
}

async function ensureNewTabFolder(): Promise<string> {
  if (state.folderNode?.id) {
    return String(state.folderNode.id)
  }

  const rootNode = state.rootNode || (await getBookmarkTree())[0] || null
  const existingFolder = findNewTabFolder(rootNode)
  if (existingFolder?.id) {
    state.folderNode = existingFolder
    return String(existingFolder.id)
  }

  const bookmarksBar = findBookmarksBar(rootNode)
  const createdFolder = await createBookmark({
    parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
    title: NEW_TAB_FOLDER_TITLE
  })
  state.folderNode = createdFolder
  return String(createdFolder.id)
}

function render(): void {
  if (!root) {
    return
  }

  root.replaceChildren()

  if (state.loading) {
    root.appendChild(createStateView('正在加载'))
    return
  }

  if (state.error) {
    root.appendChild(createStateView(state.error, '重新加载', () => {
      void refreshNewTab()
    }))
    return
  }

  if (!state.folderNode) {
    root.appendChild(createNewTabPage(createMissingFolderView()))
    return
  }

  if (!state.bookmarks.length) {
    root.appendChild(createNewTabPage(createStateView('“标签页”文件夹中还没有书签')))
    return
  }

  root.appendChild(createNewTabPage(createBookmarkGrid(state.bookmarks)))
}

function createNewTabPage(content: HTMLElement): HTMLElement {
  const page = document.createElement('main')
  page.className = 'newtab-page'

  const clock = createClockWidget()
  if (clock) {
    page.appendChild(clock)
  } else {
    const spacer = document.createElement('div')
    spacer.className = 'newtab-clock-spacer'
    page.appendChild(spacer)
  }

  const search = createSearchWidget()
  if (search) {
    page.classList.add('has-search')
    page.appendChild(search)
  }

  page.appendChild(content)
  return page
}

function createSearchWidget(): HTMLElement | null {
  const settings = state.searchSettings
  if (!settings.enabled) {
    return null
  }

  const slot = document.createElement('section')
  slot.className = 'newtab-search-slot'
  slot.setAttribute('aria-label', '搜索')

  const form = document.createElement('form')
  form.className = 'newtab-search'
  form.style.setProperty('--search-width', `${settings.width}vw`)
  form.style.setProperty('--search-bg-alpha', String(settings.background / 100))
  form.setAttribute('role', 'search')
  form.setAttribute('aria-label', '搜索')

  const input = document.createElement('input')
  input.className = 'newtab-search-input'
  input.type = 'search'
  input.autocomplete = 'off'
  input.enterKeyHint = 'search'
  input.placeholder = settings.placeholder
  input.spellcheck = false
  input.setAttribute('aria-label', settings.placeholder || '搜索')

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
  submitButton.setAttribute('aria-label', '搜索')

  const icon = document.createElement('span')
  icon.className = 'newtab-search-icon'
  icon.setAttribute('aria-hidden', 'true')
  submitButton.appendChild(icon)

  input.addEventListener('input', () => {
    const hasValue = Boolean(input.value)
    clearButton.classList.toggle('hidden', !hasValue)
    separator.classList.toggle('hidden', !hasValue)
  })
  clearButton.addEventListener('click', () => {
    input.value = ''
    clearButton.classList.add('hidden')
    separator.classList.add('hidden')
    input.focus()
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submitSearch(input.value)
  })

  form.append(input, clearButton, separator, submitButton)
  slot.appendChild(form)
  return slot
}

function createClockWidget(): HTMLElement | null {
  const settings = state.timeSettings
  if (!settings.enabled || settings.displayMode === 'none') {
    return null
  }

  const clock = document.createElement('section')
  clock.className = 'newtab-clock'
  clock.style.setProperty('--clock-scale', String(settings.clockSize / 100))
  clock.setAttribute('aria-label', '时间和日期')
  const now = new Date()

  if (settings.displayMode !== 'date') {
    const time = document.createElement('div')
    time.className = 'newtab-clock-time'
    time.dataset.clockTime = 'true'
    time.textContent = formatClockTime(now)
    clock.appendChild(time)
  }

  if (settings.displayMode !== 'time') {
    const date = document.createElement('div')
    date.className = 'newtab-clock-date'
    date.dataset.clockDate = 'true'
    date.textContent = formatClockDate(now)
    clock.appendChild(date)
  }

  return clock
}

function createMissingFolderView(): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state folder-missing'

  const button = document.createElement('button')
  button.className = 'newtab-button'
  button.type = 'button'
  button.dataset.createFolder = 'true'
  button.disabled = state.creatingFolder
  button.textContent = state.creatingFolder ? '正在创建' : '新增标签页文件夹'

  view.appendChild(button)
  return view
}

function createStateView(message: string, actionLabel = '', action?: () => void): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state'

  const copy = document.createElement('p')
  copy.textContent = message
  view.appendChild(copy)

  if (actionLabel && action) {
    const button = document.createElement('button')
    button.className = 'newtab-button secondary'
    button.type = 'button'
    button.textContent = actionLabel
    button.addEventListener('click', action)
    view.appendChild(button)
  }

  return view
}

function createBookmarkGrid(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-content'
  view.style.setProperty('--icon-page-width', `${getIconPageWidthPx(state.iconSettings.pageWidth)}px`)
  view.style.setProperty('--icon-column-gap', `${getIconGapPx(state.iconSettings.columnGap)}px`)
  view.style.setProperty('--icon-row-gap', `${getIconGapPx(state.iconSettings.rowGap)}px`)

  const list = document.createElement('nav')
  list.className = 'bookmark-grid'
  list.setAttribute('aria-label', '标签页书签')

  for (const bookmark of bookmarks) {
    const url = String(bookmark.url || '')
    const title = String(bookmark.title || '').trim() || url
    const item = document.createElement('a')
    item.className = 'bookmark-tile'
    item.href = url
    item.title = title
    item.draggable = false
    item.dataset.bookmarkId = String(bookmark.id)
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
    icon.loading = 'eager'
    icon.decoding = 'async'
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
    list.appendChild(item)
  }

  view.appendChild(list)
  return view
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
    if (!node.url && node.title === NEW_TAB_FOLDER_TITLE) {
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

function getDirectBookmarks(
  folderNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  return (folderNode?.children || []).filter((child) => Boolean(child.url))
}

function getBookmarkById(bookmarkId: string): chrome.bookmarks.BookmarkTreeNode | null {
  return state.bookmarks.find((bookmark) => String(bookmark.id) === String(bookmarkId)) || null
}

function getActiveMenuBookmark(): chrome.bookmarks.BookmarkTreeNode | null {
  return state.activeMenuBookmarkId ? getBookmarkById(state.activeMenuBookmarkId) : null
}

function renderBookmarkMenu({ focusFirst = true } = {}): void {
  document.querySelector('.bookmark-edit-menu')?.remove()

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
  actionList.append(
    createMenuAction('删除链接', 'trash', deleteActiveMenuBookmark),
    createMenuAction('Refresh icon', 'refresh', refreshActiveMenuIcon),
    createMenuAction('保存更改', 'save', saveBookmarkMenuChanges)
  )

  menu.append(titleField, urlField, iconRow, separator, actionList)

  if (state.menuError) {
    const error = document.createElement('p')
    error.className = 'bookmark-menu-error'
    error.textContent = state.menuError
    menu.appendChild(error)
  }

  document.body.appendChild(menu)
  positionBookmarkMenu(menu)

  const firstInput = menu.querySelector('input')
  if (focusFirst && firstInput instanceof HTMLInputElement) {
    firstInput.focus()
    firstInput.select()
  }
}

function renderAddBookmarkMenu({ focusFirst = true } = {}): void {
  document.querySelector('.bookmark-add-menu')?.remove()

  if (!state.addMenuOpen) {
    return
  }

  const menu = document.createElement('section')
  menu.className = `bookmark-add-menu ${state.addMenuExpanded ? 'expanded' : ''}`
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-label', '添加标签页书签')
  menu.style.left = `${state.addMenuX}px`
  menu.style.top = `${state.addMenuY}px`

  if (!state.addMenuExpanded) {
    const addButton = document.createElement('button')
    addButton.className = 'bookmark-add-trigger'
    addButton.type = 'button'
    addButton.append(createMenuActionIcon('plus'), document.createTextNode('添加标签页书签'))
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
    state.menuError = ''
    renderBookmarkMenu({ focusFirst: false })
    return
  }

  state.menuBusy = true
  state.menuError = ''
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
  icon: 'trash' | 'refresh' | 'save' | 'plus',
  action: () => void | Promise<void>,
  { disabled = state.menuBusy } = {}
): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = 'bookmark-menu-action'
  button.type = 'button'
  button.disabled = disabled
  button.append(createMenuActionIcon(icon), document.createTextNode(label))
  button.addEventListener('click', () => {
    void action()
  })
  return button
}

function createMenuActionIcon(icon: 'trash' | 'refresh' | 'save' | 'plus'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')

  const paths: Record<'trash' | 'refresh' | 'save' | 'plus', string[]> = {
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
  const placeholder = String(settings.placeholder || '').trim()
  return {
    enabled: settings.enabled !== false,
    openInNewTab: settings.openInNewTab === true,
    engine: SUPPORTED_SEARCH_ENGINES.has(String(settings.engine))
      ? String(settings.engine)
      : DEFAULT_SEARCH_SETTINGS.engine,
    placeholder,
    width: clampNumber(settings.width, 16, 72, DEFAULT_SEARCH_SETTINGS.width),
    background: clampNumber(settings.background, 36, 76, DEFAULT_SEARCH_SETTINGS.background)
  }
}

function readSearchSettingsFromControls(): typeof DEFAULT_SEARCH_SETTINGS {
  const enabledInput = document.getElementById('search-enabled')
  const openInput = document.getElementById('search-open-new-tab')
  const engineInput = document.getElementById('search-engine')
  const placeholderInput = document.getElementById('search-placeholder')
  const widthInput = document.getElementById('search-width')
  const backgroundInput = document.getElementById('search-background')

  return normalizeSearchSettings({
    enabled: enabledInput instanceof HTMLInputElement ? enabledInput.checked : state.searchSettings.enabled,
    openInNewTab: openInput instanceof HTMLInputElement ? openInput.checked : state.searchSettings.openInNewTab,
    engine: engineInput instanceof HTMLSelectElement ? engineInput.value : state.searchSettings.engine,
    placeholder: placeholderInput instanceof HTMLInputElement ? placeholderInput.value : state.searchSettings.placeholder,
    width: widthInput instanceof HTMLInputElement ? Number(widthInput.value) : state.searchSettings.width,
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

function normalizeGeneralSettings(rawSettings: unknown): typeof DEFAULT_GENERAL_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_GENERAL_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  return {
    hideSettingsTrigger: settings.hideSettingsTrigger === true
  }
}

function readGeneralSettingsFromControls(): typeof DEFAULT_GENERAL_SETTINGS {
  const hideInput = document.getElementById('general-hide-settings-trigger')

  return normalizeGeneralSettings({
    hideSettingsTrigger: hideInput instanceof HTMLInputElement
      ? hideInput.checked
      : state.generalSettings.hideSettingsTrigger
  })
}

function syncGeneralSettingsControls(): void {
  const hideInput = document.getElementById('general-hide-settings-trigger')

  if (hideInput instanceof HTMLInputElement) {
    hideInput.checked = state.generalSettings.hideSettingsTrigger
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

function normalizeIconSettings(rawSettings: unknown): typeof DEFAULT_ICON_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_ICON_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const legacySpacing = settings.spacing
  return {
    pageWidth: clampNumber(settings.pageWidth, 16, 100, DEFAULT_ICON_SETTINGS.pageWidth),
    columnGap: clampNumber(
      settings.columnGap ?? legacySpacing,
      0,
      100,
      DEFAULT_ICON_SETTINGS.columnGap
    ),
    rowGap: clampNumber(
      settings.rowGap ?? legacySpacing,
      0,
      100,
      DEFAULT_ICON_SETTINGS.rowGap
    )
  }
}

function readIconSettingsFromControls(): typeof DEFAULT_ICON_SETTINGS {
  const pageWidthInput = document.getElementById('icon-page-width')
  const columnGapInput = document.getElementById('icon-column-gap')
  const rowGapInput = document.getElementById('icon-row-gap')

  return normalizeIconSettings({
    pageWidth: pageWidthInput instanceof HTMLInputElement
      ? Number(pageWidthInput.value)
      : state.iconSettings.pageWidth,
    columnGap: columnGapInput instanceof HTMLInputElement
      ? Number(columnGapInput.value)
      : state.iconSettings.columnGap,
    rowGap: rowGapInput instanceof HTMLInputElement
      ? Number(rowGapInput.value)
      : state.iconSettings.rowGap
  })
}

function syncIconSettingsControls(): void {
  const settings = state.iconSettings
  const pageWidthInput = document.getElementById('icon-page-width')
  const columnGapInput = document.getElementById('icon-column-gap')
  const rowGapInput = document.getElementById('icon-row-gap')

  if (pageWidthInput instanceof HTMLInputElement) {
    pageWidthInput.value = String(settings.pageWidth)
  }
  if (columnGapInput instanceof HTMLInputElement) {
    columnGapInput.value = String(settings.columnGap)
  }
  if (rowGapInput instanceof HTMLInputElement) {
    rowGapInput.value = String(settings.rowGap)
  }
}

async function saveIconSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabIconSettings]: state.iconSettings
  })
}

function getIconPageWidthPx(pageWidth: number): number {
  return Math.round((clampNumber(pageWidth, 16, 100, DEFAULT_ICON_SETTINGS.pageWidth) / 100) * ICON_PAGE_WIDTH_REFERENCE_PX)
}

function getIconGapPx(spacing: number): number {
  return clampNumber(14 + spacing, 14, 114, 32)
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
}

async function saveTimeSettings(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabTimeSettings]: state.timeSettings
  })
}

function updateClockText(): void {
  const timeNode = document.querySelector('[data-clock-time]')
  const dateNode = document.querySelector('[data-clock-date]')
  if (!timeNode && !dateNode) {
    return
  }

  const now = new Date()
  if (timeNode) {
    timeNode.textContent = formatClockTime(now)
  }
  if (dateNode) {
    dateNode.textContent = formatClockDate(now)
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

function formatClockDate(date: Date): string {
  const settings = state.timeSettings
  const parts = getClockParts(date)
  const monthText = `${parts.month}月`
  const dayText = `${parts.day}日`

  switch (settings.dateFormat) {
    case 'weekday-day-month':
      return `${parts.weekday} ${dayText} ${monthText}`
    case 'weekday-month-day':
      return `${parts.weekday}, ${monthText} ${dayText}`
    case 'month-day-weekday':
    default:
      return `${monthText} ${dayText} ${parts.weekday}`
  }
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
