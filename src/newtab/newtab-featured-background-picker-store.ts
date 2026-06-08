import { useSyncExternalStore } from 'react'
import type { FeaturedBackgroundPickerState } from './components/RuntimeIslands'

export type FeaturedBackgroundPickerView = FeaturedBackgroundPickerState

let featuredBackgroundPickerView: FeaturedBackgroundPickerView | null = null
const listeners = new Set<() => void>()

function subscribeFeaturedBackgroundPicker(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitFeaturedBackgroundPickerChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabFeaturedBackgroundPickerView(
  view: FeaturedBackgroundPickerView | null
): void {
  featuredBackgroundPickerView = view
  emitFeaturedBackgroundPickerChange()
}

export function useNewtabFeaturedBackgroundPickerView(): FeaturedBackgroundPickerView | null {
  return useSyncExternalStore(
    subscribeFeaturedBackgroundPicker,
    () => featuredBackgroundPickerView,
    () => null
  )
}
