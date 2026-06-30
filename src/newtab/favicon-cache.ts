export interface FaviconAccentColor {
  r: number
  g: number
  b: number
}

export interface FaviconAccentCacheEntry {
  url: string
  color: FaviconAccentColor
  updatedAt: number
}

export type FaviconAccentCache = Record<string, FaviconAccentCacheEntry>

const FAVICON_ACCENT_CACHE_LIMIT = 1200
const FAVICON_ACCENT_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

interface FaviconCacheOptions {
  now?: number
  limit?: number
  maxAgeMs?: number
}

interface FaviconUrlOptions {
  size?: number
  cacheToken?: number | string
}

export function buildChromeFaviconUrl(
  faviconEndpointUrl: string,
  pageUrl: string,
  { size = 32, cacheToken = '' }: FaviconUrlOptions = {}
): string {
  const url = new URL(faviconEndpointUrl)
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', String(clampInteger(size, 16, 128, 32)))
  url.searchParams.set('cache', '1')
  if (cacheToken) {
    url.searchParams.set('refresh', String(cacheToken))
  }
  return url.toString()
}

export function normalizeFaviconAccentCache(
  rawCache: unknown,
  options: FaviconCacheOptions = {}
): FaviconAccentCache {
  const now = getFiniteTimestamp(options.now, Date.now())
  const maxAgeMs = getFiniteTimestamp(options.maxAgeMs, FAVICON_ACCENT_CACHE_MAX_AGE_MS)
  const limit = clampInteger(options.limit, 1, FAVICON_ACCENT_CACHE_LIMIT, FAVICON_ACCENT_CACHE_LIMIT)
  if (!rawCache || typeof rawCache !== 'object' || Array.isArray(rawCache)) {
    return {}
  }

  const entries: Array<[string, FaviconAccentCacheEntry]> = []
  for (const [bookmarkId, rawEntry] of Object.entries(rawCache as Record<string, unknown>)) {
    const key = String(bookmarkId || '').trim()
    const entry = normalizeFaviconAccentCacheEntry(rawEntry, now, maxAgeMs)
    if (key && entry) {
      entries.push([key, entry])
    }
  }

  entries.sort((left, right) => {
    const updatedDiff = right[1].updatedAt - left[1].updatedAt
    return updatedDiff || left[0].localeCompare(right[0])
  })

  return Object.fromEntries(entries.slice(0, limit))
}

export function getFaviconAccentCacheEntry(
  cache: FaviconAccentCache,
  bookmarkId: string,
  pageUrl: string,
  options: FaviconCacheOptions = {}
): FaviconAccentCacheEntry | null {
  const key = String(bookmarkId || '').trim()
  const entry = key ? cache[key] : null
  if (!entry || entry.url !== pageUrl) {
    return null
  }

  const now = getFiniteTimestamp(options.now, Date.now())
  const maxAgeMs = getFiniteTimestamp(options.maxAgeMs, FAVICON_ACCENT_CACHE_MAX_AGE_MS)
  if (now - entry.updatedAt > maxAgeMs) {
    return null
  }

  return entry
}

export function removeFaviconAccentCacheEntry(
  cache: FaviconAccentCache,
  bookmarkId: string
): FaviconAccentCache {
  const key = String(bookmarkId || '').trim()
  if (!key || !(key in cache)) {
    return cache
  }

  const nextCache = { ...cache }
  delete nextCache[key]
  return nextCache
}

export function formatFaviconAccentCssRgb(color: FaviconAccentColor): string {
  const normalizedColor = normalizeFaviconAccentColor(color)
  return normalizedColor
    ? `${normalizedColor.r} ${normalizedColor.g} ${normalizedColor.b}`
    : '245 245 247'
}

function normalizeFaviconAccentCacheEntry(
  rawEntry: unknown,
  now: number,
  maxAgeMs: number
): FaviconAccentCacheEntry | null {
  if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
    return null
  }

  const entry = rawEntry as Record<string, unknown>
  const url = String(entry.url || '').trim()
  const color = normalizeFaviconAccentColor(entry.color)
  const updatedAt = getFiniteTimestamp(entry.updatedAt, 0)
  if (!url || !color || updatedAt <= 0 || now - updatedAt > maxAgeMs) {
    return null
  }

  return {
    url,
    color,
    updatedAt
  }
}

function normalizeFaviconAccentColor(rawColor: unknown): FaviconAccentColor | null {
  if (!rawColor || typeof rawColor !== 'object' || Array.isArray(rawColor)) {
    return null
  }

  const color = rawColor as Partial<FaviconAccentColor>
  return {
    r: clampInteger(color.r, 0, 255, 0),
    g: clampInteger(color.g, 0, 255, 0),
    b: clampInteger(color.b, 0, 255, 0)
  }
}

function getFiniteTimestamp(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(min, Math.min(max, numeric))
}
