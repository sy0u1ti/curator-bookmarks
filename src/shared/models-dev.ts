import { getAiProviderModelsEndpoint, type AiEndpointSettings } from './ai-provider-url.js'

export const MODELS_DEV_URL = 'https://models.dev/catalog.json?type=chat'
export const MODELS_DEV_ORIGIN = 'https://models.dev/*'
export const MODELS_DEV_MAX_BYTES = 16 * 1024 * 1024
export const MODELS_DEV_REFRESH_MS = 24 * 60 * 60 * 1000

export type ModelsDevReasoningOption =
  | { type: 'effort'; values: string[] }
  | { type: 'toggle' }
  | { type: 'budget_tokens'; min?: number; max?: number }

export interface ModelsDevModel {
  id: string
  name: string
  canonicalId?: string
  context?: number
  output?: number
  inputModalities?: string[]
  outputModalities?: string[]
  reasoning?: boolean
  reasoningOptions?: ModelsDevReasoningOption[]
  toolCall?: boolean
  structuredOutput?: boolean
  releaseDate?: string
  updatedDate?: string
  knowledge?: string
  cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number }
}

export interface ModelsDevProvider {
  id: string
  name: string
  api?: string
  models: ModelsDevModel[]
}

export interface ModelsDevCatalog {
  version: 1
  providers: ModelsDevProvider[]
  models: ModelsDevModel[]
}

export interface ModelsDevMatch {
  kind: 'provider' | 'model'
  model: ModelsDevModel
  providerId?: string
  providerName?: string
}

const MAX_PROVIDERS = 512
const MAX_MODELS = 30000
const MAX_CANONICAL_MODELS = 5000
const MODALITIES = new Set(['text', 'image', 'audio', 'video', 'pdf'])
const OFFICIAL_APIS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1'
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown, max = 240): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.trim()
  return clean && clean.length <= max && !/[\u0000-\u001f\u007f]/.test(clean) ? clean : undefined
}

function number(value: unknown, max = 1e9): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined
}

function date(value: unknown, monthOnly = false): string | undefined {
  const clean = text(value, 10)
  if (!clean || !(monthOnly ? /^\d{4}-\d{2}(?:-\d{2})?$/ : /^\d{4}-\d{2}-\d{2}$/).test(clean)) return undefined
  const day = clean.length === 7 ? `${clean}-01` : clean
  const time = Date.parse(day)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? clean : undefined
}

function modalities(value: unknown): string[] | undefined {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && MODALITIES.has(item)))] : undefined
}

function apiUrl(value: unknown): string | undefined {
  try {
    const url = new URL(text(value, 1024) ?? '')
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return undefined
    return url.toString().replace(/\/+$/, '')
  } catch { return undefined }
}

function reasoningOptions(value: unknown): ModelsDevReasoningOption[] | undefined {
  if (!Array.isArray(value)) return undefined
  const options: ModelsDevReasoningOption[] = []
  for (const item of value.slice(0, 12)) {
    const option = record(item)
    if (option?.type === 'toggle') options.push({ type: 'toggle' })
    if (option?.type === 'effort' && Array.isArray(option.values)) {
      const values = [...new Set(option.values.slice(0, 24).map((value) => text(value, 32)?.toLowerCase()).filter((value): value is string => Boolean(value)))]
      if (values.length) options.push({ type: 'effort', values })
    }
    if (option?.type === 'budget_tokens') {
      const min = number(option.min)
      const max = number(option.max)
      if (min === undefined || max === undefined || min <= max) options.push({ type: 'budget_tokens', min, max })
    }
  }
  // Unknown future controls are not the same as an explicit "no controls".
  return !value.length || options.length ? options : undefined
}

function parseModel(value: unknown, id: string, cached: boolean, provider: boolean): ModelsDevModel | null {
  const source = record(value)
  if (!source || !text(id)) return null
  const limit = record(source.limit)
  const modes = record(source.modalities)
  const cost = provider ? record(source.cost) : null
  const model: ModelsDevModel = {
    id,
    name: text(source.name) ?? id,
    context: number(cached ? source.context : limit?.context),
    output: number(cached ? source.output : limit?.output),
    inputModalities: modalities(cached ? source.inputModalities : modes?.input),
    outputModalities: modalities(cached ? source.outputModalities : modes?.output),
    reasoning: typeof source.reasoning === 'boolean' ? source.reasoning : undefined,
    toolCall: typeof (cached ? source.toolCall : source.tool_call) === 'boolean' ? (cached ? source.toolCall : source.tool_call) as boolean : undefined,
    structuredOutput: typeof (cached ? source.structuredOutput : source.structured_output) === 'boolean' ? (cached ? source.structuredOutput : source.structured_output) as boolean : undefined,
    releaseDate: date(cached ? source.releaseDate : source.release_date),
    updatedDate: date(cached ? source.updatedDate : source.last_updated),
    knowledge: date(source.knowledge, true)
  }
  if (provider) {
    model.canonicalId = text(cached ? source.canonicalId : source.canonical_model_id)
    model.reasoningOptions = reasoningOptions(cached ? source.reasoningOptions : source.reasoning_options)
    if (cost) model.cost = {
      input: number(cost.input, 1e6),
      output: number(cost.output, 1e6),
      cacheRead: number(cached ? cost.cacheRead : cost.cache_read, 1e6),
      cacheWrite: number(cached ? cost.cacheWrite : cost.cache_write, 1e6)
    }
  }
  return model
}

