const INSTANT_WALLPAPER_KEY = 'curatorNewTabInstantWallpaper'
const INSTANT_WALLPAPER_DATA_URL_KEY = 'curatorNewTabInstantWallpaperDataUrl'
const INSTANT_WALLPAPER_TARGET_KEY = 'curatorNewTabInstantWallpaperTarget'
const INSTANT_WALLPAPER_MAX_DIMENSION = 960
const INSTANT_WALLPAPER_QUALITY = 0.68
const DEFAULT_INSTANT_WALLPAPER_PLACEHOLDER = '#101013'
const DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF = INSTANT_WALLPAPER_DATA_URL_KEY

let cachedInstantWallpaperRecord: InstantWallpaperRecord | null | undefined
let cachedInstantWallpaperTargetRecord: InstantWallpaperTargetRecord | null | undefined
let cachedInstantWallpaperDataUrl: string | null | undefined

export interface InstantWallpaperRecord {
  signature: string
  dataUrl?: string
  dataUrlRef?: string
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  updatedAt: number
  ready: boolean
}

export interface InstantWallpaperTargetRecord {
  signature: string
  imageUrl: string
  previewUrl: string
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  cacheRequired: boolean
  cacheReady: boolean
  updatedAt: number
}

export interface InstantWallpaperDataUrlOptions {
  maxDimension?: number
  quality?: number
}

declare global {
  // eslint-disable-next-line no-var
  var __CURATOR_INSTANT_WALLPAPER_BOOT_RECORD__: unknown
  // eslint-disable-next-line no-var
  var __CURATOR_INSTANT_WALLPAPER_BOOT_TARGET__: unknown
  // eslint-disable-next-line no-var
  var __CURATOR_INSTANT_WALLPAPER_BOOT_DATA_URL__: unknown
}

export function readInstantWallpaper(): InstantWallpaperRecord | null {
  if (cachedInstantWallpaperRecord !== undefined) {
    return cachedInstantWallpaperRecord
  }
  const bootRecord = consumeInstantWallpaperBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_RECORD__')
  if (bootRecord !== undefined) {
    cachedInstantWallpaperRecord = normalizeInstantWallpaper(bootRecord)
    return cachedInstantWallpaperRecord
  }
  try {
    cachedInstantWallpaperRecord = normalizeInstantWallpaper(localStorage.getItem(INSTANT_WALLPAPER_KEY))
  } catch {
    cachedInstantWallpaperRecord = null
  }
  return cachedInstantWallpaperRecord
}

export function saveInstantWallpaper(record: InstantWallpaperRecord): boolean {
  const dataUrl = normalizeInstantWallpaperDataUrl(record.dataUrl) ||
    cachedInstantWallpaperDataUrl ||
    readStoredInstantWallpaperDataUrl(record.dataUrlRef)
  if (!record.signature || !dataUrl.startsWith('data:image/')) {
    return false
  }

  const normalizedRecord: InstantWallpaperRecord = {
    ...record,
    dataUrl: undefined,
    dataUrlRef: String(record.dataUrlRef || DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF).trim() || DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF,
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    ready: record.ready !== false
  }

  try {
    localStorage.setItem(normalizedRecord.dataUrlRef, dataUrl)
    localStorage.setItem(INSTANT_WALLPAPER_KEY, JSON.stringify(normalizedRecord))
    cachedInstantWallpaperRecord = normalizedRecord
    cachedInstantWallpaperDataUrl = dataUrl
    return true
  } catch {
    try {
      localStorage.removeItem(INSTANT_WALLPAPER_KEY)
      localStorage.removeItem(normalizedRecord.dataUrlRef)
      localStorage.setItem(normalizedRecord.dataUrlRef, dataUrl)
      localStorage.setItem(INSTANT_WALLPAPER_KEY, JSON.stringify(normalizedRecord))
      cachedInstantWallpaperRecord = normalizedRecord
      cachedInstantWallpaperDataUrl = dataUrl
      return true
    } catch {
      // Synchronous startup cache is best-effort; IndexedDB remains the durable cache.
    }
    return false
  }
}

