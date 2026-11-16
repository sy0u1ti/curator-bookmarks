/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * The one entry point through which Curator uses floccus' sync engine. It runs
 * in the service worker; Curator's pages reach it through messages. A listed
 * profile says which secrets it has, not what they are; only an export the
 * user asks for contains them, as it does in floccus.
 *
 * The profile operations follow floccus' src/ui/store/actions.js.
 */
import browser, { setLocalBookmarkCreateObserver } from '../src/lib/browser-api'
import Account from '../src/lib/Account'
import AdapterFactory from '../src/lib/AdapterFactory'
import Logger from '../src/lib/Logger'
import PathHelper from '../src/lib/PathHelper'
import BrowserTree from '../src/lib/browser/BrowserTree'
import BrowserAccountStorage from '../src/lib/browser/BrowserAccountStorage'
import { isOAuthAccount, needsAuthorization } from '../src/lib/AccountAuthorization'
import type { IAccountData } from '../src/lib/interfaces/AccountStorage'
import SyncController from './SyncController'
import { authorizeOAuth } from './oauth'
import { bundledOAuth, oauthClientReady } from './oauth-config'
import { dropboxCredentials, googleCredentials } from './shims/oauth-credentials'
import {
  SYNC_ADAPTER_TYPES,
  SYNC_SECRET_FIELDS,
  type SyncAdapterType,
  type SyncEngine,
  type SyncEngineHost,
  type SyncImportResult,
  type SyncOAuthAdapterType,
  type SyncOAuthClient,
  type SyncOAuthSettings,
  type SyncProfileInput,
  type SyncProfileView,
  type SyncRunMode,
} from '../../../shared/sync/sync-contract'

declare const chrome: any

const OAUTH_CLIENTS_ENTRY = 'oauthClients'

// floccus' adapters fall back to example values (`bob`, `s3cret`) for whatever a
// profile leaves out. Its setup wizard always fills these in; so does this.
const BLANK_CREDENTIALS = { username: '', password: '' }

const STRING_FIELDS = [
  'label', 'url', 'username', 'serverRoot', 'serverFolder', 'bookmark_file', 'branch', 'region', 'bucket',
] as const
const BOOLEAN_FIELDS = [
  'enabled', 'syncOnStartupEnabled', 'syncIntervalEnabled', 'notifyOnly', 'notificationsEnabled', 'nestedSync',
  'failsafe', 'clickCountEnabled', 'includeCredentials', 'allowRedirects', 'pathStyle', 'syncOrder',
] as const
const STRATEGIES = ['default', 'slave', 'overwrite']
const FILE_TYPES = ['xbel', 'html']

const LOGGED_URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>\\)\]]+/gi
const LOGGED_TEXT_FIELD = /"(title|url|label|username|rootPath|serverRoot|serverFolder|bookmark_file)":\s*"(?:[^"\\]|\\.)*"/g
const LOGGED_TAGS = /"tags":\s*\[[^\]]*\]/g
const LOGGED_PROFILE = /((?:for account|Checking account) ).*?(?= for pending changes|: (?:null|\{)|$)/
const LOGGED_QUOTED = /“[^”]*”/g
const LOGGED_SECRET_FIELD = /"(password|passphrase|refreshToken|refresh_token|access_token|client_secret|authorization)":\s*"(?:[^"\\]|\\.)*"/gi

/**
 * floccus' Logger.anonymizeLogs hashes `[title](url)`, the form an item is
 * logged in by inspect(), and replaces the first address of a line. Actions
 * and trees are logged as JSON, which keeps every title and all but the first
 * address readable, and a profile is logged by its name, which is the user
 * name and server unless one was given. A log that is offered as redacted has
 * to cover those too.
 */
