import assert from 'node:assert/strict'
import { STORAGE_KEYS } from '../shared/constants.js'
import {
  createNewtabSettingsPersistence,
  reconcilePendingNewtabSettings,
  NEWTAB_PENDING_SETTINGS_PREFIX,
  type NewtabSettingsStoragePort
} from './newtab-settings-persistence.js'

const key = STORAGE_KEYS.newTabSearchSettings
const defaults = { width: 44, height: 40, enabled: true }
function fixture() {
  const data: Record<string, unknown> = { [key]: { ...defaults } }
  const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>()
  let queue: Promise<unknown> = Promise.resolve()
  let failWrite = false
  let failRemove = false
  let beforeWrite: (() => Promise<void>) | null = null
  const storage: NewtabSettingsStoragePort = {
    get: async (keys) => Object.fromEntries((keys || Object.keys(data)).filter((name) => Object.hasOwn(data, name))
      .map((name) => [name, structuredClone(data[name])])),
    set: async (values) => {
      if (beforeWrite && Object.hasOwn(values, key)) await beforeWrite()
      if (failWrite && Object.hasOwn(values, key)) throw new Error('write failed')
      const changes: Record<string, chrome.storage.StorageChange> = {}
      for (const [name, value] of Object.entries(values)) {
        changes[name] = { oldValue: structuredClone(data[name]), newValue: structuredClone(value) }
        data[name] = structuredClone(value)
      }
      for (const listener of listeners) listener(changes, 'local')
    },
    remove: async (keys) => {
      if (failRemove) throw new Error('cleanup failed')
      for (const name of keys) delete data[name]
    },
    keys: async () => Object.keys(data),
    transaction: (task) => {
      const result = queue.catch(() => {}).then(() => task(storage))
      queue = result.then(() => undefined, () => undefined)
      return result
    }
  }
  function page(subscribe = true) {
    const view: Record<string, Record<string, unknown>> = {}
    const coordinator = createNewtabSettingsPersistence({
      storage,
      normalize: (_key, value) => ({ ...defaults, ...(value as Record<string, unknown> || {}) }),
      onChange: (name, value) => { view[name] = value }
    })
    Object.assign(view, coordinator.hydrate(data))
    if (subscribe) listeners.add(coordinator.handleStorageChanges)
    return {
      ...coordinator,
      view,
      edit(changes: Record<string, unknown>) {
        view[key] = { ...view[key], ...changes }
        coordinator.stage({ [key]: view[key] })
      }
    }
  }
  return {
    data, storage, page,
    set failWrite(value: boolean) { failWrite = value },
    set failRemove(value: boolean) { failRemove = value },
    set beforeWrite(value: (() => Promise<void>) | null) { beforeWrite = value }
  }
}

{
  const test = fixture()
  const a = test.page()
  const b = test.page()
  a.edit({ width: 52 })
  b.edit({ height: 48 })
  await Promise.all([a.flush(), b.flush()])
  assert.deepEqual(test.data[key], { ...defaults, width: 52, height: 48 }, 'Concurrent tabs must merge different fields.')
  assert.deepEqual(a.view[key], b.view[key])
  a.edit({ width: 60 })
  b.edit({ width: 56 })
  await a.flush()
  assert.equal(b.view[key].width, 56, 'A remote commit must not replace an unsaved local field.')
  await b.flush()
  assert.equal((test.data[key] as typeof defaults).width, 56)
}

{
  const test = fixture()
  const page = test.page()
  let release!: () => void
  let reached!: () => void
  const entered = new Promise<void>((resolve) => { reached = resolve })
  const blocked = new Promise<void>((resolve) => { release = resolve })
  test.beforeWrite = async () => { reached(); await blocked }
  page.edit({ width: 50 })
  const firstSave = page.flush()
  await entered
  page.edit({ width: 62 })
  release()
  await firstSave
  assert.equal(page.view[key].width, 62, 'Completing an older write must retain a newer local edit.')
  test.beforeWrite = null
  await page.flush()
  assert.equal((test.data[key] as typeof defaults).width, 62)
}

