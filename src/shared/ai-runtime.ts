import {
  extractAiErrorMessage,
  extractAnthropicMessagesJsonText,
  extractChatCompletionsJsonText,
  extractResponsesJsonText,
  extractGeminiJsonText,
  extractGeminiInteractionsJsonText,
  AiResponseRefusalError,
  getAiEndpoint,
  getAiTruncationIssue,
  sanitizeAiErrorText
} from './ai-response.js'
import {
  getAiProviderAuthHeaders,
  getAiProviderBaseUrlIssue,
  isAiProviderConfigured,
  resolveAiApiStyle,
  type AiApiStyle,
  type ResolvedAiApiStyle
} from './ai-provider-url.js'
import {
  getModelReasoningCapability,
  getModelReasoningProfile,
  getReasoningTransport,
  resolveReasoningEffortForModel,
  type ReasoningEffortId
} from './ai-reasoning.js'
import { normalizeAiOutput } from './ai-output-normalization.js'
import { AiEventStreamError, parseAiEventStream } from './ai-event-stream.js'
import { isTextGenerationModelId } from './ai-model-catalog.js'

export type AiErrorKind =
  | 'configuration'
  | 'permission'
  | 'network'
  | 'provider'
  | 'parse'
  | 'schema'
  | 'abort'
  | 'content_extraction'

export interface AiProviderSettings {
  baseUrl: string
  apiKey: string
  model: string
  apiStyle: AiApiStyle
  timeoutMs?: number
  /** 从渠道模型列表缓存的逐模型推理能力。 */
  reasoningCapabilities?: unknown
  /**
   * 推理强度：已知模型的 'default' 会物化为界面显示的模型默认档；未知模型或
   * 空值不发送参数。其余取值会按 Base URL + apiStyle + model 映射为厂商真实字段，
   * 包括 reasoning_effort、reasoning.effort、output_config.effort、thinking、
   * enable_thinking 与 thinking_budget；端点拒绝时显式失败，绝不静默退回默认强度。
   */
  reasoningEffort?: ReasoningEffortId
}

type AiReasoningRequestSettings = Pick<
  AiProviderSettings,
  'baseUrl' | 'model' | 'apiStyle' | 'reasoningEffort' | 'reasoningCapabilities'
>

export interface AiRuntimeMetadata {
  endpoint: string
  apiStyle: AiProviderSettings['apiStyle']
  schemaName?: string
  structuredOutputMode: AiStructuredOutputMode
  status?: number
  attempts: number
  repaired: boolean
  normalizationWarnings?: string[]
  compatibilityWarnings?: string[]
}

export interface AiRuntimeResult<T> {
  data: T
  rawText: string
  payload: unknown
  metadata: AiRuntimeMetadata
}

export interface AiStructuredRequest<T> {
  settings: AiProviderSettings
  schema: JsonSchema
  schemaName: string
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal | null
  timeoutMs?: number
  /**
   * 整次结构化请求的相对时间预算。兼容降级、修复请求、瞬时错误重试与退避
   * 都共享这一个预算；省略时沿用 timeoutMs/settings.timeoutMs 作为总预算。
   */
  totalBudgetMs?: number
  /** 整次结构化请求的绝对截止时间（Unix 毫秒），可用于跨调用链传递剩余预算。 */
  deadlineAtMs?: number
  fetchImpl?: typeof fetch
  retry?: boolean
  validate?: (data: T) => void
}

export const AI_PROVIDER_RESPONSE_MAX_BYTES = 2 * 1024 * 1024

export interface AiPromptEnvelope {
  settings: Pick<
    AiProviderSettings,
    'baseUrl' | 'model' | 'apiStyle' | 'reasoningEffort' | 'reasoningCapabilities'
  >
  schema: JsonSchema
  strictSchema: JsonSchema
  schemaName: string
  systemPrompt: string
  userPrompt: string
}

export type AiStructuredOutputMode = 'json_schema' | 'json_object' | 'prompt'

export type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'

export interface JsonSchema {
  type?: JsonSchemaType | readonly JsonSchemaType[]
  additionalProperties?: boolean | JsonSchema
  required?: readonly string[]
  properties?: Readonly<Record<string, JsonSchema>>
  items?: JsonSchema
  enum?: readonly unknown[]
  maxItems?: number
  minItems?: number
  maxLength?: number
  minLength?: number
  minimum?: number
  maximum?: number
}

export interface AiFolderCandidate {
  folderId: string
  folderPath: string
  title: string
  depth: number
}

export interface AiFolderDecision {
  kind: 'existing' | 'new' | 'manual_review'
  folderId: string
  folderPath: string
  reason: string
  confidence: number
}

export class AiRuntimeError extends Error {
  kind: AiErrorKind
  retryable: boolean
  status?: number
  details?: unknown

