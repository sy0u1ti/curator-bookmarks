import { useSyncExternalStore } from 'react'
import type { NewTabContentView } from './content-state'

let newtabContentView: NewTabContentView | null = null

const listeners = new Set<() => void>()

function subscribeNewtabContent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitNewtabContentChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabContentView(view: NewTabContentView): void {
  newtabContentView = view
  emitNewtabContentChange()
}

export function useNewtabContentView(): NewTabContentView | null {
  return useSyncExternalStore(
    subscribeNewtabContent,
    () => newtabContentView,
    () => null
  )
}
