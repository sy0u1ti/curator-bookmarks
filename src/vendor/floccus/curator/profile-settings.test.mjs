import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSyncEngine } from './build.mjs'

test('Linkwarden order defaults and explicit settings survive creation, updates, export and import', async () => {
  const originalChrome = globalThis.chrome
  const originalTimeout = globalThis.setTimeout
  const timers = []
  const stored = {}
  const nodes = [
    { id: '0', title: '' },
    { id: '1', parentId: '0', title: 'Bookmarks Bar' },
    { id: '2', parentId: '1', title: 'QA' },
  ]
  globalThis.setTimeout = (...arguments_) => {
    const timer = originalTimeout(...arguments_)
    timers.push(timer)
    return timer
  }
  globalThis.chrome = {
    runtime: { id: 'qa-extension' },
    bookmarks: {
      async getTree() {
        return [{ ...nodes[0], children: [{ ...nodes[1], children: [{ ...nodes[2], children: [] }] }] }]
      },
      async get(id) {
        const node = nodes.find(node => node.id === id)
        if (!node) throw new Error('Folder not found')
        return [node]
      },
    },
    notifications: { clear: async () => true },
    storage: { local: {
      async get(keys) {
        if (typeof keys === 'string') return { [keys]: stored[keys] }
        if (Array.isArray(keys)) return Object.fromEntries(keys.map(key => [key, stored[key]]))
        return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, stored[key] ?? fallback]))
      },
      async set(values) { Object.assign(stored, structuredClone(values)) },
      async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key] },
    } },
  }
  try {
    const { code } = await buildSyncEngine()
    const { default: load } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    const engine = load()
    await engine.start({ onLocalBookmarkCreate() {}, beforeLocalOverwrite: async () => {}, notificationIcon: 'fixture.png' })
    const settings = {
      type: 'linkwarden', url: 'https://fixture.invalid', localRoot: '2',
      serverFolder: 'Curator', password: 'fixture-token',
      enabled: false, syncIntervalEnabled: false, syncOnStartupEnabled: false,
    }
    const id = await engine.createProfile(settings)
    const saved = async profileId => (await engine.listProfiles()).find(profile => profile.id === profileId)
    assert.equal((await saved(id)).data.syncOrder, true)
    await engine.updateProfile(id, { syncOrder: false })
    assert.equal((await saved(id)).data.syncOrder, false)
    await engine.updateProfile(id, { label: 'Keep order disabled' })
    assert.equal((await saved(id)).data.syncOrder, false)
    const disabled = await engine.exportProfiles([id])
    assert.equal(disabled[0].syncOrder, false)
    const importedDisabled = await engine.importProfiles(disabled)
    assert.equal((await saved(importedDisabled.ids[0])).data.syncOrder, false)
    await engine.updateProfile(id, { syncOrder: true })
    const enabled = await engine.exportProfiles([id])
    const importedEnabled = await engine.importProfiles(enabled)
    assert.equal((await saved(importedEnabled.ids[0])).data.syncOrder, true)
    const { syncOrder, ...legacy } = enabled[0]
    const importedLegacy = await engine.importProfiles([legacy])
    assert.equal((await saved(importedLegacy.ids[0])).data.syncOrder, false)
    assert.equal((await saved(importedLegacy.ids[0])).data.localRoot, null)
    assert.equal((await saved(importedLegacy.ids[0])).data.enabled, false)
    const explicitlyDisabled = await engine.createProfile({ ...settings, syncOrder: false })
    assert.equal((await saved(explicitlyDisabled)).data.syncOrder, false)
    await engine.updateProfile(id, { syncOrder: 'false' })
    assert.equal((await saved(id)).data.syncOrder, true)
  } finally {
    for (const timer of timers) clearTimeout(timer)
    globalThis.setTimeout = originalTimeout
    globalThis.chrome = originalChrome
  }
})
