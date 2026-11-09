export type OptionsModalKey = 'confirm' | 'move' | 'scope'

export type OptionsModalAction = 'cancel' | 'confirm' | 'dismiss' | 'search-change'

export interface OptionsModalActionDetail {
  action: OptionsModalAction
  modal: OptionsModalKey
  query?: string
}

export interface ConfirmModalState {
  requestId: number
  holdToConfirm: boolean
  cancelLabel: string
  confirmLabel: string
  copy: string
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
  move: MoveModalState
  scope: ScopeModalState
}
