import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { normalizeInboxState, normalizeInboxSettings, isInboxItemPending, settleRemovedInboxItems, updateInboxItem, type InboxItem } from './inbox.js'
import { getInboxWorkflowMode, getInboxWorkflowSettings, shouldAnalyzeInbox } from './inbox-workflow.js'
import { appendRecycleEntries, mergeRecycleEntries } from './recycle-bin.js'
import { reviewInboxItem } from '../service-worker/inbox-review.js'
import { STORAGE_KEYS } from './constants.js'

let storage: Record<string, unknown> = {}
let currentBookmark: { id: string; url: string; parentId: string } | null = null
const item = (index: number, status: InboxItem['status'] = 'needs-review'): InboxItem => ({
  captureId: `capture-${index}`, bookmarkId: String(index), url: `https://example.com/${index}`, title: `Item ${index}`,
  inboxFolderId: '1', originalParentId: '1', status, createdAt: index + 1, updatedAt: index + 1
})

beforeEach(() => {
  storage = {}
  currentBookmark = null
  Object.assign(globalThis, { chrome: {
    runtime: { lastError: undefined },
    storage: { local: {
      get(keys: string | string[], callback: (value: Record<string, unknown>) => void) {
        callback(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(storage[key])])))
      },
      set(payload: Record<string, unknown>, callback: () => void) { Object.assign(storage, structuredClone(payload)); callback() }
    } },
    bookmarks: { get(_id: string, callback: (nodes: unknown[]) => void) { callback(currentBookmark ? [currentBookmark] : []) } }
  } })
})

test('completed history never evicts older pending Inbox tasks', () => {
  const items = [item(0), ...Array.from({ length: 300 }, (_, i) => item(i + 1, 'moved'))]
  const state = normalizeInboxState({ items })
  assert.equal(state.items.filter(isInboxItemPending).length, 1)
  assert.equal(state.items.length, 201)
  assert.equal(normalizeInboxState({ items: Array.from({ length: 350 }, (_, i) => item(i)) }).items.length, 350)
})

test('recycle retention preserves a large batch and older entries across repeated writes', async () => {
  const entries = Array.from({ length: 350 }, (_, i) => ({ recycleId: String(i), deletedAt: i + 1, url: `https://example.com/${i}` }))
  assert.equal(mergeRecycleEntries(entries).length, 350)
  await appendRecycleEntries(entries.slice(0, 200))
  await appendRecycleEntries(entries.slice(200))
  assert.equal((storage[STORAGE_KEYS.recycleBin] as unknown[]).length, 350)
})

test('capture-only opts out of AI while old preferences preserve their mode', () => {
  const capture = normalizeInboxSettings(getInboxWorkflowSettings('capture'))
  assert.equal(getInboxWorkflowMode(capture), 'capture')
  assert.equal(shouldAnalyzeInbox(capture), false)
  for (const mode of ['move', 'tags', 'keep'] as const) {
    const settings = normalizeInboxSettings(getInboxWorkflowSettings(mode))
    assert.equal(getInboxWorkflowMode(settings), mode)
    assert.equal(shouldAnalyzeInbox(settings), true)
  }
  assert.equal(getInboxWorkflowMode(normalizeInboxSettings({})), 'move')
})

test('deleted and changed bookmarks can be settled without touching the bookmark', async () => {
  const dependencies = { ensureFolder: async () => { throw new Error('must not create') }, retry: async () => { throw new Error('must not retry') } }
  for (const bookmark of [null, { id: '1', url: 'https://changed.example', parentId: '2' }]) {
    storage[STORAGE_KEYS.inboxState] = { items: [item(1)] }
    currentBookmark = bookmark
    await reviewInboxItem({ type: 'inbox:review', bookmarkId: '1', captureId: 'capture-1', action: 'keep' }, dependencies)
    assert.equal(normalizeInboxState(storage[STORAGE_KEYS.inboxState]).items[0].status, 'kept')
  }
})

test('bookmark removal settles a pending item and late AI failures cannot resurrect it', async () => {
  storage[STORAGE_KEYS.inboxState] = { items: [item(1, 'analyzing'), item(2)] }
  await settleRemovedInboxItems(['1'])
  await updateInboxItem('1', { status: 'failed', lastError: 'late network failure' })
  const state = normalizeInboxState(storage[STORAGE_KEYS.inboxState])
  assert.equal(state.items.find(item => item.bookmarkId === '1')?.status, 'kept')
  assert.equal(state.items.filter(isInboxItemPending).length, 1)
})
