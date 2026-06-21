import { useSyncExternalStore } from 'react'
import type { AvailabilityControlsState } from './availability-controls-types.js'

const defaultState: AvailabilityControlsState = {
  actionBusy: false,
  actionDisabled: true,
  actionLabel: '开始检测全部书签',
  badgeText: '多层校验',
  badgeTone: 'muted',
  pauseDisabled: true,
  pauseHidden: true,
  pauseLabel: '暂停检测',
  permissionCopy: '点击开始检测时会按当前范围的目标网站申请可选主机权限；授权后执行后台导航、失败重试和网络探测。检测过程中会短暂创建并自动关闭后台标签页。',
  settingsDisabled: true,
  settingsDraft: {
    concurrency: '2',
    navigationTimeoutSeconds: '30'
  },
  settingsOpen: false,
  settingsStatus: '',
  settingsStatusTone: 'muted',
  stopBusy: false,
  stopDisabled: true,
  stopHidden: true,
  stopLabel: '停止本次检测'
}

let currentState = defaultState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): AvailabilityControlsState {
  return currentState
}

export function publishAvailabilityControls(state: AvailabilityControlsState): void {
  currentState = state
  listeners.forEach((listener) => listener())
}

export function useAvailabilityControls(): AvailabilityControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
