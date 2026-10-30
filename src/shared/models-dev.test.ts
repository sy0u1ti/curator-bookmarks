import assert from 'node:assert/strict'
import {
  findModelsDevModel, MODELS_DEV_MAX_BYTES, MODELS_DEV_REFRESH_MS, MODELS_DEV_URL, parseModelsDevCatalog,
  type ModelsDevCatalog
} from './models-dev.js'
import {
  DEFAULT_MODELS_DEV_SETTINGS, loadModelsDevSnapshot, normalizeModelsDevCache, normalizeModelsDevSyncSettings,
  type ModelsDevCache
} from './models-dev-cache.js'
import { createModelsDevSyncService, getModelsDevNextRefresh } from './models-dev-sync.js'
import { STORAGE_KEYS } from './constants.js'
import { getModelReasoningProfile, getReasoningTransport } from './ai-reasoning.js'
import { buildAiProviderConnectivityRequestBody, requestStructuredAiOutput, clearAiProviderCompatibilityCache } from './ai-runtime.js'
import { normalizeAiNamingSettings, serializeAiNamingSettings } from '../options/sections/ai-settings.js'

const tests: Array<[string, () => void | Promise<void>]> = []
const test = (name: string, run: () => void | Promise<void>) => tests.push([name, run])
const rawModel = {
  id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash 1017', canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
  reasoning: true, reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['low', 'high', 'max'] }],
  limit: { context: 1048576, output: 393216 }, modalities: { input: ['text', 'image'], output: ['text'] },
  tool_call: true, structured_output: true, release_date: '2026-10-17', last_updated: '2026-10-17', knowledge: '2025-05',
  cost: { input: 0.15, output: 0.6, cache_read: 0.003 },
  provider: { body: { dangerous: true } }, experimental: { body: { untrusted: true } }
}
function fixturePayload() {
  return {
    providers: {
      deepseek: { id: 'deepseek', name: 'DeepSeek', api: 'https://api.deepseek.com', models: {
        'deepseek-flash': structuredClone(rawModel),
        'deepseek-v4-flash': { ...structuredClone(rawModel), id: 'deepseek-v4-flash' }
      } },
      relay: { id: 'relay', name: 'Relay', api: 'https://relay.example/v1', models: {
        'future-text': { ...structuredClone(rawModel), id: 'future-text' }
      } }
    },
    models: {
      'deepseek/deepseek-v4.1-flash': { ...structuredClone(rawModel), id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', release_date: '2026-09-10' },
      'deepseek/deepseek-v4.1-flash-1017': { ...structuredClone(rawModel), id: 'deepseek/deepseek-v4.1-flash-1017' }
    }
  }
}
function cacheAt(catalog = parseModelsDevCatalog(fixturePayload()), time = 100000): ModelsDevCache {
  return { version: 1, catalog, checkedAt: time, updatedAt: time, etag: '"fixture-v1"' }
}
const direct = { baseUrl: 'https://api.deepseek.com/v1', apiStyle: 'chat_completions' as const, model: 'deepseek-flash' }
const json = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', ...headers } })

test('parsing whitelists metadata and preserves zero prices, dates and modalities', () => {
  const payload = fixturePayload()
  payload.providers.deepseek.models['deepseek-flash'].cost.input = 0
  const catalog = parseModelsDevCatalog(payload)
  const match = findModelsDevModel(catalog, direct)!
  assert.equal(match.kind, 'provider')
  assert.equal(match.model.cost?.input, 0)
  assert.equal(match.model.context, 1048576)
  assert.equal(match.model.knowledge, '2025-05')
  assert.deepEqual(match.model.inputModalities, ['text', 'image'])
  assert.equal('provider' in match.model, false)
  assert.equal(JSON.stringify(catalog).includes('dangerous'), false)
  assert.equal(catalog.models[0].cost, undefined)
  assert.equal(catalog.models[0].reasoningOptions, undefined)
  assert.deepEqual(normalizeModelsDevCache(JSON.parse(JSON.stringify(cacheAt(catalog))))?.catalog, catalog)
})

test('invalid and oversized schemas cannot replace a usable catalog', () => {
  for (const value of [null, {}, [], { providers: {}, models: {} }, { providers: [], models: [] }]) {
    assert.throws(() => parseModelsDevCatalog(value), /invalid_catalog/)
  }
  const raw = fixturePayload() as any
  raw.providers.deepseek.models['deepseek-flash'].cost.input = -1
  raw.providers.deepseek.models['deepseek-flash'].limit.context = Infinity
  raw.providers.deepseek.models['deepseek-flash'].last_updated = '2026-02-30'
  raw.providers.deepseek.models['deepseek-flash'].reasoning_options = [{ type: 'unknown', code: 'run' }]
  const model = findModelsDevModel(parseModelsDevCatalog(raw), direct)!.model
  assert.equal(model.cost?.input, undefined)
  assert.equal(model.context, undefined)
  assert.equal(model.updatedDate, undefined)
  assert.equal(model.reasoningOptions, undefined)
  assert.equal(normalizeModelsDevCache({ ...cacheAt(), version: 2 }), null)
  assert.deepEqual(normalizeModelsDevSyncSettings({ autoUpdate: 'true', failures: Infinity, lastError: '<script>' }), DEFAULT_MODELS_DEV_SETTINGS)
})

test('provider identity includes endpoint path, origin, port and exact model ID', () => {
  const catalog = parseModelsDevCatalog(fixturePayload())
  for (const baseUrl of ['https://api.deepseek.com', 'https://api.deepseek.com/v1/', 'https://api.deepseek.com/v1/chat/completions']) {
    assert.equal(findModelsDevModel(catalog, { ...direct, baseUrl })?.kind, 'provider')
  }
  for (const baseUrl of ['https://api.deepseek.com.evil.example/v1', 'https://api.deepseek.com:9443/v1', 'https://api.deepseek.com/plan/v1', 'https://api.deepseek.com/v1?route=plan']) {
    assert.equal(findModelsDevModel(catalog, { ...direct, baseUrl }), null)
  }
  assert.equal(findModelsDevModel(catalog, { ...direct, model: 'deepseek-v4-flash' })?.model.canonicalId, 'deepseek/deepseek-v4.1-flash-1017')
  assert.equal(findModelsDevModel(catalog, { ...direct, model: 'other-prefix/deepseek-flash' }), null)
})

test('gateway aliases match canonical information, never another route price or controls', () => {
  const catalog = parseModelsDevCatalog(fixturePayload())
  const match = findModelsDevModel(catalog, { baseUrl: 'https://gateway.example', model: 'group/auto-deepseek-v4-1-flash' })!
  assert.equal(match.kind, 'model')
  assert.equal(match.model.id, 'deepseek/deepseek-v4.1-flash')
  assert.equal(match.model.cost, undefined)
  assert.equal(match.model.reasoningOptions, undefined)
  assert.equal(findModelsDevModel(catalog, { model: 'deepseek/deepseek-v4.1-flash-1017:free' })?.model.id, 'deepseek/deepseek-v4.1-flash-1017')
  for (const model of ['deepseek-v4-flash-unknown', 'deepseek-v4.10-flash', 'deepseek-v4.1-flash-1020']) {
    assert.equal(findModelsDevModel(catalog, { model }), null)
  }
})

test('shared endpoints and duplicate canonical aliases remain ambiguous', () => {
  const raw = fixturePayload() as any
  raw.providers.subscription = { ...raw.providers.deepseek, id: 'subscription', name: 'Subscription' }
  raw.models['other/deepseek-v4.1-flash'] = { ...raw.models['deepseek/deepseek-v4.1-flash'], id: 'other/deepseek-v4.1-flash' }
  const catalog = parseModelsDevCatalog(raw)
  assert.equal(findModelsDevModel(catalog, direct), null)
  assert.equal(findModelsDevModel(catalog, { model: 'group/auto-deepseek-v4-1-flash' }), null)
  assert.equal(findModelsDevModel(catalog, { model: 'deepseek/deepseek-v4.1-flash' })?.kind, 'model')
})

test('providers with omitted API URLs use only explicit official defaults', () => {
  const raw = fixturePayload() as any
  raw.providers.openai = { id: 'openai', name: 'OpenAI', models: { 'future-model': { name: 'Future' } } }
  raw.providers.unknown = { id: 'unknown', name: 'Unknown', models: { 'future-model': { name: 'Future' } } }
  const catalog = parseModelsDevCatalog(raw)
  assert.equal(findModelsDevModel(catalog, { baseUrl: 'https://api.openai.com/v1/responses', model: 'future-model' })?.providerId, 'openai')
  assert.equal(findModelsDevModel(catalog, { baseUrl: 'https://unknown.example/v1', model: 'future-model' }), null)
})

test('case-distinct route IDs keep their own prices and ambiguous casing is not guessed', () => {
  const raw = fixturePayload() as any
  raw.providers.relay.models = { 'Future-Model': { name: 'First', cost: { input: 1 } }, 'future-model': { name: 'Second', cost: { input: 2 } } }
  const catalog = parseModelsDevCatalog(raw)
  assert.equal(findModelsDevModel(catalog, { baseUrl: 'https://relay.example/v1', model: 'Future-Model' })?.model.cost?.input, 1)
  assert.equal(findModelsDevModel(catalog, { baseUrl: 'https://relay.example/v1', model: 'future-model' })?.model.cost?.input, 2)
  assert.equal(findModelsDevModel(catalog, { baseUrl: 'https://relay.example/v1', model: 'FUTURE-MODEL' }), null)
})

test('case-distinct canonical IDs keep their own metadata and reject ambiguous casing', () => {
  const raw = fixturePayload() as any
  raw.models = {
    'lab/Future-Model': { name: 'First', limit: { context: 1000 } },
    'lab/future-model': { name: 'Second', limit: { context: 2000 } }
  }
  const catalog = parseModelsDevCatalog(raw)
  assert.equal(findModelsDevModel(catalog, { model: 'lab/Future-Model' })?.model.context, 1000)
  assert.equal(findModelsDevModel(catalog, { model: 'lab/future-model' })?.model.context, 2000)
  assert.equal(findModelsDevModel(catalog, { model: 'LAB/FUTURE-MODEL' }), null)
  assert.equal(findModelsDevModel(catalog, { model: 'proxy/auto-future-model' }), null)
})

test('explicit channel metadata beats catalog efforts without losing native transport', () => {
  const modelMetadata = findModelsDevModel(parseModelsDevCatalog(fixturePayload()), direct)
  const context = { ...direct, modelMetadata }
  const profile = getModelReasoningProfile(direct.model, null, context)
  assert.equal(profile.source, 'models_dev')
  assert.deepEqual(profile.levels, ['none', 'low', 'high', 'max'])
  const channel = { levels: ['low', 'high'] as const, defaultEffort: 'low' as const }
  const capability = { ...channel, levels: [...channel.levels] }
  assert.equal(getModelReasoningProfile(direct.model, capability, context).source, 'metadata')
  assert.deepEqual(getModelReasoningProfile(direct.model, capability, context).levels, ['low', 'high'])
  assert.equal(getReasoningTransport(direct.model, context, capability).kind, 'effort_with_thinking')
  const body = buildAiProviderConnectivityRequestBody({ ...direct, reasoningEffort: 'low', modelMetadata, reasoningCapabilities: { 'deepseek-flash': capability } })
  assert.equal(body.reasoning_effort, 'low')
  assert.deepEqual(body.thinking, { type: 'enabled' })
})

test('reasoning booleans, fixed models, toggles and token budgets never manufacture effort tiers', () => {
  const catalog = parseModelsDevCatalog(fixturePayload())
  const modelMetadata = findModelsDevModel(catalog, direct)!
  const baseline = getModelReasoningProfile(direct.model, null, direct)
  const context = { ...direct, modelMetadata: { ...modelMetadata, model: { ...modelMetadata.model, reasoningOptions: undefined } } }
  assert.deepEqual(getModelReasoningProfile(direct.model, null, context), baseline)
  const fixed = { ...context, modelMetadata: { ...modelMetadata, model: { ...modelMetadata.model, reasoningOptions: [] } } }
  assert.equal(getModelReasoningProfile(direct.model, null, fixed).supported, false)
  assert.equal(getReasoningTransport(direct.model, fixed).kind, 'fixed')
  const budget = { ...modelMetadata, model: { ...modelMetadata.model, reasoningOptions: [{ type: 'budget_tokens' as const, min: 128, max: 32768 }] } }
  assert.deepEqual(getModelReasoningProfile(direct.model, null, { ...direct, modelMetadata: budget }).levels, ['default'])
  const toggle = { ...modelMetadata, model: { ...modelMetadata.model, reasoningOptions: [{ type: 'toggle' as const }] } }
  assert.deepEqual(getModelReasoningProfile(direct.model, null, { ...direct, modelMetadata: toggle }).levels, ['none', 'high'])
  const body = buildAiProviderConnectivityRequestBody({ ...direct, reasoningEffort: 'high', modelMetadata: toggle })
  assert.deepEqual(body.thinking, { type: 'enabled' })
  assert.equal(body.reasoning_effort, undefined)
})

test('catalog and channel metadata do not enable an unsupported native protocol', () => {
  const raw = fixturePayload() as any
  raw.providers.relay.api = 'https://api.siliconflow.com/v1'
  const settings = { baseUrl: 'https://api.siliconflow.com/v1', model: 'future-text', apiStyle: 'responses' }
  const modelMetadata = findModelsDevModel(parseModelsDevCatalog(raw), settings)
  assert.equal(getModelReasoningProfile(settings.model, null, { ...settings, modelMetadata }).supported, false)
})

test('catalog model controls cannot prove Responses support for a future native model', () => {
  const raw = fixturePayload() as any
  raw.providers.deepseek.models['future-deepseek'] = { ...rawModel, id: 'future-deepseek' }
  const settings = { baseUrl: 'https://api.deepseek.com/v1', model: 'future-deepseek', apiStyle: 'responses' }
  const modelMetadata = findModelsDevModel(parseModelsDevCatalog(raw), settings)
  assert.equal(modelMetadata?.kind, 'provider')
  assert.equal(getModelReasoningProfile(settings.model, null, { ...settings, modelMetadata }).supported, false)
  assert.equal(getReasoningTransport(settings.model, { ...settings, modelMetadata }).kind, 'unsupported')
})

function syncFixture(initial: Record<string, unknown> = {}) {
  let stored = structuredClone(initial)
  let time = 1000000
  let permitted = true
  let fetcher: typeof fetch = async () => json(fixturePayload(), { etag: '"fixture-v1"' })
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const schedules: Array<number | null> = []
  const dependencies = {
    read: async () => structuredClone(stored),
    write: async (values: Record<string, unknown>) => { stored = { ...stored, ...structuredClone(values) } },
    hasPermission: async () => permitted,
    schedule: async (when: number | null) => { schedules.push(when) },
    now: () => time,
    fetch: (async (url, init) => { calls.push({ url: String(url), init }); return fetcher(url, init) }) as typeof fetch
  }
  const service = createModelsDevSyncService(dependencies)
  return {
    service, calls, schedules, dependencies,
    get stored() { return stored },
    set time(value: number) { time = value },
    set permitted(value: boolean) { permitted = value },
    set fetcher(value: typeof fetch) { fetcher = value }
  }
}

test('automatic downloads are opt-in and permissions are never requested in the worker', async () => {
  const fixture = syncFixture()
  assert.deepEqual(await fixture.service.refresh(false), { ok: true, updated: false })
  assert.equal(fixture.calls.length, 0)
  assert.equal(fixture.schedules.at(-1), null)
  fixture.permitted = false
  assert.deepEqual(await fixture.service.configure(true), { ok: false, error: 'permission' })
  assert.deepEqual(await fixture.service.refresh(), { ok: false, error: 'permission' })
  assert.equal(fixture.calls.length, 0)
  assert.equal(normalizeModelsDevSyncSettings(fixture.stored[STORAGE_KEYS.modelsDevSync]).autoUpdate, false)
})

test('disabled background startup never loads the large catalog cache', async () => {
  const fixture = syncFixture()
  const reads: string[][] = []
  const service = createModelsDevSyncService({
    ...fixture.dependencies,
    read: async (keys) => { reads.push(keys ?? []); return {} }
  })
  await service.refresh(false)
  assert.ok(reads.length > 0 && reads.every((keys) => !keys.includes(STORAGE_KEYS.modelsDevCatalog)))
})

test('fixed public GET is anonymous and persists separately from provider credentials', async () => {
  const credentials = { apiKey: 'private-key', baseUrl: 'https://private.example', model: 'private-model' }
  const fixture = syncFixture({ [STORAGE_KEYS.aiProviderSettings]: credentials })
  assert.deepEqual(await fixture.service.refresh(), { ok: true, updated: true })
  const { url, init } = fixture.calls[0]
  assert.equal(url, MODELS_DEV_URL)
  assert.equal(init?.method, 'GET')
  assert.equal(init?.credentials, 'omit')
  assert.equal(init?.redirect, 'error')
  assert.equal(init?.referrerPolicy, 'no-referrer')
  assert.equal(init?.body, undefined)
  assert.deepEqual(init?.headers, { Accept: 'application/json' })
  assert.deepEqual(fixture.stored[STORAGE_KEYS.aiProviderSettings], credentials)
  assert.equal(normalizeModelsDevCache(fixture.stored[STORAGE_KEYS.modelsDevCatalog])?.checkedAt, 1000000)
})

test('ETag 304 updates freshness without replacing data or its update timestamp', async () => {
  const fixture = syncFixture()
  await fixture.service.refresh()
  fixture.time = 2000000
  fixture.fetcher = async () => new Response(null, { status: 304 })
  assert.deepEqual(await fixture.service.refresh(), { ok: true, updated: false })
  assert.equal((fixture.calls[1].init?.headers as any)['If-None-Match'], '"fixture-v1"')
  const cache = normalizeModelsDevCache(fixture.stored[STORAGE_KEYS.modelsDevCatalog])!
  assert.equal(cache.checkedAt, 2000000)
  assert.equal(cache.updatedAt, 1000000)
})

test('concurrent manual refreshes share one download and one commit', async () => {
  const fixture = syncFixture()
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  fixture.fetcher = async () => { await gate; return json(fixturePayload()) }
  const first = fixture.service.refresh()
  const second = fixture.service.refresh()
  assert.equal(first, second)
  release()
  await first
  assert.equal(fixture.calls.length, 1)
})

test('a skipped startup refresh cannot swallow a simultaneous manual refresh', async () => {
  const fixture = syncFixture()
  const startup = fixture.service.refresh(false)
  const manual = fixture.service.refresh()
  await startup
  assert.deepEqual(await manual, { ok: true, updated: true })
  assert.equal(fixture.calls.length, 1)
})

test('the latest preference wins when an earlier permission check is still pending', async () => {
  const fixture = syncFixture()
  let release!: (value: boolean) => void
  const permission = new Promise<boolean>((resolve) => { release = resolve })
  const service = createModelsDevSyncService({ ...fixture.dependencies, hasPermission: () => permission })
  const enable = service.configure(true)
  await service.configure(false)
  release(true)
  await enable
  assert.equal(normalizeModelsDevSyncSettings(fixture.stored[STORAGE_KEYS.modelsDevSync]).autoUpdate, false)
  assert.equal(fixture.schedules.at(-1), null)
})

test('network, malformed JSON, wrong MIME and oversized responses keep the last good cache', async () => {
  const cache = cacheAt()
  for (const [fetcher, error] of [
    [async () => { throw new Error('offline') }, 'network'],
    [async () => json({}), 'invalid_catalog'],
    [async () => new Response('{', { headers: { 'content-type': 'application/json' } }), 'invalid_catalog'],
    [async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }), 'invalid_catalog'],
    [async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(MODELS_DEV_MAX_BYTES + 1) } }), 'too_large'],
    [async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MODELS_DEV_MAX_BYTES + 1)); controller.close() } }), { headers: { 'content-type': 'application/json' } }), 'too_large']
  ] as Array<[typeof fetch, string]>) {
    const fixture = syncFixture({ [STORAGE_KEYS.modelsDevCatalog]: cache })
    fixture.fetcher = fetcher
    assert.deepEqual(await fixture.service.refresh(), { ok: false, error })
    assert.deepEqual(fixture.stored[STORAGE_KEYS.modelsDevCatalog], cache)
  }
})

