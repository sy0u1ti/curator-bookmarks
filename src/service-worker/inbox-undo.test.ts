import assert from 'node:assert/strict'
import test from 'node:test'
import type { InboxState, InboxUndoMove } from '../shared/inbox.js'
import { undoInboxAutoMove } from './inbox-undo.js'
import { collectRemovedBookmarkIds, createBookmarkRemovalQueue } from './bookmark-removal-queue.js'

function fixture() {
  const undo: InboxUndoMove = { bookmarkId: 'B', fromFolderId: 'inbox', toFolderId: 'organized', movedAt: 100, expiresAt: 1000 }
  const state: InboxState = { version: 1, folderId: 'inbox', items: [], lastUndoMove: undo }
  const bookmark = { id: 'B', parentId: 'organized', title: 'Bookmark B', url: 'https://example.test/B' }
  const moved: string[] = []
  const cleared: Array<string | undefined> = []
  const notified: string[] = []
  const dependencies = {
    loadState: async () => state,
    clearUndo: async (id?: string) => { cleared.push(id); delete state.lastUndoMove },
    getBookmark: async () => bookmark,
    moveBookmark: async (id: string, parentId: string) => { moved.push(id); bookmark.parentId = parentId; return bookmark },
    afterMove: async (move: InboxUndoMove) => { notified.push(move.bookmarkId) }
  }
  return { state, bookmark, moved, cleared, notified, dependencies }
}

test('clicking the older notification cannot undo or consume a newer bookmark move', async () => {
  const context = fixture()
  await assert.rejects(undoInboxAutoMove(context.dependencies, 'A', 200), /其他书签未受影响/)
  assert.deepEqual(context.moved, [])
  assert.deepEqual(context.cleared, [])
  assert.equal(context.state.lastUndoMove?.bookmarkId, 'B')
})

test('undo preserves a later manual folder change', async () => {
  const context = fixture()
  context.bookmark.parentId = 'manual-choice'
  await assert.rejects(undoInboxAutoMove(context.dependencies, 'B', 200), /保留当前整理结果/)
  assert.equal(context.bookmark.parentId, 'manual-choice')
  assert.deepEqual(context.moved, [])
  assert.deepEqual(context.cleared, ['B'])
})

test('the matching notification and the popup last-move action both restore the intended bookmark', async () => {
  for (const expectedId of ['B', undefined]) {
    const context = fixture()
    const result = await undoInboxAutoMove(context.dependencies, expectedId, 200)
    assert.deepEqual(result, { bookmarkId: 'B', parentId: 'inbox', title: 'Bookmark B' })
    assert.deepEqual(context.moved, ['B'])
    assert.deepEqual(context.cleared, ['B'])
    assert.deepEqual(context.notified, ['B'])
  }
})

test('expired moves do nothing and failed moves retain a retryable undo record', async () => {
  const expired = fixture()
  await assert.rejects(undoInboxAutoMove(expired.dependencies, 'B', 1001), /没有可撤销/)
  assert.deepEqual(expired.moved, [])
  const failed = fixture()
  failed.dependencies.moveBookmark = async () => { throw new Error('Chrome refused move') }
  await assert.rejects(undoInboxAutoMove(failed.dependencies, 'B', 200), /Chrome refused move/)
  assert.deepEqual(failed.cleared, [])
  assert.equal(failed.state.lastUndoMove?.bookmarkId, 'B')
})

test('one recursive folder-removal event cleans every descendant in a single batch', async () => {
  const ids = collectRemovedBookmarkIds('folder', { id: 'folder', children: [
    { id: 'A' }, { id: 'nested', children: [{ id: 'B' }, { id: 'C' }] }
  ] })
  const batches: string[][] = []
  const enqueue = createBookmarkRemovalQueue(async batch => { batches.push(batch) })
  await Promise.all([enqueue(ids), enqueue('B')])
  assert.equal(batches.length, 1)
  assert.deepEqual(new Set(batches[0]), new Set(['folder', 'nested', 'A', 'B', 'C']))
  assert.deepEqual(collectRemovedBookmarkIds('single'), ['single'])
})
