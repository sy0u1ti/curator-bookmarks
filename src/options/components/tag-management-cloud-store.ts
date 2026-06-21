import { useSyncExternalStore } from 'react'
import type { BookmarkTagUsageStat } from '../../shared/tag-management.js'

export interface TagManagementCloudState {
  stats: BookmarkTagUsageStat[]
}

const defaultTagManagementCloudState: TagManagementCloudState = {
  stats: []
}

let currentTagManagementCloudState = defaultTagManagementCloudState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): TagManagementCloudState {
  return currentTagManagementCloudState
}

export function publishTagManagementCloud(state: TagManagementCloudState): void {
  currentTagManagementCloudState = state
  listeners.forEach((listener) => listener())
}

export function useTagManagementCloudState(): TagManagementCloudState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
