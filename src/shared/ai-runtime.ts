import {
  extractAiErrorMessage,
  extractChatCompletionsJsonText,
  extractResponsesJsonText,
  getAiEndpoint,
  getAiTruncationIssue
} from './ai-response.js'
import { getAiProviderBaseUrlIssue } from './ai-provider-url.js'

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
  apiStyle: 'responses' | 'chat_completions'
  timeoutMs?: number
}

export interface AiRuntimeMetadata {
  endpoint: string
  apiStyle: AiProviderSettings['apiStyle']
  schemaName?: string
  status?: number
  attempts: number
  repaired: boolean
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
  fetchImpl?: typeof fetch
  retry?: boolean
  validate?: (data: T) => void
}

export interface AiPromptEnvelope {
  settings: Pick<AiProviderSettings, 'model' | 'apiStyle'>
  schema: JsonSchema
  schemaName: string
  systemPrompt: string
  userPrompt: string
}

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
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new AiRuntimeError('configuration', '请先到通用设置配置“自定义AI渠道”。')
  }

  const baseUrlIssue = getAiProviderBaseUrlIssue(settings.baseUrl)
  if (baseUrlIssue) {
    throw new AiRuntimeError('configuration', baseUrlIssue)
  }
}

function buildAiPromptRequestBody({
  settings,
  schema,
  schemaName,
  systemPrompt,
  userPrompt
}: AiPromptEnvelope, options: { useStructuredFormat?: boolean } = {}): Record<string, unknown> {
  const useStructuredFormat = options.useStructuredFormat !== false
  if (settings.apiStyle === 'chat_completions') {
    // 紧凑序列化 schema：提示语义不变，显著减少每次请求的输入 token。
    const schemaHint =
      '\n\n请严格返回一个 json 对象，并按以下 JSON Schema 组织结果，不要添加任何额外文本或 markdown 标记：\n' +
      JSON.stringify(schema)
    const body: Record<string, unknown> = {
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt + schemaHint },
        { role: 'user', content: `${userPrompt}\n\n请只返回符合 schema 的 json 对象。` }
      ]
    }
    // 部分 OpenAI 兼容端点不认识 response_format，会直接 400；
    // 降级模式下移除该参数，仅靠提示词 + 本地 JSON 萃取兜底。
    if (useStructuredFormat) {
      body.response_format = { type: 'json_object' }
    }
    return body
  }

  if (!useStructuredFormat) {
    return {
      model: settings.model,
      input: [
        {
          role: 'system',
          content:
            systemPrompt +
            '\n\n请严格返回一个 json 对象，并按以下 JSON Schema 组织结果，不要添加任何额外文本或 markdown 标记：\n' +
            JSON.stringify(schema)
        },
        {
          role: 'user',
          content: `${userPrompt}\n\n请只返回符合 schema 的 json 对象。`
        }
      ]
    }
  }

  return {
    model: settings.model,
    input: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema
      }
    }
  }
}

