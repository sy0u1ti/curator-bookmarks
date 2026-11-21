import loadSyncEngine from 'virtual:curator-sync-engine'
import {
  SYNC_ACCOUNTS_STORAGE_KEY,
  SYNC_CHECK_ALARM,
  SYNC_PENDING_NOTIFICATION_PREFIX,
  type SyncEngine
} from '../shared/sync/sync-contract.js'
import { isSyncMessageType, parseSyncMessage, type SyncMessage } from '../shared/sync/sync-messages.js'
import { canAccessSync } from '../shared/sync/sync-access.js'
import { summarizeSyncStatus } from '../shared/sync/sync-status.js'
import {
  EMPTY_SYNC_PROFILE_SUMMARY,
  summarizeStoredSyncProfiles,
  type SyncProfileSummary
} from '../shared/sync/sync-profile-summary.js'

const OPTIONS_PAGE = 'src/options/options.html'
const NETWORK_SETTLE_MS = 5000
const CREATED_BOOKMARK_TTL_MS = 60 * 1000

export interface BookmarkSyncHooks {
  /** Resolves once an interrupted backup restore has been rolled back; rejects while it has not. */
  whenBookmarksSettled(): Promise<void>
  /** Runs before a sync that makes the local bookmarks match the server. */
  beforeLocalOverwrite(profileLabel: string): Promise<void>
  /** Returns true while bulk local bookmark mutations (restore/import) should not trigger sync. */
  isBookmarkMutationSuppressed?(): boolean
}

export interface BookmarkSync {
  /** Whether this new bookmark was written by a sync rather than added by the user. */
  consumeSyncCreatedBookmark(node: { parentId?: string; url?: string }): boolean
}

function canonicalUrl(url: string): string {
  try {
    return new URL(url).href
  } catch {
    return url
  }
}

/**
 * Bookmark sync in the service worker.
 *
 * The engine is large and most wakes of the worker have nothing to do with it,
 * so listeners are registered here and decide from the stored profiles alone
 * whether the engine has to be loaded.
 */
