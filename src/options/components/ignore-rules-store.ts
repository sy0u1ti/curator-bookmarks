import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { IgnoreRulesState } from './ignore-rules-types.js'

const defaultIgnoreRulesState: IgnoreRulesState = {
  bookmarks: [],
  domains: [],
  folders: []
}

const ignoreRulesStore = createUiViewStoreSlice(
  'options',
  'ignore-rules',
  defaultIgnoreRulesState
)

export function publishIgnoreRules(state: IgnoreRulesState): void {
  ignoreRulesStore.setState(state)
}

export function useIgnoreRulesState(): IgnoreRulesState {
  return useUiViewStoreSlice(ignoreRulesStore)
}
