import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { RedirectControlsState } from './redirect-controls-types.js'

const defaultRedirectControlsState: RedirectControlsState = {
  count: 0,
  locked: false,
  selectedCount: 0,
  subtitle: ''
}

const redirectControlsStore = createUiViewStoreSlice(
  'options',
  'redirect-controls',
  defaultRedirectControlsState
)

export function publishRedirectControls(state: RedirectControlsState): void {
  redirectControlsStore.setState(state)
}

export function useRedirectControlsState(): RedirectControlsState {
  return useUiViewStoreSlice(redirectControlsStore)
}
