import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import type { NewTabContentView } from './content-state'

export interface NewtabContentLayoutNodes {
  page: HTMLElement | null
  primaryContent: HTMLElement | null
  primarySlot: HTMLElement | null
  shell: HTMLElement | null
  utilityStack: HTMLElement | null
}

export interface NewtabContentShellActions {
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void
  onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => void
}

const EMPTY_SHELL_ACTIONS: NewtabContentShellActions = {
  onContextMenu: () => {},
  onPointerDownCapture: () => {}
}

const newtabContentStore = createUiViewStoreSlice<NewTabContentView | null>(
  'newtab',
  'content',
  null
)
let newtabContentLayoutNodes: NewtabContentLayoutNodes = createEmptyNewtabContentLayoutNodes()
let newtabContentShellActions: NewtabContentShellActions = EMPTY_SHELL_ACTIONS

const layoutNodeListeners = new Set<() => void>()

function emitNewtabContentLayoutNodesChange(): void {
  layoutNodeListeners.forEach((listener) => listener())
}

export function dispatchNewtabContentView(view: NewTabContentView): void {
  newtabContentStore.setState(view)
}

export function patchNewtabContentView(
  patcher: (view: NewTabContentView) => NewTabContentView
): void {
  const newtabContentView = newtabContentStore.getState()
  if (!newtabContentView) {
    return
  }
  newtabContentStore.setState(patcher(newtabContentView))
}

export function getNewtabContentView(): NewTabContentView | null {
  return newtabContentStore.getState()
}

export function registerNewtabContentShellActions(actions: NewtabContentShellActions): () => void {
  newtabContentShellActions = actions
  return () => {
    if (newtabContentShellActions === actions) {
      newtabContentShellActions = EMPTY_SHELL_ACTIONS
    }
  }
}

export function dispatchNewtabContentShellContextMenu(
  event: ReactMouseEvent<HTMLDivElement>
): void {
  newtabContentShellActions.onContextMenu(event)
}

export function dispatchNewtabContentShellPointerDownCapture(
  event: ReactPointerEvent<HTMLDivElement>
): void {
  newtabContentShellActions.onPointerDownCapture(event)
}

export function createEmptyNewtabContentLayoutNodes(): NewtabContentLayoutNodes {
  return {
    page: null,
    primaryContent: null,
    primarySlot: null,
    shell: null,
    utilityStack: null
  }
}

export function setNewtabContentLayoutNodes(nodes: NewtabContentLayoutNodes): void {
  newtabContentLayoutNodes = { ...nodes }
  emitNewtabContentLayoutNodesChange()
}

export function setNewtabContentShellNode(shell: HTMLElement | null): void {
  if (newtabContentLayoutNodes.shell === shell) {
    return
  }
  newtabContentLayoutNodes = {
    ...newtabContentLayoutNodes,
    shell
  }

  if (typeof window !== 'undefined') {
    window.queueMicrotask(emitNewtabContentLayoutNodesChange)
    return
  }

  emitNewtabContentLayoutNodesChange()
}

export function getNewtabContentLayoutNodes(): NewtabContentLayoutNodes {
  return newtabContentLayoutNodes
}

export function subscribeNewtabContentLayoutNodes(listener: () => void): () => void {
  layoutNodeListeners.add(listener)
  return () => {
    layoutNodeListeners.delete(listener)
  }
}

export function useNewtabContentView(): NewTabContentView | null {
  return useUiViewStoreSlice(newtabContentStore)
}
