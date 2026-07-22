import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'

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

const hoverPreviewStore = createUiViewStoreSlice(
  'newtab',
  'featured-background-hover-preview',
  EMPTY_PREVIEW_VIEW
)

export function dispatchNewtabFeaturedBackgroundHoverPreviewView(
  view: NewtabFeaturedBackgroundHoverPreviewView
): void {
  hoverPreviewStore.setState(view)
}

export function dispatchNewtabFeaturedBackgroundHoverPreviewSrc(src: string): void {
  const hoverPreviewView = hoverPreviewStore.getState()
  if (hoverPreviewView.src === src) {
    return
  }

  hoverPreviewStore.setState({
    ...hoverPreviewView,
    src
  })
}

export function dispatchNewtabFeaturedBackgroundHoverPreviewHidden(): void {
  const hoverPreviewView = hoverPreviewStore.getState()
  if (!hoverPreviewView.visible && !hoverPreviewView.src && !hoverPreviewView.ariaLabel) {
    return
  }

  hoverPreviewStore.setState({
    ...hoverPreviewView,
    ariaLabel: '',
    src: '',
    visible: false
  })
}

export function useNewtabFeaturedBackgroundHoverPreviewView(): NewtabFeaturedBackgroundHoverPreviewView {
  return useUiViewStoreSlice(hoverPreviewStore)
}
