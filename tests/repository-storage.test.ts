import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import {
  __resetBookmarkTagRepositoryForTest,
  buildBookmarkTagRecord,
  loadBookmarkTagIndex,
  normalizeBookmarkTagIndex,
  saveBookmarkTagIndex,
  upsertBookmarkTagRecord
} from '../src/shared/bookmark-tags.js'
import {
  __resetContentSnapshotRepositoryForTest,
  buildContentSnapshotRecord,
  loadContentSnapshotIndex,
  normalizeContentSnapshotIndex,
  saveContentSnapshotFromContext
} from '../src/shared/content-snapshots.js'
import {
  loadNewTabActivityFromRepository,
  resetNewTabActivityRepositoryForTest,
  upsertNewTabActivityRecordInRepository
} from '../src/shared/repositories/activity-repository.js'
import { createCuratorBackupFile } from '../src/shared/backup.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'
import type { BookmarkRecord } from '../src/shared/types.js'

afterEach(() => {
  __resetBookmarkTagRepositoryForTest()
  __resetContentSnapshotRepositoryForTest()
  resetNewTabActivityRepositoryForTest()
  delete (globalThis as any).chrome
  delete (globalThis as any).indexedDB
})

test('tag repository migrates legacy local index into IndexedDB and compacts local metadata', async () => {
  const legacyRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'b1', title: 'React 文档', url: 'https://react.dev/learn' }),
    analysis: { summary: 'React official docs', tags: ['docs'] },
    source: 'ai_naming',
    now: 1000
  })
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.bookmarkTagIndex]: {
      version: 1,
      updatedAt: 1000,
      records: { b1: legacyRecord }
    }
  }
  const indexedDb = createIndexedDbMock()
  ;(globalThis as any).chrome = createChromeMock({ store })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  const loaded = await loadBookmarkTagIndex()
  const compactLocal = normalizeBookmarkTagIndex(store[STORAGE_KEYS.bookmarkTagIndex])
  const idbRecords = indexedDb.dumpStore('bookmarkTags')

  assert.equal(loaded.records.b1.summary, 'React official docs')
  assert.equal(compactLocal.records.b1, undefined)
  assert.equal((store[STORAGE_KEYS.bookmarkTagIndex] as any).migratedTo, 'indexedDB')
  assert.equal(idbRecords.b1.summary, 'React official docs')
  assert.equal(indexedDb.dumpStore('metadata').bookmarkTags.recordCount, 1)
})

test('tag repository upsert writes only changed records to IndexedDB after migration', async () => {
  const indexedDb = createIndexedDbMock()
  const legacyRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'b1', title: 'React 文档', url: 'https://react.dev/learn' }),
    analysis: { summary: 'React official docs', tags: ['docs'] },
    source: 'ai_naming',
    now: 1000
  })
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.bookmarkTagIndex]: {
      version: 1,
      updatedAt: 1000,
      records: { b1: legacyRecord }
    }
  }
  ;(globalThis as any).chrome = createChromeMock({ store })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  await loadBookmarkTagIndex()
  indexedDb.clearWrites()
  await upsertBookmarkTagRecord(buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'b2', title: 'MDN', url: 'https://developer.mozilla.org/' }),
    analysis: { summary: 'MDN docs', tags: ['web'] },
    source: 'popup_smart',
    now: 2000
  })!)

  const writes = indexedDb.writesForStore('bookmarkTags')
  assert.deepEqual(writes.map((write) => write.type), ['put'])
  assert.equal(writes[0].key, 'b2')
  assert.equal(indexedDb.dumpStore('bookmarkTags').b1.summary, 'React official docs')
  assert.equal(indexedDb.dumpStore('bookmarkTags').b2.summary, 'MDN docs')
  assert.equal(Object.keys(normalizeBookmarkTagIndex(store[STORAGE_KEYS.bookmarkTagIndex]).records).length, 0)
})

