import type {
  BookmarkSaveMessage,
  BookmarkSaveResult,
  NavigationCancelMessage,
  NavigationCheckMessage,
  NavigationCheckResult
} from '../shared/messages.js'
import type { BookmarkRecord, FolderRecord, NavigationNetworkEvidence } from '../shared/types.js'
import { extractBookmarkData } from '../shared/bookmark-tree.js'
import { BOOKMARK_ADD_HISTORY_LIMIT, STORAGE_KEYS } from '../shared/constants.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'
import { extractDomain } from '../shared/text.js'
import {
  extractAiErrorMessage,
  extractChatCompletionsJsonText,
  extractResponsesJsonText,
  getAiEndpoint
} from '../shared/ai-response.js'
import { normalizeAiNamingSettings, type AiNamingSettings } from '../options/sections/ai-settings.js'
import {
  AI_NAMING_DEFAULT_TIMEOUT_MS,
  AI_NAMING_JINA_READER_ORIGIN
} from '../options/shared-options/constants.js'
import {
  buildFallbackPageContentFromUrl,
  buildJinaReaderUrl,
  buildPageContextForAi,
  buildRemotePageContentFromText,
  combinePageContentContexts,
  normalizePageContentContext,
  type PageContentContext
} from '../options/sections/content-extraction.js'

interface PendingCheckState {
  tabId: number
  checkId: string
  requestedUrl: string
  lastUrl: string
  navigationStarted: boolean
  settled: boolean
  timeoutId: number
  networkEvidence: NavigationNetworkEvidence | null
  webRequestListeners: WebRequestListenerSet | null
  resolve: (result: NavigationCheckResult) => void
}

interface WebRequestListenerSet {
  beforeRequest: (details: chrome.webRequest.WebRequestBodyDetails) => void
  beforeRedirect: (details: chrome.webRequest.WebRedirectionResponseDetails) => void
  headersReceived: (details: chrome.webRequest.WebResponseHeadersDetails) => void
  completed: (details: chrome.webRequest.WebResponseCacheDetails) => void
  errorOccurred: (details: chrome.webRequest.WebResponseErrorDetails) => void
}

interface AutoClassifySuggestion {
  folderId: string
  folderPath: string
  reason: string
  confidence: number
}

interface AutoClassifyResult {
  title: string
  summary: string
  existingFolders: AutoClassifySuggestion[]
  newFolder: AutoClassifySuggestion
}

interface AutoFolderRecommendation {
  kind: 'existing' | 'new'
  folderId: string
  title: string
  path: string
  confidence: number
  reason: string
}

interface BookmarkAddHistoryEntry {
  id: string
  createdAt: number
  bookmarkId: string
  title: string
  url: string
  originalFolderPath: string
  targetFolderPath: string
  targetFolderId: string
  recommendationKind: 'existing' | 'new'
  moved: boolean
  confidence: number
  reason: string
  summary: string
  suggestedTitle: string
}

interface AutoAnalyzeQueueEntry {
  bookmarkId: string
  url: string
  title: string
  createdAt: number
  attempts: number
  nextRunAt: number
  lastError: string
}

const pendingChecks = new Map<number, PendingCheckState>()
const pendingCheckIds = new Map<string, number>()
const autoClassifyInFlight = new Set<string>()
const suppressedAutoBookmarkUrls = new Map<string, number>()
let bookmarkAddHistoryWriteQueue = Promise.resolve()
let autoAnalyzeQueueWriteQueue: Promise<unknown> = Promise.resolve()
let autoAnalyzeQueueProcessing = false
let autoAnalyzeQueueTimer = 0
const MAX_PENDING_NAVIGATION_CHECKS = 4
const AUTO_CLASSIFY_SUPPRESS_MS = 10000
const AUTO_CLASSIFY_DELAY_MS = 900
const AUTO_CLASSIFY_FOLDER_LIMIT = 260
const AUTO_ANALYZE_QUEUE_ALARM = 'curator-auto-analyze-queue'
const AUTO_ANALYZE_QUEUE_LIMIT = 50
const AUTO_ANALYZE_QUEUE_MAX_ATTEMPTS = 3
const AUTO_ANALYZE_QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const AUTO_ANALYZE_QUEUE_RETRY_MS = 45000

const AUTO_CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'existing_folders', 'new_folder'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    existing_folders: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['folder_id', 'folder_path', 'reason', 'confidence'],
        properties: {
          folder_id: { type: 'string' },
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
} as const

type RuntimeMessage = BookmarkSaveMessage | NavigationCheckMessage | NavigationCancelMessage

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_ANALYZE_QUEUE_ALARM) {
    scheduleAutoAnalyzeQueueProcessing(0)
  }
})

scheduleAutoAnalyzeQueueProcessing(0)

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'bookmark:save') {
    saveBookmarkFromMessage(message)
      .then((result) => {
        sendResponse({ ok: true, result })
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : '后台保存书签失败。'
        })
      })

    return true
  }

  if (message?.type === 'availability:cancel') {
    cancelNavigationCheck(message.checkId)
    sendResponse({ ok: true })
    return undefined
  }

  if (message?.type !== 'availability:navigate') {
    return undefined
  }

  performNavigationCheck({
    url: message.url,
    timeoutMs: message.timeoutMs,
    checkId: message.checkId
  })
    .then((result) => {
      sendResponse({ ok: true, result })
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : '后台导航检测失败。'
      })
    })

  return true
})

chrome.bookmarks.onCreated.addListener((bookmarkId, node) => {
  if (!node.url || !/^https?:\/\//i.test(node.url)) {
    return
  }

  void handleBookmarkCreatedForAutoAnalysis(String(bookmarkId), node)
})

chrome.webNavigation.onCommitted.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (isAboutBlank(details.url)) {
    return
  }

  state.navigationStarted = true
  state.lastUrl = details.url
})

chrome.webNavigation.onCompleted.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (!state.navigationStarted && isAboutBlank(details.url)) {
    return
  }

  finalizeNavigationCheck(details.tabId, {
    status: 'available',
    finalUrl: details.url || state.lastUrl || state.requestedUrl,
    detail: '后台标签页已完成页面导航。',
    errorCode: ''
  })
})

chrome.webNavigation.onErrorOccurred.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (!state.navigationStarted && isAboutBlank(details.url)) {
    return
  }

  finalizeNavigationCheck(details.tabId, {
    status: 'failed',
    finalUrl: state.lastUrl || details.url || state.requestedUrl,
    detail: `后台导航失败：${details.error}`,
    errorCode: details.error
  })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  const state = pendingChecks.get(tabId)
  if (!state) {
    return
  }

  finalizeNavigationCheck(
    tabId,
    {
      status: 'failed',
      finalUrl: state.lastUrl || state.requestedUrl,
      detail: '后台检测标签页被关闭。',
      errorCode: 'tab-removed'
    },
    { skipClose: true }
  )
})

