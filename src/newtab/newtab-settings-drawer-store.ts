import { useSyncExternalStore } from 'react'
import type { SettingsDrawerSection } from './settings-group-sync'

export type NewtabSettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'
export type NewtabSettingsDrawerLayoutAction =
  | 'none'
  | 'focus-first-control'
  | 'focus-section'
  | 'scroll-top'

export interface NewtabSettingsDrawerView {
  activeGroup: SettingsDrawerSection
  open: boolean
  saveMessage: string
  saveState: NewtabSettingsSaveState
}

export interface NewtabSettingsDrawerLayoutRequest {
  action: NewtabSettingsDrawerLayoutAction
  behavior: ScrollBehavior
  requestId: number
  section: SettingsDrawerSection
}

export interface NewtabSettingsDrawerNodes {
  backdrop: HTMLElement | null
  drawer: HTMLElement | null
  panel: HTMLElement | null
  trigger: HTMLElement | null
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
let settingsDrawerLayoutRequest: NewtabSettingsDrawerLayoutRequest = {
  action: 'none',
  behavior: 'auto',
  requestId: 0,
  section: 'source'
}
let settingsDrawerNodes: NewtabSettingsDrawerNodes = {
  backdrop: null,
  drawer: null,
  panel: null,
  trigger: null
}

const listeners = new Set<() => void>()
const layoutRequestListeners = new Set<() => void>()
const nodesListeners = new Set<() => void>()

function subscribeSettingsDrawer(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitSettingsDrawerChange(): void {
  listeners.forEach((listener) => listener())
}

function subscribeSettingsDrawerLayoutRequest(listener: () => void): () => void {
  layoutRequestListeners.add(listener)
  return () => {
    layoutRequestListeners.delete(listener)
  }
}

function emitSettingsDrawerLayoutRequestChange(): void {
  layoutRequestListeners.forEach((listener) => listener())
}

function emitSettingsDrawerNodesChange(): void {
  nodesListeners.forEach((listener) => listener())
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

export function useNewtabSettingsDrawerLayoutRequest(): NewtabSettingsDrawerLayoutRequest {
  return useSyncExternalStore(
    subscribeSettingsDrawerLayoutRequest,
    () => settingsDrawerLayoutRequest,
    () => ({ action: 'none', behavior: 'auto', requestId: 0, section: 'source' })
  )
}

export function getNewtabSettingsDrawerView(): NewtabSettingsDrawerView {
  return settingsDrawerView
}

export function setNewtabSettingsDrawerNodes(nodes: Partial<NewtabSettingsDrawerNodes>): void {
  const nextNodes = {
    ...settingsDrawerNodes,
    ...nodes
  }
  const changed =
    nextNodes.backdrop !== settingsDrawerNodes.backdrop ||
    nextNodes.drawer !== settingsDrawerNodes.drawer ||
    nextNodes.panel !== settingsDrawerNodes.panel ||
    nextNodes.trigger !== settingsDrawerNodes.trigger

  settingsDrawerNodes = { ...nextNodes }

  if (!changed) {
    return
  }

  if (typeof window !== 'undefined') {
    window.queueMicrotask(emitSettingsDrawerNodesChange)
    return
  }

  emitSettingsDrawerNodesChange()
}

export function getNewtabSettingsDrawerNodes(): NewtabSettingsDrawerNodes {
  return settingsDrawerNodes
}

export function subscribeNewtabSettingsDrawerNodes(listener: () => void): () => void {
  nodesListeners.add(listener)
  return () => {
    nodesListeners.delete(listener)
  }
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

function dispatchNewtabSettingsDrawerLayoutRequest(
  action: NewtabSettingsDrawerLayoutAction,
  {
    behavior = 'smooth',
    section = settingsDrawerView.activeGroup
  }: {
    behavior?: ScrollBehavior
    section?: SettingsDrawerSection
  } = {}
): void {
  settingsDrawerLayoutRequest = {
    action,
    behavior,
    requestId: settingsDrawerLayoutRequest.requestId + 1,
    section
  }
  emitSettingsDrawerLayoutRequestChange()
}

export function dispatchNewtabSettingsDrawerFocusFirstControl(): void {
  dispatchNewtabSettingsDrawerLayoutRequest('focus-first-control', { behavior: 'auto' })
}

export function dispatchNewtabSettingsDrawerFocusSection(section: SettingsDrawerSection): void {
  dispatchNewtabSettingsDrawerLayoutRequest('focus-section', { behavior: 'smooth', section })
}

export function dispatchNewtabSettingsDrawerScrollTop(behavior: ScrollBehavior = 'smooth'): void {
  dispatchNewtabSettingsDrawerLayoutRequest('scroll-top', { behavior })
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
