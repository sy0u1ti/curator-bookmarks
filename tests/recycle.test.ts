import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  appendRecycleEntry,
  appendRecycleEntries,
  deleteBookmarkToRecycle,
  removeRecycleEntry,
  removeRecycleEntries
} from '../src/shared/recycle-bin.js'
import { normalizeRecycleBin } from '../src/options/sections/recycle.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'

test('normalizes recycle bin entries and filters invalid records', () => {
  const entries = normalizeRecycleBin([
    {
      recycleId: 'old',
      bookmarkId: 1,
      title: '',
      url: 'https://old.example.com',
      parentId: 10,
      index: '2',
      path: 'Root',
      source: '',
      deletedAt: 100
    },
    {
      recycleId: 'new',
      bookmarkId: 2,
      title: 'New',
      url: 'https://new.example.com',
      deletedAt: 200
    },
    {
      recycleId: 'missing-url',
      url: ''
    }
  ])

  assert.equal(entries.length, 2)
  assert.equal(entries[0].recycleId, 'new')
  assert.equal(entries[1].recycleId, 'old')
  assert.equal(entries[1].title, '未命名书签')
  assert.equal(entries[1].parentId, '10')
  assert.equal(entries[1].index, 2)
  assert.equal(entries[1].source, '删除')
})

test('serializes recycle bin append and remove operations in one context', async () => {
  const store: Record<string, unknown> = {}
  const writes: unknown[] = []

  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get(keys: string[], callback: (items: Record<string, unknown>) => void) {
          const snapshot: Record<string, unknown> = {}
          for (const key of keys) {
            snapshot[key] = store[key]
          }
          setTimeout(() => callback(snapshot), 0)
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          setTimeout(() => {
            Object.assign(store, payload)
            writes.push(payload[STORAGE_KEYS.recycleBin])
            callback()
          }, 0)
        }
      }
    },
    runtime: {}
  }

  await Promise.all([
    appendRecycleEntry({
      recycleId: 'first',
      deletedAt: 100,
      title: 'First',
      url: 'https://first.example.com'
    }),
    appendRecycleEntry({
      recycleId: 'second',
      deletedAt: 200,
      title: 'Second',
      url: 'https://second.example.com'
    })
  ])

  assert.deepEqual(
    (store[STORAGE_KEYS.recycleBin] as Array<{ recycleId: string }>).map((entry) => entry.recycleId),
    ['second', 'first']
  )

  await Promise.all([
    removeRecycleEntry('first'),
    appendRecycleEntry({
      recycleId: 'third',
      deletedAt: 300,
      title: 'Third',
      url: 'https://third.example.com'
    })
  ])

  assert.deepEqual(
    (store[STORAGE_KEYS.recycleBin] as Array<{ recycleId: string }>).map((entry) => entry.recycleId),
    ['third', 'second']
  )
  assert.ok(writes.length >= 4)
})

test('merges stale recycle bin saves with current storage entries', async () => {
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.recycleBin]: [
      {
        recycleId: 'popup-new',
        deletedAt: 300,
        title: 'Popup',
        url: 'https://popup.example.com'
      }
    ]
  }

  ;(globalThis as any).chrome = createChromeMock({ store })

  await appendRecycleEntries([
    {
      recycleId: 'options-stale',
      deletedAt: 200,
      title: 'Options',
      url: 'https://options.example.com'
    }
  ])

  assert.deepEqual(
    (store[STORAGE_KEYS.recycleBin] as Array<{ recycleId: string }>).map((entry) => entry.recycleId),
    ['popup-new', 'options-stale']
  )
})

test('removes recycle entries by id without dropping unrelated current entries', async () => {
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.recycleBin]: [
      {
        recycleId: 'old-options',
        deletedAt: 100,
        title: 'Old',
        url: 'https://old.example.com'
      },
      {
        recycleId: 'popup-new',
        deletedAt: 300,
        title: 'Popup',
        url: 'https://popup.example.com'
      }
    ]
  }

  ;(globalThis as any).chrome = createChromeMock({ store })

  await removeRecycleEntries(['old-options'])

  assert.deepEqual(
    (store[STORAGE_KEYS.recycleBin] as Array<{ recycleId: string }>).map((entry) => entry.recycleId),
    ['popup-new']
  )
})

test('does not remove Chrome bookmark when recycle append fails', async () => {
  const store: Record<string, unknown> = {}
  const removedBookmarkIds: string[] = []

  ;(globalThis as any).chrome = createChromeMock({
    store,
    setError: 'storage unavailable',
    removedBookmarkIds
  })

  await assert.rejects(
    deleteBookmarkToRecycle('bookmark-1', {
      recycleId: 'recycle-1',
      bookmarkId: 'bookmark-1',
      deletedAt: 100,
      title: 'Bookmark',
      url: 'https://bookmark.example.com'
    }),
    /storage unavailable/
  )

  assert.deepEqual(removedBookmarkIds, [])
  assert.equal(store[STORAGE_KEYS.recycleBin], undefined)
})

test('rolls back recycle entry when Chrome bookmark removal fails', async () => {
  const store: Record<string, unknown> = {}
  const removedBookmarkIds: string[] = []

  ;(globalThis as any).chrome = createChromeMock({
    store,
    removeBookmarkError: 'bookmark locked',
    removedBookmarkIds
  })

  await assert.rejects(
    deleteBookmarkToRecycle('bookmark-1', {
      recycleId: 'recycle-1',
      bookmarkId: 'bookmark-1',
      deletedAt: 100,
      title: 'Bookmark',
      url: 'https://bookmark.example.com'
    }),
    /bookmark locked/
  )

  assert.deepEqual(removedBookmarkIds, ['bookmark-1'])
  assert.deepEqual(store[STORAGE_KEYS.recycleBin], [])
})

function createChromeMock(options: {
  store: Record<string, unknown>
  setError?: string
  removeBookmarkError?: string
  removedBookmarkIds?: string[]
}) {
  const { store, setError, removeBookmarkError, removedBookmarkIds = [] } = options
  let lastError: { message: string } | undefined

  return {
    storage: {
      local: {
        get(keys: string[], callback: (items: Record<string, unknown>) => void) {
          const snapshot: Record<string, unknown> = {}
          for (const key of keys) {
            snapshot[key] = store[key]
          }
          setTimeout(() => callback(snapshot), 0)
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          setTimeout(() => {
            if (!setError) {
              Object.assign(store, payload)
            }
            lastError = setError ? { message: setError } : undefined
            callback()
            lastError = undefined
          }, 0)
        }
      }
    },
    bookmarks: {
      remove(bookmarkId: string, callback: () => void) {
        setTimeout(() => {
          removedBookmarkIds.push(bookmarkId)
          lastError = removeBookmarkError ? { message: removeBookmarkError } : undefined
          callback()
          lastError = undefined
        }, 0)
      }
    },
    runtime: {
      get lastError() {
        return lastError
      }
    }
  }
}
