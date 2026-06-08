import { useSyncExternalStore } from 'react'

export interface NewtabDashboardOverlayView {
  errorMessage: string
  open: boolean
  ready: boolean
}

export interface NewtabDashboardOverlayActions {
  onCloseRequest: (event: Event) => void
  onFallbackRetry: () => void
  onFallbackReturn: () => void
  onFrameError: () => void
  onOpenRequest: () => void
  onReady: () => void
}

const EMPTY_ACTIONS: NewtabDashboardOverlayActions = {
  onCloseRequest: () => {},
  onFallbackRetry: () => {},
  onFallbackReturn: () => {},
  onFrameError: () => {},
  onOpenRequest: () => {},
  onReady: () => {}
}

let dashboardOverlayView: NewtabDashboardOverlayView = {
  errorMessage: '',
  open: false,
  ready: false
}
let dashboardOverlayActions: NewtabDashboardOverlayActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeDashboardOverlay(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitDashboardOverlayChange(): void {
  listeners.forEach((listener) => listener())
}

export function registerNewtabDashboardOverlayActions(
  actions: NewtabDashboardOverlayActions
): () => void {
  dashboardOverlayActions = actions
  return () => {
    if (dashboardOverlayActions === actions) {
      dashboardOverlayActions = EMPTY_ACTIONS
    }
  }
}

export function useNewtabDashboardOverlayView(): NewtabDashboardOverlayView {
  return useSyncExternalStore(
    subscribeDashboardOverlay,
    () => dashboardOverlayView,
    () => ({ errorMessage: '', open: false, ready: false })
  )
}

export function dispatchNewtabDashboardOverlayControls(view: NewtabDashboardOverlayView): void {
  if (
    dashboardOverlayView.errorMessage === view.errorMessage &&
    dashboardOverlayView.open === view.open &&
    dashboardOverlayView.ready === view.ready
  ) {
    return
  }

  dashboardOverlayView = view
  emitDashboardOverlayChange()
}

export function dispatchNewtabDashboardOverlayReady(): void {
  dashboardOverlayActions.onReady()
}

export function dispatchNewtabDashboardOverlayOpenRequest(): void {
  dashboardOverlayActions.onOpenRequest()
}

export function dispatchNewtabDashboardOverlayOpenChange(open: boolean, event?: Event): void {
  if (!open && dashboardOverlayView.open) {
    dashboardOverlayActions.onCloseRequest(event ?? new Event('dialog-close'))
    return
  }

  dispatchNewtabDashboardOverlayControls({
    ...dashboardOverlayView,
    open
  })
}

export function dispatchNewtabDashboardOverlayFrameError(): void {
  dashboardOverlayActions.onFrameError()
}

export function dispatchNewtabDashboardOverlayFallbackReturn(): void {
  dashboardOverlayActions.onFallbackReturn()
}

export function dispatchNewtabDashboardOverlayFallbackRetry(): void {
  dashboardOverlayActions.onFallbackRetry()
}
