import type {
  FolderCleanupSplitUndo,
  FolderCleanupSuggestion
} from '../../shared/folder-cleanup.js'

export interface FolderCleanupResultsState {
  emptyMessage: string
  locked: boolean
  selectedSuggestionId: string
  splitUndo: FolderCleanupSplitUndo | null
  suggestions: FolderCleanupSuggestion[]
}
