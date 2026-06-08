export type FeatureSwitchStatusTone = 'muted' | 'success' | 'warning'

export interface FeatureSwitchItemState {
  checked: boolean
  disabled: boolean
  help: string
  key: string
  label: string
  status?: string
  statusId?: string
  statusTone?: FeatureSwitchStatusTone
}

export interface FeatureSettingsControlsState {
  switches: FeatureSwitchItemState[]
}
