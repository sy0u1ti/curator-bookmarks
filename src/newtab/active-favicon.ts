import { STORAGE_KEYS } from '../shared/constants.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'
import { buildChromeFaviconUrl } from './favicon-cache.js'

// Chrome 的 _favicon 端点只读取浏览器本地图标库，用户从未访问过的站点会返回
// 灰色默认地球。这里在检测到默认图标后主动访问站点自身的 favicon.ico /
// apple-touch-icon.png，并按 origin 缓存结果，避免每次打开新标签页都重复探测。

export interface ActiveFaviconEntry {
  src: string
  at: number
}

export interface ActiveFaviconStorePayload {
  version: 1
  entries: Record<string, ActiveFaviconEntry>
}

export const ACTIVE_FAVICON_POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const ACTIVE_FAVICON_MISS_TTL_MS = 24 * 60 * 60 * 1000
export const ACTIVE_FAVICON_ENTRY_LIMIT = 600

const PROBE_TIMEOUT_MS = 8000
const FLUSH_DELAY_MS = 250
const DEFAULT_PROBE_PAGE_URL = 'https://curator-default-favicon.invalid/'
const FAVICON_SOURCE_PATH = '/_favicon/'
const FAVICON_SIZE_FALLBACK = 32
const CANDIDATE_PATHS = ['/favicon.ico', '/apple-touch-icon.png'] as const

type ActiveFaviconListener = (origin: string, src: string) => void

interface DefaultFaviconSignature {
  height: number
  signature: number
  width: number
}

let storePayload: ActiveFaviconStorePayload | null = null
let storeLoadPromise: Promise<ActiveFaviconStorePayload> | null = null
let flushTimer: ReturnType<typeof setTimeout> | undefined
let signatureCanvas: HTMLCanvasElement | null = null
const resolvedSourcePromises = new Map<string, Promise<string | null>>()
const defaultSignaturePromises = new Map<string, Promise<DefaultFaviconSignature | null>>()
const resolutionListeners = new Set<ActiveFaviconListener>()

export function getActiveFaviconOrigin(pageUrl: unknown): string {
  const normalized = String(pageUrl ?? '').trim()
  if (!normalized) {
    return ''
  }
  try {
    const parsed = new URL(normalized)
    return /^https?:$/i.test(parsed.protocol) ? parsed.origin : ''
  } catch {
    return ''
  }
}

export function buildActiveFaviconCandidates(pageUrl: unknown): string[] {
  const origin = getActiveFaviconOrigin(pageUrl)
  if (!origin) {
    return []
  }
  return CANDIDATE_PATHS.map((path) => `${origin}${path}`)
}

export function isChromeFaviconSource(source: unknown): boolean {
  const normalized = String(source ?? '').trim()
  if (!normalized.startsWith('chrome-extension://')) {
    return false
  }
  try {
    return new URL(normalized).pathname === FAVICON_SOURCE_PATH
  } catch {
    return false
  }
}

export function getChromeFaviconSourcePageUrl(source: unknown): string {
  if (!isChromeFaviconSource(source)) {
    return ''
  }
  try {
    return new URL(String(source)).searchParams.get('pageUrl') || ''
  } catch {
    return ''
  }
}

export function getChromeFaviconSourceSize(source: unknown): number {
  try {
    const size = Math.round(Number(new URL(String(source)).searchParams.get('size')))
    return Number.isFinite(size) && size >= 16 && size <= 128 ? size : FAVICON_SIZE_FALLBACK
  } catch {
    return FAVICON_SIZE_FALLBACK
  }
}

export function isActiveFaviconEntryFresh(entry: ActiveFaviconEntry, now = Date.now()): boolean {
  const ttl = entry.src ? ACTIVE_FAVICON_POSITIVE_TTL_MS : ACTIVE_FAVICON_MISS_TTL_MS
  return now - entry.at < ttl
}

