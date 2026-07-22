import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { DuplicateGroupsState } from './duplicate-groups-types.js'

const defaultDuplicateGroupsState: DuplicateGroupsState = {
  catalogLoading: true,
  currentScopeFolderId: '',
  groups: [],
  locked: false,
  selectedIds: new Set(),
  selectionStats: {
    deleteCount: 0,
    groupCount: 0,
    keepCount: 0,
    unsafeGroupCount: 0
  },
  tagBadgeLabels: {}
}

const duplicateGroupsStore = createUiViewStoreSlice(
  'options',
  'duplicate-groups',
  defaultDuplicateGroupsState
)

export function publishDuplicateGroups(state: DuplicateGroupsState): void {
  duplicateGroupsStore.setState(state)
}

export function useDuplicateGroupsState(): DuplicateGroupsState {
  return useUiViewStoreSlice(duplicateGroupsStore)
}
