import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSyncMessage, requestSync } from './sync-messages.js'
import { BackgroundRuntimeError } from '../background-runtime.js'
import { summarizeStoredSyncProfiles } from './sync-profile-summary.js'
import {
  SYNC_ADAPTERS, getSyncPermissions, getSyncProfileStatus, getSyncProfileTitle, listSyncFolders, requestSyncProfilePermissions, sortSyncProfiles
} from '../../options/sync/sync-model.js'
import { SYNC_ADAPTER_TYPES, SYNC_STALE_MS, type SyncProfileView } from './sync-contract.js'
import { getSyncToolbarState } from './sync-toolbar-state.js'
import { canAccessSync } from './sync-access.js'
import { summarizeSyncStatus, summarizeSyncViews, syncStatusDetail, syncStatusLabel, formatSyncTime } from './sync-status.js'

const profile = (data: Partial<SyncProfileView['data']> = {}, extra: Partial<SyncProfileView> = {}): SyncProfileView => ({
  id: '1', label: 'me@host', folderPath: ['书签栏', '工作'], localFolderExists: true, needsAuthorization: false,
  secrets: { password: true, passphrase: false, refreshToken: false }, data: { type: 'webdav', localRoot: '5', ...data }, ...extra
})
const time = () => '昨天'

test('a closed runtime port becomes a recoverable background error', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome')
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: { runtime: { sendMessage: async () => { throw new Error('The message port closed') } } }
  })
  try {
    await assert.rejects(requestSync({ type: 'sync:status' }), error =>
      error instanceof BackgroundRuntimeError && error.code === 'background-unavailable')
  } finally {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous)
    else Reflect.deleteProperty(globalThis, 'chrome')
  }
})

test('the worker accepts only well-formed sync messages', () => {
  assert.deepEqual(parseSyncMessage({ type: 'sync:status' }), { value: { type: 'sync:status' } })
  assert.deepEqual(parseSyncMessage({ type: 'sync:list', extra: 1 }), { value: { type: 'sync:list' } })
  assert.deepEqual(parseSyncMessage({ type: 'sync:run', id: 'a', mode: 'download' }), { value: { type: 'sync:run', id: 'a', mode: 'download' } })
  assert.deepEqual(parseSyncMessage({ type: 'sync:authorize', adapter: 'google-drive' }), { value: { type: 'sync:authorize', adapter: 'google-drive' } })
  for (const message of [
    null, { type: 'sync:unknown' }, { type: 'sync:run', id: 'a', mode: 'wipe' }, { type: 'sync:run', id: '', mode: 'normal' },
    { type: 'sync:delete', id: 5 }, { type: 'sync:update', id: 'a', data: [] }, { type: 'sync:export', ids: [] },
    { type: 'sync:import', profiles: ['x'] }, { type: 'sync:authorize', adapter: 'webdav', client: { clientId: 'x' } },
    { type: 'sync:test', data: {}, id: 7 }
  ]) {
    assert.ok('error' in parseSyncMessage(message), JSON.stringify(message))
  }
  const authorize = parseSyncMessage({ type: 'sync:authorize', adapter: 'dropbox', client: { clientId: 'id', clientSecret: 3, other: 1 } })
  assert.deepEqual(authorize, { value: { type: 'sync:authorize', adapter: 'dropbox', client: { clientId: 'id' } } })
})

test('sync requests are restricted to exact trusted extension pages and persistent login surfaces', () => {
  const id = 'curator-id', base = `chrome-extension://${id}/`
  for (const page of ['options', 'popup', 'sidepanel']) {
    const sender = { id, url: `${base}src/${page}/${page}.html?entry=1#backup` }
    assert.equal(canAccessSync(sender, 'sync:status', id, base), true)
    assert.equal(canAccessSync(sender, 'sync:run', id, base), true)
    assert.equal(canAccessSync(sender, 'sync:authorize', id, base), page !== 'popup')
  }
  for (const sender of [
    { id, url: 'https://example.com/src/popup/popup.html' },
    { id: 'another-extension', url: `${base}src/popup/popup.html` },
    { id, url: `${base}src/popup/popup.html/extra` },
    { id, url: `${base}src/newtab/newtab.html` },
    { id, url: 'not a URL' }, { id }
  ]) assert.equal(canAccessSync(sender, 'sync:export', id, base), false)
})