async function handleBookmarkCreatedForAutoAnalysis(
  bookmarkId: string,
  node: chrome.bookmarks.BookmarkTreeNode
): Promise<void> {
  const initialUrl = String(node.url || '').trim()
  if (!initialUrl || autoClassifyInFlight.has(bookmarkId) || isAutoClassifyUrlSuppressed(initialUrl)) {
    return
  }

  await enqueueAutoAnalyzeBookmark({
    bookmarkId,
    url: initialUrl,
    title: String(node.title || '').trim()
  })
  scheduleAutoAnalyzeQueueProcessing(AUTO_CLASSIFY_DELAY_MS)
  scheduleAutoAnalyzeQueueAlarm(AUTO_CLASSIFY_DELAY_MS)
}

async function processAutoAnalyzeQueue(): Promise<void> {
  if (autoAnalyzeQueueProcessing) {
    return
  }

  autoAnalyzeQueueProcessing = true

  try {
    while (true) {
      const now = Date.now()
      const queue = await loadAutoAnalyzeQueue()
      const freshQueue = pruneAutoAnalyzeQueue(queue, now)
      const entry = freshQueue
        .filter((item) => item.nextRunAt <= now && !autoClassifyInFlight.has(item.bookmarkId))
        .sort((left, right) => left.nextRunAt - right.nextRunAt || left.createdAt - right.createdAt)[0]

      if (!entry) {
        scheduleNextAutoAnalyzeQueueWake(freshQueue)
        return
      }

      autoClassifyInFlight.add(entry.bookmarkId)

      try {
        await runAutoAnalysisForBookmark(entry.bookmarkId)
        await removeAutoAnalyzeQueueEntry(entry.bookmarkId)
      } catch (error) {
        const message = getErrorMessage(error)
        console.warn('[Curator] 自动分析书签失败', {
          bookmarkId: entry.bookmarkId,
          url: entry.url,
          error: message
        })
        await markAutoAnalyzeQueueEntryFailed(entry.bookmarkId, message)
      } finally {
        autoClassifyInFlight.delete(entry.bookmarkId)
      }
    }
  } finally {
    autoAnalyzeQueueProcessing = false
  }
}

async function runAutoAnalysisForBookmark(bookmarkId: string): Promise<void> {
  const settings = await loadAutoAnalyzeSettings()
  if (!settings.autoAnalyzeBookmarks || !hasUsableAiSettings(settings)) {
    return
  }

  const providerOrigin = getOriginPermissionPattern(settings.baseUrl)
  if (!providerOrigin || !(await containsHostPermission(providerOrigin))) {
    throw new Error('缺少 AI 服务地址访问权限，请在设置页重新测试连接或保存自动分析设置。')
  }

  const bookmark = await getBookmarkById(bookmarkId)
  if (!bookmark?.url || !/^https?:\/\//i.test(bookmark.url)) {
    return
  }

  const tree = await getBookmarkTree()
  const rootNode = Array.isArray(tree) ? tree[0] : tree
  const extracted = extractBookmarkData(rootNode)
  const bookmarkRecord = extracted.bookmarkMap.get(bookmarkId) || buildAutoBookmarkRecord(bookmark)
  const pageContext = await buildAutoPageContext(bookmarkRecord, settings)
  const aiResult = await requestAutoClassification({
    settings,
    pageContext,
    bookmark: bookmarkRecord,
    folders: extracted.folders
  })
  const recommendation = chooseAutoFolderRecommendation(aiResult, extracted.folders, bookmarkRecord)
  if (!recommendation) {
    return
  }

  const folderId = recommendation.kind === 'new'
    ? await ensureBookmarkFolderPath(recommendation.path)
    : recommendation.folderId
  if (!folderId) {
    throw new Error('AI 已返回推荐文件夹，但无法解析目标文件夹。')
  }

  const latestBookmark = await getBookmarkById(bookmarkId)
  if (!latestBookmark?.url || normalizeAutoUrl(latestBookmark.url) !== normalizeAutoUrl(bookmark.url)) {
    return
  }

  const originalParentId = String(latestBookmark.parentId || bookmark.parentId || '')
  const moved = originalParentId !== folderId
  let currentBookmark = latestBookmark
  if (moved) {
    currentBookmark = await moveBookmarkNode(bookmarkId, folderId)
  }

  const suggestedTitle = cleanAutoTitle(aiResult.title, currentBookmark.title || bookmarkRecord.title)
  let finalBookmarkTitle = currentBookmark.title || bookmarkRecord.title
  if (suggestedTitle && normalizeText(suggestedTitle) !== normalizeText(finalBookmarkTitle)) {
    try {
      const updatedBookmark = await updateBookmarkNode(bookmarkId, { title: suggestedTitle })
      finalBookmarkTitle = updatedBookmark.title || suggestedTitle
    } catch (error) {
      console.warn('[Curator] 自动分析书签改名失败', error)
    }
  }

  appendBookmarkAddHistory({
    id: `bookmark-add-${Date.now()}-${bookmarkId}`,
    createdAt: Date.now(),
    bookmarkId,
    title: finalBookmarkTitle,
    url: bookmark.url,
    originalFolderPath: bookmarkRecord.path || extracted.folderMap.get(originalParentId)?.path || '',
    targetFolderPath: recommendation.path || recommendation.title,
    targetFolderId: folderId,
    recommendationKind: recommendation.kind,
    moved,
    confidence: recommendation.confidence,
    reason: recommendation.reason,
    summary: aiResult.summary,
    suggestedTitle
  }).catch((error) => {
    console.warn('[Curator] 添加书签历史写入失败', error)
  })

  await persistPendingAutoAnalyzeNotice({
    bookmarkTitle: finalBookmarkTitle,
    folderPath: recommendation.path || recommendation.title,
    confidence: recommendation.confidence
  }).catch((error) => {
    console.warn('[Curator] 自动分析待提示写入失败', error)
  })

  await notifyAutoAnalysisSuccess({
    bookmarkTitle: finalBookmarkTitle,
    folderPath: recommendation.path || recommendation.title,
    confidence: recommendation.confidence
  }).catch((error) => {
    console.warn('[Curator] 自动分析通知发送失败', error)
  })
}

function scheduleAutoAnalyzeQueueProcessing(delayMs = 0): void {
  if (autoAnalyzeQueueTimer) {
    clearTimeout(autoAnalyzeQueueTimer)
  }

  autoAnalyzeQueueTimer = self.setTimeout(() => {
    autoAnalyzeQueueTimer = 0
    processAutoAnalyzeQueue().catch((error) => {
      console.warn('[Curator] 自动分析队列处理失败', error)
      scheduleAutoAnalyzeQueueAlarm(AUTO_ANALYZE_QUEUE_RETRY_MS)
    })
  }, Math.max(0, delayMs))
}

