import { useSyncExternalStore } from 'react'
import type { NewTabTimeSettings } from './time-settings'

export interface NewtabTimeSettingsView {
  enabled: boolean
  hour12: boolean
  showSeconds: boolean
  switchesDisabled: boolean
}

export type NewtabTimeSettingsToggleKey =
  | 'enabled'
  | 'hour12'
  | 'showSeconds'

export interface NewtabTimeSettingsActions {
  onToggle: (key: NewtabTimeSettingsToggleKey, enabled: boolean) => void
}

const EMPTY_VIEW: NewtabTimeSettingsView = {
  enabled: true,
  hour12: false,
  showSeconds: false,
  switchesDisabled: false
}

const EMPTY_ACTIONS: NewtabTimeSettingsActions = {
  onToggle: () => {}
}

let timeSettingsView: NewtabTimeSettingsView = EMPTY_VIEW
let timeSettingsActions: NewtabTimeSettingsActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeTimeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitTimeSettingsChange(): void {
  listeners.forEach((listener) => listener())
}

export function createNewtabTimeSettingsView(settings: NewTabTimeSettings): NewtabTimeSettingsView {
  return {
    enabled: settings.enabled,
    hour12: settings.hour12,
    showSeconds: settings.showSeconds,
    switchesDisabled: !settings.enabled || settings.displayMode === 'date'
  }
}

export function registerNewtabTimeSettingsActions(
  actions: NewtabTimeSettingsActions
): () => void {
  timeSettingsActions = actions
  return () => {
    if (timeSettingsActions === actions) {
      timeSettingsActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabTimeSettingsView(view: NewtabTimeSettingsView): void {
  timeSettingsView = view
  emitTimeSettingsChange()
}

export function useNewtabTimeSettingsView(): NewtabTimeSettingsView {
  return useSyncExternalStore(
    subscribeTimeSettings,
    () => timeSettingsView,
    () => EMPTY_VIEW
  )
}

export function dispatchNewtabTimeSettingToggle(
  key: NewtabTimeSettingsToggleKey,
  enabled: boolean
): void {
  timeSettingsActions.onToggle(key, enabled)
}
