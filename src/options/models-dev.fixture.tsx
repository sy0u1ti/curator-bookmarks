import { createRoot } from 'react-dom/client'
import { AiProviderSettings } from './components/AiProviderSettings'
import { publishAiProviderSettings } from './components/ai-provider-settings-store'
import { fixtureActions } from '../ui/actions/action-feedback.fixture-controller'
import { normalizeAiNamingSettings } from './sections/ai-settings'
import { actionFeedback, IDLE_ACTION_FEEDBACK } from '../shared/action-feedback'
import { findModelsDevModel } from '../shared/models-dev'
import { getModelsDevSnapshot, loadModelsDevSnapshot, subscribeModelsDevSnapshot } from '../shared/models-dev-cache'
import { createModelsDevSyncService, type ModelsDevMessage } from '../shared/models-dev-sync'
import { getModelReasoningProfile, getReasoningEffortOptions, resolveReasoningEffortForModel } from '../shared/ai-reasoning'
import { STORAGE_KEYS } from '../shared/constants'

const model = {
  id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash 1017',
  canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
  reasoning: true, reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['low', 'high', 'max'] }],
  limit: { context: 1048576, output: 393216 },
  modalities: { input: ['text', 'image'], output: ['text'] },
  tool_call: true, structured_output: true, last_updated: '2026-10-17', release_date: '2026-10-17',
  cost: { input: 0.15, output: 0.6, cache_read: 0.003 }
}
const payload = {
  providers: { deepseek: { id: 'deepseek', name: 'DeepSeek', api: 'https://api.deepseek.com', models: { 'deepseek-flash': model } } },
  models: { 'deepseek/deepseek-v4.1-flash': { ...model, name: 'DeepSeek V4.1 Flash', id: 'deepseek/deepseek-v4.1-flash', release_date: '2026-09-10' } }
}
let settings = normalizeAiNamingSettings({
  baseUrl: 'https://api.deepseek.com/v1', apiKey: 'sk-isolated-ui-fixture', model: 'deepseek-flash',
  apiStyle: 'chat_completions', reasoningEffort: 'max'
})
const stored: Record<string, unknown> = {}
const storageListeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>()
const probe = {
  errors: [] as string[], permissionAllowed: true, permissionRequests: [] as unknown[],
  catalogRequests: [] as Array<{ url: string; credentials?: string; body?: unknown }>,
  catalogMode: 'success', fetchModelsPending: false, schedule: null as number | null,
  completeCatalog: () => {}, completeModels: (_success: boolean) => {},
  select: (_type: string) => {}, stored
}
;(window as any).__modelsDevFixture = probe
window.addEventListener('error', (event) => probe.errors.push(event.message))
window.addEventListener('unhandledrejection', (event) => probe.errors.push(String(event.reason)))
document.documentElement.dataset.curatorSurface = 'options'

