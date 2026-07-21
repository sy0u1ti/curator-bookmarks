export type FeatureSwitchStatusTone = 'muted' | 'success' | 'warning'

export type FeatureSettingKey =
  | 'allowRemoteParsing'
  | 'autoAnalyzeBookmarks'
  | 'autoMoveToRecommendedFolder'
  | 'tagOnlyNoAutoMove'

export interface FeatureSettingsChangeDetail {
  checked: boolean
  key: FeatureSettingKey
}

export interface FeatureSwitchItemState {
  checked: boolean
  disabled: boolean
  help: string
  key: string
  label: string
  status?: string
  statusTone?: FeatureSwitchStatusTone
}

export interface FeatureSettingsControlsState {
  loading: boolean
  switches: FeatureSwitchItemState[]
}
