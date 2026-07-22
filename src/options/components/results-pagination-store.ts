import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { ResultsPaginationState } from './results-pagination-types.js'

const hiddenStates = new Map<string, ResultsPaginationState>()
const resultsPaginationStore = createUiViewStoreSlice<Record<string, ResultsPaginationState>>(
  'options',
  'results-pagination',
  {}
)

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
  resultsPaginationStore.setState((states) => ({
    ...states,
    [kind]: state
  }))
}

export function useResultsPaginationState(kind: string): ResultsPaginationState {
  return useUiViewStoreSlice(
    resultsPaginationStore,
    (states) => states[kind] || getHiddenState(kind)
  )
}
