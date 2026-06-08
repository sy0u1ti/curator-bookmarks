import { useSyncExternalStore } from 'react'

export interface NewtabSearchSettingsView {
  autoVerticalCenter: boolean
  autoVerticalCenterDisabled: boolean
  enabled: boolean
  openInNewTab: boolean
  openInNewTabDisabled: boolean
  webSearchDisabled: boolean
  webSearchEnabled: boolean
}

export type NewtabSearchSettingsToggleKey =
  | 'autoVerticalCenter'
  | 'enabled'
  | 'openInNewTab'
  | 'webSearchEnabled'

interface NewtabSearchSettingsSource {
  autoVerticalCenter: boolean
  enabled: boolean
  openInNewTab: boolean
  webSearchEnabled: boolean
}

export interface NewtabSearchSettingsActions {
  onToggle: (key: NewtabSearchSettingsToggleKey, enabled: boolean) => void
}

const EMPTY_VIEW: NewtabSearchSettingsView = {
  autoVerticalCenter: false,
  autoVerticalCenterDisabled: false,
  enabled: true,
  openInNewTab: false,
  openInNewTabDisabled: false,
  webSearchDisabled: false,
  webSearchEnabled: true
}

const EMPTY_ACTIONS: NewtabSearchSettingsActions = {
  onToggle: () => {}
}

let searchSettingsView: NewtabSearchSettingsView = EMPTY_VIEW
let searchSettingsActions: NewtabSearchSettingsActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeSearchSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitSearchSettingsChange(): void {
  listeners.forEach((listener) => listener())
}

export function createNewtabSearchSettingsView(
  settings: NewtabSearchSettingsSource
): NewtabSearchSettingsView {
  return {
    autoVerticalCenter: settings.autoVerticalCenter,
    autoVerticalCenterDisabled: !settings.enabled,
    enabled: settings.enabled,
    openInNewTab: settings.openInNewTab,
    openInNewTabDisabled: !settings.enabled || !settings.webSearchEnabled,
    webSearchDisabled: !settings.enabled,
    webSearchEnabled: settings.webSearchEnabled
  }
}

export function registerNewtabSearchSettingsActions(
  actions: NewtabSearchSettingsActions
): () => void {
  searchSettingsActions = actions
  return () => {
    if (searchSettingsActions === actions) {
      searchSettingsActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabSearchSettingsView(view: NewtabSearchSettingsView): void {
  searchSettingsView = view
  emitSearchSettingsChange()
}

export function useNewtabSearchSettingsView(): NewtabSearchSettingsView {
  return useSyncExternalStore(
    subscribeSearchSettings,
    () => searchSettingsView,
    () => EMPTY_VIEW
  )
}

export function dispatchNewtabSearchSettingToggle(
  key: NewtabSearchSettingsToggleKey,
  enabled: boolean
): void {
  searchSettingsActions.onToggle(key, enabled)
}
