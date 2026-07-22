import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type {
  FolderPickerKind,
  FolderPickerResultsState
} from './folder-picker-results-types.js'

const defaultStates: Record<FolderPickerKind, FolderPickerResultsState> = {
  move: {
    activeId: '',
    emptyMessage: '正在加载文件夹列表。',
    kind: 'move',
    treeOptions: []
  },
  scope: {
    activeId: '',
    emptyMessage: '正在加载文件夹列表。',
    kind: 'scope',
    treeOptions: []
  }
}

const folderPickerResultsStore = createUiViewStoreSlice(
  'options',
  'folder-picker-results',
  defaultStates
)

export function getFolderPickerResultsSnapshot(kind: FolderPickerKind): FolderPickerResultsState {
  return folderPickerResultsStore.getState()[kind] || defaultStates[kind]
}

export function publishFolderPickerResults(
  kind: FolderPickerKind,
  state: FolderPickerResultsState
): void {
  folderPickerResultsStore.setState((states) => ({
    ...states,
    [kind]: state
  }))
}

export function patchFolderPickerResults(
  kind: FolderPickerKind,
  patch: Partial<FolderPickerResultsState>
): void {
  folderPickerResultsStore.setState((states) => ({
    ...states,
    [kind]: {
      ...states[kind],
      ...patch
    }
  }))
}

export function useFolderPickerResultsState(kind: FolderPickerKind): FolderPickerResultsState {
  return useUiViewStoreSlice(
    folderPickerResultsStore,
    (states) => states[kind] || defaultStates[kind]
  )
}
