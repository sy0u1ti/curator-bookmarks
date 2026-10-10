import { getBookmarkById, getBookmarkTree, moveBookmark } from '../shared/bookmarks-api.js'
import { extractBookmarkData } from '../shared/bookmark-tree.js'
import { formatBookmarkPath } from '../shared/bookmark-path.js'
import { findInboxItemByBookmarkId, isInboxItemPending, recordInboxUndoMove, updateInboxItem, type InboxItem } from '../shared/inbox.js'
import type { InboxReviewMessage } from '../shared/messages.js'

// Called under the same mutation lock as automatic analysis and backup restore.
export async function reviewInboxItem(message: InboxReviewMessage, dependencies: {
  ensureFolder: (path: string) => Promise<string>
  retry: (item: InboxItem) => Promise<void>
}): Promise<string> {
  if (!['accept', 'move', 'keep', 'retry'].includes(message.action)) throw new Error('Inbox 操作无效。')
  const item = await findInboxItemByBookmarkId(String(message.bookmarkId || ''))
  if (!item || item.captureId !== message.captureId) throw new Error('这条 Inbox 记录已变化，请刷新后重试。')
  if (!isInboxItemPending(item)) throw new Error('这条 Inbox 记录已处理，请刷新列表。')
  if (message.action === 'keep') {
    await updateInboxItem(item.bookmarkId, { status: 'kept', lastError: '已结清待办，保留现有书签与位置。' })
    return '已结清待办，未修改书签。'
  }
  if (item.status === 'analyzing') throw new Error('书签正在分析，请等待结果后再处理。')
  const bookmark = await getBookmarkById(item.bookmarkId)
  if (!bookmark?.url) throw new Error('原书签已删除，可选择“结清待办”移除这条记录。')
  if (bookmark.url !== item.url) throw new Error('书签地址已变化，旧建议不再适用；请结清待办，重新收藏后再分析。')
  if (bookmark.parentId !== item.inboxFolderId) throw new Error('书签已移出 Inbox；请保留现有位置或重新捕获。')
  if (message.action === 'retry') {
    await dependencies.retry(item)
    return '已重新加入分析队列。'
  }
  const path = message.action === 'accept' ? item.recommendedFolderPath : message.folderPath
  let targetId = message.action === 'accept' ? item.recommendedFolderId : message.folderId
  const tree = await getBookmarkTree()
  const folders = extractBookmarkData(tree[0]).folderMap
  if (targetId) {
    const target = folders.get(targetId)
    if (!target || !path || formatBookmarkPath(target.path) !== formatBookmarkPath(path)) {
      throw new Error('目标文件夹已变化，请重新选择目录。')
    }
  } else if (message.action === 'accept' && path) {
    targetId = await dependencies.ensureFolder(path)
  }
  if (!targetId) throw new Error('尚无可接受的建议，请选择目标目录。')
  const latest = await getBookmarkById(item.bookmarkId)
  if (!latest?.url || latest.url !== bookmark.url || latest.parentId !== bookmark.parentId) {
    throw new Error('书签在操作期间发生变化，请刷新后重试。')
  }
  if (targetId === bookmark.parentId) {
    await updateInboxItem(item.bookmarkId, { status: 'kept', lastError: '已保留在当前目录。' })
    return '已保留在当前目录。'
  }
  await moveBookmark(item.bookmarkId, targetId)
  try {
    await recordInboxUndoMove({ bookmarkId: item.bookmarkId, fromFolderId: bookmark.parentId!, toFolderId: targetId, movedAt: Date.now() })
    await updateInboxItem(item.bookmarkId, { status: 'moved', lastError: '' })
  } catch {
    return '书签已移动，但处理记录保存失败；请刷新列表核对。'
  }
  return '已移动，可撤销最近一次移动。'
}
