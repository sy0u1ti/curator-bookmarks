import { STORAGE_KEYS } from '../shared/constants.js'
import { getLocalStorage, setLocalStorage, withLocalStorageTransaction } from '../shared/storage.js'
import {
  getActiveNewTabWorkspace,
  MAX_WORKSPACE_PINNED_BOOKMARKS,
  normalizeNewTabWorkspaceSettings,
  updateNewTabWorkspace,
  type NewTabWorkspaceSettings
} from '../shared/newtab-workspace-settings.js'

export type NewtabWorkspaceMutation =
  | { type: 'pin'; bookmarkId: string; pinned: boolean; index?: number }
  | { type: 'remove'; bookmarkIds: string[] }
  | { type: 'reorder'; originalIds: string[]; finalIds: string[] }

interface RemovedBookmarkNode { id: string; children?: RemovedBookmarkNode[] }

export function collectRemovedBookmarkNodeIds(bookmarkId: string, node?: RemovedBookmarkNode): string[] {
  const ids = new Set<string>([String(bookmarkId)])
  const remaining = node ? [node] : []
  while (remaining.length) {
    const current = remaining.pop()!
    ids.add(String(current.id))
    for (const child of current.children || []) remaining.push(child)
  }
  return [...ids].filter(Boolean)
}

export function applyNewtabWorkspaceMutation(
  rawSettings: unknown,
  mutation: NewtabWorkspaceMutation
): NewTabWorkspaceSettings {
  const settings = normalizeNewTabWorkspaceSettings(rawSettings)
  const workspace = getActiveNewTabWorkspace(settings)
  let pinnedIds = workspace.pinnedIds
  if (mutation.type === 'pin') {
    const id = String(mutation.bookmarkId || '').trim()
    if (!id) return settings
    if (!mutation.pinned) pinnedIds = pinnedIds.filter((value) => value !== id)
    else if (!pinnedIds.includes(id)) {
      pinnedIds = [...pinnedIds]
      pinnedIds.splice(Math.max(0, Math.min(mutation.index ?? 0, pinnedIds.length)), 0, id)
      pinnedIds = pinnedIds.slice(0, MAX_WORKSPACE_PINNED_BOOKMARKS)
    }
  } else if (mutation.type === 'remove') {
    const removed = new Set(mutation.bookmarkIds)
    pinnedIds = pinnedIds.filter((id) => !removed.has(id))
  } else {
    // Reorder only the entries this gesture saw. Another tab's newly pinned
    // entries retain their slots; entries it removed must stay removed.
    const original = new Set(mutation.originalIds)
    const current = new Set(pinnedIds)
    const ordered = [...new Set(mutation.finalIds)].filter((id) => original.has(id) && current.has(id))
    const orderedIds = new Set(ordered)
    for (const id of pinnedIds) {
      if (original.has(id) && !orderedIds.has(id)) {
        ordered.push(id)
        orderedIds.add(id)
      }
    }
    let index = 0
    pinnedIds = pinnedIds.map((id) => original.has(id) ? ordered[index++] : id)
  }
  return pinnedIds.length === workspace.pinnedIds.length && pinnedIds.every((id, index) => id === workspace.pinnedIds[index])
    ? settings
    : updateNewTabWorkspace(settings, workspace.id, { pinnedIds })
}

export async function persistNewtabWorkspaceMutation(mutation: NewtabWorkspaceMutation): Promise<NewTabWorkspaceSettings> {
  return withLocalStorageTransaction(async (transaction) => {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    const current = normalizeNewTabWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings])
    const settings = applyNewtabWorkspaceMutation(current, mutation)
    if (JSON.stringify(getActiveNewTabWorkspace(current).pinnedIds) !== JSON.stringify(getActiveNewTabWorkspace(settings).pinnedIds)) {
      await setLocalStorage({ [STORAGE_KEYS.newTabWorkspaceSettings]: settings }, { transaction })
    }
    return settings
  })
}
