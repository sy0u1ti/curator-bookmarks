import { useSyncExternalStore } from 'react'
import type { SettingsDrawerSection } from './settings-group-sync'

export type NewtabSettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface NewtabSettingsDrawerView {
  activeGroup: SettingsDrawerSection
  open: boolean
  saveMessage: string
  saveState: NewtabSettingsSaveState
}

export interface NewtabSettingsDrawerActions {
  onActiveGroupChange: (group: SettingsDrawerSection) => void
  onFeaturedPickerClick: () => void
  onOpenChange: (open: boolean, event?: Event) => void
  onReady: () => void
  onToggleRequest: () => void
}

const EMPTY_ACTIONS: NewtabSettingsDrawerActions = {
  onActiveGroupChange: () => {},
  onFeaturedPickerClick: () => {},
  onOpenChange: () => {},
  onReady: () => {},
  onToggleRequest: () => {}
}

let settingsDrawerView: NewtabSettingsDrawerView = {
  activeGroup: 'source',
  open: false,
  saveMessage: '',
  saveState: 'idle'
}
let settingsDrawerActions: NewtabSettingsDrawerActions = EMPTY_ACTIONS

const listeners = new Set<() => void>()

function subscribeSettingsDrawer(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitSettingsDrawerChange(): void {
  listeners.forEach((listener) => listener())
}

export function registerNewtabSettingsDrawerActions(
  actions: NewtabSettingsDrawerActions
): () => void {
  settingsDrawerActions = actions
  return () => {
    if (settingsDrawerActions === actions) {
      settingsDrawerActions = EMPTY_ACTIONS
    }
  }
}

export function useNewtabSettingsDrawerView(): NewtabSettingsDrawerView {
  return useSyncExternalStore(
    subscribeSettingsDrawer,
    () => settingsDrawerView,
    () => ({ activeGroup: 'source', open: false, saveMessage: '', saveState: 'idle' })
  )
}

export function dispatchNewtabSettingsDrawerOpen(open: boolean): void {
  if (settingsDrawerView.open === open) {
    return
  }
  settingsDrawerView = {
    ...settingsDrawerView,
    open
  }
  emitSettingsDrawerChange()
}

export function dispatchNewtabSettingsDrawerActiveGroup(group: SettingsDrawerSection): void {
  if (settingsDrawerView.activeGroup === group) {
    return
  }
  settingsDrawerView = {
    ...settingsDrawerView,
    activeGroup: group
  }
  emitSettingsDrawerChange()
}

export function dispatchNewtabSettingsDrawerSaveStatus(
  saveState: NewtabSettingsSaveState,
  saveMessage: string
): void {
  if (settingsDrawerView.saveState === saveState && settingsDrawerView.saveMessage === saveMessage) {
    return
  }
  settingsDrawerView = {
    ...settingsDrawerView,
    saveMessage,
    saveState
  }
  emitSettingsDrawerChange()
}

export function dispatchNewtabSettingsDrawerActiveGroupChange(group: SettingsDrawerSection): void {
  settingsDrawerActions.onActiveGroupChange(group)
}

export function dispatchNewtabSettingsDrawerReady(): void {
  settingsDrawerActions.onReady()
}

export function dispatchNewtabSettingsDrawerFeaturedPickerClick(): void {
  settingsDrawerActions.onFeaturedPickerClick()
}

export function dispatchNewtabSettingsDrawerOpenChange(open: boolean, event?: Event): void {
  settingsDrawerActions.onOpenChange(open, event)
}

export function dispatchNewtabSettingsDrawerToggleRequest(): void {
  settingsDrawerActions.onToggleRequest()
}
