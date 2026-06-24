import type { FolderRecord } from '../../shared/types.js'

export interface FolderPickerTreeOptionViewModel {
  badges: Array<{ label: string; muted?: boolean }>
  disabled: boolean
  expanded: boolean
  folder: Pick<FolderRecord, 'id' | 'title' | 'path'>
  hasChildren: boolean
  id: string
  path: string
  rowCurrent: boolean
  selected: boolean
  title: string
  toggleLabel: string
  depth: number
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
      action: 'toggle'
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
  query?: string
  showEmpty?: boolean
  treeOptions: FolderPickerTreeOptionViewModel[]
}
