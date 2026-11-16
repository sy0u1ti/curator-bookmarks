import { SYNC_TABS_ROOT } from './sync-contract.js'

/** What the service worker needs to know before it loads the sync engine. */
export interface SyncProfileSummary {
  count: number
  /** A profile runs by itself, is running or is waiting to: the periodic check is needed */
  needsSchedule: boolean
  watchesBookmarks: boolean
  watchesTabs: boolean
  countsClicks: boolean
  syncsOnStartup: boolean
}

export const EMPTY_SYNC_PROFILE_SUMMARY: SyncProfileSummary = {
  count: 0,
  needsSchedule: false,
  watchesBookmarks: false,
  watchesTabs: false,
  countsClicks: false,
  syncsOnStartup: false
}

/** The engine stores its profiles as JSON text, id to settings. */
export function summarizeStoredSyncProfiles(stored: unknown): SyncProfileSummary {
  let profiles = stored
  try {
    while (typeof profiles === 'string') profiles = JSON.parse(profiles)
  } catch {
    return EMPTY_SYNC_PROFILE_SUMMARY
  }
  if (!profiles || typeof profiles !== 'object') return EMPTY_SYNC_PROFILE_SUMMARY

  const summary = { ...EMPTY_SYNC_PROFILE_SUMMARY }
  for (const profile of Object.values(profiles as Record<string, Record<string, unknown> | null>)) {
    if (!profile || typeof profile !== 'object') continue
    summary.count += 1
    const tabs = profile.localRoot === SYNC_TABS_ROOT
    // An interval that was never set follows `enabled`, as the engine reads it
    const interval = 'syncIntervalEnabled' in profile ? profile.syncIntervalEnabled : profile.enabled
    if (
      profile.enabled || interval || profile.syncOnStartupEnabled ||
      profile.syncing || profile.scheduled || profile.checkScheduled
    ) {
      summary.needsSchedule = true
    }
    if (profile.enabled && tabs) summary.watchesTabs = true
    if (profile.enabled && !tabs) summary.watchesBookmarks = true
    if (profile.clickCountEnabled) summary.countsClicks = true
    if (profile.syncOnStartupEnabled || tabs) summary.syncsOnStartup = true
  }
  return summary
}
