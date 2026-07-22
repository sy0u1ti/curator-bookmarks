import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'

export type NewtabBackgroundMediaKind = 'image' | 'none' | 'video'

export interface NewtabBackgroundMediaView {
  backgroundPosition: string
  backgroundSize: string
  kind: NewtabBackgroundMediaKind
  poster: string
  src: string
}

const EMPTY_VIEW: NewtabBackgroundMediaView = {
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  kind: 'none',
  poster: '',
  src: ''
}

const backgroundMediaStore = createUiViewStoreSlice(
  'newtab',
  'background-media',
  EMPTY_VIEW
)

export function dispatchNewtabBackgroundMediaView(
  nextView: Partial<NewtabBackgroundMediaView>
): void {
  const backgroundMediaView = backgroundMediaStore.getState()
  const mergedView = {
    ...backgroundMediaView,
    ...nextView
  }
  if (
    mergedView.backgroundPosition === backgroundMediaView.backgroundPosition &&
    mergedView.backgroundSize === backgroundMediaView.backgroundSize &&
    mergedView.kind === backgroundMediaView.kind &&
    mergedView.poster === backgroundMediaView.poster &&
    mergedView.src === backgroundMediaView.src
  ) {
    return
  }

  backgroundMediaStore.setState(mergedView)
}

export function getNewtabBackgroundMediaView(): NewtabBackgroundMediaView {
  return backgroundMediaStore.getState()
}

export function useNewtabBackgroundMediaView(): NewtabBackgroundMediaView {
  return useUiViewStoreSlice(backgroundMediaStore)
}