test('daily freshness and exponential failure backoff survive worker restarts', async () => {
  const fixture = syncFixture()
  await fixture.service.configure(true)
  await fixture.service.refresh(false)
  await fixture.service.refresh(false)
  assert.equal(fixture.calls.length, 1)
  fixture.time = 1000000 + MODELS_DEV_REFRESH_MS
  fixture.fetcher = async () => { throw new Error('offline') }
  await fixture.service.refresh(false)
  await createModelsDevSyncService(fixture.dependencies).refresh(false)
  assert.equal(fixture.calls.length, 2)
  assert.equal(fixture.schedules.at(-1), 1000000 + MODELS_DEV_REFRESH_MS + 3600000)
  fixture.time = 1000000 + MODELS_DEV_REFRESH_MS + 3600000
  await fixture.service.refresh(false)
  assert.equal(fixture.schedules.at(-1), 1000000 + MODELS_DEV_REFRESH_MS + 3 * 3600000)
  assert.equal(getModelsDevNextRefresh(cacheAt(undefined, 2000000), DEFAULT_MODELS_DEV_SETTINGS, 1000000), 0, 'clock rollback must not freeze refresh forever')
})

test('opting out during an automatic refresh cancels it and cannot re-enable itself', async () => {
  const fixture = syncFixture()
  await fixture.service.configure(true)
  let started!: () => void
  const gate = new Promise<void>((resolve) => { started = resolve })
  fixture.fetcher = async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    started()
  })
  const refresh = fixture.service.refresh(false)
  await gate
  await fixture.service.configure(false)
  await refresh
  assert.equal(normalizeModelsDevSyncSettings(fixture.stored[STORAGE_KEYS.modelsDevSync]).autoUpdate, false)
  assert.equal(fixture.stored[STORAGE_KEYS.modelsDevCatalog], undefined)
  assert.equal(fixture.schedules.at(-1), null)
})

