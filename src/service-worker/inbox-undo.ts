import type { InboxState, InboxUndoMove } from '../shared/inbox.js'
import type { InboxUndoLastMoveResult } from '../shared/messages.js'

type UndoBookmark = Pick<chrome.bookmarks.BookmarkTreeNode, 'id' | 'parentId' | 'title' | 'url'>

interface InboxUndoDependencies {
  loadState: () => Promise<InboxState>
  clearUndo: (bookmarkId?: string) => Promise<unknown>
  getBookmark: (bookmarkId: string) => Promise<UndoBookmark | null>
  moveBookmark: (bookmarkId: string, parentId: string) => Promise<UndoBookmark>
  afterMove: (undoMove: InboxUndoMove) => Promise<void>
}

export async function undoInboxAutoMove(
  dependencies: InboxUndoDependencies,
  expectedBookmarkId?: string,
  now = Date.now()
): Promise<InboxUndoLastMoveResult> {
  const { lastUndoMove: undoMove } = await dependencies.loadState()
  // Notifications outlive the single undo slot. An older notification must
  // never consume or apply the undo belonging to a different bookmark.
  if (expectedBookmarkId && undoMove?.bookmarkId !== expectedBookmarkId) {
    throw new Error('这条通知对应的移动已无法撤销；其他书签未受影响。')
  }
  if (!undoMove || undoMove.expiresAt <= now) {
    await dependencies.clearUndo(undoMove?.bookmarkId)
    throw new Error('没有可撤销的 Inbox 自动移动。')
  }

  const bookmark = await dependencies.getBookmark(undoMove.bookmarkId)
  if (!bookmark?.url) {
    await dependencies.clearUndo(undoMove.bookmarkId)
    throw new Error('原书签已不存在，无法撤销。')
  }
  if (String(bookmark.parentId || '') !== undoMove.toFolderId) {
    await dependencies.clearUndo(undoMove.bookmarkId)
    throw new Error('书签位置已被修改，已保留当前整理结果。')
  }

  const movedNode = await dependencies.moveBookmark(undoMove.bookmarkId, undoMove.fromFolderId)
  await dependencies.clearUndo(undoMove.bookmarkId)
  await dependencies.afterMove(undoMove)
  return {
    bookmarkId: String(movedNode.id),
    parentId: String(movedNode.parentId || undoMove.fromFolderId),
    title: String(movedNode.title || bookmark.title || '未命名网页')
  }
}
