export const HISTORY_ACTION_EVENT = 'options:history-action'

export type HistoryAction = 'clear-history' | 'toggle-logs'

export interface HistoryActionDetail {
  action: HistoryAction
}

export function dispatchHistoryAction(action: HistoryAction): void {
  window.dispatchEvent(new CustomEvent<HistoryActionDetail>(HISTORY_ACTION_EVENT, {
    detail: { action }
  }))
}
