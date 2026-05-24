;(() => {
  const thumbnailKey = 'curatorNewTabInstantWallpaper'
  const thumbnailDataUrlKey = 'curatorNewTabInstantWallpaperDataUrl'
  const targetKey = 'curatorNewTabInstantWallpaperTarget'
  const fallbackColor = '#101013'
  const remoteRevealFallbackMs = 3200
  const loaderRevealDelayMs = 320
  let loaderRevealTimer = 0

  try {
    const targetRecord = readRecord(targetKey)
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_TARGET__', targetRecord)
    if (!targetRecord?.signature) {
      applyStartupBackground('', '', fallbackColor, 'cover', 'center')
      return
    }

    const targetImageUrl = getTargetImageUrl(targetRecord)
    const targetPreviewUrl = getTargetPreviewUrl(targetRecord)

    const thumbnailRecord = readRecord(thumbnailKey)
    const thumbnailDataUrl = getMatchingThumbnailDataUrl(thumbnailRecord, targetRecord.signature) || readDataUrl(thumbnailDataUrlKey)
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_RECORD__', createBootRecord(targetRecord, thumbnailDataUrl))
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_DATA_URL__', thumbnailDataUrl)
    const startupImageUrl = targetImageUrl || thumbnailDataUrl
    const startupPreviewUrl = thumbnailDataUrl || targetPreviewUrl || targetImageUrl

    const placeholderColor = normalizeColor(targetRecord.placeholderColor)
    applyStartupBackground(startupImageUrl, startupPreviewUrl, placeholderColor, normalizeBackgroundSize(targetRecord.backgroundSize), typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition ? targetRecord.backgroundPosition : 'center', targetRecord.signature)
    if (!startupImageUrl) {
      revealWallpaper()
      return
    }

    if (thumbnailDataUrl) {
      if (!targetImageUrl) {
        markWallpaperRemoteReady()
      } else {
        trackWallpaperRemoteReadyWhenImageReady(startupImageUrl)
      }
      revealWallpaper()
      return
    }

    showWallpaperLoaderWhenDelayed()
    revealWallpaperWhenImageReady(startupImageUrl)
  } catch {
    // Startup wallpaper is best-effort; the main app will apply the durable background.
    clearWallpaperLoaderDelay()
    applyStartupBackground('', '', fallbackColor, 'cover', 'center')
  }

  function readRecord(key) {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }

  function readDataUrl(key) {
    const raw = window.localStorage.getItem(key)
    return typeof raw === 'string' && raw.startsWith('data:image/') ? raw : ''
  }

  function cacheBootRecord(key, record) {
    globalThis[key] = record
  }

  function createBootRecord(targetRecord, thumbnailDataUrl) {
    return {
      signature: targetRecord.signature,
      dataUrlRef: thumbnailDataUrl ? thumbnailDataUrlKey : '',
      backgroundSize: normalizeBackgroundSize(targetRecord.backgroundSize),
      backgroundPosition: typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition ? targetRecord.backgroundPosition : 'center',
      placeholderColor: normalizeColor(targetRecord.placeholderColor),
      updatedAt: Number(targetRecord.updatedAt) || 0,
      ready: Boolean(thumbnailDataUrl)
    }
  }

  function applyStartupBackground(imageUrl, previewUrl, placeholderColor, backgroundSize, backgroundPosition, signature) {
    const root = document.documentElement
    root.style.setProperty('--bg', placeholderColor)
    root.style.setProperty('--wallpaper-placeholder-bg', placeholderColor)
    root.style.setProperty('--instant-wallpaper-size', backgroundSize)
    root.style.setProperty('--instant-wallpaper-position', backgroundPosition)
    root.style.setProperty('--instant-wallpaper-image', imageUrl ? `url("${escapeCssUrl(imageUrl)}")` : 'none')
    root.style.setProperty('--instant-wallpaper-preview-image', previewUrl ? `url("${escapeCssUrl(previewUrl)}")` : 'none')
    if (signature) {
      root.dataset.instantWallpaperSignature = signature
    }
    root.classList.remove('instant-wallpaper-remote-ready')
    delete root.dataset.instantWallpaperRemoteReady
  }

  function showWallpaperLoaderWhenDelayed() {
    const root = document.documentElement
    if (root.dataset.instantWallpaperLoaderVisible === 'true') {
      return
    }

    if (typeof window.setTimeout !== 'function') {
      root.dataset.instantWallpaperLoaderVisible = 'true'
      return
    }

    loaderRevealTimer = window.setTimeout(() => {
      loaderRevealTimer = 0
      root.dataset.instantWallpaperLoaderVisible = 'true'
    }, loaderRevealDelayMs)
  }

  function clearWallpaperLoaderDelay() {
    const root = document.documentElement
    if (loaderRevealTimer && typeof window.clearTimeout === 'function') {
      window.clearTimeout(loaderRevealTimer)
    }
    loaderRevealTimer = 0
    delete root.dataset.instantWallpaperLoaderVisible
  }

  function revealWallpaperWhenImageReady(imageUrl) {
    const root = document.documentElement
    root.dataset.instantWallpaperPending = 'true'

    try {
      const image = new Image()
      let settled = false
      let timeout = 0
      const settle = () => {
        if (settled) {
          return
        }
        settled = true
        if (timeout && typeof window.clearTimeout === 'function') {
          window.clearTimeout(timeout)
        }
        clearWallpaperLoaderDelay()
        image.onload = null
        image.onerror = null
        markWallpaperRemoteReady()
        revealWallpaper()
      }

      if (typeof window.setTimeout === 'function') {
        timeout = window.setTimeout(settle, remoteRevealFallbackMs)
      }
      image.onload = settle
      image.onerror = settle
      image.src = imageUrl
    } catch {
      revealWallpaper()
    }
  }

  function trackWallpaperRemoteReadyWhenImageReady(imageUrl) {
    try {
      const image = new Image()
      image.onload = () => {
        markWallpaperRemoteReady()
        image.onload = null
        image.onerror = null
      }
      image.onerror = () => {
        image.onload = null
        image.onerror = null
      }
      image.src = imageUrl
    } catch {
      // If the tracking probe fails, the startup image itself is still in place.
    }
  }

  function markWallpaperRemoteReady() {
    const root = document.documentElement
    root.classList.add('instant-wallpaper-remote-ready')
    root.dataset.instantWallpaperRemoteReady = 'true'
  }

  function revealWallpaper() {
    const root = document.documentElement
    clearWallpaperLoaderDelay()
    root.classList.add('instant-wallpaper-ready')
    root.classList.remove('loading-wallpaper', 'newtab-booting')
    delete root.dataset.instantWallpaperPending
  }

  function getTargetImageUrl(targetRecord) {
    const imageUrl = typeof targetRecord.imageUrl === 'string' ? targetRecord.imageUrl.trim() : ''
    return imageUrl
  }

  function getTargetPreviewUrl(targetRecord) {
    const previewUrl = typeof targetRecord.previewUrl === 'string' ? targetRecord.previewUrl.trim() : ''
    return previewUrl
  }

  function getMatchingThumbnailDataUrl(thumbnailRecord, targetSignature) {
    if (thumbnailRecord?.signature !== targetSignature || thumbnailRecord.ready === false) {
      return ''
    }
    const dataUrl = typeof thumbnailRecord.dataUrl === 'string' ? thumbnailRecord.dataUrl : ''
    return dataUrl.startsWith('data:image/') ? dataUrl : ''
  }

  function escapeCssUrl(value) {
    return value.replace(/["\\]/g, '\\$&')
  }

  function normalizeBackgroundSize(value) {
    const backgroundSize = typeof value === 'string' ? value.trim() : ''
    return /^\d+(?:\.\d+)?%\s+auto$/i.test(backgroundSize)
      ? 'cover'
      : backgroundSize || 'cover'
  }

  function normalizeColor(value) {
    const color = typeof value === 'string' ? value.trim() : ''
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      return color
    }
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    }
    return fallbackColor
  }
})()