export function normalizeActiveFaviconStore(raw: unknown): ActiveFaviconStorePayload {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
  const rawEntries = source.entries && typeof source.entries === 'object' && !Array.isArray(source.entries)
    ? source.entries as Record<string, unknown>
    : {}
  const normalizedEntries = Object.entries(rawEntries)
    .map(([origin, value]) => [normalizeOriginKey(origin), normalizeActiveFaviconEntry(value)] as const)
    .filter((pair): pair is [string, ActiveFaviconEntry] => Boolean(pair[0] && pair[1]))
    .sort((left, right) => right[1].at - left[1].at)
    .slice(0, ACTIVE_FAVICON_ENTRY_LIMIT)
  const entries: Record<string, ActiveFaviconEntry> = {}
  for (const [origin, entry] of normalizedEntries) {
    entries[origin] = entry
  }
  return { version: 1, entries }
}

export function mergeActiveFaviconStorePayload(base: unknown, update: unknown): ActiveFaviconStorePayload {
  const merged = { ...normalizeActiveFaviconStore(base).entries }
  for (const [origin, entry] of Object.entries(normalizeActiveFaviconStore(update).entries)) {
    const existing = merged[origin]
    if (!existing || entry.at >= existing.at) {
      merged[origin] = entry
    }
  }
  return normalizeActiveFaviconStore({ version: 1, entries: merged })
}

export function getActiveFaviconSource(pageUrl: unknown): string {
  const origin = getActiveFaviconOrigin(pageUrl)
  if (!origin || !storePayload) {
    return ''
  }
  const entry = storePayload.entries[origin]
  if (!entry || !entry.src || !isActiveFaviconEntryFresh(entry)) {
    return ''
  }
  return entry.src
}

export function loadActiveFaviconStore(): Promise<void> {
  return ensureActiveFaviconStore().then(() => undefined)
}

export function clearActiveFaviconSource(pageUrl: unknown): void {
  const origin = getActiveFaviconOrigin(pageUrl)
  if (!origin) {
    return
  }
  resolvedSourcePromises.delete(origin)
  void ensureActiveFaviconStore().then((store) => {
    if (!store.entries[origin]) {
      return
    }
    delete store.entries[origin]
    scheduleActiveFaviconFlush()
  }).catch(() => {})
}

export function subscribeActiveFaviconResolution(listener: ActiveFaviconListener): () => void {
  resolutionListeners.add(listener)
  return () => {
    resolutionListeners.delete(listener)
  }
}

export async function resolveActiveFaviconSource(pageUrl: unknown): Promise<string | null> {
  const origin = getActiveFaviconOrigin(pageUrl)
  if (!origin) {
    return null
  }
  const store = await ensureActiveFaviconStore().catch(() => null)
  const entry = store?.entries[origin]
  if (entry && isActiveFaviconEntryFresh(entry)) {
    return entry.src || null
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null
  }
  let pending = resolvedSourcePromises.get(origin)
  if (!pending) {
    pending = probeActiveFavicon(origin)
    resolvedSourcePromises.set(origin, pending)
  }
  const src = await pending
  recordActiveFavicon(origin, src)
  return src
}

export async function resolveActiveFaviconForChromeSource(
  source: unknown,
  image?: HTMLImageElement | null
): Promise<string | null> {
  if (!isChromeFaviconSource(source)) {
    return null
  }
  const pageUrl = getChromeFaviconSourcePageUrl(source)
  if (!pageUrl) {
    return null
  }
  if (image && !(await matchesChromeDefaultFavicon(String(source), image))) {
    return null
  }
  return resolveActiveFaviconSource(pageUrl)
}

export async function matchesChromeDefaultFavicon(source: string, image: HTMLImageElement): Promise<boolean> {
  if (typeof document === 'undefined' || !image.naturalWidth || !image.naturalHeight) {
    return false
  }
  const reference = await loadDefaultFaviconSignature(getChromeFaviconSourceSize(source))
  if (!reference || reference.width !== image.naturalWidth || reference.height !== image.naturalHeight) {
    return false
  }
  const signature = readFaviconSignature(image)
  return signature !== null && signature === reference.signature
}

function normalizeOriginKey(value: unknown): string {
  const origin = String(value ?? '').trim()
  return getActiveFaviconOrigin(origin) === origin ? origin : ''
}

