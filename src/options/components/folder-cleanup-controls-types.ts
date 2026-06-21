export type FolderCleanupAction =
  | 'execute'
  | 'preview'
  | 'rescan'
  | 'undo-split'

export interface FolderCleanupActionDetail {
  action: FolderCleanupAction
  suggestionId?: string
}

export interface FolderCleanupControlsState {
  analyzeDisabled: boolean
  analyzeLabel: string
  countLabel: string
  resultsSubtitle: string
  status: {
    label: string
    tone: 'muted' | 'success' | 'warning'
  }
  summary: {
    deep: number
    empty: number
    large: number
    sameName: number
    total: number
  }
}
