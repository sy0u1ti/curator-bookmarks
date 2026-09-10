import type { AvailabilityResult, BookmarkRecord, NavigationAttempt, ProbeResult } from '../../shared/types.js'
import { hasVerifiedHttpFailure } from '../../shared/availability-evidence.js'
import { buildFailureClassification, buildNavigationSuccess, isUnverifiedAvailabilityErrorCode, shouldAcceptNavigationSuccess, shouldRetryNavigation } from './classifier.js'
import type { AvailabilityTimeoutPolicy } from './availability-runner.js'

export interface AvailabilityInspectionOptions {
  timeouts: AvailabilityTimeoutPolicy
  navigate: (url: string, timeoutMs: number) => Promise<NavigationAttempt>
  resolveRedirect: (url: string, attempt: NavigationAttempt) => Promise<string>
  probe?: (url: string, timeoutMs: number) => Promise<ProbeResult>
  ready: (url: string) => Promise<boolean>
  isActive?: () => boolean
  now?: () => number
}

/** The budget measures actual request time. Explicit user pauses and rate-limit
 * waits do not turn unfinished bookmarks into timeout failures. */
export async function inspectAvailabilityWithEvidence(bookmark: BookmarkRecord, options: AvailabilityInspectionOptions): Promise<AvailabilityResult | null> {
  const { timeouts, navigate, resolveRedirect, probe, ready, isActive = () => true, now = Date.now } = options
  let remainingMs = timeouts.navigationTimeoutMs + timeouts.retryNavigationTimeoutMs + (probe ? timeouts.probeTimeoutMs : 0)
  const attempts: NavigationAttempt[] = []
  let budgetExhausted = false
  const runNavigation = async (url: string, stageTimeout: number): Promise<NavigationAttempt | null> => {
    if (!isActive() || !(await ready(url)) || !isActive()) return null
    if (remainingMs < 1000) { budgetExhausted = true; return null }
    const startedAt = now()
    let result: NavigationAttempt
    try { result = await navigate(url, Math.min(stageTimeout, remainingMs)) }
    finally { remainingMs -= Math.max(0, now() - startedAt) }
    if (!isActive()) return null
    attempts.push(result)
    return result
  }
  const exhaustedResult = (): AvailabilityResult => ({
    ...buildFailureClassification(bookmark, attempts, null, false),
    status: 'review', badgeText: '检测超时·待复核', errorCode: 'detection-budget-exhausted',
    detail: '本条书签的检测预算已用尽，重定向和重试不会增加额外预算。可稍后单独复测。'
  })
  const terminalResult = (attempt: NavigationAttempt, label: string): AvailabilityResult | null => {
    if (shouldAcceptNavigationSuccess(attempt)) return buildNavigationSuccess(bookmark, attempt, label)
    // The actual main-document GET already supplied the relevant HTTP evidence.
    if (hasVerifiedHttpFailure(attempt)) return buildFailureClassification(bookmark, attempts, null, false)
    return null
  }
  let activeUrl = bookmark.url
  let navigation = await runNavigation(activeUrl, timeouts.navigationTimeoutMs)
  if (!navigation) return budgetExhausted ? exhaustedResult() : null
  let result = terminalResult(navigation, '后台主请求验证成功')
  if (result) return result
  const visited = new Set([requestIdentity(activeUrl)])
  for (let hop = 0; hop < 4; hop += 1) {
    const target = await resolveRedirect(activeUrl, navigation)
    if (!isActive()) return null
    if (!target) break
    const key = requestIdentity(target)
    if (visited.has(key)) return {
      ...buildFailureClassification(bookmark, attempts, null, false), status: 'review',
      badgeText: '重定向循环', errorCode: 'redirect-loop', detail: '重定向回到了本轮已验证的地址，已停止循环访问。'
    }
    visited.add(key)
    activeUrl = target
    navigation = await runNavigation(activeUrl, timeouts.retryNavigationTimeoutMs)
    if (!navigation) return budgetExhausted ? exhaustedResult() : null
    result = terminalResult(navigation, '站内重定向验证成功')
    if (result) return result
  }
  if (shouldRetryNavigation(navigation)) {
    navigation = await runNavigation(activeUrl, timeouts.retryNavigationTimeoutMs)
    if (!navigation) return budgetExhausted ? exhaustedResult() : null
    result = terminalResult(navigation, '重试后台主请求验证成功')
    if (result) return result
  }
  // A denied target, an offline machine, or a local certificate/proxy failure
  // cannot be repaired by issuing another request to the same bookmark.
  const shouldProbe = probe && !isUnverifiedAvailabilityErrorCode(navigation.errorCode) &&
    !/ERR_(?:INTERNET_DISCONNECTED|NETWORK_CHANGED|PROXY_|TUNNEL_|MANDATORY_PROXY_|BLOCKED_BY_ADMINISTRATOR|CERT_|SSL_)/.test(navigation.errorCode)
  let probeResult: ProbeResult | null = null
  if (shouldProbe) {
    if (!isActive() || !(await ready(bookmark.url)) || !isActive()) return null
    if (remainingMs < 1000) return exhaustedResult()
    probeResult = await probe!(bookmark.url, Math.min(timeouts.probeTimeoutMs, remainingMs))
    if (!isActive()) return null
  }
  return buildFailureClassification(bookmark, attempts, probeResult, Boolean(shouldProbe))
}

function requestIdentity(url: string): string {
  try { const parsed = new URL(url); parsed.hash = ''; return parsed.href } catch { return url }
}

/** Reuse successful evidence only within this run. Failures are not cached.
 * Exact URL keys preserve query order, paths, and client-side hash routes. */
export function createAvailabilityEvidenceCache(capacity = 512) {
  const entries = new Map<string, Promise<AvailabilityResult | null>>()
  const limit = Math.max(1, Math.min(4096, Math.round(Number(capacity) || 512)))
  return {
    async inspect(bookmark: BookmarkRecord, inspect: () => Promise<AvailabilityResult | null>): Promise<AvailabilityResult | null> {
      const key = bookmark.url
      let pending = entries.get(key)
      if (!pending) {
        pending = Promise.resolve().then(inspect)
        if (entries.size >= limit) entries.delete(entries.keys().next().value!)
        entries.set(key, pending)
        const current = pending
        void pending.then((result) => {
          if ((!result || result.status !== 'available' && result.status !== 'redirected') && entries.get(key) === current) entries.delete(key)
        }, () => { if (entries.get(key) === current) entries.delete(key) })
      } else {
        entries.delete(key)
        entries.set(key, pending)
      }
      const result = await pending
      // Metadata always belongs to this bookmark, even when URLs are duplicated.
      if (!result) return null
      const { status, badgeText, finalUrl, detail, errorCode } = result
      return { ...bookmark, status, badgeText, finalUrl, detail, errorCode }
    }
  }
}

export function buildDeferredAvailabilityResult(bookmark: BookmarkRecord, retryAfterMs: number): AvailabilityResult {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
  return { ...bookmark, status: 'review', finalUrl: bookmark.url, badgeText: '站点限流·暂缓', errorCode: 'site-cooldown',
    detail: '同站点已连续限流或要求较长等待，本条未再次访问。约 ' + seconds + ' 秒后可单独复测，不计入失效证据。' }
}
