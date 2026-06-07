import { useSyncExternalStore } from 'react'
import type { NewTabModuleSettingKey } from './module-settings'

export interface NewtabModuleSettingRowView {
  description: string
  enabled: boolean
  index: number
  key: NewTabModuleSettingKey
  label: string
  total: number
}

export interface NewtabModuleSettingsView {
  rows: NewtabModuleSettingRowView[]
}

export interface NewtabModuleSettingsActions {
  onMove: (key: NewTabModuleSettingKey, direction: -1 | 1) => void
  onToggle: (key: NewTabModuleSettingKey, enabled: boolean) => void
}

const EMPTY_VIEW: NewtabModuleSettingsView = {
  rows: []
}

const EMPTY_ACTIONS: NewtabModuleSettingsActions = {
  onMove: () => {},
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

export function dispatchNewtabModuleSettingMove(
  key: NewTabModuleSettingKey,
  direction: -1 | 1
): void {
  moduleSettingsActions.onMove(key, direction)
}

export function dispatchNewtabModuleSettingToggle(
  key: NewTabModuleSettingKey,
  enabled: boolean
): void {
  moduleSettingsActions.onToggle(key, enabled)
}
