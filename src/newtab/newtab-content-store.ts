import {
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
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

let newtabContentView: NewTabContentView | null = null
let newtabContentLayoutNodes: NewtabContentLayoutNodes = createEmptyNewtabContentLayoutNodes()
let newtabContentShellActions: NewtabContentShellActions = EMPTY_SHELL_ACTIONS

const listeners = new Set<() => void>()
const layoutNodeListeners = new Set<() => void>()

function subscribeNewtabContent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitNewtabContentChange(): void {
  listeners.forEach((listener) => listener())
}

function emitNewtabContentLayoutNodesChange(): void {
  layoutNodeListeners.forEach((listener) => listener())
}

export function dispatchNewtabContentView(view: NewTabContentView): void {
  newtabContentView = view
  emitNewtabContentChange()
}

export function patchNewtabContentView(
  patcher: (view: NewTabContentView) => NewTabContentView
): void {
  if (!newtabContentView) {
    return
  }
  newtabContentView = patcher(newtabContentView)
  emitNewtabContentChange()
}

export function getNewtabContentView(): NewTabContentView | null {
  return newtabContentView
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
  return useSyncExternalStore(
    subscribeNewtabContent,
    () => newtabContentView,
    () => null
  )
}
