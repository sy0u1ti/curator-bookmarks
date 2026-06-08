export const FEATURE_SETTINGS_EVENT = 'options:feature-settings-change'

export type FeatureSettingKey =
  | 'allowRemoteParsing'
  | 'autoAnalyzeBookmarks'
  | 'autoMoveToRecommendedFolder'
  | 'tagOnlyNoAutoMove'

export interface FeatureSettingsChangeDetail {
  checked: boolean
  key: FeatureSettingKey
}

export function dispatchFeatureSettingsChange(detail: FeatureSettingsChangeDetail): void {
  window.dispatchEvent(new CustomEvent<FeatureSettingsChangeDetail>(FEATURE_SETTINGS_EVENT, {
    detail
  }))
}
