import {
  BOOKMARKS_BAR_ID,
  ROOT_ID,
  RECYCLE_BIN_LIMIT,
  STORAGE_KEYS,
  UNDO_WINDOW_MS
} from '../shared/constants.js'
import {
  extractBookmarkData,
  findBookmarksBar,
  findNodeById
} from '../shared/bookmark-tree.js'
import {
  displayUrl,
  extractDomain,
  normalizeText,
  normalizeUrl
} from '../shared/text.js'
import {
  createBookmark,
  createTab,
  getBookmarkTree,
  moveBookmark,
  removeBookmark,
  updateBookmark
} from '../shared/bookmarks-api.js'
import {
  appendRecycleEntry,
  removeRecycleEntry
} from '../shared/recycle-bin.js'
import { getLocalStorage, removeLocalStorage } from '../shared/storage.js'
import { requestBookmarkSave } from '../shared/messages.js'
import { loadBookmarkTagIndex, normalizeBookmarkTags } from '../shared/bookmark-tags.js'
import { renderDotMatrixLoader } from '../shared/dot-matrix-loader.js'
import {
  extractAiErrorMessage,
  extractChatCompletionsJsonText,
  extractResponsesJsonText,
  getAiEndpoint
} from '../shared/ai-response.js'
import { cancelExitMotion, closeWithExitMotion } from '../shared/motion.js'
import { normalizeAiNamingSettings } from '../options/sections/ai-settings.js'
import {
  buildFallbackPageContentFromUrl,
  buildJinaReaderUrl,
  buildPageContextForAi,
  buildRemotePageContentFromText,
  combinePageContentContexts,
  extractPageContentFromHtml,
  normalizePageContentContext
} from '../options/sections/content-extraction.js'
import {
  AI_NAMING_DEFAULT_TIMEOUT_MS,
  AI_NAMING_JINA_READER_ORIGIN
} from '../options/shared-options/constants.js'
import {
  MAX_POPUP_SEARCH_RESULTS,
  POPUP_SEARCH_ASYNC_THRESHOLD,
  getQueryTerms,
  indexBookmarkForSearch,
  normalizeQuery,
  searchBookmarks,
  searchBookmarksCooperatively,
  type PopupSearchResult
} from './search.js'
import {
  buildLocalNaturalSearchPlan,
  filterBookmarksByNaturalDateRange,
  getNaturalSearchStatusLabel,
  mergeNaturalSearchResultSets,
  normalizeNaturalSearchAiPlan,
  type NaturalSearchPlan,
  type NaturalSearchResultSet
} from './natural-search.js'
import { dom, cacheDom } from './dom.js'
import { state } from './state.js'

const SEARCH_DEBOUNCE_MS = 140
const NATURAL_SEARCH_DEBOUNCE_MS = 520
const SEARCH_CACHE_LIMIT = 40
const SMART_RECOMMENDATION_LIMIT = 3
const SMART_LOADING_STEP_COUNT = 3

const SMART_CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'content_type', 'topics', 'tags', 'aliases', 'confidence', 'existing_folders', 'new_folder'],
  properties: {
    title: { type: 'string', maxLength: 80 },
    summary: { type: 'string', maxLength: 500 },
    content_type: { type: 'string', maxLength: 40 },
    topics: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 40 }
    },
    tags: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 24 }
    },
    aliases: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', maxLength: 40 }
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    existing_folders: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['folder_path', 'reason', 'confidence'],
        properties: {
          folder_path: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    new_folder: {
      type: 'object',
      additionalProperties: false,
      required: ['folder_path', 'reason', 'confidence'],
      properties: {
        folder_path: { type: 'string' },
        reason: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    }
  }
}

const NATURAL_SEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['queries', 'keywords', 'excluded_terms', 'date_range', 'explanation'],
  properties: {
    queries: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string', maxLength: 80 }
    },
    keywords: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 40 }
    },
    excluded_terms: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 40 }
    },
    date_range: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'to', 'label'],
      properties: {
        from: { type: 'string', maxLength: 10 },
        to: { type: 'string', maxLength: 10 },
        label: { type: 'string', maxLength: 40 }
      }
    },
    explanation: { type: 'string', maxLength: 120 }
  }
} as const

document.addEventListener('DOMContentLoaded', () => {
  cacheDom()
  bindEvents()
  render()
  void showPendingAutoAnalyzeNotice()
  refreshData({ initial: true, preserveSearch: false }).finally(() => {
    if (!document.body.classList.contains('smart-active')) {
      dom.searchInput.focus()
    }
  })
})

function bindEvents() {
  dom.openSettings.addEventListener('click', openSettingsPage)
  dom.smartFooterSettings.addEventListener('click', openSettingsPage)
  dom.smartClassifier.addEventListener('click', handleSmartClassifierClick)
  dom.smartClassifier.addEventListener('input', handleSmartClassifierInput)
  dom.searchInput.addEventListener('input', () => {
    setSearchQuery(dom.searchInput.value)
  })

  dom.naturalSearchToggle.addEventListener('click', () => {
    void toggleNaturalLanguageSearch()
  })

  dom.clearSearch.addEventListener('click', () => {
    setSearchQuery('', { immediate: true })
    dom.searchInput.focus()
  })
  dom.folderFilterTrigger.addEventListener('click', openFilterDialog)
  dom.clearFolderFilter.addEventListener('click', clearFolderFilter)

  dom.content.addEventListener('click', handleContentClick)
  dom.content.addEventListener('pointerover', handleContentPointerOver)
  dom.filterFolderList.addEventListener('click', handleFilterListClick)
  dom.filterSearchInput.addEventListener('input', () => {
    state.filterSearchQuery = dom.filterSearchInput.value
    renderFilterModal()
  })
  dom.closeFilterModal.addEventListener('click', closeDialogs)
  dom.moveFolderList.addEventListener('click', handleMoveListClick)
  dom.moveSearchInput.addEventListener('input', () => {
    state.moveSearchQuery = dom.moveSearchInput.value
    renderMoveModal()
  })
  dom.closeMoveModal.addEventListener('click', closeDialogs)
  dom.smartFolderList.addEventListener('click', handleSmartFolderListClick)
  dom.smartFolderSearchInput.addEventListener('input', () => {
    state.smartFolderSearchQuery = dom.smartFolderSearchInput.value
    renderSmartFolderModal()
  })
  dom.closeSmartFolderModal.addEventListener('click', closeDialogs)
  dom.closeEditModal.addEventListener('click', closeDialogs)
  dom.cancelEdit.addEventListener('click', closeDialogs)
  dom.saveEdit.addEventListener('click', saveEditedBookmark)
  dom.editTitleInput.addEventListener('keydown', handleEditInputKeydown)
  dom.editUrlInput.addEventListener('keydown', handleEditInputKeydown)
  dom.cancelDelete.addEventListener('click', closeDialogs)
  dom.confirmDelete.addEventListener('click', confirmDeleteBookmark)
  dom.modalBackdrop.addEventListener('click', (event) => {
    if (event.target === dom.modalBackdrop) {
      closeDialogs()
    }
  })

  dom.toastRoot.addEventListener('click', handleToastClick)

  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
}

async function openSettingsPage() {
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('src/options/options.html#general')
    })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : '设置页打开失败，请稍后重试。'
    })
  }
}

async function openBookmarkHistoryPage() {
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('src/options/options.html#bookmark-history')
    })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : '添加历史打开失败，请稍后重试。'
    })
  }
}

async function showPendingAutoAnalyzeNotice() {
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.pendingAutoAnalyzeNotice])
    const notice = stored[STORAGE_KEYS.pendingAutoAnalyzeNotice]
    if (!notice || typeof notice !== 'object') {
      await clearActionBadge()
      return
    }

    const noticePayload = notice as Record<string, unknown>
    const folderPath = cleanSmartText(noticePayload.folderPath || '', 48)
    const bookmarkTitle = cleanSmartText(noticePayload.bookmarkTitle || '新增书签', 52)
    if (!folderPath) {
      await clearPendingAutoAnalyzeNotice()
      return
    }

    showToast({
      type: 'success',
      message: `已添加到 ${folderPath}：${bookmarkTitle}`,
      action: 'open-bookmark-history',
      actionLabel: '查看'
    })
    await clearPendingAutoAnalyzeNotice()
  } catch (error) {
  }
}

async function clearPendingAutoAnalyzeNotice() {
  await removeLocalStorage(STORAGE_KEYS.pendingAutoAnalyzeNotice)
  await clearActionBadge()
}

function clearActionBadge(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!chrome.action?.setBadgeText) {
      resolve()
      return
    }

    chrome.action.setBadgeText({ text: '' }, () => {
      resolve()
    })
  })
}

async function refreshData({ initial = false, preserveSearch = true } = {}) {
  state.isLoading = true
  state.loadError = ''
  state.activeMenuBookmarkId = null
  render()

  try {
    const tree = await getBookmarkTree()
    const rootNode = Array.isArray(tree) ? tree[0] : tree

    state.rawTreeRoot = rootNode
    state.bookmarksBarNode = findBookmarksBar(rootNode)

    const extracted = extractBookmarkData(rootNode)
    const tagIndex = await loadBookmarkTagIndex().catch(() => null)
    const tagRecords = tagIndex?.records || {}
    const indexedBookmarks = extracted.bookmarks.map((bookmark) => {
      return indexBookmarkForSearch(bookmark, tagRecords[bookmark.id] || null)
    })
    state.allBookmarks = indexedBookmarks
    state.allFolders = extracted.folders
    state.bookmarkMap = new Map(indexedBookmarks.map((bookmark) => [bookmark.id, bookmark]))
    state.folderMap = extracted.folderMap
    clearSearchCaches()
    await hydrateCurrentTabState()

    const folderIds = new Set(extracted.folders.map((folder) => folder.id))
    const defaultExpanded = getDefaultExpandedFolders(state.bookmarksBarNode)
    const allExpanded = new Set(extracted.folders.map((folder) => folder.id))

    if (state.selectedFolderFilterId && !folderIds.has(state.selectedFolderFilterId)) {
      state.selectedFolderFilterId = null
    }

    if (initial || state.expandedFolders.size === 0) {
      state.expandedFolders = defaultExpanded
    } else {
      state.expandedFolders = new Set(
        [...state.expandedFolders].filter((folderId) => folderIds.has(folderId))
      )
      if (!state.expandedFolders.size) {
        state.expandedFolders = defaultExpanded
      }
    }

    if (initial || state.moveExpandedFolders.size === 0) {
      state.moveExpandedFolders = allExpanded
    } else {
      state.moveExpandedFolders = new Set(
        [...state.moveExpandedFolders].filter((folderId) => folderIds.has(folderId))
      )
      if (!state.moveExpandedFolders.size) {
        state.moveExpandedFolders = allExpanded
      }
    }

    if (preserveSearch) {
      state.debouncedQuery = state.searchQuery.trim()
      runSearch()
    } else {
      state.searchRunId += 1
      state.searchQuery = ''
      state.debouncedQuery = ''
      state.searchResults = []
      state.activeResultIndex = 0
      state.searchPending = false
      state.naturalSearchPending = false
      state.naturalSearchError = ''
      state.naturalSearchPlan = null
      state.searchHighlightQuery = ''
      dom.searchInput.value = ''
    }
  } catch (error) {
    state.searchRunId += 1
    state.searchPending = false
    state.naturalSearchPending = false
    state.loadError = error instanceof Error ? error.message : '书签加载失败，请稍后重试。'
    state.searchResults = []
  } finally {
    state.isLoading = false
    render()
  }
}

