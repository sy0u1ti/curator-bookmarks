import { useSyncExternalStore } from 'react'
import type { TagManagementControlsState } from './tag-management-controls-types.js'

const defaultTagManagementControlsState: TagManagementControlsState = {
  focusTargetRequestId: 0,
  loading: false,
  manualTags: 0,
  sourceTag: '',
  status: '',
  taggedBookmarks: 0,
  targetTag: '',
  totalTags: 0
}

let currentTagManagementControlsState = defaultTagManagementControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): TagManagementControlsState {
  return currentTagManagementControlsState
}

export function publishTagManagementControls(state: Partial<TagManagementControlsState>): void {
  currentTagManagementControlsState = {
    ...currentTagManagementControlsState,
    ...state
  }
  listeners.forEach((listener) => listener())
}

export function patchTagManagementControlsForm({
  focusTarget = false,
  sourceTag,
  targetTag
}: {
  focusTarget?: boolean
  sourceTag?: string
  targetTag?: string
}): void {
  currentTagManagementControlsState = {
    ...currentTagManagementControlsState,
    focusTargetRequestId: focusTarget
      ? currentTagManagementControlsState.focusTargetRequestId + 1
      : currentTagManagementControlsState.focusTargetRequestId,
    sourceTag: typeof sourceTag === 'string' ? sourceTag : currentTagManagementControlsState.sourceTag,
    targetTag: typeof targetTag === 'string' ? targetTag : currentTagManagementControlsState.targetTag
  }
  listeners.forEach((listener) => listener())
}

export function useTagManagementControlsState(): TagManagementControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
