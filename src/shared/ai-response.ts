import { getAiProviderEndpoint, type AiEndpointSettings } from './ai-provider-url.js'
export type { AiEndpointSettings } from './ai-provider-url.js'

type AiRefusalFormatter = (refusal: unknown) => string

export class AiResponseRefusalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiResponseRefusalError'
  }
}

export function getAiEndpoint(settings: AiEndpointSettings): string {
  return getAiProviderEndpoint(settings)
}

/** Read each content block once, retaining whitespace between text fragments. */
function readFinalContentText(content: unknown, formatRefusal: AiRefusalFormatter): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const fragments: string[] = []
  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const type = String(item.type || '').toLowerCase()
    if (type === 'refusal' || (typeof item.refusal === 'string' && item.refusal.trim())) {
      throw new AiResponseRefusalError(formatRefusal(item.refusal || item.text))
    }
    if ((!type || type === 'text' || type === 'output_text') && typeof item.text === 'string') fragments.push(item.text)
  }
  return fragments.join('')
}

export function extractResponsesJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const response = payload as any
  const fragments: string[] = []
  const calls: unknown[] = []
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (!item || typeof item !== 'object') continue
    const type = String(item.type || '').toLowerCase()
    if (type === 'function_call') calls.push(item)
    else if (!type || type === 'message') fragments.push(readFinalContentText(item.content, formatRefusal))
    else if (type === 'output_text' || type === 'refusal') fragments.push(readFinalContentText([item], formatRefusal))
  }
  if (typeof response?.refusal === 'string' && response.refusal.trim()) throw new AiResponseRefusalError(formatRefusal(response.refusal))
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return extractJsonPayloadText(response.output_text)
  const text = fragments.join('')
  if (text.trim()) return extractJsonPayloadText(text)
  if (response?.output_parsed && typeof response.output_parsed === 'object') return JSON.stringify(response.output_parsed)
  const argumentsText = extractSingleToolArguments(calls)
  if (argumentsText) return extractJsonPayloadText(argumentsText)
  throw new Error('Responses API 返回中未找到可解析的 JSON 文本。')
}

export function extractChatCompletionsJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const choice = (payload as any)?.choices?.[0]
  const message = choice?.message
  if (choice?.finish_reason === 'content_filter') throw new AiResponseRefusalError('模型拒绝返回此内容（content_filter）。')
  if (typeof message?.refusal === 'string' && message.refusal.trim()) throw new AiResponseRefusalError(formatRefusal(message.refusal))
  const text = readFinalContentText(message?.content, formatRefusal)
  if (text.trim()) return extractJsonPayloadText(text)
  if (typeof choice?.text === 'string' && choice.text.trim()) return extractJsonPayloadText(choice.text)
  if (message?.parsed && typeof message.parsed === 'object') return JSON.stringify(message.parsed)
  const argumentsText = extractSingleToolArguments(message?.tool_calls || (message?.function_call ? [message.function_call] : []))
  if (argumentsText) return extractJsonPayloadText(argumentsText)
  // A few compatible reasoning endpoints place their final JSON in this field.
  const reasoningText = typeof message?.reasoning_content === 'string' && message.reasoning_content.trim()
    ? message.reasoning_content : typeof message?.reasoning === 'string' ? message.reasoning : ''
  if (reasoningText.trim()) {
    const salvaged = extractJsonPayloadText(reasoningText)
    if (isJsonText(salvaged)) return salvaged
    throw new Error('模型把输出写入了思考通道（reasoning）且未包含 JSON 正文，请关闭思考模式或换用支持结构化输出的模型。')
  }
  throw new Error('Chat Completions 返回中未找到可解析的 JSON 文本。')
}

export function extractAnthropicMessagesJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const response = payload as any
  if (response?.stop_reason === 'refusal') throw new AiResponseRefusalError('模型拒绝返回此内容。')
  const content: any[] = Array.isArray(response?.content) ? response.content : []
  const text = readFinalContentText(content, formatRefusal)
  if (text.trim()) return extractJsonPayloadText(text)
  let toolInput: unknown
  let toolCount = 0
  for (const block of content) {
    if (block?.type !== 'tool_use') continue
    toolInput = block.input
    toolCount += 1
  }
  if (toolCount === 1 && toolInput && typeof toolInput === 'object') return JSON.stringify(toolInput)
  throw new Error('Claude Messages API 返回中未找到可解析的 JSON 文本。')
}