async function hydrateCurrentTabState() {
  state.currentTab = await getActiveTab().catch(() => null)
  const currentUrl = String(state.currentTab?.url || '').trim()
  const normalizedCurrentUrl = normalizeUrl(currentUrl)
  const matchedBookmark = normalizedCurrentUrl
    ? state.allBookmarks.find((bookmark) => bookmark.normalizedUrl === normalizedCurrentUrl)
    : null

  state.currentPageBookmarkId = matchedBookmark?.id || null

  if (!isSmartClassifiableUrl(currentUrl)) {
    state.smartStatus = 'unavailable'
    state.smartRecommendations = []
    state.smartSelectedRecommendationId = ''
    return
  }

  if (!['loading', 'results', 'permission', 'saving'].includes(state.smartStatus)) {
    state.smartStatus = 'idle'
  }
}

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tabs?.[0] || null)
    })
  })
}

function setSearchQuery(value, { immediate = false } = {}) {
  state.searchQuery = value
  state.activeMenuBookmarkId = null

  if (dom.searchInput.value !== value) {
    dom.searchInput.value = value
  }

  clearTimeout(state.searchTimer)

  if (immediate) {
    state.debouncedQuery = value.trim()
    runSearch()
    render()
    return
  }

  const debounceMs = state.naturalSearchEnabled ? NATURAL_SEARCH_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS
  state.searchTimer = window.setTimeout(() => {
    state.debouncedQuery = value.trim()
    runSearch()
    render()
  }, debounceMs)

  render()
}

async function toggleNaturalLanguageSearch() {
  const enabled = !state.naturalSearchEnabled
  state.naturalSearchEnabled = enabled
  state.naturalSearchPending = false
  state.naturalSearchError = ''
  state.naturalSearchPlan = null
  state.searchHighlightQuery = ''
  state.searchRunId += 1
  render()

  if (enabled) {
    await prepareNaturalLanguageSearchAi()
  } else {
    showToast({ type: 'success', message: '已切回关键词搜索。' })
  }

  if (state.naturalSearchEnabled !== enabled) {
    return
  }

  setSearchQuery(state.searchQuery, { immediate: true })
  dom.searchInput.focus()
}

async function prepareNaturalLanguageSearchAi() {
  try {
    const settings = await loadAiProviderSettings()
    validateSmartAiSettings(settings)
    await ensureSmartClassifyPermissions(settings, { interactive: true })
    showToast({ type: 'success', message: '自然语言搜索已开启，可使用 AI 理解查询。' })
  } catch (error) {
    state.naturalSearchError = 'AI 未就绪，当前使用本地自然语言解析。'
    const detail = isSmartPermissionRequiredError(error)
      ? '未完成 AI 渠道授权。'
      : error instanceof Error
        ? error.message
        : ''
    showToast({
      type: 'error',
      message: detail
        ? `自然语言搜索已开启，本地解析生效：${detail}`
        : '自然语言搜索已开启，本地解析生效。'
    })
  }
}

function runSearch() {
  const query = state.debouncedQuery
  const normalizedQuery = normalizeQuery(query)
  const runId = state.searchRunId + 1
  state.searchRunId = runId
  state.searchHighlightQuery = normalizedQuery
  state.naturalSearchError = ''

  if (!normalizedQuery) {
    state.searchResults = []
    state.activeResultIndex = 0
    state.searchPending = false
    state.naturalSearchPending = false
    state.naturalSearchPlan = null
    return
  }

  if (state.naturalSearchEnabled) {
    runNaturalSearch(query, normalizedQuery, runId)
    return
  }

  state.naturalSearchPending = false
  state.naturalSearchPlan = null

  try {
    const cacheKey = getSearchCacheKey(normalizedQuery)
    const cachedResults = state.searchCache.get(cacheKey)
    const bookmarks = getFilteredBookmarks()

    if (cachedResults) {
      state.searchPending = false
      state.searchResults = cachedResults.slice(0, MAX_POPUP_SEARCH_RESULTS)
      state.activeResultIndex = Math.min(
        state.activeResultIndex,
        Math.max(state.searchResults.length - 1, 0)
      )
      return
    }

    if (bookmarks.length < POPUP_SEARCH_ASYNC_THRESHOLD) {
      const results = searchBookmarks(normalizedQuery, bookmarks)
      cacheSearchResults(cacheKey, results)
      state.searchPending = false
      state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
      state.activeResultIndex = Math.min(
        state.activeResultIndex,
        Math.max(state.searchResults.length - 1, 0)
      )
      return
    }

    state.searchPending = true
    state.searchResults = []
    state.activeResultIndex = 0

    searchBookmarksCooperatively(normalizedQuery, bookmarks, {
      isActive: () => state.searchRunId === runId,
      yieldWork
    })
      .then((results) => {
        if (state.searchRunId !== runId) {
          return
        }

        cacheSearchResults(cacheKey, results)
        state.searchPending = false
        state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
        state.activeResultIndex = Math.min(
          state.activeResultIndex,
          Math.max(state.searchResults.length - 1, 0)
        )
        render()
      })
      .catch((error) => {
        if (state.searchRunId !== runId) {
          return
        }

        state.searchPending = false
        state.searchResults = []
        state.loadError = error instanceof Error ? error.message : '查询失败，请重试。'
        render()
      })
  } catch (error) {
    state.searchPending = false
    state.searchResults = []
    state.loadError = error instanceof Error ? error.message : '查询失败，请重试。'
  }
}

async function runNaturalSearch(query, normalizedQuery, runId) {
  const cacheKey = getSearchCacheKey(`natural:${getNaturalSearchDateBucket()}:${normalizedQuery}`)
  const planCacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const cachedResults = state.searchCache.get(cacheKey)

  if (cachedResults) {
    const cachedPlan = state.naturalSearchPlanCache.get(planCacheKey) || buildLocalNaturalSearchPlan(query)
    state.naturalSearchPlan = cachedPlan
    state.searchHighlightQuery = cachedPlan.highlightQuery || normalizedQuery
    state.searchPending = false
    state.naturalSearchPending = false
    state.searchResults = cachedResults.slice(0, MAX_POPUP_SEARCH_RESULTS)
    state.activeResultIndex = Math.min(
      state.activeResultIndex,
      Math.max(state.searchResults.length - 1, 0)
    )
    return
  }

  state.searchPending = true
  state.naturalSearchPending = true
  state.searchResults = []
  state.activeResultIndex = 0

  try {
    const plan = await resolveNaturalSearchPlan(query, normalizedQuery)
    if (state.searchRunId !== runId) {
      return
    }

    state.naturalSearchPlan = plan
    state.searchHighlightQuery = plan.highlightQuery || normalizedQuery

    const bookmarks = filterBookmarksByNaturalDateRange(getFilteredBookmarks(), plan)
    const resultSets: NaturalSearchResultSet[] = []
    for (const naturalQuery of plan.queries) {
      if (state.searchRunId !== runId) {
        return
      }

      const results = await searchNaturalQuery(naturalQuery, bookmarks, runId)
      resultSets.push({ query: naturalQuery, results })
    }

    if (state.searchRunId !== runId) {
      return
    }

    const results = mergeNaturalSearchResultSets(plan, resultSets)
    cacheSearchResults(cacheKey, results)
    state.searchPending = false
    state.naturalSearchPending = false
    state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
    state.activeResultIndex = Math.min(
      state.activeResultIndex,
      Math.max(state.searchResults.length - 1, 0)
    )
    render()
  } catch (error) {
    if (state.searchRunId !== runId || (error instanceof Error && error.message === 'search-cancelled')) {
      return
    }

    state.searchPending = false
    state.naturalSearchPending = false
    state.searchResults = []
    state.loadError = error instanceof Error ? error.message : '自然语言搜索失败，请重试。'
    render()
  }
}

async function resolveNaturalSearchPlan(query, normalizedQuery): Promise<NaturalSearchPlan> {
  const cacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const cachedPlan = state.naturalSearchPlanCache.get(cacheKey)
  if (cachedPlan) {
    return cachedPlan
  }

  const localPlan = buildLocalNaturalSearchPlan(query)
  let plan = localPlan

  try {
    plan = await requestNaturalSearchAiPlan(query, localPlan)
    state.naturalSearchError = ''
  } catch (error) {
    state.naturalSearchError = normalizeNaturalSearchError(error)
  }

  state.naturalSearchPlanCache.set(cacheKey, plan)
  if (state.naturalSearchPlanCache.size > SEARCH_CACHE_LIMIT) {
    const oldestKey = state.naturalSearchPlanCache.keys().next().value
    if (oldestKey) {
      state.naturalSearchPlanCache.delete(oldestKey)
    }
  }

  return plan
}

async function searchNaturalQuery(query, bookmarks, runId): Promise<PopupSearchResult[]> {
  if (!query || !bookmarks.length) {
    return []
  }

  if (bookmarks.length < POPUP_SEARCH_ASYNC_THRESHOLD) {
    return searchBookmarks(query, bookmarks)
  }

  return searchBookmarksCooperatively(query, bookmarks, {
    isActive: () => state.searchRunId === runId,
    yieldWork
  })
}

function render() {
  renderBanner()
  renderToolbar()
  renderFilterBar()
  renderSmartClassifier()
  renderMainContent()
  renderFilterModal()
  renderMoveModal()
  renderSmartFolderModal()
  renderEditModal()
  renderDeleteModal()
  renderToasts()
}

function renderBanner() {
  dom.heroSubtitle.textContent = state.loadError
    ? '读取失败时不会上传数据，请检查扩展权限后重试'
    : '本地读取，不上传任何书签内容'

  dom.errorBanner.textContent = state.loadError
  dom.errorBanner.classList.toggle('hidden', !state.loadError)
  dom.clearSearch.classList.toggle('hidden', !state.searchQuery)
  dom.searchInput.placeholder = state.naturalSearchEnabled
    ? '自然语言搜索书签'
    : '搜索书签或网址'
  dom.naturalSearchToggle.classList.toggle('active', state.naturalSearchEnabled)
  dom.naturalSearchToggle.classList.toggle('pending', state.naturalSearchPending)
  dom.naturalSearchToggle.setAttribute('aria-pressed', String(state.naturalSearchEnabled))
  dom.naturalSearchToggle.setAttribute(
    'aria-label',
    state.naturalSearchEnabled ? '关闭自然语言搜索' : '开启自然语言搜索'
  )
  dom.naturalSearchToggle.title = state.naturalSearchEnabled
    ? '关闭自然语言搜索'
    : '开启自然语言搜索'
}

function renderToolbar() {
  if (state.debouncedQuery) {
    if (state.naturalSearchEnabled) {
      const statusLabel = state.naturalSearchPending
        ? '自然语言解析中…'
        : getNaturalSearchStatusLabel(state.naturalSearchPlan)
      const errorHint = state.naturalSearchError ? ' · 本地回退' : ''
      dom.viewCaption.textContent = state.searchPending
        ? statusLabel
        : `${statusLabel}${errorHint} · ${state.searchResults.length} 条`
      return
    }

    dom.viewCaption.textContent = state.searchPending
      ? '搜索中…'
      : `搜索结果 · ${state.searchResults.length} 条`
    return
  }

  const currentRoot = getCurrentTreeRoot()
  dom.viewCaption.textContent = currentRoot?.title || '书签栏'
}

function renderFilterBar() {
  const selectedFolder = state.selectedFolderFilterId
    ? state.folderMap.get(state.selectedFolderFilterId)
    : null

  dom.folderFilterTrigger.textContent = selectedFolder
    ? `文件夹：${selectedFolder.path || selectedFolder.title}`
    : '全部文件夹'
  dom.folderFilterTrigger.title = selectedFolder?.path || ''
  dom.clearFolderFilter.classList.toggle('hidden', !selectedFolder)
}