function redactLogLine(line: string, known: string[]): string {
  let redacted = line
    .replace(LOGGED_TEXT_FIELD, '"$1":"###"')
    .replace(LOGGED_TAGS, '"tags":[]')
    .replace(LOGGED_PROFILE, '$1###')
    .replace(LOGGED_URL, '###url###')
  if (/E0\d\d：/.test(redacted)) {
    // Error messages quote the folder, file or bucket they are about
    redacted = redacted.replace(LOGGED_QUOTED, '“###”')
  }
  for (const text of known) {
    redacted = redacted.split(text).join('###')
  }
  return redacted
}

/** What the current profiles are called and where they point, longest first */
async function knownProfileTexts(): Promise<string[]> {
  const texts = new Set<string>()
  for (const account of await Account.getAllAccounts()) {
    const data = account.getData()
    for (const value of [data.label, data.username, data.bucket, data.bookmark_file, data.serverRoot, data.serverFolder]) {
      if (typeof value === 'string') texts.add(value)
    }
    try {
      texts.add(new URL(data.url).host)
      texts.add(account.getLabel())
    } catch (e) {
      // No address to hide
    }
  }
  return [...texts].filter(text => text.length >= 3).sort((a, b) => b.length - a.length)
}

let controller: SyncController | null = null
let authorizing = false

function getController(): SyncController {
  if (!controller) {
    throw new Error('The sync engine has not been started')
  }
  return controller
}

function isAdapterType(type: unknown): type is SyncAdapterType {
  return (SYNC_ADAPTER_TYPES as readonly unknown[]).includes(type)
}

/**
 * Only what a profile's settings may contain. Where a sync got to and how it
 * went is the engine's own bookkeeping and never comes from outside.
 */
function pickSettings(input: SyncProfileInput): IAccountData {
  const source = (input || {}) as Record<string, unknown>
  const data: IAccountData = {}
  for (const field of STRING_FIELDS) {
    if (typeof source[field] === 'string') {
      data[field] = (source[field] as string).trim()
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    if (typeof source[field] === 'boolean') {
      data[field] = source[field]
    }
  }
  if (typeof source.localRoot === 'string' && source.localRoot) {
    data.localRoot = source.localRoot
  }
  if (STRATEGIES.includes(source.strategy as string)) {
    data.strategy = source.strategy as IAccountData['strategy']
  }
  if (FILE_TYPES.includes(source.bookmark_file_type as string)) {
    data.bookmark_file_type = source.bookmark_file_type
  }
  const interval = Number(source.syncInterval)
  if (Number.isFinite(interval) && interval >= 1) {
    data.syncInterval = Math.round(interval)
  }
  // A secret that isn't sent stays as it is stored
  if (typeof source.password === 'string') {
    data.password = source.password
  }
  if (typeof source.passphrase === 'string') {
    data.passphrase = source.passphrase
  }
  if (typeof source.refreshToken === 'string' || source.refreshToken === null) {
    data.refreshToken = source.refreshToken
  }
  return data
}

function requireUrl(data: IAccountData): void {
  let url: URL
  try {
    url = new URL(String(data.url || ''))
  } catch (e) {
    throw new Error('请填写有效的服务器地址。')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('服务器地址需要以 http:// 或 https:// 开头。')
  }
}

function validateSettings(data: IAccountData): void {
  if (!isOAuthAccount(data)) {
    requireUrl(data)
  }
  if ('bookmark_file' in data) {
    const file = String(data.bookmark_file || '')
    if (!file || file.startsWith('/') || file.endsWith('/')) {
      throw new Error('书签文件路径不能为空，也不能以“/”开头或结尾。')
    }
    if (isOAuthAccount(data) && file.includes('/')) {
      throw new Error('书签文件名不能包含“/”。')
    }
  }
  if (data.type === 's3' && (!data.bucket || String(data.bucket).includes('/'))) {
    throw new Error('请填写存储桶名称，且不能包含“/”。')
  }
  if (data.type === 'webdav' && /\{[^}]+\}/.test(String(data.url || ''))) {
    throw new Error('请把服务地址中的占位符替换为你的账号。')
  }
  const serverRoot = String(data.serverRoot || '')
  if (serverRoot && serverRoot !== '/' && (!serverRoot.startsWith('/') || serverRoot.endsWith('/'))) {
    throw new Error('服务器文件夹需要以“/”开头，且不能以“/”结尾。')
  }
}

