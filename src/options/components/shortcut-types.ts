export interface ShortcutCommandViewModel {
  name: string
  title: string
  detail: string
  shortcut: string
}

export type ShortcutListState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'commands'; commands: ShortcutCommandViewModel[] }

export interface ShortcutControlsState {
  detail: string
  list: ShortcutListState
  loading: boolean
  statusLabel: string
  statusTone: string
}
