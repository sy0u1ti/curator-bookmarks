import { STORAGE_KEYS } from '../constants.js'
import { getLocalStorage, setLocalStorage } from '../storage.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotRecord
} from '../content-snapshot-search.js'
import {
  CURATOR_DATA_STORES,
  applyCuratorDataStoreDelta,
  isCuratorDataDbAvailable,
  readCuratorDataStore,
  readCuratorDataStoreMeta,
  resetCuratorDataDbForTest,
  replaceCuratorDataStore,
  writeCuratorDataStoreMeta
} from './curator-data-db.js'

const CONTENT_SNAPSHOT_REPOSITORY_META_KEY = 'contentSnapshots'

type NormalizeContentSnapshotIndex = (rawIndex: unknown) => ContentSnapshotIndex
type NormalizeContentSnapshotRecord = (rawRecord: unknown) => ContentSnapshotRecord

interface ContentSnapshotRepositoryNormalizers {
  normalizeIndex: NormalizeContentSnapshotIndex
  normalizeRecord: NormalizeContentSnapshotRecord
}

let normalizers: ContentSnapshotRepositoryNormalizers | null = null

export function configureContentSnapshotRepository(normalizerConfig: ContentSnapshotRepositoryNormalizers): void {
  normalizers = normalizerConfig
}

export async function loadContentSnapshotIndexFromRepository(): Promise<ContentSnapshotIndex> {
  const { normalizeIndex } = requireContentSnapshotRepositoryNormalizers()
  const idbIndex = await loadContentSnapshotIndexFromIndexedDb().catch(() => null)
  if (idbIndex) {
    const localIndex = await loadContentSnapshotIndexFromLocalStorage().catch(() => normalizeIndex(null))
    if (
      Object.keys(localIndex.records).length &&
      (
        Object.keys(idbIndex.records).length === 0 ||
        Number(localIndex.updatedAt) > Number(idbIndex.updatedAt)
      )
    ) {
      await migrateContentSnapshotIndexToIndexedDb(localIndex).catch(() => {})
      return localIndex
    }
    return idbIndex
  }

  const localIndex = await loadContentSnapshotIndexFromLocalStorage()
  if (Object.keys(localIndex.records).length && isCuratorDataDbAvailable()) {
    await migrateContentSnapshotIndexToIndexedDb(localIndex).catch(() => {})
  }
  return normalizeIndex(localIndex)
}

export async function updateContentSnapshotIndexInRepository(
  updater: (index: ContentSnapshotIndex) => ContentSnapshotIndex
): Promise<ContentSnapshotIndex> {
  const { normalizeIndex } = requireContentSnapshotRepositoryNormalizers()
  const current = await loadContentSnapshotIndexFromRepository()
  const nextIndex = normalizeIndex(updater(current))

  if (!isCuratorDataDbAvailable()) {
    await writeContentSnapshotIndexToLocalStorage(nextIndex)
    return nextIndex
  }

  try {
    const delta = diffContentSnapshotIndexes(current, nextIndex)
    if (delta.replaceAll) {
      await replaceContentSnapshotIndexInIndexedDb(nextIndex)
    } else {
      await applyCuratorDataStoreDelta(
        CURATOR_DATA_STORES.contentSnapshots,
        delta.upserts,
        delta.deletedIds
      )
      await writeContentSnapshotRepositoryMeta(nextIndex)
    }
    await compactContentSnapshotIndexLocalStorage(nextIndex).catch(() => {})
  } catch {
    await writeContentSnapshotIndexToLocalStorage(nextIndex)
  }
  return nextIndex
}

export function resetContentSnapshotRepositoryForTest(): void {
  resetCuratorDataDbForTest()
}

async function loadContentSnapshotIndexFromIndexedDb(): Promise<ContentSnapshotIndex | null> {
  const { normalizeIndex, normalizeRecord } = requireContentSnapshotRepositoryNormalizers()
  if (!isCuratorDataDbAvailable()) {
    return null
  }

  const meta = await readCuratorDataStoreMeta(CONTENT_SNAPSHOT_REPOSITORY_META_KEY)
  if (!meta) {
    return null
  }

  const records: Record<string, ContentSnapshotRecord> = {}
  const storedRecords = await readCuratorDataStore<ContentSnapshotRecord>(CURATOR_DATA_STORES.contentSnapshots)
  if (storedRecords.length < meta.recordCount) {
    return null
  }
  for (const rawRecord of storedRecords) {
    const record = normalizeRecord(rawRecord)
    if (record.bookmarkId && record.snapshotId) {
      records[record.bookmarkId] = record
    }
  }

  return normalizeIndex({
    version: 1,
    updatedAt: meta.updatedAt,
    records
  })
}

