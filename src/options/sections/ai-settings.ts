import { normalizeText } from '../../shared/text.js'
import {
  AI_NAMING_FETCHED_MODELS_LIMIT,
  AI_NAMING_MAX_BATCH_SIZE
} from '../shared-options/constants.js'
import { createDefaultAiNamingSettings } from '../shared-options/state.js'

export interface AiNamingSettings {
  baseUrl: string
  apiKey: string
  model: string
  customModels: string[]
  fetchedModels: string[]
  apiStyle: 'responses' | 'chat_completions'
  timeoutMs: number
  batchSize: number
  autoSelectHighConfidence: boolean
  allowRemoteParsing: boolean
  autoAnalyzeBookmarks: boolean
  systemPrompt: string
}

interface AiNamingSettingsSource {
  baseUrl?: unknown
  apiKey?: unknown
  model?: unknown
  customModels?: unknown
  fetchedModels?: unknown
  apiStyle?: unknown
  timeoutMs?: unknown
  batchSize?: unknown
  autoSelectHighConfidence?: unknown
  allowRemoteParsing?: unknown
  autoAnalyzeBookmarks?: unknown
  systemPrompt?: unknown
}

export function normalizeAiNamingSettings(rawSettings: unknown): AiNamingSettings {
  const defaults = createDefaultAiNamingSettings() as AiNamingSettings
  const source = rawSettings && typeof rawSettings === 'object'
    ? (rawSettings as AiNamingSettingsSource)
    : {}
  const apiStyle = String(source.apiStyle || defaults.apiStyle).trim()
  const timeoutMs = Number(source.timeoutMs)
  const batchSize = Number(source.batchSize)

  return {
    baseUrl: String(source.baseUrl || defaults.baseUrl).trim() || defaults.baseUrl,
    apiKey: String(source.apiKey || defaults.apiKey).trim(),
    model: String(source.model || defaults.model).trim() || defaults.model,
    customModels: normalizeAiNamingCustomModels(source.customModels),
    fetchedModels: normalizeAiNamingFetchedModels(source.fetchedModels),
    apiStyle: apiStyle === 'chat_completions' ? 'chat_completions' : 'responses',
    timeoutMs: Number.isFinite(timeoutMs)
      ? Math.max(5000, Math.min(timeoutMs, 120000))
      : defaults.timeoutMs,
    batchSize: Number.isFinite(batchSize)
      ? Math.max(1, Math.min(Math.round(batchSize), AI_NAMING_MAX_BATCH_SIZE))
      : defaults.batchSize,
    autoSelectHighConfidence:
      typeof source.autoSelectHighConfidence === 'boolean'
        ? source.autoSelectHighConfidence
        : defaults.autoSelectHighConfidence,
    allowRemoteParsing:
      typeof source.allowRemoteParsing === 'boolean'
        ? source.allowRemoteParsing
        : defaults.allowRemoteParsing,
    autoAnalyzeBookmarks:
      typeof source.autoAnalyzeBookmarks === 'boolean'
        ? source.autoAnalyzeBookmarks
        : defaults.autoAnalyzeBookmarks,
    systemPrompt: String(source.systemPrompt || defaults.systemPrompt).trim()
  }
}

export function normalizeAiNamingCustomModels(rawModels: unknown): string[] {
  return normalizeModelIdList(rawModels, 40)
}

export function normalizeAiNamingFetchedModels(rawModels: unknown): string[] {
  return normalizeModelIdList(rawModels, AI_NAMING_FETCHED_MODELS_LIMIT)
}

export function normalizeModelIdList(rawModels: unknown, limit = 40): string[] {
  const values = Array.isArray(rawModels)
    ? rawModels
    : typeof rawModels === 'string'
      ? rawModels.split(/[\n,;]+/g)
      : []
  const seen = new Set<string>()

  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const normalized = normalizeText(value)
      if (!normalized || seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })
    .slice(0, Math.max(1, limit))
}

export function serializeAiNamingSettings(settings: unknown): AiNamingSettings {
  const normalized = normalizeAiNamingSettings(settings)
  return {
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    model: normalized.model,
    customModels: normalized.customModels.slice(),
    fetchedModels: normalized.fetchedModels.slice(),
    apiStyle: normalized.apiStyle,
    timeoutMs: normalized.timeoutMs,
    batchSize: normalized.batchSize,
    autoSelectHighConfidence: normalized.autoSelectHighConfidence,
    allowRemoteParsing: normalized.allowRemoteParsing,
    autoAnalyzeBookmarks: normalized.autoAnalyzeBookmarks,
    systemPrompt: normalized.systemPrompt
  }
}