function scheduleNextAutoAnalyzeQueueWake(queue: AutoAnalyzeQueueEntry[]): void {
  const now = Date.now()
  const nextRunAt = queue
    .map((entry) => Number(entry.nextRunAt) || 0)
    .filter((value) => value > now)
    .sort((left, right) => left - right)[0]

  if (!nextRunAt) {
    clearAutoAnalyzeQueueAlarm()
    return
  }

  scheduleAutoAnalyzeQueueAlarm(Math.max(1000, nextRunAt - now))
}

function scheduleAutoAnalyzeQueueAlarm(delayMs: number): void {
  if (!chrome.alarms?.create) {
    return
  }

  chrome.alarms.create(AUTO_ANALYZE_QUEUE_ALARM, {
    delayInMinutes: Math.max(0.1, delayMs / 60000)
  })
}

function clearAutoAnalyzeQueueAlarm(): void {
  if (!chrome.alarms?.clear) {
    return
  }

  chrome.alarms.clear(AUTO_ANALYZE_QUEUE_ALARM, () => {
    void chrome.runtime.lastError
  })
}

async function enqueueAutoAnalyzeBookmark({
  bookmarkId,
  url,
  title
}: {
  bookmarkId: string
  url: string
  title: string
}): Promise<void> {
  const now = Date.now()
  await updateAutoAnalyzeQueue((entries) => {
    const nextEntry: AutoAnalyzeQueueEntry = {
      bookmarkId,
      url,
      title,
      createdAt: now,
      attempts: 0,
      nextRunAt: now + AUTO_CLASSIFY_DELAY_MS,
      lastError: ''
    }
    return [
      nextEntry,
      ...entries.filter((entry) => entry.bookmarkId !== bookmarkId)
    ].slice(0, AUTO_ANALYZE_QUEUE_LIMIT)
  })
}

async function markAutoAnalyzeQueueEntryFailed(bookmarkId: string, lastError: string): Promise<void> {
  const now = Date.now()
  await updateAutoAnalyzeQueue((entries) => {
    return entries
      .map((entry) => {
        if (entry.bookmarkId !== bookmarkId) {
          return entry
        }

        const attempts = Number(entry.attempts || 0) + 1
        return {
          ...entry,
          attempts,
          lastError,
          nextRunAt: now + AUTO_ANALYZE_QUEUE_RETRY_MS * attempts
        }
      })
      .filter((entry) => entry.attempts < AUTO_ANALYZE_QUEUE_MAX_ATTEMPTS)
  })
  scheduleAutoAnalyzeQueueAlarm(AUTO_ANALYZE_QUEUE_RETRY_MS)
}

async function removeAutoAnalyzeQueueEntry(bookmarkId: string): Promise<void> {
  await updateAutoAnalyzeQueue((entries) => {
    return entries.filter((entry) => entry.bookmarkId !== bookmarkId)
  })
}

function updateAutoAnalyzeQueue(
  updater: (entries: AutoAnalyzeQueueEntry[]) => AutoAnalyzeQueueEntry[]
): Promise<AutoAnalyzeQueueEntry[]> {
  const task = autoAnalyzeQueueWriteQueue.then(async () => {
    const entries = await loadAutoAnalyzeQueue()
    const nextEntries = pruneAutoAnalyzeQueue(updater(entries), Date.now())
    await saveAutoAnalyzeQueue(nextEntries)
    return nextEntries
  })

  autoAnalyzeQueueWriteQueue = task.catch(() => {})
  return task
}

async function loadAutoAnalyzeQueue(): Promise<AutoAnalyzeQueueEntry[]> {
  const stored = await getLocalStorage([STORAGE_KEYS.autoAnalyzeQueue])
  return normalizeAutoAnalyzeQueue(stored[STORAGE_KEYS.autoAnalyzeQueue])
}

async function saveAutoAnalyzeQueue(entries: AutoAnalyzeQueueEntry[]): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.autoAnalyzeQueue]: {
      version: 1,
      entries: pruneAutoAnalyzeQueue(entries, Date.now())
    }
  })
}

function normalizeAutoAnalyzeQueue(rawQueue: unknown): AutoAnalyzeQueueEntry[] {
  const source = rawQueue && typeof rawQueue === 'object'
    ? rawQueue as { entries?: unknown }
    : {}
  const entries = Array.isArray(source.entries)
    ? source.entries
    : Array.isArray(rawQueue)
      ? rawQueue
      : []

  return entries
    .map((entry: any) => {
      const bookmarkId = String(entry?.bookmarkId || '').trim()
      const url = String(entry?.url || '').trim()
      const createdAt = Number(entry?.createdAt) || 0
      if (!bookmarkId || !url || !createdAt) {
        return null
      }

      return {
        bookmarkId,
        url,
        title: cleanText(entry?.title || ''),
        createdAt,
        attempts: Math.max(0, Math.round(Number(entry?.attempts) || 0)),
        nextRunAt: Number(entry?.nextRunAt) || createdAt,
        lastError: cleanText(entry?.lastError || '')
      } as AutoAnalyzeQueueEntry
    })
    .filter(Boolean)
    .sort((left, right) => Number(left?.nextRunAt || 0) - Number(right?.nextRunAt || 0))
    .slice(0, AUTO_ANALYZE_QUEUE_LIMIT) as AutoAnalyzeQueueEntry[]
}

function pruneAutoAnalyzeQueue(entries: AutoAnalyzeQueueEntry[], now = Date.now()): AutoAnalyzeQueueEntry[] {
  return entries
    .filter((entry) => {
      return (
        entry.bookmarkId &&
        entry.url &&
        entry.createdAt &&
        now - entry.createdAt <= AUTO_ANALYZE_QUEUE_MAX_AGE_MS &&
        Number(entry.attempts || 0) < AUTO_ANALYZE_QUEUE_MAX_ATTEMPTS
      )
    })
    .slice(0, AUTO_ANALYZE_QUEUE_LIMIT)
}

async function loadAutoAnalyzeSettings(): Promise<AiNamingSettings> {
  const stored = await getLocalStorage([STORAGE_KEYS.aiProviderSettings])
  return normalizeAiNamingSettings(stored[STORAGE_KEYS.aiProviderSettings])
}

function hasUsableAiSettings(settings: AiNamingSettings): boolean {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model)
}

function buildAutoBookmarkRecord(node: chrome.bookmarks.BookmarkTreeNode): BookmarkRecord {
  const url = String(node.url || '')
  return {
    id: String(node.id || ''),
    title: String(node.title || '').trim() || '未命名书签',
    url,
    displayUrl: url,
    normalizedTitle: normalizeText(node.title || ''),
    normalizedUrl: url,
    duplicateKey: url,
    domain: extractDomain(url),
    path: '',
    ancestorIds: [],
    parentId: String(node.parentId || ''),
    index: typeof node.index === 'number' ? node.index : 0,
    dateAdded: Number(node.dateAdded) || 0
  }
}