test('tag repository falls back to newer local data when IndexedDB is stale', async () => {
  const indexedDb = createIndexedDbMock()
  indexedDb.seedStore('bookmarkTags', {
    b1: buildBookmarkTagRecord({
      bookmark: bookmark({ id: 'b1', title: 'Old', url: 'https://old.example/' }),
      analysis: { summary: 'old summary', tags: ['old'] },
      source: 'ai_naming',
      now: 1000
    })
  })
  indexedDb.seedStore('metadata', {
    bookmarkTags: {
      key: 'bookmarkTags',
      version: 1,
      updatedAt: 1000,
      recordCount: 1,
      migratedAt: 1000
    }
  })
  const localRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'b2', title: 'New', url: 'https://new.example/' }),
    analysis: { summary: 'new summary', tags: ['new'] },
    source: 'popup_smart',
    now: 3000
  })
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.bookmarkTagIndex]: {
      version: 1,
      updatedAt: 3000,
      records: { b2: localRecord }
    }
  }
  ;(globalThis as any).chrome = createChromeMock({ store })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  const loaded = await loadBookmarkTagIndex()

  assert.equal(loaded.records.b1, undefined)
  assert.equal(loaded.records.b2.summary, 'new summary')
  assert.equal(indexedDb.dumpStore('bookmarkTags').b2.summary, 'new summary')
})

test('tag repository falls back to local writes when IndexedDB write fails', async () => {
  const indexedDb = createIndexedDbMock({ failWrites: true })
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeMock({ store })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  const saved = await saveBookmarkTagIndex({
    version: 1,
    updatedAt: 1000,
    records: {
      b1: buildBookmarkTagRecord({
        bookmark: bookmark({ id: 'b1', title: 'React', url: 'https://react.dev/' }),
        analysis: { summary: 'React', tags: ['react'] },
        source: 'ai_naming',
        now: 1000
      })!
    }
  })

  assert.equal(saved.records.b1.summary, 'React')
  assert.equal(normalizeBookmarkTagIndex(store[STORAGE_KEYS.bookmarkTagIndex]).records.b1.summary, 'React')
})

test('content snapshot repository migrates and applies record-level updates', async () => {
  const indexedDb = createIndexedDbMock()
  const { record: firstRecord } = buildContentSnapshotRecord({
    bookmark: bookmark({ id: 'b1', title: 'React', url: 'https://react.dev/' }),
    context: { mainText: 'React docs full text', contentType: 'docs' },
    settings: contentSnapshotSettings(),
    now: 1000
  })
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.contentSnapshotIndex]: {
      version: 1,
      updatedAt: 1000,
      records: { b1: firstRecord }
    }
  }
  ;(globalThis as any).chrome = createChromeMock({ store })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  await loadContentSnapshotIndex()
  indexedDb.clearWrites()
  await saveContentSnapshotFromContext({
    bookmark: bookmark({ id: 'b2', title: 'MDN', url: 'https://developer.mozilla.org/' }),
    context: { mainText: 'MDN docs full text', contentType: 'docs' },
    settings: contentSnapshotSettings(),
    now: 2000
  })

  const writes = indexedDb.writesForStore('contentSnapshots')
  assert.deepEqual(writes.map((write) => write.type), ['put'])
  assert.equal(writes[0].key, 'b2')
  assert.equal(indexedDb.dumpStore('contentSnapshots').b1.summary, 'React docs full text')
  assert.equal(indexedDb.dumpStore('contentSnapshots').b2.summary, 'MDN docs full text')
  assert.equal(Object.keys(normalizeContentSnapshotIndex(store[STORAGE_KEYS.contentSnapshotIndex]).records).length, 0)
})

test('backup exports repository records instead of compact local metadata', async () => {
  const indexedDb = createIndexedDbMock()
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.newTabActivity]: {
      pinnedIds: ['b1'],
      records: {
        b1: activityRecord('b1', 2000)
      }
    }
  }
  ;(globalThis as any).chrome = createChromeMock({
    store,
    tree: [rootNode([
      folderNode('1', 'Bookmarks Bar', [
        bookmarkNode('b1', 'React', 'https://react.dev/', '1')
      ])
    ])]
  })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  await saveBookmarkTagIndex({
    version: 1,
    updatedAt: 1000,
    records: {
      b1: buildBookmarkTagRecord({
        bookmark: bookmark({ id: 'b1', title: 'React', url: 'https://react.dev/' }),
        analysis: { summary: 'repository tag', tags: ['react'] },
        source: 'ai_naming',
        now: 1000
      })!
    }
  })
  await loadNewTabActivityFromRepository(normalizeActivityForTest)

  const backup = await createCuratorBackupFile('manual', Date.UTC(2026, 4, 8))

  assert.equal(backup.storage.bookmarkTagIndex.records.b1.summary, 'repository tag')
  assert.equal(Object.keys(normalizeBookmarkTagIndex(store[STORAGE_KEYS.bookmarkTagIndex]).records).length, 0)
  assert.equal((backup.storage.newTab.activity as any).records.b1.lastOpenedAt, 2000)
  assert.equal(Object.keys((store[STORAGE_KEYS.newTabActivity] as any).records).length, 0)
})

