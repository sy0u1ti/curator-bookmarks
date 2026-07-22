import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'

export interface NewtabDeleteToastView {
  bookmarkLabel: string
  busy: boolean
  detail: string
}

export interface NewtabDeleteToastActions {
  onOpenRecycle: () => void
  onUndo: () => void
}

const EMPTY_ACTIONS: NewtabDeleteToastActions = {
  onOpenRecycle: () => {},
  onUndo: () => {}
}

let deleteToastActions: NewtabDeleteToastActions = EMPTY_ACTIONS
const deleteToastStore = createUiViewStoreSlice<NewtabDeleteToastView | null>(
  'newtab',
  'delete-toast',
  null
)

export function registerNewtabDeleteToastActions(actions: NewtabDeleteToastActions): () => void {
  deleteToastActions = actions
  return () => {
    if (deleteToastActions === actions) {
      deleteToastActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabDeleteToastView(view: NewtabDeleteToastView | null): void {
  deleteToastStore.setState(view)
}

export function useNewtabDeleteToastView(): NewtabDeleteToastView | null {
  return useUiViewStoreSlice(deleteToastStore)
}

export function dispatchNewtabDeleteToastUndo(): void {
  deleteToastActions.onUndo()
}

export function dispatchNewtabDeleteToastOpenRecycle(): void {
  deleteToastActions.onOpenRecycle()
}
