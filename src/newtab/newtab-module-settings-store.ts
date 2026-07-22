import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import type { NewTabModuleSettingKey } from './module-settings'

export interface NewtabModuleSettingRowView {
  description: string
  enabled: boolean
  key: NewTabModuleSettingKey
  label: string
}

export interface NewtabModuleSettingsView {
  rows: NewtabModuleSettingRowView[]
}

export interface NewtabModuleSettingsActions {
  onToggle: (key: NewTabModuleSettingKey, enabled: boolean) => void
}

const EMPTY_VIEW: NewtabModuleSettingsView = {
  rows: []
}

const EMPTY_ACTIONS: NewtabModuleSettingsActions = {
  onToggle: () => {}
}

let moduleSettingsActions: NewtabModuleSettingsActions = EMPTY_ACTIONS
const moduleSettingsStore = createUiViewStoreSlice('newtab', 'module-settings', EMPTY_VIEW)

export function registerNewtabModuleSettingsActions(
  actions: NewtabModuleSettingsActions
): () => void {
  moduleSettingsActions = actions
  return () => {
    if (moduleSettingsActions === actions) {
      moduleSettingsActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabModuleSettingsView(view: NewtabModuleSettingsView): void {
  moduleSettingsStore.setState(view)
}

export function useNewtabModuleSettingsView(): NewtabModuleSettingsView {
  return useUiViewStoreSlice(moduleSettingsStore)
}

export function dispatchNewtabModuleSettingToggle(
  key: NewTabModuleSettingKey,
  enabled: boolean
): void {
  moduleSettingsActions.onToggle(key, enabled)
}
