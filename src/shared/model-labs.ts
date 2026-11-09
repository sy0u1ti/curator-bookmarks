import type { AiEndpointSettings } from './ai-provider-url.js'
import { findModelsDevLab, type ModelsDevCatalog, type ModelsDevLab } from './models-dev.js'

const KNOWN_LAB_PREFIXES: ReadonlyArray<readonly [RegExp, ModelsDevLab]> = [
  [/^claude/, { id: 'anthropic', name: 'Anthropic' }],
  [/^(?:gemini|gemma)/, { id: 'google', name: 'Google' }],
  [/^(?:gpt|chatgpt|codex|o\d)(?![a-z])/, { id: 'openai', name: 'OpenAI' }],
  [/^deepseek/, { id: 'deepseek', name: 'DeepSeek' }],
  [/^(?:qwen|qwq)/, { id: 'alibaba', name: 'Alibaba' }],
  [/^(?:mistral|ministral|magistral|codestral|devstral|pixtral)/, { id: 'mistral', name: 'Mistral' }],
  [/^llama/, { id: 'meta', name: 'Meta' }],
  [/^grok/, { id: 'xai', name: 'xAI' }],
  [/^sonar/, { id: 'perplexity', name: 'Perplexity' }],
  [/^(?:kimi|moonshot)/, { id: 'moonshotai', name: 'Moonshot AI' }],
  [/^minimax/, { id: 'minimax', name: 'MiniMax' }],
  [/^glm/, { id: 'zhipuai', name: 'Zhipu AI' }]
]

/** models.dev decides; the model family prefix is only an offline fallback. Routing prefixes such as "auto/" are not labs. */
export function resolveModelLab(catalog: ModelsDevCatalog | null | undefined, settings: AiEndpointSettings): ModelsDevLab | null {
  const fromCatalog = findModelsDevLab(catalog, settings)
  if (fromCatalog) return fromCatalog
  const family = String(settings.model ?? '').trim().toLowerCase().split('/').at(-1) ?? ''
  return KNOWN_LAB_PREFIXES.find(([pattern]) => pattern.test(family))?.[1] ?? null
}
