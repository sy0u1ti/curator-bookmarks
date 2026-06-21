import { useSyncExternalStore } from 'react'
import type {
  FolderPickerKind,
  FolderPickerResultsState
} from './folder-picker-results-types.js'

const defaultStates: Record<FolderPickerKind, FolderPickerResultsState> = {
  move: {
    activeId: '',
    emptyMessage: '正在加载文件夹列表。',
    kind: 'move',
    options: []
  },
  scope: {
    activeId: '',
    emptyMessage: '正在加载文件夹列表。',
    kind: 'scope',
    options: []
  }
}

let currentFolderPickerResultsStates: Record<FolderPickerKind, FolderPickerResultsState> = defaultStates
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Record<FolderPickerKind, FolderPickerResultsState> {
  return currentFolderPickerResultsStates
}

export function getFolderPickerResultsSnapshot(kind: FolderPickerKind): FolderPickerResultsState {
  return currentFolderPickerResultsStates[kind] || defaultStates[kind]
}

export function publishFolderPickerResults(
  kind: FolderPickerKind,
  state: FolderPickerResultsState
): void {
  currentFolderPickerResultsStates = {
    ...currentFolderPickerResultsStates,
    [kind]: state
  }
  listeners.forEach((listener) => listener())
}

export function patchFolderPickerResults(
  kind: FolderPickerKind,
  patch: Partial<FolderPickerResultsState>
): void {
  currentFolderPickerResultsStates = {
    ...currentFolderPickerResultsStates,
    [kind]: {
      ...currentFolderPickerResultsStates[kind],
      ...patch
    }
  }
  listeners.forEach((listener) => listener())
}

export function useFolderPickerResultsState(kind: FolderPickerKind): FolderPickerResultsState {
  const states = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return states[kind] || defaultStates[kind]
}
