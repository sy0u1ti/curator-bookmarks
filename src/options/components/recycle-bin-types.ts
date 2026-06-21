export interface RecycleEntryViewModel {
  bookmarkId: string
  deletedAt: number
  index: number
  parentId: string
  path: string
  recycleId: string
  source: string
  title: string
  url: string
}

export type RecycleAction =
  | 'clear-all'
  | 'clear-entry'
  | 'clear-selected'
  | 'clear-selection'
  | 'restore-entry'
  | 'restore-selected'
  | 'select-all'
  | 'toggle-entry'

export interface RecycleActionDetail {
  action: RecycleAction
  checked?: boolean
  recycleId?: string
}

export interface RecycleBinState {
  disabled: boolean
  entries: RecycleEntryViewModel[]
  selectedIds: Set<unknown>
}
