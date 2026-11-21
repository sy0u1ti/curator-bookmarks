import { STORAGE_KEYS } from '../constants.js'
import { getLocalStorage, setLocalStorage, withLocalStorageTransaction, type LocalStorageTransaction } from '../storage.js'

const ICON_REFERENCE_PREFIX = 'curator-icon:v1:'
const DB_NAME = 'curatorCustomIcons'
const STORE_NAME = 'images'
const ORPHAN_STORE = 'orphanedAt'
export const CUSTOM_ICON_GRACE_MS = 24 * 60 * 60 * 1000
const textEncoder = new TextEncoder()
let database: Promise<IDBDatabase> | null = null

export function normalizeCustomIconEntries(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([id, data]) => id && typeof data === 'string' &&
    (data.startsWith('data:image/') || data.startsWith(ICON_REFERENCE_PREFIX)))) as Record<string, string>
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database
  let abandoned = false
  let pending: Promise<IDBDatabase> | null = null
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
      if (!request.result.objectStoreNames.contains(ORPHAN_STORE)) request.result.createObjectStore(ORPHAN_STORE)
    }
    request.onsuccess = () => {
      const db = request.result
      if (abandoned) { db.close(); return }
      const clearCachedDatabase = () => {
        if (database === pending) database = null
      }
      db.onversionchange = () => { db.close(); clearCachedDatabase() }
      db.onclose = clearCachedDatabase
      resolve(db)
    }
    request.onerror = () => reject(request.error || new Error('自定义图标存储无法打开。'))
    request.onblocked = () => reject(new Error('图标存储升级被其他页面占用，请关闭旧扩展页面后重试。'))
  })
  pending = opening.catch((error) => {
    abandoned = true
    if (database === pending) database = null
    throw error
  })
  database = pending
  return database
}

async function putCustomIconsBatch(entries: Map<string, string>): Promise<void> {
  if (!entries.size) return
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    for (const [reference, data] of entries) {
      store.put(data, reference)
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('自定义图标保存失败。'))
  })
}

// Content-addressed immutable images make storage rollback and saved restore
// journals safe: a previous reference keeps pointing at exactly the same bytes.
export async function prepareCustomIconReferences(value: unknown): Promise<Record<string, string>> {
  const entries = normalizeCustomIconEntries(value)
  const references: Record<string, string> = {}
  const pendingWrites = new Map<string, string>()
  for (const [id, data] of Object.entries(entries)) {
    if (data.startsWith(ICON_REFERENCE_PREFIX)) { references[id] = data; continue }
    const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(data))
    const reference = ICON_REFERENCE_PREFIX + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    pendingWrites.set(reference, data)
    references[id] = reference
  }
  await putCustomIconsBatch(pendingWrites)
  return references
}

export interface CustomIconResolution {
  icons: Record<string, string>
  missingIds: string[]
  unavailableIds: string[]
}

export async function resolveCustomIconState(value: unknown): Promise<CustomIconResolution> {
  const icons: Record<string, string> = {}
  const missingIds: string[] = []
  const unavailableIds: string[] = []
  const references = new Map<string, string[]>()
  for (const [id, data] of Object.entries(normalizeCustomIconEntries(value))) {
    if (data.startsWith('data:image/')) { icons[id] = data; continue }
    const ids = references.get(data) || []
    ids.push(id)
    references.set(data, ids)
  }
  if (references.size) {
    try {
      const db = await openDatabase()
      const images = await new Promise<Map<string, unknown>>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const values = new Map<string, unknown>()
        for (const reference of references.keys()) {
          const request = store.get(reference)
          request.onsuccess = () => { values.set(reference, request.result) }
        }
        tx.oncomplete = () => resolve(values)
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('自定义图标读取失败。'))
      })
      for (const [reference, ids] of references) {
        const image = images.get(reference)
        if (typeof image === 'string' && image.startsWith('data:image/')) {
          for (const id of ids) icons[id] = image
        } else missingIds.push(...ids)
      }
    } catch {
      for (const ids of references.values()) {
        missingIds.push(...ids)
        unavailableIds.push(...ids)
      }
    }
  }
  return { icons, missingIds, unavailableIds }
}

export async function resolveCustomIcons(value: unknown): Promise<Record<string, string>> {
  const result = await resolveCustomIconState(value)
  if (result.unavailableIds.length) throw new Error('自定义图标仓库暂时不可读，请稍后重试。')
  return result.icons
}

