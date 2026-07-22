import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { FeatureSettingsControlsState } from './feature-settings-types.js'

const defaultFeatureSettingsControlsState: FeatureSettingsControlsState = {
  loading: true,
  switches: []
}

const featureSettingsControlsStore = createUiViewStoreSlice(
  'options',
  'feature-settings-controls',
  defaultFeatureSettingsControlsState
)

export function publishFeatureSettingsControls(state: FeatureSettingsControlsState): void {
  featureSettingsControlsStore.setState(state)
}

export function useFeatureSettingsControlsState(): FeatureSettingsControlsState {
  return useUiViewStoreSlice(featureSettingsControlsStore)
}
