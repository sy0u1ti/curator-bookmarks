import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * from './src/options/sections/feature-settings-view';
      export * from './src/options/sections/inbox-settings';
      export { aiNamingState, managerState } from './src/options/shared-options/state';
      export { getDefaultInboxSettings } from './src/shared/inbox';
      export { STORAGE_KEYS } from './src/shared/constants';`,
    loader: 'ts', resolveDir: process.cwd()
  },
  bundle: true, write: false, platform: 'node', format: 'esm'
})
const {
  buildFeatureSettingsView, saveInboxWorkflowMode, aiNamingState, managerState,
  getDefaultInboxSettings, STORAGE_KEYS
} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

const view = (overrides = {}) => buildFeatureSettingsView({
  settings: { autoAnalyzeBookmarks: false, allowRemoteParsing: false },
  inboxSettings: managerState.inboxSettings,
  inboxStatus: managerState.inboxSettingsStatus,
  inboxSaving: managerState.inboxSettingsSaving,
  loading: false, permissionsLoading: false, remoteParserGranted: true,
  locked: Boolean(aiNamingState.pendingFeatureSwitch),
  pending: aiNamingState.pendingFeatureSwitch,
  testingConnection: false,
  ...overrides
})
const flush = () => new Promise(resolve => setImmediate(resolve))

function setup(t) {
  const previousChrome = globalThis.chrome
  const previousInbox = {
    inboxSettings: managerState.inboxSettings,
    inboxSettingsStatus: managerState.inboxSettingsStatus,
    inboxSettingsSaving: managerState.inboxSettingsSaving
  }
  const previousPending = aiNamingState.pendingFeatureSwitch
  managerState.inboxSettings = {
    ...getDefaultInboxSettings(), folderTitle: 'Research inbox',
    minAutoMoveConfidence: 0.9, notifyOnClassified: false
  }
  managerState.inboxSettingsStatus = ''
  managerState.inboxSettingsSaving = false
  aiNamingState.pendingFeatureSwitch = ''
  const stored = { [STORAGE_KEYS.inboxSettings]: structuredClone(managerState.inboxSettings) }
  const writes = []
  globalThis.chrome = {
    runtime: {},
    storage: { local: {
      get(keys, callback) {
        queueMicrotask(() => callback(Object.fromEntries(keys.map(key => [key, structuredClone(stored[key])]))))
      },
      set(payload, callback) {
        writes.push({
          payload: structuredClone(payload),
          finish(error) {
            if (error) chrome.runtime.lastError = { message: error }
            else Object.assign(stored, structuredClone(payload))
            try { callback() } finally { delete chrome.runtime.lastError }
          }
        })
      }
    } }
  }
  t.after(() => {
    globalThis.chrome = previousChrome
    Object.assign(managerState, previousInbox)
    aiNamingState.pendingFeatureSwitch = previousPending
  })
  return { stored, writes }
}

test('Inbox availability is independent of AI saves, permission checks and connection tests', () => {
  const idle = view({ inboxSaving: false, locked: false, pending: '' }).inboxWorkflow
  for (const pending of ['', 'autoAnalyzeBookmarks', 'allowRemoteParsing']) {
    assert.deepEqual(view({ inboxSaving: false, locked: true, pending, testingConnection: true }).inboxWorkflow, idle,
      `${pending || 'provider lock'} must not dim or replace the independent Inbox control`)
  }
  assert.equal(view({ inboxSaving: true }).inboxWorkflow.disabled, true)
  assert.equal(view({ inboxSaving: false, loading: true }).inboxWorkflow.disabled, true)
})

test('rechecking provider permissions keeps Inbox mounted and locks only the AI switches', () => {
  const state = view({ inboxSaving: false, locked: false, permissionsLoading: true })
  assert.equal(state.loading, false)
  assert.equal(state.inboxWorkflow.disabled, false)
  assert.ok(state.switches.every(item => item.disabled))
  assert.equal(state.switches[1].status, undefined, 'Do not show a missing permission before the check completes')
})

for (const pending of ['', 'autoAnalyzeBookmarks', 'allowRemoteParsing']) {
  test(`Inbox saves use their own lock while AI pending is ${pending || 'idle'}`, async t => {
    const { stored, writes } = setup(t)
    aiNamingState.pendingFeatureSwitch = pending
    const before = structuredClone(managerState.inboxSettings)
    const saving = saveInboxWorkflowMode('tags', () => {})
    await flush()
    try {
      assert.equal(managerState.inboxSettingsSaving, true)
      assert.equal(aiNamingState.pendingFeatureSwitch, pending)
      assert.equal(view().inboxWorkflow.disabled, true)
      if (!pending) assert.ok(view().switches.every(item => !item.disabled), 'Inbox saves do not lock AI switches')
      assert.equal(writes.length, 1)
      await saveInboxWorkflowMode('capture', () => {})
      assert.equal(writes.length, 1, 'Only overlapping Inbox saves are blocked')
      assert.deepEqual(managerState.inboxSettings, before, 'Keep the last persisted value while saving')
    } finally {
      writes[0]?.finish()
      await saving
    }
    assert.equal(managerState.inboxSettingsSaving, false)
    assert.equal(aiNamingState.pendingFeatureSwitch, pending)
    assert.equal(view().inboxWorkflow.disabled, false)
    assert.equal(view().inboxWorkflow.value, 'tags')
    assert.deepEqual(stored[STORAGE_KEYS.inboxSettings], {
      ...before, autoMoveToRecommendedFolder: false, tagOnlyNoAutoMove: true
    })
  })
}

test('a failed Inbox save preserves the value, releases only its own lock and allows retry', async t => {
  const { stored, writes } = setup(t)
  aiNamingState.pendingFeatureSwitch = 'allowRemoteParsing'
  const before = structuredClone(managerState.inboxSettings)
  const failed = saveInboxWorkflowMode('capture', () => {})
  await flush()
  writes[0]?.finish('Storage unavailable')
  await failed
  assert.equal(managerState.inboxSettingsSaving, false)
  assert.equal(aiNamingState.pendingFeatureSwitch, 'allowRemoteParsing')
  assert.deepEqual(managerState.inboxSettings, before)
  assert.deepEqual(stored[STORAGE_KEYS.inboxSettings], before)
  assert.equal(view().inboxWorkflow.status, 'Storage unavailable')
  assert.equal(view().inboxWorkflow.disabled, false)

  const retry = saveInboxWorkflowMode('capture', () => {})
  await flush()
  writes[1]?.finish()
  await retry
  assert.equal(managerState.inboxSettingsSaving, false)
  assert.equal(aiNamingState.pendingFeatureSwitch, 'allowRemoteParsing')
  assert.equal(view().inboxWorkflow.value, 'capture')
  assert.equal(stored[STORAGE_KEYS.inboxSettings].autoAnalyzeEnabled, false)
})
