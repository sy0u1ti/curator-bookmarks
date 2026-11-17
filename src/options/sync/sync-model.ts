import { requestSync } from '../../shared/sync/sync-messages.js'
import {
  SYNC_TABS_ROOT,
  SYNC_STALE_MS,
  type SyncAdapterType,
  type SyncOAuthAdapterType,
  type SyncProfileInput,
  type SyncProfileView,
  type SyncSecretField,
  type SyncStrategy
} from '../../shared/sync/sync-contract.js'

export type SyncTextField =
  | 'url' | 'username' | 'password' | 'serverRoot' | 'serverFolder' | 'bookmark_file' | 'branch' | 'region' | 'bucket'

export interface SyncFieldSpec {
  key: SyncTextField
  label: string
  placeholder?: string
  secret?: boolean
}

export interface SyncAdapterSpec {
  label: string
  fields: SyncFieldSpec[]
  /** Bookmarks are one file on the server, which can be encrypted and has a format */
  file: boolean
  /** Which stored field holds the encryption passphrase, if the adapter encrypts */
  passphraseField?: SyncSecretField
  oauth?: SyncOAuthAdapterType
  /** The server may be asked to receive the browser's cookies and client certificate */
  clientCert: boolean
  /** The address may redirect, if the user allows it */
  redirects: boolean
  /** Offers a connection test before saving */
  testable: boolean
  /** What a new profile starts with */
  defaults: SyncProfileInput
}

const url = (label: string, placeholder = 'https://'): SyncFieldSpec => ({ key: 'url', label, placeholder })
const user = (label = '用户名'): SyncFieldSpec => ({ key: 'username', label })
const secret = (label = '密码'): SyncFieldSpec => ({ key: 'password', label, secret: true })
const file: SyncFieldSpec = { key: 'bookmark_file', label: '书签文件', placeholder: 'bookmarks.xbel' }
const FILE_DEFAULTS: SyncProfileInput = { bookmark_file: 'bookmarks.xbel', bookmark_file_type: 'xbel' }

export const SYNC_ADAPTERS: Record<SyncAdapterType, SyncAdapterSpec> = {
  'nextcloud-bookmarks': {
    label: 'Nextcloud Bookmarks',
    fields: [url('Nextcloud 地址'), user(), secret('应用密码'), { key: 'serverRoot', label: '服务器文件夹', placeholder: '/' }],
    file: false, clientCert: true, redirects: true, testable: true, defaults: { serverRoot: '' }
  },
  linkwarden: {
    label: 'Linkwarden',
    fields: [url('Linkwarden 地址'), user(), secret('访问令牌'), { key: 'serverFolder', label: '服务器集合', placeholder: 'Curator' }],
    file: false, clientCert: true, redirects: true, testable: true, defaults: { serverFolder: 'Curator', syncOrder: true }
  },
  karakeep: {
    label: 'Karakeep',
    fields: [url('Karakeep 地址'), secret('API Key'), { key: 'serverFolder', label: '服务器列表', placeholder: 'Curator' }],
    file: false, clientCert: true, redirects: true, testable: true, defaults: { serverFolder: 'Curator' }
  },
  webdav: {
    label: 'WebDAV',
    fields: [url('WebDAV 地址'), user(), secret(), file],
    file: true, passphraseField: 'passphrase', clientCert: true, redirects: true, testable: true, defaults: FILE_DEFAULTS
  },
  s3: {
    label: 'S3 兼容存储',
    fields: [
      url('服务地址', 'https://s3.amazonaws.com/'), { key: 'region', label: '区域', placeholder: 'us-east-1' },
      { key: 'bucket', label: '存储桶' }, user('Access Key'), secret('Secret Key'), file
    ],
    file: true, passphraseField: 'passphrase', clientCert: false, redirects: false, testable: true,
    defaults: { ...FILE_DEFAULTS, url: 'https://s3.amazonaws.com/', region: 'us-east-1', pathStyle: true }
  },
  git: {
    label: 'Git',
    fields: [url('仓库地址', 'https://example.org/repo.git'), user(), secret('密码或令牌'), { key: 'branch', label: '分支', placeholder: 'main' }, file],
    file: true, clientCert: true, redirects: true, testable: false, defaults: { ...FILE_DEFAULTS, branch: 'main' }
  },
  'google-drive': {
    label: 'Google Drive', fields: [file], file: false, passphraseField: 'password', oauth: 'google-drive',
    clientCert: false, redirects: false, testable: false, defaults: { bookmark_file: 'bookmarks.xbel' }
  },
  dropbox: {
    label: 'Dropbox', fields: [file], file: false, passphraseField: 'password', oauth: 'dropbox',
    clientCert: false, redirects: false, testable: false, defaults: { bookmark_file: 'bookmarks.xbel' }
  }
}

