import { isSidePanelSurface } from '../shared/extension-surfaces'
import { refreshPopupBookmarks, refreshPopupCurrentTabContext } from '../popup/popup-controller'

export function subscribeToSidePanelContext(): () => void {
  if (!isSidePanelSurface()) return () => {}

  let disposed = false
  let windowId: number | undefined
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  chrome.windows.getCurrent(win => {
    const error = chrome.runtime.lastError
    if (!disposed && !error) {
      windowId = win.id
      refreshPopupCurrentTabContext()
    }
  })
  const activated = (info: { tabId: number; windowId: number }) => {
    if (info.windowId === windowId) refreshPopupCurrentTabContext()
  }
  const updated = (_id: number, change: { url?: string; title?: string; status?: string }, tab: chrome.tabs.Tab) => {
    if (tab.active && tab.windowId === windowId && (change.url || change.title || change.status === 'complete')) refreshPopupCurrentTabContext()
  }
  const bookmarksChanged = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      if (!disposed) refreshPopupBookmarks()
    }, 100)
  }
  const bookmarkEvents = [chrome.bookmarks.onCreated, chrome.bookmarks.onRemoved, chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved, chrome.bookmarks.onChildrenReordered, chrome.bookmarks.onImportEnded]
  chrome.tabs.onActivated.addListener(activated)
  chrome.tabs.onUpdated.addListener(updated)
  for (const event of bookmarkEvents) event.addListener(bookmarksChanged)

  return () => {
    disposed = true
    clearTimeout(refreshTimer)
    chrome.tabs.onActivated.removeListener(activated)
    chrome.tabs.onUpdated.removeListener(updated)
    for (const event of bookmarkEvents) event.removeListener(bookmarksChanged)
  }
}
