import { useLayoutEffect } from 'react'
import { useNewtabInstantWallpaperView } from '../newtab-instant-wallpaper-store'

const STARTUP_STYLE_ID = 'instant-wallpaper-startup-style'
const STARTUP_PREVIEW_CLASS = 'instant-wallpaper-startup-preview'
const STARTUP_PREVIEW_SETTLE_MS = 980
const STARTUP_HTML_CLASSES = [
  'loading-wallpaper',
  'newtab-booting',
  'instant-wallpaper-ready',
  'instant-wallpaper-remote-ready',
  STARTUP_PREVIEW_CLASS
]
const STARTUP_HTML_DATASET_KEYS = [
  'instantWallpaperLoaderVisible',
  'instantWallpaperPending',
  'instantWallpaperRemoteReady',
  'instantWallpaperSignature'
]
const STARTUP_HTML_PROPERTIES = [
  '--bg',
  '--wallpaper-placeholder-bg',
  '--instant-wallpaper-image',
  '--instant-wallpaper-preview-image',
  '--instant-wallpaper-size',
  '--instant-wallpaper-position'
]

export function NewtabInstantWallpaperHost() {
  const view = useNewtabInstantWallpaperView()

  useLayoutEffect(() => {
    const startupStyle = document.getElementById(STARTUP_STYLE_ID)
    const root = document.documentElement
    if (view.booting) {
      return
    }

    if (startupStyle) {
      syncStartupHtmlState(root, view)
    }

    const hasStartupPreview = Boolean(startupStyle && hasUsableStartupPreview(view.previewImage))
    root.classList.toggle(STARTUP_PREVIEW_CLASS, hasStartupPreview)
    if (hasStartupPreview && !view.remoteReady) {
      return
    }

    const cleanupDelay = hasStartupPreview && view.remoteReady ? STARTUP_PREVIEW_SETTLE_MS : 0
    const cleanupStartupWallpaper = () => {
      STARTUP_HTML_CLASSES.forEach((className) => root.classList.remove(className))
      STARTUP_HTML_DATASET_KEYS.forEach((key) => {
        delete root.dataset[key]
      })
      STARTUP_HTML_PROPERTIES.forEach((property) => {
        root.style.removeProperty(property)
      })
      startupStyle?.remove()
    }

    if (cleanupDelay <= 0) {
      cleanupStartupWallpaper()
      return
    }

    const cleanupTimer = window.setTimeout(cleanupStartupWallpaper, cleanupDelay)
    return () => {
      window.clearTimeout(cleanupTimer)
    }
  }, [view])

  return null
}

function hasUsableStartupPreview(previewImage: string): boolean {
  const normalizedPreviewImage = String(previewImage || '').trim()
  return Boolean(normalizedPreviewImage && normalizedPreviewImage !== 'none')
}

function syncStartupHtmlState(
  root: HTMLElement,
  view: ReturnType<typeof useNewtabInstantWallpaperView>
): void {
  root.classList.toggle('loading-wallpaper', view.loading)
  root.classList.toggle('newtab-booting', view.booting)
  root.classList.toggle('instant-wallpaper-ready', view.ready)
  root.classList.toggle('instant-wallpaper-remote-ready', view.remoteReady)
  root.dataset.instantWallpaperPending = view.pending ? 'true' : ''
  if (!view.pending) {
    delete root.dataset.instantWallpaperPending
  }
  root.dataset.instantWallpaperRemoteReady = view.remoteReady ? 'true' : ''
  if (!view.remoteReady) {
    delete root.dataset.instantWallpaperRemoteReady
  }
  if (view.signature) {
    root.dataset.instantWallpaperSignature = view.signature
  } else {
    delete root.dataset.instantWallpaperSignature
  }
}
