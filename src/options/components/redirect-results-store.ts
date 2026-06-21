import { useSyncExternalStore } from 'react'
import type { RedirectResultsState } from './redirect-results-types.js'

const defaultRedirectResultsState: RedirectResultsState = {
  emptyMessage: '完成一次检测后，这里会展示可一键更新的重定向书签。',
  locked: false,
  results: [],
  selectedIds: new Set()
}

let currentRedirectResultsState = defaultRedirectResultsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): RedirectResultsState {
  return currentRedirectResultsState
}

export function publishRedirectResults(state: RedirectResultsState): void {
  currentRedirectResultsState = state
  listeners.forEach((listener) => listener())
}

export function useRedirectResultsState(): RedirectResultsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
