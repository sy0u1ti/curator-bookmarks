import { useSyncExternalStore } from 'react'

const DEFAULT_PLACEHOLDER_COLOR = '#101013'

export interface NewtabInstantWallpaperView {
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

declare global {
  // eslint-disable-next-line no-var
  var __CURATOR_INSTANT_WALLPAPER_BOOT_VIEW__: unknown
  // eslint-disable-next-line no-var
  var __CURATOR_INSTANT_WALLPAPER_BOOT_VIEW_CONSUMED__: unknown
}

const EMPTY_VIEW: NewtabInstantWallpaperView = {
  backgroundColor: DEFAULT_PLACEHOLDER_COLOR,
  booting: false,
  image: '',
  loaderVisible: false,
  loading: false,
  pending: false,
  placeholderColor: DEFAULT_PLACEHOLDER_COLOR,
  position: 'center',
  previewImage: '',
  ready: false,
  remoteReady: false,
  signature: '',
  size: 'cover'
}

let instantWallpaperView: NewtabInstantWallpaperView = getInitialInstantWallpaperView()
const listeners = new Set<() => void>()

function subscribeInstantWallpaper(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitInstantWallpaperChange(): void {
  listeners.forEach((listener) => listener())
}

function getInitialInstantWallpaperView(): NewtabInstantWallpaperView {
  const bootView = consumeInstantWallpaperBootView()
  if (bootView !== undefined) {
    return normalizeInstantWallpaperBootView(bootView)
  }

  return EMPTY_VIEW
}

function normalizeInstantWallpaperBootView(rawValue: unknown): NewtabInstantWallpaperView {
  if (!rawValue || typeof rawValue !== 'object') {
    return EMPTY_VIEW
  }

  const record = rawValue as Partial<Record<keyof NewtabInstantWallpaperView, unknown>>
  return {
    backgroundColor: normalizeViewString(record.backgroundColor, DEFAULT_PLACEHOLDER_COLOR),
    booting: record.booting === true,
    image: normalizeViewString(record.image, ''),
    loaderVisible: record.loaderVisible === true,
    loading: record.loading === true,
    pending: record.pending === true,
    placeholderColor: normalizeViewString(record.placeholderColor, DEFAULT_PLACEHOLDER_COLOR),
    position: normalizeViewString(record.position, 'center'),
    previewImage: normalizeViewString(record.previewImage, ''),
    ready: record.ready === true,
    remoteReady: record.remoteReady === true,
    signature: normalizeViewString(record.signature, ''),
    size: normalizeViewString(record.size, 'cover')
  }
}

function normalizeViewString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function consumeInstantWallpaperBootView(): unknown | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined
  }

  const globalState = globalThis as Record<string, unknown>
  const key = '__CURATOR_INSTANT_WALLPAPER_BOOT_VIEW__'
  if (!Object.prototype.hasOwnProperty.call(globalState, key)) {
    return undefined
  }

  const view = globalState[key]
  globalState.__CURATOR_INSTANT_WALLPAPER_BOOT_VIEW_CONSUMED__ = true
  try {
    delete globalState[key]
  } catch {
    globalState[key] = undefined
  }
  return view
}

export function dispatchNewtabInstantWallpaperView(
  nextView: Partial<NewtabInstantWallpaperView>
): void {
  const mergedView = {
    ...instantWallpaperView,
    ...nextView
  }

  if (
    mergedView.backgroundColor === instantWallpaperView.backgroundColor &&
    mergedView.booting === instantWallpaperView.booting &&
    mergedView.image === instantWallpaperView.image &&
    mergedView.loaderVisible === instantWallpaperView.loaderVisible &&
    mergedView.loading === instantWallpaperView.loading &&
    mergedView.pending === instantWallpaperView.pending &&
    mergedView.placeholderColor === instantWallpaperView.placeholderColor &&
    mergedView.position === instantWallpaperView.position &&
    mergedView.previewImage === instantWallpaperView.previewImage &&
    mergedView.ready === instantWallpaperView.ready &&
    mergedView.remoteReady === instantWallpaperView.remoteReady &&
    mergedView.signature === instantWallpaperView.signature &&
    mergedView.size === instantWallpaperView.size
  ) {
    return
  }

  instantWallpaperView = mergedView
  emitInstantWallpaperChange()
}

export function getNewtabInstantWallpaperView(): NewtabInstantWallpaperView {
  return instantWallpaperView
}

export function useNewtabInstantWallpaperView(): NewtabInstantWallpaperView {
  return useSyncExternalStore(
    subscribeInstantWallpaper,
    () => instantWallpaperView,
    () => EMPTY_VIEW
  )
}
