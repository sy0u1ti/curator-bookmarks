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

  if (parsedUrl.username || parsedUrl.password) return 'Base URL 不支持内嵌用户名或密码，请在 API Key 中填写密钥。'

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
  return buildAiEndpoint(baseUrl, 'messages', 'v1')
}

export function getAiProviderAuthHeaders(
  baseUrl: unknown,
  apiKey: unknown,
  apiStyle?: unknown
): Record<string, string> {
  const key = String(apiKey ?? '').trim()
  const style = resolveAiApiStyle({ baseUrl, apiStyle })
  if (style === 'anthropic_messages') {
    return {
      ...(key ? { 'x-api-key': key } : {}),
      ...(!isDirectAnthropicProvider(baseUrl) && key ? { Authorization: `Bearer ${key}` } : {}),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  }
  if (!key) return {}
  if (style === 'gemini' || style === 'gemini_interactions') return { 'x-goog-api-key': key }
  if (isAzureAiProvider(baseUrl)) return { 'api-key': key }
  return { Authorization: `Bearer ${key}` }
}

export function resolveAiApiStyle(settings: AiEndpointSettings): ResolvedAiApiStyle {
  const style = normalizeAiApiStyle(settings.apiStyle, 'responses')
  let hostname = ''
  let pathname = ''
  try {
    const url = new URL(String(settings.baseUrl || '').trim())
    hostname = url.hostname.toLowerCase()
    pathname = url.pathname.replace(/\/+$/, '')
  } catch { /* Configuration validation owns invalid URLs. */ }
  if (hostname === 'api.anthropic.com') return 'anthropic_messages'
  if (hostname === 'generativelanguage.googleapis.com' && !/\/openai(?:\/|$)/i.test(pathname)) {
    return style === 'gemini_interactions' || /\/interactions(?:\/|$)/i.test(pathname) ? 'gemini_interactions' : 'gemini'
  }
  if (style !== 'auto') return style
  if (/\/messages$/i.test(pathname)) return 'anthropic_messages'
  if (/:generateContent$/i.test(pathname)) return 'gemini'
  if (/\/interactions$/i.test(pathname)) return 'gemini_interactions'
  if (/\/responses$/i.test(pathname) || hostname === 'api.openai.com') return 'responses'
  return 'chat_completions'
}

export function getAiProviderEndpoint(settings: AiEndpointSettings): string {
  const style = resolveAiApiStyle(settings)
  if (style === 'anthropic_messages') return getAnthropicMessagesEndpoint(settings.baseUrl)
  if (style === 'gemini_interactions') return buildAiEndpoint(settings.baseUrl, 'interactions', 'v1beta')
  if (style === 'gemini') {
    const model = String(settings.model || '').trim().replace(/^models\//, '')
    return buildAiEndpoint(settings.baseUrl, `models/${encodeURIComponent(model)}:generateContent`, 'v1beta')
  }
  const defaultVersion = isOfficialOpenAiProvider(settings.baseUrl) || isLocalAiProvider(settings.baseUrl) ? 'v1' : ''
  return buildAiEndpoint(settings.baseUrl, style === 'responses' ? 'responses' : 'chat/completions', defaultVersion)
}

export function getAiProviderModelsEndpoint(settings: AiEndpointSettings): string {
  const style = resolveAiApiStyle(settings)
  const defaultVersion = style === 'gemini' || style === 'gemini_interactions' ? 'v1beta'
    : style === 'anthropic_messages' || isOfficialOpenAiProvider(settings.baseUrl) || isLocalAiProvider(settings.baseUrl) ? 'v1' : ''
  return buildAiEndpoint(settings.baseUrl, 'models', defaultVersion)
}

/** Preserve gateway prefixes and api-version queries, replacing an operation
 * suffix instead of appending a second one when users paste a complete URL. */
function buildAiEndpoint(baseUrl: unknown, operation: string, defaultVersion = ''): string {
  const value = String(baseUrl ?? '').trim()
  try {
    const url = new URL(value)
    let pathname = url.pathname.replace(/\/+$/, '')
    pathname = pathname.replace(/\/(?:models\/[^/]+:(?:streamGenerateContent|generateContent)|chat\/completions|responses|messages|interactions|models)$/i, '')
    if (!pathname && defaultVersion) pathname = `/${defaultVersion}`
    url.pathname = `${pathname}/${operation}`
    url.hash = ''
    return url.toString()
  } catch {
    return `${value.replace(/\/+$/, '')}/${operation}`
  }
}

export function isLocalAiProvider(baseUrl: unknown): boolean {
  try { return isLocalDevelopmentHost(new URL(String(baseUrl ?? '').trim()).hostname) } catch { return false }
}

export function isAiProviderKeyConfigured(settings: Pick<AiEndpointSettings, 'baseUrl'> & { apiKey?: unknown }): boolean {
  return Boolean(String(settings.apiKey ?? '').trim()) || isLocalAiProvider(settings.baseUrl)
}

export function isAiProviderConfigured(settings: AiEndpointSettings & { apiKey?: unknown }): boolean {
  return Boolean(String(settings.model ?? '').trim()) && !getAiProviderBaseUrlIssue(settings.baseUrl) && isAiProviderKeyConfigured(settings)
}

function isOfficialOpenAiProvider(baseUrl: unknown): boolean {
  try { return new URL(String(baseUrl ?? '')).hostname.toLowerCase() === 'api.openai.com' } catch { return false }
}

function isAzureAiProvider(baseUrl: unknown): boolean {
  try {
    return /\.(?:openai\.azure\.com|services\.ai\.azure\.com)$/i.test(new URL(String(baseUrl ?? '')).hostname)
  } catch { return false }
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
export type AiApiStyle = 'auto' | 'responses' | 'chat_completions' | 'anthropic_messages' | 'gemini' | 'gemini_interactions'
export type ResolvedAiApiStyle = Exclude<AiApiStyle, 'auto'>

export interface AiEndpointSettings {
  baseUrl?: unknown
  apiStyle?: unknown
  model?: unknown
}

export function normalizeAiApiStyle(value: unknown, fallback: AiApiStyle = 'auto'): AiApiStyle {
  return ['auto', 'responses', 'chat_completions', 'anthropic_messages', 'gemini', 'gemini_interactions'].includes(String(value))
    ? value as AiApiStyle : fallback
}
