export const DASHBOARD_FAVICON_SIZE = 32
export const DASHBOARD_FAVICON_WARMUP_CONCURRENCY = 3
export const DASHBOARD_FAVICON_WARMUP_BATCH_SIZE = 12
export const DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS = 48
export const DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS = 14
const DASHBOARD_FAVICON_CACHE_LIMIT = 2500
export const DASHBOARD_FAVICON_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const DASHBOARD_FAVICON_FAILURE_RETRY_MS = 24 * 60 * 60 * 1000
export const DASHBOARD_FAVICON_FETCH_VERSION = 3
export interface DashboardFaviconWarmupItem {
  id: string
  pageUrl: string
  faviconUrl: string
  source?: 'cache' | 'chrome'
}

export interface DashboardFaviconCacheEntry {
  pageUrl: string
  iconUrl: string
  updatedAt: number
  failedAt?: number
  version?: number
}

export type DashboardFaviconCache = Record<string, DashboardFaviconCacheEntry>

export interface DashboardFaviconWarmupQueueOptions {
  bookmarks: readonly Pick<{ id: string; url: string }, 'id' | 'url'>[]
  faviconEndpointUrl: string
  remoteCache?: DashboardFaviconCache
  size?: number
  maxConcurrent?: number
  batchSize?: number
  batchDelayMs?: number
  waitForIdle?: (callback: () => void) => void
  loadFavicon?: (url: string, item: DashboardFaviconWarmupItem) => Promise<unknown> | unknown
  onWarm?: (item: DashboardFaviconWarmupItem) => void
  onError?: (item: DashboardFaviconWarmupItem, error: unknown) => void
}

export interface DashboardFaviconWarmupSnapshot {
  pendingCount: number
  activeCount: number
  warmedCount: number
  failedCount: number
  canceled: boolean
}

export interface DashboardFaviconWarmupQueue {
  start: () => void
  cancel: () => void
  getSnapshot: () => DashboardFaviconWarmupSnapshot
}

export interface DashboardFaviconCacheStore {
  getCache: () => DashboardFaviconCache
  upsert: (pageUrl: string, iconUrl: string, now?: number) => void
  markFailed: (pageUrl: string, now?: number) => void
}

export interface DashboardFaviconWarmOptions {
  canFetchRemote?: (pageUrl: string) => Promise<boolean> | boolean
}

export function getDashboardFaviconCacheKey(pageUrl: string): string {
  try {
    return new URL(pageUrl).href
  } catch {
    return String(pageUrl || '').trim()
  }
}

