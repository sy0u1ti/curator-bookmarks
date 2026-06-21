export interface NewtabBookmarkEventActions {
  onChanged: (bookmarkId: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo) => void
  onCreated: (bookmarkId: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void
  onMoved: (bookmarkId: string, moveInfo: chrome.bookmarks.BookmarkMoveInfo) => void
  onRemoved: (bookmarkId: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo) => void
}

const EMPTY_BOOKMARK_EVENT_ACTIONS: NewtabBookmarkEventActions = {
  onChanged: () => {},
  onCreated: () => {},
  onMoved: () => {},
  onRemoved: () => {}
}

let newtabBookmarkEventActions: NewtabBookmarkEventActions = EMPTY_BOOKMARK_EVENT_ACTIONS

export function registerNewtabBookmarkEventActions(actions: NewtabBookmarkEventActions): () => void {
  newtabBookmarkEventActions = actions
  return () => {
    if (newtabBookmarkEventActions === actions) {
      newtabBookmarkEventActions = EMPTY_BOOKMARK_EVENT_ACTIONS
    }
  }
}

export function dispatchNewtabBookmarkChanged(
  bookmarkId: string,
  changeInfo: chrome.bookmarks.BookmarkChangeInfo
): void {
  newtabBookmarkEventActions.onChanged(bookmarkId, changeInfo)
}

export function dispatchNewtabBookmarkCreated(
  bookmarkId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  newtabBookmarkEventActions.onCreated(bookmarkId, bookmark)
}

export function dispatchNewtabBookmarkMoved(
  bookmarkId: string,
  moveInfo: chrome.bookmarks.BookmarkMoveInfo
): void {
  newtabBookmarkEventActions.onMoved(bookmarkId, moveInfo)
}

export function dispatchNewtabBookmarkRemoved(
  bookmarkId: string,
  removeInfo: chrome.bookmarks.BookmarkRemoveInfo
): void {
  newtabBookmarkEventActions.onRemoved(bookmarkId, removeInfo)
}
