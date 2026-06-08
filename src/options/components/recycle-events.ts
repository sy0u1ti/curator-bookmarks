export const RECYCLE_ACTION_EVENT = 'options:recycle-action'

export type RecycleAction =
  | 'clear-all'
  | 'clear-selected'
  | 'clear-selection'
  | 'restore-selected'
  | 'select-all'

export interface RecycleActionDetail {
  action: RecycleAction
}

export function dispatchRecycleAction(action: RecycleAction): void {
  window.dispatchEvent(new CustomEvent<RecycleActionDetail>(RECYCLE_ACTION_EVENT, {
    detail: { action }
  }))
}
