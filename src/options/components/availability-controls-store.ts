import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
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

const availabilityControlsStore = createUiViewStoreSlice(
  'options',
  'availability-controls',
  defaultState
)

export function publishAvailabilityControls(state: AvailabilityControlsState): void {
  availabilityControlsStore.setState(state)
}

export function useAvailabilityControls(): AvailabilityControlsState {
  return useUiViewStoreSlice(availabilityControlsStore)
}
