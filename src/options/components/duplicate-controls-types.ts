export type DuplicateAction =
  | 'clear-selection'
  | 'delete-selection'
  | 'group-strategy'
  | 'strategy'
  | 'toggle-item'

export interface DuplicateActionDetail {
  action: DuplicateAction
  bookmarkId?: string
  checked?: boolean
  groupId?: string
  strategy?: string
}

export interface DuplicateControlsSummary {
  crossFolderGroups: number
  deleteCandidates: number
  highRiskGroups: number
  selectedItems: number
  titleVariantGroups: number
  totalGroups: number
}

export interface DuplicateControlsSelectionStats {
  deleteCount: number
  groupCount: number
  keepCount: number
  unsafeGroupCount: number
}

export interface DuplicateControlsState {
  groupCountLabel: string
  locked: boolean
  resultCount: number
  resultsSubtitle: string
  selectionStats: DuplicateControlsSelectionStats
  strategyStatus: string
  summary: DuplicateControlsSummary
}
