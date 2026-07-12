import { useSyncExternalStore } from 'react'

export interface NewtabDragUiView {
  bookmarkPendingId: string
  bookmarkDragging: boolean
  folderPendingId: string
  folderOrderDragging: boolean
  previewInitializing: boolean
  speedDialPendingId: string
  speedDialDragging: boolean
}

const EMPTY_VIEW: NewtabDragUiView = {
  bookmarkPendingId: '',
  bookmarkDragging: false,
  folderPendingId: '',
  folderOrderDragging: false,
  previewInitializing: false,
  speedDialPendingId: '',
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
    mergedView.bookmarkPendingId === dragUiView.bookmarkPendingId &&
    mergedView.bookmarkDragging === dragUiView.bookmarkDragging &&
    mergedView.folderPendingId === dragUiView.folderPendingId &&
    mergedView.folderOrderDragging === dragUiView.folderOrderDragging &&
    mergedView.previewInitializing === dragUiView.previewInitializing &&
    mergedView.speedDialPendingId === dragUiView.speedDialPendingId &&
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
