import type { FeaturedBackgroundItem } from './background-gallery.js'
import {
  FEATURED_BACKGROUND_PROVIDER_DISPLAY_LIMIT,
  isFeaturedBackgroundProvider
} from './featured-background-providers.js'
import {
  isFeaturedBackgroundStyleSuitable,
} from './featured-background-style.js'

const FEATURED_REFRESH_PROVIDER_TARGET_COUNT = FEATURED_BACKGROUND_PROVIDER_DISPLAY_LIMIT
const FEATURED_REFRESH_SOURCE_LIMIT = 24
const FEATURED_REFRESH_STORED_ITEM_LIMIT = 96
const FEATURED_REFRESH_CONCURRENCY = 6
const NASA_SEARCH_PAGE_SIZE = 16
const NASA_SEARCH_PAGE_VARIANTS = 12
const FEATURED_BACKGROUND_HIGH_MIN_LONG_EDGE = 1920
const FEATURED_BACKGROUND_HIGH_MIN_SHORT_EDGE = 1080
const FEATURED_BACKGROUND_MIN_ASPECT_RATIO = 1.2
const COMMONS_SEARCH_LIMIT = 24
const COMMONS_SEARCH_OFFSET_VARIANTS = 8
const MET_OBJECTS_PER_QUERY = 8
const CLEVELAND_SEARCH_LIMIT = 12
const CLEVELAND_SEARCH_OFFSET_VARIANTS = 12
const NASA_SEARCH_QUERIES = [
  'nasa earth observatory landscape photograph',
  'iss earth horizon aurora photograph',
  'nasa ocean clouds earth photograph',
  'mars landscape panorama photograph',
  'nasa moon horizon landscape photograph'
]
const COMMONS_SEARCH_QUERIES = [
  'landscape panorama public domain photograph',
  'mountain landscape featured picture public domain',
  'seascape coast public domain photograph',
  'forest landscape public domain photograph',
  'waterfall landscape public domain photograph',
  'city skyline panorama public domain photograph',
  'aurora landscape public domain photograph',
  'desert landscape public domain photograph'
]
const MET_SEARCH_QUERIES = [
  'landscape',
  'seascape',
  'mountain landscape',
  'river landscape',
  'forest landscape',
  'garden landscape',
  'sunset landscape',
  'panorama'
]
const CLEVELAND_SEARCH_QUERIES = [
  'landscape',
  'seascape',
  'mountain landscape',
  'waterfall',
  'river landscape',
  'forest landscape',
  'valley landscape',
  'storm sky'
]

export interface FeaturedGalleryRefreshState {
  existingItems: FeaturedBackgroundItem[]
  favoriteIds: Iterable<string>
  fetchedItems: FeaturedBackgroundItem[]
}

export interface FeaturedGalleryFetchClient {
  fetchJson: (url: string) => Promise<unknown>
  getImageSize?: (url: string) => Promise<{ width: number; height: number } | null>
}

export interface FeaturedGalleryRefreshOptions {
  refreshSeed?: unknown
}

export const FEATURED_BACKGROUND_REFRESH_ORIGINS = [
  'https://images-api.nasa.gov/*',
  'https://images-assets.nasa.gov/*',
  'https://commons.wikimedia.org/*',
  'https://upload.wikimedia.org/*',
  'https://collectionapi.metmuseum.org/*',
  'https://images.metmuseum.org/*',
  'https://openaccess-api.clevelandart.org/*',
  'https://openaccess-cdn.clevelandart.org/*'
]

export function getFeaturedBackgroundResolutionLabel(item: Pick<FeaturedBackgroundItem, 'width' | 'height'>): string {
  const width = Number(item.width)
  const height = Number(item.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `${Math.round(width)} x ${Math.round(height)}`
}

export async function fetchFreshFeaturedBackgroundItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions = {}
): Promise<FeaturedBackgroundItem[]> {
  const [nasaItems, wikimediaItems, metItems, clevelandItems] = await Promise.all([
    fetchNasaFeaturedItems(client, options).catch(() => []),
    fetchWikimediaFeaturedItems(client, options).catch(() => []),
    fetchMetFeaturedItems(client, options).catch(() => []),
    fetchClevelandFeaturedItems(client, options).catch(() => [])
  ])

  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  return [
    ...pickFeaturedProviderItems(nasaItems, seed),
    ...pickFeaturedProviderItems(wikimediaItems, seed + 1),
    ...pickFeaturedProviderItems(metItems, seed + 2),
    ...pickFeaturedProviderItems(clevelandItems, seed + 3)
  ]
}

