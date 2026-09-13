import { STORAGE_KEYS } from '../shared/constants.js'
import { getLocalStorage, removeLocalStorage, setLocalStorage, withLocalStorageTransaction } from '../shared/storage.js'

export const NEWTAB_PENDING_SETTINGS_PREFIX = 'curatorNewTabPendingSettings:'
export const NEWTAB_SYNCED_SETTING_KEYS = [
  STORAGE_KEYS.newTabSearchSettings,
  STORAGE_KEYS.newTabIconSettings,
  STORAGE_KEYS.newTabTimeSettings,
  STORAGE_KEYS.newTabGeneralSettings,
  STORAGE_KEYS.newTabFolderSettings,
  STORAGE_KEYS.newTabBackgroundSettings,
  STORAGE_KEYS.newTabModuleSettings
] as const
const supportedKeys = new Set<string>(NEWTAB_SYNCED_SETTING_KEYS)
type SettingsValue = Record<string, unknown>
interface FieldChange { value?: unknown; remove?: true; revision: number }
interface SettingsPatch { set: SettingsValue; remove: string[] }
interface PendingSettings { version: 1; createdAt: number; patches: Record<string, SettingsPatch> }

export interface NewtabSettingsStorage {
  get: (keys: string[] | null) => Promise<Record<string, unknown>>
  set: (values: Record<string, unknown>) => Promise<void>
  remove: (keys: string[]) => Promise<void>
  keys: () => Promise<string[]>
}
export interface NewtabSettingsStoragePort extends NewtabSettingsStorage {
  transaction: <T>(task: (storage: NewtabSettingsStorage) => Promise<T>) => Promise<T>
}

// pagehide must dispatch its RPC in the current task, without awaiting a lock.
function setImmediately(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => chrome.storage.local.set(values, () => {
    const error = chrome.runtime.lastError
    if (error) reject(new Error(error.message))
    else resolve()
  }))
}
const browserStorage: NewtabSettingsStoragePort = {
  get: getLocalStorage,
  set: setImmediately,
  remove: removeLocalStorage,
  keys: async () => {
    const storage = chrome.storage.local as unknown as { getKeys?: () => Promise<string[]> }
    return storage.getKeys ? storage.getKeys() : Object.keys(await getLocalStorage(null))
  },
  transaction: (task) => withLocalStorageTransaction((transaction) => task({
    ...browserStorage,
    set: (values) => setLocalStorage(values, { transaction }),
    remove: (keys) => removeLocalStorage(keys, { transaction })
  }))
}

function isRecord(value: unknown): value is SettingsValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function isSafeField(key: string): boolean {
  return key !== '__proto__' && key !== 'prototype' && key !== 'constructor'
}
function isSmallValue(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.length <= 8192
  if (depth >= 3) return false
  if (Array.isArray(value)) return value.length <= 128 && value.every((item) => isSmallValue(item, depth + 1))
  return isRecord(value) && Object.keys(value).length <= 64 &&
    Object.entries(value).every(([key, item]) => isSafeField(key) && isSmallValue(item, depth + 1))
}
function parsePendingSettings(raw: unknown): PendingSettings | null {
  if (!isRecord(raw) || raw.version !== 1 || !Number.isFinite(raw.createdAt) || !isRecord(raw.patches)) return null
  if (JSON.stringify(raw).length > 65536) return null
  for (const [key, patch] of Object.entries(raw.patches)) {
    if (!supportedKeys.has(key) || !isRecord(patch) || !isRecord(patch.set) || !Array.isArray(patch.remove)) return null
    if (!isSmallValue(patch.set) || patch.remove.length > 64 ||
      !patch.remove.every((field) => typeof field === 'string' && isSafeField(field))) return null
  }
  return raw as unknown as PendingSettings
}
function applyPatch(value: unknown, patch: SettingsPatch): SettingsValue {
  const result = { ...(isRecord(value) ? value : {}), ...patch.set }
  for (const key of patch.remove) delete result[key]
  return result
}
function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Recover final edits from a closed page before hydrating its successor. */
export async function reconcilePendingNewtabSettings(
  port = browserStorage,
  knownKeys?: string[]
): Promise<void> {
  const keys = (knownKeys || await port.keys()).filter((key) => key.startsWith(NEWTAB_PENDING_SETTINGS_PREFIX))
  if (!keys.length) return
  await port.transaction(async (storage) => {
    const stored = await storage.get(keys)
    const records = keys.flatMap((key) => {
      const value = parsePendingSettings(stored[key])
      return value ? [{ key, value }] : []
    }).sort((left, right) => left.value.createdAt - right.value.createdAt || left.key.localeCompare(right.key))
    const consumedKeys = keys.filter((key) => stored[key] === null)
    if (records.length) {
      const settingKeys = [...new Set(records.flatMap(({ value }) => Object.keys(value.patches)))]
      const values = await storage.get(settingKeys)
      for (const { key, value } of records) {
        for (const [settingKey, patch] of Object.entries(value.patches)) values[settingKey] = applyPatch(values[settingKey], patch)
        // The preference and its consumed marker commit atomically. If cleanup
        // fails, replaying this record must not overwrite a later user's edit.
        values[key] = null
        consumedKeys.push(key)
      }
      await storage.set(values)
    }
    if (consumedKeys.length) await storage.remove(consumedKeys)
  })
}

