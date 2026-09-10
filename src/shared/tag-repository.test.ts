import assert from 'node:assert/strict'
import test from 'node:test'
import { IDBFactory } from 'fake-indexeddb'
import {
  __resetBookmarkTagRepositoryForTest,
  buildBookmarkTagRecord,
  loadBookmarkTagIndex,
  removeBookmarkTagRecord,
  removeBookmarkTagRecords,
  restoreBookmarkTagIndexSnapshot,
  upsertBookmarkTagsFromAnalysis,
  type BookmarkTagRecord,
  type BookmarkTagIndex
} from './bookmark-tags.js'
import { STORAGE_KEYS } from './constants.js'
import {
  __resetContentSnapshotRepositoryForTest,
  loadContentSnapshotIndex,
  removeContentSnapshotForBookmark,
  removeContentSnapshotsForBookmarks,
  saveContentSnapshotFromContext,
  saveContentSnapshotsFromContexts,
  setContentFullTextOperationsForTest,
  type ContentFullTextRecord
} from './content-snapshots.js'
import {
  readCuratorDataStoreMeta,
  setCuratorDataDbFailureForTest
} from './repositories/curator-data-db.js'
import { applyBookmarkTagRecordsDeltaInRepository } from './repositories/tag-repository.js'
import { createBookmarkRemovalQueue } from '../service-worker/bookmark-removal-queue.js'

class NonReentrantTestLockManager {
  requestCount = 0
  private queue = Promise.resolve()

  request<T>(
    name: string,
    _options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>
  ): Promise<T> {
    this.requestCount += 1
    const result = this.queue.then(() => callback({
      name,
      mode: 'exclusive'
    } as Lock))
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}

const lockManager = new NonReentrantTestLockManager()
let storageState: Record<string, unknown> = {}
let runtimeError = ''
let failStorageSet = false

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    locks: lockManager
  }
})

Object.defineProperty(globalThis, 'indexedDB', {
  configurable: true,
  writable: true,
  value: new IDBFactory()
})

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      get lastError() {
        return runtimeError
          ? { message: runtimeError }
          : undefined
      }
    },
    storage: {
      local: {
        get(keys: string[] | string, callback: (items: Record<string, unknown>) => void) {
          const requestedKeys = Array.isArray(keys) ? keys : [keys]
          const result: Record<string, unknown> = {}
          for (const key of requestedKeys) {
            if (Object.prototype.hasOwnProperty.call(storageState, key)) {
              result[key] = structuredClone(storageState[key])
            }
          }
          callback(result)
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          if (failStorageSet) {
            runtimeError = 'simulated tag compaction failure'
            callback()
            runtimeError = ''
            return
          }
          for (const [key, value] of Object.entries(payload)) {
            storageState[key] = structuredClone(value)
          }
          callback()
        },
        remove(keys: string[] | string, callback: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete storageState[key]
          }
          callback()
        }
      }
    }
  } as unknown as typeof chrome
})

test('migrates legacy tag records under one non-reentrant storage lock', async () => {
  __resetBookmarkTagRepositoryForTest()
  globalThis.indexedDB = new IDBFactory()
  lockManager.requestCount = 0
  runtimeError = ''
  failStorageSet = false
  storageState = {
    [STORAGE_KEYS.bookmarkTagIndex]: {
      version: 1,
      updatedAt: 10,
      records: {
        legacy: {
          schemaVersion: 1,
          bookmarkId: 'legacy',
          url: 'https://legacy.example/',
          normalizedUrl: 'https://legacy.example/',
          duplicateKey: 'legacy.example',
          title: 'Legacy',
          path: 'Bookmarks',
          summary: '',
          contentType: '',
          topics: [],
          tags: ['legacy'],
          aliases: [],
          confidence: 1,
          source: 'imported',
          model: '',
          extraction: {
            status: '',
            source: '',
            warnings: []
          },
          generatedAt: 10,
          updatedAt: 10
        }
      }
    }
  }

  let deadlockTimer: ReturnType<typeof setTimeout> | undefined
  const loaded = await Promise.race([
    loadBookmarkTagIndex(),
    new Promise<never>((_resolve, reject) => {
      deadlockTimer = setTimeout(
        () => reject(new Error('legacy tag migration deadlocked')),
        500
      )
    })
  ]).finally(() => {
    if (deadlockTimer) {
      clearTimeout(deadlockTimer)
    }
  })

  assert.equal(loaded.records.legacy?.bookmarkId, 'legacy')
  assert.deepEqual(
    (storageState[STORAGE_KEYS.bookmarkTagIndex] as { records?: unknown }).records,
    {},
    'successful migration must compact the legacy local records'
  )
  assert.equal(
    lockManager.requestCount,
    1,
    'migration must reuse the active transaction instead of requesting the same lock again'
  )
})

