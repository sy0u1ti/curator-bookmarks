import { STORAGE_KEYS } from '../shared/constants.js'
import { getLocalStorage } from '../shared/storage.js'

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
}

type StartupDataResult =
  | { ok: true; value: NewtabStartupData }
  | { ok: false; error: unknown }

let startupDataConsumed = false
const prefetchedStartupData = settleStartupData(loadNewtabStartupData())

export function prefetchNewtabStartupData(): void {
  void prefetchedStartupData
}

export async function consumeNewtabStartupData(): Promise<NewtabStartupData> {
  const task = startupDataConsumed
    ? settleStartupData(loadNewtabStartupData())
    : prefetchedStartupData
  startupDataConsumed = true

  const result = await task
  if (result.ok === false) {
    throw result.error
  }
  return result.value
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
  const [tree, stored] = await Promise.all([
    getBookmarkTree(),
    getLocalStorage<Record<string, unknown>>(NEWTAB_STARTUP_STORAGE_KEYS)
  ])
  return { stored, tree }
}

function settleStartupData(task: Promise<NewtabStartupData>): Promise<StartupDataResult> {
  return task.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error })
  )
}