export function registerBookmarkSync(hooks: BookmarkSyncHooks): BookmarkSync {
  let summaryPromise: Promise<SyncProfileSummary> | null = null
  let enginePromise: Promise<SyncEngine> | null = null
  const createdBySync = new Map<string, number[]>()
  let lastCreatedSweepAt = 0

  const readSummary = (): Promise<SyncProfileSummary> => {
    summaryPromise ??= chrome.storage.local.get(SYNC_ACCOUNTS_STORAGE_KEY)
      .then(stored => summarizeStoredSyncProfiles(stored?.[SYNC_ACCOUNTS_STORAGE_KEY]))
      .catch(() => {
        summaryPromise = null
        return EMPTY_SYNC_PROFILE_SUMMARY
      })
    return summaryPromise
  }

  const getEngine = (): Promise<SyncEngine> => {
    enginePromise ??= (async () => {
      // A half-restored tree must not be taken for the user's bookmarks.
      await hooks.whenBookmarksSettled()
      const engine = loadSyncEngine()
      await engine.start({
        notificationIcon: 'src/assets/icon128.png',
        beforeLocalOverwrite: hooks.beforeLocalOverwrite,
        onLocalBookmarkCreate(details) {
          if (!details.url) return
          const now = Date.now()
          if (
            now - lastCreatedSweepAt >= CREATED_BOOKMARK_TTL_MS ||
            createdBySync.size >= 512
          ) {
            lastCreatedSweepAt = now
            for (const [key, times] of createdBySync) {
              const fresh = times.filter(time => now - time < CREATED_BOOKMARK_TTL_MS)
              if (fresh.length) createdBySync.set(key, fresh)
              else createdBySync.delete(key)
            }
          }
          const key = `${details.parentId}\n${canonicalUrl(details.url)}`
          const existing = createdBySync.get(key)
          if (existing) existing.push(now)
          else createdBySync.set(key, [now])
        }
      })
      return engine
    })().catch(error => {
      enginePromise = null
      throw error
    })
    return enginePromise
  }

  /** Loads the engine only if the stored profiles say this event concerns one of them. */
  const whenProfiles = (
    concerns: (summary: SyncProfileSummary) => boolean,
    task: (engine: SyncEngine) => Promise<void>
  ): void => {
    void readSummary()
      .then(summary => concerns(summary) ? getEngine().then(task) : undefined)
      .catch(error => console.warn('[Curator] 书签同步事件处理失败', error))
  }

  const updateScheduleAlarm = async (): Promise<void> => {
    const { needsSchedule } = await readSummary()
    const alarm = await chrome.alarms.get(SYNC_CHECK_ALARM)
    if (needsSchedule && !alarm) {
      await chrome.alarms.create(SYNC_CHECK_ALARM, { periodInMinutes: 1 })
    } else if (!needsSchedule && alarm) {
      await chrome.alarms.clear(SYNC_CHECK_ALARM)
    }
  }
  const refreshScheduleAlarm = (): void => {
    void updateScheduleAlarm().catch(error => console.warn('[Curator] 书签同步定时检查设置失败', error))
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SYNC_ACCOUNTS_STORAGE_KEY]) {
      summaryPromise = null
      refreshScheduleAlarm()
    }
  })
  // Alarms can be lost across browser restarts; a worker wake repairs them.
  refreshScheduleAlarm()

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_CHECK_ALARM) {
      whenProfiles(summary => summary.needsSchedule, engine => engine.checkSchedule())
    }
  })

  const onBookmarkEvent = (bookmarkId: string): void => {
    if (hooks.isBookmarkMutationSuppressed?.()) return
    whenProfiles(summary => summary.watchesBookmarks, engine => engine.onLocalChange(String(bookmarkId)))
  }
  chrome.bookmarks.onCreated.addListener(onBookmarkEvent)
  chrome.bookmarks.onChanged.addListener(onBookmarkEvent)
  chrome.bookmarks.onMoved.addListener(onBookmarkEvent)
  chrome.bookmarks.onRemoved.addListener(onBookmarkEvent)

  const onTabEvent = (): void => {
    whenProfiles(summary => summary.watchesTabs, engine => engine.onTabsChange())
  }
  chrome.tabs.onUpdated.addListener(onTabEvent)
  chrome.tabs.onRemoved.addListener(onTabEvent)
  chrome.tabs.onMoved.addListener(onTabEvent)
  chrome.tabs.onDetached.addListener(onTabEvent)

  // These APIs exist only once their optional permission is granted.
  let tabGroupsRegistered = false
  let historyRegistered = false
  const registerOptionalListeners = (): void => {
    if (!tabGroupsRegistered && chrome.tabGroups) {
      tabGroupsRegistered = true
      chrome.tabGroups.onCreated.addListener(onTabEvent)
      chrome.tabGroups.onMoved.addListener(onTabEvent)
      chrome.tabGroups.onRemoved.addListener(onTabEvent)
      chrome.tabGroups.onUpdated.addListener(onTabEvent)
    }
    if (!historyRegistered && chrome.history) {
      historyRegistered = true
      chrome.history.onVisited.addListener((item) => {
        if (!item.url) return
        whenProfiles(summary => summary.countsClicks, engine => engine.onVisit(String(item.url)))
      })
    }
  }
  registerOptionalListeners()
  chrome.permissions.onAdded.addListener(registerOptionalListeners)

  chrome.runtime.onStartup.addListener(() => {
    whenProfiles(summary => summary.syncsOnStartup || summary.needsSchedule, engine => engine.onStartup())
  })

  // Retry failed syncs once the connection is back, instead of waiting out the backoff.
  globalThis.addEventListener('online', () => {
    setTimeout(() => {
      whenProfiles(summary => summary.needsSchedule, engine => engine.checkSchedule(true))
    }, NETWORK_SETTLE_MS)
  })

  chrome.notifications?.onClicked.addListener((notificationId) => {
    if (!notificationId.startsWith(SYNC_PENDING_NOTIFICATION_PREFIX)) return
    chrome.notifications.clear(notificationId)
    // Show the pending changes and leave syncing them to the user.
    void chrome.tabs.create({ url: chrome.runtime.getURL(`${OPTIONS_PAGE}#backup:sync`) })
  })

  const handleMessage = async (message: SyncMessage): Promise<unknown> => {
    if (message.type === 'sync:status') {
      const stored = await chrome.storage.local.get(SYNC_ACCOUNTS_STORAGE_KEY)
      return summarizeSyncStatus(stored[SYNC_ACCOUNTS_STORAGE_KEY])
    }
    if (message.type === 'sync:list' && !(await readSummary()).count) return []
    const engine = await getEngine()
    switch (message.type) {
      case 'sync:list': return engine.listProfiles()
      case 'sync:create': return engine.createProfile(message.data)
      case 'sync:update': return engine.updateProfile(message.id, message.data)
      case 'sync:delete': return engine.deleteProfile(message.id)
      case 'sync:reset': return engine.resetProfile(message.id)
      case 'sync:export': return engine.exportProfiles(message.ids)
      case 'sync:import': return engine.importProfiles(message.profiles)
      case 'sync:test': return engine.testConnection(message.data, message.id)
      case 'sync:oauth-settings': return engine.getOAuthSettings()
      case 'sync:authorize': return engine.authorize(message.adapter, message.client)
      case 'sync:logs': return engine.getLogs(message.anonymous)
      case 'sync:clear-logs': return engine.clearLogs()
      case 'sync:cancel': return engine.cancel(message.id)
      case 'sync:run-all':
        // A run outlasts the five minutes a worker may spend on one message.
        // The page follows it through the stored profiles instead.
        void engine.syncAll().catch(error => console.warn('[Curator] 书签同步失败', error))
        return undefined
      case 'sync:run': {
        if (!(await engine.listProfiles()).some(profile => profile.id === message.id)) throw new Error('这项同步已不存在。')
        await engine.requestSync(message.id, message.mode)
        return undefined
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSyncMessageType(message?.type)) return undefined
    if (!canAccessSync(sender, message.type, chrome.runtime.id, chrome.runtime.getURL(''))) {
      sendResponse({ ok: false, error: '无权操作书签同步。' })
      return undefined
    }
    const parsed = parseSyncMessage(message)
    if ('error' in parsed) {
      sendResponse({ ok: false, error: parsed.error })
      return undefined
    }
    handleMessage(parsed.value).then(
      result => sendResponse({ ok: true, result }),
      error => sendResponse({ ok: false, error: error instanceof Error ? error.message : '书签同步操作失败。' })
    )
    return true
  })

  return {
    consumeSyncCreatedBookmark(node) {
      if (!node.url) return false
      const key = `${node.parentId}\n${canonicalUrl(node.url)}`
      const times = createdBySync.get(key)
      if (!times?.length) return false
      const now = Date.now()
      while (times.length && now - times[0] >= CREATED_BOOKMARK_TTL_MS) {
        times.shift()
      }
      if (!times.length) {
        createdBySync.delete(key)
        return false
      }
      times.shift()
      if (!times.length) createdBySync.delete(key)
      return true
    }
  }
}
