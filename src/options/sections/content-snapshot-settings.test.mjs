import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * from './src/options/sections/content-snapshot-settings';
      export { DEFAULT_CONTENT_SNAPSHOT_SETTINGS } from './src/shared/content-snapshot-search';
      export { STORAGE_KEYS } from './src/shared/constants';`,
    resolveDir: process.cwd(), loader: 'ts'
  },
  bundle: true, write: false, platform: 'node', format: 'esm'
})
const { createContentSnapshotSettingsController, DEFAULT_CONTENT_SNAPSHOT_SETTINGS, STORAGE_KEYS } =
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const flush = () => new Promise(resolve => setImmediate(resolve))
const key = STORAGE_KEYS.contentSnapshotSettings

function setup(t) {
  const original = globalThis.chrome
  const state = { settings: { ...DEFAULT_CONTENT_SNAPSHOT_SETTINGS }, statusMessage: '' }
  const renders = []
  const controller = createContentSnapshotSettingsController(state, () => renders.push(structuredClone(state)))
  const stored = { [key]: { ...state.settings } }
  const writes = []
  globalThis.chrome = {
    runtime: {},
    storage: { local: {
      get(keys, callback) { queueMicrotask(() => callback(Object.fromEntries(keys.map(key => [key, structuredClone(stored[key])])))) },
      set(payload, callback) {
        writes.push({
          payload,
          finish(error) {
            if (error) chrome.runtime.lastError = { message: error }
            else {
              Object.assign(stored, structuredClone(payload))
              controller.accept(payload[key])
            }
            try { callback() } finally { delete chrome.runtime.lastError }
          }
        })
      }
    } }
  }
  t.after(() => { globalThis.chrome = original })
  return { state, controller, stored, writes, renders }
}

test('older completions and storage echoes cannot overwrite a newer toggle', async t => {
  const { controller, state, writes, stored } = setup(t)
  const first = controller.save({ saveFullText: false, syncFullTextSearch: true })
  await flush()
  const second = controller.save({ enabled: false })
  assert.equal(state.settings.enabled, false)
  writes[0].finish()
  await first
  await flush()
  assert.equal(state.settings.enabled, false)
  assert.equal(state.settings.saveFullText, false)
  assert.equal(state.statusMessage, '', 'An old completion cannot report the newer draft as saved')
  writes[1].finish()
  await second
  assert.deepEqual(state.settings, stored[key])
  assert.equal(state.settings.fullTextSearchEnabled, false)
})

test('a failed field rolls back without losing another pending edit or masking its error', async t => {
  const { controller, state, writes, stored } = setup(t)
  const first = controller.save({ saveFullText: false, syncFullTextSearch: true })
  await flush()
  const second = controller.save({ enabled: false })
  writes[0].finish('Full text write failed')
  await first
  await flush()
  assert.equal(state.settings.enabled, false)
  assert.equal(state.settings.saveFullText, true)
  writes[1].finish()
  await second
  assert.match(state.statusMessage, /Full text write failed/)
  assert.deepEqual(state.settings, stored[key])
  const retry = controller.save({ saveFullText: false, syncFullTextSearch: true })
  await flush()
  writes[2].finish()
  await retry
  assert.doesNotMatch(state.statusMessage, /Full text write failed/)
  assert.equal(state.settings.saveFullText, false)
  assert.equal(state.settings.enabled, false)
})

test('all failed overlapping edits roll back to confirmed data, not a failed optimistic value', async t => {
  const { controller, state, writes } = setup(t)
  const first = controller.save({ enabled: false })
  await flush()
  const second = controller.save({ enabled: true, saveFullText: false })
  writes[0].finish('Old failure')
  await first
  await flush()
  assert.doesNotMatch(state.statusMessage, /Old failure/)
  assert.equal(state.settings.saveFullText, false)
  writes[1].finish('Latest failure')
  await second
  assert.deepEqual(state.settings, DEFAULT_CONTENT_SNAPSHOT_SETTINGS)
  assert.match(state.statusMessage, /Latest failure/)
})

test('external settings merge with pending fields and are preserved by the write transaction', async t => {
  const { controller, state, writes, stored } = setup(t)
  controller.accept({ ...state.settings, localOnlyNoAiUpload: true })
  stored[key] = structuredClone(state.settings)
  const save = controller.save({ enabled: false })
  await flush()
  controller.accept({ ...stored[key], autoCaptureOnBookmarkCreate: false })
  assert.equal(state.settings.enabled, false)
  assert.equal(state.settings.autoCaptureOnBookmarkCreate, false)
  writes[0].finish()
  await save
  assert.equal(stored[key].localOnlyNoAiUpload, true)
  assert.equal(state.settings.enabled, false)
})
