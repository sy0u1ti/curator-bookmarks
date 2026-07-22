import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import type { SpeedDialPanelState } from './components/NewtabSpeedDialPanel'

export interface NewtabSpeedDialNodes {
  cards: Map<string, HTMLElement>
  cardIcons: Map<string, HTMLElement>
  grid: HTMLElement | null
}

const speedDialStore = createUiViewStoreSlice<SpeedDialPanelState | null>(
  'newtab',
  'speed-dial',
  null
)
let speedDialNodes: NewtabSpeedDialNodes = {
  cards: new Map(),
  cardIcons: new Map(),
  grid: null
}
export function dispatchNewtabSpeedDialView(view: SpeedDialPanelState | null): void {
  speedDialStore.setState(view ? { ...view } : null)
}

export function patchNewtabSpeedDialView(
  patcher: (view: SpeedDialPanelState) => SpeedDialPanelState
): void {
  const speedDialView = speedDialStore.getState()
  if (!speedDialView) {
    return
  }
  speedDialStore.setState(patcher(speedDialView))
}

export function getNewtabSpeedDialView(): SpeedDialPanelState | null {
  return speedDialStore.getState()
}

export function setNewtabSpeedDialGridNode(grid: HTMLElement | null): void {
  if (speedDialNodes.grid === grid) {
    return
  }
  speedDialNodes = {
    ...speedDialNodes,
    grid
  }
}

export function setNewtabSpeedDialCardNode(bookmarkId: string, element: HTMLElement | null): void {
  speedDialNodes = setSpeedDialNodeMapEntry(speedDialNodes, 'cards', bookmarkId, element)
}

export function setNewtabSpeedDialCardIconNode(bookmarkId: string, element: HTMLElement | null): void {
  speedDialNodes = setSpeedDialNodeMapEntry(speedDialNodes, 'cardIcons', bookmarkId, element)
}

function setSpeedDialNodeMapEntry(
  nodes: NewtabSpeedDialNodes,
  key: 'cards' | 'cardIcons',
  bookmarkId: string,
  element: HTMLElement | null
): NewtabSpeedDialNodes {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return nodes
  }

  const currentElement = nodes[key].get(normalizedBookmarkId) || null
  if (currentElement === element) {
    return nodes
  }

  const nextMap = new Map(nodes[key])
  if (element) {
    nextMap.set(normalizedBookmarkId, element)
  } else {
    nextMap.delete(normalizedBookmarkId)
  }
  return {
    ...nodes,
    [key]: nextMap
  }
}

export function getNewtabSpeedDialNodes(): NewtabSpeedDialNodes {
  return speedDialNodes
}

export function useNewtabSpeedDialView(): SpeedDialPanelState | null {
  return useUiViewStoreSlice(speedDialStore)
}
