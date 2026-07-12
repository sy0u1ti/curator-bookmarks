import { useSyncExternalStore } from 'react'

export type FeaturedBackgroundStatusTone = 'info' | 'success' | 'warning' | 'error'

export interface NewtabFeaturedBackgroundModalView {
  open: boolean
  refreshing: boolean
  status: string
  statusTone: FeaturedBackgroundStatusTone
}

export interface NewtabFeaturedBackgroundModalActions {
  onCloseRequest: (event: Event) => void
  onGridScroll: () => void
  onReady: () => void
  onRefreshClick: () => void
}

export interface NewtabFeaturedBackgroundModalNodes {
  grid: HTMLElement | null
  modal: HTMLElement | null
}

const EMPTY_ACTIONS: NewtabFeaturedBackgroundModalActions = {
  onCloseRequest: () => {},
  onGridScroll: () => {},
  onReady: () => {},
  onRefreshClick: () => {}
}

let featuredBackgroundModalView: NewtabFeaturedBackgroundModalView = {
  open: false,
  refreshing: false,
  status: '',
  statusTone: 'info'
}
let featuredBackgroundModalActions: NewtabFeaturedBackgroundModalActions = EMPTY_ACTIONS
let featuredBackgroundModalNodes: NewtabFeaturedBackgroundModalNodes = {
  grid: null,
  modal: null
}
const listeners = new Set<() => void>()

function subscribeFeaturedBackgroundModal(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitFeaturedBackgroundModalChange(): void {
  listeners.forEach((listener) => listener())
}

export function registerNewtabFeaturedBackgroundModalActions(
  actions: NewtabFeaturedBackgroundModalActions
): () => void {
  featuredBackgroundModalActions = actions
  return () => {
    if (featuredBackgroundModalActions === actions) {
      featuredBackgroundModalActions = EMPTY_ACTIONS
    }
  }
}

export function useNewtabFeaturedBackgroundModalView(): NewtabFeaturedBackgroundModalView {
  return useSyncExternalStore(
    subscribeFeaturedBackgroundModal,
    () => featuredBackgroundModalView,
    () => ({
      open: false,
      refreshing: false,
      status: '',
      statusTone: 'info'
    })
  )
}

export function dispatchNewtabFeaturedBackgroundModalOpen(open: boolean): void {
  if (featuredBackgroundModalView.open === open) {
    return
  }
  featuredBackgroundModalView = {
    ...featuredBackgroundModalView,
    open
  }
  emitFeaturedBackgroundModalChange()
}

export function getNewtabFeaturedBackgroundModalOpen(): boolean {
  return featuredBackgroundModalView.open
}

export function setNewtabFeaturedBackgroundModalNodes(nodes: NewtabFeaturedBackgroundModalNodes): void {
  featuredBackgroundModalNodes = { ...nodes }
}

export function getNewtabFeaturedBackgroundModalNodes(): NewtabFeaturedBackgroundModalNodes {
  return featuredBackgroundModalNodes
}

export function dispatchNewtabFeaturedBackgroundModalControls({
  refreshing,
  status,
  statusTone
}: {
  refreshing: boolean
  status: string
  statusTone: FeaturedBackgroundStatusTone
}): void {
  if (
    featuredBackgroundModalView.refreshing === refreshing &&
    featuredBackgroundModalView.status === status &&
    featuredBackgroundModalView.statusTone === statusTone
  ) {
    return
  }

  featuredBackgroundModalView = {
    ...featuredBackgroundModalView,
    refreshing,
    status,
    statusTone
  }
  emitFeaturedBackgroundModalChange()
}

export function dispatchNewtabFeaturedBackgroundModalReady(): void {
  featuredBackgroundModalActions.onReady()
}

export function dispatchNewtabFeaturedBackgroundModalRefreshClick(): void {
  featuredBackgroundModalActions.onRefreshClick()
}

export function dispatchNewtabFeaturedBackgroundModalOpenChange(open: boolean, event?: Event): void {
  if (!open) {
    featuredBackgroundModalActions.onCloseRequest(event ?? new Event('dialog-close'))
    return
  }
  dispatchNewtabFeaturedBackgroundModalOpen(true)
}

export function dispatchNewtabFeaturedBackgroundModalGridScroll(): void {
  featuredBackgroundModalActions.onGridScroll()
}
