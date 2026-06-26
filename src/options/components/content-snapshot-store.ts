import { useSyncExternalStore } from 'react'
import type { ContentSnapshotControlsState } from './content-snapshot-types.js'

const defaultContentSnapshotControlsState: ContentSnapshotControlsState = {
  enabled: false,
  fullTextDisabled: true,
  saveFullText: false,
  statusCopy: '网页内容索引已关闭。'
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
