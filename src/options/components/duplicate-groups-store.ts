import { useSyncExternalStore } from 'react'
import type { DuplicateGroupsState } from './duplicate-groups-types.js'

const defaultDuplicateGroupsState: DuplicateGroupsState = {
  catalogLoading: true,
  currentScopeFolderId: '',
  groups: [],
  locked: false,
  selectedIds: new Set(),
  selectionStats: {
    deleteCount: 0,
    groupCount: 0,
    keepCount: 0,
    unsafeGroupCount: 0
  },
  tagBadgeLabels: {}
}

let currentDuplicateGroupsState = defaultDuplicateGroupsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): DuplicateGroupsState {
  return currentDuplicateGroupsState
}

export function publishDuplicateGroups(state: DuplicateGroupsState): void {
  currentDuplicateGroupsState = state
  listeners.forEach((listener) => listener())
}

export function useDuplicateGroupsState(): DuplicateGroupsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