export function mergeFeaturedGalleryRefresh({
  existingItems,
  favoriteIds,
  fetchedItems
}: FeaturedGalleryRefreshState): FeaturedBackgroundItem[] {
  const favorites = new Set(Array.from(favoriteIds, (id) => String(id || '').trim()).filter(Boolean))
  const merged: FeaturedBackgroundItem[] = []
  const seen = new Set<string>()

  function addItem(item: FeaturedBackgroundItem | null | undefined): void {
    if (!item || !isFeaturedBackgroundProvider(item.provider)) {
      return
    }
    const id = String(item?.id || '').trim()
    if (!id || seen.has(id)) {
      return
    }
    seen.add(id)
    merged.push(item)
  }

  for (const item of existingItems) {
    if (favorites.has(item.id)) {
      addItem(item)
    }
  }
  for (const item of fetchedItems) {
    if (favorites.has(item.id)) {
      addItem(item)
    }
  }
  for (const item of fetchedItems) {
    addItem(item)
  }
  for (const item of existingItems) {
    addItem(item)
  }

  return limitFeaturedRefreshStoredItems(merged, favorites)
}

export function isHighResolutionFeaturedBackground(
  width: unknown,
  height: unknown,
  minLongEdge = 1920,
  minShortEdge = 1080
): boolean {
  const numericWidth = Number(width)
  const numericHeight = Number(height)
  if (!Number.isFinite(numericWidth) || !Number.isFinite(numericHeight)) {
    return false
  }

  const longEdge = Math.max(numericWidth, numericHeight)
  const shortEdge = Math.min(numericWidth, numericHeight)
  const aspectRatio = numericWidth / numericHeight
  return longEdge >= minLongEdge &&
    shortEdge >= minShortEdge &&
    aspectRatio >= FEATURED_BACKGROUND_MIN_ASPECT_RATIO
}

export function getFeaturedBackgroundResolutionThreshold(
  options: FeaturedGalleryRefreshOptions = {}
): { minLongEdge: number; minShortEdge: number } {
  void options
  return {
    minLongEdge: FEATURED_BACKGROUND_HIGH_MIN_LONG_EDGE,
    minShortEdge: FEATURED_BACKGROUND_HIGH_MIN_SHORT_EDGE
  }
}

export function getFeaturedBackgroundRefreshRequestOrigins(): string[] {
  return FEATURED_BACKGROUND_REFRESH_ORIGINS
}

export function getFeaturedBackgroundRefreshProviderCount(items: FeaturedBackgroundItem[]): number {
  const providers = new Set<FeaturedBackgroundItem['provider']>()
  for (const item of items) {
    if (isFeaturedBackgroundProvider(item.provider)) {
      providers.add(item.provider)
    }
  }
  return providers.size
}

function pickFeaturedProviderItems(items: FeaturedBackgroundItem[], seed: number): FeaturedBackgroundItem[] {
  return rotateFeaturedCandidates(dedupeFeaturedItems(items), seed)
    .slice(0, FEATURED_REFRESH_PROVIDER_TARGET_COUNT)
}

function limitFeaturedRefreshStoredItems(
  items: FeaturedBackgroundItem[],
  favoriteIds: Set<string>
): FeaturedBackgroundItem[] {
  let retainedNonFavoriteCount = 0
  const retainedProviderCounts = new Map<FeaturedBackgroundItem['provider'], number>()
  return items.filter((item) => {
    if (favoriteIds.has(item.id)) {
      return true
    }
    if (retainedNonFavoriteCount >= FEATURED_REFRESH_STORED_ITEM_LIMIT) {
      return false
    }
    const providerCount = retainedProviderCounts.get(item.provider) || 0
    if (providerCount >= FEATURED_BACKGROUND_PROVIDER_DISPLAY_LIMIT) {
      return false
    }
    retainedProviderCounts.set(item.provider, providerCount + 1)
    retainedNonFavoriteCount += 1
    return true
  })
}

