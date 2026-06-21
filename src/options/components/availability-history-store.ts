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
    subtitle: '完成一次检测后，这里会生成一条检测日志，保留最近多次结果用于趋势和连续异常对比。',
    timestamp: '尚无历史'
  },
  log: {
    collapsed: false,
    emptyCopy: '完成检测后，这里会保留最近多次检测日志。',
    maxAbnormalCount: 1,
    runs: []
  },
  recovered: {
    emptyCopy: '完成检测后，这里会展示相较于上一次已恢复的书签。',
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
