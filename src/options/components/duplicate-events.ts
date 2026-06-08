export const DUPLICATE_ACTION_EVENT = 'options:duplicate-action'

export type DuplicateAction =
  | 'clear-selection'
  | 'delete-selection'
  | 'strategy'

export interface DuplicateActionDetail {
  action: DuplicateAction
  strategy?: string
}

export function dispatchDuplicateAction(detail: DuplicateActionDetail): void {
  window.dispatchEvent(new CustomEvent<DuplicateActionDetail>(DUPLICATE_ACTION_EVENT, {
    detail
  }))
}