  constructor(
    kind: AiErrorKind,
    message: string,
    options: { retryable?: boolean; status?: number; details?: unknown; cause?: unknown } = {}
  ) {
    super(message)
    this.name = 'AiRuntimeError'
    this.kind = kind
    this.retryable = Boolean(options.retryable)
    this.status = options.status
    this.details = options.details
    if (options.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

function ensureAiProviderConfigured(settings: AiProviderSettings): void {
  const baseUrlIssue = getAiProviderBaseUrlIssue(settings.baseUrl)
  if (baseUrlIssue) throw new AiRuntimeError('configuration', baseUrlIssue)
  if (!isAiProviderConfigured(settings)) throw new AiRuntimeError('configuration', '请先到通用设置配置“自定义AI渠道”。')
  if (!isTextGenerationModelId(settings.model)) throw new AiRuntimeError('configuration', '此功能需要可生成文本或 JSON 的模型，请改选对话模型。')
}

/** 归一推理强度：'default'/空/未知值 → null（不发送任何推理参数）。 */
export function normalizeReasoningEffortValue(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'default') {
    return null
  }
  return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(normalized)
    ? normalized
    : null
}

function resolveRequestReasoningEffort(settings: AiReasoningRequestSettings): string | null {
  const storedValue = String(settings.reasoningEffort ?? '').trim().toLowerCase()
  const context = { baseUrl: settings.baseUrl, apiStyle: settings.apiStyle }
  // 设置页会把已知模型的 default 定位到模型的具体默认档位。请求侧必须使用同一
  // 解析结果，否则界面显示“中/高”时，线上请求却会因为省略参数而记录为 auto。
  if (storedValue === 'default') {
    const capability = getModelReasoningCapability(settings.reasoningCapabilities, settings.model)
    return normalizeReasoningEffortValue(
      resolveReasoningEffortForModel(settings.model, storedValue, capability, context)
    )
  }
  const requested = normalizeReasoningEffortValue(settings.reasoningEffort)
  if (!requested) {
    return requested
  }
  const capability = getModelReasoningCapability(settings.reasoningCapabilities, settings.model)
  const profile = getModelReasoningProfile(settings.model, capability, context)
  if (profile.levels.some((level) => level === requested)) {
    return requested
  }
  return normalizeReasoningEffortValue(
    resolveReasoningEffortForModel(settings.model, requested, capability, context)
  )
}

function requiresExplicitAnthropicAdaptiveThinking(model: unknown): boolean {
  const normalized = String(model ?? '').trim().toLowerCase()
  return /claude-(?:opus-4[-.]?(?:6|7|8)|sonnet-4[-.]?6)(?:[-._/]|$)/.test(normalized)
}

function mergeRequestObjectField(
  body: Record<string, unknown>,
  field: string,
  value: Record<string, unknown>
): void {
  const current = body[field]
  const currentObject = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {}
  body[field] = { ...currentObject, ...value }
}

function resolveReasoningRequest(settings: AiReasoningRequestSettings) {
  const effort = resolveRequestReasoningEffort(settings)
  const capability = getModelReasoningCapability(
    settings.reasoningCapabilities,
    settings.model
  )
  const transport = getReasoningTransport(settings.model, {
    baseUrl: settings.baseUrl,
    apiStyle: settings.apiStyle
  }, capability)
  return {
    effort: transport.kind === 'fixed' || transport.kind === 'unsupported' ? null : effort,
    transport
  }
}

/**
 * 将最终解析出的推理强度写入供应商真正接收的请求字段。
 * 所有调用路径（正式 AI 功能和连接测试）必须复用这里，避免协议分支漂移。
 */
function applyAiReasoningEffort(
  body: Record<string, unknown>,
  settings: AiReasoningRequestSettings
): Record<string, unknown> {
  settings = { ...settings, apiStyle: resolveAiApiStyle(settings) }
  const { effort: reasoningEffort, transport } = resolveReasoningRequest(settings)
  if (!reasoningEffort) {
    return body
  }

  if (settings.apiStyle === 'gemini' || settings.apiStyle === 'gemini_interactions') {
    if (settings.apiStyle === 'gemini_interactions') {
      mergeRequestObjectField(body, 'generation_config', { thinking_level: reasoningEffort })
    } else {
      const model = String(settings.model).toLowerCase()
      const thinkingConfig = /gemini-2[._-]5/.test(model)
        ? { thinkingBudget: reasoningEffort === 'none' ? 0 : ({ low: 1024, medium: 8192, high: /pro/.test(model) ? 32768 : 24576 } as Record<string, number>)[reasoningEffort] }
        : { thinkingLevel: reasoningEffort.toUpperCase() }
      mergeRequestObjectField(body, 'generationConfig', { thinkingConfig })
    }
    return body
  }

  if (settings.apiStyle === 'anthropic_messages' || transport.kind === 'anthropic_effort') {
    mergeRequestObjectField(body, 'output_config', { effort: reasoningEffort })
    if (requiresExplicitAnthropicAdaptiveThinking(settings.model)) {
      mergeRequestObjectField(body, 'thinking', { type: 'adaptive' })
    }
    return body
  }

  if (transport.kind === 'thinking_toggle') {
    const enabled = reasoningEffort !== 'none'
    mergeRequestObjectField(body, 'thinking', {
      type: enabled ? 'enabled' : 'disabled'
    })
    const thinkingBudget = enabled
      ? transport.budgetByEffort?.[reasoningEffort as ReasoningEffortId]
      : undefined
    if (thinkingBudget !== undefined) {
      body.thinking_budget = thinkingBudget
    }
    return body
  }

  if (transport.kind === 'minimax_adaptive') {
    mergeRequestObjectField(body, 'thinking', {
      type: reasoningEffort === 'none' ? 'disabled' : 'adaptive'
    })
    return body
  }

  if (transport.kind === 'enable_thinking') {
    const enabled = reasoningEffort !== 'none'
    body.enable_thinking = enabled
    const thinkingBudget = enabled
      ? transport.budgetByEffort?.[reasoningEffort as ReasoningEffortId]
      : undefined
    if (thinkingBudget !== undefined) {
      body.thinking_budget = thinkingBudget
    }
    return body
  }

  if (transport.kind === 'fixed_with_budget') {
    const thinkingBudget = transport.budgetByEffort?.[reasoningEffort as ReasoningEffortId]
    if (thinkingBudget !== undefined) {
      body.thinking_budget = thinkingBudget
    }
    return body
  }

  if (transport.kind === 'effort_with_enable_thinking') {
    const enabled = reasoningEffort !== 'none'
    body.enable_thinking = enabled
    if (!enabled) {
      return body
    }
    if (transport.effortField === 'nested') {
      mergeRequestObjectField(body, 'reasoning', { effort: reasoningEffort })
    } else {
      body.reasoning_effort = reasoningEffort
    }
    return body
  }

  if (transport.kind === 'effort_inside_thinking') {
    if (reasoningEffort === 'none') {
      mergeRequestObjectField(body, 'thinking', { type: 'disabled' })
    } else {
      mergeRequestObjectField(body, 'thinking', {
        type: 'enabled',
        reasoning_effort: reasoningEffort
      })
    }
    return body
  }

  if (transport.kind === 'effort_with_thinking') {
    const enabled = reasoningEffort !== 'none'
    mergeRequestObjectField(body, 'thinking', { type: enabled ? 'enabled' : 'disabled' })
    if (!enabled) {
      return body
    }
    if (transport.effortField === 'nested') {
      mergeRequestObjectField(body, 'reasoning', { effort: reasoningEffort })
    } else {
      body.reasoning_effort = reasoningEffort
    }
    return body
  }

  if (transport.kind === 'flat_effort') {
    body.reasoning_effort = reasoningEffort
    return body
  }

  mergeRequestObjectField(body, 'reasoning', { effort: reasoningEffort })
  return body
}

const AI_CONNECTIVITY_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['status'],
  properties: { status: { type: 'string', enum: ['ok'] } }
}
const AI_CONNECTIVITY_SYSTEM_PROMPT = '这是连接测试。只返回 {"status":"ok"}。'
const AI_CONNECTIVITY_USER_PROMPT = '返回测试结果。'

/** Connection tests exercise the same structured contract, protocol and retry path as real features. */
export function buildAiProviderConnectivityRequestBody(settings: AiReasoningRequestSettings): Record<string, unknown> {
  return buildAiPromptRequestBody({
    settings, schema: AI_CONNECTIVITY_SCHEMA, strictSchema: compileStrictJsonSchema(AI_CONNECTIVITY_SCHEMA),
    schemaName: 'ai_connectivity', systemPrompt: AI_CONNECTIVITY_SYSTEM_PROMPT, userPrompt: AI_CONNECTIVITY_USER_PROMPT
  })
}

export function requestAiProviderConnectivityTest(
  settings: AiProviderSettings,
  options: Pick<AiStructuredRequest<{ status: 'ok' }>, 'signal' | 'fetchImpl' | 'timeoutMs'> = {}
): Promise<AiRuntimeResult<{ status: 'ok' }>> {
  return requestStructuredAiOutput({
    ...options, settings, schema: AI_CONNECTIVITY_SCHEMA, schemaName: 'ai_connectivity',
    systemPrompt: AI_CONNECTIVITY_SYSTEM_PROMPT, userPrompt: AI_CONNECTIVITY_USER_PROMPT
  })
}

/**
 * 把业务 JSON Schema 编译为 OpenAI strict Structured Outputs 可接受的形式。
 * strict 模式要求每个 object 的 required 覆盖全部 properties；原本的可选字段
 * 通过联合 null 保留可选语义，响应解析后再移除这些 null 占位。
 */
export function compileStrictJsonSchema(schema: JsonSchema): JsonSchema {
  return compileStrictSchemaNode(schema)
}

function compileStrictSchemaNode(schema: JsonSchema): JsonSchema {
  const compiled: JsonSchema = {
    ...schema,
    type: cloneSchemaType(schema.type),
    required: schema.required ? [...schema.required] : undefined,
    enum: schema.enum ? [...schema.enum] : undefined
  }

  if (schema.items) {
    compiled.items = compileStrictSchemaNode(schema.items)
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    compiled.additionalProperties = compileStrictSchemaNode(schema.additionalProperties)
  }

  const properties = schema.properties
  if (properties) {
    const originalRequired = new Set(schema.required || [])
    const compiledProperties: Record<string, JsonSchema> = {}
    for (const [key, propertySchema] of Object.entries(properties)) {
      const compiledProperty = compileStrictSchemaNode(propertySchema)
      compiledProperties[key] = originalRequired.has(key)
        ? compiledProperty
        : makeSchemaNullable(compiledProperty)
    }
    const propertyNames = Object.keys(compiledProperties)
    compiled.properties = compiledProperties
    compiled.required = propertyNames
    compiled.additionalProperties = false
  } else if (schemaIncludesType(schema.type, 'object')) {
    compiled.required = []
    compiled.additionalProperties = false
  }

  return removeUndefinedSchemaFields(compiled)
}

function makeSchemaNullable(schema: JsonSchema): JsonSchema {
  const existingTypes = normalizeSchemaTypes(schema.type)
  // 未声明 type 的 schema 本来就允许 null，无需把它错误收窄成仅 null。
  if (!existingTypes.length) {
    return schema
  }
  const nullableTypes: JsonSchemaType[] = existingTypes.includes('null')
    ? existingTypes
    : [...existingTypes, 'null' as const]
  const nullableEnum = schema.enum && !schema.enum.some((item) => item === null)
    ? [...schema.enum, null]
    : schema.enum
  return removeUndefinedSchemaFields({
    ...schema,
    type: nullableTypes.length === 1 ? nullableTypes[0] : nullableTypes,
    enum: nullableEnum
  })
}

function cloneSchemaType(type: JsonSchema['type']): JsonSchema['type'] {
  return type && typeof type !== 'string' ? [...type] : type
}

function normalizeSchemaTypes(type: JsonSchema['type']): JsonSchemaType[] {
  if (!type) {
    return []
  }
  if (typeof type === 'string') {
    return [type]
  }
  return [...type]
}

function schemaIncludesType(type: JsonSchema['type'], expected: JsonSchemaType): boolean {
  return normalizeSchemaTypes(type).includes(expected)
}

function removeUndefinedSchemaFields(schema: JsonSchema): JsonSchema {
  return Object.fromEntries(
    Object.entries(schema).filter(([, value]) => value !== undefined)
  ) as JsonSchema
}

function buildAiPromptRequestBody({
  settings,
  schema,
  strictSchema,
  schemaName,
  systemPrompt,
  userPrompt
}: AiPromptEnvelope, options: {
  structuredOutputMode?: AiStructuredOutputMode
  mergeSystemPrompt?: boolean
} = {}): Record<string, unknown> {
  settings = { ...settings, apiStyle: resolveAiApiStyle(settings) }
  const mode = options.structuredOutputMode || 'json_schema'
  // Always include the business contract, including when a gateway ignores format parameters.
  const instructions = systemPrompt + '\n\n请严格返回符合以下 JSON Schema 的 json，不要添加说明或 markdown：\n' + JSON.stringify(schema)
  userPrompt += '\n\n请只返回符合 schema 的 json。'
  const messages = options.mergeSystemPrompt
    ? [{ role: 'user', content: instructions + '\n\n' + userPrompt }]
    : [{ role: 'system', content: instructions }, { role: 'user', content: userPrompt }]
  let body: Record<string, unknown>
  if (settings.apiStyle === 'anthropic_messages') {
    body = {
      model: settings.model,
      max_tokens: 8192,
      ...(options.mergeSystemPrompt ? {} : { system: instructions }),
      messages: [{ role: 'user', content: options.mergeSystemPrompt ? instructions + '\n\n' + userPrompt : userPrompt }]
    }
    if (mode === 'json_schema') body.output_config = { format: { type: 'json_schema', schema: strictSchema } }
  } else if (settings.apiStyle === 'gemini') {
    const generationConfig: Record<string, unknown> = {}
    if (mode !== 'prompt') generationConfig.responseMimeType = 'application/json'
    if (mode === 'json_schema') generationConfig.responseJsonSchema = schema
    body = {
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig
    }
    if (options.mergeSystemPrompt) {
      delete body.systemInstruction
      body.contents = [{ role: 'user', parts: [{ text: instructions + '\n\n' + userPrompt }] }]
    }
  } else if (settings.apiStyle === 'gemini_interactions') {
    body = {
      model: settings.model.replace(/^models\//, ''),
      system_instruction: instructions,
      input: userPrompt,
      store: false
    }
    if (mode !== 'prompt') body.response_format = {
      type: 'text', mime_type: 'application/json', ...(mode === 'json_schema' ? { schema } : {})
    }
    if (options.mergeSystemPrompt) {
      delete body.system_instruction
      body.input = instructions + '\n\n' + userPrompt
    }
  } else if (settings.apiStyle === 'chat_completions') {
    body = { model: settings.model, messages }
    if (mode === 'json_schema') {
      body.response_format = { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema: strictSchema } }
    } else if (mode === 'json_object') {
      body.response_format = { type: 'json_object' }
    }
  } else {
    body = { model: settings.model, input: messages }
    if (new URL(String(settings.baseUrl)).hostname === 'api.openai.com') body.store = false
    if (mode === 'json_schema') {
      body.text = { format: { type: 'json_schema', name: schemaName, strict: true, schema: strictSchema } }
    } else if (mode === 'json_object') {
      body.text = { format: { type: 'json_object' } }
    }
  }
  return applyAiReasoningEffort(body, settings)
}

interface AiCompatibilityState {
  apiStyle: ResolvedAiApiStyle
  mode: AiStructuredOutputMode
  omitDefaultReasoning: boolean
  mergeSystemPrompt: boolean
  warnings: string[]
  expiresAt: number
}
const AI_COMPATIBILITY_CACHE_LIMIT = 128
const AI_COMPATIBILITY_CACHE_TTL_MS = 10 * 60 * 1000
const aiCompatibilityCache = new Map<string, AiCompatibilityState>()

/** In-memory only: no credentials or provider output are persisted. */
export function clearAiProviderCompatibilityCache(): void {
  aiCompatibilityCache.clear()
}

function getCompatibilityCacheKey(settings: AiProviderSettings, schema: JsonSchema, schemaName: string): string {
  let hash = 2166136261
  for (const char of JSON.stringify([schema, settings.apiKey, settings.reasoningCapabilities])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return JSON.stringify([settings.baseUrl, settings.apiStyle, settings.model, settings.reasoningEffort, schemaName, hash >>> 0])
}

function rememberAiCompatibility(key: string, state: AiCompatibilityState): void {
  aiCompatibilityCache.delete(key)
  while (aiCompatibilityCache.size >= AI_COMPATIBILITY_CACHE_LIMIT) {
    aiCompatibilityCache.delete(aiCompatibilityCache.keys().next().value!)
  }
  aiCompatibilityCache.set(key, { ...state, warnings: state.warnings.slice(), expiresAt: Date.now() + AI_COMPATIBILITY_CACHE_TTL_MS })
}

export async function requestStructuredAiOutput<T>({
  settings,
  schema,
  schemaName,
  systemPrompt,
  userPrompt,
  signal = null,
  timeoutMs,
  totalBudgetMs,
  deadlineAtMs,
  fetchImpl = fetch,
  retry = true,
  validate
}: AiStructuredRequest<T>): Promise<AiRuntimeResult<T>> {
  ensureAiProviderConfigured(settings)
  const startedAtMs = Date.now()
  const requestTimeoutMs = normalizeAiRequestTimeoutMs(timeoutMs || settings.timeoutMs)
  const deadline = resolveAiRequestDeadlineAtMs({ startedAtMs, requestTimeoutMs, totalBudgetMs, deadlineAtMs })
  const budgetMs = Math.max(1, deadline - startedAtMs)
  const cacheKey = getCompatibilityCacheKey(settings, schema, schemaName)
  const cached = aiCompatibilityCache.get(cacheKey)
  const compatibility: AiCompatibilityState = cached && cached.expiresAt > startedAtMs
    ? { ...cached, warnings: cached.warnings.slice() }
    : { apiStyle: resolveAiApiStyle(settings), mode: 'json_schema', omitDefaultReasoning: false, mergeSystemPrompt: false, warnings: [], expiresAt: 0 }
  const strictSchema = compileStrictJsonSchema(schema)
  const maxAttempts = retry ? 8 : 1
  let repairAttemptsLeft = retry ? 1 : 0
  let transientRetriesLeft = retry ? 2 : 0
  let protocolRetriesLeft = settings.apiStyle === 'auto' && retry ? 1 : 0
  let effectiveUserPrompt = userPrompt
  let repaired = false

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfAiRequestUnavailable(signal, deadline, budgetMs)
    const effectiveSettings: AiProviderSettings = {
      ...settings,
      apiStyle: compatibility.apiStyle,
      ...(compatibility.omitDefaultReasoning ? { reasoningEffort: undefined } : {})
    }
    const endpoint = getAiEndpoint(effectiveSettings)
    let rawText = ''
    try {
      const requestBody = buildAiPromptRequestBody({
        settings: effectiveSettings, schema, strictSchema, schemaName, systemPrompt, userPrompt: effectiveUserPrompt
      }, { structuredOutputMode: compatibility.mode, mergeSystemPrompt: compatibility.mergeSystemPrompt })
      const payload = await requestAiProviderPayload({
        endpoint, settings: effectiveSettings, requestBody, signal, timeoutMs: requestTimeoutMs,
        deadlineAtMs: deadline, totalBudgetMs: budgetMs, fetchImpl
      })
      // Even valid-looking partial JSON must never authorize a bookmark mutation.
      const truncationIssue = getAiTruncationIssue(payload, compatibility.apiStyle)
      if (truncationIssue) throw new AiRuntimeError('provider', truncationIssue)
      try {
        switch (compatibility.apiStyle) {
          case 'anthropic_messages': rawText = extractAnthropicMessagesJsonText(payload); break
          case 'gemini': rawText = extractGeminiJsonText(payload); break
          case 'gemini_interactions': rawText = extractGeminiInteractionsJsonText(payload); break
          case 'responses': rawText = extractResponsesJsonText(payload); break
          default: rawText = extractChatCompletionsJsonText(payload)
        }
      } catch (error) {
        throw new AiRuntimeError(error instanceof AiResponseRefusalError ? 'provider' : 'parse',
          error instanceof Error ? error.message : 'AI 返回中没有可解析的最终文本。', { cause: error })
      }
      const parsed = parseAiJson(rawText, schemaName)
      let normalized: ReturnType<typeof normalizeAiOutput>
      try { normalized = normalizeAiOutput(parsed, schema) } catch (error) {
        throw new AiRuntimeError('schema', error instanceof Error ? error.message : 'AI 输出结构无法规范。')
      }
      validateJsonSchema(normalized.data, schema, schemaName)
      validate?.(normalized.data as T)
      throwIfAiRequestUnavailable(signal, deadline, budgetMs)
      rememberAiCompatibility(cacheKey, compatibility)
      return {
        data: normalized.data as T, rawText, payload,
        metadata: {
          endpoint, apiStyle: compatibility.apiStyle, schemaName, structuredOutputMode: compatibility.mode,
          attempts: attempt, repaired, normalizationWarnings: normalized.warnings,
          compatibilityWarnings: compatibility.warnings
        }
      }
    } catch (error) {
      const failure = normalizeAiRuntimeError(error)
      const effort = resolveReasoningRequest(effectiveSettings).effort
      if (effort && isReasoningEffortCompatibilityError(failure)) {
        const explicitEffort = normalizeReasoningEffortValue(settings.reasoningEffort)
        if (explicitEffort || attempt >= maxAttempts) {
          throw new AiRuntimeError('provider', 'AI 渠道拒绝推理强度“' + effort + '”：' + failure.message, {
            status: failure.status, details: failure.details, cause: failure
          })
        }
        compatibility.omitDefaultReasoning = true
        compatibility.warnings.push('渠道不支持默认推理参数，已使用模型原生默认值。')
        continue
      }
      if (attempt < maxAttempts && compatibility.mode !== 'prompt' && isStructuredFormatCompatibilityError(failure)) {
        compatibility.mode = compatibility.apiStyle === 'anthropic_messages'
          ? 'prompt' : getLessStrictOutputMode(compatibility.mode)
        compatibility.warnings.push(compatibility.mode === 'prompt' ? '渠道不支持输出格式约束，已使用提示词与本地结构校验。' : '渠道不支持严格 Schema，已使用 JSON 模式与本地结构校验。')
        continue
      }
      if (attempt < maxAttempts && !compatibility.mergeSystemPrompt && isSystemRoleCompatibilityError(failure)) {
        compatibility.mergeSystemPrompt = true
        compatibility.warnings.push('模型不支持系统消息，已将相同指令并入请求正文。')
        continue
      }
      if (attempt < maxAttempts && protocolRetriesLeft > 0 &&
        (compatibility.apiStyle === 'responses' || compatibility.apiStyle === 'chat_completions') &&
        isEndpointCompatibilityError(failure)) {
        protocolRetriesLeft -= 1
        compatibility.apiStyle = compatibility.apiStyle === 'responses' ? 'chat_completions' : 'responses'
        compatibility.mode = 'json_schema'
        compatibility.omitDefaultReasoning = false
        compatibility.mergeSystemPrompt = false
        compatibility.warnings.push('自动模式已切换至渠道支持的 ' + compatibility.apiStyle + ' 接口。')
        continue
      }
      if (attempt >= maxAttempts || !shouldRetryAiRuntimeError(failure)) throw failure
      if (shouldUseRepairRetry(failure)) {
        if (repairAttemptsLeft <= 0) throw failure
        repairAttemptsLeft -= 1
        repaired = true
        effectiveUserPrompt = buildRepairUserPrompt(userPrompt, schemaName, rawText, failure)
      } else {
        if (transientRetriesLeft <= 0) throw failure
        transientRetriesLeft -= 1
        await waitForAiRetryDelay(failure, 2 - transientRetriesLeft, signal, deadline, budgetMs)
      }
    }
  }
  throw new AiRuntimeError('provider', 'AI 请求已达到兼容重试上限。请检查模型和接口设置。')
}

export function validateJsonSchema(value: unknown, schema: JsonSchema, schemaName = 'structured_output'): void {
  const issues: string[] = []
  validateSchemaNode(value, schema, '$', issues)
  if (issues.length) {
    throw new AiRuntimeError(
      'schema',
      `AI 返回结果不符合 ${schemaName} 结构：${issues.slice(0, 3).join('；')}`,
      { details: issues }
    )
  }
}

function parseAiJson(rawText: unknown, schemaName = 'structured_output'): unknown {
  try {
    return JSON.parse(String(rawText || ''))
  } catch (error) {
    throw new AiRuntimeError(
      'parse',
      `AI 返回了无法解析的 ${schemaName} JSON 结果。`,
      { cause: error }
    )
  }
}

function getLessStrictOutputMode(mode: AiStructuredOutputMode): AiStructuredOutputMode {
  if (mode === 'json_schema') {
    return 'json_object'
  }
  return 'prompt'
}

export function buildAiFolderCandidates(
  folders: Array<{ id?: unknown; title?: unknown; path?: unknown; depth?: unknown }>,
  options: { currentFolderPath?: unknown; limit?: number } = {}
): AiFolderCandidate[] {
  const limit = Math.max(1, Math.round(Number(options.limit) || 260))
  const currentFolderPath = normalizeFolderPath(options.currentFolderPath)
  const candidates = folders.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((folder): AiFolderCandidate => ({
      folderId: String(folder.id || '').trim(),
      folderPath: normalizeFolderPath(folder.path || folder.title),
      title: String(folder.title || '').trim(),
      depth: Math.max(0, Math.round(Number(folder.depth) || 0))
    }))(combineValue); return ((folder) => folder.folderId && (folder.folderPath || folder.title))(combinedResult) ? [combinedResult] : [] })
    .sort((left, right) => {
      const leftCurrent = currentFolderPath && currentFolderPath.startsWith(normalizeFolderPath(left.folderPath)) ? -1 : 0
      const rightCurrent = currentFolderPath && currentFolderPath.startsWith(normalizeFolderPath(right.folderPath)) ? -1 : 0
      return (
        leftCurrent - rightCurrent ||
        right.depth - left.depth ||
        left.folderPath.localeCompare(right.folderPath, 'zh-Hans-CN')
      )
    })

  return dedupeFolderCandidates(candidates).slice(0, limit)
}

