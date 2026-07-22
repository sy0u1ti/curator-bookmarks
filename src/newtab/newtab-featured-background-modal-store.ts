import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'

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

const EMPTY_VIEW: NewtabFeaturedBackgroundModalView = {
  open: false,
  refreshing: false,
  status: '',
  statusTone: 'info'
}
const featuredBackgroundModalStore = createUiViewStoreSlice(
  'newtab',
  'featured-background-modal',
  EMPTY_VIEW
)
let featuredBackgroundModalActions: NewtabFeaturedBackgroundModalActions = EMPTY_ACTIONS
let featuredBackgroundModalNodes: NewtabFeaturedBackgroundModalNodes = {
  grid: null,
  modal: null
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
  return useUiViewStoreSlice(featuredBackgroundModalStore)
}

export function dispatchNewtabFeaturedBackgroundModalOpen(open: boolean): void {
  const featuredBackgroundModalView = featuredBackgroundModalStore.getState()
  if (featuredBackgroundModalView.open === open) {
    return
  }
  featuredBackgroundModalStore.setState({
    ...featuredBackgroundModalView,
    open
  })
}

export function getNewtabFeaturedBackgroundModalOpen(): boolean {
  return featuredBackgroundModalStore.getState().open
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
  const featuredBackgroundModalView = featuredBackgroundModalStore.getState()
  if (
    featuredBackgroundModalView.refreshing === refreshing &&
    featuredBackgroundModalView.status === status &&
    featuredBackgroundModalView.statusTone === statusTone
  ) {
    return
  }

  featuredBackgroundModalStore.setState({
    ...featuredBackgroundModalView,
    refreshing,
    status,
    statusTone
  })
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