function renderSmartClassifier() {
  const currentUrl = String(state.currentTab?.url || '').trim()
  const smartAvailable = isSmartClassifiableUrl(currentUrl)
  const smartOverlayActive =
    smartAvailable && ['loading', 'results', 'error', 'permission'].includes(state.smartStatus)

  document.body.classList.toggle('smart-active', smartOverlayActive)
  dom.smartClassifier.classList.toggle('hidden', !smartAvailable)
  dom.smartFooter.classList.toggle('hidden', !smartOverlayActive)
  dom.smartTotal.textContent = `总计 ${state.allBookmarks.length}`

  if (!smartAvailable) {
    return
  }

  if (state.isLoading && state.smartStatus !== 'results') {
    dom.smartClassifier.innerHTML = `<div class="state-panel">${renderPopupLoadingStack('正在读取当前网页…')}</div>`
    return
  }

  if (state.smartStatus === 'loading') {
    const currentProgress = readSmartProgressPercent()
    dom.smartClassifier.innerHTML = renderSmartLoadingCard(currentProgress)
    animateSmartProgress()
    return
  }

  if (state.smartStatus === 'results') {
    dom.smartClassifier.innerHTML = renderSmartResultCard()
    return
  }

  if (state.smartStatus === 'error') {
    dom.smartClassifier.innerHTML = `
      ${renderSmartPageCard()}
      <div class="smart-panel-head smart-panel-head-standalone">
        <p>智能分类失败</p>
        ${renderSmartExitButton()}
      </div>
      <div class="error-banner">${escapeHtml(state.smartError || '智能分类失败，请稍后重试。')}</div>
      ${renderSmartManualButton()}
    `
    return
  }

  if (state.smartStatus === 'permission') {
    dom.smartClassifier.innerHTML = renderSmartPermissionCard()
    return
  }

  dom.smartClassifier.innerHTML = renderSmartPageCard()
}

function renderSmartPageCard() {
  const title = getCurrentPageTitle()
  const favicon = String(state.currentTab?.favIconUrl || '')

  return `
    <article class="smart-page-card">
      <div class="smart-page-main">
        <span class="smart-page-icon" aria-hidden="true">
          ${favicon ? `<img src="${escapeAttr(favicon)}" alt="">` : escapeHtml(getSmartFallbackIconLabel(title))}
        </span>
        <div class="smart-page-copy">
          <p class="smart-page-title" title="${escapeAttr(title)}">${escapeHtml(title)}</p>
        </div>
      </div>
      <button class="smart-classify-button" type="button" data-smart-action="classify">
        智能分类
      </button>
    </article>
  `
}

function renderSmartExitButton() {
  return `
    <button class="smart-exit-button" type="button" data-smart-action="exit" aria-label="退出智能分类">
      退出
    </button>
  `
}

function renderSmartManualButton() {
  return `
    <button class="smart-manual-button" type="button" data-smart-action="manual-folder">
      <span class="smart-folder-icon" aria-hidden="true"></span>
      <span>手动选择文件夹</span>
    </button>
  `
}

function renderSmartPermissionCard() {
  const origins = Array.isArray(state.smartPermissionRequest?.origins)
    ? state.smartPermissionRequest.origins
    : []

  return `
    <article class="smart-permission-card">
      <div class="smart-panel-head">
        <p>需要授权 AI 渠道</p>
        ${renderSmartExitButton()}
      </div>
      <div class="smart-permission-body">
        <p class="smart-permission-copy">
          智能分类需要访问你配置的 AI 服务地址。当前网页不会申请额外权限，正文读取失败时会用标题和 URL 继续推荐。
        </p>
        ${
          origins.length
            ? `<div class="smart-permission-origins">${origins
                .map((origin) => `<span>${escapeHtml(formatPermissionOrigin(origin))}</span>`)
                .join('')}</div>`
            : ''
        }
        ${
          state.smartError
            ? `<p class="smart-permission-error">${escapeHtml(state.smartError)}</p>`
            : ''
        }
      </div>
      <div class="smart-actions">
        <button class="smart-cancel-button" type="button" data-smart-action="manual-folder">
          手动选择
        </button>
        <button class="smart-classify-button" type="button" data-smart-action="grant-permission">
          授权并继续
        </button>
      </div>
    </article>
  `
}

function renderPopupLoadingStack(label) {
  return `
    <span class="popup-loading-stack">
      ${renderDotMatrixLoader({ variant: 'spiral', className: 'popup-loading-loader' })}
      <span>${escapeHtml(label)}</span>
    </span>
  `
}

function renderButtonLoadingLabel(label) {
  return `
    <span class="button-loading-label">
      ${renderDotMatrixLoader({ variant: 'bar', className: 'button-dot-loader' })}
      <span>${escapeHtml(label)}</span>
    </span>
  `
}

function renderSmartLoadingCard(currentProgress = state.smartProgressPercent) {
  const step = Math.max(1, Math.min(state.smartStep || 1, SMART_LOADING_STEP_COUNT))
  const progress = getSmartProgressTarget()
  const startProgress = Math.max(0, Math.min(Number(currentProgress) || 0, progress))

  return `
    <article class="smart-loading-card">
      <div class="smart-panel-head">
        <p>智能分类</p>
        ${renderSmartExitButton()}
      </div>
      <div class="smart-loading-body">
        ${renderDotMatrixLoader({ variant: 'spiral', className: 'smart-loading-loader' })}
        <div class="smart-loading-content">
          <p class="smart-loading-copy">
            <span>${escapeHtml(getSmartLoadingLabel())}</span>
            <small>${step}/${SMART_LOADING_STEP_COUNT}</small>
          </p>
          <div class="smart-progress-track" aria-hidden="true">
            <span
              class="smart-progress-bar"
              data-smart-progress-target="${escapeAttr(String(progress))}"
              style="width: ${startProgress}%"
            ></span>
          </div>
        </div>
      </div>
    </article>
  `
}

function animateSmartProgress() {
  const progressBar = dom.smartClassifier.querySelector<HTMLElement>('.smart-progress-bar')
  if (!progressBar) {
    return
  }

  const targetProgress = Math.max(
    0,
    Math.min(Number(progressBar.getAttribute('data-smart-progress-target')) || 0, 100)
  )

  window.requestAnimationFrame(() => {
    progressBar.style.width = `${targetProgress}%`
    state.smartProgressPercent = targetProgress
  })
}

function readSmartProgressPercent() {
  const track = dom.smartClassifier.querySelector('.smart-progress-track')
  const progressBar = dom.smartClassifier.querySelector('.smart-progress-bar')
  if (!track || !progressBar) {
    return state.smartProgressPercent
  }

  const trackWidth = track.getBoundingClientRect().width
  if (!trackWidth) {
    return state.smartProgressPercent
  }

  return Math.max(0, Math.min((progressBar.getBoundingClientRect().width / trackWidth) * 100, 100))
}

function renderSmartResultCard() {
  const selectedId = state.smartSelectedRecommendationId
  const recommendations = state.smartRecommendations || []
  const canSave = Boolean(recommendations.length && !state.smartSaving && !state.smartSaved)

  return `
    <article class="smart-result-card">
      <div class="smart-panel-head">
        <p>推荐文件夹</p>
        ${renderSmartExitButton()}
      </div>
      <div class="smart-title-row">
        <input
          id="smart-title-input"
          class="smart-title-input"
          type="text"
          spellcheck="false"
          maxlength="180"
          value="${escapeAttr(state.smartSuggestedTitle || getCurrentPageTitle())}"
          aria-label="推荐书签标题"
        >
        <span class="smart-edit-indicator" aria-hidden="true"></span>
      </div>

      <p class="smart-section-label">推荐文件夹</p>
      <div class="smart-recommendations">
        ${
          recommendations.length
            ? recommendations.map((recommendation) => renderSmartRecommendation(recommendation, selectedId)).join('')
            : '<div class="state-panel compact">未生成可用推荐，请手动选择文件夹。</div>'
        }
      </div>

      <div class="smart-actions">
        <button class="smart-cancel-button" type="button" data-smart-action="reset">取消</button>
        <button class="smart-save-button ${state.smartSaved ? 'saved' : ''}" type="button" data-smart-action="save" ${canSave ? '' : 'disabled'}>
          ${state.smartSaved ? '已保存' : state.smartSaving ? renderButtonLoadingLabel('保存中') : '确认保存'}
        </button>
      </div>
    </article>
    ${renderSmartManualButton()}
  `
}

function renderSmartRecommendation(recommendation, selectedId) {
  const isSelected = recommendation.id === selectedId
  const confidence = Math.round(Math.max(0, Math.min(Number(recommendation.confidence) || 0, 1)) * 100)
  const path = recommendation.path || recommendation.title || ''

  return `
    <button
      class="smart-folder-option ${isSelected ? 'selected' : ''}"
      type="button"
      data-smart-recommendation="${escapeAttr(recommendation.id)}"
    >
      <span class="smart-folder-main">
        <span class="smart-folder-head">
          <span class="smart-folder-icon" aria-hidden="true"></span>
          <span class="smart-folder-name">${escapeHtml(recommendation.title || path || '未命名文件夹')}</span>
        </span>
        <span class="smart-folder-path">${escapeHtml(formatSmartFolderPath(path))}</span>
      </span>
      <span class="smart-folder-meta">
        ${recommendation.kind === 'new' ? '<span class="smart-new-badge">新建</span>' : ''}
        ${isSelected ? '<span class="smart-checkmark">✓</span>' : ''}
        <span>${escapeHtml(String(confidence))}%</span>
      </span>
    </button>
  `
}

function renderMainContent() {
  const hasQuery = Boolean(state.debouncedQuery)
  const showSearchLoading =
    hasQuery &&
    state.searchPending &&
    !state.searchResults.length &&
    !state.isLoading
  const showEmptySearch =
    hasQuery &&
    !state.searchPending &&
    !state.searchResults.length &&
    !state.isLoading
  const currentRoot = getCurrentTreeRoot()
  const showEmptyTree =
    !hasQuery &&
    !state.isLoading &&
    (!currentRoot || !(currentRoot.children || []).length)

  dom.loadingState.classList.toggle('hidden', !(state.isLoading || showSearchLoading))
  dom.content.classList.toggle('hidden', state.isLoading || showSearchLoading || showEmptySearch || showEmptyTree)
  dom.emptyState.classList.toggle('hidden', !(showEmptySearch || showEmptyTree))

  if (showEmptySearch) {
    if (state.naturalSearchEnabled) {
      dom.emptyState.textContent = state.selectedFolderFilterId
        ? '当前文件夹筛选下未找到符合自然语言条件的书签'
        : '未找到符合自然语言条件的书签'
    } else {
      dom.emptyState.textContent = state.selectedFolderFilterId
        ? '当前文件夹筛选下未找到相关书签'
        : '未找到相关书签'
    }
  } else if (showEmptyTree) {
    dom.emptyState.textContent = state.selectedFolderFilterId
      ? '当前筛选文件夹下暂无可展示内容'
      : '未找到可展示的书签栏内容'
  }

  if (state.isLoading) {
    dom.loadingState.innerHTML = renderPopupLoadingStack('正在加载书签…')
    return
  }

  if (showSearchLoading) {
    dom.loadingState.innerHTML = renderPopupLoadingStack(
      state.naturalSearchEnabled ? '正在理解搜索意图…' : '正在搜索书签…'
    )
    return
  }

  replaceContentHtml(hasQuery ? renderSearchResults() : renderTreeView(), {
    preserveScroll: !hasQuery
  })
  updateActiveResultVisibility()
}

function replaceContentHtml(nextHtml, { preserveScroll = false } = {}) {
  if (state.contentRenderHtml === nextHtml) {
    return
  }

  const previousScrollTop = dom.content.scrollTop
  state.contentRenderHtml = nextHtml
  dom.content.innerHTML = nextHtml

  if (preserveScroll) {
    dom.content.scrollTop = previousScrollTop
  }
}

function renderTreeView() {
  const currentRoot = getCurrentTreeRoot()
  if (!currentRoot) {
    return ''
  }

  return renderFolderNode(currentRoot, 0)
}

