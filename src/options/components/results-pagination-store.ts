import { useSyncExternalStore } from 'react'
import type { ResultsPaginationState } from './results-pagination-types.js'

const hiddenStates = new Map<string, ResultsPaginationState>()
let currentResultsPaginationStates: Record<string, ResultsPaginationState> = {}
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Record<string, ResultsPaginationState> {
  return currentResultsPaginationStates
}

function getHiddenState(kind: string): ResultsPaginationState {
  const existing = hiddenStates.get(kind)
  if (existing) {
    return existing
  }
  const state: ResultsPaginationState = {
    end: 0,
    kind,
    label: '',
    page: 1,
    start: 0,
    totalCount: 0,
    totalPages: 1,
    visible: false
  }
  hiddenStates.set(kind, state)
  return state
}

export function publishResultsPagination(kind: string, state: ResultsPaginationState): void {
  currentResultsPaginationStates = {
    ...currentResultsPaginationStates,
    [kind]: state
  }
  listeners.forEach((listener) => listener())
}

export function useResultsPaginationState(kind: string): ResultsPaginationState {
  const states = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return states[kind] || getHiddenState(kind)
}
