import { useSyncExternalStore } from 'react'
import type { RedirectControlsState } from './redirect-controls-types.js'

const defaultRedirectControlsState: RedirectControlsState = {
  count: 0,
  locked: false,
  selectedCount: 0,
  subtitle: ''
}

let currentRedirectControlsState = defaultRedirectControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): RedirectControlsState {
  return currentRedirectControlsState
}

export function publishRedirectControls(state: RedirectControlsState): void {
  currentRedirectControlsState = state
  listeners.forEach((listener) => listener())
}

export function useRedirectControlsState(): RedirectControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
