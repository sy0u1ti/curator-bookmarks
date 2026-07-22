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
