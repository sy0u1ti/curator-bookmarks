import { useSyncExternalStore } from 'react'
import type { AvailabilityHistoryState } from './availability-history-types.js'

const defaultAvailabilityHistoryState: AvailabilityHistoryState = {
  controls: {
    clearDisabled: true,
    logCount: 0,
    logToggleDisabled: true,
    logToggleLabel: '收起日志',
    metrics: {
      newCount: 0,
      persistentCount: 0,
      recoveredCount: 0
    },
    subtitle: '保留最近检测，用于查看趋势和连续异常。',
    timestamp: '尚无历史'
  },
  log: {
    collapsed: false,
    emptyCopy: '完成检测后，这里会保留日志。',
    maxAbnormalCount: 1,
    runs: []
  },
  recovered: {
    emptyCopy: '完成检测后，这里会显示已恢复书签。',
    results: []
  }
}

let currentAvailabilityHistoryState = defaultAvailabilityHistoryState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): AvailabilityHistoryState {
  return currentAvailabilityHistoryState
}

export function publishAvailabilityHistory(state: AvailabilityHistoryState): void {
  currentAvailabilityHistoryState = state
  listeners.forEach((listener) => listener())
}

export function useAvailabilityHistoryState(): AvailabilityHistoryState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