export async function loadCustomIcons(prefetched?: { raw: unknown }): Promise<Record<string, string>> {
  const initialRaw = prefetched
    ? prefetched.raw
    : (await getLocalStorage(STORAGE_KEYS.newTabCustomIcons))[STORAGE_KEYS.newTabCustomIcons]
  const initialEntries = normalizeCustomIconEntries(initialRaw)
  if (!Object.values(initialEntries).some(data => data.startsWith('data:image/'))) {
    return Object.keys(initialEntries).length ? resolveCustomIcons(initialEntries) : {}
  }
  return withLocalStorageTransaction(async transaction => {
    const stored = await getLocalStorage(STORAGE_KEYS.newTabCustomIcons)
    const entries = normalizeCustomIconEntries(stored[STORAGE_KEYS.newTabCustomIcons])
    const resolved = await resolveCustomIcons(entries)
    // Legacy data URLs are migrated only after all image bytes are committed.
    if (Object.values(entries).some(data => data.startsWith('data:image/'))) {
      try {
        const references = await prepareCustomIconReferences(entries)
        await setLocalStorage({ [STORAGE_KEYS.newTabCustomIcons]: references }, { transaction })
      } catch {
        // Keep legacy images usable if migration cannot currently write to IDB.
      }
    }
    return resolved
  })
}

export async function setBookmarkCustomIcon(
  bookmarkId: string,
  data: string | null,
  transaction?: LocalStorageTransaction
): Promise<void> {
  if (!transaction) return withLocalStorageTransaction(active => setBookmarkCustomIcon(bookmarkId, data, active))
  const stored = await getLocalStorage(STORAGE_KEYS.newTabCustomIcons)
  const entries = normalizeCustomIconEntries(stored[STORAGE_KEYS.newTabCustomIcons])
  if (data) {
    const prepared = await prepareCustomIconReferences({ [bookmarkId]: data })
    if (!prepared[bookmarkId]) throw new Error('自定义图标格式无效。')
    entries[bookmarkId] = prepared[bookmarkId]
  } else delete entries[bookmarkId]
  await setLocalStorage({ [STORAGE_KEYS.newTabCustomIcons]: entries }, { transaction })
}

export function collectCustomIconReferences(value: unknown, references = new Set<string>()): Set<string> {
  if (typeof value === 'string' && value.startsWith(ICON_REFERENCE_PREFIX)) references.add(value)
  else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectCustomIconReferences(child, references)
  }
  return references
}

export interface CustomIconUsage { count: number; bytes: number; unused: number; removed: number }

// Writers and this collector must hold the local-storage transaction lock, so a
// prepared image cannot be swept before its Chrome-storage reference is saved.
export async function inspectCustomIconStorage(
  references: Set<string>,
  options: { transaction?: LocalStorageTransaction; now?: number } = {}
): Promise<CustomIconUsage> {
  const db = await openDatabase()
  const now = options.now ?? Date.now()
  const collect = Boolean(options.transaction)
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, ORPHAN_STORE], collect ? 'readwrite' : 'readonly')
    const images = tx.objectStore(STORE_NAME)
    const orphaned = tx.objectStore(ORPHAN_STORE)
    const usage: CustomIconUsage = { count: 0, bytes: 0, unused: 0, removed: 0 }
    const cursor = images.openCursor()
    cursor.onsuccess = () => {
      const entry = cursor.result
      if (!entry) return
      usage.count++
      usage.bytes += textEncoder.encode(String(entry.value || '')).byteLength
      if (references.has(String(entry.key))) {
        if (collect) orphaned.delete(entry.key)
        entry.continue()
      } else {
        usage.unused++
        if (!collect) { entry.continue(); return }
        const timestamp = orphaned.get(entry.key)
        timestamp.onsuccess = () => {
          if (typeof timestamp.result === 'number' && now - timestamp.result >= CUSTOM_ICON_GRACE_MS) {
            entry.delete()
            orphaned.delete(entry.key)
            usage.removed++
          } else if (typeof timestamp.result !== 'number') orphaned.put(now, entry.key)
          entry.continue()
        }
      }
    }
    tx.oncomplete = () => resolve(usage)
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('自定义图标清理失败。'))
  })
}
