/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Derived from floccus' src/lib/browser/BrowserController.js.
 *
 * What decides when a profile syncs is unchanged: local changes after a quiet
 * period, browser startup, the interval, retries with backoff, and checks for
 * notify-only profiles. What differs is who owns the service worker:
 *
 * - Curator's worker registers the browser's event listeners and calls in
 *   here, so this class registers none and can be loaded on demand.
 * - A burst of bookmark events is handled in one pass instead of dropping the
 *   events that arrive while one is being looked at.
 * - Debounced changes use the current automatic/notify-only settings when the
 *   quiet period ends.
 * - A sync holds a lock that Curator's backup restore takes exclusively.
 * - floccus' own account locking, toolbar icons, update and donation pages
 *   and uninstall URL are not part of this.
 */
import browser from '../src/lib/browser-api'
import Account from '../src/lib/Account'
import BrowserAccount from '../src/lib/browser/BrowserAccount'
import BrowserAccountStorage from '../src/lib/browser/BrowserAccountStorage'
import BrowserTree from '../src/lib/browser/BrowserTree'
import { getDueAction, isNotifyOnly } from '../src/lib/SyncSchedule'
import { i18n } from '../src/lib/native/I18n'
import type { IPendingChanges, TAccountStrategy } from '../src/lib/interfaces/AccountStorage'
import {
  SYNC_PENDING_NOTIFICATION_PREFIX,
  SYNC_RUN_LOCK,
  type SyncEngineHost,
} from '../../../shared/sync/sync-contract'

const INACTIVITY_TIMEOUT = 7 * 1000 // 7 seconds
const KEEP_ALIVE_INTERVAL = 20 * 1000
// Looking a changed bookmark up costs a read of each profile's mappings. Past
// this many changes at once, every profile that syncs on changes is scheduled.
const LOCAL_CHANGE_LOOKUP_LIMIT = 25

interface SyncRunRequest {
  strategy?: TAccountStrategy | null
  forceSync: boolean
  resolve: () => void
  reject: (error: unknown) => void
}

interface SyncRun {
  cancelled: boolean
  requests: SyncRunRequest[]
}

function samePendingChanges(a?: IPendingChanges | null, b?: IPendingChanges | null): boolean {
  if (!a || !b) return !a && !b
  return a.local === b.local && a.server === b.server && Boolean(a.initial) === Boolean(b.initial)
}

