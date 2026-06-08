export const REDIRECT_ACTION_EVENT = 'options:redirect-action'

export type RedirectAction =
  | 'clear-selection'
  | 'delete-all'
  | 'delete-selected'
  | 'select-all'
  | 'update-selected'

export interface RedirectActionDetail {
  action: RedirectAction
}

export function dispatchRedirectAction(action: RedirectAction): void {
  window.dispatchEvent(new CustomEvent<RedirectActionDetail>(REDIRECT_ACTION_EVENT, {
    detail: { action }
  }))
}
