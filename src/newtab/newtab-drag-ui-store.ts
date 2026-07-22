import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'

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

const dragUiStore = createUiViewStoreSlice('newtab', 'drag-ui', EMPTY_VIEW)

export function dispatchNewtabDragUiView(nextView: Partial<NewtabDragUiView>): void {
  const dragUiView = dragUiStore.getState()
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
  dragUiStore.setState(mergedView)
}

export function useNewtabDragUiView(): NewtabDragUiView {
  return useUiViewStoreSlice(dragUiStore)
}
