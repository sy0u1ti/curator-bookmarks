import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { FolderCleanupControlsState } from './folder-cleanup-controls-types.js'

const defaultFolderCleanupControlsState: FolderCleanupControlsState = {
  analyzeDisabled: false,
  analyzeLabel: '重新扫描',
  countLabel: '0 条建议',
  resultsSubtitle: '所有建议默认只预览，不会自动修改书签。',
  status: {
    label: '未扫描',
    tone: 'muted'
  },
  summary: {
    deep: 0,
    empty: 0,
    large: 0,
    sameName: 0,
    total: 0
  }
}

const folderCleanupControlsStore = createUiViewStoreSlice(
  'options',
  'folder-cleanup-controls',
  defaultFolderCleanupControlsState
)

export function publishFolderCleanupControls(state: FolderCleanupControlsState): void {
  folderCleanupControlsStore.setState(state)
}

export function useFolderCleanupControlsState(): FolderCleanupControlsState {
  return useUiViewStoreSlice(folderCleanupControlsStore)
}