export function toAiFolderCandidatePayload(candidate: AiFolderCandidate): Record<string, unknown> {
  return {
    folder_id: candidate.folderId,
    folder_path: candidate.folderPath,
    title: candidate.title,
    depth: candidate.depth
  }
}

export function validateKnownFolderId(folderId: unknown, candidates: AiFolderCandidate[]): AiFolderCandidate {
  const normalizedFolderId = String(folderId || '').trim()
  const candidate = candidates.find((item) => item.folderId === normalizedFolderId)
  if (!candidate) {
    throw new AiRuntimeError('schema', `AI 返回了未知 folder_id：${normalizedFolderId || '(empty)'}`)
  }
  return candidate
}

export function normalizeAiFolderDecision(
  value: unknown,
  candidates: AiFolderCandidate[],
  legacySuggestedFolder: unknown = ''
): AiFolderDecision {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawKind = String(source.kind || '').trim()
  const confidence = normalizeAiRuntimeConfidence(source.confidence)
  const reason = cleanAiRuntimeText(source.reason, 180)

  if (rawKind === 'existing') {
    const candidate = validateKnownFolderId(source.folder_id, candidates)
    return {
      kind: 'existing',
      folderId: candidate.folderId,
      folderPath: candidate.folderPath,
      reason,
      confidence
    }
  }

  if (rawKind === 'new') {
    const folderPath = normalizeFolderPath(source.folder_path || legacySuggestedFolder)
    return {
      kind: 'new',
      folderId: '',
      folderPath,
      reason,
      confidence
    }
  }

  const legacyPath = normalizeFolderPath(legacySuggestedFolder)
  if (legacyPath) {
    const legacyCandidate = candidates.find((candidate) => normalizeFolderPath(candidate.folderPath) === legacyPath)
    if (legacyCandidate) {
      return {
        kind: 'existing',
        folderId: legacyCandidate.folderId,
        folderPath: legacyCandidate.folderPath,
        reason,
        confidence
      }
    }
  }

  return {
    kind: 'manual_review',
    folderId: '',
    folderPath: legacyPath,
    reason,
    confidence
  }
}

