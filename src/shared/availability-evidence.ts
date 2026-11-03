import type { NavigationAttempt, NavigationNetworkEvidence } from './types.js'
import { isAuthenticationEntryUrl, isAuthenticationExitUrl } from './sensitive-url.js'

export function isHttpRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

export function parseAvailabilityRetryAfter(value: unknown, now = Date.now()): number | undefined {
  const text = String(value ?? '').trim()
  if (!text || text.length > 128) return undefined
  const seconds = Number(text)
  if (Number.isFinite(seconds)) return seconds >= 0 ? Math.min(Math.ceil(seconds * 1000), 86400000) : undefined
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? Math.max(0, Math.min(timestamp - now, 86400000)) : undefined
}

export function readAvailabilityResponseHeaders(headers: Array<{ name: string; value?: string }> = [], now = Date.now(), statusCode = 0) {
  let contentType = ''
  let attachment = false
  let challenge = false
  let viaJiasule = false
  let retryAfterMs: number | undefined
  for (const header of headers) {
    const name = header.name.toLowerCase()
    if (name === 'content-type') contentType = String(header.value || '').split(';', 1)[0].trim().toLowerCase().slice(0, 160)
    else if (name === 'content-disposition') attachment = /^attachment(?:\s*;|$)/i.test(String(header.value || '').trim())
    else if (name === 'retry-after') retryAfterMs = parseAvailabilityRetryAfter(header.value, now)
    else if (name === 'cf-mitigated') challenge = String(header.value || '').trim().toLowerCase() === 'challenge'
    else if (name === 'x-via-jsl') viaJiasule = Boolean(String(header.value || '').trim())
  }
  // Jiasule's browser check uses 521 before a script-driven reload, unlike a plain origin 521.
  challenge ||= statusCode === 521 && viaJiasule
  return { contentType, attachment, challenge, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) }
}

export function shouldWaitForNavigationChallenge(evidence: NavigationNetworkEvidence | null | undefined, challengeSeen: boolean): boolean {
  if (evidence?.challenge) return true
  // A delayed DOM event from the challenge must not settle the replacement request before its headers.
  return challengeSeen && evidence?.finalResponseObserved !== true
}

/** A final HTTP error needs no error-page body. No-content and binary resources
 * can be verified without waiting for a document event or downloading a file. */
export function getNavigationHeaderOutcome(status: number, metadata: { contentType?: string; attachment?: boolean; challenge?: boolean }) {
  // A browser challenge is an intermediate document, not the destination's verdict.
  if (metadata.challenge) return null
  if (status === 401) return {
    status: 'available' as const, errorCode: '',
    detail: '主请求已返回 HTTP 401；网站正常响应，需要登录。'
  }
  if (status >= 400 && status <= 599) return {
    status: 'failed' as const, errorCode: 'http-' + status,
    detail: '主请求已返回 HTTP ' + status + '，无需等待错误页加载。'
  }
  if (status >= 200 && status < 300 && (status === 204 || status === 205 || metadata.attachment ||
    /^(?:image\/|audio\/|video\/|application\/(?:pdf|zip|gzip|octet-stream|x-7z-compressed|x-rar-compressed)$)/.test(metadata.contentType || ''))) {
    return { status: 'available' as const, errorCode: '', detail: '目标资源已返回 HTTP ' + status + '，已停止继续加载正文。' }
  }
  return null
}

export function hasVerifiedLoginRequirement(attempt: NavigationAttempt | null | undefined, observedTarget = ''): boolean {
  const evidence = attempt?.networkEvidence
  if (!evidence?.requestSent || evidence.challenge ||
    /^(?:cancelled|permission-missing|sensitive-url|private-network-endpoint)$/.test(attempt?.errorCode || '')) return false

  const status = Number(evidence.statusCode)
  if (status === 401) return evidence.finalResponseObserved === true
  const redirect = evidence.redirects?.at(-1)
  const target = observedTarget || redirect?.redirectUrl || evidence.finalUrl || attempt?.finalUrl
  const loginEntry = isAuthenticationEntryUrl(target)
  if (!loginEntry && !isAuthenticationExitUrl(target, evidence.statusUrl || evidence.requestedUrl)) return false
  if (loginEntry && (status >= 200 && status < 300 || status === 304) && evidence.finalResponseObserved === true) return true
  // A real authentication redirect proves the site responded, without entering its account flow.
  return Boolean(redirect && isHttpRedirectStatus(status) && redirect.statusCode === status &&
    redirect.url === (evidence.statusUrl || evidence.requestedUrl) && redirect.redirectUrl === target)
}

export function hasVerifiedHttpFailure(attempt: NavigationAttempt | null | undefined): boolean {
  const evidence = attempt?.networkEvidence
  return Boolean(evidence?.requestSent && evidence.finalResponseObserved === true &&
    !evidence.challenge &&
    evidence.statusCode !== 401 &&
    Number(evidence.statusCode) >= 400 && Number(evidence.statusCode) <= 599 &&
    !/redirect|permission|sensitive|private|cancelled/.test(String(attempt?.errorCode || '')))
}

export function extractAvailabilityHttpStatus(value: unknown): number {
  const text = String(value || '')
  const match = text.match(/\b(?:HTTP(?:\/\d+(?:\.\d+)?\s+|[\s-]+)|status(?:_?code)?\s*[:=]?\s*)([1-5][0-9]{2})\b/i)
  return match ? Number(match[1]) : 0
}