function renderFolderNode(node, depth) {
  const currentRoot = getCurrentTreeRoot()
  const isPinnedRoot = depth === 0 && currentRoot?.id === node.id
  const isExpanded =
    isPinnedRoot || state.expandedFolders.has(node.id)
  const children = Array.isArray(node.children) ? node.children : []
  const folderInfo = state.folderMap.get(node.id)
  const childMarkup = isExpanded
    ? children
        .map((child) => {
          if (child.url) {
            const bookmark = state.bookmarkMap.get(child.id)
            return bookmark ? renderBookmarkRow(bookmark, depth + 1) : ''
          }

          return renderFolderNode(child, depth + 1)
        })
        .join('')
    : ''

  const toggleMarkup = isPinnedRoot
    ? '<span class="tree-toggle-spacer" aria-hidden="true"></span>'
    : `
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        data-toggle-folder="${escapeAttr(node.id)}"
        aria-label="${isExpanded ? '折叠文件夹' : '展开文件夹'}"
      ></button>
    `

  const cardMarkup = isPinnedRoot
    ? `
      <div class="folder-card root-folder-card">
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(node.title || '未命名文件夹')}</span>
          <span class="row-subtitle">${escapeHtml(describeFolder(folderInfo))}</span>
        </span>
      </div>
    `
    : `
      <button
        class="folder-card"
        type="button"
        data-toggle-folder="${escapeAttr(node.id)}"
        aria-expanded="${isExpanded}"
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(node.title || '未命名文件夹')}</span>
          <span class="row-subtitle">${escapeHtml(describeFolder(folderInfo))}</span>
        </span>
      </button>
    `

  return `
    <div class="tree-row folder-row ${isPinnedRoot ? 'root-folder-row' : ''}" style="--depth:${depth}">
      ${toggleMarkup}
      ${cardMarkup}
    </div>
    ${childMarkup}
  `
}

function renderBookmarkRow(bookmark, depth) {
  return `
    <div class="tree-row bookmark-row" style="--depth:${depth}">
      <button class="bookmark-card" type="button" data-open-bookmark="${escapeAttr(bookmark.id)}">
        <span class="bookmark-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(bookmark.title)}</span>
          <span class="row-subtitle" title="${escapeAttr(bookmark.url)}">${escapeHtml(bookmark.displayUrl)}</span>
        </span>
      </button>
      <div class="menu-anchor">
        <button class="icon-button" type="button" data-open-menu="${escapeAttr(bookmark.id)}" aria-label="打开操作菜单"></button>
        ${renderActionMenu(bookmark.id)}
      </div>
    </div>
  `
}

function renderSearchResults() {
  return state.searchResults
    .map((bookmark, index) => {
      const isActive = index === state.activeResultIndex
      const matchReason = Array.isArray(bookmark.matchReasons) && bookmark.matchReasons.length
        ? bookmark.matchReasons.join(' · ')
        : ''

      return `
        <article class="result-card ${isActive ? 'active' : ''}" data-result-index="${index}">
          <button class="result-main" type="button" data-open-bookmark="${escapeAttr(bookmark.id)}">
            <span class="bookmark-kind" aria-hidden="true"></span>
            <span class="result-copy">
              <span class="result-title">${highlightText(bookmark.title, state.searchHighlightQuery || state.debouncedQuery)}</span>
              <span class="result-url" title="${escapeAttr(bookmark.url)}">${highlightText(bookmark.displayUrl, state.searchHighlightQuery || state.debouncedQuery)}</span>
              <span class="result-path-shell">
                <span
                  class="result-path"
                  title="${escapeAttr(bookmark.path || '未归档路径')}"
                >${escapeHtml(bookmark.path || '未归档路径')}</span>
              </span>
              ${matchReason
                ? `<span class="result-match-reason" title="${escapeAttr(matchReason)}">${escapeHtml(matchReason)}</span>`
                : ''}
            </span>
          </button>
          <div class="menu-anchor">
            <button class="icon-button" type="button" data-open-menu="${escapeAttr(bookmark.id)}" aria-label="打开操作菜单"></button>
            ${renderActionMenu(bookmark.id)}
          </div>
        </article>
      `
    })
    .join('')
}

function renderActionMenu(bookmarkId) {
  if (state.activeMenuBookmarkId !== bookmarkId) {
    return ''
  }

  return `
    <div class="action-menu" role="menu">
      <button type="button" data-menu-action="edit" data-bookmark-id="${escapeAttr(bookmarkId)}">编辑</button>
      <button type="button" data-menu-action="move" data-bookmark-id="${escapeAttr(bookmarkId)}">移动至</button>
      <button class="danger" type="button" data-menu-action="delete" data-bookmark-id="${escapeAttr(bookmarkId)}">删除</button>
    </div>
  `
}

function setPopupSurfaceOpen(element, open) {
  if (!element) {
    return
  }

  if (open) {
    cancelExitMotion(element)
    element.classList.remove('hidden', 'is-closing')
    return
  }

  if (element.classList.contains('hidden') || element.classList.contains('is-closing')) {
    return
  }

  void closeWithExitMotion(element, 'is-closing', () => {
    element.classList.add('hidden')
  }, 220)
}

function renderFilterModal() {
  setPopupSurfaceOpen(dom.filterModal, state.isFilterPickerOpen)

  if (!state.isFilterPickerOpen) {
    syncBackdropVisibility()
    return
  }

  dom.filterSearchInput.value = state.filterSearchQuery
  dom.filterFolderList.innerHTML = renderFilterFolderList()
  syncBackdropVisibility()
}

function renderMoveModal() {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  setPopupSurfaceOpen(dom.moveModal, isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.moveBookmarkTitle.textContent = bookmark.title
  dom.moveBookmarkPath.textContent = bookmark.path || '未归档路径'
  dom.moveSearchInput.value = state.moveSearchQuery
  dom.moveFolderList.innerHTML = renderMoveFolderList(bookmark)
  syncBackdropVisibility()
}

function renderSmartFolderModal() {
  setPopupSurfaceOpen(dom.smartFolderModal, state.smartFolderPickerOpen)

  if (!state.smartFolderPickerOpen) {
    syncBackdropVisibility()
    return
  }

  dom.smartFolderPageTitle.textContent = state.smartSuggestedTitle || getCurrentPageTitle()
  dom.smartFolderPageUrl.textContent = displayUrl(state.currentTab?.url || '')
  dom.smartFolderSearchInput.value = state.smartFolderSearchQuery
  dom.smartFolderList.innerHTML = renderSmartFolderList()
  syncBackdropVisibility()
}

function renderEditModal() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  setPopupSurfaceOpen(dom.editModal, isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.editBookmarkPath.textContent = bookmark.path || '未归档路径'
  dom.editTitleInput.value = bookmark.title
  dom.editUrlInput.value = bookmark.url
  syncBackdropVisibility()
}

function renderDeleteModal() {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  setPopupSurfaceOpen(dom.deleteModal, isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.deleteBookmarkTitle.textContent = bookmark.title
  dom.deleteBookmarkPath.textContent = bookmark.path || '未归档路径'
  syncBackdropVisibility()
}

function syncBackdropVisibility() {
  const hasOpenModal = Boolean(
    state.isFilterPickerOpen ||
      state.moveTargetBookmarkId ||
      state.smartFolderPickerOpen ||
      state.editTargetBookmarkId ||
      state.confirmDeleteBookmarkId
  )
  dom.modalBackdrop.setAttribute('aria-hidden', String(!hasOpenModal))
  setPopupSurfaceOpen(dom.modalBackdrop, hasOpenModal)
}

function renderFilterFolderList() {
  const query = normalizeText(state.filterSearchQuery)
  const folders = query
    ? state.allFolders.filter((folder) => {
        return (
          folder.normalizedTitle.includes(query) ||
          folder.normalizedPath.includes(query)
        )
      })
    : state.allFolders

  const folderItems = folders
    .map((folder) => {
      const isSelected = state.selectedFolderFilterId === folder.id
      return `
        <button
          class="filter-option ${isSelected ? 'selected' : ''}"
          type="button"
          data-select-filter-folder="${escapeAttr(folder.id)}"
          title="${escapeAttr(folder.path)}"
        >
          <span class="folder-kind" aria-hidden="true"></span>
          <span class="filter-option-copy">
            <span class="filter-option-title">${highlightText(folder.title, state.filterSearchQuery)}</span>
            <span class="filter-option-path">${highlightText(folder.path, state.filterSearchQuery)}</span>
          </span>
        </button>
      `
    })
    .join('')

  if (!folderItems && query) {
    return '<div class="state-panel compact">未找到相关文件夹</div>'
  }

  return folderItems
}

function renderMoveFolderList(bookmark) {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.moveSearchQuery)
  const markup = roots
    .map((node) => renderMoveFolderNode(node, 0, query, bookmark))
    .join('')

  if (!markup.trim()) {
    return '<div class="state-panel">未找到相关文件夹</div>'
  }

  return markup
}

function renderSmartFolderList() {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.smartFolderSearchQuery)
  const markup = roots
    .map((node) => renderSmartFolderNode(node, 0, query))
    .join('')

  if (!markup.trim()) {
    return '<div class="state-panel">未找到相关文件夹</div>'
  }

  return markup
}

function renderSmartFolderNode(node, depth, query) {
  if (node.id === ROOT_ID) {
    return ''
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return ''
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childMarkup = childFolders
    .map((child) => renderSmartFolderNode(child, depth + 1, query))
    .join('')
  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childMarkup) {
    return ''
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)

  return `
    <div class="picker-row" style="--depth:${depth}">
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        ${childFolders.length ? '' : 'data-disabled="true"'}
        data-toggle-smart-folder="${escapeAttr(node.id)}"
        aria-label="${isExpanded ? '折叠文件夹' : '展开文件夹'}"
      ></button>
      <button
        class="picker-folder-card"
        type="button"
        data-smart-select-folder="${escapeAttr(node.id)}"
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="picker-folder-main">
          <span class="row-title">${highlightText(folder.title, state.smartFolderSearchQuery)}</span>
          <span class="picker-path" title="${escapeAttr(folder.path)}">${highlightText(folder.path, state.smartFolderSearchQuery)}</span>
        </span>
      </button>
    </div>
    ${isExpanded ? childMarkup : ''}
  `
}

function renderMoveFolderNode(node, depth, query, bookmark) {
  if (node.id === ROOT_ID) {
    return ''
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return ''
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childMarkup = childFolders
    .map((child) => renderMoveFolderNode(child, depth + 1, query, bookmark))
    .join('')

  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childMarkup) {
    return ''
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)
  const isCurrentFolder = bookmark.parentId === node.id

  return `
    <div class="picker-row ${isCurrentFolder ? 'current' : ''}" style="--depth:${depth}">
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        ${childFolders.length ? '' : 'data-disabled="true"'}
        data-toggle-move-folder="${escapeAttr(node.id)}"
        aria-label="${isExpanded ? '折叠文件夹' : '展开文件夹'}"
      ></button>
      <button
        class="picker-folder-card"
        type="button"
        data-select-folder="${escapeAttr(node.id)}"
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="picker-folder-main">
          <span class="row-title">${highlightText(folder.title, state.moveSearchQuery)}</span>
          <span class="picker-path" title="${escapeAttr(folder.path)}">${highlightText(folder.path, state.moveSearchQuery)}</span>
          ${isCurrentFolder ? '<span class="picker-badge">当前位置</span>' : ''}
        </span>
      </button>
    </div>
    ${isExpanded ? childMarkup : ''}
  `
}

