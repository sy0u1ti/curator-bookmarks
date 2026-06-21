import { useSyncExternalStore } from 'react'

export interface OptionsOverviewMetricState {
  checkableBookmarks: string
  issueCount: string
  recycleCount: string
  totalBookmarks: string
}

export interface OptionsOverviewState {
  metrics: OptionsOverviewMetricState
  nextStepCopy: string
  nextStepTitle: string
}

const defaultOptionsOverviewState: OptionsOverviewState = {
  metrics: {
    checkableBookmarks: '读取中',
    issueCount: '0',
    recycleCount: '0',
    totalBookmarks: '读取中'
  },
  nextStepCopy: '读取完成后这里会显示建议下一步和当前影响范围。',
  nextStepTitle: '正在读取书签目录'
}

let currentOptionsOverviewState = defaultOptionsOverviewState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): OptionsOverviewState {
  return currentOptionsOverviewState
}

export function publishOptionsOverview(state: OptionsOverviewState): void {
  currentOptionsOverviewState = state
  listeners.forEach((listener) => listener())
}

export function useOptionsOverview(): OptionsOverviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
