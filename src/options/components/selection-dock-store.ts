import { useSyncExternalStore } from 'react'

export interface SelectionDockMetrics {
  left: number
  right: number
  bottom: number
  height: number
}

let currentMetrics: SelectionDockMetrics | null = null
const listeners = new Set<() => void>()

function sameMetrics(
  previous: SelectionDockMetrics | null,
  next: SelectionDockMetrics | null
): boolean {
  if (previous === next) return true
  if (!previous || !next) return false
  return (
    previous.left === next.left &&
    previous.right === next.right &&
    previous.bottom === next.bottom &&
    previous.height === next.height
  )
}

export function publishSelectionDockMetrics(next: SelectionDockMetrics | null): void {
  if (sameMetrics(currentMetrics, next)) return
  currentMetrics = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): SelectionDockMetrics | null {
  return currentMetrics
}

export function useSelectionDockMetrics(): SelectionDockMetrics | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