function normalizeActiveFaviconEntry(value: unknown): ActiveFaviconEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const entry = value as Record<string, unknown>
  const at = Number(entry.at)
  if (!Number.isFinite(at) || at <= 0) {
    return null
  }
  const src = String(entry.src ?? '').trim().slice(0, 4096)
  if (src && !/^https?:\/\//i.test(src)) {
    return null
  }
  return { src, at }
}

async function ensureActiveFaviconStore(): Promise<ActiveFaviconStorePayload> {
  if (storePayload) {
    return storePayload
  }
  if (!storeLoadPromise) {
    storeLoadPromise = getLocalStorage([STORAGE_KEYS.newTabActiveFavicons])
      .then((stored) => {
        storePayload = normalizeActiveFaviconStore(stored[STORAGE_KEYS.newTabActiveFavicons])
        return storePayload
      })
      .catch((error) => {
        storeLoadPromise = null
        throw error
      })
  }
  return storeLoadPromise
}

async function probeActiveFavicon(origin: string): Promise<string | null> {
  for (const candidate of CANDIDATE_PATHS) {
    const src = `${origin}${candidate}`
    if (await probeFaviconImage(src)) {
      return src
    }
  }
  return null
}

function probeFaviconImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (loaded: boolean) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(loaded)
    }
    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS)
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0)
    image.onerror = () => finish(false)
    image.src = url
  })
}

function recordActiveFavicon(origin: string, src: string | null): void {
  const store = storePayload
  if (!store) {
    return
  }
  const normalizedSrc = src || ''
  const existing = store.entries[origin]
  if (existing && existing.src === normalizedSrc) {
    return
  }
  store.entries[origin] = { src: normalizedSrc, at: Date.now() }
  storePayload = normalizeActiveFaviconStore(store)
  if (normalizedSrc) {
    for (const listener of resolutionListeners) {
      try {
        listener(origin, normalizedSrc)
      } catch (error) {
        console.warn('网站图标解析回调失败。', error)
      }
    }
  }
  scheduleActiveFaviconFlush()
}

function scheduleActiveFaviconFlush(): void {
  if (flushTimer !== undefined) {
    return
  }
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    void flushActiveFaviconStore()
  }, FLUSH_DELAY_MS)
}

async function flushActiveFaviconStore(): Promise<void> {
  const store = storePayload
  if (!store) {
    return
  }
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabActiveFavicons])
    const merged = mergeActiveFaviconStorePayload(stored[STORAGE_KEYS.newTabActiveFavicons], store)
    storePayload = merged
    await setLocalStorage({ [STORAGE_KEYS.newTabActiveFavicons]: merged })
  } catch (error) {
    console.warn('新标签页网站图标缓存保存失败。', error)
  }
}

function loadDefaultFaviconSignature(size: number): Promise<DefaultFaviconSignature | null> {
  const key = String(size)
  let pending = defaultSignaturePromises.get(key)
  if (!pending) {
    pending = loadDefaultFaviconSignatureUncached(size).catch(() => null)
    defaultSignaturePromises.set(key, pending)
  }
  return pending
}

async function loadDefaultFaviconSignatureUncached(size: number): Promise<DefaultFaviconSignature | null> {
  const source = buildChromeFaviconUrl(chrome.runtime.getURL(FAVICON_SOURCE_PATH), DEFAULT_PROBE_PAGE_URL, { size })
  const image = await loadFaviconImage(source)
  if (!image) {
    return null
  }
  const signature = readFaviconSignature(image)
  if (signature === null) {
    return null
  }
  return { height: image.naturalHeight, signature, width: image.naturalWidth }
}

function loadFaviconImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (result: HTMLImageElement | null) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS)
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null)
    image.onerror = () => finish(null)
    image.src = url
  })
}

function readFaviconSignature(image: HTMLImageElement): number | null {
  try {
    signatureCanvas ||= document.createElement('canvas')
    const width = image.naturalWidth
    const height = image.naturalHeight
    signatureCanvas.width = width
    signatureCanvas.height = height
    const context = signatureCanvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      return null
    }
    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, width, height).data
    let hash = 2166136261
    for (let index = 0; index < pixels.length; index += 1) {
      hash = Math.imul(hash ^ pixels[index], 16777619)
    }
    return hash >>> 0
  } catch {
    return null
  }
}
