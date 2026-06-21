export type OptionsModalKey = 'confirm' | 'delete' | 'move' | 'scope'

export type OptionsModalAction = 'cancel' | 'confirm' | 'dismiss' | 'search-change'

export interface OptionsModalActionDetail {
  action: OptionsModalAction
  modal: OptionsModalKey
  query?: string
}

export interface DeleteModalState {
  confirmDisabled: boolean
  confirmLabel: string
  copy: string
  open: boolean
}

export interface ConfirmModalState {
  cancelLabel: string
  confirmLabel: string
  copy: string
  label: string
  open: boolean
  tone: 'danger' | 'warning'
  title: string
}

export interface MoveModalState {
  copy: string
  finalFocusId: string
  open: boolean
  query: string
}

export interface ScopeModalState {
  copy: string
  finalFocusId: string
  open: boolean
  query: string
}

export interface OptionsModalsState {
  confirm: ConfirmModalState
  delete: DeleteModalState
  move: MoveModalState
  scope: ScopeModalState
}
