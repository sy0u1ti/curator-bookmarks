import type { BookmarkMenuActionViewModel } from './bookmark-menu-view-models.js'

export function buildBookmarkMoveActions(
  nodes: readonly chrome.bookmarks.BookmarkTreeNode[],
  currentParentId: string,
  onMove: (folderId: string) => void | Promise<void>
): BookmarkMenuActionViewModel[] {
  return nodes.filter(isWritableFolder).map(folder => {
    const hasSubfolders = (folder.children || []).some(isWritableFolder)
    const select: BookmarkMenuActionViewModel = {
      id: `move:${folder.id}`,
      ariaLabel: `移动到：${folder.title || '未命名文件夹'}`,
      disabled: folder.id === currentParentId,
      icon: 'folder',
      label: folder.title || '未命名文件夹',
      onSelect: () => onMove(folder.id)
    }
    if (!hasSubfolders) return select
    return {
      ...select,
      disabled: false,
      onSelect: () => {},
      // Materialize only the level being opened, not every folder in a large tree.
      children: () => [
        { ...select, id: `here:${folder.id}`, label: '移动到此文件夹', ariaLabel: `移动到此文件夹：${folder.title || '未命名文件夹'}`, icon: 'move' },
        ...buildBookmarkMoveActions(folder.children || [], currentParentId, onMove)
      ]
    }
  })
}

function isWritableFolder(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return node.id !== '0' && node.url === undefined && node.unmodifiable !== 'managed'
}
