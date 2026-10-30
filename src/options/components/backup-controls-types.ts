import type {
  BackupRestoreMode,
  BackupRestorePreview
} from '../../shared/backup.js'
import type { ActionFeedback } from '../../shared/action-feedback.js'

export type BackupAction =
  | 'export-backup'
  | 'export-html'
  | 'preview-auto-backup'
  | 'export-tags'
  | 'clear-tags'
  | 'import-backup'
  | 'import-tags'
  | 'restore'

export interface BackupActionDetail {
  action: BackupAction
  file?: File
  backupId?: string
  mode?: BackupRestoreMode
}

export interface BackupPreviewState {
  preview: BackupRestorePreview | null
}

export interface BackupControlsState {
  backup: {
    busy: boolean
    exportFeedback: ActionFeedback
    htmlExportFeedback: ActionFeedback
    hasBackup: boolean
    preview: BackupRestorePreview | null
    status: string
  }
  tagData: {
    busy: boolean
    exportFeedback: ActionFeedback
    countLabel: string
    hasRecords: boolean
    status: string
    updatedLabel: string
  }
}
