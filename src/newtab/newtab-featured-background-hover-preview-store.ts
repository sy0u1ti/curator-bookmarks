import { useSyncExternalStore } from 'react'

export interface NewtabFeaturedBackgroundHoverPreviewView {
  ariaLabel: string
  backgroundImage: string
  height: number
  left: number
  top: number
  visible: boolean
  width: number
}

const EMPTY_PREVIEW_VIEW: NewtabFeaturedBackgroundHoverPreviewView = {
  ariaLabel: '',
  backgroundImage: '',
  height: 0,
  left: 0,
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

export function dispatchNewtabFeaturedBackgroundHoverPreviewBackgroundImage(backgroundImage: string): void {
  if (hoverPreviewView.backgroundImage === backgroundImage) {
    return
  }

  hoverPreviewView = {
    ...hoverPreviewView,
    backgroundImage
  }
  emitHoverPreviewChange()
}

export function dispatchNewtabFeaturedBackgroundHoverPreviewHidden(): void {
  if (!hoverPreviewView.visible && !hoverPreviewView.backgroundImage && !hoverPreviewView.ariaLabel) {
    return
  }

  hoverPreviewView = {
    ...hoverPreviewView,
    ariaLabel: '',
    backgroundImage: '',
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
