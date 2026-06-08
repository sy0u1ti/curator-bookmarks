import { useSyncExternalStore } from 'react'

export interface NewtabBackgroundSettingsView {
  maskEnabled: boolean
}

export interface NewtabBackgroundSettingsActions {
  onMaskToggle: (enabled: boolean) => void
}

const EMPTY_VIEW: NewtabBackgroundSettingsView = {
  maskEnabled: false
}

const EMPTY_ACTIONS: NewtabBackgroundSettingsActions = {
  onMaskToggle: () => {}
}

let backgroundSettingsView: NewtabBackgroundSettingsView = EMPTY_VIEW
let backgroundSettingsActions: NewtabBackgroundSettingsActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeBackgroundSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitBackgroundSettingsChange(): void {
  listeners.forEach((listener) => listener())
}

export function createNewtabBackgroundSettingsView(settings: { maskEnabled: boolean }): NewtabBackgroundSettingsView {
  return {
    maskEnabled: settings.maskEnabled
  }
}

export function registerNewtabBackgroundSettingsActions(
  actions: NewtabBackgroundSettingsActions
): () => void {
  backgroundSettingsActions = actions
  return () => {
    if (backgroundSettingsActions === actions) {
      backgroundSettingsActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabBackgroundSettingsView(view: NewtabBackgroundSettingsView): void {
  backgroundSettingsView = view
  emitBackgroundSettingsChange()
}

export function useNewtabBackgroundSettingsView(): NewtabBackgroundSettingsView {
  return useSyncExternalStore(
    subscribeBackgroundSettings,
    () => backgroundSettingsView,
    () => EMPTY_VIEW
  )
}

export function dispatchNewtabBackgroundMaskToggle(enabled: boolean): void {
  backgroundSettingsActions.onMaskToggle(enabled)
}
