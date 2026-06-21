import { useSyncExternalStore } from 'react'

export type NewtabBackgroundMediaKind = 'image' | 'none' | 'video'

export interface NewtabBackgroundMediaView {
  backgroundPosition: string
  backgroundSize: string
  kind: NewtabBackgroundMediaKind
  src: string
}

const EMPTY_VIEW: NewtabBackgroundMediaView = {
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  kind: 'none',
  src: ''
}

let backgroundMediaView: NewtabBackgroundMediaView = EMPTY_VIEW
const listeners = new Set<() => void>()

function subscribeBackgroundMedia(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitBackgroundMediaChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabBackgroundMediaView(
  nextView: Partial<NewtabBackgroundMediaView>
): void {
  const mergedView = {
    ...backgroundMediaView,
    ...nextView
  }
  if (
    mergedView.backgroundPosition === backgroundMediaView.backgroundPosition &&
    mergedView.backgroundSize === backgroundMediaView.backgroundSize &&
    mergedView.kind === backgroundMediaView.kind &&
    mergedView.src === backgroundMediaView.src
  ) {
    return
  }

  backgroundMediaView = mergedView
  emitBackgroundMediaChange()
}

export function getNewtabBackgroundMediaView(): NewtabBackgroundMediaView {
  return backgroundMediaView
}

export function useNewtabBackgroundMediaView(): NewtabBackgroundMediaView {
  return useSyncExternalStore(
    subscribeBackgroundMedia,
    () => backgroundMediaView,
    () => EMPTY_VIEW
  )
}
