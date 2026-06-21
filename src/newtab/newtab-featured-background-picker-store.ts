import { useSyncExternalStore } from 'react'
import type { FeaturedBackgroundPickerState } from './components/FeaturedBackgroundPicker'

export type FeaturedBackgroundPickerView = FeaturedBackgroundPickerState
export interface FeaturedBackgroundPickerFocusRequest {
  requestId: number
}

export interface NewtabFeaturedBackgroundPickerNodes {
  trigger: HTMLElement | null
}

let featuredBackgroundPickerView: FeaturedBackgroundPickerView | null = null
let featuredBackgroundPickerFocusRequest: FeaturedBackgroundPickerFocusRequest = { requestId: 0 }
let featuredBackgroundPickerNodes: NewtabFeaturedBackgroundPickerNodes = {
  trigger: null
}
const listeners = new Set<() => void>()
const focusListeners = new Set<() => void>()

function subscribeFeaturedBackgroundPicker(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitFeaturedBackgroundPickerChange(): void {
  listeners.forEach((listener) => listener())
}

function subscribeFeaturedBackgroundPickerFocusRequest(listener: () => void): () => void {
  focusListeners.add(listener)
  return () => {
    focusListeners.delete(listener)
  }
}

function emitFeaturedBackgroundPickerFocusRequestChange(): void {
  focusListeners.forEach((listener) => listener())
}

export function dispatchNewtabFeaturedBackgroundPickerView(
  view: FeaturedBackgroundPickerView | null
): void {
  featuredBackgroundPickerView = view
  emitFeaturedBackgroundPickerChange()
}

export function dispatchNewtabFeaturedBackgroundPickerInitialFocusRequest(): void {
  featuredBackgroundPickerFocusRequest = {
    requestId: featuredBackgroundPickerFocusRequest.requestId + 1
  }
  emitFeaturedBackgroundPickerFocusRequestChange()
}

export function getNewtabFeaturedBackgroundPickerView(): FeaturedBackgroundPickerView | null {
  return featuredBackgroundPickerView
}

export function setNewtabFeaturedBackgroundPickerNodes(nodes: NewtabFeaturedBackgroundPickerNodes): void {
  featuredBackgroundPickerNodes = { ...nodes }
}

export function getNewtabFeaturedBackgroundPickerNodes(): NewtabFeaturedBackgroundPickerNodes {
  return featuredBackgroundPickerNodes
}

export function useNewtabFeaturedBackgroundPickerView(): FeaturedBackgroundPickerView | null {
  return useSyncExternalStore(
    subscribeFeaturedBackgroundPicker,
    () => featuredBackgroundPickerView,
    () => null
  )
}

export function useNewtabFeaturedBackgroundPickerFocusRequest(): FeaturedBackgroundPickerFocusRequest {
  return useSyncExternalStore(
    subscribeFeaturedBackgroundPickerFocusRequest,
    () => featuredBackgroundPickerFocusRequest,
    () => ({ requestId: 0 })
  )
}
