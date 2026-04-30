export interface AiEndpointSettings {
  baseUrl?: unknown
  apiStyle?: unknown
}

type AiRefusalFormatter = (refusal: unknown) => string

export function getAiEndpoint(settings: AiEndpointSettings): string {
  const baseUrl = String(settings?.baseUrl || '').replace(/\/+$/, '')
  const suffix = settings?.apiStyle === 'chat_completions' ? 'chat/completions' : 'responses'
  return baseUrl.endsWith(`/${suffix}`) ? baseUrl : `${baseUrl}/${suffix}`
}

export function extractResponsesJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const responsePayload = payload as {
    output?: Array<{ content?: unknown[] }>
    output_text?: unknown
  } | null
  const contentItems = Array.isArray(responsePayload?.output)
    ? responsePayload.output.flatMap((entry) => Array.isArray(entry?.content) ? entry.content : [])
    : []
  const refusalNode = contentItems.find((item: any) => {
    return typeof item?.refusal === 'string' && item.refusal.trim()
  }) as { refusal?: string } | undefined

  if (refusalNode?.refusal) {
    throw new Error(formatRefusal(refusalNode.refusal))
  }

  if (typeof responsePayload?.output_text === 'string' && responsePayload.output_text.trim()) {
    return responsePayload.output_text
  }

  const textNode = contentItems.find((item: any) => {
    return typeof item?.text === 'string' && item.text.trim()
  }) as { text?: string } | undefined

  if (textNode?.text) {
    return textNode.text
  }

  throw new Error('Responses API 返回中未找到可解析的 JSON 文本。')
}

export function extractChatCompletionsJsonText(
  payload: unknown,
  formatRefusal: AiRefusalFormatter = buildAiStructuredOutputRefusalError
): string {
  const chatPayload = payload as {
    choices?: Array<{
      message?: {
        refusal?: unknown
        content?: unknown
      }
    }>
  } | null
  const message = chatPayload?.choices?.[0]?.message

  if (typeof message?.refusal === 'string' && message.refusal.trim()) {
    throw new Error(formatRefusal(message.refusal))
  }

  const content = message?.content
  if (typeof content === 'string' && content.trim()) {
    return stripMarkdownCodeFences(content)
  }

  if (Array.isArray(content)) {
    const refusalNode = content.find((item: any) => {
      return typeof item?.refusal === 'string' && item.refusal.trim()
    }) as { refusal?: string } | undefined
    if (refusalNode?.refusal) {
      throw new Error(formatRefusal(refusalNode.refusal))
    }

    const textNode = content.find((item: any) => {
      return typeof item?.text === 'string' && item.text.trim()
    }) as { text?: string } | undefined
    if (textNode?.text) {
      return stripMarkdownCodeFences(textNode.text)
    }
  }

  throw new Error('Chat Completions 返回中未找到可解析的 JSON 文本。')
}

export function stripMarkdownCodeFences(text: unknown): string {
  return String(text || '').replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/, '$1').trim()
}

export function extractAiErrorMessage(payload: unknown, statusCode: unknown): string {
  const responsePayload = payload as {
    error?: { message?: unknown }
    message?: unknown
  } | null
  const message = responsePayload?.error?.message || responsePayload?.message || ''
  return message
    ? `AI 请求失败（${statusCode}）：${message}`
    : `AI 请求失败（${statusCode}）。`
}

export function buildAiStructuredOutputRefusalError(refusal: unknown): string {
  const normalizedRefusal = truncateText(
    String(refusal || '').replace(/\s+/g, ' ').trim(),
    120
  )

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
