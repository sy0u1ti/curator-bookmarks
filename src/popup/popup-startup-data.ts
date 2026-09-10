import { getBookmarkTree } from '../shared/bookmarks-api.js'
import {
  consumeStartupData,
  prefetchStartupData,
  subscribeStartupBookmarkChanges
} from '../shared/startup-data.js'

const STARTUP_DATA_KEY = 'popup.bookmarkTree'

export function prefetchPopupStartupData(): void {
  prefetchStartupData(STARTUP_DATA_KEY, getBookmarkTree, subscribeStartupBookmarkChanges)
}

export function consumePopupBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return consumeStartupData(STARTUP_DATA_KEY, getBookmarkTree)
}
