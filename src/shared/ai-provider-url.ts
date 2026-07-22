export function getAiProviderBaseUrlIssue(baseUrl: unknown): string {
  const value = String(baseUrl || '').trim()
  if (!value) {
    return '请填写 Base URL。'
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(value)
  } catch {
    return 'Base URL 格式无效。'
  }

  if (parsedUrl.protocol === 'https:') {
    return ''
  }

  if (parsedUrl.protocol === 'http:' && isLocalDevelopmentHost(parsedUrl.hostname)) {
    return ''
  }

  if (parsedUrl.protocol === 'http:') {
    return 'Base URL 必须使用 https；只有 localhost 可作为高级开发选项使用 http。'
  }

  return '仅支持 https Base URL；localhost 高级开发例外可使用 http。'
}

export function isAllowedAiProviderBaseUrl(baseUrl: unknown): boolean {
  return !getAiProviderBaseUrlIssue(baseUrl)
}

/** 仅识别 Anthropic 官方 API；第三方 Claude 网关仍按其 OpenAI-compatible 协议调用。 */
export function isDirectAnthropicProvider(baseUrl: unknown): boolean {
  try {
    return new URL(String(baseUrl ?? '').trim()).hostname.toLowerCase() === 'api.anthropic.com'
  } catch {
    return false
  }
}

export function getAnthropicMessagesEndpoint(baseUrl: unknown): string {
  const value = String(baseUrl ?? '').trim().replace(/\/+$/, '')
  if (/\/messages$/i.test(value)) {
    return value
  }
  try {
    const parsedUrl = new URL(value)
    if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
      return `${value}/v1/messages`
    }
  } catch {
    // URL 校验会在请求前给出更具体的配置错误；这里保持纯字符串回退。
  }
  return `${value}/messages`
}

export function getAiProviderAuthHeaders(
  baseUrl: unknown,
  apiKey: unknown
): Record<string, string> {
  const key = String(apiKey ?? '').trim()
  if (isDirectAnthropicProvider(baseUrl)) {
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  }
  return { Authorization: `Bearer ${key}` }
}

function isLocalDevelopmentHost(hostname: string): boolean {
  const value = String(hostname || '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase()

  return (
    value === 'localhost' ||
    value.endsWith('.localhost') ||
    value === '127.0.0.1' ||
    value === '::1'
  )
}