test('manual refresh completion preserves a concurrent automatic-update opt-out', async () => {
  const fixture = syncFixture()
  await fixture.service.configure(true)
  let release!: () => void
  let started!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const start = new Promise<void>((resolve) => { started = resolve })
  fixture.fetcher = async () => { started(); await gate; return json(fixturePayload()) }
  const refresh = fixture.service.refresh()
  await start
  await fixture.service.configure(false)
  release()
  assert.equal((await refresh).ok, true)
  assert.equal(normalizeModelsDevSyncSettings(fixture.stored[STORAGE_KEYS.modelsDevSync]).autoUpdate, false)
})

test('storage write failures return a real failure, not a false successful refresh', async () => {
  const fixture = syncFixture({ [STORAGE_KEYS.modelsDevCatalog]: cacheAt() })
  const service = createModelsDevSyncService({ ...fixture.dependencies, write: async () => { throw new Error('quota') } })
  assert.deepEqual(await service.refresh(), { ok: false, error: 'storage' })
  assert.equal(normalizeModelsDevCache(fixture.stored[STORAGE_KEYS.modelsDevCatalog])?.checkedAt, 100000)
})

test('timed-out downloads abort and retain the last-good cache', async () => {
  const original = cacheAt()
  const fixture = syncFixture({ [STORAGE_KEYS.modelsDevCatalog]: original })
  const service = createModelsDevSyncService({
    ...fixture.dependencies,
    timeoutMs: 5,
    fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  })
  assert.deepEqual(await service.refresh(), { ok: false, error: 'network' })
  assert.deepEqual(fixture.stored[STORAGE_KEYS.modelsDevCatalog], original)
})