async function fetchNasaFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const searchUrls = NASA_SEARCH_QUERIES.flatMap((query, index) => {
    const seededPage = 1 + ((seed + index) % NASA_SEARCH_PAGE_VARIANTS)
    const pages = dedupeNumbers([1, seededPage])
    return pages.map((page) => {
      return `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(query)}&page_size=${NASA_SEARCH_PAGE_SIZE}&page=${page}`
    })
  })
  const searchResults = await Promise.all(searchUrls.map((url) => {
    return client.fetchJson(url).catch(() => null)
  }))
  const collectionItems = searchResults.flatMap((search) => {
    const items = getObject(search).collection
    const rawCollectionItems = getObject(items).items
    return Array.isArray(rawCollectionItems) ? rawCollectionItems : []
  })
  const candidates = rotateFeaturedCandidates(
    dedupeFeaturedItems(
      collectionItems.flatMap((flatMapValue, flatMapIndex, flatMapArray) => { const mappedResult = (normalizeNasaCandidate)(flatMapValue); return mappedResult ? [mappedResult] : [] }) as FeaturedBackgroundItem[]
    ),
    seed
  )
  const hydrated = await mapWithConcurrency(candidates.slice(0, FEATURED_REFRESH_SOURCE_LIMIT), FEATURED_REFRESH_CONCURRENCY, async (candidate) => {
    const assetList = await client.fetchJson(candidate.imageUrl).catch(() => null)
    const imageUrl = selectNasaHighResolutionImageUrl(assetList)
    const imageSize = imageUrl ? await getHighResolutionImageSize(client, imageUrl, options) : null
    const fallbackSize = imageUrl ? getNasaFallbackSize(assetList, options) : null
    const size = imageSize || fallbackSize
    if (!imageUrl || !size) {
      return null
    }
    return {
      ...candidate,
      imageUrl,
      width: size.width,
      height: size.height
    }
  })
  return hydrated.filter(Boolean) as FeaturedBackgroundItem[]
}

function normalizeNasaCandidate(rawItem: unknown): FeaturedBackgroundItem | null {
  const item = getObject(rawItem)
  const data = Array.isArray(item.data) ? getObject(item.data[0]) : {}
  const nasaId = String(data.nasa_id || '').trim()
  const title = String(data.title || nasaId || 'NASA Image').trim()
  const assetUrl = normalizeNasaAssetUrl(String(item.href || '').trim())
  const credit = String(data.secondary_creator || data.center || 'NASA Image and Video Library').trim()
  const keywords = Array.isArray(data.keywords)
    ? data.keywords.map(cleanSingleLine).filter(Boolean)
    : []
  if (!nasaId || !assetUrl || !isFeaturedBackgroundStyleSuitable({
    title,
    credit,
    provider: 'nasa',
    metadata: [
      cleanSingleLine(data.description),
      ...keywords
    ]
  })) {
    return null
  }
  return {
    id: `nasa-${slugifyId(nasaId)}`,
    title,
    provider: 'nasa',
    imageUrl: assetUrl,
    sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
    credit,
    license: 'NASA image',
    accentColor: '#05080d',
    dynamic: true
  }
}

function selectNasaHighResolutionImageUrl(assetList: unknown): string {
  const urls = Array.isArray(assetList)
    ? assetList.map((value) => normalizeNasaAssetUrl(String(value || '').trim()))
    : []
  const candidates = urls.filter((url) => /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(url) && !/~thumb\.|~small\./i.test(url))
  const preferred = candidates.find((url) => /~orig\./i.test(url)) ||
    candidates.find((url) => /~large\./i.test(url))
  return preferred || ''
}

function normalizeNasaAssetUrl(rawUrl: string): string {
  if (!rawUrl) {
    return ''
  }
  try {
    const url = new URL(rawUrl)
    if (url.protocol === 'http:' && url.hostname === 'images-assets.nasa.gov') {
      url.protocol = 'https:'
      return url.href
    }
  } catch {
    return rawUrl
  }
  return rawUrl
}

