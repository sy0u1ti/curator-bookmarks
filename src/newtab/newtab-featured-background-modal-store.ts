import { useSyncExternalStore } from 'react'
import { getModalCloseDurationMs } from '../shared/motion'

export type FeaturedBackgroundStatusTone = 'info' | 'success' | 'warning' | 'error'

export interface NewtabFeaturedBackgroundModalView {
  closing: boolean
  open: boolean
  refreshing: boolean
  status: string
  statusTone: FeaturedBackgroundStatusTone
}

export interface NewtabFeaturedBackgroundModalActions {
  onCloseRequest: (event: Event) => void
  onGridScroll: () => void
  onModalPointerDownCapture: (event: PointerEvent) => void
  onReady: () => void
  onRefreshClick: () => void
}

const EMPTY_ACTIONS: NewtabFeaturedBackgroundModalActions = {
  onCloseRequest: () => {},
  onGridScroll: () => {},
  onModalPointerDownCapture: () => {},
  onReady: () => {},
  onRefreshClick: () => {}
}

let featuredBackgroundModalView: NewtabFeaturedBackgroundModalView = {
  closing: false,
  open: false,
  refreshing: false,
  status: '',
  statusTone: 'info'
}
let featuredBackgroundModalActions: NewtabFeaturedBackgroundModalActions = EMPTY_ACTIONS
let closeTimer = 0

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
      closing: false,
      open: false,
      refreshing: false,
      status: '',
      statusTone: 'info'
    })
  )
}

export function dispatchNewtabFeaturedBackgroundModalOpen(open: boolean): void {
  window.clearTimeout(closeTimer)

  if (open) {
    if (featuredBackgroundModalView.open && !featuredBackgroundModalView.closing) {
      return
    }
    featuredBackgroundModalView = {
      ...featuredBackgroundModalView,
      closing: false,
      open: true
    }
    emitFeaturedBackgroundModalChange()
    return
  }

  if (!featuredBackgroundModalView.open || featuredBackgroundModalView.closing) {
    return
  }

  featuredBackgroundModalView = {
    ...featuredBackgroundModalView,
    closing: true
  }
  emitFeaturedBackgroundModalChange()

  closeTimer = window.setTimeout(() => {
    featuredBackgroundModalView = {
      ...featuredBackgroundModalView,
      closing: false,
      open: false
    }
    emitFeaturedBackgroundModalChange()
  }, getModalCloseDurationMs())
}

export function getNewtabFeaturedBackgroundModalOpen(): boolean {
  return featuredBackgroundModalView.open && !featuredBackgroundModalView.closing
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

export function dispatchNewtabFeaturedBackgroundModalPointerDownCapture(event: PointerEvent): void {
  featuredBackgroundModalActions.onModalPointerDownCapture(event)
}
