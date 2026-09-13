import assert from 'node:assert/strict'
import { STORAGE_KEYS } from '../shared/constants.js'
import { getActiveNewTabWorkspace, normalizeNewTabWorkspaceSettings } from '../shared/newtab-workspace-settings.js'
import { applyNewtabWorkspaceMutation, collectRemovedBookmarkNodeIds, persistNewtabWorkspaceMutation } from './newtab-workspace-persistence.js'

const initial = normalizeNewTabWorkspaceSettings({ workspaces: [{ id: 'default', pinnedIds: ['a', 'b', 'c'] }] })
const remoteAddition = applyNewtabWorkspaceMutation(initial, { type: 'pin', bookmarkId: 'remote', pinned: true })
const reordered = applyNewtabWorkspaceMutation(remoteAddition, { type: 'reorder', originalIds: ['a', 'b', 'c'], finalIds: ['c', 'a', 'b'] })
assert.deepEqual(getActiveNewTabWorkspace(reordered).pinnedIds, ['remote', 'c', 'a', 'b'])
const remoteRemoval = applyNewtabWorkspaceMutation(remoteAddition, { type: 'pin', bookmarkId: 'b', pinned: false })
const afterRemoval = applyNewtabWorkspaceMutation(remoteRemoval, { type: 'reorder', originalIds: ['a', 'b', 'c'], finalIds: ['c', 'a', 'b'] })
assert.deepEqual(getActiveNewTabWorkspace(afterRemoval).pinnedIds, ['remote', 'c', 'a'], 'A stale reorder must not restore another tab’s removed pin.')
const repeated = applyNewtabWorkspaceMutation(remoteAddition, { type: 'pin', bookmarkId: 'remote', pinned: true })
assert.deepEqual(getActiveNewTabWorkspace(repeated).pinnedIds, ['remote', 'a', 'b', 'c'], 'Explicit pin operations must be idempotent.')
const removedNodeIds = collectRemovedBookmarkNodeIds('folder', { id: 'folder', children: [
  { id: 'a' }, { id: 'nested', children: [{ id: 'b' }] }
] })
const legacyWorkspaces = { activeWorkspaceId: 'work', workspaces: [
  { id: 'home', pinnedIds: ['a', 'keep-home'] },
  { id: 'work', pinnedIds: ['b', 'keep-work'] }
] }
const cleaned = applyNewtabWorkspaceMutation(legacyWorkspaces, { type: 'remove', bookmarkIds: removedNodeIds })
assert.deepEqual(getActiveNewTabWorkspace(cleaned).pinnedIds, ['keep-work', 'keep-home'],
  'Native folder deletion must remove descendant pins from every migrated workspace and retain unrelated pins.')

const stored: Record<string, unknown> = { [STORAGE_KEYS.newTabWorkspaceSettings]: initial }
Object.assign(globalThis, {
  chrome: {
    runtime: {},
    storage: { local: {
      get(keys: string[], callback: (values: Record<string, unknown>) => void) {
        const snapshot = Object.fromEntries(keys.map((key) => [key, structuredClone(stored[key])]))
        queueMicrotask(() => callback(snapshot))
      },
      set(values: Record<string, unknown>, callback: () => void) {
        Object.assign(stored, structuredClone(values))
        queueMicrotask(callback)
      }
    } }
  }
})
await Promise.all([
  persistNewtabWorkspaceMutation({ type: 'pin', bookmarkId: 'x', pinned: true }),
  persistNewtabWorkspaceMutation({ type: 'pin', bookmarkId: 'y', pinned: true })
])
assert.deepEqual(getActiveNewTabWorkspace(stored[STORAGE_KEYS.newTabWorkspaceSettings] as typeof initial).pinnedIds,
  ['y', 'x', 'a', 'b', 'c'], 'Concurrent persistence must read and merge while holding the shared lock.')
await Promise.all([
  persistNewtabWorkspaceMutation({ type: 'remove', bookmarkIds: removedNodeIds }),
  persistNewtabWorkspaceMutation({ type: 'pin', bookmarkId: 'new-pin', pinned: true }),
  persistNewtabWorkspaceMutation({ type: 'remove', bookmarkIds: removedNodeIds })
])
assert.deepEqual(getActiveNewTabWorkspace(stored[STORAGE_KEYS.newTabWorkspaceSettings] as typeof initial).pinnedIds,
  ['new-pin', 'y', 'x', 'c'], 'Repeated native deletion cleanup must preserve pins added concurrently by another page.')
console.log('New Tab workspace mutation and concurrent persistence tests passed.')
