import { useSyncExternalStore } from 'react'

export interface NewtabDashboardOverlayView {
  errorMessage: string
  frameSrc: string
  open: boolean
  ready: boolean
}

export interface NewtabDashboardOverlayActions {
  onCloseRequest: (event: Event) => void
  onFallbackRetry: () => void
  onFallbackReturn: () => void
  onFrameError: () => void
  onOpenRequest: (returnFocusElement?: HTMLElement | null) => void
  onReady: () => void
}

export interface NewtabDashboardOverlayNodes {
  frame: HTMLIFrameElement | null
  overlay: HTMLElement | null
  trigger: HTMLElement | null
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
  frameSrc: '',
  open: false,
  ready: false
}
let dashboardOverlayActions: NewtabDashboardOverlayActions = EMPTY_ACTIONS
let dashboardOverlayNodes: NewtabDashboardOverlayNodes = {
  frame: null,
  overlay: null,
  trigger: null
}

const listeners = new Set<() => void>()
const nodesListeners = new Set<() => void>()

function subscribeDashboardOverlay(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitDashboardOverlayChange(): void {
  listeners.forEach((listener) => listener())
}

function emitDashboardOverlayNodesChange(): void {
  nodesListeners.forEach((listener) => listener())
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
    () => ({ errorMessage: '', frameSrc: '', open: false, ready: false })
  )
}

export function dispatchNewtabDashboardOverlayControls(view: NewtabDashboardOverlayView): void {
  if (
    dashboardOverlayView.errorMessage === view.errorMessage &&
    dashboardOverlayView.frameSrc === view.frameSrc &&
    dashboardOverlayView.open === view.open &&
    dashboardOverlayView.ready === view.ready
  ) {
    return
  }

  dashboardOverlayView = view
  emitDashboardOverlayChange()
}

export function setNewtabDashboardOverlayNodes(nodes: Partial<NewtabDashboardOverlayNodes>): void {
  const nextNodes = {
    ...dashboardOverlayNodes,
    ...nodes
  }
  const changed =
    nextNodes.frame !== dashboardOverlayNodes.frame ||
    nextNodes.overlay !== dashboardOverlayNodes.overlay ||
    nextNodes.trigger !== dashboardOverlayNodes.trigger

  dashboardOverlayNodes = {
    ...nextNodes
  }

  if (changed) {
    queueMicrotask(emitDashboardOverlayNodesChange)
  }
}

export function getNewtabDashboardOverlayNodes(): NewtabDashboardOverlayNodes {
  return dashboardOverlayNodes
}

export function subscribeNewtabDashboardOverlayNodes(listener: () => void): () => void {
  nodesListeners.add(listener)
  return () => {
    nodesListeners.delete(listener)
  }
}

export function dispatchNewtabDashboardOverlayReady(): void {
  dashboardOverlayActions.onReady()
}

export function dispatchNewtabDashboardOverlayOpenRequest(returnFocusElement?: HTMLElement | null): void {
  dashboardOverlayActions.onOpenRequest(returnFocusElement)
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
