interface InstantWallpaperTargetRecord {
  signature?: string
  imageUrl?: string
  previewUrl?: string
  backgroundSize?: string
  backgroundPosition?: string
  placeholderColor?: string
  updatedAt?: number
}

interface InstantWallpaperRecord {
  signature?: string
  dataUrl?: string
  dataUrlRef?: string
  ready?: boolean
}

interface StartupWallpaperView {
  backgroundColor: string
  booting: boolean
  image: string
  loaderVisible: boolean
  loading: boolean
  pending: boolean
  placeholderColor: string
  position: string
  previewImage: string
  ready: boolean
  remoteReady: boolean
  signature: string
  size: string
}

const thumbnailKey = 'curatorNewTabInstantWallpaper'
const thumbnailDataUrlKey = 'curatorNewTabInstantWallpaperDataUrl'
const targetKey = 'curatorNewTabInstantWallpaperTarget'
const fallbackColor = '#101013'
const bootGlobal = globalThis as Record<string, unknown>
const startupView = createStartupView()

cacheBootView()

try {
  const targetRecord = readRecord<InstantWallpaperTargetRecord>(targetKey)
  cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_TARGET__', targetRecord)
  if (!targetRecord?.signature) {
    applyStartupBackground('', '', '', fallbackColor, 'cover', 'center')
    revealWallpaper(false)
  } else {
    const targetPreviewUrl = getTargetPreviewUrl(targetRecord)
    const targetImageUrl = getTargetImageUrl(targetRecord)
    const thumbnailRecord = readRecord<InstantWallpaperRecord>(thumbnailKey)
    const thumbnailDataUrl = getMatchingThumbnailDataUrl(thumbnailRecord, targetRecord.signature)
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_RECORD__', createBootRecord(targetRecord, thumbnailDataUrl))
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_DATA_URL__', thumbnailDataUrl)

    const startupImageUrl = ''
    const startupPreviewUrl = targetImageUrl || targetPreviewUrl || thumbnailDataUrl
    const startupPreviewFallbackUrl = thumbnailDataUrl && thumbnailDataUrl !== startupPreviewUrl
      ? thumbnailDataUrl
      : ''
    preloadStartupImage(startupPreviewUrl)
    const placeholderColor = normalizeColor(targetRecord.placeholderColor)
    applyStartupBackground(
      startupImageUrl,
      startupPreviewUrl,
      startupPreviewFallbackUrl,
      placeholderColor,
      normalizeBackgroundSize(targetRecord.backgroundSize),
      typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition
        ? targetRecord.backgroundPosition
        : 'center',
      targetRecord.signature
    )
    revealWallpaper(Boolean(startupImageUrl || startupPreviewUrl))
  }
} catch {
  applyStartupBackground('', '', '', fallbackColor, 'cover', 'center')
  revealWallpaper(false)
}

function readRecord<TRecord>(key: string): TRecord | null {
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as TRecord
  } catch {
    return null
  }
}

function readDataUrl(key: string): string {
  const raw = window.localStorage.getItem(key)
  return typeof raw === 'string' && raw.startsWith('data:image/') ? raw : ''
}

function getStoredPreviewDataUrl(record: InstantWallpaperRecord | null, fallbackDataUrlRef: string): string {
  if (!record || record.ready === false) {
    return ''
  }
  const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl : ''
  if (dataUrl.startsWith('data:image/')) {
    return dataUrl
  }
  const dataUrlRef = typeof record.dataUrlRef === 'string' && record.dataUrlRef.trim()
    ? record.dataUrlRef.trim()
    : fallbackDataUrlRef
  return readDataUrl(dataUrlRef)
}

function cacheBootRecord(key: string, record: unknown): void {
  bootGlobal[key] = record
}

function cacheBootView(): void {
  if (bootGlobal.__CURATOR_INSTANT_WALLPAPER_BOOT_VIEW_CONSUMED__ === true) {
    return
  }
  bootGlobal.__CURATOR_INSTANT_WALLPAPER_BOOT_VIEW__ = { ...startupView }
}

function updateBootView(nextView: Partial<StartupWallpaperView>): void {
  Object.assign(startupView, nextView)
  cacheBootView()
}

function createStartupView(): StartupWallpaperView {
  return {
    backgroundColor: fallbackColor,
    booting: true,
    image: '',
    loaderVisible: false,
    loading: true,
    pending: false,
    placeholderColor: fallbackColor,
    position: 'center',
    previewImage: '',
    ready: false,
    remoteReady: false,
    signature: '',
    size: 'cover'
  }
}