async function buildAutoPageContext(
  bookmark: BookmarkRecord,
  settings: AiNamingSettings
): Promise<PageContentContext> {
  const timeoutMs = settings.timeoutMs
  let context: PageContentContext

  try {
    const response = await fetchWithAutoTimeout(bookmark.url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer'
    }, timeoutMs)
    const finalUrl = String(response.url || bookmark.url || '')
    const contentType = String(response.headers.get('content-type') || '').toLowerCase()

    if (contentType.includes('text/html')) {
      const html = await response.text()
      context = buildAutoPageContentFromHtml(html, {
        url: finalUrl,
        currentTitle: bookmark.title,
        contentType
      })
    } else {
      context = buildFallbackPageContentFromUrl(finalUrl, {
        currentTitle: bookmark.title,
        contentType
      })
    }
  } catch (error) {
    context = buildFallbackPageContentFromUrl(bookmark.url, {
      currentTitle: bookmark.title,
      error
    })
  }

  if (!settings.allowRemoteParsing) {
    return normalizePageContentContext(context)
  }

  if (!(await containsHostPermission(AI_NAMING_JINA_READER_ORIGIN))) {
    return normalizePageContentContext({
      ...context,
      warnings: [
        ...(context.warnings || []),
        '未授予 Jina Reader 访问权限，自动分析仅使用本地抽取内容。'
      ]
    })
  }

  try {
    const remoteContext = await fetchAutoRemotePageContext(context.finalUrl || bookmark.url, timeoutMs, context)
    return combinePageContentContexts(context, remoteContext)
  } catch (error) {
    return normalizePageContentContext({
      ...context,
      warnings: [
        ...(context.warnings || []),
        `远程解析失败：${getErrorMessage(error)}`
      ]
    })
  }
}

