import { useSyncExternalStore } from 'react'
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

let currentBackupControlsState = defaultBackupControlsState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): BackupControlsState {
  return currentBackupControlsState
}

export function publishBackupControls(state: BackupControlsState): void {
  currentBackupControlsState = state
  listeners.forEach((listener) => listener())
}

export function useBackupControlsState(): BackupControlsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
