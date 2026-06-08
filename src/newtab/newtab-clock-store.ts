import { useSyncExternalStore } from 'react'
import type { NewTabTimeSettings } from './time-settings'

export interface NewtabClockView {
  ariaLabel: string
  dateDateTime: string
  dateText: string
  periodText: string
  settings: NewTabTimeSettings
  timeDateTime: string
  timeText: string
}

let clockView: NewtabClockView | null = null
const listeners = new Set<() => void>()

function subscribeNewtabClock(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitNewtabClockChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabClockView(view: NewtabClockView | null): void {
  clockView = view ? { ...view } : null
  emitNewtabClockChange()
}

export function useNewtabClockView(): NewtabClockView | null {
  return useSyncExternalStore(
    subscribeNewtabClock,
    () => clockView,
    () => null
  )
}
