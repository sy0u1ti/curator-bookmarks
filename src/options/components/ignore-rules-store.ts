import { useSyncExternalStore } from 'react'
import type { IgnoreRulesState } from './ignore-rules-types.js'

const defaultIgnoreRulesState: IgnoreRulesState = {
  bookmarks: [],
  domains: [],
  folders: []
}

let currentIgnoreRulesState = defaultIgnoreRulesState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): IgnoreRulesState {
  return currentIgnoreRulesState
}

export function publishIgnoreRules(state: IgnoreRulesState): void {
  currentIgnoreRulesState = state
  listeners.forEach((listener) => listener())
}

export function useIgnoreRulesState(): IgnoreRulesState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
