export type RedirectAction =
  | 'clear-selection'
  | 'delete-all'
  | 'delete-selected'
  | 'select-all'
  | 'toggle-result'
  | 'update-result'
  | 'update-selected'

export interface RedirectActionDetail {
  action: RedirectAction
  bookmarkId?: string
  checked?: boolean
}

export interface RedirectControlsState {
  count: number
  locked: boolean
  selectedCount: number
  subtitle: string
}
