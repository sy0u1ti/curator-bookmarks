import { useSyncExternalStore } from 'react'

export const NEWTAB_SEARCH_BACKGROUND_MIN = 52
export const NEWTAB_SEARCH_BACKGROUND_DEFAULT = 56
export const NEWTAB_SEARCH_BACKGROUND_MAX = 92

export interface NewtabSearchSettingsView {
  autoVerticalCenter: boolean
  autoVerticalCenterDisabled: boolean
  background: number
  backgroundDisabled: boolean
  enabled: boolean
  enabledEngines: string[]
  engine: string
  engineControlsDisabled: boolean
  height: number
  offsetDisabled: boolean
  offsetMax: number
  offsetMin: number
  offsetY: number
  openInNewTab: boolean
  openInNewTabDisabled: boolean
  placeholder: string
  placeholderDisabled: boolean
  width: number
  widthDisabled: boolean
  widthMax: number
  widthMin: number
  webSearchDisabled: boolean
  webSearchEnabled: boolean
}

export type NewtabSearchSettingsToggleKey =
  | 'autoVerticalCenter'
  | 'enabled'
  | 'openInNewTab'
  | 'webSearchEnabled'

export type NewtabSearchSettingsFieldKey =
  | 'background'
  | 'enabledEngines'
  | 'engine'
  | 'height'
  | 'offsetY'
  | 'placeholder'
  | 'width'

interface NewtabSearchSettingsSource {
  autoVerticalCenter: boolean
  background: number
  enabled: boolean
  enabledEngines: string[]
  engine: string
  height: number
  offsetY: number
  openInNewTab: boolean
  placeholder: string
  width: number
  webSearchEnabled: boolean
}

export interface NewtabSearchSettingsActions {
  onFieldChange: (key: NewtabSearchSettingsFieldKey, value: number | string | string[]) => void
  onToggle: (key: NewtabSearchSettingsToggleKey, enabled: boolean) => void
}

const EMPTY_VIEW: NewtabSearchSettingsView = {
  autoVerticalCenter: false,
  autoVerticalCenterDisabled: false,
  background: NEWTAB_SEARCH_BACKGROUND_DEFAULT,
  backgroundDisabled: false,
  enabled: true,
  enabledEngines: ['google', 'bing', 'baidu', 'duckduckgo'],
  engine: 'google',
  engineControlsDisabled: false,
  height: 40,
  offsetDisabled: false,
  offsetMax: 240,
  offsetMin: -240,
  offsetY: 0,
  openInNewTab: false,
  openInNewTabDisabled: false,
  placeholder: '',
  placeholderDisabled: false,
  width: 44,
  widthDisabled: false,
  widthMax: 72,
  widthMin: 16,
  webSearchDisabled: false,
  webSearchEnabled: true
}

const EMPTY_ACTIONS: NewtabSearchSettingsActions = {
  onFieldChange: () => {},
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
  settings: NewtabSearchSettingsSource,
  bounds: {
    offset: { min: number; max: number }
    width: { min: number; max: number }
  } = {
    offset: { min: -240, max: 240 },
    width: { min: 16, max: 72 }
  }
): NewtabSearchSettingsView {
  const engineControlsDisabled = !settings.enabled || !settings.webSearchEnabled
  const width = clampNumber(settings.width, bounds.width.min, bounds.width.max)
  const offsetY = clampNumber(settings.offsetY, bounds.offset.min, bounds.offset.max)
  const background = clampNumber(
    settings.background,
    NEWTAB_SEARCH_BACKGROUND_MIN,
    NEWTAB_SEARCH_BACKGROUND_MAX
  )

  return {
    autoVerticalCenter: settings.autoVerticalCenter,
    autoVerticalCenterDisabled: !settings.enabled,
    background,
    backgroundDisabled: !settings.enabled,
    enabled: settings.enabled,
    enabledEngines: settings.enabledEngines,
    engine: settings.engine,
    engineControlsDisabled,
    height: settings.height,
    offsetDisabled: !settings.enabled || settings.autoVerticalCenter,
    offsetMax: bounds.offset.max,
    offsetMin: bounds.offset.min,
    offsetY,
    openInNewTab: settings.openInNewTab,
    openInNewTabDisabled: engineControlsDisabled,
    placeholder: settings.placeholder,
    placeholderDisabled: !settings.enabled,
    width,
    widthDisabled: !settings.enabled,
    widthMax: bounds.width.max,
    widthMin: bounds.width.min,
    webSearchDisabled: !settings.enabled,
    webSearchEnabled: settings.webSearchEnabled
  }
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.max(min, Math.min(max, Math.round(value)))
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

export function dispatchNewtabSearchSettingFieldChange(
  key: NewtabSearchSettingsFieldKey,
  value: number | string | string[]
): void {
  searchSettingsActions.onFieldChange(key, value)
}
