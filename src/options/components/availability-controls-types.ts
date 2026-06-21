export interface AvailabilitySettingsDraft {
  concurrency: string
  navigationTimeoutSeconds: string
}

export type AvailabilityControlsActionDetail =
  | {
      action: 'start' | 'pause-toggle' | 'stop' | 'settings-save' | 'settings-reset'
    }
  | {
      action: 'settings-open-change'
      open: boolean
    }
  | {
      action: 'settings-draft-change'
      draft: AvailabilitySettingsDraft
    }

export interface AvailabilityControlsState {
  actionBusy: boolean
  actionDisabled: boolean
  actionLabel: string
  badgeText: string
  badgeTone: string
  pauseDisabled: boolean
  pauseHidden: boolean
  pauseLabel: string
  permissionCopy: string
  settingsDisabled: boolean
  settingsDraft: AvailabilitySettingsDraft
  settingsOpen: boolean
  settingsStatus: string
  settingsStatusTone: string
  stopBusy: boolean
  stopDisabled: boolean
  stopHidden: boolean
  stopLabel: string
}
