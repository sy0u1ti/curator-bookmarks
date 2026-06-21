import { useSyncExternalStore } from 'react'
import type {
  AvailabilityResultPanelKind,
  AvailabilityResultsState
} from './availability-results-types.js'

const emptyStates = new Map<AvailabilityResultPanelKind, AvailabilityResultsState>()
let currentAvailabilityResultsStates: Partial<Record<AvailabilityResultPanelKind, AvailabilityResultsState>> = {}
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Partial<Record<AvailabilityResultPanelKind, AvailabilityResultsState>> {
  return currentAvailabilityResultsStates
}

function getEmptyState(kind: AvailabilityResultPanelKind): AvailabilityResultsState {
  const existing = emptyStates.get(kind)
  if (existing) {
    return existing
  }
  const state: AvailabilityResultsState = {
    emptyMessage: kind === 'review'
      ? '开始检测后，这里会展示低置信异常书签。'
      : '开始检测后，这里会展示高置信失效的书签。',
    results: []
  }
  emptyStates.set(kind, state)
  return state
}

export function publishAvailabilityResults(
  kind: AvailabilityResultPanelKind,
  state: AvailabilityResultsState
): void {
  currentAvailabilityResultsStates = {
    ...currentAvailabilityResultsStates,
    [kind]: state
  }
  listeners.forEach((listener) => listener())
}

export function useAvailabilityResultsState(kind: AvailabilityResultPanelKind): AvailabilityResultsState {
  const states = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return states[kind] || getEmptyState(kind)
}
