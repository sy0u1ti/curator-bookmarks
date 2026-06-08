export const FOLDER_CLEANUP_ACTION_EVENT = 'options:folder-cleanup-action'

export type FolderCleanupAction = 'rescan'

export interface FolderCleanupActionDetail {
  action: FolderCleanupAction
}

export function dispatchFolderCleanupAction(action: FolderCleanupAction): void {
  window.dispatchEvent(new CustomEvent<FolderCleanupActionDetail>(FOLDER_CLEANUP_ACTION_EVENT, {
    detail: { action }
  }))
}
