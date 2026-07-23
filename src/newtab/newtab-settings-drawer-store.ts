import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
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

const EMPTY_VIEW: NewtabSettingsDrawerView = {
  activeGroup: 'source',
  open: false,
  saveMessage: '',
  saveState: 'idle'
}
const EMPTY_LAYOUT_REQUEST: NewtabSettingsDrawerLayoutRequest = {
  action: 'none',
  behavior: 'auto',
  requestId: 0,
  section: 'source'
}
const settingsDrawerStore = createUiViewStoreSlice('newtab', 'settings-drawer', EMPTY_VIEW)
const settingsDrawerLayoutStore = createUiViewStoreSlice(
  'newtab',
  'settings-drawer-layout',
  EMPTY_LAYOUT_REQUEST
)
let settingsDrawerActions: NewtabSettingsDrawerActions = EMPTY_ACTIONS
let settingsDrawerNodes: NewtabSettingsDrawerNodes = {
  backdrop: null,
  drawer: null,
  panel: null,
  trigger: null
}

const nodesListeners = new Set<() => void>()

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
  return useUiViewStoreSlice(settingsDrawerStore)
}

export function useNewtabSettingsDrawerOpen(): boolean {
  return useUiViewStoreSlice(settingsDrawerStore, (view) => view.open)
}

export function useNewtabSettingsDrawerLayoutRequest(): NewtabSettingsDrawerLayoutRequest {
  return useUiViewStoreSlice(settingsDrawerLayoutStore)
}

export function getNewtabSettingsDrawerView(): NewtabSettingsDrawerView {
  return settingsDrawerStore.getState()
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
  const settingsDrawerView = settingsDrawerStore.getState()
  if (settingsDrawerView.open === open) {
    return
  }
  settingsDrawerStore.setState({
    ...settingsDrawerView,
    open
  })
}

export function dispatchNewtabSettingsDrawerActiveGroup(group: SettingsDrawerSection): void {
  const settingsDrawerView = settingsDrawerStore.getState()
  if (settingsDrawerView.activeGroup === group) {
    return
  }
  settingsDrawerStore.setState({
    ...settingsDrawerView,
    activeGroup: group
  })
}

export function dispatchNewtabSettingsDrawerSaveStatus(
  saveState: NewtabSettingsSaveState,
  saveMessage: string
): void {
  const settingsDrawerView = settingsDrawerStore.getState()
  if (settingsDrawerView.saveState === saveState && settingsDrawerView.saveMessage === saveMessage) {
    return
  }
  settingsDrawerStore.setState({
    ...settingsDrawerView,
    saveMessage,
    saveState
  })
}

function dispatchNewtabSettingsDrawerLayoutRequest(
  action: NewtabSettingsDrawerLayoutAction,
  {
    behavior = 'smooth',
    section = settingsDrawerStore.getState().activeGroup
  }: {
    behavior?: ScrollBehavior
    section?: SettingsDrawerSection
  } = {}
): void {
  settingsDrawerLayoutStore.setState((request) => ({
    action,
    behavior,
    requestId: request.requestId + 1,
    section
  }))
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