/** Both network and storage are untrusted; retain data, never SDK/body overrides. */
export function parseModelsDevCatalog(value: unknown, cached = false): ModelsDevCatalog {
  const source = record(value)
  const providerSource = source?.providers
  const modelSource = source?.models
  if (!source || (cached && source.version !== 1) ||
    !(cached ? Array.isArray(providerSource) && Array.isArray(modelSource) : record(providerSource) && record(modelSource))) {
    throw new Error('invalid_catalog')
  }
  const providers = cached
    ? (providerSource as unknown[]).map((value) => [text(record(value)?.id), value] as const)
    : Object.entries(providerSource as Record<string, unknown>)
  const canonicalModels = cached
    ? (modelSource as unknown[]).map((value) => [text(record(value)?.id), value] as const)
    : Object.entries(modelSource as Record<string, unknown>)
  if (!providers.length || providers.length > MAX_PROVIDERS || canonicalModels.length > MAX_CANONICAL_MODELS) throw new Error('invalid_catalog')
  const result: ModelsDevCatalog = { version: 1, providers: [], models: [] }
  let count = 0
  for (const [id, raw] of providers) {
    const provider = record(raw)
    if (!provider || !id || !text(id)) continue
    const models = cached && Array.isArray(provider.models)
      ? provider.models.map((value) => [text(record(value)?.id), value] as const)
      : Object.entries(record(provider.models) ?? {})
    count += models.length
    if (count > MAX_MODELS) throw new Error('invalid_catalog')
    const parsedModels = models.flatMap(([modelId, value]) => {
      const model = modelId ? parseModel(value, modelId, cached, true) : null
      return model ? [model] : []
    })
    if (parsedModels.length) result.providers.push({ id, name: text(provider.name) ?? id, api: apiUrl(provider.api), models: parsedModels })
  }
  for (const [id, raw] of canonicalModels) {
    const model = id ? parseModel(raw, id, cached, false) : null
    if (model) result.models.push(model)
  }
  if (!result.providers.length) throw new Error('invalid_catalog')
  return result
}

function endpointKey(settings: AiEndpointSettings): string | null {
  try {
    const url = new URL(getAiProviderModelsEndpoint(settings))
    if (url.protocol !== 'https:' || url.username || url.password || url.search) return null
    // A plan path, region, port, or proxy prefix is part of provider identity.
    let path = url.pathname.replace(/\/models$/, '').replace(/\/+$/, '')
    if (!path || path === '/v1') path = ''
    return `${url.origin}${path}`
  } catch { return null }
}

function modelKey(id: string): string {
  return id.trim().toLowerCase()
}

function canonicalKey(id: string): string {
  return modelKey(id).split('/').at(-1)!.replace(/^auto[-_]/, '').replace(/:(?:free|nitro)$/, '').replace(/[._]/g, '-')
}

function exactOrUniqueModel(candidates: ModelsDevModel[], id: string): ModelsDevModel | null {
  const exact = candidates.filter((model) => model.id === id.trim())
  return exact.length === 1 ? exact[0] : !exact.length && candidates.length === 1 ? candidates[0] : null
}

interface CatalogIndex {
  endpoints: Map<string, ModelsDevProvider[]>
  models: Map<string, ModelsDevModel[]>
  providerModels: Map<ModelsDevProvider, Map<string, ModelsDevModel[]>>
}
const indexes = new WeakMap<ModelsDevCatalog, CatalogIndex>()

function indexCatalog(catalog: ModelsDevCatalog): CatalogIndex {
  const existing = indexes.get(catalog)
  if (existing) return existing
  const index: CatalogIndex = { endpoints: new Map(), models: new Map(), providerModels: new Map() }
  for (const provider of catalog.providers) {
    const api = provider.api ?? (Object.hasOwn(OFFICIAL_APIS, provider.id) ? OFFICIAL_APIS[provider.id] : undefined)
    const key = api && endpointKey({ baseUrl: api })
    if (key) index.endpoints.set(key, [...(index.endpoints.get(key) ?? []), provider])
    const models = new Map<string, ModelsDevModel[]>()
    for (const model of provider.models) {
      const id = modelKey(model.id)
      models.set(id, [...(models.get(id) ?? []), model])
    }
    index.providerModels.set(provider, models)
  }
  for (const model of catalog.models) {
    const key = canonicalKey(model.id)
    index.models.set(key, [...(index.models.get(key) ?? []), model])
  }
  indexes.set(catalog, index)
  return index
}

export function findModelsDevModel(catalog: ModelsDevCatalog | null | undefined, settings: AiEndpointSettings): ModelsDevMatch | null {
  if (!catalog || typeof settings.model !== 'string' || !settings.model.trim()) return null
  const index = indexCatalog(catalog)
  const key = endpointKey(settings)
  const matches = (key ? index.endpoints.get(key) ?? [] : []).flatMap((provider) => {
    const candidates = index.providerModels.get(provider)?.get(modelKey(String(settings.model))) ?? []
    const model = exactOrUniqueModel(candidates, String(settings.model))
    return model ? [{ kind: 'provider' as const, model, providerId: provider.id, providerName: provider.name }] : []
  })
  // Shared endpoints (e.g. a subscription and pay-as-you-go) have ambiguous prices.
  if (matches.length === 1) return matches[0]
  const exact = exactOrUniqueModel(
    catalog.models.filter((model) => modelKey(model.id) === modelKey(String(settings.model))),
    settings.model
  )
  if (exact) return { kind: 'model', model: exact }
  const canonical = index.models.get(canonicalKey(settings.model)) ?? []
  return canonical.length === 1 ? { kind: 'model', model: canonical[0] } : null
}
