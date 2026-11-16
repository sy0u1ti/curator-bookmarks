export const SYNC_ADAPTER_TYPES = [
  'nextcloud-bookmarks',
  'linkwarden',
  'karakeep',
  'webdav',
  's3',
  'git',
  'google-drive',
  'dropbox'
] as const

export type SyncAdapterType = typeof SYNC_ADAPTER_TYPES[number]
export type SyncOAuthAdapterType = 'google-drive' | 'dropbox'
export type SyncStrategy = 'default' | 'slave' | 'overwrite'
export type SyncRunMode = 'normal' | 'download' | 'upload' | 'force'

export const SYNC_STORAGE_PREFIX = 'curatorSync:'
export const SYNC_ACCOUNTS_STORAGE_KEY = `${SYNC_STORAGE_PREFIX}accounts`
export const SYNC_CHECK_ALARM = 'curator-sync-check'
export const SYNC_PENDING_NOTIFICATION_PREFIX = 'curator-sync-pending-'

// A sync holds this lock shared; a backup restore takes it exclusively, so the
// two never rewrite the bookmark tree at the same time.
export const SYNC_RUN_LOCK = 'curator:bookmark-sync-run'

export const SYNC_TABS_ROOT = 'tabs'
export const SYNC_STALE_MS = 2 * 24 * 60 * 60 * 1000

export const SYNC_SECRET_FIELDS = ['password', 'passphrase', 'refreshToken'] as const
export type SyncSecretField = typeof SYNC_SECRET_FIELDS[number]

export const SYNC_INTERVAL_MINUTES = [5, 10, 15, 20, 25, 30, 45, 60, 120, 180, 240, 360, 480, 720, 960, 1440] as const

export interface SyncPendingChanges {
  local: number
  server: number
  initial?: boolean
}

export interface SyncProfileData {
  type: SyncAdapterType
  label?: string
  localRoot?: string | null
  enabled?: boolean
  syncOnStartupEnabled?: boolean
  syncIntervalEnabled?: boolean
  syncInterval?: number
  notifyOnly?: boolean
  notificationsEnabled?: boolean
  strategy?: SyncStrategy
  nestedSync?: boolean
  syncOrder?: boolean
  failsafe?: boolean
  url?: string
  username?: string
  serverRoot?: string
  serverFolder?: string
  clickCountEnabled?: boolean
  includeCredentials?: boolean
  allowRedirects?: boolean
  bookmark_file?: string
  bookmark_file_type?: 'xbel' | 'html'
  branch?: string
  region?: string
  bucket?: string
  pathStyle?: boolean
  syncing?: number | boolean
  scheduled?: boolean | SyncStrategy
  error?: string | null
  lastSync?: number
  pendingChanges?: SyncPendingChanges | null
  rootPath?: string
}

export type SyncProfileSecrets = Partial<Record<SyncSecretField, string | null>>
export type SyncProfileInput = Partial<SyncProfileData> & SyncProfileSecrets

export interface SyncProfileView {
  id: string
  /** How the server adapter names this profile, e.g. `user@host` */
  label: string
  /** Titles from the bookmark root down to the local folder; empty for tabs or a missing folder */
  folderPath: string[]
  localFolderExists: boolean
  needsAuthorization: boolean
  /** Which secrets are stored. Their values never leave the service worker. */
  secrets: Record<SyncSecretField, boolean>
  data: SyncProfileData
}

export interface SyncOAuthClient {
  clientId: string
  /** Omitted to keep the stored secret */
  clientSecret?: string
}

export interface SyncOAuthSettings {
  /** Shown only for an explicitly selected custom OAuth client. */
  redirectUrl: string
  clients: Record<SyncOAuthAdapterType, {
    clientId: string
    hasSecret: boolean
    available: boolean
    source: 'bundled' | 'custom' | 'none'
  }>
}

export interface SyncImportResult {
  ids: string[]
  /** The first imported profile that cannot sync before the user completes it */
  incomplete: { id: string; reason: 'authorization' | 'folder' } | null
}

export interface SyncEngineHost {
  /** Called just before a sync creates a bookmark in the browser */
  onLocalBookmarkCreate(details: { parentId?: string; url?: string; title?: string }): void
  /** Extension-relative icon for system notifications */
  notificationIcon: string
  /** Called under the sync/restore lock before any server-wins bookmark run. */
  beforeLocalOverwrite(profileLabel: string): Promise<void>
}

export interface SyncEngine {
  start(host: SyncEngineHost): Promise<void>
  listProfiles(): Promise<SyncProfileView[]>
  createProfile(data: SyncProfileInput): Promise<string>
  updateProfile(id: string, data: SyncProfileInput): Promise<void>
  deleteProfile(id: string): Promise<void>
  resetProfile(id: string): Promise<void>
  exportProfiles(ids: string[]): Promise<unknown[]>
  importProfiles(profiles: unknown): Promise<SyncImportResult>
  testConnection(data: SyncProfileInput, id?: string): Promise<void>
  getOAuthSettings(): Promise<SyncOAuthSettings>
  authorize(type: SyncOAuthAdapterType, client?: SyncOAuthClient): Promise<{ refreshToken: string; username: string }>
  getLogs(anonymous: boolean): Promise<string[]>
  clearLogs(): Promise<void>
  requestSync(id: string, mode: SyncRunMode): Promise<void>
  sync(id: string, mode: SyncRunMode): Promise<void>
  syncAll(): Promise<void>
  cancel(id: string): Promise<void>
  onLocalChange(localId: string): Promise<void>
  onTabsChange(): Promise<void>
  onStartup(): Promise<void>
  onVisit(url: string): Promise<void>
  checkSchedule(networkRestored?: boolean): Promise<void>
}