const write = async (values: Record<string, unknown>) => {
  Object.assign(stored, structuredClone(values))
  const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue: structuredClone(newValue) }]))
  for (const listener of storageListeners) listener(changes, 'local')
}
const read = async (keys: string[] = Object.keys(stored)) => Object.fromEntries(keys.map((key) => [key, stored[key]]))
const service = createModelsDevSyncService({
  read,
  write,
  hasPermission: async () => probe.permissionAllowed,
  schedule: async (when) => { probe.schedule = when },
  fetch: async (url, init) => {
    probe.catalogRequests.push({ url: String(url), credentials: init?.credentials, body: init?.body })
    if (probe.catalogMode === 'error') throw new Error('isolated network failure')
    if (probe.catalogMode === 'delayed') await new Promise<void>((resolve) => { probe.completeCatalog = resolve })
    const data = structuredClone(payload)
    if (probe.catalogMode === 'budget') {
      ;(data.providers.deepseek.models['deepseek-flash'] as any).reasoning_options = [{ type: 'budget_tokens', min: 128, max: 32768 }]
    }
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', etag: '"ui-fixture"' } })
  }
})
;(window as any).chrome = {
  runtime: {
    id: 'isolated-ui-fixture', getURL: (path: string) => `/${path}`,
    sendMessage: async (message: ModelsDevMessage) => {
      if (message.type === 'models-dev:refresh') return service.refresh()
      const result = await service.configure(message.autoUpdate)
      if (result.ok && message.autoUpdate) void service.refresh(false)
      return result
    }
  },
  storage: {
    local: { get: (keys: string[], callback: (values: Record<string, unknown>) => void) => { void read(keys).then(callback) } },
    onChanged: {
      addListener: (listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => storageListeners.add(listener),
      removeListener: (listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => storageListeners.delete(listener)
    }
  },
  permissions: { request: async (query: unknown) => { probe.permissionRequests.push(query); return probe.permissionAllowed } }
}
let modelsFeedback = IDLE_ACTION_FEEDBACK
let modelsStatus = ''

function publish() {
  const catalog = getModelsDevSnapshot()
  const capability = settings.reasoningCapabilities[settings.model] ?? null
  const modelMetadata = findModelsDevModel(catalog.cache?.catalog, settings)
  const context = { ...settings, modelMetadata }
  const profile = getModelReasoningProfile(settings.model, capability, context)
  publishAiProviderSettings({
    apiKey: settings.apiKey, apiKeyPlaceholder: 'API Key', baseUrl: settings.baseUrl, apiStyle: settings.apiStyle,
    apiStyleOptions: [{ label: 'OpenAI Chat Completions', value: 'chat_completions' }],
    batchSize: '6', timeoutMs: '30000', configStatusText: '已配置', configTone: 'muted',
    connectivityBusy: false, connectivityCopy: '', connectivityTone: 'muted', connectivityVisible: false,
    customModels: [], fieldsDisabled: probe.fetchModelsPending, hasRequiredConfig: true,
    modelToolsDisabled: probe.fetchModelsPending,
    reasoningEffort: resolveReasoningEffortForModel(settings.model, settings.reasoningEffort, capability, context),
    reasoningEffortOptions: getReasoningEffortOptions(settings.model, capability, context),
    reasoningEffortNote: profile.note, reasoningEffortSupported: profile.supported,
    revealApiKey: false, saveDisabled: false, saveStatusText: '', showSaveSettingsButton: false,
    testButtonSecondary: false, testDisabled: false, testLabel: '测试连接', testingConnection: false, testFeedback: IDLE_ACTION_FEEDBACK,
    modelCatalog: {
      loaded: catalog.loaded, autoUpdate: catalog.settings.autoUpdate, checkedAt: catalog.cache?.checkedAt ?? 0,
      lastError: catalog.settings.lastError, match: modelMetadata
    },
    modelTools: {
      fetchDisabled: probe.fetchModelsPending, fetchLabel: '获取模型', fetchModelsStatus: modelsStatus,
      fetchingModels: probe.fetchModelsPending, fetchFeedback: modelsFeedback, manageDisabled: false,
      selector: { currentModel: settings.model, customModels: [], disabled: false, fetchedModels: [],
        models: [settings.model], presetModels: [] }
    }
  })
}
fixtureActions.ai = (detail) => {
  if (detail.action === 'reasoning-effort-change') settings = normalizeAiNamingSettings({ ...settings, reasoningEffort: detail.value })
  if (detail.action === 'fetch-models') {
    probe.fetchModelsPending = true
    modelsFeedback = actionFeedback('pending')
    modelsStatus = '正在获取模型列表。'
  }
  publish()
}
probe.completeModels = (success) => {
  probe.fetchModelsPending = false
  modelsFeedback = actionFeedback(success ? 'success' : 'error')
  modelsStatus = success ? '已获取 1 个模型。' : '获取失败：隔离测试网络不可用。'
  publish()
}
probe.select = (type) => {
  settings = normalizeAiNamingSettings({
    ...settings, baseUrl: type === 'provider' ? 'https://api.deepseek.com/v1' : 'https://private-gateway.invalid/v1',
    model: type === 'provider' ? 'deepseek-flash' : type === 'canonical' ? 'group/auto-deepseek-v4-1-flash' : 'unlisted-private-model'
  })
  publish()
}
subscribeModelsDevSnapshot(publish)
publish()
void loadModelsDevSnapshot()
createRoot(document.getElementById('root')!).render(
  <main className="options-shell" style={{ maxWidth: 1040, margin: '24px auto', padding: 20 }}>
    <h1 style={{ fontSize: 22 }}>Curator</h1>
    <AiProviderSettings />
  </main>
)