export function isDashboardSafeImageUrl(iconUrl: string): boolean {
  const normalizedUrl = String(iconUrl || '').trim()
  if (!normalizedUrl) {
    return false
  }

  if (normalizedUrl.startsWith('data:image/')) {
    return true
  }

  try {
    const parsedUrl = new URL(normalizedUrl)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

export function getDashboardCachedFaviconEntry(
  cache: DashboardFaviconCache,
  pageUrl: string,
  now = Date.now()
): DashboardFaviconCacheEntry | null {
  const key = getDashboardFaviconCacheKey(pageUrl)
  const entry = key ? cache[key] : null
  if (!entry || entry.pageUrl !== key || !entry.iconUrl) {
    return null
  }

  if (now - entry.updatedAt > DASHBOARD_FAVICON_CACHE_MAX_AGE_MS) {
    return null
  }

  return entry
}

export function normalizeDashboardFaviconCache(
  rawCache: unknown,
  {
    now = Date.now(),
    limit = DASHBOARD_FAVICON_CACHE_LIMIT
  }: {
    now?: number
    limit?: number
  } = {}
): DashboardFaviconCache {
  if (!rawCache || typeof rawCache !== 'object' || Array.isArray(rawCache)) {
    return {}
  }

  const entries: Array<[string, DashboardFaviconCacheEntry]> = []
  for (const [rawKey, rawEntry] of Object.entries(rawCache as Record<string, unknown>)) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      continue
    }

    const source = rawEntry as Record<string, unknown>
    const pageUrl = getDashboardFaviconCacheKey(String(source.pageUrl || rawKey || '').trim())
    if (!pageUrl) {
      continue
    }

    const updatedAt = getDashboardFiniteTimestamp(source.updatedAt, 0)
    const failedAt = getDashboardFiniteTimestamp(source.failedAt, 0)
    const iconUrl = String(source.iconUrl || '').trim()
    if (iconUrl && !isDashboardSafeImageUrl(iconUrl)) {
      continue
    }

    if (iconUrl) {
      if (
        Number(source.version) !== DASHBOARD_FAVICON_FETCH_VERSION ||
        !updatedAt ||
        now - updatedAt > DASHBOARD_FAVICON_CACHE_MAX_AGE_MS
      ) {
        continue
      }
      entries.push([pageUrl, {
        pageUrl,
        iconUrl,
        updatedAt,
        version: DASHBOARD_FAVICON_FETCH_VERSION
      }])
      continue
    }

    if (
      failedAt &&
      Number(source.version) === DASHBOARD_FAVICON_FETCH_VERSION &&
      now - failedAt <= DASHBOARD_FAVICON_FAILURE_RETRY_MS
    ) {
      entries.push([pageUrl, {
        pageUrl,
        iconUrl: '',
        updatedAt: 0,
        failedAt,
        version: DASHBOARD_FAVICON_FETCH_VERSION
      }])
    }
  }

  entries.sort((left, right) => {
    const leftTime = left[1].updatedAt || left[1].failedAt || 0
    const rightTime = right[1].updatedAt || right[1].failedAt || 0
    return rightTime - leftTime || left[0].localeCompare(right[0])
  })

  return Object.fromEntries(entries.slice(0, clampDashboardInteger(limit, 1, DASHBOARD_FAVICON_CACHE_LIMIT, DASHBOARD_FAVICON_CACHE_LIMIT)))
}

export function buildDashboardFaviconUrl(
  faviconEndpointUrl: string,
  pageUrl: string,
  {
    size = DASHBOARD_FAVICON_SIZE,
    cacheToken = ''
  }: {
    size?: number
    cacheToken?: number | string
  } = {}
): string {
  if (!faviconEndpointUrl || !pageUrl) {
    return ''
  }

  const faviconUrl = new URL(faviconEndpointUrl)
  faviconUrl.searchParams.set('pageUrl', pageUrl)
  faviconUrl.searchParams.set('size', String(clampDashboardInteger(size, 16, 128, DASHBOARD_FAVICON_SIZE)))
  faviconUrl.searchParams.set('cache', '1')
  if (cacheToken) {
    faviconUrl.searchParams.set('refresh', String(cacheToken))
  }
  return faviconUrl.toString()
}

