import { useSyncExternalStore } from 'react'

export interface NewtabFeaturedBackgroundHoverPreviewView {
  ariaLabel: string
  height: number
  left: number
  src: string
  top: number
  visible: boolean
  width: number
}

const EMPTY_PREVIEW_VIEW: NewtabFeaturedBackgroundHoverPreviewView = {
  ariaLabel: '',
  height: 0,
  left: 0,
  src: '',
  top: 0,
  visible: false,
  width: 0
}

let hoverPreviewView: NewtabFeaturedBackgroundHoverPreviewView = EMPTY_PREVIEW_VIEW

const listeners = new Set<() => void>()

function subscribeHoverPreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitHoverPreviewChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabFeaturedBackgroundHoverPreviewView(
  view: NewtabFeaturedBackgroundHoverPreviewView
): void {
  hoverPreviewView = view
  emitHoverPreviewChange()
}

export function dispatchNewtabFeaturedBackgroundHoverPreviewSrc(src: string): void {
  if (hoverPreviewView.src === src) {
    return
  }

  hoverPreviewView = {
    ...hoverPreviewView,
    src
  }
  emitHoverPreviewChange()
}

export function dispatchNewtabFeaturedBackgroundHoverPreviewHidden(): void {
  if (!hoverPreviewView.visible && !hoverPreviewView.src && !hoverPreviewView.ariaLabel) {
    return
  }

  hoverPreviewView = {
    ...hoverPreviewView,
    ariaLabel: '',
    src: '',
    visible: false
  }
  emitHoverPreviewChange()
}

export function useNewtabFeaturedBackgroundHoverPreviewView(): NewtabFeaturedBackgroundHoverPreviewView {
  return useSyncExternalStore(
    subscribeHoverPreview,
    () => hoverPreviewView,
    () => EMPTY_PREVIEW_VIEW
  )
}
