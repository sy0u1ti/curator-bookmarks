import { STORAGE_KEYS } from '../shared/constants.js'
import { getLocalStorage } from '../shared/storage.js'
import { reconcilePendingNewtabSettings } from './newtab-settings-persistence.js'
import {
  consumeStartupData,
  prefetchStartupData,
  subscribeStartupBookmarkChanges
} from '../shared/startup-data.js'

const NEWTAB_STARTUP_STORAGE_KEYS = [
  STORAGE_KEYS.newTabBackgroundSettings,
  STORAGE_KEYS.newTabCustomIcons,
  STORAGE_KEYS.newTabFeaturedBackgroundGallery,
  STORAGE_KEYS.newTabFeaturedBackgroundFavorites,
  STORAGE_KEYS.newTabFeaturedBackgroundPreferences,
  STORAGE_KEYS.newTabSearchSettings,
  STORAGE_KEYS.newTabIconSettings,
  STORAGE_KEYS.newTabGeneralSettings,
  STORAGE_KEYS.newTabFolderSettings,
  STORAGE_KEYS.newTabTimeSettings,
  STORAGE_KEYS.newTabWorkspaceSettings,
  STORAGE_KEYS.newTabModuleSettings,
  STORAGE_KEYS.onboardingState
]

export interface NewtabStartupData {
  stored: Record<string, unknown>
  tree: chrome.bookmarks.BookmarkTreeNode[]
  settingsRecoveryError?: string
}

const STARTUP_DATA_KEY = 'newtab'

export function prefetchNewtabStartupData(): void {
  prefetchStartupData(STARTUP_DATA_KEY, loadNewtabStartupData, invalidate => {
    const unsubscribeBookmarks = subscribeStartupBookmarkChanges(invalidate)
    const handleStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && NEWTAB_STARTUP_STORAGE_KEYS.some(key => key in changes)) invalidate()
    }
    chrome.storage.onChanged.addListener(handleStorageChanged)
    return () => {
      unsubscribeBookmarks()
      chrome.storage.onChanged.removeListener(handleStorageChanged)
    }
  })
}

export function consumeNewtabStartupData(): Promise<NewtabStartupData> {
  return consumeStartupData(STARTUP_DATA_KEY, loadNewtabStartupData)
}

export function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(tree)
    })
  })
}

async function loadNewtabStartupData(): Promise<NewtabStartupData> {
  let settingsRecoveryError = ''
  const [tree, stored] = await Promise.all([
    getBookmarkTree(),
    reconcilePendingNewtabSettings()
      .catch((error) => {
        settingsRecoveryError = '上次的设置尚未写入，已保留待恢复记录；再次保存或打开新标签页时会重试。'
        console.warn(settingsRecoveryError, error)
      })
      .then(() => getLocalStorage<Record<string, unknown>>(NEWTAB_STARTUP_STORAGE_KEYS))
  ])
  return { stored, tree, settingsRecoveryError }
}