export function createNewtabSettingsPersistence({
  normalize,
  onChange,
  onError = () => {},
  storage: port = browserStorage
}: {
  normalize: (key: string, value: unknown) => SettingsValue
  onChange: (key: string, value: SettingsValue) => void
  onError?: (error: unknown) => void
  storage?: NewtabSettingsStoragePort
}) {
  const localValues = new Map<string, SettingsValue>()
  const pending = new Map<string, Map<string, FieldChange>>()
  let revision = 0
  let closing = false
  let exitRevision = -1

  function patchFor(changes: Map<string, FieldChange>): SettingsPatch {
    const patch: SettingsPatch = { set: {}, remove: [] }
    for (const [field, change] of changes) {
      if (change.remove) patch.remove.push(field)
      else patch.set[field] = change.value
    }
    return patch
  }
  function accept(key: string, raw: unknown, notify = true): SettingsValue {
    const value = normalize(key, raw)
    const changes = pending.get(key)
    const merged = changes ? applyPatch(value, patchFor(changes)) : value
    const previous = localValues.get(key)
    localValues.set(key, structuredClone(merged))
    if (notify && !sameValue(previous, merged)) onChange(key, merged)
    return merged
  }
  function stage(values: Record<string, unknown>): void {
    for (const [key, raw] of Object.entries(values)) {
      if (!supportedKeys.has(key)) continue
      const value = normalize(key, raw)
      const previous = localValues.get(key) || normalize(key, undefined)
      const changes = pending.get(key) || new Map<string, FieldChange>()
      for (const field of new Set([...Object.keys(previous), ...Object.keys(value)])) {
        if (!isSafeField(field) || sameValue(previous[field], value[field])) continue
        changes.set(field, Object.hasOwn(value, field)
          ? { value: structuredClone(value[field]), revision: ++revision }
          : { remove: true, revision: ++revision })
      }
      if (changes.size) pending.set(key, changes)
      localValues.set(key, structuredClone(value))
    }
  }
  async function flush(keys = [...pending.keys()]): Promise<void> {
    if (closing) return
    // A newer explicit edit follows older recovered edits, including a record
    // whose previous recovery failed. It must not be overwritten on next open.
    await reconcilePendingNewtabSettings(port)
    await port.transaction(async (storage) => {
      if (closing) return
      const snapshots = new Map(keys.flatMap((key) => {
        const changes = pending.get(key)
        return changes?.size ? [[key, new Map(changes)] as const] : []
      }))
      if (!snapshots.size) return
      const stored = await storage.get([...snapshots.keys()])
      // Closing can occur during the read. Its recovery record owns the final
      // edit; this document must not commit an older write after pagehide.
      if (closing) return
      const values: Record<string, unknown> = {}
      for (const [key, changes] of snapshots) values[key] = applyPatch(normalize(key, stored[key]), patchFor(changes))
      await storage.set(values)
      for (const [key, changes] of snapshots) {
        const remaining = pending.get(key)
        for (const [field, saved] of changes) {
          if (remaining?.get(field)?.revision === saved.revision) remaining.delete(field)
        }
        if (!remaining?.size) pending.delete(key)
        accept(key, values[key])
      }
    })
  }

  return {
    stage,
    flush,
    hasPending(): boolean { return pending.size > 0 },
    discard(key: string, value: unknown): void {
      pending.delete(key)
      localValues.set(key, normalize(key, value))
    },
    hydrate(values: Record<string, unknown>): Record<string, unknown> {
      const merged = { ...values }
      for (const key of supportedKeys) merged[key] = accept(key, values[key], false)
      return merged
    },
    async save(values: Record<string, unknown>): Promise<void> {
      stage(values)
      await flush(Object.keys(values))
    },
    handleStorageChanges(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
      if (area !== 'local' || closing) return
      for (const key of supportedKeys) {
        if (Object.hasOwn(changes, key)) accept(key, changes[key].newValue)
      }
      const pendingKeys = Object.keys(changes).filter((key) =>
        key.startsWith(NEWTAB_PENDING_SETTINGS_PREFIX) && changes[key].newValue != null)
      if (pendingKeys.length) void reconcilePendingNewtabSettings(port, pendingKeys).catch(onError)
    },
    flushOnExit(): void {
      closing = true
      if (!pending.size || exitRevision === revision) return
      const record: PendingSettings = { version: 1, createdAt: Date.now(), patches: {} }
      for (const [key, changes] of pending) record.patches[key] = patchFor(changes)
      if (!parsePendingSettings(record)) {
        onError(new Error('新标签页待保存设置格式无效。'))
        return
      }
      exitRevision = revision
      const key = `${NEWTAB_PENDING_SETTINGS_PREFIX}${record.createdAt}:${crypto.randomUUID()}`
      void port.set({ [key]: record }).catch((error) => {
        exitRevision = -1
        onError(error)
      })
    },
    resume(): void { closing = false }
  }
}
