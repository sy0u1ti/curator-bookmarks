import { getBookmarkTree } from '../shared/bookmarks-api.js'
import { SYNC_ACCOUNTS_STORAGE_KEY } from '../shared/sync/sync-contract.js'
import type { SyncStatusSummary } from '../shared/sync/sync-status.js'
import {
  consumeStartupData,
  prefetchStartupData,
  subscribeStartupBookmarkChanges
} from '../shared/startup-data.js'

const STARTUP_DATA_KEY = 'popup.bookmarkTree'
const ACTIVE_TAB_STARTUP_DATA_KEY = 'popup.activeTab'
const SYNC_STATUS_STARTUP_DATA_KEY = 'popup.syncStatus'

function queryPopupActiveTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime?.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(tabs?.[0] || null)
    })
  })
}

function subscribeStartupActiveTabChanges(invalidate: () => void): () => void {
  const tabs = typeof chrome === 'undefined' ? null : chrome.tabs
  if (!tabs?.onActivated) {
    return () => {}
  }
  tabs.onActivated.addListener(invalidate)
  return () => {
    tabs.onActivated.removeListener(invalidate)
  }
}

function queryPopupSyncStatus(): Promise<SyncStatusSummary | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return Promise.resolve(null)
  }

  return Promise.resolve(
    chrome.runtime.sendMessage({ type: 'sync:status' }) as Promise<{ ok?: boolean; result?: SyncStatusSummary } | undefined>
  )
    .then((response) => (response?.ok && response.result ? response.result : null))
    .catch(() => null)
}

function subscribeStartupSyncStatusChanges(invalidate: () => void): () => void {
  const storage = typeof chrome === 'undefined' ? null : chrome.storage?.onChanged
  if (!storage) {
    return () => {}
  }
  const handleChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[SYNC_ACCOUNTS_STORAGE_KEY]) {
      invalidate()
    }
  }
  storage.addListener(handleChanged)
  return () => {
    storage.removeListener(handleChanged)
  }
}

export function prefetchPopupStartupData(): void {
  prefetchStartupData(STARTUP_DATA_KEY, getBookmarkTree, subscribeStartupBookmarkChanges)
  prefetchStartupData(ACTIVE_TAB_STARTUP_DATA_KEY, queryPopupActiveTab, subscribeStartupActiveTabChanges)
  prefetchStartupData(SYNC_STATUS_STARTUP_DATA_KEY, queryPopupSyncStatus, subscribeStartupSyncStatusChanges)
}

export function consumePopupBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return consumeStartupData(STARTUP_DATA_KEY, getBookmarkTree)
}

export function consumePopupActiveTab(): Promise<chrome.tabs.Tab | null> {
  return consumeStartupData(ACTIVE_TAB_STARTUP_DATA_KEY, queryPopupActiveTab)
}

export function consumePrefetchedPopupSyncStatus(): Promise<SyncStatusSummary | null> {
  return consumeStartupData(SYNC_STATUS_STARTUP_DATA_KEY, () => Promise.resolve(null))
}