function buildAutoPageContentFromHtml(
  html: string,
  { url = '', currentTitle = '', contentType = '' } = {}
): PageContentContext {
  const rawHtml = String(html || '')
  const title = cleanAutoText(
    matchHtml(rawHtml, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
      matchMeta(rawHtml, 'og:title') ||
      currentTitle
  )
  const description = cleanAutoText(matchMeta(rawHtml, 'description') || matchMeta(rawHtml, 'og:description'))
  const ogTitle = cleanAutoText(matchMeta(rawHtml, 'og:title'))
  const ogDescription = cleanAutoText(matchMeta(rawHtml, 'og:description'))
  const ogType = cleanAutoText(matchMeta(rawHtml, 'og:type'))
  const lang = cleanAutoText(matchHtml(rawHtml, /<html[^>]*\slang=["']?([^"'\s>]+)/i))
  const canonicalUrl = cleanAutoText(matchHtml(rawHtml, /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["']/i))
  const headings = Array.from(rawHtml.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((match) => cleanAutoText(match[1]))
    .filter(Boolean)
    .slice(0, 28)
  const mainText = extractAutoReadableHtmlText(rawHtml)

  return normalizePageContentContext({
    finalUrl: String(url || '').trim(),
    title,
    description,
    ogTitle,
    ogDescription,
    ogType,
    canonicalUrl,
    lang,
    headings,
    mainText,
    linkContext: [],
    contentType: String(contentType || '').toLowerCase(),
    source: 'html',
    extractionStatus: mainText.length >= 420 ? 'ok' : 'limited',
    contentLength: mainText.length,
    warnings: mainText.length >= 420 ? [] : ['正文抽取内容较少，结果置信度可能偏低。']
  })
}

function matchMeta(html: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escapedName}["'][^>]*>`, 'i')
  ]

  for (const pattern of patterns) {
    const value = matchHtml(html, pattern)
    if (value) {
      return value
    }
  }

  return ''
}

function matchHtml(html: string, pattern: RegExp): string {
  return String(html || '').match(pattern)?.[1] || ''
}

function extractAutoReadableHtmlText(html: string): string {
  return cleanAutoText(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<(?:p|li|blockquote|pre|h[1-3])[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).slice(0, 9000)
}

function cleanAutoText(value: unknown): string {
  return decodeHtmlEntities(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code) || 32))
}

async function fetchAutoRemotePageContext(
  url: string,
  timeoutMs: number,
  fallbackContext: PageContentContext
): Promise<PageContentContext> {
  const readerUrl = buildJinaReaderUrl(url)
  if (!readerUrl) {
    throw new Error('远程解析 URL 无效。')
  }

  const response = await fetchWithAutoTimeout(readerUrl, {
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
    url: fallbackContext.finalUrl || url,
    currentTitle: fallbackContext.title
  })
}

async function requestAutoClassification({
  settings,
  pageContext,
  bookmark,
  folders
}: {
  settings: AiNamingSettings
  pageContext: PageContentContext
  bookmark: BookmarkRecord
  folders: FolderRecord[]
}): Promise<AutoClassifyResult> {
  const endpoint = getAiEndpoint(settings)
  const requestBody = buildAutoClassifyRequestBody({ settings, pageContext, bookmark, folders })
  const response = await fetchWithAutoTimeout(endpoint, {
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
    return normalizeAutoAiResult(JSON.parse(rawJsonText))
  } catch {
    throw new Error('AI 返回了无法解析的 JSON 结果。')
  }
}

function buildAutoClassifyRequestBody({
  settings,
  pageContext,
  bookmark,
  folders
}: {
  settings: AiNamingSettings
  pageContext: PageContentContext
  bookmark: BookmarkRecord
  folders: FolderRecord[]
}): Record<string, unknown> {
  const systemPrompt = [
    '你是浏览器书签自动分类助手。',
    '你需要根据当前网页内容和用户已有书签文件夹，为新增书签推荐保存位置。',
    '如果 page_context.source_contexts 同时包含“本地抽取”和“Jina Reader”，请结合两路内容判断。',
    '必须优先推荐 existing_folders 中已经存在的文件夹；如果多个文件夹都匹配，优先选择嵌套层级最深、语义最具体的文件夹。',
    'existing_folders 数组只能填写输入中存在的 folder_id 和 folder_path，不要编造已有文件夹。',
    '返回 existing_folders 时必须原样带回候选中的 folder_id；folder_path 也尽量原样复制候选值。',
    'new_folder 只能作为没有合适已有文件夹时的备用建议，路径要短，适合用户新建。',
    'title 要适合作为浏览器书签标题，简短清晰，不要包含无意义站点后缀。',
    'confidence 必须是 0 到 1 的数字。'
  ].join('\n')
  const userPrompt = JSON.stringify({
    current_page: {
      title: bookmark.title,
      url: bookmark.url,
      domain: extractDomain(bookmark.url),
      page_context: buildPageContextForAi(normalizePageContentContext(pageContext), { mainTextLimit: 4200 })
    },
    existing_folders: buildAutoFolderCandidates(folders)
  }, null, 2)

  if (settings.apiStyle === 'chat_completions') {
    const schemaHint = '\n\n请严格按以下 JSON 格式返回结果，不要添加任何额外文本或 markdown 标记：\n' + JSON.stringify(AUTO_CLASSIFY_SCHEMA, null, 2)
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
        name: 'auto_bookmark_classification',
        strict: true,
        schema: AUTO_CLASSIFY_SCHEMA
      }
    }
  }
}

function buildAutoFolderCandidates(folders: FolderRecord[]): Array<Record<string, unknown>> {
  return folders
    .slice()
    .sort(compareFoldersByDepth)
    .slice(0, AUTO_CLASSIFY_FOLDER_LIMIT)
    .map((folder) => ({
      folder_id: String(folder.id),
      folder_path: String(folder.path || folder.title || ''),
      title: String(folder.title || ''),
      depth: Number(folder.depth) || 0
    }))
}

function chooseAutoFolderRecommendation(
  aiResult: AutoClassifyResult,
  folders: FolderRecord[],
  bookmark: BookmarkRecord
): AutoFolderRecommendation | null {
  const existingRecommendations = aiResult.existingFolders
    .map((suggestion) => {
      const folder = findBestExistingFolder(suggestion, folders)
      if (!folder) {
        return null
      }

      return {
        kind: 'existing' as const,
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence: normalizeAutoConfidence(suggestion.confidence),
        reason: suggestion.reason || ''
      }
    })
    .filter(Boolean) as AutoFolderRecommendation[]

  const localFallbacks = buildLocalAutoFolderMatches(folders, bookmark)
  const merged = [...existingRecommendations, ...localFallbacks]
    .filter((recommendation, index, list) => {
      return list.findIndex((item) => item.folderId === recommendation.folderId) === index
    })
    .sort((left, right) => {
      const leftFolder = folders.find((folder) => folder.id === left.folderId)
      const rightFolder = folders.find((folder) => folder.id === right.folderId)
      return (
        right.confidence - left.confidence ||
        Number(rightFolder?.depth || 0) - Number(leftFolder?.depth || 0) ||
        left.path.localeCompare(right.path, 'zh-Hans-CN')
      )
    })

  if (merged[0]) {
    return merged[0]
  }

  const newFolderPath = normalizeAutoFolderPath(aiResult.newFolder?.folderPath)
  if (newFolderPath && normalizeAutoConfidence(aiResult.newFolder?.confidence) >= 0.65) {
    return {
      kind: 'new',
      folderId: '',
      title: getLastPathSegment(newFolderPath),
      path: newFolderPath,
      confidence: normalizeAutoConfidence(aiResult.newFolder?.confidence),
      reason: aiResult.newFolder?.reason || ''
    }
  }

  return null
}

function findBestExistingFolder(
  suggestion: AutoClassifySuggestion | string,
  folders: FolderRecord[]
): FolderRecord | null {
  const folderId = typeof suggestion === 'string'
    ? ''
    : String(suggestion.folderId || '').trim()
  if (folderId) {
    const exactIdMatch = folders.find((folder) => String(folder.id) === folderId)
    if (exactIdMatch) {
      return exactIdMatch
    }
  }

  const rawPath = typeof suggestion === 'string' ? suggestion : suggestion.folderPath
  const normalizedPath = normalizeFolderPathForMatch(rawPath)
  if (!normalizedPath) {
    return null
  }

  const exactPathMatches = folders.filter((folder) => normalizeFolderPathForMatch(folder.path || folder.title) === normalizedPath)
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
    const folderPath = normalizeFolderPathForMatch(folder.path || folder.title)
    return folderPath.includes(normalizedPath) || normalizedPath.includes(folderPath)
  })
  return containsMatches.length ? pickDeepestFolder(containsMatches) : null
}

function pickDeepestFolder(folders: FolderRecord[]): FolderRecord | null {
  return folders.slice().sort(compareFoldersByDepth)[0] || null
}

function compareFoldersByDepth(left: FolderRecord, right: FolderRecord): number {
  return Number(right.depth || 0) - Number(left.depth || 0) || String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
}

function buildLocalAutoFolderMatches(
  folders: FolderRecord[],
  bookmark: BookmarkRecord
): AutoFolderRecommendation[] {
  const titleText = normalizeText(bookmark.title)
  const urlText = normalizeText(bookmark.url)
  const domainText = normalizeText(extractDomain(bookmark.url))
  const haystack = [titleText, urlText, domainText].filter(Boolean).join(' ')

  return folders
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
        kind: 'existing' as const,
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence: Math.max(0.52, Math.min(score, 0.82)),
        reason: '基于当前网页标题、域名和文件夹路径的本地补充匹配。'
      }
    })
    .filter((item) => item.confidence > 0.54)
}

function normalizeAutoAiResult(payload: any): AutoClassifyResult {
  const existingFolders = Array.isArray(payload?.existing_folders)
    ? payload.existing_folders
    : []
  return {
    title: cleanText(payload?.title || ''),
    summary: cleanText(payload?.summary || ''),
    existingFolders: existingFolders
      .map((item: any) => ({
        folderId: cleanText(item?.folder_id || ''),
        folderPath: cleanText(item?.folder_path || ''),
        reason: cleanText(item?.reason || ''),
        confidence: normalizeAutoConfidence(item?.confidence)
      }))
      .filter((item: AutoClassifySuggestion) => item.folderId || item.folderPath),
    newFolder: {
      folderId: '',
      folderPath: cleanText(payload?.new_folder?.folder_path || ''),
      reason: cleanText(payload?.new_folder?.reason || ''),
      confidence: normalizeAutoConfidence(payload?.new_folder?.confidence)
    }
  }
}

function cleanAutoTitle(value: unknown, fallbackTitle: unknown): string {
  const title = cleanText(value)
  if (title) {
    return title.length <= 90
      ? title
      : `${title.slice(0, 89).trim()}…`
  }

  return cleanText(fallbackTitle) || '未命名书签'
}