function normalizeAiRuntimeConfidence(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, 1)) : 0
}

export function cleanAiRuntimeText(value: unknown, limit = 180): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(1, limit - 1)).trim()}…`
}

async function requestAiProviderPayload({
  endpoint,
  settings,
  requestBody,
  signal,
  timeoutMs,
  deadlineAtMs,
  totalBudgetMs,
  fetchImpl
}: {
  endpoint: string
  settings: AiProviderSettings
  requestBody: unknown
  signal?: AbortSignal | null
  timeoutMs?: number
  deadlineAtMs: number
  totalBudgetMs: number
  fetchImpl: typeof fetch
}): Promise<unknown> {
  const controller = new AbortController()
  const externalSignal = signal
  throwIfAiRequestUnavailable(externalSignal, deadlineAtMs, totalBudgetMs)
  const configuredTimeoutMs = normalizeAiRequestTimeoutMs(timeoutMs || settings.timeoutMs)
  const remainingBudgetMs = getAiRequestRemainingMs(deadlineAtMs)
  const effectiveTimeoutMs = Math.max(1, Math.min(configuredTimeoutMs, remainingBudgetMs))
  const deadlineLimitsAttempt = remainingBudgetMs <= configuredTimeoutMs
  let timedOut = false
  const abortCurrentFetch = () => {
    controller.abort()
  }

  if (externalSignal?.aborted) {
    controller.abort()
  } else {
    externalSignal?.addEventListener('abort', abortCurrentFetch, { once: true })
  }

  // 超时计时覆盖「发起请求 → 响应体读取完成」全程：
  // 非流式 LLM 响应的主要耗时在生成期（body 阶段），只保护到 headers 会让超时形同虚设。
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, effectiveTimeoutMs)

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        ...getAiProviderAuthHeaders(settings.baseUrl, settings.apiKey, settings.apiStyle)
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    const { payload, rawBody, bytesRead } = await readAiProviderResponseBody(
      response,
      controller.signal
    )
    const errorEnvelope = payload && typeof payload === 'object' ? payload as Record<string, any> : null
    const providerError = errorEnvelope?.error
    if (!response.ok || providerError || errorEnvelope?.type === 'error' || errorEnvelope?.status === 'failed') {
      const embeddedStatus = Number(providerError?.code ?? providerError?.status)
      const errorCode = String(providerError?.code ?? providerError?.type ?? providerError?.status ?? '')
      const inferredStatus = /authentication|invalid_api_key|unauthorized/i.test(errorCode) ? 401
        : /permission|forbidden/i.test(errorCode) ? 403
        : /rate_limit|resource_exhausted/i.test(errorCode) ? 429
        : /overloaded|internal_error|server_error/i.test(errorCode) ? 503 : 400
      const status = !response.ok ? response.status : embeddedStatus >= 400 && embeddedStatus <= 599 ? embeddedStatus : inferredStatus
      const message = extractAiErrorMessage(payload, status, rawBody)
      const providerMessage = settings.apiKey?.length >= 4 ? message.replaceAll(settings.apiKey, '[REDACTED]') : message
      throw new AiRuntimeError(
        'provider',
        providerMessage,
        {
          status,
          retryable: isRetryableProviderStatus(status) && !/insufficient_quota|billing|invalid_api_key|authentication_error/i.test(String(providerError?.code ?? providerError?.type)),
          details: {
            retryAfterMs: parseRetryAfterMs(response.headers?.get?.('retry-after')),
            responseBytes: bytesRead,
            parameter: sanitizeAiErrorText(providerError?.param ?? providerError?.parameter, 160),
            code: sanitizeAiErrorText(providerError?.code ?? providerError?.type, 120)
          }
        }
      )
    }
    if (payload === null && rawBody.trim()) {
      throw new AiRuntimeError(
        'parse',
        `AI 返回了无效的 JSON 响应：${sanitizeAiErrorText(rawBody, 220)}`,
        {
          retryable: true,
          details: { responseBytes: bytesRead }
        }
      )
    }
    return payload
  } catch (error) {
    controller.abort()
    if (timedOut) {
      throw new AiRuntimeError(
        'abort',
        deadlineLimitsAttempt
          ? buildAiDeadlineMessage(totalBudgetMs)
          : buildAiTimeoutMessage(effectiveTimeoutMs),
        {
          cause: error,
          details: {
            timeoutMs: effectiveTimeoutMs,
            deadlineAtMs
          }
        }
      )
    }
    if (externalSignal?.aborted) {
      throw new AiRuntimeError('abort', 'AI 请求已取消。', { cause: error })
    }
    throw normalizeAiRuntimeError(error)
  } finally {
    globalThis.clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortCurrentFetch)
  }
}

async function readAiProviderResponseBody(
  response: Response,
  signal?: AbortSignal | null
): Promise<{ payload: unknown | null; rawBody: string; bytesRead: number }> {
  const contentLength = parseAiContentLength(response.headers?.get?.('content-length'))
  if (contentLength !== undefined && contentLength > AI_PROVIDER_RESPONSE_MAX_BYTES) {
    void cancelAiResponseBody(response)
    throw buildAiResponseTooLargeError(response.status, contentLength)
  }

  const body = response.body
  const reader = body && typeof body.getReader === 'function'
    ? body.getReader()
    : null
  let rawBody = ''
  let bytesRead = 0

  if (reader) {
    const decoder = new TextDecoder()
    const textChunks: string[] = []
    try {
      while (true) {
        const result = await waitForAiBodyOperation(reader.read(), signal)
        if (result.done) {
          break
        }
        const chunk = normalizeAiResponseChunk(result.value)
        bytesRead += chunk.byteLength
        if (bytesRead > AI_PROVIDER_RESPONSE_MAX_BYTES) {
          void cancelAiReader(reader)
          throw buildAiResponseTooLargeError(response.status, bytesRead)
        }
        textChunks.push(decoder.decode(chunk, { stream: true }))
      }
      textChunks.push(decoder.decode())
      rawBody = textChunks.join('')
    } catch (error) {
      // Cancellation must release the network reader even when a gateway stalls mid-body.
      void reader.cancel().catch(() => {})
      throw error
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // 某些测试 Response 或已取消的流不支持重复释放，忽略清理错误。
      }
    }
  } else {
    rawBody = await waitForAiBodyOperation(response.text(), signal)
    bytesRead = new TextEncoder().encode(rawBody).byteLength
    if (bytesRead > AI_PROVIDER_RESPONSE_MAX_BYTES) {
      void cancelAiResponseBody(response)
      throw buildAiResponseTooLargeError(response.status, bytesRead)
    }
  }

  const trimmedBody = rawBody.trim()
  if (!trimmedBody) {
    return { payload: null, rawBody, bytesRead }
  }

  try {
    return { payload: JSON.parse(trimmedBody), rawBody, bytesRead }
  } catch {
    try { return { payload: parseAiEventStream(rawBody), rawBody, bytesRead } } catch (error) {
      if (error instanceof AiEventStreamError) throw new AiRuntimeError('network', error.message, { retryable: true, cause: error })
      throw error
    }
  }
}

function normalizeAiResponseChunk(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  return new TextEncoder().encode(String(value ?? ''))
}

function waitForAiBodyOperation<T>(
  operation: Promise<T>,
  signal?: AbortSignal | null
): Promise<T> {
  if (!signal) {
    return operation
  }
  if (signal.aborted) {
    return Promise.reject(createAbortException())
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortException())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function createAbortException(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

async function cancelAiResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // 响应已取消、锁定或 mock 未实现 cancel 时无需覆盖原始诊断。
  }
}

async function cancelAiReader(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  try {
    await reader.cancel()
  } catch {
    // 保留“响应过大”作为主错误。
  }
}

function parseAiContentLength(value: unknown): number | undefined {
  const normalized = String(value ?? '').trim()
  if (!/^\d+$/.test(normalized)) {
    return undefined
  }
  const contentLength = Number(normalized)
  if (!Number.isFinite(contentLength)) {
    return AI_PROVIDER_RESPONSE_MAX_BYTES + 1
  }
  return contentLength >= 0 ? contentLength : undefined
}

function buildAiResponseTooLargeError(status: unknown, bytes: number): AiRuntimeError {
  const limitMb = Math.round(AI_PROVIDER_RESPONSE_MAX_BYTES / (1024 * 1024))
  return new AiRuntimeError(
    'provider',
    `AI 响应体超过 ${limitMb} MB 安全上限，已停止读取。请减小批量大小或检查自定义 API 返回内容。`,
    {
      status: Number(status) || undefined,
      retryable: false,
      details: {
        maxBytes: AI_PROVIDER_RESPONSE_MAX_BYTES,
        receivedBytes: Math.max(0, Number(bytes) || 0)
      }
    }
  )
}

function normalizeAiRequestTimeoutMs(timeoutMs: unknown): number {
  const value = Number(timeoutMs)
  return Number.isFinite(value) && value > 0 ? Math.max(1000, Math.min(value, 600000)) : 30000
}

function buildAiTimeoutMessage(timeoutMs: number): string {
  const seconds = Math.max(1, Math.round(normalizeAiRequestTimeoutMs(timeoutMs) / 1000))
  return `AI 请求超时，超过 ${seconds} 秒仍未返回。请稍后重试或在通用设置里调大请求超时。`
}

function buildAiDeadlineMessage(totalBudgetMs: number): string {
  const normalizedBudgetMs = Math.max(1, Math.round(totalBudgetMs))
  const duration = normalizedBudgetMs < 1000
    ? `${normalizedBudgetMs} 毫秒`
    : `${Math.max(1, Math.round(normalizedBudgetMs / 1000))} 秒`
  return `AI 请求超时：总时限 ${duration} 已用尽。兼容降级与重试不会获得额外等待时间。`
}

function resolveAiRequestDeadlineAtMs({
  startedAtMs,
  requestTimeoutMs,
  totalBudgetMs,
  deadlineAtMs
}: {
  startedAtMs: number
  requestTimeoutMs: number
  totalBudgetMs?: number
  deadlineAtMs?: number
}): number {
  const requestedBudgetMs = Number(totalBudgetMs)
  const requestedDeadlineAtMs = Number(deadlineAtMs)
  const explicitDeadlines: number[] = []
  if (Number.isFinite(requestedBudgetMs) && requestedBudgetMs > 0) {
    explicitDeadlines.push(startedAtMs + Math.max(1, requestedBudgetMs))
  }
  if (Number.isFinite(requestedDeadlineAtMs) && requestedDeadlineAtMs > 0) {
    explicitDeadlines.push(requestedDeadlineAtMs)
  }
  return explicitDeadlines.length
    ? Math.min(...explicitDeadlines)
    : startedAtMs + requestTimeoutMs
}

function getAiRequestRemainingMs(deadlineAtMs: number): number {
  return Math.max(0, Math.ceil(deadlineAtMs - Date.now()))
}

function throwIfAiRequestUnavailable(
  signal: AbortSignal | null | undefined,
  deadlineAtMs: number,
  totalBudgetMs: number
): void {
  throwIfAiAborted(signal)
  if (getAiRequestRemainingMs(deadlineAtMs) <= 0) {
    throw new AiRuntimeError('abort', buildAiDeadlineMessage(totalBudgetMs), {
      retryable: false,
      details: { deadlineAtMs }
    })
  }
}

function validateSchemaNode(value: unknown, schema: JsonSchema, path: string, issues: string[]): void {
  if (issues.length >= 24) return
  if (!schema || typeof schema !== 'object') {
    return
  }

  if (!matchesSchemaType(value, schema.type)) {
    issues.push(`${path} 类型不匹配，应为 ${formatSchemaType(schema.type)}`)
    return
  }

  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    issues.push(`${path} 值不在允许枚举中`)
  }

  if (typeof value === 'string') {
    if (Number.isFinite(schema.maxLength) && value.length > Number(schema.maxLength)) {
      issues.push(`${path} 长度超过 ${schema.maxLength}`)
    }
    if (Number.isFinite(schema.minLength) && value.length < Number(schema.minLength)) {
      issues.push(`${path} 长度小于 ${schema.minLength}`)
    }
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      issues.push(`${path} 不是有限数字`)
    }
    if (Number.isFinite(schema.minimum) && value < Number(schema.minimum)) {
      issues.push(`${path} 小于 ${schema.minimum}`)
    }
    if (Number.isFinite(schema.maximum) && value > Number(schema.maximum)) {
      issues.push(`${path} 大于 ${schema.maximum}`)
    }
  }

  if (Array.isArray(value)) {
    if (Number.isFinite(schema.maxItems) && value.length > Number(schema.maxItems)) {
      issues.push(`${path} 数组长度超过 ${schema.maxItems}`)
      return
    }
    if (Number.isFinite(schema.minItems) && value.length < Number(schema.minItems)) {
      issues.push(`${path} 数组长度小于 ${schema.minItems}`)
    }
    if (schema.items) {
      value.forEach((item, index) => validateSchemaNode(item, schema.items!, `${path}[${index}]`, issues))
    }
    return
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const requiredKey of schema.required || []) {
      if (!Object.hasOwn(record, requiredKey)) {
        issues.push(`${path}.${requiredKey} 缺少必填字段`)
      }
    }

    const properties = schema.properties || {}
    for (const [key, propertyValue] of Object.entries(record)) {
      const propertySchema = Object.hasOwn(properties, key) ? properties[key] : undefined
      if (!propertySchema) {
        if (schema.additionalProperties === false) {
          issues.push(`${path}.${key} 不允许额外字段`)
        } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          validateSchemaNode(propertyValue, schema.additionalProperties, `${path}.${key}`, issues)
        }
        continue
      }
      validateSchemaNode(propertyValue, propertySchema, `${path}.${key}`, issues)
    }
  }
}

function matchesSchemaType(value: unknown, type: JsonSchema['type']): boolean {
  if (!type) {
    return true
  }

  const types = Array.isArray(type) ? type : [type]
  return types.some((expectedType) => {
    if (expectedType === 'array') {
      return Array.isArray(value)
    }
    if (expectedType === 'integer') {
      return Number.isInteger(value)
    }
    if (expectedType === 'number') {
      return typeof value === 'number' && Number.isFinite(value)
    }
    if (expectedType === 'object') {
      return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    }
    if (expectedType === 'null') {
      return value === null
    }
    return typeof value === expectedType
  })
}

function formatSchemaType(type: JsonSchema['type']): string {
  return Array.isArray(type) ? type.join('|') : String(type || 'unknown')
}

function normalizeAiRuntimeError(error: unknown): AiRuntimeError {
  if (error instanceof AiRuntimeError) {
    return error
  }

  if (isAbortError(error)) {
    return new AiRuntimeError('abort', 'AI 请求已取消或超时。', { cause: error })
  }

  if (error instanceof TypeError) {
    return new AiRuntimeError('network', error.message || 'AI 网络请求失败。', {
      retryable: true,
      cause: error
    })
  }

  if (error instanceof Error) {
    return new AiRuntimeError('provider', error.message || 'AI 请求失败。', { cause: error })
  }

  return new AiRuntimeError('provider', 'AI 请求失败。', { details: error })
}

function shouldRetryAiRuntimeError(error: unknown): boolean {
  if (!(error instanceof AiRuntimeError)) {
    return false
  }
  if (error.kind === 'parse' || error.kind === 'schema') {
    return true
  }
  if (error.kind === 'network') {
    return error.retryable
  }
  return error.kind === 'provider' && error.retryable
}

function shouldUseRepairRetry(error: unknown): boolean {
  return error instanceof AiRuntimeError && (error.kind === 'parse' || error.kind === 'schema')
}

function buildRepairUserPrompt(userPrompt: string, schemaName: string, rawText: string, error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : '结构化输出无效。'
  const previousOutput = cleanAiRuntimeText(rawText, 1200)
  return [
    userPrompt,
    '',
    `上一次 ${schemaName} 输出未通过本地校验：${errorMessage}`,
    previousOutput ? `上一次输出摘录：${previousOutput}` : '',
    '请只返回符合 JSON Schema 的 JSON，不要返回 markdown、解释或额外字段。'
  ].filter(Boolean).join('\n')
}

function isRetryableProviderStatus(status: unknown): boolean {
  const statusCode = Number(status)
  return statusCode === 408 || statusCode === 409 || statusCode === 425 || statusCode === 429 || statusCode >= 500
}

const AI_RETRY_BASE_DELAY_MS = 600
const AI_RETRY_MAX_DELAY_MS = 15000

/** 限流/服务端错误的退避等待：优先尊重 Retry-After，否则指数退避 + 抖动。 */
async function waitForAiRetryDelay(
  error: AiRuntimeError,
  attempt: number,
  signal: AbortSignal | null | undefined,
  deadlineAtMs: number,
  totalBudgetMs: number
): Promise<void> {
  throwIfAiRequestUnavailable(signal, deadlineAtMs, totalBudgetMs)
  const retryAfterMs = error.details && typeof error.details === 'object'
    ? Number((error.details as { retryAfterMs?: unknown }).retryAfterMs)
    : Number.NaN
  const backoffMs = Math.min(
    AI_RETRY_MAX_DELAY_MS,
    AI_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  ) + Math.floor(Math.random() * 250)
  const delayMs = Number.isFinite(retryAfterMs) && retryAfterMs >= 0
    ? retryAfterMs
    : backoffMs
  if (delayMs <= 0) {
    return
  }
  const remainingMs = getAiRequestRemainingMs(deadlineAtMs)
  if (delayMs >= remainingMs) {
    await sleepWithAbort(remainingMs, signal)
    throwIfAiRequestUnavailable(signal, deadlineAtMs, totalBudgetMs)
  }
  await sleepWithAbort(delayMs, signal)
}

function sleepWithAbort(delayMs: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiRuntimeError('abort', 'AI 请求已取消。'))
      return
    }
    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    const onAbort = () => {
      globalThis.clearTimeout(timeoutId)
      reject(new AiRuntimeError('abort', 'AI 请求已取消。'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function parseRetryAfterMs(rawValue: unknown): number | undefined {
  const value = String(rawValue ?? '').trim()
  if (!value) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000)
  }
  const dateMs = Date.parse(value)
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }
  return undefined
}

/**
 * 识别「端点明确拒绝推理强度参数」类错误。只接受指名 reasoning / effort /
 * thinking 的错误，避免把结构化输出等其他兼容问题错误归因到推理强度。
 */
function isReasoningEffortCompatibilityError(error: AiRuntimeError): boolean {
  if (error.kind !== 'provider') {
    return false
  }
  const status = Number(error.status)
  if (status !== 400 && status !== 404 && status !== 415 && status !== 422) {
    return false
  }
  const message = getAiCompatibilityErrorText(error)
  return (
    /reasoning[\s_.-]*effort|enable[\s_.-]*thinking|thinking[\s_.-]*(?:budget|level|config|strategy|type)|output_config[^\n]*effort|effort level/i.test(message) ||
    /(?:parameter|param|field|argument|property)\s*[:=]?\s*['"“”]?(?:reasoning|thinking)['"“”]?/i.test(message) ||
    /(?:reasoning|thinking)\s+(?:parameter|param|field|argument|property)/i.test(message) ||
    /['"“”](?:reasoning|thinking)['"“”]\s+(?:is|was|isn't|wasn't|not|unsupported|invalid|unknown)/i.test(message) ||
    /\b(?:reasoning|thinking)\b[^\n]{0,48}\b(?:unsupported|not supported|invalid|unknown|unrecognized)\b/i.test(message) ||
    /\b(?:unsupported|not supported|invalid|unknown|unrecognized)\b[^\n]{0,48}\b(?:reasoning|thinking)\b/i.test(message)
  )
}

function getAiCompatibilityErrorText(error: AiRuntimeError): string {
  const details = error.details as { parameter?: unknown; code?: unknown } | undefined
  return [error.message, details?.parameter, details?.code].filter(Boolean).join(' ')
}

function isParameterRejection(error: AiRuntimeError): boolean {
  if (error.kind !== 'provider' || ![400, 404, 415, 422].includes(Number(error.status))) return false
  const details = error.details as { parameter?: unknown; code?: unknown } | undefined
  return !/api.?key|auth|credential|quota|billing|model_not_found|deployment_not_found/i.test(String(details?.parameter || '') + ' ' + String(details?.code || ''))
}

function isStructuredFormatCompatibilityError(error: AiRuntimeError): boolean {
  if (!isParameterRejection(error)) return false
  const text = getAiCompatibilityErrorText(error)
  return /response_format|json_object|json_schema|text[.\s_-]*format|output_config[^\n]*format|response_?json_?schema|response_?mime_?type|structured[\s_-]*output|json mode/i.test(text) &&
    /unsupported|not supported|does not support|invalid|unknown|unrecognized|unexpected|not permitted|not allowed|not available|not implemented|must|required|不支持|无效/i.test(text)
}

function isSystemRoleCompatibilityError(error: AiRuntimeError): boolean {
  if (!isParameterRejection(error)) return false
  const text = getAiCompatibilityErrorText(error)
  return /\bsystem\b|system_?instruction/i.test(text) && /role|message|instruction/i.test(text) &&
    /unsupported|not supported|does not support|not allowed|invalid|only|unknown|unrecognized/i.test(text)
}

function isEndpointCompatibilityError(error: AiRuntimeError): boolean {
  if (error.kind !== 'provider' || ![400, 404, 405, 501].includes(Number(error.status))) return false
  const text = getAiCompatibilityErrorText(error)
  if (/model_not_found|deployment_not_found|(?:model|deployment)[^\n]{0,100}(?:not found|does not exist|access|permission)|api.?key|unauthorized|authentication/i.test(text)) return false
  return /responses|chat[\s/._-]*completions|endpoint|route|cannot post|not found|404|method not allowed/i.test(text) &&
    /unsupported|not supported|does not support|not found|not implemented|cannot post|404|method not allowed/i.test(text)
}

function throwIfAiAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    throw new AiRuntimeError('abort', 'AI 请求已取消。')
  }
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError')
}

function normalizeFolderPath(value: unknown): string {
  return String(value || '')
    .split(/\s*(?:->|\/|>|›|»|\\|·|•|→|➜)\s*/g).flatMap(segment => { const mappedResult = segment.replace(/\s+/g, ' ').trim(); return mappedResult ? [mappedResult] : [] })
    .slice(0, 5)
    .join(' / ')
}

function dedupeFolderCandidates(candidates: AiFolderCandidate[]): AiFolderCandidate[] {
  const seenIds = new Set<string>()
  const seenPaths = new Set<string>()
  const output: AiFolderCandidate[] = []

  for (const candidate of candidates) {
    const pathKey = candidate.folderPath.toLowerCase()
    if (seenIds.has(candidate.folderId) || seenPaths.has(pathKey)) {
      continue
    }
    seenIds.add(candidate.folderId)
    seenPaths.add(pathKey)
    output.push(candidate)
  }
  return output
}
