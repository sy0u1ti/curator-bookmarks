import { useSyncExternalStore } from 'react'
import type { SpeedDialPanelState } from './components/NewtabSpeedDialPanel'

export interface NewtabSpeedDialNodes {
  cards: Map<string, HTMLElement>
  cardIcons: Map<string, HTMLElement>
  grid: HTMLElement | null
}

let speedDialView: SpeedDialPanelState | null = null
let speedDialNodes: NewtabSpeedDialNodes = {
  cards: new Map(),
  cardIcons: new Map(),
  grid: null
}
const listeners = new Set<() => void>()

function subscribeNewtabSpeedDial(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitNewtabSpeedDialChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabSpeedDialView(view: SpeedDialPanelState | null): void {
  speedDialView = view ? { ...view } : null
  emitNewtabSpeedDialChange()
}

export function patchNewtabSpeedDialView(
  patcher: (view: SpeedDialPanelState) => SpeedDialPanelState
): void {
  if (!speedDialView) {
    return
  }
  speedDialView = patcher(speedDialView)
  emitNewtabSpeedDialChange()
}

export function getNewtabSpeedDialView(): SpeedDialPanelState | null {
  return speedDialView
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
  return useSyncExternalStore(
    subscribeNewtabSpeedDial,
    () => speedDialView,
    () => null
  )
}
