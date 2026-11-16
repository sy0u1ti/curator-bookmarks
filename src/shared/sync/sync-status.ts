import { SYNC_STALE_MS, type SyncProfileView } from './sync-contract.js'

export interface SyncStatusSummary {
  count: number
  running: number
  waiting: number
  attention: number
  pending: number
  never: number
  lastSync: number | null
  state: 'empty' | 'idle' | 'running' | 'waiting' | 'attention' | 'pending' | 'never'
  tone: 'neutral' | 'warning' | 'error'
}

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** The popup's initial read does not load the sync engine or return account data. */
export function summarizeSyncStatus(stored: unknown, now = Date.now()): SyncStatusSummary {
  let source = stored
  try {
    for (let depth = 0; typeof source === 'string' && depth < 5; depth++) source = JSON.parse(source)
  } catch { source = null }
  const summary: SyncStatusSummary = {
    count: 0, running: 0, waiting: 0, attention: 0, pending: 0, never: 0,
    lastSync: null, state: 'empty', tone: 'neutral'
  }
  let errors = 0
  for (const data of record(source) ? Object.values(source) : []) {
    if (!record(data)) continue
    summary.count++
    if (typeof data.lastSync === 'number' && Number.isFinite(data.lastSync) && data.lastSync > 0) {
      summary.lastSync = summary.lastSync === null ? data.lastSync : Math.min(summary.lastSync, data.lastSync)
    } else summary.never++
    if (data.syncing) { summary.running++; continue }
    if (data.scheduled) { summary.waiting++; continue }
    const oauth = data.type === 'google-drive' || data.type === 'dropbox'
    if (data.error || !data.localRoot || (oauth && !data.refreshToken)) {
      summary.attention++
      if (data.error) errors++
    } else if (data.pendingChanges) summary.pending++
    else if (!data.notifyOnly && (data.enabled || data.syncIntervalEnabled || data.syncOnStartupEnabled) &&
      typeof data.lastSync === 'number' && data.lastSync > 0 && now - data.lastSync > SYNC_STALE_MS) summary.attention++
  }
  summary.state = !summary.count ? 'empty' : summary.attention ? 'attention' : summary.running ? 'running'
    : summary.waiting ? 'waiting' : summary.pending ? 'pending' : summary.never ? 'never' : 'idle'
  summary.tone = errors ? 'error' : summary.attention || summary.pending ? 'warning' : 'neutral'
  return summary
}

/** The expanded view uses its already sanitized profiles, including missing folders. */
export function summarizeSyncViews(profiles: SyncProfileView[], now = Date.now()): SyncStatusSummary {
  return summarizeSyncStatus(Object.fromEntries(profiles.map(profile => [profile.id, {
    ...profile.data,
    localRoot: profile.localFolderExists ? profile.data.localRoot : null,
    refreshToken: !profile.needsAuthorization
  }])), now)
}

export function syncStatusLabel(status: SyncStatusSummary): string {
  return {
    empty: '同步', idle: '同步', running: '同步中', waiting: '等待中',
    attention: '需处理', pending: '待同步', never: '尚未同步'
  }[status.state]
}

export function formatSyncTime(timestamp: number | null, now = Date.now()): string {
  if (!timestamp) return '尚未同步'
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

export function syncStatusDetail(status: SyncStatusSummary, now = Date.now()): string {
  if (status.attention) return `${status.attention} 项需处理${status.running ? ` · ${status.running} 项同步中` : ''}`
  if (status.running) return `${status.running} 项正在同步`
  if (status.waiting) return `${status.waiting} 项等待同步`
  if (status.pending) return `${status.pending} 项有待同步的更改`
  if (status.never) return '尚未完成首次同步'
  return status.lastSync ? `上次成功 ${formatSyncTime(status.lastSync, now)}` : '添加同步配置'
}
