import type { FolderRecord } from '../../shared/types.js'

export interface FolderPickerOptionViewModel {
  current?: boolean
  description?: string
  disabled?: boolean
  folder: Pick<FolderRecord, 'id' | 'title' | 'path'>
}

export type FolderPickerKind = 'scope' | 'move'

export type FolderPickerActionDetail =
  | {
      action: 'select'
      folderId: string
      kind: FolderPickerKind
    }
  | {
      action: 'focus'
      folderId: string
      kind: FolderPickerKind
    }
  | {
      action: 'results-keydown' | 'search-keydown'
      key: string
      kind: FolderPickerKind
    }

export interface FolderPickerResultsState {
  activeId: string
  emptyMessage?: string
  focusRequestId?: string
  kind: FolderPickerKind
  options: FolderPickerOptionViewModel[]
  showEmpty?: boolean
}