export function buildDashboardFaviconWarmupItems({
  bookmarks,
  faviconEndpointUrl,
  remoteCache = {},
  size = DASHBOARD_FAVICON_SIZE
}: Pick<DashboardFaviconWarmupQueueOptions, 'bookmarks' | 'faviconEndpointUrl' | 'remoteCache' | 'size'>): DashboardFaviconWarmupItem[] {
  const now = Date.now()
  const seenPageUrls = new Set<string>()
  const seenOrigins = new Set<string>()
  const seenFaviconUrls = new Set<string>()
  const items: DashboardFaviconWarmupItem[] = []

  for (const bookmark of bookmarks) {
    const pageUrl = String(bookmark.url || '').trim()
    const cacheKey = getDashboardFaviconCacheKey(pageUrl)
    const cachedEntry = cacheKey ? remoteCache[cacheKey] : null
    const originKey = getDashboardFaviconOriginKey(pageUrl)
    const defaultFaviconUrl = getDashboardDefaultRemoteFaviconUrl(pageUrl)
    const cachedIconUrl = hasFreshDashboardFaviconCacheEntryForEntry(cachedEntry, now)
      ? String(cachedEntry?.iconUrl || '').trim()
      : ''
    if (
      !pageUrl ||
      !isDashboardRemoteFaviconPageUrl(pageUrl) ||
      seenPageUrls.has(cacheKey || pageUrl) ||
      (!cachedIconUrl && originKey && seenOrigins.has(originKey)) ||
      (!cachedIconUrl && defaultFaviconUrl && seenFaviconUrls.has(defaultFaviconUrl)) ||
      (!cachedIconUrl && shouldSkipDashboardRemoteFaviconFetchForEntry(cachedEntry, now))
    ) {
      continue
    }
    seenPageUrls.add(cacheKey || pageUrl)
    if (!cachedIconUrl && originKey) {
      seenOrigins.add(originKey)
    }
    if (!cachedIconUrl && defaultFaviconUrl) {
      seenFaviconUrls.add(defaultFaviconUrl)
    }
    const faviconUrl = cachedIconUrl || buildDashboardFaviconUrl(faviconEndpointUrl, pageUrl, { size })
    if (!faviconUrl || seenFaviconUrls.has(faviconUrl)) {
      continue
    }
    seenFaviconUrls.add(faviconUrl)
    items.push({
      id: String(bookmark.id || pageUrl),
      pageUrl: cacheKey || pageUrl,
      faviconUrl,
      source: cachedIconUrl ? 'cache' : 'chrome'
    })
  }

  return items
}

export function createDashboardFaviconWarmupQueue(
  options: DashboardFaviconWarmupQueueOptions
): DashboardFaviconWarmupQueue {
  const maxConcurrent = clampDashboardInteger(
    options.maxConcurrent,
    1,
    6,
    DASHBOARD_FAVICON_WARMUP_CONCURRENCY
  )
  const batchSize = clampDashboardInteger(
    options.batchSize,
    1,
    32,
    DASHBOARD_FAVICON_WARMUP_BATCH_SIZE
  )
  const batchDelayMs = clampDashboardInteger(
    options.batchDelayMs,
    0,
    2000,
    DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS
  )
  const waitForIdle = options.waitForIdle || waitForDashboardIdle
  const loadFavicon = options.loadFavicon || preloadDashboardFavicon
  const queue = buildDashboardFaviconWarmupItems(options)
  const snapshot: DashboardFaviconWarmupSnapshot = {
    pendingCount: queue.length,
    activeCount: 0,
    warmedCount: 0,
    failedCount: 0,
    canceled: false
  }
  let started = false
  let scheduled = false
  let batchRemaining = batchSize

  const scheduleDrain = () => {
    if (!started || snapshot.canceled || scheduled) {
      return
    }
    scheduled = true
    waitForIdle(() => {
      scheduled = false
      drain()
    })
  }

  const scheduleNextBatch = () => {
    if (!started || snapshot.canceled || scheduled) {
      return
    }
    scheduled = true
    globalThis.setTimeout(() => {
      scheduled = false
      batchRemaining = batchSize
      drain()
    }, batchDelayMs)
  }

  const settle = (item: DashboardFaviconWarmupItem, error?: unknown) => {
    snapshot.activeCount = Math.max(0, snapshot.activeCount - 1)
    if (snapshot.canceled) {
      return
    }
    if (error) {
      snapshot.failedCount += 1
      options.onError?.(item, error)
    } else {
      snapshot.warmedCount += 1
      options.onWarm?.(item)
    }
    drain()
  }

  const drain = () => {
    if (!started || snapshot.canceled) {
      return
    }

    while (snapshot.activeCount < maxConcurrent && batchRemaining > 0 && queue.length > 0) {
      const item = queue.shift()
      if (!item) {
        break
      }
      snapshot.pendingCount = queue.length
      snapshot.activeCount += 1
      batchRemaining -= 1
      Promise.resolve()
        .then(() => loadFavicon(item.faviconUrl, item))
        .then(() => settle(item))
        .catch((error) => settle(item, error))
    }

    snapshot.pendingCount = queue.length
    if (queue.length <= 0 || snapshot.activeCount >= maxConcurrent) {
      return
    }
    if (batchRemaining <= 0) {
      scheduleNextBatch()
      return
    }
    scheduleDrain()
  }

  return {
    start() {
      if (started || snapshot.canceled) {
        return
      }
      started = true
      scheduleDrain()
    },
    cancel() {
      snapshot.canceled = true
      queue.length = 0
      snapshot.pendingCount = 0
    },
    getSnapshot() {
      return { ...snapshot }
    }
  }
}

