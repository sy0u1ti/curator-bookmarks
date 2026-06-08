import { useSyncExternalStore } from 'react'
import type { SpeedDialPanelState } from './components/NewtabSpeedDialPanel'

let speedDialView: SpeedDialPanelState | null = null
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

export function getNewtabSpeedDialView(): SpeedDialPanelState | null {
  return speedDialView
}

export function useNewtabSpeedDialView(): SpeedDialPanelState | null {
  return useSyncExternalStore(
    subscribeNewtabSpeedDial,
    () => speedDialView,
    () => null
  )
}
