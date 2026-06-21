import { useSyncExternalStore } from 'react'
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

let currentDuplicateControlsState = defaultDuplicateControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): DuplicateControlsState {
  return currentDuplicateControlsState
}

export function publishDuplicateControls(state: DuplicateControlsState): void {
  currentDuplicateControlsState = state
  listeners.forEach((listener) => listener())
}

export function useDuplicateControlsState(): DuplicateControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
