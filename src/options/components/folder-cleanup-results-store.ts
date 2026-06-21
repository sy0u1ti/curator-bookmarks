import { useSyncExternalStore } from 'react'
import type { FolderCleanupResultsState } from './folder-cleanup-results-types.js'

const defaultFolderCleanupResultsState: FolderCleanupResultsState = {
  emptyMessage: '点击重新扫描后，这里会展示可预览的文件夹清理建议。',
  locked: false,
  selectedSuggestionId: '',
  splitUndo: null,
  suggestions: []
}

let currentFolderCleanupResultsState = defaultFolderCleanupResultsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): FolderCleanupResultsState {
  return currentFolderCleanupResultsState
}

export function publishFolderCleanupResults(state: FolderCleanupResultsState): void {
  currentFolderCleanupResultsState = state
  listeners.forEach((listener) => listener())
}

export function useFolderCleanupResultsState(): FolderCleanupResultsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