async function fetchWikimediaFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const searchResults = await Promise.all(COMMONS_SEARCH_QUERIES.map((query, index) => {
    const offset = ((seed + index) % COMMONS_SEARCH_OFFSET_VARIANTS) * COMMONS_SEARCH_LIMIT
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${COMMONS_SEARCH_LIMIT}&gsroffset=${offset}&prop=imageinfo&iiprop=url|user|mime|size&iiurlwidth=1920&format=json&origin=*`
    return client.fetchJson(url).catch(() => null)
  }))
  const pages = rotateFeaturedCandidates(
    dedupeFeaturedItems(
      searchResults.flatMap((raw) => {
        const query = getObject(raw).query
        const rawPages = getObject(query).pages
        if (!rawPages || typeof rawPages !== 'object' || Array.isArray(rawPages)) {
          return []
        }
        return Object.values(rawPages).flatMap(page => { const mappedResult = normalizeWikimediaFeaturedItem(page, options); return mappedResult ? [mappedResult] : [] }) as FeaturedBackgroundItem[]
      })
    ),
    seed
  )
  return pages.slice(0, FEATURED_REFRESH_SOURCE_LIMIT)
}

function normalizeWikimediaFeaturedItem(
  rawPage: unknown,
  options: FeaturedGalleryRefreshOptions
): FeaturedBackgroundItem | null {
  const page = getObject(rawPage)
  const imageInfo = Array.isArray(page.imageinfo) ? getObject(page.imageinfo[0]) : {}
  const imageUrl = String(imageInfo.url || '').trim()
  const mime = String(imageInfo.mime || '').toLowerCase()
  const width = Number(imageInfo.width || imageInfo.thumbwidth)
  const height = Number(imageInfo.height || imageInfo.thumbheight)
  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  if (!imageUrl ||
    mime.includes('svg') ||
    !isHighResolutionFeaturedBackground(width, height, threshold.minLongEdge, threshold.minShortEdge)) {
    return null
  }

  const rawPageTitle = String(page.title || '').trim()
  const rawTitle = rawPageTitle.replace(/^File:/i, '').trim()
  const title = cleanDisplayTitle(rawTitle || 'Wikimedia Commons')
  const credit = String(imageInfo.user || 'Wikimedia Commons').trim()
  if (!isFeaturedBackgroundStyleSuitable({
    title,
    credit,
    provider: 'wikimedia',
    metadata: [rawPageTitle, String(imageInfo.descriptionurl || '')]
  })) {
    return null
  }
  return {
    id: `wikimedia-${slugifyId(rawPageTitle || title)}`,
    title,
    provider: 'wikimedia',
    imageUrl,
    sourceUrl: String(imageInfo.descriptionurl || '').trim() || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title || ''))}`,
    credit,
    license: 'Public domain / Wikimedia Commons',
    accentColor: '#101820',
    dynamic: true,
    width,
    height
  }
}

async function fetchMetFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const searchResults = await Promise.all(MET_SEARCH_QUERIES.map((query) => {
    const url = buildFeaturedGalleryApiUrl('https://collectionapi.metmuseum.org/public/collection/v1/search', {
      hasImages: 'true',
      isPublicDomain: 'true',
      q: query
    })
    return client.fetchJson(url).catch(() => null)
  }))
  const objectIds = rotateFeaturedCandidates(
    dedupeStrings(searchResults.flatMap((raw) => {
      const rawIds = getObject(raw).objectIDs
      return Array.isArray(rawIds) ? rawIds.map((id) => String(id || '').trim()).filter(Boolean) : []
    })),
    seed
  )
  const hydrated = await mapWithConcurrency(
    objectIds.slice(0, FEATURED_REFRESH_SOURCE_LIMIT),
    FEATURED_REFRESH_CONCURRENCY,
    async (objectId) => {
      const rawObject = await client.fetchJson(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${encodeURIComponent(objectId)}`
      ).catch(() => null)
      const candidate = normalizeMetFeaturedItem(rawObject)
      const imageSize = candidate ? await getHighResolutionImageSize(client, candidate.imageUrl, options) : null
      if (!candidate || !imageSize) {
        return null
      }
      return {
        ...candidate,
        width: imageSize.width,
        height: imageSize.height
      }
    }
  )
  return hydrated.filter(Boolean) as FeaturedBackgroundItem[]
}

function normalizeMetFeaturedItem(rawObject: unknown): FeaturedBackgroundItem | null {
  const item = getObject(rawObject)
  if (item.isPublicDomain !== true) {
    return null
  }

  const objectId = String(item.objectID || '').trim()
  const imageUrl = String(item.primaryImage || '').trim()
  const title = String(item.title || 'The Met Open Access').trim()
  const credit = cleanSingleLine(item.artistDisplayName) || 'The Metropolitan Museum of Art'
  const tags = Array.isArray(item.tags)
    ? item.tags.map((tag) => cleanSingleLine(getObject(tag).term)).filter(Boolean)
    : []
  if (!objectId || !imageUrl || !isFeaturedBackgroundStyleSuitable({
    title,
    credit,
    provider: 'met',
    metadata: [
      cleanSingleLine(item.department),
      cleanSingleLine(item.classification),
      cleanSingleLine(item.objectName),
      ...tags
    ]
  })) {
    return null
  }

  return {
    id: `met-${slugifyId(objectId)}`,
    title,
    provider: 'met',
    imageUrl,
    sourceUrl: String(item.objectURL || '').trim() || `https://www.metmuseum.org/art/collection/search/${encodeURIComponent(objectId)}`,
    credit,
    license: 'Open Access / Public Domain',
    accentColor: '#18200f',
    dynamic: true
  }
}

async function fetchClevelandFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const searchResults = await Promise.all(CLEVELAND_SEARCH_QUERIES.map((query, index) => {
    const skip = ((seed + index) % CLEVELAND_SEARCH_OFFSET_VARIANTS) * CLEVELAND_SEARCH_LIMIT
    const url = buildFeaturedGalleryApiUrl('https://openaccess-api.clevelandart.org/api/artworks/', {
      cc0: '1',
      has_image: '1',
      limit: CLEVELAND_SEARCH_LIMIT,
      q: query,
      skip
    })
    return client.fetchJson(url).catch(() => null)
  }))
  const candidates = rotateFeaturedCandidates(
    dedupeFeaturedItems(
      searchResults.flatMap((raw) => {
        const rawItems = getObject(raw).data
        if (!Array.isArray(rawItems)) {
          return []
        }
        return rawItems.flatMap((rawItem) => {
          const item = normalizeClevelandFeaturedItem(rawItem, options)
          return item ? [item] : []
        }) as FeaturedBackgroundItem[]
      })
    ),
    seed
  )
  return candidates.slice(0, FEATURED_REFRESH_SOURCE_LIMIT)
}

function normalizeClevelandFeaturedItem(
  rawItem: unknown,
  options: FeaturedGalleryRefreshOptions
): FeaturedBackgroundItem | null {
  const item = getObject(rawItem)
  const licenseStatus = String(item.share_license_status || '').trim().toUpperCase()
  if (licenseStatus && licenseStatus !== 'CC0') {
    return null
  }

  const images = getObject(item.images)
  const printImage = getObject(images.print)
  const imageUrl = String(printImage.url || '').trim()
  const width = Number(printImage.width)
  const height = Number(printImage.height)
  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  if (!imageUrl ||
    !isHighResolutionFeaturedBackground(width, height, threshold.minLongEdge, threshold.minShortEdge)) {
    return null
  }

  const rawId = String(item.accession_number || item.id || '').trim()
  const title = String(item.title || 'Cleveland Museum of Art').trim()
  const creators = Array.isArray(item.creators)
    ? item.creators.map((creator) => cleanSingleLine(getObject(creator).description)).filter(Boolean)
    : []
  const credit = creators[0] || 'Cleveland Museum of Art'
  const alternateTitles = Array.isArray(item.alternate_titles)
    ? item.alternate_titles.map(cleanSingleLine).filter(Boolean)
    : []
  if (!rawId || !isFeaturedBackgroundStyleSuitable({
    title,
    credit,
    provider: 'cleveland',
    metadata: [
      cleanSingleLine(item.current_location),
      cleanSingleLine(item.department),
      cleanSingleLine(item.collection),
      cleanSingleLine(item.type),
      ...alternateTitles
    ]
  })) {
    return null
  }

  return {
    id: `cleveland-${slugifyId(rawId)}`,
    title,
    provider: 'cleveland',
    imageUrl,
    sourceUrl: String(item.url || '').trim() || `https://www.clevelandart.org/art/${encodeURIComponent(rawId)}`,
    credit,
    license: 'CC0 / Cleveland Museum of Art',
    accentColor: '#1c1518',
    dynamic: true,
    width,
    height
  }
}

async function getHighResolutionImageSize(
  client: FeaturedGalleryFetchClient,
  imageUrl: string,
  options: FeaturedGalleryRefreshOptions
): Promise<{ width: number; height: number } | null> {
  if (!client.getImageSize) {
    return null
  }

  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  const size = await client.getImageSize(imageUrl).catch(() => null)
  if (!size ||
    !isHighResolutionFeaturedBackground(size.width, size.height, threshold.minLongEdge, threshold.minShortEdge)) {
    return null
  }
  return size
}

function getNasaFallbackSize(assetList: unknown, options: FeaturedGalleryRefreshOptions): { width: number; height: number } | null {
  const urls = Array.isArray(assetList) ? assetList.map((value) => String(value || '').trim()) : []
  const preferred = urls.find((url) => /~orig\./i.test(url)) ||
    urls.find((url) => /~large\./i.test(url)) ||
    ''
  if (!preferred) {
    return null
  }
  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  if (/~orig\./i.test(preferred)) {
    return {
      width: threshold.minLongEdge + 1200,
      height: threshold.minShortEdge + 900
    }
  }
  if (/~large\./i.test(preferred)) {
    return {
      width: Math.max(threshold.minLongEdge, 2560),
      height: Math.max(threshold.minShortEdge, 1440)
    }
  }
  return {
    width: Math.max(threshold.minLongEdge, 2048),
    height: Math.max(threshold.minShortEdge, 1152)
  }
}

function normalizeFeaturedRefreshSeed(seed: unknown): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.floor(seed))
  }
  const text = String(seed || '').trim()
  if (!text) {
    return Math.abs(Date.now())
  }
  return Math.abs(hashFeaturedBackgroundSeed(text))
}

