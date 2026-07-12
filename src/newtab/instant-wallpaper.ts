import {
  normalizeBackgroundMaskBlur,
  normalizeBackgroundMaskPercentage,
  normalizeBackgroundMaskStyle,
  type BackgroundMaskStyle
} from './background-mask-settings.js'

const INSTANT_WALLPAPER_KEY = 'curatorNewTabInstantWallpaper'
const INSTANT_WALLPAPER_DATA_URL_KEY = 'curatorNewTabInstantWallpaperDataUrl'
const INSTANT_WALLPAPER_IMAGE_DATA_URL_KEY = 'curatorNewTabInstantWallpaperImageDataUrl'
const INSTANT_WALLPAPER_TARGET_KEY = 'curatorNewTabInstantWallpaperTarget'
const BACKGROUND_MASK_SNAPSHOT_KEY = 'curatorNewTabBackgroundMaskSnapshot'
const INSTANT_WALLPAPER_MAX_DIMENSION = 960
const INSTANT_WALLPAPER_QUALITY = 0.68
const INSTANT_WALLPAPER_IMAGE_DATA_URL_MAX_LENGTH = 2_400_000
const INSTANT_WALLPAPER_INLINE_ORIGINAL_MAX_BYTES = 1_200_000
const INSTANT_WALLPAPER_VIDEO_POSTER_TIMEOUT_MS = 5200
const DEFAULT_INSTANT_WALLPAPER_PLACEHOLDER = '#101013'
const DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF = INSTANT_WALLPAPER_DATA_URL_KEY
const DEFAULT_INSTANT_WALLPAPER_IMAGE_DATA_URL_REF = INSTANT_WALLPAPER_IMAGE_DATA_URL_KEY
const INSTANT_WALLPAPER_IMAGE_DATA_URL_ATTEMPTS = [
  { maxDimension: 2560, quality: 0.88 },
  { maxDimension: 1920, quality: 0.84 },
  { maxDimension: 1440, quality: 0.8 },
  { maxDimension: 1080, quality: 0.76 }
] as const
const INSTANT_WALLPAPER_VIDEO_POSTER_TIMES = [0.12, 0.55, 1.2] as const

let cachedInstantWallpaperRecord: InstantWallpaperRecord | null | undefined
let cachedInstantWallpaperTargetRecord: InstantWallpaperTargetRecord | null | undefined
let cachedInstantWallpaperDataUrl: string | null | undefined
let cachedInstantWallpaperImageDataUrl: string | null | undefined

export interface InstantWallpaperRecord {
  signature: string
  dataUrl?: string
  dataUrlRef?: string
  imageDataUrl?: string
  imageDataUrlRef?: string
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  updatedAt: number
  ready: boolean
}

export interface InstantWallpaperTargetRecord {
  signature: string
  imageUrl: string
  imageDataUrlRef?: string
  previewUrl: string
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  maskEnabled: boolean
  maskStyle: BackgroundMaskStyle
  maskOverlay: number
  maskBlur: number
  cacheRequired: boolean
  cacheReady: boolean
  updatedAt: number
}

export interface BackgroundMaskSnapshot {
  maskEnabled: boolean
  maskStyle: BackgroundMaskStyle
  maskOverlay: number
  maskBlur: number
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
  // eslint-disable-next-line no-var
  var __CURATOR_INSTANT_WALLPAPER_BOOT_IMAGE_DATA_URL__: unknown
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
  const imageDataUrl = normalizeInstantWallpaperDataUrl(record.imageDataUrl) ||
    cachedInstantWallpaperImageDataUrl ||
    readStoredInstantWallpaperDataUrl(record.imageDataUrlRef)
  const dataUrl = normalizeInstantWallpaperDataUrl(record.dataUrl) ||
    cachedInstantWallpaperDataUrl ||
    readStoredInstantWallpaperDataUrl(record.dataUrlRef) ||
    imageDataUrl
  if (!record.signature || (!dataUrl.startsWith('data:image/') && !imageDataUrl.startsWith('data:image/'))) {
    return false
  }

