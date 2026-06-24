import { useSyncExternalStore } from 'react'
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

let moduleSettingsView: NewtabModuleSettingsView = EMPTY_VIEW
let moduleSettingsActions: NewtabModuleSettingsActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeModuleSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitModuleSettingsChange(): void {
  listeners.forEach((listener) => listener())
}

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
  moduleSettingsView = view
  emitModuleSettingsChange()
}

export function useNewtabModuleSettingsView(): NewtabModuleSettingsView {
  return useSyncExternalStore(
    subscribeModuleSettings,
    () => moduleSettingsView,
    () => EMPTY_VIEW
  )
}

export function dispatchNewtabModuleSettingToggle(
  key: NewTabModuleSettingKey,
  enabled: boolean
): void {
  moduleSettingsActions.onToggle(key, enabled)
}