/** How a new profile behaves until the user says otherwise; the same as floccus' setup. */
export const SYNC_BEHAVIOR_DEFAULTS: SyncProfileInput = {
  enabled: true,
  syncOnStartupEnabled: false,
  syncIntervalEnabled: true,
  syncInterval: 15,
  notifyOnly: false,
  notificationsEnabled: false,
  strategy: 'default',
  nestedSync: true,
  failsafe: true
}

export const SYNC_DIRECTION_LABELS: Record<SyncStrategy, string> = {
  default: '双向合并',
  slave: '只下载',
  overwrite: '只上传'
}

/** The order services are offered in */
export const SYNC_ADAPTER_ORDER: SyncAdapterType[] = [
  'webdav', 'nextcloud-bookmarks', 's3', 'git', 'linkwarden', 'karakeep', 'google-drive', 'dropbox'
]

/** Server presets from floccus 5.13.0's NewAccount; editable after selection. */
export const WEBDAV_PRESETS: Record<string, string> = {
  '1&1 Online-Speicher': 'https://webdav.office.1und1.de/',
  blaucloud: 'https://{username}.blaucloud.de/remote.php/webdav/',
  Disroot: 'https://cloud.disroot.org/remote.php/webdav/',
  freenetcloud: 'https://webmail.freenet.de/webdav/',
  'GMX MediaCenter': 'https://webdav.mc.gmx.net/',
  'HiDrive IONOS': 'https://webdav.hidrive.ionos.com/',
  'HiDrive Strato': 'https://webdav.hidrive.strato.com/',
  IceDrive: 'https://webdav.icedrive.io/',
  kDrive: 'https://connect.drive.infomaniak.com/',
  Koofr: 'https://app.koofr.net/dav/Koofr/',
  MagentaCLOUD: 'https://magentacloud.de/remote.php/webdav/',
  'Mailbox.org': 'https://dav.mailbox.org/servlet/webdav.infostore/',
  'pCloud (EU)': 'https://ewebdav.pcloud.com/',
  'pCloud (US)': 'https://webdav.pcloud.com/',
  'WEB.DE Online-Speicher': 'https://webdav.smartdrive.web.de/'
}

const OAUTH_ORIGINS: Record<SyncOAuthAdapterType, string[]> = {
  'google-drive': ['https://oauth2.googleapis.com/*', 'https://www.googleapis.com/*'],
  dropbox: ['https://www.dropbox.com/*', 'https://api.dropboxapi.com/*', 'https://content.dropboxapi.com/*']
}

/**
 * Everything a profile needs the browser to allow. It is requested in one
 * prompt from the click that saves, tests or authorizes, because Chrome only
 * shows the prompt while that click is being handled.
 */
export function getSyncPermissions(data: SyncProfileInput): chrome.permissions.Permissions {
  const adapter = SYNC_ADAPTERS[data.type as SyncAdapterType]
  const origins: string[] = []
  const permissions: string[] = []
  if (adapter?.oauth) {
    origins.push(...OAUTH_ORIGINS[adapter.oauth])
    permissions.push('identity')
  } else if (adapter) {
    try {
      const server = new URL(String(data.url || ''))
      if (server.protocol === 'https:' || server.protocol === 'http:') {
        // Host permissions have no port. A virtual-hosted S3 bucket is
        // addressed as a subdomain of the endpoint.
        const host = data.type === 's3' && data.pathStyle === false && data.bucket
          ? `${data.bucket}.${server.hostname}`
          : server.hostname
        origins.push(`${server.protocol}//${host}/*`)
      }
    } catch {
      // The address is validated when the profile is saved
    }
  }
  if (data.localRoot === SYNC_TABS_ROOT) permissions.push('tabs', 'tabGroups')
  if (data.clickCountEnabled) permissions.push('history')
  return { origins, permissions: permissions as chrome.permissions.Permissions['permissions'] }
}

/** Must be called while the user's click is being handled; resolves to whether access was granted. */
export function requestSyncPermissions(data: SyncProfileInput): Promise<boolean> {
  return requestSyncProfilePermissions([data])
}

export function requestSyncProfilePermissions(profiles: SyncProfileInput[]): Promise<boolean> {
  const requests = profiles.map(getSyncPermissions)
  const permissions = {
    origins: [...new Set(requests.flatMap(request => request.origins || []))],
    permissions: [...new Set(requests.flatMap(request => request.permissions || []))]
  }
  if (!permissions.origins?.length && !permissions.permissions?.length) return Promise.resolve(true)
  return chrome.permissions.request(permissions)
}

