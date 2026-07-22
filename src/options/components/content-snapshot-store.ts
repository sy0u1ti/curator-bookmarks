import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { ContentSnapshotControlsState } from './content-snapshot-types.js'

const defaultContentSnapshotControlsState: ContentSnapshotControlsState = {
  enabled: false,
  fullTextDisabled: true,
  loading: true,
  saveFullText: false,
  statusCopy: '正在读取本地设置…'
}

const contentSnapshotControlsStore = createUiViewStoreSlice(
  'options',
  'content-snapshot-controls',
  defaultContentSnapshotControlsState
)

export function publishContentSnapshotControls(state: ContentSnapshotControlsState): void {
  contentSnapshotControlsStore.setState(state)
}

export function useContentSnapshotControlsState(): ContentSnapshotControlsState {
  return useUiViewStoreSlice(contentSnapshotControlsStore)
}