export function readInstantWallpaperDataUrl(record = readInstantWallpaper()): string {
  if (!record || record.ready === false) {
    return ''
  }
  const inlineDataUrl = normalizeInstantWallpaperDataUrl(record.dataUrl)
  if (inlineDataUrl) {
    cachedInstantWallpaperDataUrl = inlineDataUrl
    return inlineDataUrl
  }
  if (cachedInstantWallpaperDataUrl !== undefined) {
    return cachedInstantWallpaperDataUrl || ''
  }
  const bootDataUrl = consumeInstantWallpaperBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_DATA_URL__')
  const bootInlineDataUrl = normalizeInstantWallpaperDataUrl(bootDataUrl)
  if (bootInlineDataUrl) {
    cachedInstantWallpaperDataUrl = bootInlineDataUrl
    return bootInlineDataUrl
  }
  const dataUrlRef = String(record.dataUrlRef || '').trim()
  if (!dataUrlRef) {
    cachedInstantWallpaperDataUrl = null
    return ''
  }
  cachedInstantWallpaperDataUrl = readStoredInstantWallpaperDataUrl(dataUrlRef)
  return cachedInstantWallpaperDataUrl || ''
}

export function readInstantWallpaperTarget(): InstantWallpaperTargetRecord | null {
  if (cachedInstantWallpaperTargetRecord !== undefined) {
    return cachedInstantWallpaperTargetRecord
  }
  const bootRecord = consumeInstantWallpaperBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_TARGET__')
  if (bootRecord !== undefined) {
    cachedInstantWallpaperTargetRecord = normalizeInstantWallpaperTarget(bootRecord)
    return cachedInstantWallpaperTargetRecord
  }
  try {
    cachedInstantWallpaperTargetRecord = normalizeInstantWallpaperTarget(localStorage.getItem(INSTANT_WALLPAPER_TARGET_KEY))
  } catch {
    cachedInstantWallpaperTargetRecord = null
  }
  return cachedInstantWallpaperTargetRecord
}

export function saveInstantWallpaperTarget(record: InstantWallpaperTargetRecord): void {
  if (!record.signature) {
    return
  }

  const normalizedRecord: InstantWallpaperTargetRecord = {
    ...record,
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    cacheRequired: record.cacheRequired === true,
    cacheReady: record.cacheReady === true
  }

  try {
    localStorage.setItem(INSTANT_WALLPAPER_TARGET_KEY, JSON.stringify(normalizedRecord))
    cachedInstantWallpaperTargetRecord = normalizedRecord
  } catch {
    // Startup target mirror is best-effort; chrome.storage remains the durable source.
  }
}

export function clearInstantWallpaperTarget(): void {
  cachedInstantWallpaperTargetRecord = null
  try {
    localStorage.removeItem(INSTANT_WALLPAPER_TARGET_KEY)
  } catch {
    // Best-effort cleanup.
  }
}

export function clearInstantWallpaper(): void {
  const dataUrlRef = String(cachedInstantWallpaperRecord?.dataUrlRef || DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF).trim() || DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF
  cachedInstantWallpaperRecord = null
  cachedInstantWallpaperDataUrl = null
  try {
    localStorage.removeItem(INSTANT_WALLPAPER_KEY)
    localStorage.removeItem(dataUrlRef)
  } catch {
    // Best-effort cleanup.
  }
}

function normalizeInstantWallpaper(rawValue: unknown): InstantWallpaperRecord | null {
  const record = parseInstantWallpaperRecord(rawValue)
  if (!record) {
    return null
  }

  const signature = String(record.signature || '')
  const dataUrl = normalizeInstantWallpaperDataUrl(record.dataUrl)
  const dataUrlRef = String(record.dataUrlRef || (dataUrl ? DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF : '')).trim()
  if (!signature || (!dataUrl && !dataUrlRef)) {
    return null
  }
  const normalizedRecord: InstantWallpaperRecord = {
    signature,
    dataUrlRef,
    backgroundSize: normalizeInstantWallpaperBackgroundSize(record.backgroundSize),
    backgroundPosition: String(record.backgroundPosition || 'center'),
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    updatedAt: Number(record.updatedAt) || 0,
    ready: record.ready !== false
  }
  if (dataUrl) {
    normalizedRecord.dataUrl = dataUrl
  }
  return normalizedRecord
}

