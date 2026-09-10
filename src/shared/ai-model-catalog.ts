import { getAiProviderModelsEndpoint, resolveAiApiStyle, type AiEndpointSettings } from './ai-provider-url.js'

/** Unknown/custom IDs stay selectable; only clearly non-text families are excluded. */
export function isTextGenerationModelId(model: unknown): boolean {
  const value = String(model ?? '').trim().toLowerCase()
  return Boolean(value) && !/(?:^|[/_-])(?:embeddings?|rerank(?:er)?|whisper|tts|dall-e|gpt-image|imagen|veo|moderation)(?:[\d/_.:-]|$)/.test(value) &&
    !/^(?:text-embedding|nomic-embed|mxbai-embed|embeddinggemma|dall-e|gpt-image|imagen|veo)/.test(value)
}

export interface AiModelCatalogPage {
  models: Record<string, unknown>[]
  ids: string[]
  nextPageUrl: string | null
}

export function parseAiModelCatalogPage(payload: unknown, settings: AiEndpointSettings, currentUrl?: string): AiModelCatalogPage {
  const source = payload && typeof payload === 'object' ? payload as Record<string, any> : {}
  const entries: unknown[] = Array.isArray(payload) ? payload : Array.isArray(source.data) ? source.data
    : Array.isArray(source.models) ? source.models : []
  const style = resolveAiApiStyle(settings)
  const nativeGemini = style === 'gemini' || style === 'gemini_interactions'
  const models: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const model: Record<string, unknown> = typeof entry === 'string' ? { id: entry }
      : entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
    let id = String(model.id || model.name || model.model || '').trim()
    if (nativeGemini) id = id.replace(/^models\//, '')
    const methods = model.supportedGenerationMethods
    if (nativeGemini && Array.isArray(methods) && !methods.some((method) => /^(?:generateContent|interact|interactions)$/.test(String(method)))) continue
    const modalities = model.output_modalities
    if (Array.isArray(modalities) && !modalities.includes('text')) continue
    if (!isTextGenerationModelId(id) || seen.has(id)) continue
    seen.add(id)
    models.push({ ...model, id })
  }
  let nextPageUrl: string | null = null
  const token = nativeGemini ? source.nextPageToken : style === 'anthropic_messages' && source.has_more ? source.last_id : ''
  if (typeof token === 'string' && token && token.length <= 2048) {
    const next = new URL(currentUrl || getAiProviderModelsEndpoint(settings))
    const parameter = nativeGemini ? 'pageToken' : 'after_id'
    if (next.searchParams.get(parameter) !== token) {
      next.searchParams.set(parameter, token)
      nextPageUrl = next.toString()
    }
  }
  return { models, ids: models.map((model) => String(model.id)), nextPageUrl }
}