test('lightweight sync status exposes only counts and success time, retaining errors across concurrent runs', () => {
  const source = {
    running: { type: 'webdav', localRoot: '5', syncing: .4, password: 'password-secret', lastSync: 100 },
    broken: { type: 'webdav', localRoot: '6', error: 'https://private.example/password-secret', username: 'secret-user', lastSync: 200 },
    pending: { type: 'webdav', localRoot: '7', pendingChanges: { local: 1, server: 0 } }
  }
  const status = summarizeSyncStatus(JSON.stringify(JSON.stringify(source)), 300)
  assert.deepEqual([status.count, status.running, status.attention, status.pending, status.never], [3, 1, 1, 1, 1])
  assert.equal(status.state, 'attention')
  assert.equal(status.lastSync, 100, 'one successful account must not mask another account’s older success')
  assert.equal(status.tone, 'error')
  assert.equal(syncStatusLabel(status), '需处理')
  assert.match(syncStatusDetail(status), /同步中/)
  assert.doesNotMatch(JSON.stringify(status), /password-secret|private\.example|secret-user/)
  assert.equal(summarizeSyncStatus('{broken').count, 0)
  assert.equal(syncStatusLabel(summarizeSyncStatus(null)), '同步面板')
  assert.equal(syncStatusLabel(summarizeSyncStatus({ ok: { localRoot: '5', lastSync: 5000 } }, 6000)), '同步面板')
  assert.equal(summarizeSyncStatus({ only: { localRoot: '5', lastSync: 0 } }).state, 'never')
  assert.equal(syncStatusLabel(summarizeSyncStatus({ only: { localRoot: '5', lastSync: 0 } })), '尚未同步')
  assert.equal(summarizeSyncViews([profile({}, { localFolderExists: false })]).state, 'attention')
  assert.equal(formatSyncTime(null), '尚未同步')
  assert.equal(formatSyncTime(60000, 90000), '刚刚')
})

test('sync status distinguishes running from finishing without exposing a fake percentage', () => {
  assert.equal(getSyncProfileStatus(profile({ syncing: 1, lastSync: 5 }), time).text, '正在完成')
  assert.equal(getSyncProfileStatus(profile({ syncing: true }), time).text, '正在同步')
  assert.equal(getSyncProfileStatus(profile({ syncing: Number.POSITIVE_INFINITY }), time).text, '正在同步')
  assert.equal(summarizeSyncStatus({ a: { localRoot: '5', syncing: 1, lastSync: 5 } }, 6).state, 'running')
})

test('stored profiles decide whether the worker loads the engine', () => {
  assert.equal(summarizeStoredSyncProfiles(undefined).count, 0)
  assert.equal(summarizeStoredSyncProfiles('{not json').count, 0)
  const manual = summarizeStoredSyncProfiles(JSON.stringify({ a: { localRoot: '5', enabled: false, syncIntervalEnabled: false } }))
  assert.deepEqual([manual.count, manual.needsSchedule, manual.watchesBookmarks], [1, false, false])
  // The engine stores the profiles as text, sometimes encoded twice
  const automatic = summarizeStoredSyncProfiles(JSON.stringify(JSON.stringify({
    a: { localRoot: '5', enabled: true }, b: { localRoot: 'tabs', enabled: true, clickCountEnabled: true }
  })))
  assert.deepEqual(automatic, {
    count: 2, needsSchedule: true, watchesBookmarks: true, watchesTabs: true, countsClicks: true, syncsOnStartup: true
  })
  assert.equal(summarizeStoredSyncProfiles({ a: { localRoot: '5', scheduled: true } }).needsSchedule, true)
})

test('a profile asks for exactly the access it needs', () => {
  assert.deepEqual(getSyncPermissions({ type: 'webdav', url: 'https://dav.example:8443/remote/', localRoot: '5' }),
    { origins: ['https://dav.example/*'], permissions: [] })
  assert.deepEqual(getSyncPermissions({ type: 's3', url: 'https://s3.example/', bucket: 'marks', pathStyle: false }).origins,
    ['https://marks.s3.example/*'])
  assert.deepEqual(getSyncPermissions({ type: 's3', url: 'https://s3.example/', bucket: 'marks', pathStyle: true }).origins,
    ['https://s3.example/*'])
  assert.deepEqual(getSyncPermissions({ type: 'nextcloud-bookmarks', url: 'ftp://x', localRoot: 'tabs', clickCountEnabled: true }),
    { origins: [], permissions: ['tabs', 'tabGroups', 'history'] })
  const drive = getSyncPermissions({ type: 'google-drive', url: 'https://ignored.example' })
  assert.deepEqual(drive.permissions, ['identity'])
  assert.ok(drive.origins?.every(origin => origin.includes('googleapis.com')))
  assert.deepEqual(Object.keys(SYNC_ADAPTERS).sort(), [...SYNC_ADAPTER_TYPES].sort())
})

