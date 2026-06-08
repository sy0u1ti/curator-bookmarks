export const CONTENT_SNAPSHOT_SETTINGS_EVENT = 'options:content-snapshot-settings-change'

export interface ContentSnapshotSettingsChangeDetail {
  enabled?: boolean
  saveFullText?: boolean
  syncFullTextSearch?: boolean
}

export function dispatchContentSnapshotSettingsChange(detail: ContentSnapshotSettingsChangeDetail): void {
  window.dispatchEvent(new CustomEvent<ContentSnapshotSettingsChangeDetail>(CONTENT_SNAPSHOT_SETTINGS_EVENT, {
    detail
  }))
}
