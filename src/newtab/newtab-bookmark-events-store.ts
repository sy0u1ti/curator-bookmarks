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
type PendingNewtabBookmarkEvent =
  | {
      type: 'changed'
      bookmarkId: string
      changeInfo: chrome.bookmarks.BookmarkChangeInfo
    }
  | {
      type: 'created'
      bookmarkId: string
      bookmark: chrome.bookmarks.BookmarkTreeNode
    }
  | {
      type: 'moved'
      bookmarkId: string
      moveInfo: chrome.bookmarks.BookmarkMoveInfo
    }
  | {
      type: 'removed'
      bookmarkId: string
      removeInfo: chrome.bookmarks.BookmarkRemoveInfo
    }

let pendingNewtabBookmarkEvents: PendingNewtabBookmarkEvent[] = []

export function registerNewtabBookmarkEventActions(actions: NewtabBookmarkEventActions): () => void {
  newtabBookmarkEventActions = actions
  const pendingEvents = pendingNewtabBookmarkEvents
  pendingNewtabBookmarkEvents = []
  pendingEvents.forEach((event) => dispatchPendingNewtabBookmarkEvent(actions, event))
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
  if (newtabBookmarkEventActions === EMPTY_BOOKMARK_EVENT_ACTIONS) {
    pendingNewtabBookmarkEvents.push({ type: 'changed', bookmarkId, changeInfo })
    return
  }
  newtabBookmarkEventActions.onChanged(bookmarkId, changeInfo)
}

export function dispatchNewtabBookmarkCreated(
  bookmarkId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  if (newtabBookmarkEventActions === EMPTY_BOOKMARK_EVENT_ACTIONS) {
    pendingNewtabBookmarkEvents.push({ type: 'created', bookmarkId, bookmark })
    return
  }
  newtabBookmarkEventActions.onCreated(bookmarkId, bookmark)
}

export function dispatchNewtabBookmarkMoved(
  bookmarkId: string,
  moveInfo: chrome.bookmarks.BookmarkMoveInfo
): void {
  if (newtabBookmarkEventActions === EMPTY_BOOKMARK_EVENT_ACTIONS) {
    pendingNewtabBookmarkEvents.push({ type: 'moved', bookmarkId, moveInfo })
    return
  }
  newtabBookmarkEventActions.onMoved(bookmarkId, moveInfo)
}

export function dispatchNewtabBookmarkRemoved(
  bookmarkId: string,
  removeInfo: chrome.bookmarks.BookmarkRemoveInfo
): void {
  if (newtabBookmarkEventActions === EMPTY_BOOKMARK_EVENT_ACTIONS) {
    pendingNewtabBookmarkEvents.push({ type: 'removed', bookmarkId, removeInfo })
    return
  }
  newtabBookmarkEventActions.onRemoved(bookmarkId, removeInfo)
}

function dispatchPendingNewtabBookmarkEvent(
  actions: NewtabBookmarkEventActions,
  event: PendingNewtabBookmarkEvent
): void {
  switch (event.type) {
    case 'changed':
      actions.onChanged(event.bookmarkId, event.changeInfo)
      return
    case 'created':
      actions.onCreated(event.bookmarkId, event.bookmark)
      return
    case 'moved':
      actions.onMoved(event.bookmarkId, event.moveInfo)
      return
    case 'removed':
      actions.onRemoved(event.bookmarkId, event.removeInfo)
  }
}