test('a profile shows the one state that needs attention first', () => {
  assert.deepEqual(getSyncProfileStatus(profile({ syncing: 0.416, error: 'old' }), time),
    { state: 'syncing', text: '正在同步', tone: 'neutral' })
  assert.equal(getSyncProfileStatus(profile({ scheduled: true, error: 'E037' }), time).state, 'scheduled')
  assert.equal(getSyncProfileStatus(profile({ error: 'E017' }, { needsAuthorization: true }), time).state, 'authorize')
  assert.equal(getSyncProfileStatus(profile({}, { localFolderExists: false }), time).state, 'folder')
  assert.deepEqual(getSyncProfileStatus(profile({ error: 'E017：网络错误', lastSync: 5 }), time).tone, 'error')
  assert.equal(getSyncProfileStatus(profile({ pendingChanges: { local: 2, server: 3 } }), time).text, '待同步：下载 2 项，上传 3 项')
  assert.equal(getSyncProfileStatus(profile({ lastSync: 5 }), time).text, '上次同步 昨天 · 手动')
  assert.equal(getSyncProfileStatus(profile({ lastSync: 5, enabled: true }), time, 10).text, '上次同步 昨天')
  assert.equal(getSyncProfileStatus(profile({ syncIntervalEnabled: true }), time).state, 'never')
})

test('stale sync requires an earlier successful run and never warns for a manual profile', () => {
  const now = SYNC_STALE_MS + 100
  assert.equal(getSyncProfileStatus(profile({ lastSync: 1, enabled: true }), time, now).state, 'stale')
  assert.equal(getSyncProfileStatus(profile({ lastSync: 1 }), time, now).state, 'manual')
  assert.equal(getSyncProfileStatus(profile({ enabled: true }), time, now).state, 'never')
  assert.equal(getSyncProfileStatus(profile({ lastSync: 100, enabled: true }), time, now).state, 'ok')
  const manual = profile({}, { id: 'manual' }), automatic = profile({ syncIntervalEnabled: true }, { id: 'automatic' })
  assert.deepEqual(sortSyncProfiles([manual, automatic]).map(item => item.id), ['automatic', 'manual'])
  assert.equal(manual.id, 'manual')
})

test('sync all requests the union once while the user gesture is still active', async () => {
  const calls: chrome.permissions.Permissions[] = []
  const previous = globalThis.chrome
  globalThis.chrome = { permissions: { request: async value => { calls.push(value); return true } } } as typeof chrome
  try {
    const result = requestSyncProfilePermissions([
      { type: 'webdav', url: 'https://dav.example/a' }, { type: 'webdav', url: 'https://dav.example/b' },
      { type: 'google-drive', localRoot: 'tabs', clickCountEnabled: true }
    ])
    assert.equal(calls.length, 1, 'permission request is made before returning to the event loop')
    assert.deepEqual(calls[0].origins, ['https://dav.example/*', 'https://oauth2.googleapis.com/*', 'https://www.googleapis.com/*'])
    assert.deepEqual(calls[0].permissions, ['identity', 'tabs', 'tabGroups', 'history'])
    assert.equal(await result, true)
  } finally {
    globalThis.chrome = previous
  }
})

test('toolbar summarizes running, pending, stale and incomplete profiles without exposing secrets', () => {
  const data = (patch: Record<string, unknown>) => JSON.stringify({ a: { localRoot: '5', ...patch } })
  assert.equal(getSyncToolbarState(data({ syncing: 0.1 })).text, '↻')
  assert.equal(getSyncToolbarState(data({ error: 'credential secret', password: 'hidden' })).tone, 'danger')
  assert.ok(!JSON.stringify(getSyncToolbarState(data({ error: 'credential secret' }))).includes('credential secret'))
  assert.equal(getSyncToolbarState(data({ pendingChanges: { local: 1, server: 0 } })).tone, 'warning')
  assert.equal(getSyncToolbarState(data({ enabled: true, lastSync: 1 }), SYNC_STALE_MS + 2).text, '!')
  assert.equal(getSyncToolbarState(data({ lastSync: 1 }), SYNC_STALE_MS + 2).text, '')
  assert.equal(getSyncToolbarState(data({ type: 'google-drive' })).tone, 'danger')
  assert.equal(getSyncToolbarState('{broken').text, '')
})

test('profiles and folders are named by where they are', () => {
  assert.equal(getSyncProfileTitle(profile()), '工作')
  assert.equal(getSyncProfileTitle(profile({ label: '家里的 NAS' })), '工作')
  assert.equal(getSyncProfileTitle(profile({ localRoot: 'tabs' }, { folderPath: [] })), '标签页')
  assert.equal(getSyncProfileTitle(profile({}, { folderPath: [], localFolderExists: false })), '未选择文件夹')
  const tree = [{ id: '0', title: '', children: [
    { id: '1', parentId: '0', title: '书签栏', children: [
      { id: '5', parentId: '1', title: '工作', children: [{ id: '6', parentId: '5', title: '链接', url: 'https://example.com' }] },
      { id: '7', parentId: '1', title: '' }
    ] }
  ] }] as chrome.bookmarks.BookmarkTreeNode[]
  assert.deepEqual(listSyncFolders(tree), [
    { id: '0', path: '全部书签' }, { id: '1', path: '书签栏' }, { id: '5', path: '书签栏 / 工作' }, { id: '7', path: '书签栏 / 未命名文件夹' }
  ])
})