test('activity repository migrates legacy local records and keeps pinned ids compact', async () => {
  const indexedDb = createIndexedDbMock()
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.newTabActivity]: {
      pinnedIds: ['b1'],
      records: {
        b1: activityRecord('b1', 1000),
        b2: activityRecord('b2', 2000)
      }
    }
  }
  ;(globalThis as any).chrome = createChromeMock({ store })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  const loaded = await loadNewTabActivityFromRepository(normalizeActivityForTest)

  assert.deepEqual(loaded.pinnedIds, ['b1'])
  assert.equal(loaded.records.b2.title, 'Bookmark b2')
  assert.equal(indexedDb.dumpStore('activityRecords').b1.bookmarkId, 'b1')
  assert.equal(indexedDb.dumpStore('metadata').newTabActivity.recordCount, 2)
  assert.deepEqual((store[STORAGE_KEYS.newTabActivity] as any).pinnedIds, ['b1'])
  assert.equal(Object.keys((store[STORAGE_KEYS.newTabActivity] as any).records).length, 0)
})

test('activity repository upserts a single opened bookmark record after migration', async () => {
  const indexedDb = createIndexedDbMock()
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.newTabActivity]: {
      pinnedIds: [],
      records: {
        b1: activityRecord('b1', 1000)
      }
    }
  }
  ;(globalThis as any).chrome = createChromeMock({ store })
  ;(globalThis as any).indexedDB = indexedDb.indexedDB

  const loaded = await loadNewTabActivityFromRepository(normalizeActivityForTest)
  indexedDb.clearWrites()
  const saved = await upsertNewTabActivityRecordInRepository(
    loaded,
    activityRecord('b2', 3000),
    normalizeActivityForTest
  )

  const writes = indexedDb.writesForStore('activityRecords')
  assert.deepEqual(writes.map((write) => write.type), ['put'])
  assert.equal(writes[0].key, 'b2')
  assert.equal(saved.records.b1.bookmarkId, 'b1')
  assert.equal(saved.records.b2.lastOpenedAt, 3000)
  assert.equal(indexedDb.dumpStore('activityRecords').b2.lastOpenedAt, 3000)
})

function bookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  const title = overrides.title || 'Example'
  const url = overrides.url || 'https://example.com'
  return {
    id: overrides.id || title,
    title,
    url,
    displayUrl: overrides.displayUrl || url,
    normalizedTitle: overrides.normalizedTitle || title.toLowerCase(),
    normalizedUrl: overrides.normalizedUrl || url.replace(/^https?:\/\//, '').toLowerCase(),
    duplicateKey: overrides.duplicateKey || url,
    domain: overrides.domain || 'example.com',
    path: overrides.path || 'Bookmarks Bar',
    ancestorIds: overrides.ancestorIds || ['1'],
    parentId: overrides.parentId || '1',
    index: overrides.index || 0,
    dateAdded: overrides.dateAdded || 0
  }
}

function contentSnapshotSettings() {
  return {
    version: 1 as const,
    enabled: true,
    autoCaptureOnBookmarkCreate: true,
    saveFullText: true,
    fullTextSearchEnabled: true,
    localOnlyNoAiUpload: true
  }
}

function activityRecord(bookmarkId: string, lastOpenedAt: number) {
  return {
    bookmarkId,
    title: `Bookmark ${bookmarkId}`,
    url: `https://example.com/${bookmarkId}`,
    openCount: 1,
    firstOpenedAt: lastOpenedAt,
    lastOpenedAt
  }
}

function normalizeActivityForTest(rawActivity: unknown) {
  const source = rawActivity && typeof rawActivity === 'object' && !Array.isArray(rawActivity)
    ? rawActivity as Record<string, unknown>
    : {}
  const rawRecords = source.records && typeof source.records === 'object' && !Array.isArray(source.records)
    ? source.records as Record<string, any>
    : {}
  const records: Record<string, ReturnType<typeof activityRecord>> = {}
  for (const [bookmarkId, rawRecord] of Object.entries(rawRecords)) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
      continue
    }
    records[bookmarkId] = {
      bookmarkId,
      title: String(rawRecord.title || ''),
      url: String(rawRecord.url || ''),
      openCount: Number(rawRecord.openCount) || 0,
      firstOpenedAt: Number(rawRecord.firstOpenedAt) || 0,
      lastOpenedAt: Number(rawRecord.lastOpenedAt) || 0
    }
  }
  return {
    pinnedIds: Array.isArray(source.pinnedIds) ? source.pinnedIds.map(String) : [],
    records
  }
}

