import { useSyncExternalStore } from 'react'
import type { ShortcutControlsState } from './shortcut-types.js'

const defaultShortcutControlsState: ShortcutControlsState = {
  detail: '',
  list: { kind: 'loading' },
  loading: true,
  statusLabel: '读取中',
  statusTone: 'muted'
}

let currentShortcutControlsState = defaultShortcutControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ShortcutControlsState {
  return currentShortcutControlsState
}

export function publishShortcutControls(state: ShortcutControlsState): void {
  currentShortcutControlsState = state
  listeners.forEach((listener) => listener())
}

export function useShortcutControlsState(): ShortcutControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
