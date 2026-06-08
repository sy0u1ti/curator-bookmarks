import { useSyncExternalStore } from 'react'
import type { NewTabTimeSettings } from './time-settings'

export interface NewtabTimeSettingsView {
  clockSize: number
  dateFormat: NewTabTimeSettings['dateFormat']
  density: NewTabTimeSettings['density']
  displayMode: NewTabTimeSettings['displayMode']
  enabled: boolean
  hour12: boolean
  settingsDisabled: boolean
  showSeconds: boolean
  switchesDisabled: boolean
  timeZone: NewTabTimeSettings['timeZone']
}

export type NewtabTimeSettingsToggleKey =
  | 'enabled'
  | 'hour12'
  | 'showSeconds'

export type NewtabTimeSettingsFieldKey =
  | 'clockSize'
  | 'dateFormat'
  | 'density'
  | 'displayMode'
  | 'timeZone'

export interface NewtabTimeSettingsActions {
  onFieldChange: (key: NewtabTimeSettingsFieldKey, value: number | string) => void
  onToggle: (key: NewtabTimeSettingsToggleKey, enabled: boolean) => void
}

const EMPTY_VIEW: NewtabTimeSettingsView = {
  clockSize: 100,
  dateFormat: 'year-month-day-weekday',
  density: 'balanced',
  displayMode: 'time-date',
  enabled: true,
  hour12: false,
  settingsDisabled: false,
  showSeconds: false,
  switchesDisabled: false,
  timeZone: 'auto'
}

const EMPTY_ACTIONS: NewtabTimeSettingsActions = {
  onFieldChange: () => {},
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
    clockSize: settings.clockSize,
    dateFormat: settings.dateFormat,
    density: settings.density,
    displayMode: settings.displayMode,
    enabled: settings.enabled,
    hour12: settings.hour12,
    settingsDisabled: !settings.enabled,
    showSeconds: settings.showSeconds,
    switchesDisabled: !settings.enabled || settings.displayMode === 'date',
    timeZone: settings.timeZone
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

export function dispatchNewtabTimeSettingFieldChange(
  key: NewtabTimeSettingsFieldKey,
  value: number | string
): void {
  timeSettingsActions.onFieldChange(key, value)
}