function isOnline(): boolean {
  // navigator.onLine can only tell us for certain that we're offline
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export default class SyncController {
  private host: SyncEngineHost
  private schedule: Record<string, ReturnType<typeof setTimeout>> = {}
  private pendingLocalIds = new Set<string>()
  private handlingLocalChanges = false
  private handlingTabChanges = false
  private preparingRuns = new Map<string, SyncRun>()
  private maintainingProfiles = new Set<string>()
  private checkingProfiles = new Set<string>()

  constructor(host: SyncEngineHost) {
    this.host = host
  }

  /**
   * A worker that has only just loaded this cannot have a sync running, so a
   * profile that still says it is syncing was cut off by the worker stopping.
   */
  async onLoad(): Promise<void> {
    await this.recoverInterruptedSyncs()
  }

  async onStartup(): Promise<void> {
    const accounts = await Account.getAllAccounts()
    await this.recoverInterruptedSyncs(accounts)
    await Promise.all(
      accounts.map(async acc => {
        if (acc.getData().localRoot === 'tabs') {
          await acc.init()
        }
        if (acc.getData().syncOnStartupEnabled) {
          this.scheduleSyncOrCheck(acc)
        }
      })
    )
  }

  private async recoverInterruptedSyncs(accounts?: Account[]): Promise<void> {
    accounts = accounts || (await Account.getAllAccounts())
    await Promise.all(
      accounts.map(async acc => {
        if (acc.getData().syncing && !acc.syncing) {
          // A notify-only profile leaves the sync to its user: it just looks again
          const notifyOnly = isNotifyOnly(acc.getData())
          await acc.setData({
            syncing: false,
            scheduled: notifyOnly ? false : acc.getData().enabled,
            checkScheduled: notifyOnly && Boolean(acc.getData().enabled),
          })
        }
      })
    )
  }

  async checkSync(networkRestored = false): Promise<void> {
    const online = isOnline()
    // We may have missed the online event while the service worker was asleep.
    // It doesn't survive that, so neither would a property on this object: keep
    // the last state we saw in storage.
    const { wasOnline } = await browser.storage.local.get({ wasOnline: true })
    if (online && !wasOnline) {
      networkRestored = true
    }
    if (online !== wasOnline) {
      await browser.storage.local.set({ wasOnline: online })
    }
    const accounts = await BrowserAccountStorage.getAllAccounts()
    for (const accountId of accounts) {
      const account = await Account.get(accountId)
      const action = getDueAction(account.getData(), Date.now(), online, networkRestored)
      if (action === 'sync') {
        await this.scheduleSync(accountId)
      } else if (action === 'check') {
        await this.scheduleCheck(accountId)
      }
    }
  }

  /** Look at the schedule shortly, once whatever was just asked for has settled */
  kick(delay = 3000): void {
    setTimeout(() => {
      this.checkSync().catch(e => console.warn(e))
    }, delay)
  }

  async onLocalChange(localId: string): Promise<void> {
    this.pendingLocalIds.add(String(localId))
    if (this.handlingLocalChanges) {
      return
    }
    this.handlingLocalChanges = true
    try {
      while (this.pendingLocalIds.size) {
        const localIds = [...this.pendingLocalIds]
        this.pendingLocalIds.clear()
        await this.handleLocalChanges(localIds)
      }
    } finally {
      this.handlingLocalChanges = false
    }
  }

  private async handleLocalChanges(localIds: string[]): Promise<void> {
    const allAccounts = await BrowserAccount.getAllAccounts()
    const candidates = allAccounts
      // Tab profiles follow tab events
      .filter(account => account.getData().localRoot !== 'tabs')
      // Filter out accounts that are not enabled
      .filter(account => account.getData().enabled)
      // Filter out accounts that are syncing, because the event may stem from the sync run
      .filter(account => !account.getData().syncing)
    if (!candidates.length) {
      return
    }

    const accountsToSync = new Map<string, Account>()
    if (localIds.length > LOCAL_CHANGE_LOOKUP_LIMIT) {
      candidates.forEach(account => accountsToSync.set(account.id, account))
    } else {
      for (const localId of localIds) {
        // Check which accounts used to contain (track) the bookmark
        for (const account of candidates) {
          if (!accountsToSync.has(account.id) && (await account.tracksBookmark(localId))) {
            accountsToSync.set(account.id, account)
          }
        }
        // Now we check the account of the folder it is in
        try {
          const ancestors = await BrowserTree.getIdPathFromLocalId(localId)
          const containingAccounts = await BrowserAccount.getAccountsContainingLocalId(
            localId,
            ancestors,
            allAccounts
          )
          for (const account of containingAccounts) {
            if (candidates.includes(account)) {
              accountsToSync.set(account.id, account)
            }
          }
        } catch (e) {
          // A removed bookmark has no ancestors to look at
        }
        if (accountsToSync.size === candidates.length) {
          break
        }
      }
    }

    // schedule a new sync (or check) for all accounts involved
    accountsToSync.forEach(account => this.scheduleSyncOrCheck(account, true))
    this.kick(INACTIVITY_TIMEOUT)
  }

  async onTabsChange(): Promise<void> {
    if (this.handlingTabChanges) {
      return
    }
    // Debounce this function
    this.handlingTabChanges = true
    try {
      const allAccounts = await BrowserAccount.getAllAccounts()
      allAccounts
        .filter(account => account.getData().localRoot === 'tabs')
        // Filter out accounts that are not enabled
        .filter(account => account.getData().enabled)
        // Filter out accounts that are syncing, because the event may stem from the sync run
        .filter(account => !account.getData().syncing)
        // schedule a new sync (or check) for all accounts involved
        .forEach(account => this.scheduleSyncOrCheck(account, true))
    } finally {
      this.handlingTabChanges = false
    }
  }

  private async isAnySyncing(): Promise<boolean> {
    if (this.preparingRuns.size) return true
    const accounts = await Account.getAllAccounts()
    return accounts.some(account => account.getData().syncing || account.syncing)
  }

  async scheduleSync(accountId: string, wait?: boolean): Promise<void> {
    if (wait) {
      if (this.schedule[accountId]) {
        clearTimeout(this.schedule[accountId])
      }
      this.schedule[accountId] = setTimeout(
        () => this.scheduleSync(accountId).catch(e => console.warn(e)),
        INACTIVITY_TIMEOUT
      )
      return
    }

    const account = await Account.get(accountId)
    if (account.getData().syncing) {
      return
    }

    if (await this.isAnySyncing()) {
      await account.setData({ scheduled: account.getData().scheduled || true })
      return
    }

    if (account.getData().scheduled === true) {
      await this.syncAccount(accountId)
    } else {
      await this.syncAccount(accountId, account.getData().scheduled || undefined)
    }
  }

  /**
   * What a profile's own triggers (local changes, startup) start: a sync, or
   * for a notify-only profile a check for pending changes
   */
  scheduleSyncOrCheck(account: Account, wait?: boolean): Promise<void> {
    if (wait) {
      // A local-change debounce describes a trigger, not a committed run.
      // Re-read its settings when the quiet period ends: the user may have
      // disabled automatic sync or changed it to notify-only in the meantime.
      const key = 'trigger:' + account.id
      if (this.schedule[key]) clearTimeout(this.schedule[key])
      this.schedule[key] = setTimeout(() => {
        delete this.schedule[key]
        void Account.get(account.id).then(current => {
          if (current.getData().enabled) return this.scheduleSyncOrCheck(current)
        }).catch(error => console.warn(error))
      }, INACTIVITY_TIMEOUT)
      return Promise.resolve()
    }
    if (isNotifyOnly(account.getData())) {
      return this.scheduleCheck(account.id, wait)
    }
    return this.scheduleSync(account.id, wait)
  }

  async scheduleCheck(accountId: string, wait?: boolean): Promise<void> {
    const key = 'check:' + accountId
    if (wait) {
      if (this.schedule[key]) {
        clearTimeout(this.schedule[key])
      }
      this.schedule[key] = setTimeout(
        () => this.scheduleCheck(accountId).catch(e => console.warn(e)),
        INACTIVITY_TIMEOUT
      )
      return
    }

    const account = await Account.get(accountId)
    if (account.getData().syncing || this.isProfileBusy(accountId)) {
      return
    }

    if (await this.isAnySyncing()) {
      // Check once the other profiles are done, see getDueAction
      await account.setData({ checkScheduled: true })
      return
    }

    await this.checkAccount(accountId)
  }

  /**
   * Runs the task unless Curator is restoring a backup, which rewrites the
   * bookmark tree and rolls it back on failure. Resolves to false if it didn't run.
   */
  private async withSyncLock(task: () => Promise<void>): Promise<boolean> {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
    if (!locks) {
      await task()
      return true
    }
    return locks.request(SYNC_RUN_LOCK, { mode: 'shared', ifAvailable: true }, async lock => {
      if (!lock) {
        return false
      }
      await task()
      return true
    })
  }

  private async keepAlive<T>(task: () => Promise<T>): Promise<T> {
    const interval = setInterval(() => {
      browser.runtime.getPlatformInfo().catch(() => undefined)
    }, KEEP_ALIVE_INTERVAL)
    try {
      return await task()
    } finally {
      clearInterval(interval)
    }
  }

  async checkAccount(accountId: string): Promise<void> {
    if (this.isProfileBusy(accountId)) return
    this.checkingProfiles.add(accountId)
    try {
    const account = await Account.get(accountId)
    if (account.getData().syncing) {
      return
    }
    const before = account.getData().pendingChanges
    let pendingChanges: IPendingChanges | null | undefined
    const ran = await this.keepAlive(() => this.withSyncLock(async () => {
      try {
        pendingChanges = await account.detectChanges()
      } catch (error) {
        console.error(error)
      }
    }))
    if (!ran) {
      await account.setData({ checkScheduled: true })
      return
    }
    if (typeof pendingChanges !== 'undefined') {
      if (!pendingChanges) {
        await this.clearPendingNotification(accountId)
      } else if (!samePendingChanges(before, pendingChanges)) {
        await this.showPendingNotification(account, pendingChanges)
      }
    }
    } finally {
      this.checkingProfiles.delete(accountId)
    }
  }

  async showPendingNotification(account: Account, pendingChanges: IPendingChanges): Promise<void> {
    const data = account.getData()
    if (!data.notificationsEnabled || !browser.notifications) {
      return
    }
    const label = data.label || account.getLabel()
    const message = pendingChanges.initial
      ? i18n.getMessage('DescriptionPendingInitialSync')
      : i18n.getMessage('DescriptionPendingChanges', [String(pendingChanges.local), String(pendingChanges.server)])
    try {
      await browser.notifications.create(SYNC_PENDING_NOTIFICATION_PREFIX + account.id, {
        type: 'basic',
        iconUrl: browser.runtime.getURL(this.host.notificationIcon),
        title: i18n.getMessage('NotificationPendingChangesTitle', [label]),
        message,
      })
    } catch (e) {
      console.warn('Could not show notification', e)
    }
  }

  async clearPendingNotification(accountId: string): Promise<void> {
    if (!browser.notifications) {
      return
    }
    try {
      await browser.notifications.clear(SYNC_PENDING_NOTIFICATION_PREFIX + accountId)
    } catch (e) {
      console.warn(e)
    }
  }

  async scheduleAll(): Promise<void> {
    const accounts = await Account.getAllAccounts()
    for (const account of accounts) {
      await account.setData({ scheduled: true })
    }
  }

  async cancelSync(accountId: string, keepEnabled?: boolean): Promise<void> {
    const preparing = this.preparingRuns.get(accountId)
    if (preparing) preparing.cancelled = true
    const account = await Account.get(accountId)
    // Avoid starting it again automatically
    if (!keepEnabled) {
      await account.setData({ enabled: false })
    }
    if (this.schedule[accountId]) {
      clearTimeout(this.schedule[accountId])
      delete this.schedule[accountId]
    }
    const checkKey = 'check:' + accountId
    if (this.schedule[checkKey]) {
      clearTimeout(this.schedule[checkKey])
      delete this.schedule[checkKey]
    }
    const triggerKey = 'trigger:' + accountId
    if (this.schedule[triggerKey]) {
      clearTimeout(this.schedule[triggerKey])
      delete this.schedule[triggerKey]
    }
    if (!account.syncing) {
      // Nothing is running here: the sync was waiting for its turn, or the
      // worker that ran it is gone
      await account.setData({ scheduled: false, syncing: false, checkScheduled: false })
      return
    }
    await account.cancelSync()
  }

  isProfileBusy(accountId: string): boolean {
    return this.preparingRuns.has(accountId) || this.maintainingProfiles.has(accountId) || this.checkingProfiles.has(accountId)
  }

  /** Settings and cache changes must never replace an in-flight sync's state. */
  async maintainProfile<T>(accountId: string, operation: (account: Account) => Promise<T>): Promise<T> {
    if (this.isProfileBusy(accountId)) throw new Error('这项同步正在运行，请先取消或等待完成。')
    this.maintainingProfiles.add(accountId)
    try {
      const account = await Account.get(accountId)
      if (account.syncing || account.getData().syncing) throw new Error('这项同步正在运行，请先取消或等待完成。')
      return await operation(account)
    } finally {
      this.maintainingProfiles.delete(accountId)
    }
  }

  async syncAccount(accountId: string, strategy?: TAccountStrategy | null, forceSync = false): Promise<void> {
    return this.enqueueSync(accountId, strategy, forceSync)
  }

  requestSync(accountId: string, strategy?: TAccountStrategy | null, forceSync = false): void {
    void this.enqueueSync(accountId, strategy, forceSync).catch(error => console.warn(error))
  }

  private enqueueSync(accountId: string, strategy?: TAccountStrategy | null, forceSync = false): Promise<void> {
    const active = this.preparingRuns.get(accountId)
    if (this.maintainingProfiles.has(accountId) || active?.cancelled) {
      throw new Error('这项同步正在完成其他操作，请稍后重试。')
    }
    let request: SyncRunRequest
    const completion = new Promise<void>((resolve, reject) => {
      request = { strategy, forceSync, resolve, reject }
    })
    if (active) {
      active.requests.push(request)
    } else {
      const run: SyncRun = { cancelled: false, requests: [request] }
      this.preparingRuns.set(accountId, run)
      void this.drainSyncRequests(accountId, run)
    }
    return completion
  }

  private async drainSyncRequests(accountId: string, run: SyncRun): Promise<void> {
    await this.keepAlive(async () => {
      try {
        while (!run.cancelled && run.requests.length) {
          const request = run.requests.shift()
          try {
            await this.runSyncAccount(accountId, run, request.strategy, request.forceSync)
            request.resolve()
          } catch (error) {
            request.reject(error)
          }
        }
      } finally {
        this.preparingRuns.delete(accountId)
        for (const request of run.requests.splice(0)) request.resolve()
      }
    })
  }

  private async runSyncAccount(accountId: string, run: SyncRun, strategy?: TAccountStrategy | null, forceSync = false): Promise<void> {
    const account = await Account.get(accountId)
    if (account.getData().syncing || account.syncing) {
      throw new Error('这项同步正在运行，请先取消或等待完成。')
    }
    await account.setData({ scheduled: strategy || account.getData().strategy || true })
    const ran = await this.withSyncLock(async () => {
      try {
        if (run.cancelled) return
        const data = account.getData()
        if ((strategy || data.strategy) === 'slave' && data.localRoot !== 'tabs') {
          await this.host.beforeLocalOverwrite(data.label || account.getLabel())
        }
        if (!run.cancelled) await account.sync(strategy, forceSync)
      } catch (error) {
        await account.setData({
          syncing: false, scheduled: false, lastAttempt: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          errorCount: Number(account.getData().errorCount || 0) + 1,
          isTransientError: false
        })
      }
    })
    if (run.cancelled) {
      await account.setData({ syncing: false, scheduled: false, checkScheduled: false })
    }
    if (!ran) return
    if (!account.getData().pendingChanges) {
      await this.clearPendingNotification(accountId)
    }
  }

  async onVisitUrl(url: string): Promise<void> {
    if (!url) {
      return
    }
    let accounts = await Account.getAllAccounts()
    accounts = accounts.filter(account => account.getData().clickCountEnabled)
    if (!accounts.length) {
      return
    }
    const bookmarks = await browser.bookmarks.search({ url })
    for (const bookmark of bookmarks) {
      let matchingAccounts: Account[] = []
      try {
        const ancestors = await BrowserTree.getIdPathFromLocalId(bookmark.id)
        matchingAccounts = await BrowserAccount.getAccountsContainingLocalId(
          bookmark.id,
          ancestors,
          accounts,
          true
        )
      } catch (e) {
        console.log('Could not detect containing account from localId ', bookmark.id)
      }
      await Promise.all(
        matchingAccounts.map(async account => {
          const server: any = await account.getServer()
          if (server.countClick) {
            await server.countClick(url)
          }
        })
      )
    }
  }
}
