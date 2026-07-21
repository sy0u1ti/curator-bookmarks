import { useSyncExternalStore } from 'react'
import type { ContentSnapshotControlsState } from './content-snapshot-types.js'

const defaultContentSnapshotControlsState: ContentSnapshotControlsState = {
  enabled: false,
  fullTextDisabled: true,
  loading: true,
  saveFullText: false,
  statusCopy: '正在读取本地设置…'
}

let currentContentSnapshotControlsState = defaultContentSnapshotControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ContentSnapshotControlsState {
  return currentContentSnapshotControlsState
}

export function publishContentSnapshotControls(state: ContentSnapshotControlsState): void {
  currentContentSnapshotControlsState = state
  listeners.forEach((listener) => listener())
}

export function useContentSnapshotControlsState(): ContentSnapshotControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