function rotateFeaturedCandidates<T>(items: T[], seed: number): T[] {
  if (items.length <= 1) {
    return items
  }
  const start = seed % items.length
  return items.slice(start).concat(items.slice(0, start))
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length))
  const runWorker = async (): Promise<void> => {
    if (cursor >= items.length) {
      return
    }
    const index = cursor
    cursor += 1
    results[index] = await mapper(items[index])
    await runWorker()
  }
  const workers = Array.from({ length: workerCount }, () => {
    return runWorker()
  })
  await Promise.all(workers)
  return results
}

function dedupeFeaturedItems(items: FeaturedBackgroundItem[]): FeaturedBackgroundItem[] {
  const seen = new Set<string>()
  const deduped: FeaturedBackgroundItem[] = []
  for (const item of items) {
    const key = `${item.id}|${item.imageUrl}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(item)
  }
  return deduped
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of items) {
    const value = String(item || '').trim()
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    deduped.push(value)
  }
  return deduped
}

function dedupeNumbers(items: number[]): number[] {
  const seen = new Set<number>()
  const deduped: number[] = []
  for (const item of items) {
    const value = Math.max(1, Math.floor(item))
    if (!Number.isFinite(value) || seen.has(value)) {
      continue
    }
    seen.add(value)
    deduped.push(value)
  }
  return deduped
}

function hashFeaturedBackgroundSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash | 0
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function buildFeaturedGalleryApiUrl(baseUrl: string, params: Record<string, string | number>): string {
  const url = new URL(baseUrl)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return url.href
}

function cleanSingleLine(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugifyId(value: unknown): string {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'item'
}

function cleanDisplayTitle(value: string): string {
  return value
    .replace(/\.(?:jpe?g|png|webp)$/i, '')
    .replace(/_/g, ' ')
    .trim()
}
