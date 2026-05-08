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