test('strict tag snapshot restore rejects a failed local compaction and remains retryable', async () => {
  __resetBookmarkTagRepositoryForTest()
  globalThis.indexedDB = new IDBFactory()
  lockManager.requestCount = 0
  runtimeError = ''
  failStorageSet = false
  storageState = {}

  const snapshot = {
    version: 1,
    updatedAt: 20,
    records: {
      restored: {
        schemaVersion: 1,
        bookmarkId: 'restored',
        url: 'https://restored.example/',
        normalizedUrl: 'https://restored.example/',
        duplicateKey: 'restored.example',
        title: 'Restored',
        path: 'Bookmarks',
        summary: '',
        contentType: '',
        topics: [],
        tags: ['restored'],
        aliases: [],
        confidence: 1,
        source: 'manual',
        model: '',
        extraction: {
          status: '',
          source: '',
          warnings: []
        },
        generatedAt: 20,
        updatedAt: 20
      }
    }
  } satisfies BookmarkTagIndex

  failStorageSet = true
  await assert.rejects(
    restoreBookmarkTagIndexSnapshot(snapshot),
    /simulated tag compaction failure/
  )

  failStorageSet = false
  await restoreBookmarkTagIndexSnapshot(snapshot)

  const restored = await loadBookmarkTagIndex()
  assert.deepEqual(restored.records.restored?.tags, ['restored'])
  assert.deepEqual(
    (storageState[STORAGE_KEYS.bookmarkTagIndex] as { records?: unknown }).records,
    {},
    'successful retry must leave the local compatibility record compacted'
  )
})

test('batch tag analysis commits multiple records under one storage lock', async () => {
  resetTestStorage()

  const records = await upsertBookmarkTagsFromAnalysis([
    createTagAnalysisInput('batch-a', ['alpha']),
    createTagAnalysisInput('batch-b', ['beta'])
  ])

  assert.equal(records.length, 2)
  assert.equal(lockManager.requestCount, 1)
  const loaded = await loadBookmarkTagIndex()
  assert.deepEqual(loaded.records['batch-a']?.tags, ['alpha'])
  assert.deepEqual(loaded.records['batch-b']?.tags, ['beta'])
  const meta = await readCuratorDataStoreMeta('bookmarkTags')
  assert.equal(meta?.recordCount, 2)
})

test('record-level tag delta preserves records committed by another context', async () => {
  resetTestStorage()
  await upsertBookmarkTagsFromAnalysis([
    createTagAnalysisInput('delta-a', ['alpha']),
    createTagAnalysisInput('delta-b', ['beta'])
  ])
  const current = await loadBookmarkTagIndex()
  const staleIndex: BookmarkTagIndex = {
    ...current,
    records: {
      'delta-a': current.records['delta-a']
    }
  }
  const record = buildBookmarkTagRecord(createTagAnalysisInput('delta-c', ['gamma']))
  assert.ok(record)

  await applyBookmarkTagRecordsDeltaInRepository(staleIndex, {
    upserts: [record as BookmarkTagRecord],
    updatedAt: Date.now()
  })

  const loaded = await loadBookmarkTagIndex()
  assert.deepEqual(Object.keys(loaded.records).sort(), ['delta-a', 'delta-b', 'delta-c'])
  const meta = await readCuratorDataStoreMeta('bookmarkTags')
  assert.equal(meta?.recordCount, 3)
})

test('batch snapshots use one blob batch and one index transaction', async () => {
  resetTestStorage({ snapshots: true })
  const blobs = new Map<string, ContentFullTextRecord>()
  let putManyCalls = 0
  const restoreOperations = setContentFullTextOperationsForTest({
    putMany: async (records) => {
      putManyCalls += 1
      for (const record of records) {
        blobs.set(record.snapshotId, structuredClone(record))
      }
    },
    deleteMany: async (snapshotIds) => {
      for (const snapshotId of snapshotIds) {
        blobs.delete(snapshotId)
      }
    }
  })

  try {
    const records = await saveContentSnapshotsFromContexts([
      createSnapshotInput('snapshot-a', 100),
      createSnapshotInput('snapshot-b', 101)
    ])

    assert.equal(records.length, 2)
    assert.equal(putManyCalls, 1)
    assert.equal(blobs.size, 2)
    assert.equal(lockManager.requestCount, 1)
    const loaded = await loadContentSnapshotIndex()
    assert.deepEqual(Object.keys(loaded.records).sort(), ['snapshot-a', 'snapshot-b'])
    const meta = await readCuratorDataStoreMeta('contentSnapshots')
    assert.equal(meta?.recordCount, 2)
  } finally {
    restoreOperations()
  }
})

