import { getBookmarkById, getBookmarkTree, moveBookmark, removeBookmark } from './bookmarks-api.js'
import type { FolderCleanupSuggestion } from './folder-cleanup.js'

type Node = chrome.bookmarks.BookmarkTreeNode
const STALE_MESSAGE = '文件夹内容已变化，请重新扫描后再执行。'

function indexTree(root: Node | null | undefined): Map<string, Node> {
  const result = new Map<string, Node>()
  const stack = root ? [root] : []
  while (stack.length) {
    const node = stack.pop()!
    result.set(node.id, node)
    if (node.children) stack.push(...node.children)
  }
  return result
}

function fingerprint(node: Node | undefined): string {
  return JSON.stringify([...indexTree(node).values()].map(item => [
    item.id, item.parentId, item.title, item.url, item.children?.map(child => child.id)
  ]))
}

/** Bind execution to the preview; non-recursive remove also guards against
 * bookmarks arriving between validation and the final Chrome API mutation. */
export function createFolderCleanupMutations(root: Node | null, suggestion: FolderCleanupSuggestion) {
  const original = indexTree(root)
  const snapshots = new Map(suggestion.folderIds.map(id => [id, fingerprint(original.get(id))]))
  return {
    async validate() {
      const current = indexTree((await getBookmarkTree())[0])
      for (const [id, snapshot] of snapshots) {
        if (!original.has(id) || !current.has(id) || fingerprint(current.get(id)) !== snapshot) {
          throw new Error(STALE_MESSAGE)
        }
      }
      const target = suggestion.targetFolderId ? current.get(suggestion.targetFolderId) : null
      if (suggestion.targetFolderId && (!target || target.url)) throw new Error(STALE_MESSAGE)
    },
    async move(bookmarkId: string, parentId: string) {
      const expected = original.get(bookmarkId)
      const current = await getBookmarkById(bookmarkId)
      if (!expected?.url || !current || current.url !== expected.url || current.parentId !== expected.parentId) {
        throw new Error(STALE_MESSAGE)
      }
      await moveBookmark(bookmarkId, parentId)
    },
    async removeFolders(folderIds: string[]) {
      const approved = new Map<string, Node>()
      for (const id of folderIds) {
        for (const [childId, node] of indexTree(original.get(id))) {
          if (!node.url) approved.set(childId, node)
        }
      }
      if (suggestion.targetFolderId && approved.has(suggestion.targetFolderId)) throw new Error(STALE_MESSAGE)
      const removed = new Set<string>()
      async function removeEmpty(id: string): Promise<void> {
        if (removed.has(id)) return
        const node = approved.get(id)
        if (!node) return
        for (const child of node.children || []) if (approved.has(child.id)) await removeEmpty(child.id)
        await removeBookmark(id)
        removed.add(id)
      }
      for (const id of folderIds) await removeEmpty(id)
    }
  }
}

export type FolderCleanupMutations = ReturnType<typeof createFolderCleanupMutations>
