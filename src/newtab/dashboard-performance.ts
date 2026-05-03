import { buildChromeFaviconUrl } from './favicon-cache.js'

export interface DashboardFaviconBookmarkLike {
  id?: string
  url?: string
}

export interface DashboardFaviconWarmupItem {
  id: string
  pageUrl: string
  faviconUrl: string
}

export interface DashboardFaviconWarmupQueueOptions<TBookmark extends DashboardFaviconBookmarkLike> {
  bookmarks: readonly TBookmark[]
  faviconEndpointUrl: string
  size?: number
  cacheToken?: number | string | ((bookmark: TBookmark) => number | string | undefined)
  maxConcurrent?: number
  batchSize?: number
  batchDelayMs?: number
  waitForIdle?: DashboardWaitForIdle
  loadFavicon?: DashboardFaviconLoader
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

export interface DashboardChunkOptions {
  totalCount: number
  startIndex?: number
  maxItemsPerChunk?: number
}

export interface DashboardChunkPlan {
  startIndex: number
  endIndex: number
  count: number
  hasMore: boolean
}

export interface DashboardVirtualWindowOptions {
  totalCount: number
  scrollTop: number
  viewportHeight: number
  itemHeight: number
  overscan?: number
}

export interface DashboardVirtualWindow {
  startIndex: number
  endIndex: number
  visibleStartIndex: number
  visibleEndIndex: number
  beforeHeight: number
  afterHeight: number
}

export type DashboardWaitForIdle = (callback: () => void) => void
export type DashboardFaviconLoader = (url: string, item: DashboardFaviconWarmupItem) => Promise<void> | void

const DEFAULT_FAVICON_SIZE = 64
const DEFAULT_WARMUP_CONCURRENCY = 2
const DEFAULT_WARMUP_BATCH_SIZE = 8
const DEFAULT_WARMUP_BATCH_DELAY_MS = 24
const DEFAULT_CHUNK_SIZE = 48
const DEFAULT_OVERSCAN = 8

export function createDashboardFaviconWarmupQueue<TBookmark extends DashboardFaviconBookmarkLike>(
  options: DashboardFaviconWarmupQueueOptions<TBookmark>
): DashboardFaviconWarmupQueue {
  const maxConcurrent = clampInteger(options.maxConcurrent, 1, 6, DEFAULT_WARMUP_CONCURRENCY)
  const batchSize = clampInteger(options.batchSize, 1, 32, DEFAULT_WARMUP_BATCH_SIZE)
  const batchDelayMs = clampInteger(options.batchDelayMs, 0, 2000, DEFAULT_WARMUP_BATCH_DELAY_MS)
  const waitForIdle = options.waitForIdle || waitForBrowserIdle
  const loadFavicon = options.loadFavicon || preloadImage
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
    setTimeout(() => {
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

    while (
      snapshot.activeCount < maxConcurrent &&
      batchRemaining > 0 &&
      queue.length > 0
    ) {
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

    if (queue.length <= 0 || snapshot.activeCount >= maxConcurrent) {
      snapshot.pendingCount = queue.length
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

export function buildDashboardFaviconWarmupItems<TBookmark extends DashboardFaviconBookmarkLike>(
  options: Pick<
    DashboardFaviconWarmupQueueOptions<TBookmark>,
    'bookmarks' | 'faviconEndpointUrl' | 'size' | 'cacheToken'
  >
): DashboardFaviconWarmupItem[] {
  const seen = new Set<string>()
  const size = clampInteger(options.size, 16, 128, DEFAULT_FAVICON_SIZE)
  const items: DashboardFaviconWarmupItem[] = []

  for (const bookmark of options.bookmarks) {
    const pageUrl = String(bookmark.url || '').trim()
    if (!pageUrl || seen.has(pageUrl)) {
      continue
    }
    seen.add(pageUrl)
    const cacheToken = typeof options.cacheToken === 'function'
      ? options.cacheToken(bookmark)
      : options.cacheToken
    items.push({
      id: String(bookmark.id || pageUrl),
      pageUrl,
      faviconUrl: buildChromeFaviconUrl(options.faviconEndpointUrl, pageUrl, {
        size,
        cacheToken
      })
    })
  }

  return items
}

export function getDashboardChunkPlan(options: DashboardChunkOptions): DashboardChunkPlan {
  const totalCount = clampInteger(options.totalCount, 0, Number.MAX_SAFE_INTEGER, 0)
  const startIndex = clampInteger(options.startIndex, 0, totalCount, 0)
  const maxItemsPerChunk = clampInteger(options.maxItemsPerChunk, 1, 500, DEFAULT_CHUNK_SIZE)
  const endIndex = Math.min(totalCount, startIndex + maxItemsPerChunk)
  return {
    startIndex,
    endIndex,
    count: Math.max(0, endIndex - startIndex),
    hasMore: endIndex < totalCount
  }
}

export function getDashboardVirtualWindow(options: DashboardVirtualWindowOptions): DashboardVirtualWindow {
  const totalCount = clampInteger(options.totalCount, 0, Number.MAX_SAFE_INTEGER, 0)
  const itemHeight = clampInteger(options.itemHeight, 1, 4096, 1)
  const viewportHeight = Math.max(0, getFiniteNumber(options.viewportHeight, 0))
  const scrollTop = Math.max(0, getFiniteNumber(options.scrollTop, 0))
  const overscan = clampInteger(options.overscan, 0, 200, DEFAULT_OVERSCAN)
  const visibleStartIndex = clampInteger(Math.floor(scrollTop / itemHeight), 0, totalCount, 0)
  const visibleCount = Math.ceil(viewportHeight / itemHeight)
  const visibleEndIndex = Math.min(totalCount, visibleStartIndex + visibleCount)
  const startIndex = Math.max(0, visibleStartIndex - overscan)
  const endIndex = Math.min(totalCount, visibleEndIndex + overscan)

  return {
    startIndex,
    endIndex,
    visibleStartIndex,
    visibleEndIndex,
    beforeHeight: startIndex * itemHeight,
    afterHeight: Math.max(0, (totalCount - endIndex) * itemHeight)
  }
}

export function scheduleDashboardChunk(
  callback: () => void,
  waitForIdle: DashboardWaitForIdle = waitForBrowserIdle
): () => void {
  let canceled = false
  waitForIdle(() => {
    if (!canceled) {
      callback()
    }
  })
  return () => {
    canceled = true
  }
}

function waitForBrowserIdle(callback: () => void): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => callback(), { timeout: 400 })
    return
  }
  setTimeout(callback, 16)
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.loading = 'lazy'
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => reject(new Error('favicon warmup failed')), { once: true })
    image.src = url
  })
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.max(min, Math.min(Math.trunc(numberValue), max))
}

function getFiniteNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}