test('failed snapshot index commit removes the new blob and preserves the previous blob', async () => {
  resetTestStorage({ snapshots: true })
  const blobs = new Map<string, ContentFullTextRecord>()
  const deletedSnapshotIds: string[] = []
  const restoreOperations = setContentFullTextOperationsForTest({
    putMany: async (records) => {
      for (const record of records) {
        blobs.set(record.snapshotId, structuredClone(record))
      }
    },
    deleteMany: async (snapshotIds) => {
      deletedSnapshotIds.push(...snapshotIds)
      for (const snapshotId of snapshotIds) {
        blobs.delete(snapshotId)
      }
    }
  })

  try {
    const previous = await saveContentSnapshotFromContext(
      createSnapshotInput('snapshot-replace', 200)
    )
    assert.ok(previous?.fullTextRef)
    const previousFullTextRef = previous?.fullTextRef || ''

    failStorageSet = true
    setCuratorDataDbFailureForTest((operation) => (
      operation === 'apply-delta-with-meta'
        ? new Error('simulated snapshot index failure')
        : null
    ))
    await assert.rejects(
      saveContentSnapshotFromContext(createSnapshotInput('snapshot-replace', 201)),
      /simulated tag compaction failure/
    )

    failStorageSet = false
    setCuratorDataDbFailureForTest(null)
    const afterFailure = await loadContentSnapshotIndex()
    assert.equal(afterFailure.records['snapshot-replace']?.fullTextRef, previousFullTextRef)
    assert.equal(blobs.has(previousFullTextRef), true)
    assert.equal(blobs.has('snapshot-snapshot-replace-201'), false)
    assert.equal(deletedSnapshotIds.includes(previousFullTextRef), false)

    const saved = await saveContentSnapshotFromContext(
      createSnapshotInput('snapshot-replace', 202)
    )
    assert.equal(saved?.fullTextRef, 'snapshot-snapshot-replace-202')
    assert.equal(blobs.has(previousFullTextRef), false)
    assert.equal(blobs.has('snapshot-snapshot-replace-202'), true)
  } finally {
    failStorageSet = false
    setCuratorDataDbFailureForTest(null)
    restoreOperations()
  }
})

test('a bookmark removal burst shares two index transactions and keeps surviving records and blobs', async () => {
  resetTestStorage({ snapshots: true })
  const blobs = new Map<string, ContentFullTextRecord>()
  const deletedBatches: string[][] = []
  const restoreOperations = setContentFullTextOperationsForTest({
    putMany: async (records) => {
      for (const record of records) blobs.set(record.snapshotId, record)
    },
    deleteMany: async (snapshotIds) => {
      deletedBatches.push(snapshotIds)
      for (const snapshotId of snapshotIds) blobs.delete(snapshotId)
    }
  })

  try {
    const bookmarkIds = ['cleanup-a', 'cleanup-b', 'cleanup-c', 'cleanup-keep']
    await upsertBookmarkTagsFromAnalysis(bookmarkIds.map((id) => createTagAnalysisInput(id, ['tag'])))
    await saveContentSnapshotsFromContexts(bookmarkIds.map((id, index) => createSnapshotInput(id, 500 + index)))
    const beforeTags = await loadBookmarkTagIndex()
    const beforeSnapshots = await loadContentSnapshotIndex()
    const batches: string[][] = []
    const enqueue = createBookmarkRemovalQueue(async (ids) => {
      batches.push(ids)
      await Promise.all([
        removeBookmarkTagRecords(ids),
        removeContentSnapshotsForBookmarks(ids, 600)
      ])
    })

    lockManager.requestCount = 0
    await Promise.all(['cleanup-a', 'cleanup-b', 'cleanup-c', 'cleanup-b', 'missing'].map(enqueue))
    assert.equal(lockManager.requestCount, 2, 'a burst should acquire each index write lock once')
    assert.deepEqual(batches, [['cleanup-a', 'cleanup-b', 'cleanup-c', 'missing']])
    assert.equal(deletedBatches.length, 1)
    assert.equal(deletedBatches[0]?.length, 3)
    const afterTags = await loadBookmarkTagIndex()
    const afterSnapshots = await loadContentSnapshotIndex()
    assert.deepEqual(Object.keys(afterTags.records), ['cleanup-keep'])
    assert.deepEqual(Object.keys(afterSnapshots.records), ['cleanup-keep'])
    assert.deepEqual(afterTags.records['cleanup-keep'], beforeTags.records['cleanup-keep'])
    assert.deepEqual(afterSnapshots.records['cleanup-keep'], beforeSnapshots.records['cleanup-keep'])
    assert.deepEqual([...blobs.keys()], [beforeSnapshots.records['cleanup-keep'].fullTextRef])
    assert.equal((await readCuratorDataStoreMeta('bookmarkTags'))?.recordCount, 1)
    assert.equal((await readCuratorDataStoreMeta('contentSnapshots'))?.recordCount, 1)

    assert.equal(await removeContentSnapshotForBookmark('missing'), false)
    assert.equal(await removeContentSnapshotForBookmark('cleanup-keep'), true)
    const emptyTags = await removeBookmarkTagRecord('cleanup-keep')
    assert.deepEqual(emptyTags.records, {})
  } finally {
    restoreOperations()
  }
})