{
  const test = fixture()
  const page = test.page(false)
  let release!: () => void
  const blocked = new Promise<void>((resolve) => { release = resolve })
  const busy = test.storage.transaction(() => blocked)
  page.edit({ width: 58 })
  const queuedSave = page.flush()
  page.flushOnExit()
  assert.equal(Object.keys(test.data).filter((name) => name.startsWith(NEWTAB_PENDING_SETTINGS_PREFIX)).length, 1,
    'Closing must submit its pending patch synchronously, even when the shared lock is busy.')
  release()
  await busy
  await queuedSave
  assert.equal((test.data[key] as typeof defaults).width, 44, 'A closed document must skip its older queued write.')
  await reconcilePendingNewtabSettings(test.storage)
  assert.equal((test.data[key] as typeof defaults).width, 58)
  assert.deepEqual(Object.keys(test.data), [key], 'Confirmed recovery must remove the pending record.')
}

{
  const test = fixture()
  const page = test.page(false)
  page.edit({ width: 58 })
  assert.equal(page.hasPending(), true)
  page.discard(key, defaults)
  page.flushOnExit()
  assert.equal(page.hasPending(), false)
  assert.deepEqual(Object.keys(test.data), [key], 'An explicitly rolled-back setting must not be resurrected by exit recovery.')
}

{
  const test = fixture()
  const page = test.page(false)
  page.edit({ width: 57 })
  page.flushOnExit()
  const pendingKey = Object.keys(test.data).find((name) => name.startsWith(NEWTAB_PENDING_SETTINGS_PREFIX))!
  test.failWrite = true
  await assert.rejects(reconcilePendingNewtabSettings(test.storage), /write failed/)
  assert.ok(test.data[pendingKey], 'A failed commit must retain its recovery record.')
  test.failWrite = false
  test.failRemove = true
  await assert.rejects(reconcilePendingNewtabSettings(test.storage), /cleanup failed/)
  assert.equal((test.data[key] as typeof defaults).width, 57)
  assert.equal(test.data[pendingKey], null, 'A committed record needs an atomic consumed marker.')
  await test.storage.set({ [key]: { ...defaults, width: 61 } })
  test.failRemove = false
  await reconcilePendingNewtabSettings(test.storage)
  assert.equal((test.data[key] as typeof defaults).width, 61, 'Retrying cleanup must not replay a previously committed edit.')
}

{
  const test = fixture()
  const pending = (createdAt: number, width: number) => ({ version: 1, createdAt, patches: { [key]: { set: { width }, remove: [] } } })
  const first = `${NEWTAB_PENDING_SETTINGS_PREFIX}first`
  const second = `${NEWTAB_PENDING_SETTINGS_PREFIX}second`
  test.data[second] = pending(200, 59)
  test.data[first] = pending(100, 53)
  test.data[`${NEWTAB_PENDING_SETTINGS_PREFIX}invalid`] = { version: 1, createdAt: 300, patches: { unrelated: { set: { value: true }, remove: [] } } }
  await reconcilePendingNewtabSettings(test.storage)
  assert.equal((test.data[key] as typeof defaults).width, 59, 'Recovery must apply records in creation order.')
  assert.equal(test.data.unrelated, undefined, 'Pending preference recovery must only touch allowed New Tab settings.')
}

{
  const test = fixture()
  const closed = test.page(false)
  closed.edit({ width: 57 })
  closed.flushOnExit()
  test.failWrite = true
  await assert.rejects(reconcilePendingNewtabSettings(test.storage), /write failed/)
  test.failWrite = false
  const later = test.page()
  later.edit({ width: 63 })
  await later.flush()
  await reconcilePendingNewtabSettings(test.storage)
  assert.equal((test.data[key] as typeof defaults).width, 63, 'A later successful edit must supersede an older failed recovery.')
}

console.log('New Tab preference concurrency, lifecycle recovery, and failure tests passed.')
