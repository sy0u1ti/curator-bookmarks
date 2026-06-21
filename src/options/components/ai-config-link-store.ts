import { useSyncExternalStore } from 'react'

export interface AiConfigLinkState {
  configured: boolean
}

const defaultAiConfigLinkState: AiConfigLinkState = {
  configured: false
}

let currentAiConfigLinkState = defaultAiConfigLinkState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): AiConfigLinkState {
  return currentAiConfigLinkState
}

export function publishAiConfigLinkState(state: AiConfigLinkState): void {
  currentAiConfigLinkState = {
    configured: Boolean(state.configured)
  }
  listeners.forEach((listener) => listener())
}

export function useAiConfigLinkState(): AiConfigLinkState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