/** The worker can return an empty list without evaluating the sync engine. */
export async function loadSyncProfiles(): Promise<SyncProfileView[]> {
  return sortSyncProfiles(await requestSync({ type: 'sync:list' }))
}

export type SyncProfileState =
  | 'syncing' | 'scheduled' | 'authorize' | 'folder' | 'error' | 'pending' | 'stale' | 'manual' | 'ok' | 'never'

export interface SyncProfileStatus {
  state: SyncProfileState
  text: string
  tone: 'neutral' | 'error' | 'warning'
  /** 0–1 while a sync runs */
  progress: number | null
}

/** What a profile shows when nothing needs attention; it sizes the status slot. */
export function getSyncRestingText(profile: SyncProfileView, formatTime: (timestamp: number) => string): string {
  const { data } = profile
  const last = data.lastSync ? `上次同步 ${formatTime(data.lastSync)}` : '尚未同步'
  return data.enabled || data.syncIntervalEnabled || data.syncOnStartupEnabled ? last : `${last} · 手动`
}

export function getSyncProfileStatus(profile: SyncProfileView, formatTime: (timestamp: number) => string, now = Date.now()): SyncProfileStatus {
  const { data } = profile
  const status = (state: SyncProfileState, text: string, tone: SyncProfileStatus['tone'] = 'neutral'): SyncProfileStatus =>
    ({ state, text, tone, progress: null })
  if (data.syncing) {
    const progress = typeof data.syncing === 'number' && Number.isFinite(data.syncing) ? Math.max(0, Math.min(1, data.syncing)) : null
    return { state: 'syncing', text: progress === null ? '正在同步' : progress >= 1 ? '正在完成' : `正在同步 ${Math.round(progress * 100)}%`, tone: 'neutral', progress }
  }
  if (data.scheduled) return status('scheduled', '等待同步')
  if (profile.needsAuthorization) return status('authorize', '需要连接账号', 'warning')
  if (!profile.localFolderExists) return status('folder', '本地文件夹不存在，请重新选择', 'warning')
  if (data.error) return status('error', data.error, 'error')
  if (data.pendingChanges) {
    return status('pending', data.pendingChanges.initial
      ? '尚未同步'
      : `待同步：下载 ${data.pendingChanges.local} 项，上传 ${data.pendingChanges.server} 项`, 'warning')
  }
  const automatic = data.enabled || data.syncIntervalEnabled || data.syncOnStartupEnabled
  if (automatic && data.lastSync && now - data.lastSync > SYNC_STALE_MS) {
    return status('stale', `已超过两天未同步 · ${formatTime(data.lastSync)}`, 'warning')
  }
  return status(!automatic ? 'manual' : data.lastSync ? 'ok' : 'never', getSyncRestingText(profile, formatTime))
}

/** Automatic profiles first; stable within each group while progress changes. */
export function sortSyncProfiles(profiles: SyncProfileView[]): SyncProfileView[] {
  const automatic = (profile: SyncProfileView) => Boolean(profile.data.enabled || profile.data.syncIntervalEnabled || profile.data.syncOnStartupEnabled)
  return [...profiles].sort((a, b) => Number(automatic(b)) - Number(automatic(a)))
}

/** A profile is named by what it syncs on this device; the server is its detail. */
export function getSyncProfileTitle(profile: SyncProfileView): string {
  if (profile.data.localRoot === SYNC_TABS_ROOT) return '标签页'
  return profile.folderPath.at(-1) || (profile.localFolderExists ? '全部书签' : '未选择文件夹')
}

export function formatSyncInterval(minutes: number): string {
  return minutes < 60 ? `${minutes} 分钟` : `${minutes / 60} 小时`
}

export interface SyncFolderOption {
  id: string
  path: string
}

/** Every bookmark folder as a path, in tree order */
export function listSyncFolders(tree: chrome.bookmarks.BookmarkTreeNode[]): SyncFolderOption[] {
  const folders: SyncFolderOption[] = []
  const visit = (node: chrome.bookmarks.BookmarkTreeNode, parents: string[]): void => {
    if (node.url) return
    const path = node.parentId === undefined ? parents : [...parents, node.title || '未命名文件夹']
    folders.push({ id: node.id, path: path.join(' / ') || '全部书签' })
    for (const child of node.children || []) visit(child, path)
  }
  for (const root of tree) visit(root, [])
  return folders
}
