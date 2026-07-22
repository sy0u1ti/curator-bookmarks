import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import type { FeaturedBackgroundPickerState } from './components/FeaturedBackgroundPicker'

export type FeaturedBackgroundPickerView = FeaturedBackgroundPickerState
export interface FeaturedBackgroundPickerFocusRequest {
  requestId: number
}

export interface NewtabFeaturedBackgroundPickerNodes {
  trigger: HTMLElement | null
}

let featuredBackgroundPickerNodes: NewtabFeaturedBackgroundPickerNodes = {
  trigger: null
}
const featuredBackgroundPickerStore = createUiViewStoreSlice<FeaturedBackgroundPickerView | null>(
  'newtab',
  'featured-background-picker',
  null
)
const featuredBackgroundPickerFocusStore = createUiViewStoreSlice<FeaturedBackgroundPickerFocusRequest>(
  'newtab',
  'featured-background-picker-focus',
  { requestId: 0 }
)

export function dispatchNewtabFeaturedBackgroundPickerView(
  view: FeaturedBackgroundPickerView | null
): void {
  featuredBackgroundPickerStore.setState(view)
}

export function dispatchNewtabFeaturedBackgroundPickerInitialFocusRequest(): void {
  featuredBackgroundPickerFocusStore.setState((request) => ({
    requestId: request.requestId + 1
  }))
}

export function getNewtabFeaturedBackgroundPickerView(): FeaturedBackgroundPickerView | null {
  return featuredBackgroundPickerStore.getState()
}

export function setNewtabFeaturedBackgroundPickerNodes(nodes: NewtabFeaturedBackgroundPickerNodes): void {
  featuredBackgroundPickerNodes = { ...nodes }
}

export function getNewtabFeaturedBackgroundPickerNodes(): NewtabFeaturedBackgroundPickerNodes {
  return featuredBackgroundPickerNodes
}

export function useNewtabFeaturedBackgroundPickerView(): FeaturedBackgroundPickerView | null {
  return useUiViewStoreSlice(featuredBackgroundPickerStore)
}

export function useNewtabFeaturedBackgroundPickerFocusRequest(): FeaturedBackgroundPickerFocusRequest {
  return useUiViewStoreSlice(featuredBackgroundPickerFocusStore)
}