export async function requestStructuredAiOutput<T>({
  settings,
  schema,
  schemaName,
  systemPrompt,
  userPrompt,
  signal = null,
  timeoutMs,
  fetchImpl = fetch,
  retry = true,
  validate
}: AiStructuredRequest<T>): Promise<AiRuntimeResult<T>> {
  ensureAiProviderConfigured(settings)
  const endpoint = getAiEndpoint(settings)
  const maxAttempts = retry ? 3 : 1
  // 修复重试（parse/schema）最多一次：连续两轮结构仍不合法时，再重试收益极低。
  let repairAttemptsLeft = retry ? 1 : 0
  // 结构化输出参数（response_format / text.format）兼容性降级最多一次。
  let useStructuredFormat = true

  const runAttempt = async (
    attempt: number,
    lastError: unknown = null,
    lastRawText = ''
  ): Promise<AiRuntimeResult<T>> => {
    throwIfAiAborted(signal)
    const repaired = attempt > 1 && shouldUseRepairRetry(lastError)
    const effectiveUserPrompt = repaired
      ? buildRepairUserPrompt(userPrompt, schemaName, lastRawText, lastError)
      : userPrompt
    let attemptRawText = lastRawText
    let attemptPayload: unknown = null

    try {
      const requestBody = buildAiPromptRequestBody({
        settings,
        schema,
        schemaName,
        systemPrompt,
        userPrompt: effectiveUserPrompt
      }, { useStructuredFormat })
      const payload = await requestAiProviderPayload({
        endpoint,
        settings,
        requestBody,
        signal,
        timeoutMs,
        fetchImpl
      })
      attemptPayload = payload
      let rawText = ''
      try {
        rawText = settings.apiStyle === 'responses'
          ? extractResponsesJsonText(payload)
          : extractChatCompletionsJsonText(payload)
      } catch (error) {
        throw new AiRuntimeError(
          'parse',
          error instanceof Error ? error.message : 'AI 返回中未找到可解析的 JSON 文本。',
          { cause: error }
        )
      }
      attemptRawText = rawText
      const parsed = parseAiJson(rawText, schemaName)
      validateJsonSchema(parsed, schema, schemaName)
      validate?.(parsed as T)

      return {
        data: parsed as T,
        rawText,
        payload,
        metadata: {
          endpoint,
          apiStyle: settings.apiStyle,
          schemaName,
          attempts: attempt,
          repaired
        }
      }
    } catch (error) {
      let normalizedError = normalizeAiRuntimeError(error)

      // 输出被模型上限截断时，重试同一提示几乎必然复现，直接给出可操作的错误。
      if (normalizedError.kind === 'parse' || normalizedError.kind === 'schema') {
        const truncationIssue = getAiTruncationIssue(attemptPayload, settings.apiStyle)
        if (truncationIssue) {
          throw new AiRuntimeError('provider', truncationIssue, {
            retryable: false,
            cause: normalizedError
          })
        }
      }

      // 端点不支持结构化输出参数：移除参数降级重试一次（不计入修复预算）。
      if (
        useStructuredFormat &&
        attempt < maxAttempts &&
        isStructuredFormatCompatibilityError(normalizedError)
      ) {
        useStructuredFormat = false
        return runAttempt(attempt + 1, normalizedError, attemptRawText)
      }

      if (attempt >= maxAttempts || !shouldRetryAiRuntimeError(normalizedError)) {
        throw normalizedError
      }
      if (shouldUseRepairRetry(normalizedError)) {
        if (repairAttemptsLeft <= 0) {
          throw normalizedError
        }
        repairAttemptsLeft -= 1
      } else {
        // 限流/服务端错误/网络抖动：退避后重试，优先尊重 Retry-After。
        await waitForAiRetryDelay(normalizedError, attempt, signal)
      }
      return runAttempt(attempt + 1, normalizedError, attemptRawText)
    }
  }

  return runAttempt(1)
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
  fetchImpl
}: {
  endpoint: string
  settings: AiProviderSettings
  requestBody: unknown
  signal?: AbortSignal | null
  timeoutMs?: number
  fetchImpl: typeof fetch
}): Promise<unknown> {
  const controller = new AbortController()
  const externalSignal = signal
  const effectiveTimeoutMs = normalizeAiRequestTimeoutMs(timeoutMs || settings.timeoutMs)
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    const { payload, rawBody } = await readAiProviderResponseBody(response)
    if (!response.ok) {
      throw new AiRuntimeError(
        'provider',
        extractAiErrorMessage(payload, response.status, rawBody),
        {
          status: response.status,
          retryable: isRetryableProviderStatus(response.status),
          details: {
            retryAfterMs: parseRetryAfterMs(response.headers?.get?.('retry-after')),
            body: payload ?? { rawBody: cleanAiRuntimeText(rawBody, 1200) }
          }
        }
      )
    }
    if (payload === null && rawBody.trim()) {
      throw new AiRuntimeError(
        'parse',
        `AI 返回了无效的 JSON 响应：${cleanAiRuntimeText(rawBody, 220)}`,
        {
          retryable: true,
          details: { rawBody: cleanAiRuntimeText(rawBody, 1200) }
        }
      )
    }
    return payload
  } catch (error) {
    if (timedOut && isAbortError(error)) {
      throw new AiRuntimeError(
        'abort',
        buildAiTimeoutMessage(effectiveTimeoutMs),
        {
          cause: error,
          details: { timeoutMs: effectiveTimeoutMs }
        }
      )
    }
    if (externalSignal?.aborted && isAbortError(error)) {
      throw new AiRuntimeError('abort', 'AI 请求已取消。', { cause: error })
    }
    throw normalizeAiRuntimeError(error)
  } finally {
    globalThis.clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortCurrentFetch)
  }
}

async function readAiProviderResponseBody(response: Response): Promise<{ payload: unknown | null; rawBody: string }> {
  const rawBody = await response.text()
  const trimmedBody = rawBody.trim()
  if (!trimmedBody) {
    return { payload: null, rawBody }
  }

  try {
    return { payload: JSON.parse(trimmedBody), rawBody }
  } catch {
    return { payload: null, rawBody }
  }
}

function normalizeAiRequestTimeoutMs(timeoutMs: unknown): number {
  return Math.max(1000, Number(timeoutMs) || 30000)
}

function buildAiTimeoutMessage(timeoutMs: number): string {
  const seconds = Math.max(1, Math.round(normalizeAiRequestTimeoutMs(timeoutMs) / 1000))
  return `AI 请求超时，超过 ${seconds} 秒仍未返回。请稍后重试或在通用设置里调大请求超时。`
}

function validateSchemaNode(value: unknown, schema: JsonSchema, path: string, issues: string[]): void {
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
      if (!(requiredKey in record)) {
        issues.push(`${path}.${requiredKey} 缺少必填字段`)
      }
    }

    const properties = schema.properties || {}
    for (const [key, propertyValue] of Object.entries(record)) {
      const propertySchema = properties[key]
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
async function waitForAiRetryDelay(error: AiRuntimeError, attempt: number, signal?: AbortSignal | null): Promise<void> {
  const retryAfterMs = error.details && typeof error.details === 'object'
    ? Number((error.details as { retryAfterMs?: unknown }).retryAfterMs)
    : Number.NaN
  const backoffMs = Math.min(
    AI_RETRY_MAX_DELAY_MS,
    AI_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  ) + Math.floor(Math.random() * 250)
  const delayMs = Number.isFinite(retryAfterMs) && retryAfterMs >= 0
    ? Math.min(retryAfterMs, AI_RETRY_MAX_DELAY_MS)
    : backoffMs
  if (delayMs <= 0) {
    return
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
 * 识别「端点不支持结构化输出参数」类错误（response_format / text.format），
 * 命中后移除该参数降级重试，让任意 OpenAI 兼容模型都能继续工作。
 */
function isStructuredFormatCompatibilityError(error: AiRuntimeError): boolean {
  if (error.kind !== 'provider') {
    return false
  }
  const status = Number(error.status)
  if (status !== 400 && status !== 404 && status !== 415 && status !== 422) {
    return false
  }
  const message = String(error.message || '')
  return /response_format|json_object|json_schema|text\.format|structured[\s_-]*output|(?:unknown|unsupported|unexpected|invalid|unrecognized)[\s_-]*(?:parameter|param|field|argument|keyword)|does not support/i.test(message)
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
