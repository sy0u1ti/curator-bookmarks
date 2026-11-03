import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type {
  AvailabilityResultPanelKind,
  AvailabilityResultsState
} from './availability-results-types.js'

const emptyStates = new Map<AvailabilityResultPanelKind, AvailabilityResultsState>()
const availabilityResultsStore = createUiViewStoreSlice<
  Partial<Record<AvailabilityResultPanelKind, AvailabilityResultsState>>
>('options', 'availability-results', {})

function getEmptyState(kind: AvailabilityResultPanelKind): AvailabilityResultsState {
  const existing = emptyStates.get(kind)
  if (existing) {
    return existing
  }
  const state: AvailabilityResultsState = {
    emptyMessage: kind === 'review'
      ? '检测后，需要进一步验证的书签会显示在这里。'
      : '检测后，已确认无法访问的书签会显示在这里。',
    results: []
  }
  emptyStates.set(kind, state)
  return state
}

export function publishAvailabilityResults(
  kind: AvailabilityResultPanelKind,
  state: AvailabilityResultsState
): void {
  availabilityResultsStore.setState((states) => ({
    ...states,
    [kind]: state
  }))
}

export function useAvailabilityResultsState(kind: AvailabilityResultPanelKind): AvailabilityResultsState {
  return useUiViewStoreSlice(
    availabilityResultsStore,
    (states) => states[kind] || getEmptyState(kind)
  )
}