async function loadContentSnapshotIndexFromLocalStorage(): Promise<ContentSnapshotIndex> {
  const { normalizeIndex } = requireContentSnapshotRepositoryNormalizers()
  const stored = await getLocalStorage([STORAGE_KEYS.contentSnapshotIndex])
  return normalizeIndex(stored[STORAGE_KEYS.contentSnapshotIndex])
}

async function migrateContentSnapshotIndexToIndexedDb(index: ContentSnapshotIndex): Promise<void> {
  await replaceContentSnapshotIndexInIndexedDb(index)
  await compactContentSnapshotIndexLocalStorage(index).catch(() => {})
}

async function replaceContentSnapshotIndexInIndexedDb(index: ContentSnapshotIndex): Promise<void> {
  await replaceCuratorDataStore(
    CURATOR_DATA_STORES.contentSnapshots,
    Object.values(index.records)
  )
  await writeContentSnapshotRepositoryMeta(index)
}

async function writeContentSnapshotRepositoryMeta(index: ContentSnapshotIndex): Promise<void> {
  await writeCuratorDataStoreMeta({
    key: CONTENT_SNAPSHOT_REPOSITORY_META_KEY,
    version: 1,
    updatedAt: Number(index.updatedAt) || 0,
    recordCount: Object.keys(index.records || {}).length,
    migratedAt: Date.now(),
    compactedAt: Date.now()
  })
}

async function compactContentSnapshotIndexLocalStorage(index: ContentSnapshotIndex): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.contentSnapshotIndex]: {
      version: 1,
      updatedAt: Number(index.updatedAt) || 0,
      records: {},
      migratedTo: 'indexedDB',
      repository: CONTENT_SNAPSHOT_REPOSITORY_META_KEY,
      recordCount: Object.keys(index.records || {}).length,
      compactedAt: Date.now()
    }
  })
}

async function writeContentSnapshotIndexToLocalStorage(index: ContentSnapshotIndex): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.contentSnapshotIndex]: index
  })
}

function diffContentSnapshotIndexes(
  current: ContentSnapshotIndex,
  nextIndex: ContentSnapshotIndex
): {
  replaceAll: boolean
  upserts: ContentSnapshotRecord[]
  deletedIds: string[]
} {
  const currentRecords = current.records || {}
  const nextRecords = nextIndex.records || {}
  const currentIds = Object.keys(currentRecords)
  const nextIds = Object.keys(nextRecords)
  const upserts: ContentSnapshotRecord[] = []
  const deletedIds: string[] = []

  for (const id of nextIds) {
    if (!areContentSnapshotRecordsEquivalent(currentRecords[id], nextRecords[id])) {
      upserts.push(nextRecords[id])
    }
  }
  for (const id of currentIds) {
    if (!(id in nextRecords)) {
      deletedIds.push(id)
    }
  }

  return {
    replaceAll: upserts.length + deletedIds.length > Math.max(250, Math.ceil(nextIds.length * 0.4)),
    upserts,
    deletedIds
  }
}

function areContentSnapshotRecordsEquivalent(
  left: ContentSnapshotRecord | undefined,
  right: ContentSnapshotRecord | undefined
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return left.bookmarkId === right.bookmarkId &&
    left.snapshotId === right.snapshotId &&
    left.extractedAt === right.extractedAt &&
    left.fullTextStorage === right.fullTextStorage &&
    left.fullTextRef === right.fullTextRef &&
    left.summary === right.summary &&
    left.title === right.title &&
    left.finalUrl === right.finalUrl
}

function requireContentSnapshotRepositoryNormalizers(): ContentSnapshotRepositoryNormalizers {
  if (!normalizers) {
    throw new Error('Content snapshot repository normalizers are not configured.')
  }
  return normalizers
}
