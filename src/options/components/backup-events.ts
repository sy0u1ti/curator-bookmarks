import type { BackupRestoreMode } from '../../shared/backup.js'

export const BACKUP_ACTION_EVENT = 'options:backup-action'

export type BackupAction =
  | 'export-backup'
  | 'export-tags'
  | 'clear-tags'
  | 'import-backup'
  | 'import-tags'
  | 'restore'

export interface BackupActionDetail {
  action: BackupAction
  file?: File
  mode?: BackupRestoreMode
}

export function dispatchBackupAction(detail: BackupActionDetail): void {
  window.dispatchEvent(new CustomEvent<BackupActionDetail>(BACKUP_ACTION_EVENT, {
    detail
  }))
}
