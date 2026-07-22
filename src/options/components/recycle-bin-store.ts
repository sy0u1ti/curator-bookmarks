import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { RecycleBinState } from './recycle-bin-types.js'

const defaultRecycleBinState: RecycleBinState = {
  disabled: false,
  entries: [],
  selectedIds: new Set()
}

const recycleBinStore = createUiViewStoreSlice(
  'options',
  'recycle-bin',
  defaultRecycleBinState
)

export function publishRecycleBin(state: RecycleBinState): void {
  recycleBinStore.setState(state)
}

export function useRecycleBinState(): RecycleBinState {
  return useUiViewStoreSlice(recycleBinStore)
}
