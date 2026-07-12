import { useSyncExternalStore } from 'react'

export const SETTINGS_DRAWER_MODAL_MEDIA_QUERY = '(max-width: 600px)'

function getSettingsDrawerMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }
  return window.matchMedia(SETTINGS_DRAWER_MODAL_MEDIA_QUERY)
}

export function isSettingsDrawerModalViewport(): boolean {
  return getSettingsDrawerMediaQuery()?.matches ?? false
}

function subscribeSettingsDrawerMode(listener: () => void): () => void {
  const query = getSettingsDrawerMediaQuery()
  if (!query) {
    return () => {}
  }
  query.addEventListener('change', listener)
  return () => {
    query.removeEventListener('change', listener)
  }
}

export function useSettingsDrawerModalMode(): boolean {
  return useSyncExternalStore(
    subscribeSettingsDrawerMode,
    isSettingsDrawerModalViewport,
    () => false
  )
}