export function extractGeminiJsonText(payload: unknown): string {
  const response = payload as any
  const candidate = response?.candidates?.[0]
  const blocked = response?.promptFeedback?.blockReason || (/SAFETY|BLOCKLIST|PROHIBITED_CONTENT|SPII|RECITATION/.test(String(candidate?.finishReason)) ? candidate.finishReason : '')
  if (blocked) throw new AiResponseRefusalError('模型未返回此内容（' + sanitizeAiErrorText(blocked, 80) + '）。')
  const fragments: string[] = []
  let toolInput: unknown
  let toolCount = 0
  for (const part of Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []) {
    if (!part || part.thought) continue
    if (typeof part.text === 'string') fragments.push(part.text)
    const argumentsValue = part.functionCall?.args
    if (argumentsValue && typeof argumentsValue === 'object') {
      toolInput = argumentsValue
      toolCount += 1
    }
  }
  const text = fragments.join('')
  if (text.trim()) return extractJsonPayloadText(text)
  if (toolCount === 1) return JSON.stringify(toolInput)
  throw new Error('Gemini 返回中没有可解析的最终文本。')
}

export function extractGeminiInteractionsJsonText(payload: unknown): string {
  const text = readFinalContentText((payload as any)?.outputs, buildAiStructuredOutputRefusalError)
  if (text.trim()) return extractJsonPayloadText(text)
  throw new Error('Gemini Interactions 返回中没有可解析的最终文本。')
}

function extractSingleToolArguments(calls: unknown): string {
  if (!Array.isArray(calls) || calls.length !== 1) return ''
  const value = calls[0]?.function?.arguments ?? calls[0]?.arguments
  return typeof value === 'string' ? value : value && typeof value === 'object' ? JSON.stringify(value) : ''
}

/**
 * 从任意模型的自由文本输出中萃取 JSON 载荷：
 * 1. 剥离推理模型的 <think>…</think> 思考段（含只有闭合标签的变体）
 * 2. 优先取 markdown 代码围栏内容（允许围栏前后有说明文字）
 * 3. 兜底做括号平衡扫描，截取首个完整的 JSON 对象/数组
 * 提取失败时原样返回修剪后的文本，让上层 JSON.parse 给出错误。
 */
export function extractJsonPayloadText(text: unknown): string {
  let value = String(text ?? '').replace(/^\uFEFF/, '')
  if (!value.trim()) {
    return value.trim()
  }

  const closeThinkIndex = value.toLowerCase().lastIndexOf('</think>')
  if (closeThinkIndex !== -1) {
    value = value.slice(closeThinkIndex + '</think>'.length)
  } else {
    value = value.replace(/<think>[\s\S]*?<\/think>/g, '')
  }

  const fencedMatches = [...value.matchAll(/```(?:json[c5]?|javascript)?\s*\n?([\s\S]*?)```/gi)]
  for (const match of fencedMatches.reverse()) {
    if (isJsonText(match[1].trim())) return match[1].trim()
  }

  const trimmed = value.trim()
  if (isJsonText(trimmed)) {
    return trimmed
  }

  const balanced = extractBalancedJsonSlice(trimmed)
  return balanced ?? trimmed
}

function isJsonText(text: string): boolean {
  if (!looksLikeJsonPayload(text)) return false
  try { JSON.parse(text); return true } catch { return false }
}

function looksLikeJsonPayload(text: string): boolean {
  if (!text) {
    return false
  }
  const first = text[0]
  const last = text[text.length - 1]
  return (first === '{' && last === '}') || (first === '[' && last === ']')
}

function extractBalancedJsonSlice(text: string): string | null {
  let start = -1
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"' && stack.length) { inString = true; continue }
    if (char === '{' || char === '[') {
      if (!stack.length) start = index
      stack.push(char === '{' ? '}' : ']')
    } else if (char === '}' || char === ']') {
      if (stack.pop() !== char) { stack.length = 0; start = -1; continue }
      if (!stack.length && start >= 0) {
        const candidate = text.slice(start, index + 1)
        if (isJsonText(candidate)) return candidate
        start = -1
      }
    }
  }
  return null
}