test('catalog metadata is never serialized into the saved channel settings', () => {
  const result = serializeAiNamingSettings(normalizeAiNamingSettings({
    ...direct, apiKey: 'fixture', modelMetadata: findModelsDevModel(parseModelsDevCatalog(fixturePayload()), direct)
  }))
  assert.equal('modelMetadata' in result, false)
  assert.equal(JSON.stringify(result).includes('canonicalId'), false)
})

test('runtime snapshots local catalog across fallback attempts and observes updates on the next call', async () => {
  const originalChrome = globalThis.chrome
  const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>()
  let storedCache = cacheAt()
  let reads = 0
  let finishInitialRead!: (value: unknown) => void
  ;(globalThis as any).chrome = {
    runtime: {},
    storage: {
      local: { get: (_keys: unknown, callback: (value: unknown) => void) => { reads++; finishInitialRead = callback } },
      onChanged: { addListener: (listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => listeners.add(listener) }
    }
  }
  try {
    const initialRead = loadModelsDevSnapshot()
    const olderCache = storedCache
    storedCache = structuredClone(storedCache)
    storedCache.checkedAt += 1
    for (const listener of listeners) listener({ [STORAGE_KEYS.modelsDevCatalog]: { newValue: storedCache } }, 'local')
    finishInitialRead({ [STORAGE_KEYS.modelsDevCatalog]: olderCache })
    assert.equal((await initialRead).cache?.checkedAt, storedCache.checkedAt, 'storage events during hydration must beat an older read')
    const modelMetadata = findModelsDevModel(storedCache.catalog, { baseUrl: 'https://relay.example/v1', model: 'future-text' })!
    assert.equal(modelMetadata.kind, 'provider')
    const requested: unknown[] = []
    let calls = 0
    const schema = { type: 'object' as const, additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' as const } } }
    const invoke = () => requestStructuredAiOutput({
      settings: { baseUrl: 'https://relay.example/v1', apiKey: 'fixture', model: 'future-text', apiStyle: 'chat_completions', reasoningEffort: 'max' },
      schema, schemaName: 'catalog_snapshot', systemPrompt: 'Test', userPrompt: 'Test',
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body))
        requested.push(body.reasoning_effort)
        if (++calls === 1) {
          const catalog: ModelsDevCatalog = structuredClone(storedCache.catalog)
          catalog.providers.find((provider) => provider.id === 'relay')!.models[0].reasoningOptions = [{ type: 'effort', values: ['low', 'high'] }]
          storedCache = cacheAt(catalog, 200000)
          for (const listener of listeners) listener({ [STORAGE_KEYS.modelsDevCatalog]: { newValue: storedCache } }, 'local')
          return new Response(JSON.stringify({ error: { message: 'response_format json_schema is not supported' } }), { status: 400 })
        }
        return json({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] })
      }
    })
    clearAiProviderCompatibilityCache()
    await invoke()
    await invoke()
    assert.deepEqual(requested, ['max', 'max', 'high'])
    assert.equal(reads, 1, 'no network or repeated storage reads on the AI request path')
    for (const listener of listeners) listener({ [STORAGE_KEYS.modelsDevCatalog]: { newValue: undefined } }, 'local')
  } finally { globalThis.chrome = originalChrome }
})

for (const [name, run] of tests) {
  try { await run() } catch (error) { console.error(`FAILED: ${name}`); throw error }
}
console.log(`models.dev tests passed: ${tests.length} scenarios; provider and catalog requests mocked.`)