function createBootRecord(
  targetRecord: InstantWallpaperTargetRecord,
  thumbnailDataUrl: string
): InstantWallpaperRecord & {
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  updatedAt: number
} {
  return {
    signature: targetRecord.signature,
    dataUrlRef: thumbnailDataUrl ? thumbnailDataUrlKey : '',
    backgroundSize: normalizeBackgroundSize(targetRecord.backgroundSize),
    backgroundPosition: typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition
      ? targetRecord.backgroundPosition
      : 'center',
    placeholderColor: normalizeColor(targetRecord.placeholderColor),
    updatedAt: Number(targetRecord.updatedAt) || 0,
    ready: Boolean(thumbnailDataUrl)
  }
}

function applyStartupBackground(
  imageUrl: string,
  previewUrl: string,
  previewFallbackUrl: string,
  placeholderColor: string,
  backgroundSize: string,
  backgroundPosition: string,
  signature = ''
): void {
  const root = document.documentElement
  root.style.setProperty('--bg', placeholderColor)
  root.style.setProperty('--wallpaper-placeholder-bg', placeholderColor)
  root.style.setProperty('--instant-wallpaper-size', backgroundSize)
  root.style.setProperty('--instant-wallpaper-position', backgroundPosition)
  root.style.setProperty('--instant-wallpaper-image', imageUrl ? `url("${escapeCssUrl(imageUrl)}")` : 'none')
  const previewImage = createPreviewImageValue(previewUrl, previewFallbackUrl)
  root.style.setProperty('--instant-wallpaper-preview-image', previewImage)
  if (signature) {
    root.dataset.instantWallpaperSignature = signature
  }
  root.classList.remove('instant-wallpaper-remote-ready')
  delete root.dataset.instantWallpaperRemoteReady
  if (imageUrl && previewUrl && imageUrl === previewUrl) {
    root.dataset.instantWallpaperPreviewOnly = 'true'
  } else {
    delete root.dataset.instantWallpaperPreviewOnly
  }
  updateBootView({
    backgroundColor: placeholderColor,
    image: imageUrl ? `url("${escapeCssUrl(imageUrl)}")` : '',
    placeholderColor,
    position: backgroundPosition,
    previewImage,
    ready: false,
    remoteReady: false,
    signature,
    size: backgroundSize
  })
}

function createPreviewImageValue(previewUrl: string, previewFallbackUrl: string): string {
  const urls = [previewUrl, previewFallbackUrl]
    .map((url) => String(url || '').trim())
    .filter(Boolean)
    .filter((url, index, source) => source.indexOf(url) === index)
  if (!urls.length) {
    return 'none'
  }
  return urls.map((url) => `url("${escapeCssUrl(url)}")`).join(', ')
}

function revealWallpaper(hasPreview: boolean): void {
  const root = document.documentElement
  root.classList.add('instant-wallpaper-ready')
  root.classList.toggle('instant-wallpaper-startup-preview', hasPreview)
  root.classList.remove('loading-wallpaper', 'newtab-booting')
  delete root.dataset.instantWallpaperPending
  updateBootView({
    booting: false,
    loaderVisible: false,
    loading: false,
    pending: false,
    ready: hasPreview,
    remoteReady: false
  })
}

function getTargetPreviewUrl(targetRecord: InstantWallpaperTargetRecord): string {
  return typeof targetRecord.previewUrl === 'string' ? targetRecord.previewUrl.trim() : ''
}

function getTargetImageUrl(targetRecord: InstantWallpaperTargetRecord): string {
  return typeof targetRecord.imageUrl === 'string' ? targetRecord.imageUrl.trim() : ''
}

function preloadStartupImage(imageUrl: string): void {
  if (!imageUrl || imageUrl.startsWith('data:image/')) {
    return
  }
  try {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = imageUrl
    link.setAttribute('fetchpriority', 'high')
    document.head.appendChild(link)
  } catch {
    // Preload only narrows the no-cache window; CSS still owns rendering.
  }
}

function getMatchingThumbnailDataUrl(
  thumbnailRecord: InstantWallpaperRecord | null,
  targetSignature: string
): string {
  if (thumbnailRecord?.signature !== targetSignature || thumbnailRecord.ready === false) {
    return ''
  }
  return getStoredPreviewDataUrl(thumbnailRecord, thumbnailDataUrlKey)
}

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

function normalizeBackgroundSize(value: unknown): string {
  const backgroundSize = typeof value === 'string' ? value.trim() : ''
  return /^\d+(?:\.\d+)?%\s+auto$/i.test(backgroundSize)
    ? 'cover'
    : backgroundSize || 'cover'
}

function normalizeColor(value: unknown): string {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return fallbackColor
}