function renderToasts() {
  dom.toastRoot.innerHTML = state.toasts
    .map((toast) => {
      return `
        <div class="toast ${escapeAttr(toast.type)}" data-toast-id="${escapeAttr(toast.id)}">
          <div class="toast-copy">
            <p class="toast-message">${escapeHtml(toast.message)}</p>
          </div>
          ${
            toast.action
              ? `<button class="toast-action" type="button" data-toast-action="${escapeAttr(
                  toast.action
                )}" data-toast-id="${escapeAttr(toast.id)}">${escapeHtml(toast.actionLabel || '操作')}</button>`
              : ''
          }
          <button class="toast-dismiss" type="button" data-dismiss-toast="${escapeAttr(toast.id)}">关闭</button>
        </div>
      `
    })
    .join('')
}

function handleSmartClassifierClick(event) {
  const recommendationButton = event.target.closest('[data-smart-recommendation]')
  if (recommendationButton) {
    const nextRecommendationId = recommendationButton.getAttribute('data-smart-recommendation')
    if (nextRecommendationId !== state.smartSelectedRecommendationId) {
      state.smartSaved = false
    }
    state.smartSelectedRecommendationId = nextRecommendationId
    renderSmartClassifier()
    return
  }

  const actionButton = event.target.closest('[data-smart-action]')
  if (!actionButton) {
    return
  }

  const action = actionButton.getAttribute('data-smart-action')
  if (action === 'classify') {
    classifyCurrentPage()
    return
  }

  if (action === 'grant-permission') {
    grantSmartPermissionAndClassify()
    return
  }

  if (action === 'manual-folder') {
    openSmartFolderDialog()
    return
  }

  if (action === 'reset') {
    resetSmartClassification()
    return
  }

  if (action === 'exit') {
    resetSmartClassification()
    return
  }

  if (action === 'save') {
    saveSmartRecommendation()
  }
}

function handleSmartClassifierInput(event) {
  if (event.target?.id === 'smart-title-input') {
    state.smartSuggestedTitle = event.target.value
    state.smartSaved = false
  }
}

function handleContentClick(event) {
  const folderToggle = event.target.closest('[data-toggle-folder]')
  if (folderToggle) {
    const folderId = folderToggle.getAttribute('data-toggle-folder')
    toggleFolder(folderId)
    return
  }

  const menuToggle = event.target.closest('[data-open-menu]')
  if (menuToggle) {
    const bookmarkId = menuToggle.getAttribute('data-open-menu')
    if (state.activeMenuBookmarkId === bookmarkId) {
      closeActionMenu()
      return
    }
    state.activeMenuBookmarkId = bookmarkId
    renderMainContent()
    return
  }

  const actionButton = event.target.closest('[data-menu-action]')
  if (actionButton) {
    const bookmarkId = actionButton.getAttribute('data-bookmark-id')
    const action = actionButton.getAttribute('data-menu-action')

    if (action === 'edit') {
      openEditDialog(bookmarkId)
      return
    }

    if (action === 'move') {
      openMoveDialog(bookmarkId)
      return
    }

    if (action === 'delete') {
      openDeleteDialog(bookmarkId)
    }

    return
  }

  const bookmarkButton = event.target.closest('[data-open-bookmark]')
  if (bookmarkButton) {
    const bookmarkId = bookmarkButton.getAttribute('data-open-bookmark')
    openBookmark(bookmarkId)
  }
}

function handleContentPointerOver(event) {
  const resultCard = event.target.closest('[data-result-index]')
  if (!resultCard || !state.debouncedQuery) {
    return
  }

  const nextIndex = Number(resultCard.getAttribute('data-result-index'))
  if (!Number.isNaN(nextIndex)) {
    setActiveResultIndex(nextIndex)
  }
}

function handleFilterListClick(event) {
  const filterButton = event.target.closest('[data-select-filter-folder]')
  if (!filterButton) {
    return
  }

  const folderId = filterButton.getAttribute('data-select-filter-folder')
  applyFolderFilter(folderId === 'all' ? null : folderId)
}

function handleMoveListClick(event) {
  const toggle = event.target.closest('[data-toggle-move-folder]')
  if (toggle && !state.moveSearchQuery.trim()) {
    const folderId = toggle.getAttribute('data-toggle-move-folder')
    if (!toggle.hasAttribute('data-disabled')) {
      toggleMoveFolder(folderId)
    }
    return
  }

  const folderButton = event.target.closest('[data-select-folder]')
  if (folderButton) {
    const folderId = folderButton.getAttribute('data-select-folder')
    moveBookmarkToFolder(folderId)
  }
}

function handleSmartFolderListClick(event) {
  const toggle = event.target.closest('[data-toggle-smart-folder]')
  if (toggle && !state.smartFolderSearchQuery.trim()) {
    const folderId = toggle.getAttribute('data-toggle-smart-folder')
    if (!toggle.hasAttribute('data-disabled')) {
      toggleMoveFolder(folderId)
      renderSmartFolderModal()
    }
    return
  }

  const folderButton = event.target.closest('[data-smart-select-folder]')
  if (folderButton) {
    const folderId = folderButton.getAttribute('data-smart-select-folder')
    saveCurrentPageToFolder(folderId)
  }
}

function closeActionMenu() {
  const menu = document.querySelector('.action-menu')
  const hadMenu = Boolean(state.activeMenuBookmarkId)
  state.activeMenuBookmarkId = null

  if (menu instanceof HTMLElement && !menu.classList.contains('is-closing')) {
    void closeWithExitMotion(menu, 'is-closing', () => {
      renderMainContent()
    }, 180)
    return
  }

  if (hadMenu) {
    renderMainContent()
  }
}

function handleDocumentPointerDown(event) {
  if (!state.activeMenuBookmarkId) {
    return
  }

  if (!event.target.closest('.menu-anchor')) {
    closeActionMenu()
  }
}

function handleDocumentKeydown(event) {
  if (event.isComposing) {
    return
  }

  if (event.key === 'Escape') {
    if (handleEscapeAction()) {
      event.preventDefault()
    }
    return
  }

  if (hasOpenModal()) {
    return
  }

  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setActiveResultIndex(state.activeResultIndex + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    setActiveResultIndex(state.activeResultIndex - 1)
    return
  }

  if (event.key === 'Enter') {
    const activeResult = state.searchResults[state.activeResultIndex]
    if (activeResult) {
      event.preventDefault()
      openBookmark(activeResult.id)
    }
  }
}

function handleEscapeAction() {
  if (hasOpenModal()) {
    closeDialogs()
    return true
  }

  if (state.activeMenuBookmarkId) {
    closeActionMenu()
    return true
  }

  if (['loading', 'results', 'error'].includes(state.smartStatus)) {
    resetSmartClassification()
    return true
  }

  if (state.searchQuery) {
    setSearchQuery('', { immediate: true })
    return true
  }

  return false
}

function handleEditInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEditedBookmark()
  }
}

function handleToastClick(event) {
  const dismissButton = event.target.closest('[data-dismiss-toast]')
  if (dismissButton) {
    dismissToast(dismissButton.getAttribute('data-dismiss-toast'))
    return
  }

  const actionButton = event.target.closest('[data-toast-action]')
  if (!actionButton) {
    return
  }

  const toastId = actionButton.getAttribute('data-toast-id')
  const action = actionButton.getAttribute('data-toast-action')

  dismissToast(toastId)

  if (action === 'undo-delete') {
    undoDelete()
    return
  }

  if (action === 'open-bookmark-history') {
    void openBookmarkHistoryPage()
  }
}

function toggleFolder(folderId) {
  if (!folderId) {
    return
  }

  if (state.expandedFolders.has(folderId)) {
    state.expandedFolders.delete(folderId)
  } else {
    state.expandedFolders.add(folderId)
  }

  renderMainContent()
}

function toggleMoveFolder(folderId) {
  if (!folderId) {
    return
  }

  if (state.moveExpandedFolders.has(folderId)) {
    state.moveExpandedFolders.delete(folderId)
  } else {
    state.moveExpandedFolders.add(folderId)
  }

  renderMoveModal()
}

function openFilterDialog() {
  state.activeMenuBookmarkId = null
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.isFilterPickerOpen = true
  state.filterSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.filterSearchInput.focus()
  })
}

function openMoveDialog(bookmarkId) {
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = null
  state.moveTargetBookmarkId = bookmarkId
  state.moveSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.moveSearchInput.focus()
  })
}

function openEditDialog(bookmarkId) {
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = bookmarkId
  render()

  window.requestAnimationFrame(() => {
    dom.editTitleInput.focus()
    dom.editTitleInput.select()
  })
}

function openDeleteDialog(bookmarkId) {
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = bookmarkId
  render()

  window.requestAnimationFrame(() => {
    dom.cancelDelete.focus()
  })
}

function closeDialogs() {
  state.isFilterPickerOpen = false
  state.filterSearchQuery = ''
  state.moveTargetBookmarkId = null
  state.moveSearchQuery = ''
  state.smartFolderPickerOpen = false
  state.smartFolderSearchQuery = ''
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  render()
  if (document.body.classList.contains('smart-active')) {
    return
  }
  dom.searchInput.focus()
}

function applyFolderFilter(folderId) {
  state.selectedFolderFilterId = folderId
  state.isFilterPickerOpen = false
  state.filterSearchQuery = ''
  state.activeMenuBookmarkId = null
  runSearch()
  render()
  dom.searchInput.focus()
}

function clearFolderFilter() {
  if (!state.selectedFolderFilterId) {
    return
  }

  applyFolderFilter(null)
}

function openSmartFolderDialog() {
  if (!isSmartClassifiableUrl(state.currentTab?.url)) {
    showToast({ type: 'error', message: '当前页面无法保存为普通网页书签。' })
    return
  }

  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.smartFolderPickerOpen = true
  state.smartFolderSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.smartFolderSearchInput.focus()
  })
}

function resetSmartClassification() {
  state.smartRunId += 1
  state.smartStatus = 'idle'
  state.smartError = ''
  state.smartStep = 0
  state.smartProgressPercent = 0
  state.smartSuggestedTitle = ''
  state.smartSummary = ''
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartSaving = false
  state.smartSaved = false
  state.smartPermissionRequest = null
  renderSmartClassifier()
}

async function classifyCurrentPage({ requestMissingPermissions = false } = {}) {
  if (state.smartStatus === 'loading' || state.smartSaving) {
    return
  }

  const currentUrl = String(state.currentTab?.url || '').trim()
  if (!isSmartClassifiableUrl(currentUrl)) {
    showToast({ type: 'error', message: '当前页面无法进行智能分类。' })
    return
  }

  const runId = state.smartRunId + 1
  state.smartRunId = runId
  state.smartStatus = 'loading'
  state.smartError = ''
  state.smartStep = 1
  state.smartProgressPercent = 0
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartSaved = false
  state.smartSuggestedTitle = getCurrentPageTitle()
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartPermissionRequest = null
  renderSmartClassifier()

  try {
    const settings = await loadAiProviderSettings()
    if (state.smartRunId !== runId) return
    validateSmartAiSettings(settings)
    await ensureSmartClassifyPermissions(settings, {
      interactive: requestMissingPermissions
    })
    if (state.smartRunId !== runId) return

    const pageContext = await buildCurrentPageContext(currentUrl, settings)
    if (state.smartRunId !== runId) return

    state.smartStep = 2
    renderSmartClassifier()
    const aiResult = await requestSmartClassification({
      settings,
      pageContext,
      currentUrl
    })
    if (state.smartRunId !== runId) return

    state.smartStep = 3
    renderSmartClassifier()
    await waitForSmartLoadingPaint()
    if (state.smartRunId !== runId) return

    const recommendations = buildSmartRecommendations(aiResult)
    state.smartSuggestedTitle = cleanSmartTitle(aiResult.title || getCurrentPageTitle())
    state.smartSummary = cleanSmartText(aiResult.summary, 360)
    state.smartContentType = cleanSmartText(aiResult.contentType, 80)
    state.smartTopics = normalizeSmartTextList(aiResult.topics, 8, 40)
    state.smartTags = normalizeBookmarkTags(aiResult.tags)
    state.smartAliases = normalizeSmartTextList(aiResult.aliases, 20, 40)
    state.smartConfidence = normalizeSmartConfidence(aiResult.confidence)
    state.smartModel = settings.model
    state.smartExtraction = buildSmartExtractionSnapshot(pageContext)
    state.smartRecommendations = recommendations
    state.smartSelectedRecommendationId = recommendations[0]?.id || ''
    state.smartStatus = 'results'
    renderSmartClassifier()
  } catch (error) {
    if (state.smartRunId !== runId) return
    if (isSmartPermissionRequiredError(error)) {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = error.smartPermissionRequest
      state.smartError = error.message
      renderSmartClassifier()
      return
    }
    state.smartStatus = 'error'
    state.smartError = normalizeSmartError(error)
    renderSmartClassifier()
  }
}

async function grantSmartPermissionAndClassify() {
  if (state.smartStatus === 'loading' || state.smartSaving) {
    return
  }

  const origins = Array.isArray(state.smartPermissionRequest?.origins)
    ? [...new Set(state.smartPermissionRequest.origins)].filter(Boolean)
    : []

  if (!origins.length) {
    await classifyCurrentPage({ requestMissingPermissions: true })
    return
  }

  try {
    const granted = await requestPermissions({ origins })
    if (!granted) {
      throw createSmartPermissionRequiredError(origins, '未完成 AI 渠道授权，暂时无法智能分类。')
    }
    await classifyCurrentPage()
  } catch (error) {
    if (isSmartPermissionRequiredError(error)) {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = error.smartPermissionRequest
      state.smartError = error.message
    } else {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = { origins }
      state.smartError = normalizeSmartError(error)
    }
    renderSmartClassifier()
  }
}

async function saveSmartRecommendation() {
  const recommendation = state.smartRecommendations.find((item) => item.id === state.smartSelectedRecommendationId)
  if (!recommendation || state.smartSaving || state.smartSaved) {
    return
  }

  state.smartSaving = true
  state.smartSaved = false
  renderSmartClassifier()

  try {
    await saveCurrentPageToSmartRecommendation(recommendation)
  } catch (error) {
    state.smartSaving = false
    renderSmartClassifier()
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
  }
}

async function saveCurrentPageToSmartRecommendation(recommendation) {
  if (recommendation.kind === 'new') {
    await saveCurrentPageViaWorker({
      folderPath: recommendation.path
    }, { closeModal: false })
    return
  }

  await saveCurrentPageToFolder(recommendation.folderId, { closeModal: false })
}

async function saveCurrentPageToFolder(folderId, { closeModal = true } = {}) {
  await saveCurrentPageViaWorker({ parentId: folderId }, { closeModal })
}

async function saveCurrentPageViaWorker({ parentId = '', folderPath = '' } = {}, { closeModal = true } = {}) {
  try {
    const currentUrl = String(state.currentTab?.url || '').trim()
    if (!isSmartClassifiableUrl(currentUrl)) {
      throw new Error('当前页面不是可保存的普通网页。')
    }

    if (!parentId && !folderPath) {
      throw new Error('未找到可保存的目标文件夹。')
    }

    const nextTitle = cleanSmartTitle(state.smartSuggestedTitle || getCurrentPageTitle())
    const existingBookmark = state.currentPageBookmarkId
      ? state.bookmarkMap.get(state.currentPageBookmarkId)
      : null

    const savedBookmark = await requestBookmarkSave({
      parentId,
      folderPath,
      bookmarkId: existingBookmark?.id || state.currentPageBookmarkId || '',
      title: nextTitle,
      url: currentUrl,
      analysis: {
        summary: state.smartSummary,
        contentType: state.smartContentType,
        topics: state.smartTopics,
        tags: state.smartTags,
        aliases: state.smartAliases,
        confidence: state.smartConfidence,
        model: state.smartModel,
        extraction: state.smartExtraction
      }
    })

    state.smartSaving = false
    state.smartSaved = true
    state.smartStatus = 'results'
    state.currentPageBookmarkId = savedBookmark.bookmarkId || state.currentPageBookmarkId
    if (closeModal) {
      closeDialogs()
    }
    showToast({ type: 'success', message: '已保存到推荐文件夹' })
    renderSmartClassifier()
  } catch (error) {
    state.smartSaving = false
    state.smartSaved = false
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
    render()
  }
}

async function moveBookmarkToFolder(folderId) {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null

  if (!bookmark || !folderId) {
    return
  }

  if (bookmark.parentId === folderId) {
    showToast({
      type: 'success',
      message: '书签已在当前文件夹中'
    })
    return
  }

  try {
    await moveBookmark(bookmark.id, folderId)
    showToast({
      type: 'success',
      message: '移动成功'
    })
    closeDialogs()
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。'
    })
  }
}

async function saveEditedBookmark() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null

  if (!bookmark) {
    return
  }

  const nextTitle = dom.editTitleInput.value.trim() || '未命名书签'
  const nextUrl = dom.editUrlInput.value.trim()

  if (!nextUrl) {
    showToast({
      type: 'error',
      message: '网址不能为空'
    })
    dom.editUrlInput.focus()
    return
  }

  try {
    new URL(nextUrl)
  } catch (error) {
    showToast({
      type: 'error',
      message: '请输入有效的网址'
    })
    dom.editUrlInput.focus()
    return
  }

  try {
    await updateBookmark(bookmark.id, {
      title: nextTitle,
      url: nextUrl
    })
    showToast({
      type: 'success',
      message: '保存成功'
    })
    closeDialogs()
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
  }
}

async function confirmDeleteBookmark() {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null

  if (!bookmark) {
    return
  }

  try {
    state.lastDeletedBookmark = {
      title: bookmark.title,
      url: bookmark.url,
      parentId: bookmark.parentId,
      index: bookmark.index,
      recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    }

    await removeBookmark(bookmark.id)
    await appendRecycleEntry({
      recycleId: state.lastDeletedBookmark.recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title,
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: bookmark.path || '',
      source: '弹窗删除',
      deletedAt: Date.now()
    })

    showToast({
      type: 'success',
      message: '删除成功',
      action: 'undo-delete',
      actionLabel: '撤销'
    })

    closeDialogs()
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `删除失败：${error.message}` : '删除失败，请稍后重试。'
    })
  }
}

async function undoDelete() {
  if (!state.lastDeletedBookmark) {
    return
  }

  const payload = state.lastDeletedBookmark
  state.lastDeletedBookmark = null

  try {
    await createBookmark(payload)
    if (payload.recycleId) {
      await removeRecycleEntry(payload.recycleId)
    }
    showToast({
      type: 'success',
      message: '已撤销删除'
    })
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `撤销失败：${error.message}` : '撤销失败，请稍后重试。'
    })
  }
}

async function openBookmark(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)

  if (!bookmark?.url) {
    return
  }

  try {
    await createTab({ url: bookmark.url })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `打开失败：${error.message}` : '打开失败，请稍后重试。'
    })
  }
}

async function loadAiProviderSettings() {
  const stored = await getLocalStorage([STORAGE_KEYS.aiProviderSettings])
  return normalizeAiNamingSettings(stored[STORAGE_KEYS.aiProviderSettings])
}

function validateSmartAiSettings(settings) {
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error('请先到通用设置配置“自定义AI渠道”。')
  }
}

async function ensureSmartClassifyPermissions(settings, { interactive = false } = {}) {
  const origins = [
    getOriginPermissionPattern(settings.baseUrl)
  ].filter(Boolean)

  if (!origins.length) {
    return true
  }

  const missingOrigins = await getMissingPermissionOrigins(origins)
  if (!missingOrigins.length) {
    return true
  }

  if (!interactive) {
    throw createSmartPermissionRequiredError(missingOrigins)
  }

  const granted = await requestPermissions({ origins: missingOrigins })
  if (!granted) {
    throw createSmartPermissionRequiredError(missingOrigins, '未完成 AI 渠道授权，暂时无法智能分类。')
  }
  return true
}

async function requestNaturalSearchAiPlan(query, localPlan: NaturalSearchPlan): Promise<NaturalSearchPlan> {
  const settings = await loadAiProviderSettings()
  validateSmartAiSettings(settings)
  await ensureSmartClassifyPermissions(settings, { interactive: false })

  const endpoint = getAiEndpoint(settings)
  const requestBody = buildNaturalSearchRequestBody({ settings, query, localPlan })
  const response = await fetchWithSmartTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody)
  }, settings.timeoutMs)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractAiErrorMessage(payload, response.status))
  }

  const rawJsonText = settings.apiStyle === 'responses'
    ? extractResponsesJsonText(payload)
    : extractChatCompletionsJsonText(payload)

  try {
    return normalizeNaturalSearchAiPlan(JSON.parse(rawJsonText), localPlan)
  } catch {
    throw new Error('AI 返回了无法解析的自然语言搜索结果。')
  }
}

function buildNaturalSearchRequestBody({ settings, query, localPlan }) {
  const today = formatLocalDate(Date.now())
  const examplePlan = buildLocalNaturalSearchPlan('帮我找上周收藏的那个 React 表格教程')
  const systemPrompt = [
    '你是浏览器书签搜索查询理解器。',
    '你的任务是把用户自然语言改写为本地书签搜索关键词，不要回答用户问题。',
    '输出要适合在标题、URL、文件夹路径、AI 标签、主题、别名和摘要中做文本匹配。',
    '保留产品名、框架名、库名、站点名和专有名词；去掉“帮我找、那个、收藏的、书签”等意图词。',
    '为中文和英文同义表达补充少量高价值关键词，例如“表格教程”可包含 table、grid、tutorial、guide。',
    '如果用户明确排除某类内容，把排除词放入 excluded_terms。',
    'date_range 只有在用户明确提到时间时填写；from 和 to 使用 YYYY-MM-DD，to 是不包含的结束日期；没有时间条件时三个字段都返回空字符串。',
    '不要编造用户没有表达的具体网站、作者或标题。'
  ].join('\n')
  const userPrompt = JSON.stringify({
    today,
    raw_query: query,
    local_interpretation: {
      queries: localPlan.queries,
      date_range: localPlan.dateRange
        ? {
            from: formatLocalDate(localPlan.dateRange.from),
            to: formatLocalDate(localPlan.dateRange.to),
            label: localPlan.dateRange.label
          }
        : { from: '', to: '', label: '' }
    },
    examples: [
      {
        input: '帮我找上周收藏的那个 React 表格教程',
        output: {
          queries: ['react 表格 教程 table grid tutorial guide', 'react table tutorial'],
          keywords: ['react', '表格', '教程', 'table', 'grid', 'tutorial'],
          excluded_terms: [],
          date_range: examplePlan.dateRange
            ? {
                from: formatLocalDate(examplePlan.dateRange.from),
                to: formatLocalDate(examplePlan.dateRange.to),
                label: examplePlan.dateRange.label
              }
            : { from: '', to: '', label: '' },
          explanation: '按上周收藏和 React 表格教程关键词匹配'
        }
      }
    ]
  }, null, 2)

  if (settings.apiStyle === 'chat_completions') {
    const schemaHint = '\n\n请严格按以下 JSON 格式返回结果，不要添加任何额外文本或 markdown 标记：\n' + JSON.stringify(NATURAL_SEARCH_SCHEMA, null, 2)
    return {
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt + schemaHint },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    }
  }

  return {
    model: settings.model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }]
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: userPrompt }]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'popup_natural_language_search',
        strict: true,
        schema: NATURAL_SEARCH_SCHEMA
      }
    }
  }
}

function normalizeNaturalSearchError(error) {
  if (isSmartPermissionRequiredError(error)) {
    return 'AI 渠道未授权，已使用本地自然语言解析。'
  }

  const message = error instanceof Error ? error.message : ''
  if (!message) {
    return 'AI 解析不可用，已使用本地自然语言解析。'
  }

  if (message.includes('请先到通用设置')) {
    return '未配置 AI 渠道，已使用本地自然语言解析。'
  }

  return `AI 解析不可用，已使用本地解析：${cleanSmartText(message, 72)}`
}

async function buildCurrentPageContext(currentUrl, settings) {
  const timeoutMs = settings.timeoutMs
  let context = null

  try {
    const response = await fetchWithSmartTimeout(currentUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer'
    }, timeoutMs)
    const finalUrl = String(response.url || currentUrl || '')
    const contentType = String(response.headers.get('content-type') || '').toLowerCase()

    if (contentType.includes('text/html')) {
      const html = await response.text()
      context = extractPageContentFromHtml(html, {
        url: finalUrl,
        currentTitle: getCurrentPageTitle(),
        contentType
      })
    } else {
      context = buildFallbackPageContentFromUrl(finalUrl, {
        currentTitle: getCurrentPageTitle(),
        contentType
      })
    }
  } catch (error) {
    context = buildFallbackPageContentFromUrl(currentUrl, {
      currentTitle: getCurrentPageTitle(),
      error
    })
  }

  if (settings.allowRemoteParsing) {
    const canUseRemoteParser = await hasOptionalOriginPermission(AI_NAMING_JINA_READER_ORIGIN)
    if (!canUseRemoteParser) {
      return normalizePageContentContext({
        ...context,
        warnings: [
          ...(context.warnings || []),
          'Jina Reader 未授权，本次已跳过远程解析。'
        ]
      })
    }

    try {
      const remoteContext = await fetchRemoteCurrentPageContext(context.finalUrl || currentUrl, timeoutMs, context)
      return combinePageContentContexts(context, remoteContext)
    } catch (error) {
      return normalizePageContentContext({
        ...context,
        warnings: [
          ...(context.warnings || []),
          `远程解析失败：${normalizeSmartError(error)}`
        ]
      })
    }
  }

  return context
}

async function fetchRemoteCurrentPageContext(url, timeoutMs, fallbackContext) {
  const readerUrl = buildJinaReaderUrl(url)
  if (!readerUrl) {
    throw new Error('远程解析 URL 无效。')
  }

  const response = await fetchWithSmartTimeout(readerUrl, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1'
    }
  }, timeoutMs)

  if (!response.ok) {
    throw new Error(`Jina Reader 返回 HTTP ${response.status}。`)
  }

  const text = await response.text()
  return buildRemotePageContentFromText(text, {
    url: fallbackContext?.finalUrl || url,
    currentTitle: fallbackContext?.title || getCurrentPageTitle()
  })
}

async function requestSmartClassification({ settings, pageContext, currentUrl }) {
  const endpoint = getAiEndpoint(settings)
  const requestBody = buildSmartAiRequestBody({
    settings,
    pageContext,
    currentUrl
  })
  const response = await fetchWithSmartTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody)
  }, settings.timeoutMs)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractAiErrorMessage(payload, response.status))
  }

  const rawJsonText = settings.apiStyle === 'responses'
    ? extractResponsesJsonText(payload)
    : extractChatCompletionsJsonText(payload)

  try {
    return normalizeSmartAiResult(JSON.parse(rawJsonText))
  } catch {
    throw new Error('AI 返回了无法解析的 JSON 结果。')
  }
}

function buildSmartAiRequestBody({ settings, pageContext, currentUrl }) {
  const systemPrompt = [
    '你是浏览器书签智能分类助手。',
    '你需要根据当前网页内容和用户已有书签文件夹，为当前网页推荐保存位置。',
    '如果 page_context.source_contexts 同时包含“本地抽取”和“Jina Reader”，请结合两路内容判断：本地抽取通常保留浏览器可见的 title/meta/链接上下文，Jina Reader 通常提供更干净的 Markdown 正文。',
    '必须优先推荐 existing_folders 中已经存在的文件夹；如果多个文件夹都匹配，优先选择嵌套层级最深、语义最具体的文件夹。',
    'existing_folders 数组只能填写输入中存在的 folder_path，不要编造已有文件夹。',
    'new_folder 只能作为最后的备用建议，路径要短，适合用户新建。',
    'title 要适合作为浏览器书签标题，简短清晰，不要包含无意义站点后缀。',
    'summary、content_type、topics、tags、aliases 用于本地搜索标签库：summary 概括页面内容，content_type 选择最贴近的内容类型。',
    'topics 是主题归类，可稍长；tags 是界面展示和筛选用短标签，必须短、原子、稳定。',
    'tags 规则：每个 tag 只表达一个概念；中文优先 2-6 个字，英文优先 1-3 个词；通常输出 4-8 个高价值 tag。',
    '禁止把句子、标题、描述、多个概念组合成 tag；如果包含“与、和、及、逗号或斜杠”等多个概念，请拆成多个短 tag。',
    '好的 tags 示例：["AI", "LLM", "网关", "API", "OpenAI 兼容"]；坏的 tags 示例：["一个支持 OpenAI Claude Gemini 的 API 聚合网关", "效率工具与网络技术博客"]。',
    'aliases 只输出语义别名、简称、英文名、中文名或常见叫法；不要输出拼音全拼或首字母。',
    'confidence 必须是 0 到 1 的数字。'
  ].join('\n')
  const userPrompt = JSON.stringify({
    current_page: {
      title: getCurrentPageTitle(),
      url: currentUrl,
      domain: extractDomain(currentUrl),
      page_context: buildPageContextForAi(normalizePageContentContext(pageContext), { mainTextLimit: 4200 })
    },
    existing_folders: buildSmartFolderCandidates()
  }, null, 2)

  if (settings.apiStyle === 'chat_completions') {
    const schemaHint = '\n\n请严格按以下 JSON 格式返回结果，不要添加任何额外文本或 markdown 标记：\n' + JSON.stringify(SMART_CLASSIFY_SCHEMA, null, 2)
    return {
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt + schemaHint },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    }
  }

  return {
    model: settings.model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }]
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: userPrompt }]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'popup_smart_classification',
        strict: true,
        schema: SMART_CLASSIFY_SCHEMA
      }
    }
  }
}

function buildSmartFolderCandidates() {
  return state.allFolders
    .slice()
    .sort((left, right) => {
      return Number(right.depth || 0) - Number(left.depth || 0) || String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
    })
    .slice(0, 260)
    .map((folder) => ({
      folder_id: String(folder.id),
      folder_path: String(folder.path || folder.title || ''),
      title: String(folder.title || ''),
      depth: Number(folder.depth) || 0
    }))
}

function buildSmartRecommendations(aiResult) {
  const byFolderId = new Map()

  for (const suggestion of aiResult.existingFolders) {
    const folder = findBestExistingFolder(suggestion.folderPath)
    if (!folder) {
      continue
    }

    const previous = byFolderId.get(folder.id)
    const confidence = normalizeSmartConfidence(suggestion.confidence)
    if (!previous || confidence > previous.confidence) {
      byFolderId.set(folder.id, {
        id: `folder:${folder.id}`,
        kind: 'existing',
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence,
        reason: suggestion.reason || ''
      })
    }
  }

  const existingRecommendations = [...byFolderId.values()]
    .sort((left, right) => {
      const leftFolder = state.folderMap.get(left.folderId)
      const rightFolder = state.folderMap.get(right.folderId)
      return (
        Number(right.confidence) - Number(left.confidence) ||
        Number(rightFolder?.depth || 0) - Number(leftFolder?.depth || 0) ||
        String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
      )
    })
    .slice(0, SMART_RECOMMENDATION_LIMIT)

  if (existingRecommendations.length < SMART_RECOMMENDATION_LIMIT) {
    for (const fallback of buildLocalSmartFolderMatches()) {
      if (existingRecommendations.some((item) => item.folderId === fallback.folderId)) {
        continue
      }
      existingRecommendations.push(fallback)
      if (existingRecommendations.length >= SMART_RECOMMENDATION_LIMIT) {
        break
      }
    }
  }

  const newFolderPath = normalizeSmartFolderPath(aiResult.newFolder?.folderPath)
  const newRecommendation = newFolderPath
    ? [{
        id: 'new-folder',
        kind: 'new',
        folderId: '',
        title: getLastPathSegment(newFolderPath),
        path: newFolderPath,
        confidence: normalizeSmartConfidence(aiResult.newFolder?.confidence),
        reason: aiResult.newFolder?.reason || ''
      }]
    : []

  return [...existingRecommendations, ...newRecommendation]
}

function buildLocalSmartFolderMatches() {
  const titleText = normalizeText(getCurrentPageTitle())
  const urlText = normalizeText(state.currentTab?.url || '')
  const domainText = normalizeText(extractDomain(state.currentTab?.url || ''))
  const haystack = [titleText, urlText, domainText].filter(Boolean).join(' ')

  return state.allFolders
    .map((folder) => {
      const title = normalizeText(folder.title)
      const path = normalizeText(folder.path)
      let score = 0
      if (title && haystack.includes(title)) {
        score += 0.38
      }
      if (path && haystack.includes(path)) {
        score += 0.28
      }
      if (domainText && (title.includes(domainText) || path.includes(domainText))) {
        score += 0.22
      }
      score += Math.min(Number(folder.depth || 0), 6) * 0.025

      return {
        id: `folder:${folder.id}`,
        kind: 'existing',
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence: Math.max(0.52, Math.min(score, 0.82)),
        reason: '基于当前网页标题、域名和文件夹路径的本地补充匹配。'
      }
    })
    .filter((item) => item.confidence > 0.54)
    .sort((left, right) => {
      const leftFolder = state.folderMap.get(left.folderId)
      const rightFolder = state.folderMap.get(right.folderId)
      return (
        Number(right.confidence) - Number(left.confidence) ||
        Number(rightFolder?.depth || 0) - Number(leftFolder?.depth || 0) ||
        String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
      )
    })
}

function normalizeSmartAiResult(payload) {
  const existingFolders = Array.isArray(payload?.existing_folders)
    ? payload.existing_folders
    : []
  return {
    title: cleanSmartTitle(payload?.title || getCurrentPageTitle()),
    summary: cleanSmartText(payload?.summary, 360),
    contentType: cleanSmartText(payload?.content_type, 80),
    topics: normalizeSmartTextList(payload?.topics, 8, 40),
    tags: normalizeBookmarkTags(payload?.tags),
    aliases: normalizeSmartTextList(payload?.aliases, 20, 40),
    confidence: normalizeSmartConfidence(payload?.confidence),
    existingFolders: existingFolders
      .map((item) => ({
        folderPath: cleanSmartText(item?.folder_path, 240),
        reason: cleanSmartText(item?.reason, 180),
        confidence: normalizeSmartConfidence(item?.confidence)
      }))
      .filter((item) => item.folderPath),
    newFolder: {
      folderPath: cleanSmartText(payload?.new_folder?.folder_path, 240),
      reason: cleanSmartText(payload?.new_folder?.reason, 180),
      confidence: normalizeSmartConfidence(payload?.new_folder?.confidence)
    }
  }
}

function normalizeSmartTextList(value, limit, itemLimit) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set()
  const output = []

  for (const item of values) {
    const text = cleanSmartText(item, itemLimit)
    const key = normalizeText(text)
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

function buildSmartExtractionSnapshot(pageContext) {
  return {
    status: cleanSmartText(pageContext?.extractionStatus, 40),
    source: cleanSmartText(pageContext?.source, 80),
    warnings: normalizeSmartTextList(pageContext?.warnings, 4, 40)
  }
}

function findBestExistingFolder(rawPath) {
  const normalizedPath = normalizeText(rawPath)
  if (!normalizedPath) {
    return null
  }

  const folders = state.allFolders.slice()
  const exactPathMatches = folders.filter((folder) => normalizeText(folder.path || folder.title) === normalizedPath)
  if (exactPathMatches.length) {
    return pickDeepestFolder(exactPathMatches)
  }

  const exactTitleMatches = folders.filter((folder) => normalizeText(folder.title) === normalizedPath)
  if (exactTitleMatches.length) {
    return pickDeepestFolder(exactTitleMatches)
  }

  const segment = normalizeText(getLastPathSegment(rawPath))
  const segmentMatches = folders.filter((folder) => normalizeText(folder.title) === segment)
  if (segmentMatches.length) {
    return pickDeepestFolder(segmentMatches)
  }

  const containsMatches = folders.filter((folder) => {
    const folderPath = normalizeText(folder.path || folder.title)
    return folderPath.includes(normalizedPath) || normalizedPath.includes(folderPath)
  })
  return containsMatches.length ? pickDeepestFolder(containsMatches) : null
}

function pickDeepestFolder(folders) {
  return folders
    .slice()
    .sort((left, right) => {
      return Number(right.depth || 0) - Number(left.depth || 0) || String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
    })[0] || null
}

function requestPermissions(query) {
  return new Promise((resolve, reject) => {
    chrome.permissions.request(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

function containsPermissions(query) {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

async function getMissingPermissionOrigins(origins) {
  const uniqueOrigins = [...new Set(origins)].filter(Boolean)
  if (!uniqueOrigins.length) {
    return []
  }

  try {
    if (await containsPermissions({ origins: uniqueOrigins })) {
      return []
    }
  } catch (error) {
  }

  const missingOrigins = []
  for (const origin of uniqueOrigins) {
    try {
      if (!(await containsPermissions({ origins: [origin] }))) {
        missingOrigins.push(origin)
      }
    } catch (error) {
      missingOrigins.push(origin)
    }
  }
  return missingOrigins
}

async function hasOptionalOriginPermission(origin) {
  if (!origin) {
    return false
  }

  try {
    return await containsPermissions({ origins: [origin] })
  } catch (error) {
    return false
  }
}

function createSmartPermissionRequiredError(origins: unknown[], message = '需要授权 AI 渠道后才能智能分类。') {
  const error = new Error(message) as Error & {
    smartPermissionRequest?: { origins: string[] }
  }
  error.smartPermissionRequest = {
    origins: [...new Set(origins.map((origin) => String(origin || '')).filter(Boolean))]
  }
  return error
}

function isSmartPermissionRequiredError(error) {
  return Boolean((error as { smartPermissionRequest?: { origins?: string[] } })?.smartPermissionRequest?.origins)
}

function formatPermissionOrigin(origin) {
  return String(origin || '').replace(/\/\*$/, '')
}

function fetchWithSmartTimeout(url, options = {}, timeoutMs = AI_NAMING_DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, Math.max(1000, Number(timeoutMs) || AI_NAMING_DEFAULT_TIMEOUT_MS))

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeoutId)
  })
}

function getOriginPermissionPattern(url) {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return ''
    }
    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

function updateActiveResultVisibility() {
  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  const activeResult = dom.content.querySelector<HTMLElement>(
    `[data-result-index="${state.activeResultIndex}"]`
  )
  if (!activeResult) {
    return
  }

  const maxScrollTop = Math.max(0, dom.content.scrollHeight - dom.content.clientHeight)

  if (state.activeResultIndex === 0) {
    dom.content.scrollTop = 0
    return
  }

  if (state.activeResultIndex === state.searchResults.length - 1) {
    dom.content.scrollTop = maxScrollTop
    return
  }

  const resultTop = activeResult.offsetTop
  const resultBottom = resultTop + activeResult.offsetHeight
  const viewportTop = dom.content.scrollTop
  const viewportBottom = viewportTop + dom.content.clientHeight

  if (resultTop < viewportTop) {
    dom.content.scrollTop = Math.max(0, resultTop)
    return
  }

  if (resultBottom > viewportBottom) {
    dom.content.scrollTop = Math.min(maxScrollTop, resultBottom - dom.content.clientHeight)
  }
}

function setActiveResultIndex(nextIndex) {
  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  const clampedIndex = Math.max(0, Math.min(nextIndex, state.searchResults.length - 1))
  if (clampedIndex === state.activeResultIndex) {
    return
  }

  const previousIndex = state.activeResultIndex
  state.activeResultIndex = clampedIndex
  updateActiveSearchResult(previousIndex, clampedIndex)
  updateActiveResultVisibility()
}

function updateActiveSearchResult(previousIndex, nextIndex) {
  const previousCard = dom.content.querySelector(`[data-result-index="${previousIndex}"]`)
  const nextCard = dom.content.querySelector(`[data-result-index="${nextIndex}"]`)

  if (!previousCard && !nextCard) {
    renderMainContent()
    return
  }

  previousCard?.classList.remove('active')
  nextCard?.classList.add('active')
}

function getCurrentTreeRoot() {
  if (state.selectedFolderFilterId) {
    return findNodeById(state.rawTreeRoot, state.selectedFolderFilterId) || state.bookmarksBarNode
  }

  return state.bookmarksBarNode
}

function getFilteredBookmarks() {
  const cacheKey = state.selectedFolderFilterId || 'all'
  if (state.filteredBookmarksCacheKey === cacheKey) {
    return state.filteredBookmarksCache
  }

  const bookmarks = state.selectedFolderFilterId
    ? state.allBookmarks.filter((bookmark) => {
        return bookmark.ancestorIds.includes(state.selectedFolderFilterId)
      })
    : state.allBookmarks

  state.filteredBookmarksCacheKey = cacheKey
  state.filteredBookmarksCache = bookmarks
  return bookmarks
}

function getSearchCacheKey(normalizedQuery) {
  return `${state.selectedFolderFilterId || 'all'}\u0000${normalizedQuery}`
}

function getNaturalSearchDateBucket() {
  return formatLocalDate(Date.now())
}

function getNaturalSearchPlanCacheKey(normalizedQuery) {
  return `${getNaturalSearchDateBucket()}\u0000${normalizedQuery}`
}

function cacheSearchResults(cacheKey, results) {
  state.searchCache.set(cacheKey, results)
  if (state.searchCache.size <= SEARCH_CACHE_LIMIT) {
    return
  }

  const oldestKey = state.searchCache.keys().next().value
  if (oldestKey) {
    state.searchCache.delete(oldestKey)
  }
}

function clearSearchCaches() {
  state.searchCache.clear()
  state.naturalSearchPlanCache.clear()
  state.filteredBookmarksCacheKey = ''
  state.filteredBookmarksCache = []
}

function yieldWork() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve)
  })
}

function formatLocalDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isSmartClassifiableUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
}

function getCurrentPageTitle() {
  return String(state.currentTab?.title || '').trim() || '未命名网页'
}

function getSmartFallbackIconLabel(title) {
  const normalized = String(title || '').trim()
  return normalized ? normalized.slice(0, 1).toUpperCase() : 'C'
}

function getSmartLoadingLabel() {
  if (state.smartStep <= 1) {
    return '读取网页内容…'
  }
  if (state.smartStep === 2) {
    return 'AI 分析内容…'
  }
  return '匹配已有文件夹…'
}

function getSmartProgressTarget() {
  const step = Math.max(1, Math.min(state.smartStep || 1, SMART_LOADING_STEP_COUNT))
  return Math.max(10, Math.min((step / SMART_LOADING_STEP_COUNT) * 100, 100))
}

function waitForSmartLoadingPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve)
  })
}

function cleanSmartTitle(value) {
  const title = cleanSmartText(value, 90)
  return title || getCurrentPageTitle()
}

function cleanSmartText(value, limit = 180) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function normalizeSmartConfidence(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(numeric, 1))
  }
  return 0
}

function normalizeSmartFolderPath(value) {
  const segments = splitSmartFolderPath(value)
  return segments.join(' / ')
}

function splitSmartFolderPath(value) {
  return String(value || '')
    .split(/\s*(?:\/|>|›|»|\\)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function getLastPathSegment(value) {
  const segments = splitSmartFolderPath(value)
  return segments.at(-1) || cleanSmartText(value, 60) || '推荐文件夹'
}

function formatSmartFolderPath(path) {
  return splitSmartFolderPath(path).join(' · ') || '未归档路径'
}

function normalizeSmartError(error) {
  if (error?.name === 'AbortError') {
    return '请求超时，请稍后重试或调大通用设置中的请求超时。'
  }
  return error instanceof Error ? error.message : '智能分类失败，请稍后重试。'
}

function hasOpenModal() {
  return Boolean(
    state.isFilterPickerOpen ||
      state.moveTargetBookmarkId ||
      state.smartFolderPickerOpen ||
      state.editTargetBookmarkId ||
      state.confirmDeleteBookmarkId
  )
}

function getDefaultExpandedFolders(node) {
  if (!node || node.url) {
    return new Set()
  }

  return new Set([node.id])
}

function describeFolder(folder) {
  if (!folder) {
    return '文件夹'
  }

  const parts = []
  if (folder.folderCount) {
    parts.push(`${folder.folderCount} 个文件夹`)
  }
  if (folder.bookmarkCount) {
    parts.push(`${folder.bookmarkCount} 个书签`)
  }

  return parts.join(' · ') || '空文件夹'
}

function highlightText(text, query) {
  const safeText = String(text || '')
  const terms = getQueryTerms(normalizeQuery(query))

  if (!terms.length || !safeText) {
    return escapeHtml(safeText)
  }

  const lowerText = safeText.toLowerCase()
  const ranges = []

  for (const term of terms.sort((left, right) => right.length - left.length)) {
    let fromIndex = 0
    while (fromIndex < lowerText.length) {
      const matchIndex = lowerText.indexOf(term, fromIndex)
      if (matchIndex === -1) {
        break
      }
      ranges.push([matchIndex, matchIndex + term.length])
      fromIndex = matchIndex + term.length
    }
  }

  if (!ranges.length) {
    return escapeHtml(safeText)
  }

  ranges.sort((left, right) => left[0] - right[0])
  const mergedRanges = []

  for (const currentRange of ranges) {
    const previousRange = mergedRanges.at(-1)
    if (!previousRange || currentRange[0] > previousRange[1]) {
      mergedRanges.push([...currentRange])
      continue
    }

    previousRange[1] = Math.max(previousRange[1], currentRange[1])
  }

  let cursor = 0
  let output = ''

  for (const [start, end] of mergedRanges) {
    output += escapeHtml(safeText.slice(cursor, start))
    output += `<mark>${escapeHtml(safeText.slice(start, end))}</mark>`
    cursor = end
  }

  output += escapeHtml(safeText.slice(cursor))
  return output
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value) {
  return escapeHtml(value)
}

function showToast({ type = 'success', message, action = '', actionLabel = '' }) {
  const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const toast = {
    id,
    type,
    message,
    action,
    actionLabel
  }

  state.toasts = [...state.toasts, toast]
  renderToasts()

  const timeoutId = window.setTimeout(() => {
    dismissToast(id)
  }, action === 'undo-delete' ? UNDO_WINDOW_MS : 3200)

  state.toastTimers.set(id, timeoutId)
}

function dismissToast(toastId) {
  if (!toastId) {
    return
  }

  const timeoutId = state.toastTimers.get(toastId)
  if (timeoutId) {
    clearTimeout(timeoutId)
    state.toastTimers.delete(toastId)
  }

  const toastElement = dom.toastRoot.querySelector(`[data-toast-id="${CSS.escape(String(toastId))}"]`)
  state.toasts = state.toasts.filter((toast) => toast.id !== toastId)
  if (toastElement instanceof HTMLElement && !toastElement.classList.contains('is-closing')) {
    void closeWithExitMotion(toastElement, 'is-closing', () => {
      toastElement.remove()
    }, 220)
    return
  }

  renderToasts()
}