async function describe(account: Account): Promise<SyncProfileView> {
  const data = { ...account.getData() }
  const secrets = { password: false, passphrase: false, refreshToken: false }
  for (const field of SYNC_SECRET_FIELDS) {
    secrets[field] = Boolean(data[field])
    delete data[field]
  }
  const isTabs = data.localRoot === 'tabs'
  const localFolderExists = isTabs || (await BrowserTree.folderExists(data.localRoot))
  let folderPath: string[] = []
  if (!isTabs && localFolderExists) {
    folderPath = PathHelper.pathToArray(await BrowserTree.getPathFromLocalId(data.localRoot)).filter(Boolean)
  }
  let label = data.label || data.type
  try {
    label = account.getLabel()
  } catch (e) {
    // An imported profile may carry an address no adapter can make a name of
  }
  return {
    id: account.id,
    label,
    folderPath,
    localFolderExists,
    needsAuthorization: needsAuthorization(account.getData()),
    secrets,
    data: data as SyncProfileView['data'],
  }
}

async function loadCustomOAuthClients(): Promise<Record<string, SyncOAuthClient>> {
  const stored = await browser.storage.local.get(OAUTH_CLIENTS_ENTRY)
  const clients = stored[OAUTH_CLIENTS_ENTRY]
  if (!clients || typeof clients !== 'object') return {}
  return Object.fromEntries(['google-drive', 'dropbox'].flatMap(type => {
    const client = clients[type]
    if (!client || typeof client.clientId !== 'string' || !client.clientId.trim()) return []
    return [[type, {
      clientId: client.clientId.trim(),
      ...(typeof client.clientSecret === 'string' ? { clientSecret: client.clientSecret.trim() } : {}),
    }]]
  }))
}

async function loadOAuthClients(): Promise<Record<string, SyncOAuthClient>> {
  return { ...bundledOAuth.clients, ...await loadCustomOAuthClients() }
}

function applyOAuthClients(clients: Record<string, SyncOAuthClient>): void {
  googleCredentials.web.client_id = clients['google-drive']?.clientId || ''
  googleCredentials.web.client_secret = clients['google-drive']?.clientSecret || ''
  dropboxCredentials.web.client_id = clients.dropbox?.clientId || ''
}

async function testConnection(input: SyncProfileInput, id?: string): Promise<void> {
  let data: IAccountData = { type: input?.type, ...pickSettings(input) }
  if (id) {
    // Test with the stored secrets where the form left them untouched
    const stored = (await Account.get(id)).getData()
    data = { ...stored, ...data, type: stored.type }
  }
  if (!isAdapterType(data.type)) {
    throw new Error('不支持的同步方式。')
  }
  if (isOAuthAccount(data) || data.type === 'git') {
    return
  }
  requireUrl(data)
  const url = String(data.url)
  if (data.type === 's3') {
    const S3Adapter = (await import('../src/lib/adapters/S3')).default
    await new S3Adapter({ ...S3Adapter.getDefaultValues(), ...data } as any).testConnection()
    return
  }
  let response: Response
  const requestOptions: RequestInit = {
    credentials: data.includeCredentials ? 'include' : 'omit',
    redirect: data.allowRedirects ? 'follow' : 'error',
    signal: AbortSignal.timeout(15000)
  }
  const basicAuth = () => 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(`${data.username || ''}:${data.password || ''}`)))
  if (data.type === 'webdav') {
    response = await fetch(url, {
      ...requestOptions,
      method: 'PROPFIND',
      headers: {
        Depth: '0',
        Authorization: basicAuth(),
      },
    })
    if (response.status < 200 || response.status > 299) {
      throw new Error(`无法连接 WebDAV 服务器：对 PROPFIND 请求返回了 HTTP ${response.status}。`)
    }
    return
  }
  const base = url.replace(/\/+$/, '')
  if (data.type === 'nextcloud-bookmarks') {
    response = await fetch(`${base}/index.php/apps/bookmarks/public/rest/v2/bookmark?page=0&limit=1`, {
      ...requestOptions, headers: { Authorization: basicAuth() }
    })
  } else {
    response = await fetch(`${base}${data.type === 'linkwarden' ? '/api/v1/collections' : '/api/v1/lists'}`, {
      ...requestOptions,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + (data.password || '') },
    })
  }
  if (response.status !== 200) {
    throw new Error(`无法连接服务器：返回了 HTTP ${response.status}。`)
  }
}

