import { useLayoutEffect } from 'react'
import { useNewtabInstantWallpaperView } from '../newtab-instant-wallpaper-store'

const STARTUP_STYLE_ID = 'instant-wallpaper-startup-style'
const STARTUP_HTML_CLASSES = [
  'loading-wallpaper',
  'newtab-booting',
  'instant-wallpaper-ready',
  'instant-wallpaper-remote-ready'
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
    if (view.booting) {
      return
    }
    const root = document.documentElement

    STARTUP_HTML_CLASSES.forEach((className) => root.classList.remove(className))
    STARTUP_HTML_DATASET_KEYS.forEach((key) => {
      delete root.dataset[key]
    })
    STARTUP_HTML_PROPERTIES.forEach((property) => {
      root.style.removeProperty(property)
    })
    document.getElementById(STARTUP_STYLE_ID)?.remove()
  }, [view.booting])

  return null
}
