import { useSyncExternalStore } from 'react'

export interface NewtabDragUiView {
  bookmarkDragging: boolean
  folderOrderDragging: boolean
  previewInitializing: boolean
  speedDialDragging: boolean
}

const EMPTY_VIEW: NewtabDragUiView = {
  bookmarkDragging: false,
  folderOrderDragging: false,
  previewInitializing: false,
  speedDialDragging: false
}

let dragUiView: NewtabDragUiView = EMPTY_VIEW
const listeners = new Set<() => void>()

function subscribeDragUi(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitDragUiChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabDragUiView(nextView: Partial<NewtabDragUiView>): void {
  const mergedView = {
    ...dragUiView,
    ...nextView
  }
  if (
    mergedView.bookmarkDragging === dragUiView.bookmarkDragging &&
    mergedView.folderOrderDragging === dragUiView.folderOrderDragging &&
    mergedView.previewInitializing === dragUiView.previewInitializing &&
    mergedView.speedDialDragging === dragUiView.speedDialDragging
  ) {
    return
  }
  dragUiView = mergedView
  emitDragUiChange()
}

export function useNewtabDragUiView(): NewtabDragUiView {
  return useSyncExternalStore(
    subscribeDragUi,
    () => dragUiView,
    () => EMPTY_VIEW
  )
}