const engine: SyncEngine = {
  async start(engineHost: SyncEngineHost): Promise<void> {
    setLocalBookmarkCreateObserver(details => engineHost.onLocalBookmarkCreate(details))
    applyOAuthClients(await loadOAuthClients())
    controller = new SyncController(engineHost)
    await controller.onLoad()
  },

  async listProfiles(): Promise<SyncProfileView[]> {
    const accounts = await Account.getAllAccounts()
    return Promise.all(accounts.map(describe))
  },

  async createProfile(input: SyncProfileInput): Promise<string> {
    if (!isAdapterType(input?.type)) {
      throw new Error('不支持的同步方式。')
    }
    const data: IAccountData = {
      ...(await AdapterFactory.getDefaultValues(input.type)),
      ...(input.type === 'linkwarden' ? { syncOrder: true } : {}),
      ...BLANK_CREDENTIALS,
      ...pickSettings(input),
      type: input.type,
    }
    validateSettings(data)
    if (data.localRoot !== 'tabs' && !(await BrowserTree.folderExists(data.localRoot))) {
      throw new Error('请选择要同步的本地文件夹。')
    }
    // floccus records where the folder is only when a sync initializes the
    // profile, which a first sync that finds a file on the server doesn't do.
    // Saving any setting then looked like a moved folder and threw away what
    // the profile knew about the server. Record it from the start.
    data.rootPath = await BrowserTree.getPathFromLocalId(data.localRoot)
    const account = await Account.create(data)
    getController().kick()
    return account.id
  },

  async updateProfile(id: string, input: SyncProfileInput): Promise<void> {
    return getController().maintainProfile(id, async account => {
    const oldData = account.getData()
    const changes = pickSettings(input)
    validateSettings({ ...oldData, ...changes })
    if ('localRoot' in changes && changes.localRoot !== 'tabs' && !(await BrowserTree.folderExists(changes.localRoot))) {
      throw new Error('请选择要同步的本地文件夹。')
    }
    await account.setData(changes)
    const data = account.getData()
    const rootPath = await BrowserTree.getPathFromLocalId(data.localRoot)
    // Another folder or another file is another set of bookmarks: what the
    // last sync left behind doesn't describe it
    if (
      oldData.localRoot !== data.localRoot ||
      (data.rootPath && data.rootPath !== rootPath) ||
      oldData.bookmark_file !== data.bookmark_file ||
      oldData.bookmark_file_type !== data.bookmark_file_type
    ) {
      await account.init()
    } else if (!data.rootPath) {
      await account.setData({ rootPath })
    }
    getController().kick()
    })
  },

  async deleteProfile(id: string): Promise<void> {
    const account = await Account.get(id)
    await getController().cancelSync(id, true)
    // A cancelled sync still records how it ended, which would write the
    // profile back after it was deleted
    for (let attempt = 0; attempt < 100 && (account.syncing || getController().isProfileBusy(id)); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (account.syncing || getController().isProfileBusy(id)) {
      throw new Error('同步尚未停止，配置仍保留。请稍后重试删除。')
    }
    await getController().clearPendingNotification(id)
    await account.delete()
    // floccus clears a profile's continuation by storing null, which leaves
    // one entry behind for every profile that ever existed
    await browser.storage.local.remove(`bookmarks[${id}].continuation`)
    delete Account.cache[id]
  },

  async resetProfile(id: string): Promise<void> {
    await getController().maintainProfile(id, async (account: any) => {
      await account.storage.setCurrentContinuation(null)
      await account.storage.initCache()
      await account.storage.initMappings()
      await account.setData({ pendingChanges: null, error: null, scheduled: false, checkScheduled: false })
      await getController().clearPendingNotification(id)
    })
  },

  async exportProfiles(ids: string[]): Promise<unknown[]> {
    return Account.export(ids)
  },

  async importProfiles(profiles: unknown): Promise<SyncImportResult> {
    if (!Array.isArray(profiles) || !profiles.length) {
      throw new Error('文件里没有同步配置。')
    }
    const normalized: IAccountData[] = []
    for (const profile of profiles) {
      if (!profile || typeof profile !== 'object' || !isAdapterType(
        profile.type === 'nextcloud-folders' ? 'nextcloud-bookmarks' : profile.type
      )) {
        throw new Error('文件包含不支持的同步方式，未导入任何配置。')
      }
      const data: IAccountData = {
        ...BLANK_CREDENTIALS, ...pickSettings(profile),
        type: profile.type === 'nextcloud-folders' ? 'nextcloud-bookmarks' : profile.type,
        // Bookmark ids are device-local. Require an explicit mapping after import,
        // even when the same id happens to exist on this device.
        localRoot: null, enabled: false, syncOnStartupEnabled: false, syncIntervalEnabled: false
      }
      validateSettings(data)
      normalized.push(data)
    }
    const ids = await Account.import(normalized)
    let incomplete: SyncImportResult['incomplete'] = null
    for (const id of ids) {
      const data = (await Account.get(id)).getData()
      if (needsAuthorization(data)) {
        incomplete = { id, reason: 'authorization' }
        break
      }
      if (data.localRoot !== 'tabs' && !(await BrowserTree.folderExists(data.localRoot))) {
        incomplete = { id, reason: 'folder' }
        break
      }
    }
    getController().kick()
    return { ids, incomplete }
  },

  testConnection,

  async getOAuthSettings(): Promise<SyncOAuthSettings> {
    const custom = await loadCustomOAuthClients()
    const clients = { ...bundledOAuth.clients, ...custom }
    const describe = (type: SyncOAuthAdapterType): SyncOAuthSettings['clients'][SyncOAuthAdapterType] => ({
      clientId: clients[type]?.clientId || '',
      hasSecret: Boolean(clients[type]?.clientSecret),
      available: oauthClientReady(type, clients[type]) &&
        (Boolean(custom[type]) || !bundledOAuth.extensionId || bundledOAuth.extensionId === chrome.runtime.id),
      source: custom[type] ? 'custom' : bundledOAuth.clients[type] ? 'bundled' : 'none',
    })
    return {
      redirectUrl: chrome.identity?.getRedirectURL
        ? chrome.identity.getRedirectURL()
        : `https://${chrome.runtime.id}.chromiumapp.org/`,
      clients: {
        'google-drive': describe('google-drive'),
        dropbox: describe('dropbox'),
      },
    }
  },

  async authorize(type: SyncOAuthAdapterType, client?: SyncOAuthClient): Promise<{ refreshToken: string; username: string }> {
    if (authorizing) throw new Error('已有账号正在授权，请先完成或关闭授权窗口。')
    if (type !== 'google-drive' && type !== 'dropbox') {
      throw new Error('这种同步方式不需要授权。')
    }
    const custom = await loadCustomOAuthClients()
    const clients = { ...bundledOAuth.clients, ...custom }
    const clientId = String(client?.clientId ?? clients[type]?.clientId ?? '').trim()
    const provider = type === 'google-drive' ? 'Google' : 'Dropbox'
    if (!clientId) throw new Error(client
      ? '请填写自定义 OAuth 客户端 ID。'
      : `此安装包尚未配置 ${provider} 登录，请由扩展发行方配置后更新。`)
    if (!client && !custom[type] && bundledOAuth.extensionId && bundledOAuth.extensionId !== chrome.runtime.id) {
      throw new Error('此安装包的登录配置与扩展身份不一致，请安装发行方提供的版本。')
    }
    const clientSecret = typeof client?.clientSecret === 'string'
      ? client.clientSecret.trim()
      : clients[type]?.clientId === clientId ? clients[type]?.clientSecret || '' : ''
    if (type === 'google-drive' && !clientSecret) {
      throw new Error(client ? '请填写这个 Google 客户端的密钥。' : '此安装包的 Google 登录配置不完整，请由扩展发行方更新。')
    }
    authorizing = true
    try {
      const nextClient = type === 'google-drive' ? { clientId, clientSecret } : { clientId }
      const result = await authorizeOAuth(type, nextClient)
      const changedClient = clients[type]?.clientId && clients[type].clientId !== clientId
      clients[type] = nextClient
      if (client) await browser.storage.local.set({ [OAUTH_CLIENTS_ENTRY]: { ...custom, [type]: nextClient } })
      applyOAuthClients(clients)
      if (changedClient) {
        for (const account of await Account.getAllAccounts()) {
          if (account.getData().type === type) await account.setData({ refreshToken: null })
        }
      }
      return result
    } finally {
      authorizing = false
    }
  },

  async getLogs(anonymous: boolean): Promise<string[]> {
    const secrets = new Set<string>()
    for (const account of await Account.getAllAccounts()) {
      for (const key of SYNC_SECRET_FIELDS) {
        const value = account.getData()[key]
        if (typeof value === 'string' && value) secrets.add(value)
      }
    }
    for (const client of Object.values(await loadOAuthClients())) {
      if (client.clientSecret) secrets.add(client.clientSecret)
    }
    const orderedSecrets = [...secrets].sort((a, b) => b.length - a.length)
    // Full logs include bookmark data, never credentials.
    const logs = (await Logger.getLogs()).map(line => {
      let safe = line.replace(LOGGED_SECRET_FIELD, '"$1":"###"')
      for (const secret of orderedSecrets) safe = safe.split(secret).join('###')
      return safe
    })
    if (!anonymous) {
      return logs
    }
    const known = await knownProfileTexts()
    return (await Logger.anonymizeLogs(logs)).map(line => redactLogLine(line, known))
  },

  async clearLogs(): Promise<void> {
    await Logger.persist()
    await BrowserAccountStorage.clearLogs()
  },

  async requestSync(id: string, mode: SyncRunMode): Promise<void> {
    getController().requestSync(
      id,
      mode === 'download' ? 'slave' : mode === 'upload' ? 'overwrite' : mode === 'force' ? null : undefined,
      mode === 'force'
    )
  },

  async sync(id: string, mode: SyncRunMode): Promise<void> {
    const sync = getController()
    if (mode === 'download') {
      return sync.syncAccount(id, 'slave')
    }
    if (mode === 'upload') {
      return sync.syncAccount(id, 'overwrite')
    }
    if (mode === 'force') {
      return sync.syncAccount(id, null, true)
    }
    return sync.syncAccount(id)
  },

  async syncAll(): Promise<void> {
    await getController().scheduleAll()
    await getController().checkSync()
  },

  async cancel(id: string): Promise<void> {
    await getController().cancelSync(id, true)
  },

  onLocalChange: (localId: string) => getController().onLocalChange(localId),
  onTabsChange: () => getController().onTabsChange(),
  onStartup: () => getController().onStartup(),
  onVisit: (url: string) => getController().onVisitUrl(url),
  checkSchedule: (networkRestored?: boolean) => getController().checkSync(networkRestored),
}

export default engine
