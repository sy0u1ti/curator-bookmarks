import { useSyncExternalStore } from 'react'
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

let currentFolderCleanupControlsState = defaultFolderCleanupControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): FolderCleanupControlsState {
  return currentFolderCleanupControlsState
}

export function publishFolderCleanupControls(state: FolderCleanupControlsState): void {
  currentFolderCleanupControlsState = state
  listeners.forEach((listener) => listener())
}

export function useFolderCleanupControlsState(): FolderCleanupControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
