import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type {
  ScopePickerSource,
  ScopePickerTriggerState,
  ScopePickerTriggersState
} from './scope-picker-types.js'

const defaultTriggerState: ScopePickerTriggerState = {
  copy: '当前范围：全部书签。可切换到文件夹。',
  disabled: false,
  label: '全部书签'
}

const defaultState: ScopePickerTriggersState = {
  availability: defaultTriggerState,
  history: {
    copy: '当前范围：全部书签。只显示对应历史。',
    disabled: false,
    label: '全部书签'
  }
}

const scopePickerStore = createUiViewStoreSlice(
  'options',
  'scope-picker-triggers',
  defaultState
)

export function publishScopePickerTrigger(source: ScopePickerSource, state: ScopePickerTriggerState): void {
  scopePickerStore.setState((stateBySource) => ({
    ...stateBySource,
    [source]: state
  }))
}

export function useScopePickerTrigger(source: ScopePickerSource): ScopePickerTriggerState {
  return useUiViewStoreSlice(scopePickerStore, (state) => state[source])
}
