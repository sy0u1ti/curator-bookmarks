import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { RedirectResultsState } from './redirect-results-types.js'

const defaultRedirectResultsState: RedirectResultsState = {
  emptyMessage: '完成一次检测后，这里会展示可一键更新的重定向书签。',
  locked: false,
  results: [],
  selectedIds: new Set()
}

const redirectResultsStore = createUiViewStoreSlice(
  'options',
  'redirect-results',
  defaultRedirectResultsState
)

export function publishRedirectResults(state: RedirectResultsState): void {
  redirectResultsStore.setState(state)
}

export function useRedirectResultsState(): RedirectResultsState {
  return useUiViewStoreSlice(redirectResultsStore)
}
