import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { FolderCleanupResultsState } from './folder-cleanup-results-types.js'

const defaultFolderCleanupResultsState: FolderCleanupResultsState = {
  emptyMessage: '点击重新扫描后，这里会展示可预览的文件夹清理建议。',
  locked: false,
  selectedSuggestionId: '',
  splitUndo: null,
  suggestions: []
}

const folderCleanupResultsStore = createUiViewStoreSlice(
  'options',
  'folder-cleanup-results',
  defaultFolderCleanupResultsState
)

export function publishFolderCleanupResults(state: FolderCleanupResultsState): void {
  folderCleanupResultsStore.setState(state)
}

export function useFolderCleanupResultsState(): FolderCleanupResultsState {
  return useUiViewStoreSlice(folderCleanupResultsStore)
}
