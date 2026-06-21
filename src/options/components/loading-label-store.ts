import { useSyncExternalStore } from 'react'
import type { LoadingLabelState } from './loading-label-types.js'

let currentLoadingLabelStates: Record<string, LoadingLabelState> = {}
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Record<string, LoadingLabelState> {
  return currentLoadingLabelStates
}

export function publishLoadingLabel(key: string, state: LoadingLabelState): void {
  currentLoadingLabelStates = {
    ...currentLoadingLabelStates,
    [key]: state
  }
  listeners.forEach((listener) => listener())
}

export function useLoadingLabelState(key: string, fallback: LoadingLabelState): LoadingLabelState {
  const states = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return states[key] || fallback
}