function createChromeMock({
  store,
  tree = []
}: {
  store: Record<string, unknown>
  tree?: chrome.bookmarks.BookmarkTreeNode[]
}) {
  return {
    bookmarks: {
      getTree(callback: (nodes: chrome.bookmarks.BookmarkTreeNode[]) => void) {
        setTimeout(() => callback(tree), 0)
      }
    },
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
            callback()
          }, 0)
        },
        remove(keys: string | string[], callback: () => void) {
          setTimeout(() => {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              delete store[key]
            }
            callback()
          }, 0)
        }
      }
    },
    runtime: {
      getManifest: () => ({ version: '1.4.31' })
    }
  }
}

function createIndexedDbMock(options: { failWrites?: boolean } = {}) {
  const stores: Record<string, Record<string, any>> = {
    bookmarkTags: {},
    contentSnapshots: {},
    metadata: {}
  }
  const writes: Array<{ storeName: string; type: 'put' | 'delete' | 'clear'; key: string }> = []

  const createEventTarget = (initial: Record<string, unknown> = {}) => {
    const listeners: Record<string, Array<(event: any) => void>> = {}
    return {
      ...initial,
      addEventListener(type: string, listener: (event: any) => void) {
        listeners[type] ||= []
        listeners[type].push(listener)
      },
      dispatch(type: string, event: any = {}) {
        for (const listener of listeners[type] || []) {
          listener(event)
        }
      }
    }
  }

  const db: any = createEventTarget({
    objectStoreNames: {
      contains(storeName: string) {
        return storeName in stores
      }
    },
    createObjectStore(storeName: string) {
      stores[storeName] ||= {}
    },
    transaction(storeName: string, mode: IDBTransactionMode) {
      const transaction: any = createEventTarget({
        error: null
      })
      let failed = false
      const store = {
        get(key: string) {
          return createSuccessfulRequest(stores[storeName]?.[key])
        },
        getAll() {
          return createSuccessfulRequest(Object.values(stores[storeName] || {}))
        },
        put(record: Record<string, unknown>) {
          const key = getStoreRecordKey(storeName, record)
          if (options.failWrites && mode === 'readwrite') {
            failed = true
            transaction.error = new Error('indexeddb write failed')
            return createSuccessfulRequest(undefined)
          }
          stores[storeName] ||= {}
          stores[storeName][key] = structuredCloneFallback(record)
          writes.push({ storeName, type: 'put', key })
          return createSuccessfulRequest(undefined)
        },
        delete(key: string) {
          delete stores[storeName]?.[key]
          writes.push({ storeName, type: 'delete', key })
          return createSuccessfulRequest(undefined)
        },
        clear() {
          stores[storeName] = {}
          writes.push({ storeName, type: 'clear', key: '*' })
          return createSuccessfulRequest(undefined)
        }
      }
      transaction.objectStore = () => store
      setTimeout(() => {
        transaction.dispatch(failed ? 'abort' : 'complete')
      }, 0)
      return transaction
    },
    close() {}
  })

  return {
    indexedDB: {
      open() {
        const request: any = createEventTarget({
          result: db,
          error: null
        })
        setTimeout(() => {
          request.dispatch('upgradeneeded')
          request.dispatch('success')
        }, 0)
        return request
      }
    },
    seedStore(storeName: string, values: Record<string, unknown>) {
      stores[storeName] = structuredCloneFallback(values)
    },
    dumpStore(storeName: string) {
      return structuredCloneFallback(stores[storeName] || {})
    },
    writesForStore(storeName: string) {
      return writes.filter((write) => write.storeName === storeName)
    },
    clearWrites() {
      writes.length = 0
    }
  }

  function createSuccessfulRequest(result: unknown) {
    const request: any = createEventTarget({ result, error: null })
    setTimeout(() => request.dispatch('success'), 0)
    return request
  }
}

function getStoreRecordKey(storeName: string, record: Record<string, unknown>): string {
  if (storeName === 'metadata') {
    return String(record.key || '')
  }
  return String(record.bookmarkId || '')
}

function structuredCloneFallback<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function rootNode(children: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode {
  return {
    id: '0',
    title: '',
    children
  }
}

function folderNode(
  id: string,
  title: string,
  children: chrome.bookmarks.BookmarkTreeNode[],
  parentId = '0'
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    title,
    children
  }
}

function bookmarkNode(
  id: string,
  title: string,
  url: string,
  parentId: string
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    title,
    url
  }
}
