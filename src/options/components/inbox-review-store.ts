import { useEffect } from 'react'
import { getBookmarkTree } from '../../shared/bookmarks-api.js'
import { extractBookmarkData } from '../../shared/bookmark-tree.js'
import { STORAGE_KEYS } from '../../shared/constants.js'
import { isInboxItemPending, loadInboxState, type InboxItem, type InboxState } from '../../shared/inbox.js'
import type { BookmarkRecord, FolderRecord } from '../../shared/types.js'
import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'

interface InboxReviewData {
  inbox: InboxState
  folders: FolderRecord[]
  bookmarks: Map<string, BookmarkRecord>
  pending: InboxItem[]
}
const store = createUiViewStoreSlice<{ data: InboxReviewData | null; error: string }>('options', 'inbox-review', { data: null, error: '' })
let subscribers = 0
let version = 0
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let refreshInFlight: Promise<void> | null = null
let refreshQueued = false

function scheduleRefresh() {
  version++
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh() }, 100)
}

function refresh(): Promise<void> {
  if (!subscribers) return Promise.resolve()
  if (refreshInFlight) { refreshQueued = true; return refreshInFlight }
  refreshInFlight = (async () => {
    do {
      refreshQueued = false
      const request = ++version
      try {
        const [inbox, tree] = await Promise.all([loadInboxState(), getBookmarkTree()])
        if (request !== version || !subscribers) continue
        const { folders, bookmarkMap: bookmarks } = extractBookmarkData(tree[0])
        store.setState({ data: { inbox, folders, bookmarks, pending: inbox.items.filter(item => isInboxItemPending(item) && bookmarks.has(item.bookmarkId)) }, error: '' })
      } catch (error) {
        if (request === version && subscribers) store.setState({ ...store.getState(), error: error instanceof Error ? error.message : 'Inbox 读取失败，请重试。' })
      }
    } while (refreshQueued && subscribers)
  })().finally(() => { refreshInFlight = null })
  return refreshInFlight
}
function onStorage(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (area === 'local' && changes[STORAGE_KEYS.inboxState]) scheduleRefresh()
}
function subscribe() {
  if (++subscribers === 1) {
    void refresh()
    chrome.storage.onChanged.addListener(onStorage)
    chrome.bookmarks.onMoved.addListener(scheduleRefresh)
    chrome.bookmarks.onRemoved.addListener(scheduleRefresh)
    chrome.bookmarks.onCreated.addListener(scheduleRefresh)
    chrome.bookmarks.onChanged.addListener(scheduleRefresh)
  }
  return () => {
    if (--subscribers !== 0) return
    version++
    clearTimeout(refreshTimer)
    refreshTimer = undefined
    chrome.storage.onChanged.removeListener(onStorage)
    chrome.bookmarks.onMoved.removeListener(scheduleRefresh)
    chrome.bookmarks.onRemoved.removeListener(scheduleRefresh)
    chrome.bookmarks.onCreated.removeListener(scheduleRefresh)
    chrome.bookmarks.onChanged.removeListener(scheduleRefresh)
  }
}
export function useInboxReviewData() {
  useEffect(subscribe, [])
  return useUiViewStoreSlice(store)
}

export function refreshInboxReview(): Promise<void> {
  clearTimeout(refreshTimer)
  refreshTimer = undefined
  version++
  return refresh()
}