function normalizeBookmarkAddHistoryEntries(rawHistory: unknown): BookmarkAddHistoryEntry[] {
  const source = rawHistory && typeof rawHistory === 'object'
    ? rawHistory as { entries?: unknown }
    : {}
  const entries = Array.isArray(source.entries)
    ? source.entries
    : Array.isArray(rawHistory)
      ? rawHistory
      : []

  return entries
    .map((entry: any) => {
      const bookmarkId = String(entry?.bookmarkId || '').trim()
      const url = String(entry?.url || '').trim()
      const createdAt = Number(entry?.createdAt) || 0
      if (!bookmarkId || !url || !createdAt) {
        return null
      }

      return {
        id: String(entry?.id || `bookmark-add-${createdAt}-${bookmarkId}`).trim(),
        createdAt,
        bookmarkId,
        title: cleanText(entry?.title || '未命名书签') || '未命名书签',
        url,
        originalFolderPath: cleanText(entry?.originalFolderPath || ''),
        targetFolderPath: cleanText(entry?.targetFolderPath || entry?.folderPath || ''),
        targetFolderId: String(entry?.targetFolderId || '').trim(),
        recommendationKind: String(entry?.recommendationKind || '').trim() === 'new' ? 'new' : 'existing',
        moved: Boolean(entry?.moved),
        confidence: normalizeAutoConfidence(entry?.confidence),
        reason: cleanText(entry?.reason || ''),
        summary: cleanText(entry?.summary || ''),
        suggestedTitle: cleanText(entry?.suggestedTitle || '')
      } as BookmarkAddHistoryEntry
    })
    .filter(Boolean)
    .sort((left, right) => Number(right?.createdAt || 0) - Number(left?.createdAt || 0))
    .slice(0, BOOKMARK_ADD_HISTORY_LIMIT) as BookmarkAddHistoryEntry[]
}

function appendBookmarkAddHistory(entry: BookmarkAddHistoryEntry): Promise<void> {
  const task = bookmarkAddHistoryWriteQueue.then(async () => {
    const stored = await getLocalStorage([STORAGE_KEYS.bookmarkAddHistory])
    const currentEntries = normalizeBookmarkAddHistoryEntries(stored[STORAGE_KEYS.bookmarkAddHistory])
    const nextEntries = normalizeBookmarkAddHistoryEntries({
      entries: [entry, ...currentEntries]
    })
    await setLocalStorage({
      [STORAGE_KEYS.bookmarkAddHistory]: {
        version: 1,
        entries: nextEntries
      }
    })
  })

  bookmarkAddHistoryWriteQueue = task.catch(() => {})
  return task
}

async function persistPendingAutoAnalyzeNotice({
  bookmarkTitle,
  folderPath,
  confidence
}: {
  bookmarkTitle: string
  folderPath: string
  confidence: number
}): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.pendingAutoAnalyzeNotice]: {
      createdAt: Date.now(),
      bookmarkTitle: cleanText(bookmarkTitle),
      folderPath: cleanText(folderPath),
      confidence: normalizeAutoConfidence(confidence)
    }
  })

  if (chrome.action?.setBadgeText) {
    await setActionBadgeText('AI')
    await setActionBadgeBackgroundColor('#365f45')
  }
}

async function notifyAutoAnalysisSuccess({
  bookmarkTitle,
  folderPath,
  confidence
}: {
  bookmarkTitle: string
  folderPath: string
  confidence: number
}): Promise<void> {
  const permissionLevel = await getNotificationPermissionLevel()
  if (permissionLevel !== 'granted') {
    throw new Error(`Chrome 通知权限不可用：${permissionLevel}`)
  }

  await createNotification({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/assets/icon128.png'),
    title: `已添加到 ${truncateText(folderPath, 48)}`,
    message: truncateText(bookmarkTitle, 72),
    contextMessage: `AI 自动分析 · ${Math.round(Math.max(0, Math.min(confidence, 1)) * 100)}%`,
    priority: 2,
    requireInteraction: true,
    silent: false
  })
}

function createNotification(options: chrome.notifications.NotificationOptions<true>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!chrome.notifications?.create) {
      reject(new Error('当前环境不可用 Chrome notifications API。'))
      return
    }

    chrome.notifications.create(`auto-classify-${Date.now()}-${Math.random().toString(16).slice(2)}`, options, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function getNotificationPermissionLevel(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!chrome.notifications?.getPermissionLevel) {
      reject(new Error('当前环境不可用 Chrome notifications API。'))
      return
    }

    chrome.notifications.getPermissionLevel((level) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(String(level || 'denied'))
    })
  })
}

function setActionBadgeText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.action.setBadgeText({ text }, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function setActionBadgeBackgroundColor(color: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.action.setBadgeBackgroundColor({ color }, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function fetchWithAutoTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = AI_NAMING_DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = self.setTimeout(() => {
    controller.abort()
  }, Math.max(1000, Number(timeoutMs) || AI_NAMING_DEFAULT_TIMEOUT_MS))

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeoutId)
  })
}

function normalizeAutoConfidence(value: unknown): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(numeric, 1))
  }
  return 0
}

function normalizeAutoFolderPath(value: unknown): string {
  return splitFolderPath(String(value || '')).join(' / ')
}

function normalizeFolderPathForMatch(value: unknown): string {
  const segments = splitFolderPath(String(value || ''))
    .map((segment) => normalizeText(segment))
    .filter(Boolean)
  return segments.length ? segments.join(' / ') : normalizeText(String(value || ''))
}

function getLastPathSegment(value: string): string {
  const segments = splitFolderPath(value)
  return segments.at(-1) || cleanText(value).slice(0, 60) || '推荐文件夹'
}

function truncateText(value: unknown, limit: number): string {
  const text = cleanText(value)
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && (error as Error).name === 'AbortError') {
    return '请求超时。'
  }
  return error instanceof Error ? error.message : '未知错误。'
}

function suppressAutoClassifyUrl(url: string): void {
  const normalizedUrl = normalizeAutoUrl(url)
  if (!normalizedUrl) {
    return
  }
  suppressedAutoBookmarkUrls.set(normalizedUrl, Date.now() + AUTO_CLASSIFY_SUPPRESS_MS)
}

function isAutoClassifyUrlSuppressed(url: string): boolean {
  const normalizedUrl = normalizeAutoUrl(url)
  if (!normalizedUrl) {
    return false
  }

  const now = Date.now()
  for (const [key, expiresAt] of suppressedAutoBookmarkUrls.entries()) {
    if (expiresAt <= now) {
      suppressedAutoBookmarkUrls.delete(key)
    }
  }

  const expiresAt = suppressedAutoBookmarkUrls.get(normalizedUrl)
  if (!expiresAt || expiresAt <= now) {
    suppressedAutoBookmarkUrls.delete(normalizedUrl)
    return false
  }

  suppressedAutoBookmarkUrls.delete(normalizedUrl)
  return true
}

function normalizeAutoUrl(url: string): string {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    parsedUrl.hash = ''
    return parsedUrl.toString()
  } catch {
    return String(url || '').trim()
  }
}