test('removal events arriving during a failed batch are drained and later batches remain usable', async () => {
  const batches: string[][] = []
  let finishFirst: (() => void) | undefined
  const firstBatchWait = new Promise<void>((resolve) => { finishFirst = resolve })
  const enqueue = createBookmarkRemovalQueue(async (ids) => {
    batches.push(ids)
    if (batches.length === 1) {
      await firstBatchWait
      throw new Error('failed first cleanup')
    }
  })
  const first = enqueue('first')
  await Promise.resolve()
  const second = enqueue('second')
  enqueue('second')
  const third = enqueue('third')
  const rejected = assert.rejects(Promise.all([first, second, third]), /failed first cleanup/)
  finishFirst?.()
  await rejected
  assert.deepEqual(batches, [['first'], ['second', 'third']])
  await enqueue('later')
  assert.deepEqual(batches, [['first'], ['second', 'third'], ['later']])
})

test('a failed bulk snapshot removal leaves its full text available until a successful retry', async () => {
  resetTestStorage({ snapshots: true })
  const deletedIds: string[] = []
  const restoreOperations = setContentFullTextOperationsForTest({
    putMany: async () => {},
    deleteMany: async (ids) => { deletedIds.push(...ids) }
  })
  try {
    const saved = await saveContentSnapshotsFromContexts([
      createSnapshotInput('retry-a', 700),
      createSnapshotInput('retry-b', 701)
    ])
    failStorageSet = true
    setCuratorDataDbFailureForTest((operation) => operation === 'apply-delta-with-meta'
      ? new Error('simulated cleanup index failure')
      : null)
    await assert.rejects(removeContentSnapshotsForBookmarks(['retry-a', 'retry-b']), /simulated tag compaction failure/)
    assert.deepEqual(deletedIds, [], 'the index must commit before its full text is discarded')
    failStorageSet = false
    setCuratorDataDbFailureForTest(null)
    const afterFailure = await loadContentSnapshotIndex()
    assert.equal(Object.keys(afterFailure.records).length, 2)
    assert.equal(await removeContentSnapshotsForBookmarks(['retry-a', 'retry-b']), 2)
    assert.deepEqual(deletedIds.sort(), saved.map((record) => record.fullTextRef).sort())
  } finally {
    failStorageSet = false
    setCuratorDataDbFailureForTest(null)
    restoreOperations()
  }
})

test('bulk tag removal remains ordered with queued upserts', async () => {
  resetTestStorage()
  await upsertBookmarkTagsFromAnalysis([
    createTagAnalysisInput('ordered-remove', ['old']),
    createTagAnalysisInput('ordered-keep', ['keep'])
  ])
  await Promise.all([
    removeBookmarkTagRecords(['ordered-remove']),
    upsertBookmarkTagsFromAnalysis([createTagAnalysisInput('ordered-new', ['new'])])
  ])
  assert.deepEqual(Object.keys((await loadBookmarkTagIndex()).records).sort(), ['ordered-keep', 'ordered-new'])
})

function resetTestStorage({ snapshots = false }: { snapshots?: boolean } = {}): void {
  __resetBookmarkTagRepositoryForTest()
  if (snapshots) {
    __resetContentSnapshotRepositoryForTest()
  }
  globalThis.indexedDB = new IDBFactory()
  lockManager.requestCount = 0
  runtimeError = ''
  failStorageSet = false
  storageState = {}
}

function createTagAnalysisInput(bookmarkId: string, tags: string[]) {
  return {
    bookmark: {
      id: bookmarkId,
      title: bookmarkId,
      url: `https://${bookmarkId}.example/`,
      path: 'Bookmarks'
    },
    analysis: {
      tags,
      summary: `${bookmarkId} summary`,
      confidence: 0.9
    },
    source: 'ai_naming' as const,
    model: 'test-model',
    now: 100
  }
}

function createSnapshotInput(bookmarkId: string, now: number) {
  return {
    bookmark: {
      id: bookmarkId,
      title: bookmarkId,
      url: `https://${bookmarkId}.example/`
    },
    context: {
      title: bookmarkId,
      mainText: `${bookmarkId} `.repeat(3_000),
      extractionStatus: 'success',
      source: 'page'
    },
    settings: {
      version: 1 as const,
      enabled: true,
      autoCaptureOnBookmarkCreate: true,
      saveFullText: true,
      fullTextSearchEnabled: true,
      localOnlyNoAiUpload: false
    },
    now
  }
}
