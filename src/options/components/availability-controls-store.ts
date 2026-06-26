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
  permissionCopy: '开始检测时申请当前范围的站点权限；授权后执行多层校验。',
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
