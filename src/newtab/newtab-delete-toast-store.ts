import { useSyncExternalStore } from 'react'

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

let deleteToastView: NewtabDeleteToastView | null = null
let deleteToastActions: NewtabDeleteToastActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeDeleteToast(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitDeleteToastChange(): void {
  listeners.forEach((listener) => listener())
}

export function registerNewtabDeleteToastActions(actions: NewtabDeleteToastActions): () => void {
  deleteToastActions = actions
  return () => {
    if (deleteToastActions === actions) {
      deleteToastActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabDeleteToastView(view: NewtabDeleteToastView | null): void {
  deleteToastView = view
  emitDeleteToastChange()
}

export function useNewtabDeleteToastView(): NewtabDeleteToastView | null {
  return useSyncExternalStore(
    subscribeDeleteToast,
    () => deleteToastView,
    () => null
  )
}

export function dispatchNewtabDeleteToastUndo(): void {
  deleteToastActions.onUndo()
}

export function dispatchNewtabDeleteToastOpenRecycle(): void {
  deleteToastActions.onOpenRecycle()
}
