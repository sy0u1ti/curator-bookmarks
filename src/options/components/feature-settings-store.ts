import { useSyncExternalStore } from 'react'
import type { FeatureSettingsControlsState } from './feature-settings-types.js'

const defaultFeatureSettingsControlsState: FeatureSettingsControlsState = {
  switches: []
}

let currentFeatureSettingsControlsState = defaultFeatureSettingsControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): FeatureSettingsControlsState {
  return currentFeatureSettingsControlsState
}

export function publishFeatureSettingsControls(state: FeatureSettingsControlsState): void {
  currentFeatureSettingsControlsState = state
  listeners.forEach((listener) => listener())
}

export function useFeatureSettingsControlsState(): FeatureSettingsControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
