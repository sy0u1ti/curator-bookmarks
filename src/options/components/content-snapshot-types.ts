export interface ContentSnapshotSettingsChangeDetail {
  enabled?: boolean
  saveFullText?: boolean
  syncFullTextSearch?: boolean
}

export interface ContentSnapshotControlsState {
  enabled: boolean
  fullTextDisabled: boolean
  loading: boolean
  saveFullText: boolean
  statusCopy: string
}
