import { useSyncExternalStore } from 'react'
import type {
  ScopePickerSource,
  ScopePickerTriggerState,
  ScopePickerTriggersState
} from './scope-picker-types.js'

const defaultTriggerState: ScopePickerTriggerState = {
  copy: '当前范围：全部书签。你可以切换到某个文件夹，只检测该文件夹及其子层级里的书签。',
  disabled: false,
  label: '全部书签'
}

const defaultState: ScopePickerTriggersState = {
  availability: defaultTriggerState,
  history: {
    copy: '当前显示范围：全部书签。这里只展示对应检测范围的历史日志与趋势变化。',
    disabled: false,
    label: '全部书签'
  }
}

let currentState = defaultState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ScopePickerTriggersState {
  return currentState
}

export function publishScopePickerTrigger(source: ScopePickerSource, state: ScopePickerTriggerState): void {
  currentState = {
    ...currentState,
    [source]: state
  }
  listeners.forEach((listener) => listener())
}

export function useScopePickerTrigger(source: ScopePickerSource): ScopePickerTriggerState {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot()[source],
    () => getSnapshot()[source]
  )
}
