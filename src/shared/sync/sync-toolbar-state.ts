import { SYNC_STALE_MS } from './sync-contract.js'

export interface SyncToolbarState {
  text: string
  tone: 'accent' | 'danger' | 'warning' | 'success'
  title: string
}

/** Storage-only summary: opening the popup never has to evaluate the sync engine. */
export function getSyncToolbarState(stored: unknown, now = Date.now()): SyncToolbarState {
  let profiles = stored
  try {
    while (typeof profiles === 'string') profiles = JSON.parse(profiles)
  } catch {
    profiles = null
  }
  let errors = 0, pending = 0, stale = 0, running = 0, count = 0
  if (profiles && typeof profiles === 'object') {
    for (const data of Object.values(profiles as Record<string, Record<string, unknown>>)) {
      if (!data || typeof data !== 'object') continue
      count++
      if (data.syncing || data.scheduled) { running++; continue }
      const oauth = data.type === 'google-drive' || data.type === 'dropbox'
      if (data.error || !data.localRoot || (oauth && !data.refreshToken)) errors++
      else if (data.pendingChanges) pending++
      else if ((data.enabled || data.syncIntervalEnabled || data.syncOnStartupEnabled) &&
        typeof data.lastSync === 'number' && data.lastSync > 0 && now - data.lastSync > SYNC_STALE_MS) stale++
    }
  }
  if (errors) return { text: '!', tone: 'danger', title: `Curator · ${errors} 项同步需要处理，打开“数据与备份”查看` }
  if (pending) return { text: '!', tone: 'warning', title: `Curator · ${pending} 项有待同步的更改` }
  if (stale) return { text: '!', tone: 'warning', title: `Curator · ${stale} 项已超过两天未同步` }
  if (running) return { text: '↻', tone: 'accent', title: `Curator · ${running} 项正在同步或等待同步` }
  return { text: '', tone: 'accent', title: count ? `Curator · ${count} 项同步，当前无待处理事项` : 'Curator' }
}