  const imageDataUrlRef = String(record.imageDataUrlRef || DEFAULT_INSTANT_WALLPAPER_IMAGE_DATA_URL_REF).trim() ||
    DEFAULT_INSTANT_WALLPAPER_IMAGE_DATA_URL_REF
  const dataUrlRef = String(record.dataUrlRef || (
    imageDataUrl && dataUrl === imageDataUrl
      ? imageDataUrlRef
      : DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF
  )).trim() || DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF
  const normalizedRecord: InstantWallpaperRecord = {
    ...record,
    dataUrl: undefined,
    dataUrlRef,
    imageDataUrl: undefined,
    imageDataUrlRef: imageDataUrl ? imageDataUrlRef : '',
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    ready: record.ready !== false
  }

  try {
    persistInstantWallpaperRecord(normalizedRecord, dataUrl, imageDataUrl)
    return true
  } catch {
    if (imageDataUrl && dataUrl && dataUrl !== imageDataUrl) {
      const fallbackRecord: InstantWallpaperRecord = {
        ...normalizedRecord,
        dataUrlRef: DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF,
        imageDataUrlRef: ''
      }
      try {
        localStorage.removeItem(imageDataUrlRef)
        persistInstantWallpaperRecord(fallbackRecord, dataUrl, '')
        return true
      } catch {
        // Fall through to the legacy retry below.
      }
    }

    try {
      localStorage.removeItem(INSTANT_WALLPAPER_KEY)
      localStorage.removeItem(dataUrlRef)
      localStorage.removeItem(imageDataUrlRef)
      const fallbackRecord: InstantWallpaperRecord = {
        ...normalizedRecord,
        dataUrlRef: DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF,
        imageDataUrlRef: ''
      }
      persistInstantWallpaperRecord(fallbackRecord, dataUrl, '')
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
    cachedInstantWallpaperDataUrl = readInstantWallpaperImageDataUrl(record) || null
    return cachedInstantWallpaperDataUrl || ''
  }
  cachedInstantWallpaperDataUrl = readStoredInstantWallpaperDataUrl(dataUrlRef)
  if (!cachedInstantWallpaperDataUrl) {
    cachedInstantWallpaperDataUrl = readInstantWallpaperImageDataUrl(record)
  }
  return cachedInstantWallpaperDataUrl || ''
}

export function readInstantWallpaperImageDataUrl(record = readInstantWallpaper()): string {
  if (!record || record.ready === false) {
    return ''
  }
  const inlineDataUrl = normalizeInstantWallpaperDataUrl(record.imageDataUrl)
  if (inlineDataUrl) {
    cachedInstantWallpaperImageDataUrl = inlineDataUrl
    return inlineDataUrl
  }
  if (cachedInstantWallpaperImageDataUrl !== undefined) {
    return cachedInstantWallpaperImageDataUrl || ''
  }
  const bootDataUrl = consumeInstantWallpaperBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_IMAGE_DATA_URL__')
  const bootInlineDataUrl = normalizeInstantWallpaperDataUrl(bootDataUrl)
  if (bootInlineDataUrl) {
    cachedInstantWallpaperImageDataUrl = bootInlineDataUrl
    return bootInlineDataUrl
  }
  const dataUrlRef = String(record.imageDataUrlRef || '').trim()
  if (!dataUrlRef) {
    cachedInstantWallpaperImageDataUrl = null
    return ''
  }
  cachedInstantWallpaperImageDataUrl = readStoredInstantWallpaperDataUrl(dataUrlRef)
  return cachedInstantWallpaperImageDataUrl || ''
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
    imageDataUrlRef: String(record.imageDataUrlRef || '').trim(),
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    maskEnabled: record.maskEnabled === true,
    maskStyle: normalizeBackgroundMaskStyle(record.maskStyle),
    maskOverlay: normalizeBackgroundMaskPercentage(record.maskOverlay),
    maskBlur: normalizeBackgroundMaskBlur(record.maskBlur),
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

export function saveBackgroundMaskSnapshot(snapshot: BackgroundMaskSnapshot): void {
  // Mirror the mask independently of any wallpaper cache so the synchronous boot
  // script can paint the readability mask on the very first frame for every
  // background type — including solid colors, which never write a wallpaper target.
  const normalized: BackgroundMaskSnapshot = {
    maskEnabled: snapshot.maskEnabled === true,
    maskStyle: normalizeBackgroundMaskStyle(snapshot.maskStyle),
    maskOverlay: normalizeBackgroundMaskPercentage(snapshot.maskOverlay),
    maskBlur: normalizeBackgroundMaskBlur(snapshot.maskBlur)
  }
  try {
    localStorage.setItem(BACKGROUND_MASK_SNAPSHOT_KEY, JSON.stringify(normalized))
  } catch {
    // Startup mask mirror is best-effort; chrome.storage remains the durable source.
  }
}

export function readBackgroundMaskSnapshot(): BackgroundMaskSnapshot | null {
  try {
    const raw = localStorage.getItem(BACKGROUND_MASK_SNAPSHOT_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<BackgroundMaskSnapshot>
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return {
      maskEnabled: parsed.maskEnabled === true,
      maskStyle: normalizeBackgroundMaskStyle(parsed.maskStyle),
      maskOverlay: normalizeBackgroundMaskPercentage(parsed.maskOverlay),
      maskBlur: normalizeBackgroundMaskBlur(parsed.maskBlur)
    }
  } catch {
    return null
  }
}

export function clearInstantWallpaper(): void {
  const dataUrlRef = String(cachedInstantWallpaperRecord?.dataUrlRef || DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF).trim() || DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF
  const imageDataUrlRef = String(cachedInstantWallpaperRecord?.imageDataUrlRef || DEFAULT_INSTANT_WALLPAPER_IMAGE_DATA_URL_REF).trim() || DEFAULT_INSTANT_WALLPAPER_IMAGE_DATA_URL_REF
  cachedInstantWallpaperRecord = null
  cachedInstantWallpaperDataUrl = null
  cachedInstantWallpaperImageDataUrl = null
  try {
    localStorage.removeItem(INSTANT_WALLPAPER_KEY)
    localStorage.removeItem(dataUrlRef)
    localStorage.removeItem(imageDataUrlRef)
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
  const imageDataUrl = normalizeInstantWallpaperDataUrl(record.imageDataUrl)
  const dataUrlRef = String(record.dataUrlRef || (dataUrl ? DEFAULT_INSTANT_WALLPAPER_DATA_URL_REF : '')).trim()
  const imageDataUrlRef = String(record.imageDataUrlRef || (imageDataUrl ? DEFAULT_INSTANT_WALLPAPER_IMAGE_DATA_URL_REF : '')).trim()
  if (!signature || (!dataUrl && !dataUrlRef && !imageDataUrl && !imageDataUrlRef)) {
    return null
  }
  const normalizedRecord: InstantWallpaperRecord = {
    signature,
    dataUrlRef,
    imageDataUrlRef,
    backgroundSize: normalizeInstantWallpaperBackgroundSize(record.backgroundSize),
    backgroundPosition: String(record.backgroundPosition || 'center'),
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    updatedAt: Number(record.updatedAt) || 0,
    ready: record.ready !== false
  }
  if (dataUrl) {
    normalizedRecord.dataUrl = dataUrl
  }
  if (imageDataUrl) {
    normalizedRecord.imageDataUrl = imageDataUrl
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
    imageDataUrlRef: String(record.imageDataUrlRef || '').trim(),
    previewUrl: String(record.previewUrl || ''),
    backgroundSize: normalizeInstantWallpaperBackgroundSize(record.backgroundSize),
    backgroundPosition: String(record.backgroundPosition || 'center'),
    placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
    maskEnabled: record.maskEnabled === true,
    maskStyle: normalizeBackgroundMaskStyle(record.maskStyle),
    maskOverlay: normalizeBackgroundMaskPercentage(record.maskOverlay),
    maskBlur: normalizeBackgroundMaskBlur(record.maskBlur),
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

export function createInstantWallpaperImageDataUrl(blob: Blob): Promise<string> {
  if (!String(blob.type || '').toLowerCase().startsWith('image/')) {
    return Promise.resolve('')
  }

  return createFirstInstantWallpaperImageDataUrl(blob)
}

async function createFirstInstantWallpaperImageDataUrl(blob: Blob, attemptIndex = 0): Promise<string> {
  const attempt = INSTANT_WALLPAPER_IMAGE_DATA_URL_ATTEMPTS[attemptIndex]
  if (!attempt) {
    return blob.size <= INSTANT_WALLPAPER_INLINE_ORIGINAL_MAX_BYTES
      ? readInstantWallpaperBlobDataUrl(blob)
      : ''
  }

  const dataUrl = await createCanvasInstantWallpaperDataUrl(blob, {
    ...attempt,
    type: 'image/webp'
  })
  if (dataUrl && dataUrl.length <= INSTANT_WALLPAPER_IMAGE_DATA_URL_MAX_LENGTH) {
    return dataUrl
  }
  return createFirstInstantWallpaperImageDataUrl(blob, attemptIndex + 1)
}

function readInstantWallpaperBlobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(normalizeInstantWallpaperDataUrl(reader.result))
    }
    reader.onerror = () => {
      resolve('')
    }
    reader.readAsDataURL(blob)
  })
}

async function createCanvasInstantWallpaperDataUrl(
  blob: Blob,
  {
    maxDimension,
    quality,
    type
  }: {
    maxDimension: number
    quality: number
    type: string
  }
): Promise<string> {
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
    return normalizeInstantWallpaperDataUrl(canvas.toDataURL(type, quality))
  } finally {
    bitmap.close()
  }
}

export async function createInstantWallpaperVideoPosterDataUrl(
  blob: Blob,
  { force = false }: { force?: boolean } = {}
): Promise<string> {
  if (!force && !String(blob.type || '').toLowerCase().startsWith('video/')) {
    return ''
  }

  const objectUrl = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  try {
    video.src = objectUrl
    video.load()
    const hasMetadata = await waitForInstantWallpaperVideoReady(
      video,
      HTMLMediaElement.HAVE_METADATA,
      ['loadedmetadata', 'loadeddata', 'canplay']
    )
    if (!hasMetadata) {
      return ''
    }

    let fallbackDataUrl = ''
    for (const time of getInstantWallpaperVideoPosterTimes(video.duration)) {
      const frameReady = await seekInstantWallpaperVideoFrame(video, time)
      if (!frameReady) {
        continue
      }

      const dataUrl = createInstantWallpaperVideoFrameDataUrl(video)
      if (!dataUrl) {
        continue
      }
      fallbackDataUrl ||= dataUrl
      if (!isLikelyDarkInstantWallpaperVideoFrame(video)) {
        return dataUrl
      }
    }

    return fallbackDataUrl
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

function getInstantWallpaperVideoPosterTimes(duration: number): number[] {
  const hasDuration = Number.isFinite(duration) && duration > 0
  const maxTime = hasDuration ? Math.max(0, duration - 0.04) : 0
  const candidates = [
    ...INSTANT_WALLPAPER_VIDEO_POSTER_TIMES,
    hasDuration ? duration * 0.25 : 0,
    0
  ]
  const seen = new Set<string>()
  return candidates.flatMap((time) => {
    const normalizedTime = hasDuration
      ? Math.min(Math.max(0, time), maxTime)
      : Math.max(0, time)
    const key = normalizedTime.toFixed(2)
    if (seen.has(key)) {
      return []
    }
    seen.add(key)
    return [normalizedTime]
  })
}

function waitForInstantWallpaperVideoReady(
  video: HTMLVideoElement,
  readyState: number,
  events: Array<keyof HTMLMediaElementEventMap>,
  timeoutMs = INSTANT_WALLPAPER_VIDEO_POSTER_TIMEOUT_MS
): Promise<boolean> {
  if (video.readyState >= readyState && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    let settled = false
    const timeout = window.setTimeout(() => {
      settle(false)
    }, timeoutMs)

    const cleanup = () => {
      window.clearTimeout(timeout)
      events.forEach((eventName) => video.removeEventListener(eventName, handleReady))
      video.removeEventListener('error', handleError)
    }
    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(ready)
    }
    const handleReady = () => {
      if (video.readyState >= readyState && video.videoWidth > 0 && video.videoHeight > 0) {
        settle(true)
      }
    }
    const handleError = () => {
      settle(false)
    }

    events.forEach((eventName) => video.addEventListener(eventName, handleReady))
    video.addEventListener('error', handleError, { once: true })
  })
}

async function seekInstantWallpaperVideoFrame(
  video: HTMLVideoElement,
  time: number
): Promise<boolean> {
  if (!Number.isFinite(time)) {
    return waitForInstantWallpaperVideoReady(video, HTMLMediaElement.HAVE_CURRENT_DATA, ['loadeddata', 'canplay'])
  }

  const targetTime = Math.max(0, time)
  if (Math.abs(video.currentTime - targetTime) <= 0.03) {
    return waitForInstantWallpaperVideoReady(video, HTMLMediaElement.HAVE_CURRENT_DATA, ['loadeddata', 'canplay'])
  }

  const seeked = await new Promise<boolean>((resolve) => {
    let settled = false
    const timeout = window.setTimeout(() => {
      settle(false)
    }, INSTANT_WALLPAPER_VIDEO_POSTER_TIMEOUT_MS)
    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('loadeddata', handleSeeked)
      video.removeEventListener('canplay', handleSeeked)
      video.removeEventListener('error', handleError)
    }
    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(ready)
    }
    const handleSeeked = () => {
      settle(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
    }
    const handleError = () => {
      settle(false)
    }

    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('loadeddata', handleSeeked)
    video.addEventListener('canplay', handleSeeked)
    video.addEventListener('error', handleError, { once: true })
    try {
      video.currentTime = targetTime
    } catch {
      settle(false)
    }
  })

