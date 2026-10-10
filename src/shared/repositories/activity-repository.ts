import { STORAGE_KEYS } from '../constants.js'
import { getLocalStorage, setLocalStorage, withLocalStorageTransaction, type LocalStorageTransaction } from '../storage.js'
import {
  CURATOR_DATA_STORES,
  applyCuratorDataStoreDeltaWithMeta,
  isCuratorDataDbAvailable,
  readCuratorDataStore,
  readCuratorDataStoreMeta,
  resetCuratorDataDbForTest,
  replaceCuratorDataStoreWithMeta,
  type CuratorDataStoreMeta
} from './curator-data-db.js'

const NEW_TAB_ACTIVITY_REPOSITORY_META_KEY = 'newTabActivity'

export interface NewTabActivityRepositoryRecord {
  bookmarkId: string
  title: string
  url: string
  openCount: number
  firstOpenedAt: number
  lastOpenedAt: number
}

export interface NewTabActivityRepositoryState {
  pinnedIds: string[]
  records: Record<string, NewTabActivityRepositoryRecord>
}

export function normalizeNewTabActivityRepositoryState(value: unknown): NewTabActivityRepositoryState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawRecords = source.records && typeof source.records === 'object' && !Array.isArray(source.records)
    ? source.records as Record<string, unknown> : {}
  const records: Record<string, NewTabActivityRepositoryRecord> = {}
  for (const [bookmarkId, value] of Object.entries(rawRecords)) {
    if (!bookmarkId || !value || typeof value !== 'object') continue
    const record = value as Record<string, unknown>
    const url = String(record.url || '').trim()
    const lastOpenedAt = Number(record.lastOpenedAt)
    const openCount = Math.min(Math.floor(Number(record.openCount)), 9999)
    if (!url || !Number.isFinite(lastOpenedAt) || lastOpenedAt <= 0 || !Number.isFinite(openCount) || openCount <= 0) continue
    const firstOpenedAt = Number(record.firstOpenedAt)
    records[bookmarkId] = {
      bookmarkId, url: url.slice(0, 2048), title: String(record.title || '').trim().slice(0, 160),
      openCount, lastOpenedAt,
      firstOpenedAt: Number.isFinite(firstOpenedAt) && firstOpenedAt > 0 ? firstOpenedAt : lastOpenedAt
    }
  }
  return {
    pinnedIds: Array.isArray(source.pinnedIds) ? [...new Set(source.pinnedIds.map(id => String(id || '').trim()).filter(Boolean))] : [],
    records
  }
}

export async function loadNewTabActivityFromRepository(
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState,
  transaction?: LocalStorageTransaction
): Promise<NewTabActivityRepositoryState> {
  if (!transaction) {
    return withLocalStorageTransaction(active => loadNewTabActivityFromRepository(normalizeActivity, active))
  }
  const stored = await getLocalStorage([STORAGE_KEYS.newTabActivity])
  const raw = stored[STORAGE_KEYS.newTabActivity] as { migratedTo?: string; records?: unknown } | undefined
  const localActivity = normalizeNewTabActivityRepositoryState(raw)
  // Inline records are an authoritative restore/fallback snapshot, even when
  // empty or older than IndexedDB. Only a compacted value delegates to IDB.
  if (raw && raw.migratedTo !== 'indexedDB' && raw.records && typeof raw.records === 'object') {
    // A read must not compact a restore snapshot: its exact storage value may
    // still be needed by interrupted-restore recovery. Migrate on the next write.
    return normalizeActivity(localActivity)
  }
  const idbActivity = await loadNewTabActivityFromIndexedDb(normalizeNewTabActivityRepositoryState)
  if (idbActivity) return normalizeActivity({ pinnedIds: localActivity.pinnedIds, records: idbActivity.records })
  if (raw?.migratedTo === 'indexedDB') throw new Error('访问记录仓库暂时不可读，请稍后重试。')
  return normalizeActivity(localActivity)
}

export async function saveNewTabActivityToRepository(
  activity: NewTabActivityRepositoryState,
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState,
  transaction?: LocalStorageTransaction
): Promise<NewTabActivityRepositoryState> {
  if (!transaction) return withLocalStorageTransaction(active => saveNewTabActivityToRepository(activity, normalizeActivity, active))
  const normalized = normalizeActivity(activity)
  if (!isCuratorDataDbAvailable()) {
    await writeNewTabActivityToLocalStorage(normalized, transaction)
    return normalized
  }

  try {
    await replaceNewTabActivityInIndexedDb(normalized)
    await compactNewTabActivityLocalStorage(normalized, transaction)
  } catch {
    await writeNewTabActivityToLocalStorage(normalized, transaction)
  }
  return normalized
}