export function getDashboardFaviconEndpointUrl(): string {
  if (typeof chrome === 'undefined') {
    return ''
  }

  if (chrome.runtime?.getURL) {
    return chrome.runtime.getURL('/_favicon/')
  }

  const runtimeId = chrome.runtime?.id || ''
  return runtimeId ? `chrome-extension://${runtimeId}/_favicon/` : ''
}

function preloadDashboardFavicon(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.addEventListener('load', () => {
      if (typeof image.decode !== 'function') {
        resolve(image)
        return
      }
      image.decode()
        .catch(() => {})
        .then(() => resolve(image))
    }, { once: true })
    image.addEventListener('error', () => reject(new Error('dashboard favicon warmup failed')), { once: true })
    image.src = url
  })
}

export async function warmDashboardFavicon(
  chromeFaviconUrl: string,
  _item: DashboardFaviconWarmupItem,
  _cacheStore: DashboardFaviconCacheStore,
  _options: DashboardFaviconWarmOptions = {}
): Promise<void> {
  // Direct remote favicon fetches from extension pages create user-visible CORS errors.
  // Chrome's favicon endpoint can warm and serve the icon without exposing those failures.
  try {
    await preloadDashboardFavicon(chromeFaviconUrl)
  } catch {}
}

export function clampDashboardInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.max(min, Math.min(Math.trunc(numberValue), max))
}

function isDashboardRemoteFaviconPageUrl(pageUrl: string): boolean {
  try {
    const parsedUrl = new URL(pageUrl)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function shouldSkipDashboardRemoteFaviconFetchForEntry(
  entry: DashboardFaviconCacheEntry | null | undefined,
  now = Date.now()
): boolean {
  if (hasFreshDashboardFaviconCacheEntryForEntry(entry, now)) {
    return true
  }

  return shouldSkipDashboardRemoteFaviconRetryForEntry(entry, now)
}

function hasFreshDashboardFaviconCacheEntryForEntry(
  entry: DashboardFaviconCacheEntry | null | undefined,
  now = Date.now()
): boolean {
  if (!entry) {
    return false
  }

  return Boolean(
    entry.iconUrl &&
    entry.version === DASHBOARD_FAVICON_FETCH_VERSION &&
    now - entry.updatedAt <= DASHBOARD_FAVICON_CACHE_MAX_AGE_MS
  )
}

function shouldSkipDashboardRemoteFaviconRetryForEntry(
  entry: DashboardFaviconCacheEntry | null | undefined,
  now = Date.now()
): boolean {
  if (!entry) {
    return false
  }

  return Boolean(
    entry.failedAt &&
    entry.version === DASHBOARD_FAVICON_FETCH_VERSION &&
    now - entry.failedAt < DASHBOARD_FAVICON_FAILURE_RETRY_MS
  )
}

function getDashboardFiniteTimestamp(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function waitForDashboardIdle(callback: () => void): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => callback(), { timeout: 500 })
    return
  }
  globalThis.setTimeout(callback, 16)
}

function getDashboardDefaultRemoteFaviconUrl(pageUrl: string): string {
  try {
    return new URL('/favicon.ico', pageUrl).href
  } catch {
    return ''
  }
}

function getDashboardFaviconOriginKey(pageUrl: string): string {
  try {
    return new URL(pageUrl).origin
  } catch {
    return ''
  }
}

