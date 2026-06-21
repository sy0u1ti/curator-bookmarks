import { useSyncExternalStore } from 'react'
import type { RecycleBinState } from './recycle-bin-types.js'

const defaultRecycleBinState: RecycleBinState = {
  disabled: false,
  entries: [],
  selectedIds: new Set()
}

let currentRecycleBinState = defaultRecycleBinState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): RecycleBinState {
  return currentRecycleBinState
}

export function publishRecycleBin(state: RecycleBinState): void {
  currentRecycleBinState = state
  listeners.forEach((listener) => listener())
}

export function useRecycleBinState(): RecycleBinState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
