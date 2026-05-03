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

export const FAVICON_ACCENT_CACHE_LIMIT = 1200
export const FAVICON_ACCENT_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

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

export function upsertFaviconAccentCacheEntry(
  cache: FaviconAccentCache,
  bookmarkId: string,
  pageUrl: string,
  color: FaviconAccentColor,
  options: FaviconCacheOptions = {}
): FaviconAccentCache {
  const key = String(bookmarkId || '').trim()
  const normalizedColor = normalizeFaviconAccentColor(color)
  if (!key || !pageUrl || !normalizedColor) {
    return normalizeFaviconAccentCache(cache, options)
  }

  return normalizeFaviconAccentCache({
    ...cache,
    [key]: {
      url: pageUrl,
      color: normalizedColor,
      updatedAt: getFiniteTimestamp(options.now, Date.now())
    }
  }, options)
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

export function selectFaviconAccentColor(
  pixels: ArrayLike<number>,
  {
    minAlpha = 28,
    quantizeStep = 24
  }: {
    minAlpha?: number
    quantizeStep?: number
  } = {}
): FaviconAccentColor | null {
  const buckets = new Map<string, {
    r: number
    g: number
    b: number
    weight: number
    score: number
  }>()
  const fallback = {
    r: 0,
    g: 0,
    b: 0,
    weight: 0
  }

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = clampInteger(pixels[index + 3], 0, 255, 255)
    if (alpha < minAlpha) {
      continue
    }

    const r = clampInteger(pixels[index], 0, 255, 0)
    const g = clampInteger(pixels[index + 1], 0, 255, 0)
    const b = clampInteger(pixels[index + 2], 0, 255, 0)
    const saturation = getRgbSaturation(r, g, b)
    const luminance = getRgbLuminance(r, g, b)
    const alphaWeight = alpha / 255
    fallback.r += r * alphaWeight
    fallback.g += g * alphaWeight
    fallback.b += b * alphaWeight
    fallback.weight += alphaWeight

    if (saturation < 12 && (luminance < 56 || luminance > 216)) {
      continue
    }

    const saturationBoost = 1 + Math.min(saturation, 128) / 128
    const luminancePenalty = luminance < 32 || luminance > 238 ? 0.5 : 1
    const weight = alphaWeight * saturationBoost * luminancePenalty
    const key = [
      quantizeColorChannel(r, quantizeStep),
      quantizeColorChannel(g, quantizeStep),
      quantizeColorChannel(b, quantizeStep)
    ].join(',')
    const bucket = buckets.get(key) || {
      r: 0,
      g: 0,
      b: 0,
      weight: 0,
      score: 0
    }
    bucket.r += r * weight
    bucket.g += g * weight
    bucket.b += b * weight
    bucket.weight += weight
    bucket.score += weight
    buckets.set(key, bucket)
  }

  const rankedBuckets = [...buckets.values()]
    .filter((bucket) => bucket.weight > 0)
    .sort((left, right) => right.score - left.score)

  const bestBucket = rankedBuckets[0]
  if (bestBucket) {
    return normalizeFaviconAccentColor({
      r: bestBucket.r / bestBucket.weight,
      g: bestBucket.g / bestBucket.weight,
      b: bestBucket.b / bestBucket.weight
    })
  }

  if (fallback.weight <= 0) {
    return null
  }

  const fallbackColor = normalizeFaviconAccentColor({
    r: fallback.r / fallback.weight,
    g: fallback.g / fallback.weight,
    b: fallback.b / fallback.weight
  })
  if (!fallbackColor) {
    return null
  }

  const saturation = getRgbSaturation(fallbackColor.r, fallbackColor.g, fallbackColor.b)
  const luminance = getRgbLuminance(fallbackColor.r, fallbackColor.g, fallbackColor.b)
  return saturation < 8 && (luminance < 44 || luminance > 224)
    ? null
    : fallbackColor
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

function quantizeColorChannel(value: number, step: number): number {
  const normalizedStep = clampInteger(step, 4, 64, 24)
  return clampInteger(Math.round(value / normalizedStep) * normalizedStep, 0, 255, 0)
}

function getRgbSaturation(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function getRgbLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
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