/**
 * 判断响应是否因输出上限被截断。截断时重试同一提示几乎必然再次截断，
 * 上层应直接报错并给出可操作的建议，而不是浪费重试请求。
 */
export function getAiTruncationIssue(payload: unknown, apiStyle: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const anthropicStopReason = (payload as { stop_reason?: unknown }).stop_reason
  if ((payload as any)?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    return 'Gemini 输出达到上限而被截断。请减小批量大小或降低推理强度后重试。'
  }
  if (anthropicStopReason === 'max_tokens') {
    return 'AI 输出因达到模型输出上限被截断（stop_reason=max_tokens）。请减小批量大小或缩短提示后重试。'
  }

  if (apiStyle === 'chat_completions') {
    const finishReason = (payload as { choices?: Array<{ finish_reason?: unknown }> }).choices?.[0]?.finish_reason
    if (finishReason === 'length') {
      return 'AI 输出因达到模型输出上限被截断（finish_reason=length）。请减小批量大小、缩短提示或调大模型输出上限后重试。'
    }
    return ''
  }

  const responsePayload = payload as { status?: unknown; incomplete_details?: { reason?: unknown } }
  if (responsePayload.status === 'incomplete') {
    const reason = sanitizeAiErrorText(responsePayload.incomplete_details?.reason || 'incomplete', 100)
    return `AI 输出未完成（${reason}）。请减小批量大小、缩短提示或调大模型输出上限后重试。`
  }
  return ''
}

const AI_ERROR_MESSAGE_DETAIL_LIMIT = 240

/**
 * 供应商错误可能原样回显 Authorization、API Key 或请求 URL。展示前统一压平、
 * 脱敏和限长，避免错误提示与通知成为凭据泄漏通道。
 */
export function sanitizeAiErrorText(
  value: unknown,
  maxLength = AI_ERROR_MESSAGE_DETAIL_LIMIT
): string {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  const redacted = normalized
    .replace(/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(
      /(\bapi\s+key\b\s*[:=]?\s*["']?)([^"',;\s}&]+)/gi,
      '$1[REDACTED]'
    )
    .replace(
      /(["']?(?:api[_-]?key|apikey|authorization|x-api-key|x-goog-api-key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)["']?\s*[:=]\s*["']?)([^"',;\s}&]+)/gi,
      '$1[REDACTED]'
    )
    .replace(
      /([?&](?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)=)([^&#\s]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/\bAIza[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
  return truncateText(redacted, maxLength)
}

export function extractAiErrorMessage(payload: unknown, statusCode: unknown, rawBody: unknown = ''): string {
  const responsePayload = payload && typeof payload === 'object'
    ? payload as {
      error?: { message?: unknown } | string
      message?: unknown
      detail?: unknown
      error_description?: unknown
    }
    : null
  const errorValue = responsePayload?.error
  const message = [
    errorValue && typeof errorValue === 'object' ? errorValue.message : '',
    typeof errorValue === 'string' ? errorValue : '',
    responsePayload?.message,
    responsePayload?.detail,
    responsePayload?.error_description,
    typeof payload === 'string' ? payload : ''
  ]
    .map((item) => sanitizeAiErrorText(item))
    .find(Boolean)
  const rawExcerpt = message
    ? ''
    : sanitizeAiErrorText(rawBody)

  return message
    ? `AI 请求失败（${statusCode}）：${message}`
    : rawExcerpt
      ? `AI 请求失败（${statusCode}）：${rawExcerpt}`
      : `AI 请求失败（${statusCode}）。`
}

function buildAiStructuredOutputRefusalError(refusal: unknown): string {
  const normalizedRefusal = sanitizeAiErrorText(refusal, 120)

  return normalizedRefusal
    ? `模型拒绝生成结构化结果：${normalizedRefusal}`
    : '模型拒绝生成结构化结果。'
}

function truncateText(value: string, maxLength: number): string {
  const safeText = String(value || '').trim()
  const limit = Math.max(1, Number(maxLength) || 1)
  if (safeText.length <= limit) {
    return safeText
  }

  return `${safeText.slice(0, Math.max(limit - 1, 1)).trim()}…`
}
