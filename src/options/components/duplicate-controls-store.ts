import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { DuplicateControlsState } from './duplicate-controls-types.js'

const defaultDuplicateControlsState: DuplicateControlsState = {
  groupCountLabel: '0 组重复',
  locked: false,
  resultCount: 0,
  resultsSubtitle: '正在分析重复书签。',
  selectionStats: {
    deleteCount: 0,
    groupCount: 0,
    keepCount: 0,
    unsafeGroupCount: 0
  },
  strategyStatus: '先选择待移入回收站的副本，再确认处理。',
  summary: {
    crossFolderGroups: 0,
    deleteCandidates: 0,
    highRiskGroups: 0,
    selectedItems: 0,
    titleVariantGroups: 0,
    totalGroups: 0
  }
}

const duplicateControlsStore = createUiViewStoreSlice(
  'options',
  'duplicate-controls',
  defaultDuplicateControlsState
)

export function publishDuplicateControls(state: DuplicateControlsState): void {
  duplicateControlsStore.setState(state)
}

export function useDuplicateControlsState(): DuplicateControlsState {
  return useUiViewStoreSlice(duplicateControlsStore)
}