function normalizeInstantWallpaperTarget(rawValue: unknown): InstantWallpaperTargetRecord | null {
  const record = parseInstantWallpaperTargetRecord(rawValue)
  if (!record) {
    return null
  }

  const signature = String(record.signature || '')
  if (!signature) {
    return null
  }
  return {
    signature,
    imageUrl: String(record.imageUrl || ''),
    previewUrl: String(record.previewUrl || ''),
    backgroundSize: normalizeInstantWallpaperBackgroundSize(record.backgroundSize),
    backgroundPosition: String(record.backgroundPosition || 'center'),
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    cacheRequired: record.cacheRequired === true,
    cacheReady: record.cacheReady === true,
    updatedAt: Number(record.updatedAt) || 0
  }
}

export async function createInstantWallpaperDataUrl(
  blob: Blob,
  options: InstantWallpaperDataUrlOptions = {}
): Promise<string> {
  if (blob.type.toLowerCase() === 'image/gif') {
    return ''
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return ''
  }

  try {
    const sourceMaxDimension = Math.max(bitmap.width, bitmap.height)
    if (!sourceMaxDimension) {
      return ''
    }
    const maxDimension = normalizeInstantWallpaperMaxDimension(options.maxDimension)
    const quality = normalizeInstantWallpaperQuality(options.quality)
    const scale = Math.min(1, maxDimension / sourceMaxDimension)
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) {
      return ''
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}

function normalizeInstantWallpaperMaxDimension(value: unknown): number {
  const dimension = Math.round(Number(value))
  if (Number.isFinite(dimension) && dimension >= 64) {
    return Math.min(960, dimension)
  }
  return INSTANT_WALLPAPER_MAX_DIMENSION
}

function normalizeInstantWallpaperQuality(value: unknown): number {
  const quality = Number(value)
  if (Number.isFinite(quality) && quality > 0) {
    return Math.min(0.86, Math.max(0.32, quality))
  }
  return INSTANT_WALLPAPER_QUALITY
}

export function normalizeInstantWallpaperColor(value: unknown): string {
  const color = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return DEFAULT_INSTANT_WALLPAPER_PLACEHOLDER
}

function normalizeInstantWallpaperBackgroundSize(value: unknown): string {
  const backgroundSize = String(value || '').trim()
  return /^\d+(?:\.\d+)?%\s+auto$/i.test(backgroundSize)
    ? 'cover'
    : backgroundSize || 'cover'
}

export function getInstantWallpaperFallbackColor(): string {
  return DEFAULT_INSTANT_WALLPAPER_PLACEHOLDER
}

function parseInstantWallpaperRecord(rawValue: unknown): Partial<InstantWallpaperRecord> | null {
  if (typeof rawValue === 'string') {
    if (!rawValue) {
      return null
    }
    try {
      return JSON.parse(rawValue) as Partial<InstantWallpaperRecord>
    } catch {
      return null
    }
  }

  if (rawValue && typeof rawValue === 'object') {
    return rawValue as Partial<InstantWallpaperRecord>
  }

  return null
}

function normalizeInstantWallpaperDataUrl(value: unknown): string {
  const dataUrl = String(value || '').trim()
  return dataUrl.startsWith('data:image/') ? dataUrl : ''
}

function parseInstantWallpaperTargetRecord(rawValue: unknown): Partial<InstantWallpaperTargetRecord> | null {
  if (typeof rawValue === 'string') {
    if (!rawValue) {
      return null
    }
    try {
      return JSON.parse(rawValue) as Partial<InstantWallpaperTargetRecord>
    } catch {
      return null
    }
  }

  if (rawValue && typeof rawValue === 'object') {
    return rawValue as Partial<InstantWallpaperTargetRecord>
  }

  return null
}

function readStoredInstantWallpaperDataUrl(dataUrlRef: string | undefined | null): string {
  const normalizedDataUrlRef = String(dataUrlRef || '').trim()
  if (!normalizedDataUrlRef) {
    return ''
  }
  try {
    return normalizeInstantWallpaperDataUrl(localStorage.getItem(normalizedDataUrlRef))
  } catch {
    return ''
  }
}

function consumeInstantWallpaperBootRecord(
  key:
    | '__CURATOR_INSTANT_WALLPAPER_BOOT_RECORD__'
    | '__CURATOR_INSTANT_WALLPAPER_BOOT_TARGET__'
    | '__CURATOR_INSTANT_WALLPAPER_BOOT_DATA_URL__'
): unknown | undefined {
  const globalState = globalThis as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(globalState, key)) {
    return undefined
  }

  const record = globalState[key]
  try {
    delete globalState[key]
  } catch {
    globalState[key] = undefined
  }
  return record
}