  return seeked && waitForInstantWallpaperVideoReady(video, HTMLMediaElement.HAVE_CURRENT_DATA, ['loadeddata', 'canplay'])
}

function createInstantWallpaperVideoFrameDataUrl(video: HTMLVideoElement): string {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  const sourceMaxDimension = Math.max(sourceWidth, sourceHeight)
  if (!sourceMaxDimension) {
    return ''
  }

  for (const attempt of INSTANT_WALLPAPER_IMAGE_DATA_URL_ATTEMPTS) {
    const scale = Math.min(1, attempt.maxDimension / sourceMaxDimension)
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) {
      continue
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(video, 0, 0, targetWidth, targetHeight)
    const dataUrl = normalizeInstantWallpaperDataUrl(canvas.toDataURL('image/webp', attempt.quality))
    if (dataUrl && dataUrl.length <= INSTANT_WALLPAPER_IMAGE_DATA_URL_MAX_LENGTH) {
      return dataUrl
    }
  }

  return ''
}

function isLikelyDarkInstantWallpaperVideoFrame(video: HTMLVideoElement): boolean {
  const sampleSize = 24
  const canvas = document.createElement('canvas')
  canvas.width = sampleSize
  canvas.height = sampleSize
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context || !video.videoWidth || !video.videoHeight) {
    return false
  }

  try {
    context.drawImage(video, 0, 0, sampleSize, sampleSize)
    const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data
    let luminanceTotal = 0
    let brightPixels = 0
    const pixelCount = sampleSize * sampleSize
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] || 0
      const green = pixels[index + 1] || 0
      const blue = pixels[index + 2] || 0
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      luminanceTotal += luminance
      if (luminance > 28) {
        brightPixels += 1
      }
    }
    const averageLuminance = luminanceTotal / pixelCount
    return averageLuminance < 10 && brightPixels / pixelCount < 0.03
  } catch {
    return false
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

function persistInstantWallpaperRecord(
  record: InstantWallpaperRecord,
  dataUrl: string,
  imageDataUrl: string
): void {
  const imageDataUrlRef = String(record.imageDataUrlRef || '').trim()
  const dataUrlRef = String(record.dataUrlRef || '').trim()
  if (imageDataUrlRef && imageDataUrl) {
    localStorage.setItem(imageDataUrlRef, imageDataUrl)
  } else if (imageDataUrlRef) {
    localStorage.removeItem(imageDataUrlRef)
  }
  if (dataUrlRef && dataUrl && dataUrlRef !== imageDataUrlRef) {
    localStorage.setItem(dataUrlRef, dataUrl)
  } else if (dataUrlRef && dataUrlRef !== imageDataUrlRef) {
    localStorage.removeItem(dataUrlRef)
  }
  localStorage.setItem(INSTANT_WALLPAPER_KEY, JSON.stringify(record))
  cachedInstantWallpaperRecord = record
  cachedInstantWallpaperDataUrl = dataUrl || null
  cachedInstantWallpaperImageDataUrl = imageDataUrl || null
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
    | '__CURATOR_INSTANT_WALLPAPER_BOOT_IMAGE_DATA_URL__'
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
