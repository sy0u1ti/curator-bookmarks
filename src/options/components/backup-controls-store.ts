import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { BackupControlsState } from './backup-controls-types.js'

const defaultBackupControlsState: BackupControlsState = {
  backup: {
    busy: false,
    hasBackup: false,
    preview: null,
    status: ''
  },
  tagData: {
    busy: false,
    countLabel: '0 条记录',
    hasRecords: false,
    status: '',
    updatedLabel: '尚未保存标签数据。'
  }
}

const backupControlsStore = createUiViewStoreSlice(
  'options',
  'backup-controls',
  defaultBackupControlsState
)

export function publishBackupControls(state: BackupControlsState): void {
  backupControlsStore.setState(state)
}

export function useBackupControlsState(): BackupControlsState {
  return useUiViewStoreSlice(backupControlsStore)
}