async function saveBookmarkFromMessage(message: BookmarkSaveMessage): Promise<BookmarkSaveResult> {
  const url = String(message.url || '').trim()
  const title = String(message.title || '').trim() || '未命名网页'
  const parentId = String(message.parentId || '').trim() ||
    (message.folderPath ? await ensureBookmarkFolderPath(message.folderPath) : '')

  if (!/^https?:\/\//i.test(url)) {
    throw new Error('当前页面不是可保存的普通网页。')
  }

  if (!parentId) {
    throw new Error('未找到可保存的目标文件夹。')
  }

  const bookmarkId = String(message.bookmarkId || '').trim()
  if (bookmarkId) {
    const existingBookmark = await getBookmarkById(bookmarkId)
    if (existingBookmark?.url) {
      let node = existingBookmark
      if (existingBookmark.parentId !== parentId) {
        node = await moveBookmarkNode(bookmarkId, parentId)
      }
      if (title && title !== node.title) {
        node = await updateBookmarkNode(bookmarkId, { title })
      }

      return {
        bookmarkId: String(node.id),
        parentId: String(node.parentId || parentId),
        title: String(node.title || title),
        url: String(node.url || url),
        created: false
      }
    }
  }

  suppressAutoClassifyUrl(url)
  const createdNode = await createBookmarkNode({
    parentId,
    title,
    url
  })

  return {
    bookmarkId: String(createdNode.id),
    parentId: String(createdNode.parentId || parentId),
    title: String(createdNode.title || title),
    url: String(createdNode.url || url),
    created: true
  }
}

async function ensureBookmarkFolderPath(path: string): Promise<string> {
  const rootNode = await getBookmarksBarNode()
  const rootTitle = String(rootNode.title || '').trim()
  const segments = splitFolderPath(path)
    .filter((segment, index) => {
      return index !== 0 || normalizeText(segment) !== normalizeText(rootTitle)
    })

  if (!segments.length) {
    return String(rootNode.id)
  }

  let parentNode = rootNode
  for (const segment of segments) {
    const existingChild = (parentNode.children || []).find((child) => {
      return !child.url && normalizeText(child.title || '') === normalizeText(segment)
    })

    if (existingChild) {
      parentNode = existingChild
      continue
    }

    parentNode = await createBookmarkNode({
      parentId: String(parentNode.id),
      title: segment
    })
  }

  return String(parentNode.id)
}

async function getBookmarksBarNode(): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const tree = await getBookmarkTree()
  const rootNode = Array.isArray(tree) ? tree[0] : tree
  const candidates = rootNode?.children || []
  const bookmarksBar = candidates.find((node) => {
    const title = String(node.title || '').toLowerCase()
    return node.id === '1' || title.includes('bookmarks bar') || title.includes('书签栏')
  })
  const fallback = candidates.find((node) => !node.url)

  if (!bookmarksBar && !fallback) {
    throw new Error('未找到可创建文件夹的书签根目录。')
  }

  return bookmarksBar || fallback!
}

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

function getBookmarkById(bookmarkId: string): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.get(bookmarkId, (nodes) => {
      const error = chrome.runtime.lastError
      if (error) {
        resolve(null)
        return
      }

      resolve(nodes?.[0] || null)
    })
  })
}

function createBookmarkNode(
  payload: chrome.bookmarks.BookmarkCreateArg
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(payload, (node) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(node)
    })
  })
}

function moveBookmarkNode(
  bookmarkId: string,
  parentId: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(bookmarkId, { parentId }, (node) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(node)
    })
  })
}

function updateBookmarkNode(
  bookmarkId: string,
  changes: chrome.bookmarks.BookmarkChangesArg
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(bookmarkId, changes, (node) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(node)
    })
  })
}

function splitFolderPath(value: string): string[] {
  return String(value || '')
    .split(/\s*(?:->|\/|>|›|»|\\|·|•|→|➜)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function performNavigationCheck({
  url,
  timeoutMs,
  checkId
}: {
  url: string
  timeoutMs?: number
  checkId?: string
}): Promise<NavigationCheckResult> {
  if (!/^https?:\/\//i.test(String(url || ''))) {
    throw new Error('仅支持检测 http/https 书签。')
  }

  if (pendingChecks.size >= MAX_PENDING_NAVIGATION_CHECKS) {
    throw new Error('后台导航检测正忙，请稍后重试。')
  }

  const effectiveTimeout = normalizeTimeout(timeoutMs)
  const tab = await createTab({
    url: 'about:blank',
    active: false
  })

  if (!tab?.id) {
    throw new Error('后台检测标签页创建失败。')
  }

  return new Promise<NavigationCheckResult>((resolve) => {
    const state: PendingCheckState = {
      tabId: tab.id!,
      checkId: String(checkId || ''),
      requestedUrl: url,
      lastUrl: url,
      navigationStarted: false,
      settled: false,
      timeoutId: 0,
      networkEvidence: null,
      webRequestListeners: null,
      resolve
    }

    pendingChecks.set(tab.id!, state)
    if (state.checkId) {
      pendingCheckIds.set(state.checkId, tab.id!)
    }

    state.timeoutId = self.setTimeout(() => {
      finalizeNavigationCheck(tab.id!, {
        status: 'failed',
        finalUrl: state.lastUrl || state.requestedUrl,
        detail: `后台导航超时，超过 ${Math.round(effectiveTimeout / 1000)} 秒仍未完成页面加载。`,
        errorCode: 'timeout'
      })
    }, effectiveTimeout)

    startNavigationWithNetworkObserver(state, url).catch((error) => {
      finalizeNavigationCheck(tab.id!, {
        status: 'failed',
        finalUrl: url,
        detail: error instanceof Error ? error.message : '后台导航启动失败。',
        errorCode: 'tab-update-failed'
      })
    })
  })
}

async function startNavigationWithNetworkObserver(state: PendingCheckState, url: string): Promise<void> {
  await attachWebRequestListeners(state)
  if (state.settled) {
    return
  }

  await updateTab(state.tabId, { url })
}

async function attachWebRequestListeners(state: PendingCheckState): Promise<void> {
  const originPattern = getOriginPermissionPattern(state.requestedUrl)
  if (!originPattern || !(await containsHostPermission(originPattern)) || state.settled) {
    return
  }

  const filter: chrome.webRequest.RequestFilter = {
    urls: [originPattern],
    tabId: state.tabId,
    types: ['main_frame']
  }
  const listeners = createWebRequestListeners(state)

  try {
    chrome.webRequest.onBeforeRequest.addListener(listeners.beforeRequest, filter)
    chrome.webRequest.onBeforeRedirect.addListener(listeners.beforeRedirect, filter)
    chrome.webRequest.onHeadersReceived.addListener(listeners.headersReceived, filter)
    chrome.webRequest.onCompleted.addListener(listeners.completed, filter)
    chrome.webRequest.onErrorOccurred.addListener(listeners.errorOccurred, filter)
    state.webRequestListeners = listeners
  } catch {
    removeWebRequestListeners(listeners)
  }
}

function createWebRequestListeners(state: PendingCheckState): WebRequestListenerSet {
  return {
    beforeRequest(details) {
      if (state.settled) {
        return
      }

      getOrCreateNetworkEvidence(state, details)
    },
    beforeRedirect(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      const elapsedMs = getElapsedMs(evidence.timing.requestStartMs, details.timeStamp)
      evidence.redirects.push({
        url: details.url,
        redirectUrl: details.redirectUrl,
        statusCode: Number(details.statusCode) || 0,
        ...(Number.isFinite(elapsedMs) ? { elapsedMs } : {})
      })
      evidence.statusCode = Number(details.statusCode) || evidence.statusCode
      evidence.statusLine = details.statusLine || evidence.statusLine
      evidence.finalUrl = details.redirectUrl || evidence.finalUrl
      evidence.fromCache = Boolean(details.fromCache)
    },
    headersReceived(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      evidence.statusCode = Number(details.statusCode) || evidence.statusCode
      evidence.statusLine = details.statusLine || evidence.statusLine
      evidence.finalUrl = details.url || evidence.finalUrl
      if (!Number.isFinite(evidence.timing.responseStartMs)) {
        evidence.timing.responseStartMs = details.timeStamp
      }
      evidence.timing.responseLatencyMs = getElapsedMs(evidence.timing.requestStartMs, evidence.timing.responseStartMs)
    },
    completed(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      evidence.statusCode = Number(details.statusCode) || evidence.statusCode
      evidence.finalUrl = details.url || evidence.finalUrl
      evidence.fromCache = Boolean(details.fromCache)
      evidence.timing.completedMs = details.timeStamp
      evidence.timing.totalMs = getElapsedMs(evidence.timing.requestStartMs, evidence.timing.completedMs)
    },
    errorOccurred(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      evidence.errorCode = details.error || evidence.errorCode
      evidence.finalUrl = details.url || evidence.finalUrl
      evidence.timing.failedMs = details.timeStamp
      evidence.timing.totalMs = getElapsedMs(evidence.timing.requestStartMs, evidence.timing.failedMs)
    }
  }
}

function detachWebRequestListeners(state: PendingCheckState): void {
  if (!state.webRequestListeners) {
    return
  }

  removeWebRequestListeners(state.webRequestListeners)
  state.webRequestListeners = null
}

function removeWebRequestListeners(listeners: WebRequestListenerSet): void {
  chrome.webRequest.onBeforeRequest.removeListener(listeners.beforeRequest)
  chrome.webRequest.onBeforeRedirect.removeListener(listeners.beforeRedirect)
  chrome.webRequest.onHeadersReceived.removeListener(listeners.headersReceived)
  chrome.webRequest.onCompleted.removeListener(listeners.completed)
  chrome.webRequest.onErrorOccurred.removeListener(listeners.errorOccurred)
}

function containsHostPermission(originPattern: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [originPattern] }, (granted) => {
      const error = chrome.runtime.lastError
      resolve(!error && Boolean(granted))
    })
  })
}