export async function upsertNewTabActivityRecordInRepository(
  activity: NewTabActivityRepositoryState,
  record: NewTabActivityRepositoryRecord,
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState,
  transaction?: LocalStorageTransaction
): Promise<NewTabActivityRepositoryState> {
  if (!transaction) return withLocalStorageTransaction(active => upsertNewTabActivityRecordInRepository(activity, record, normalizeActivity, active))
  const normalized = normalizeActivity({
    ...activity,
    records: {
      ...activity.records,
      [record.bookmarkId]: record
    }
  })
  if (!isCuratorDataDbAvailable()) {
    await writeNewTabActivityToLocalStorage(normalized, transaction)
    return normalized
  }

  try {
    await persistNewTabActivityDelta(normalized, normalized.records[record.bookmarkId] ? [normalized.records[record.bookmarkId]] : [], [])
    // The storage event is the cross-page refresh signal; publish it only once
    // readers can observe the committed IndexedDB record and metadata.
    await compactNewTabActivityLocalStorage(normalized, transaction)
  } catch {
    await writeNewTabActivityToLocalStorage(normalized, transaction)
  }
  return normalized
}

export async function removeNewTabActivityRecordInRepository(
  activity: NewTabActivityRepositoryState,
  bookmarkId: string,
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState,
  transaction?: LocalStorageTransaction
): Promise<NewTabActivityRepositoryState> {
  if (!transaction) return withLocalStorageTransaction(active => removeNewTabActivityRecordInRepository(activity, bookmarkId, normalizeActivity, active))
  const normalizedId = String(bookmarkId || '').trim()
  const records = { ...activity.records }
  delete records[normalizedId]
  const normalized = normalizeActivity({
    pinnedIds: activity.pinnedIds.filter((id) => id !== normalizedId),
    records
  })
  if (!isCuratorDataDbAvailable()) {
    await writeNewTabActivityToLocalStorage(normalized, transaction)
    return normalized
  }

  try {
    await persistNewTabActivityDelta(normalized, [], [normalizedId])
    await compactNewTabActivityLocalStorage(normalized, transaction)
  } catch {
    await writeNewTabActivityToLocalStorage(normalized, transaction)
  }
  return normalized
}

async function loadNewTabActivityFromIndexedDb(
  normalizeActivity: (rawActivity: unknown) => NewTabActivityRepositoryState
): Promise<NewTabActivityRepositoryState | null> {
  if (!isCuratorDataDbAvailable()) {
    return null
  }

  const meta = await readCuratorDataStoreMeta(NEW_TAB_ACTIVITY_REPOSITORY_META_KEY)
  if (!meta) {
    return null
  }

  const records = await readCuratorDataStore<NewTabActivityRepositoryRecord>(CURATOR_DATA_STORES.activityRecords)
  if (records.length < meta.recordCount) {
    return null
  }

  return normalizeActivity({
    records: Object.fromEntries(records.map((record) => [record.bookmarkId, record]))
  })
}

async function persistNewTabActivityDelta(
  activity: NewTabActivityRepositoryState,
  upserts: NewTabActivityRepositoryRecord[],
  deletedIds: string[]
): Promise<void> {
  const stored = await getLocalStorage(STORAGE_KEYS.newTabActivity)
  const raw = stored[STORAGE_KEYS.newTabActivity] as { migratedTo?: string } | undefined
  if (raw?.migratedTo !== 'indexedDB') {
    // A restored or fallback snapshot must establish the whole IDB baseline
    // before publishing a compacted pointer, not only the changed record.
    await replaceNewTabActivityInIndexedDb(activity)
    return
  }
  await applyCuratorDataStoreDeltaWithMeta(
    CURATOR_DATA_STORES.activityRecords, upserts, deletedIds, buildNewTabActivityRepositoryMeta(activity)
  )
}

async function replaceNewTabActivityInIndexedDb(activity: NewTabActivityRepositoryState): Promise<void> {
  await replaceCuratorDataStoreWithMeta(
    CURATOR_DATA_STORES.activityRecords,
    Object.values(activity.records),
    buildNewTabActivityRepositoryMeta(activity)
  )
}

function buildNewTabActivityRepositoryMeta(activity: NewTabActivityRepositoryState): CuratorDataStoreMeta {
  return {
    key: NEW_TAB_ACTIVITY_REPOSITORY_META_KEY,
    version: 1,
    updatedAt: getLatestActivityUpdatedAt(activity.records),
    recordCount: Object.keys(activity.records || {}).length,
    migratedAt: Date.now(),
    compactedAt: Date.now()
  }
}

async function compactNewTabActivityLocalStorage(activity: NewTabActivityRepositoryState, transaction: LocalStorageTransaction): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabActivity]: {
      pinnedIds: activity.pinnedIds,
      records: {},
      migratedTo: 'indexedDB',
      repository: NEW_TAB_ACTIVITY_REPOSITORY_META_KEY,
      recordCount: Object.keys(activity.records || {}).length,
      updatedAt: getLatestActivityUpdatedAt(activity.records),
      compactedAt: Date.now()
    }
  }, { transaction })
}

async function writeNewTabActivityToLocalStorage(activity: NewTabActivityRepositoryState, transaction: LocalStorageTransaction): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabActivity]: activity
  }, { transaction })
}

function getLatestActivityUpdatedAt(records: Record<string, NewTabActivityRepositoryRecord>): number {
  return Object.values(records || {}).reduce((latest, record) => {
    return Math.max(latest, Number(record.lastOpenedAt) || 0)
  }, 0)
}
