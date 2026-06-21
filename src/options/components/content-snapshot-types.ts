export interface ContentSnapshotSettingsChangeDetail {
  enabled?: boolean
  saveFullText?: boolean
  syncFullTextSearch?: boolean
}

export interface ContentSnapshotControlsState {
  enabled: boolean
  fullTextDisabled: boolean
  saveFullText: boolean
  statusCopy: string
}