function getOriginPermissionPattern(url: string): string {
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

function cancelNavigationCheck(checkId: string): void {
  const tabId = pendingCheckIds.get(String(checkId || ''))
  if (!tabId) {
    return
  }

  const state = pendingChecks.get(tabId)
  finalizeNavigationCheck(tabId, {
    status: 'failed',
    finalUrl: state?.lastUrl || state?.requestedUrl || '',
    detail: '后台导航检测已取消。',
    errorCode: 'cancelled'
  })
}

function getPendingState(
  details: { frameId: number; tabId: number } | null | undefined
): PendingCheckState | null {
  if (!details || details.frameId !== 0) {
    return null
  }

  return pendingChecks.get(details.tabId) || null
}

function finalizeNavigationCheck(
  tabId: number,
  result: NavigationCheckResult,
  { skipClose = false }: { skipClose?: boolean } = {}
): void {
  const state = pendingChecks.get(tabId)
  if (!state || state.settled) {
    return
  }

  state.settled = true
  detachWebRequestListeners(state)
  pendingChecks.delete(tabId)
  if (state.checkId) {
    pendingCheckIds.delete(state.checkId)
  }

  if (state.timeoutId) {
    clearTimeout(state.timeoutId)
  }

  if (!skipClose) {
    closeTab(tabId).catch(() => {})
  }

  state.resolve(attachNetworkEvidence(state, result))
}

function isAboutBlank(url: string | undefined): boolean {
  return String(url || '').startsWith('about:blank')
}

function getOrCreateNetworkEvidence(
  state: PendingCheckState,
  details: {
    requestId?: string
    method?: string
    url?: string
    timeStamp?: number
  }
): NavigationNetworkEvidence {
  if (!state.networkEvidence) {
    state.networkEvidence = {
      requestSent: true,
      requestId: details.requestId,
      method: details.method,
      requestedUrl: state.requestedUrl,
      finalUrl: details.url || state.lastUrl || state.requestedUrl,
      redirects: [],
      timing: {
        requestStartMs: normalizeTimestamp(details.timeStamp)
      }
    }
    return state.networkEvidence
  }

  state.networkEvidence.requestSent = true
  state.networkEvidence.requestId = details.requestId || state.networkEvidence.requestId
  state.networkEvidence.method = details.method || state.networkEvidence.method
  state.networkEvidence.finalUrl = details.url || state.networkEvidence.finalUrl
  if (!Number.isFinite(state.networkEvidence.timing.requestStartMs)) {
    state.networkEvidence.timing.requestStartMs = normalizeTimestamp(details.timeStamp)
  }

  return state.networkEvidence
}

function attachNetworkEvidence(
  state: PendingCheckState,
  result: NavigationCheckResult
): NavigationCheckResult {
  const evidence = cloneNetworkEvidence(state.networkEvidence)
  if (!evidence) {
    return result
  }

  evidence.finalUrl = evidence.finalUrl || result.finalUrl || state.lastUrl || state.requestedUrl
  return {
    ...result,
    finalUrl: result.finalUrl || evidence.finalUrl || state.lastUrl || state.requestedUrl,
    networkEvidence: evidence
  }
}

function cloneNetworkEvidence(
  evidence: NavigationNetworkEvidence | null
): NavigationNetworkEvidence | null {
  if (!evidence) {
    return null
  }

  return {
    ...evidence,
    redirects: evidence.redirects.map((redirect) => ({ ...redirect })),
    timing: { ...evidence.timing }
  }
}

function normalizeTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function getElapsedMs(startMs: unknown, endMs: unknown): number | undefined {
  const start = Number(startMs)
  const end = Number(endMs)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return undefined
  }

  return Math.max(0, end - start)
}

function normalizeTimeout(value: unknown): number {
  const timeout = Number(value)
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return 15000
  }

  return Math.max(timeout, 1000)
}

function createTab(properties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(properties, (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}

function updateTab(
  tabId: number,
  properties: chrome.tabs.UpdateProperties
): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, properties, (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}

function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}
