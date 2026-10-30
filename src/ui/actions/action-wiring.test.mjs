import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { transform } from 'esbuild'

// Execute the production handlers with isolated services, never a real extension profile.
async function handler(file, name, globals) {
  const source = await readFile(file, 'utf8')
  const match = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm').exec(source)
  assert.ok(match, `${name} exists`)
  const tail = source.slice(match.index)
  const end = /\n(?:export )?(?:async )?function \w+\(/.exec(tail)
  const code = tail.slice(0, end?.index).replace(/^export /, '')
  const compiled = await transform(`${code}\nglobalThis.subject = ${name}`, { loader: 'ts' })
  const context = vm.createContext({ Error, Date, Blob, console, ...globals })
  vm.runInContext(compiled.code, context)
  return context
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const idle = { status: 'idle', updatedAt: 0 }
const actionFeedback = status => ({ status, updatedAt: Date.now() })
const noop = () => {}
const optionsFile = 'src/options/options-controller.ts'

for (const success of [true, false]) {
  const service = deferred()
  const context = await handler(optionsFile, 'handleAiConnectivityTest', {
    actionFeedback, aiConnectionFeedback: idle,
    aiNamingState: {}, aiNamingManagerState: { settings: { timeoutMs: 30000 } },
    areAiProviderSettingsLocked: () => false,
    syncAiNamingSettingsDraftFromState: () => ({ baseUrl: 'https://fixture.invalid' }),
    validateAiNamingSettings: noop, resetAiNamingConnectivityState: noop,
    renderAvailabilitySection: noop, ensureAiNamingProviderPermission: async () => true,
    requestAiNamingConnectivityTest: () => service.promise,
    hydrateAiNamingPermissionState: async () => {},
    normalizeAiNamingConnectivityError: error => error.message
  })
  const running = context.subject()
  await Promise.resolve()
  assert.equal(context.aiConnectionFeedback.status, 'pending')
  if (success) service.resolve('Connected')
  else service.reject(new Error('Permission denied'))
  await running
  assert.equal(context.aiConnectionFeedback.status, success ? 'success' : 'error')
  assert.equal(context.aiNamingState.testingConnection, false)
}

for (const success of [true, false]) {
  const service = deferred()
  const settings = { baseUrl: 'https://fixture.invalid', apiKey: 'fake', apiStyle: 'chat', timeoutMs: 30000 }
  const context = await handler(optionsFile, 'handleFetchAiModels', {
    actionFeedback, aiModelsFeedback: idle, aiNamingState: {},
    aiNamingManagerState: { settings },
    areAiProviderSettingsLocked: () => false, syncAiNamingSettingsDraftFromState: noop,
    getAiProviderBaseUrlIssue: () => '', isAiProviderKeyConfigured: () => true,
    renderAiFetchModelsStatus: noop, renderAiNamingSection: noop,
    ensureAiNamingProviderPermission: async () => true, getAiModelsEndpoint: () => settings.baseUrl,
    AI_NAMING_FETCHED_MODELS_LIMIT: 100, AI_AUXILIARY_RESPONSE_MAX_BYTES: 10000,
    getAiProviderAuthHeaders: () => ({}), fetchTextWithRequestTimeout: () => service.promise,
    parseJsonResponseText: JSON.parse,
    parseAiModelCatalogPage: payload => ({ models: payload.data, nextPageUrl: null }),
    normalizeAiNamingFetchedModels: ids => ids, extractModelReasoningCapabilities: () => ({}),
    normalizeAiNamingSettings: value => value, saveAiNamingSettings: async () => {},
    recordPrivacyAudit: noop, getSafeAuditTarget: value => value
  })
  const running = context.subject()
  await Promise.resolve()
  assert.equal(context.aiModelsFeedback.status, 'pending')
  if (success) service.resolve({ response: { ok: true }, text: '{"data":[{"id":"fixture-model"}]}' })
  else service.reject(new Error('Unavailable'))
  await running
  assert.equal(context.aiModelsFeedback.status, success ? 'success' : 'error')
  assert.equal(context.aiNamingState.fetchingModels, false)
}

for (const [name, field] of [['handleFullBackupExport', 'backup'], ['handleBookmarkHtmlExport', 'html']]) {
  for (const success of [true, false]) {
    const service = deferred()
    let downloads = 0
    const context = await handler(optionsFile, name, {
      actionFeedback, exportFeedback: { backup: idle, html: idle },
      backupRestoreState: { restoring: false, exporting: false },
      renderBackupRestoreSection: noop, createCuratorBackupFile: () => service.promise,
      getBookmarkTree: () => service.promise, buildBookmarkHtmlExport: () => '<html></html>',
      getBackupFileName: () => 'fixture.json',
      downloadJsonFile: () => { downloads++ }, downloadBlobFile: () => { downloads++ }
    })
    const running = context.subject()
    assert.equal(context.exportFeedback[field].status, 'pending')
    assert.equal(context.exportFeedback[field === 'backup' ? 'html' : 'backup'].status, 'idle')
    if (success) service.resolve({ notes: [] })
    else service.reject(new Error('Storage unavailable'))
    await running
    assert.equal(context.exportFeedback[field].status, success ? 'success' : 'error')
    assert.equal(downloads, success ? 1 : 0)
    assert.equal(context.backupRestoreState.exporting, false)
  }
}
{
  const context = await handler(optionsFile, 'handleBookmarkTagExport', {
    actionFeedback, exportFeedback: { tags: idle }, aiNamingState: {},
    renderBackupControls: noop, renderAiNamingSection: noop, renderActiveOptionsSection: noop,
    getCurrentBookmarksForTagData: async () => [], loadBookmarkTagIndex: async () => ({}),
    buildBookmarkTagExport: () => ({ records: [] }),
    downloadJsonFile: () => assert.fail('Empty exports must not download')
  })
  await context.subject()
  assert.equal(context.exportFeedback.tags.status, 'error', 'an empty export is not a successful export')
}

for (const outcome of ['success', 'error', 'stale']) {
  const service = deferred()
  const pending = new Set()
  let writes = 0
  let errors = 0
  const context = await handler('src/popup/popup-controller.ts', 'copyBookmarkUrl', {
    actionFeedback, popupCopyFeedback: new Map(), popupActionStateVersion: 0, popupSessionId: 1,
    state: { bookmarkMap: new Map([['fixture', { title: 'Fixture', url: 'https://fixture.invalid' }]]) },
    isPopupActionPending: (_, id) => pending.has(id),
    setPopupActionPending: (_, id, busy) => busy ? pending.add(id) : pending.delete(id),
    renderMainContent: noop, writeClipboardText: () => { writes++; return service.promise },
    showToast: () => { errors++ }
  })
  const running = context.subject('fixture')
  await context.subject('fixture')
  assert.equal(writes, 1, 'repeated copies are deduplicated while pending')
  assert.equal(context.popupCopyFeedback.get('fixture').status, 'pending')
  if (outcome === 'stale') {
    context.popupSessionId++
    context.popupCopyFeedback.clear()
  }
  if (outcome === 'error') service.reject(new Error('Clipboard unavailable'))
  else service.resolve()
  await running
  assert.equal(context.popupCopyFeedback.get('fixture')?.status, outcome === 'stale' ? undefined : outcome)
  assert.equal(errors, outcome === 'error' ? 1 : 0)
}
for (const outcome of ['success', 'error', 'stale']) {
  const service = deferred()
  const context = await handler('src/newtab/newtab-controller.ts', 'copyActiveMenuBookmarkUrl', {
    actionFeedback, bookmarkCopyFeedback: idle, bookmarkMenuSession: 1,
    state: { menuBusy: false },
    getActiveMenuBookmark: () => ({ url: 'https://fixture.invalid' }),
    closeBookmarkMenu: noop, renderBookmarkMenu: noop,
    writeClipboardText: () => service.promise
  })
  context.isCurrentBookmarkMenuSession = session => session === context.bookmarkMenuSession
  const running = context.subject()
  assert.equal(context.bookmarkCopyFeedback.status, 'pending')
  if (outcome === 'stale') {
    context.bookmarkMenuSession++
    context.bookmarkCopyFeedback = idle
  }
  if (outcome === 'error') service.reject(new Error('Clipboard unavailable'))
  else service.resolve()
  await running
  assert.equal(context.bookmarkCopyFeedback.status, outcome === 'stale' ? 'idle' : outcome)
}
console.log('Production action wiring passed (15 isolated async scenarios).')
