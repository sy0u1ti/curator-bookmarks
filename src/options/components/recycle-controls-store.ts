import { useSyncExternalStore } from 'react'
import type { RecycleControlsState } from './recycle-controls-types.js'

const defaultRecycleControlsState: RecycleControlsState = {
  busy: false,
  entryCount: 0,
  selectedCount: 0
}

let currentRecycleControlsState = defaultRecycleControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): RecycleControlsState {
  return currentRecycleControlsState
}

export function publishRecycleControls(state: RecycleControlsState): void {
  currentRecycleControlsState = state
  listeners.forEach((listener) => listener())
}

export function useRecycleControlsState(): RecycleControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
