import assert from 'node:assert/strict'
import { buildDeferredAvailabilityResult, createAvailabilityEvidenceCache, inspectAvailabilityWithEvidence } from './availability-pipeline.js'
import { createAvailabilityRunScheduler, runAvailabilityQueue } from './availability-runner.js'
import { buildFailureClassification, classifyAvailabilityProbeResult, getSafeAvailabilityRedirectUrl, isRedirectedNavigation, isUnverifiedAvailabilityErrorCode, requireRepeatedFailureEvidence, shouldAcceptNavigationSuccess, shouldFallbackToGet } from './classifier.js'
import { extractAvailabilityHttpStatus, getNavigationHeaderOutcome, hasVerifiedHttpFailure, hasVerifiedLoginRequirement, isHttpRedirectStatus, parseAvailabilityRetryAfter, readAvailabilityResponseHeaders, shouldWaitForNavigationChallenge } from '../../shared/availability-evidence.js'
import { buildAvailabilityDeletionRequest, collectAvailabilityPermissionOrigins, getAvailabilityRetestLabel } from './availability-actions.js'
import { finalizeAvailabilityHistoryRun } from './history.js'
import { assertAvailabilityEngineReady, cancelNavigationCheck, requestNavigationCheck, requestAvailabilityProbe } from '../../shared/messages.js'
import type { AvailabilityResult, BookmarkRecord, NavigationAttempt } from '../../shared/types.js'

const bookmark = (id = '1', url = 'https://example.net/page'): BookmarkRecord => ({
  id, url, title: 'Bookmark ' + id, displayUrl: url, normalizedTitle: 'bookmark ' + id, normalizedUrl: url,
  duplicateKey: url, domain: new URL(url).hostname, path: 'Bookmarks / ' + id, ancestorIds: ['1'], parentId: '1', index: 0, dateAdded: 1
})
const navigation = (statusCode = 200, overrides: Partial<NavigationAttempt> = {}): NavigationAttempt => ({
  status: statusCode >= 400 ? 'failed' : 'available', finalUrl: 'https://example.net/page',
  detail: 'HTTP ' + statusCode, errorCode: statusCode >= 400 ? 'http-' + statusCode : '',
  networkEvidence: { requestSent: true, requestedUrl: 'https://example.net/page', statusCode,
    finalResponseObserved: true, redirects: [], timing: {} }, ...overrides
})
const failure = (errorCode: string): NavigationAttempt => ({ status: 'failed', finalUrl: 'https://example.net/page', errorCode, detail: errorCode })
const healthy = (item: BookmarkRecord): AvailabilityResult => ({ ...item, status: 'available', finalUrl: item.url, detail: 'verified', badgeText: 'available' })
const timeouts = { navigationTimeoutMs: 5000, retryNavigationTimeoutMs: 7000, probeTimeoutMs: 4000 }
const tests: Array<[string, () => void | Promise<void>]> = []
const test = (name: string, run: () => void | Promise<void>) => tests.push([name, run])
function gate<T = void>() { let resolve!: (value: T | PromiseLike<T>) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }

for (const status of [400, 401, 403, 404, 410, 429, 500, 503, 521, 599]) test('final HTTP ' + status + ' needs one navigation and no fallback request', async () => {
  let navigations = 0
  let probes = 0
  const result = await inspectAvailabilityWithEvidence(bookmark(), {
    timeouts, ready: async () => true, navigate: async () => { navigations++; return navigation(status) },
    resolveRedirect: async () => { throw Error('HTTP verdict must finish first') },
    probe: async () => { probes++; throw Error('unnecessary probe') }
  })
  assert.equal(navigations, 1)
  assert.equal(probes, 0)
  assert.equal(result?.status, status === 401 ? 'available' : [404, 410].includes(status) ? 'failed' : 'review',
    'authentication is normal; actual missing pages fail, while other restrictions and server faults remain reviewable')
  assert.match(result!.detail, new RegExp(String(status)))
})

test('verified login redirects are normal, preserve the bookmark and stop before further requests', async () => {
  for (const errorCode of ['', 'login-required', 'sensitive-redirect', 'ungranted-redirect']) {
    const item = bookmark()
    const target = 'https://identity.example.org/oauth/authorize?SAMLRequest=fixture'
    const attempt: NavigationAttempt = {
      ...failure(errorCode), finalUrl: item.url,
      networkEvidence: { requestSent: true, requestedUrl: item.url, statusUrl: item.url, finalUrl: target,
        statusCode: 302, finalResponseObserved: false,
        redirects: [{ url: item.url, redirectUrl: target, statusCode: 302 }], timing: {} }
    }
    assert.equal(hasVerifiedLoginRequirement(attempt), true)
    const result = await inspectAvailabilityWithEvidence(item, {
      timeouts, ready: async () => true, navigate: async () => attempt,
      resolveRedirect: async () => { throw Error('login is not a bookmark migration') },
      probe: async () => { throw Error('a responding login gate needs no fallback') }
    })
    assert.equal(result?.status, 'available')
    assert.equal(result?.requiresLogin, true)
    assert.equal(result?.finalUrl, item.url)
    assert.equal(result?.errorCode, undefined)
    assert.equal(buildAvailabilityDeletionRequest([result!]), null, 'normal login pages never become cleanup candidates')
  }
  assert.equal(isUnverifiedAvailabilityErrorCode('login-required'), false)
})

test('HTTP 401 and loaded login pages are healthy without logging in or changing the saved URL', () => {
  const direct = navigation(200, { finalUrl: 'https://example.net/login' })
  direct.networkEvidence!.finalUrl = direct.finalUrl
  const domOnly = { ...direct, networkEvidence: undefined }
  for (const attempt of [navigation(401), direct, domOnly]) {
    const result = buildFailureClassification(bookmark(), [attempt], null, false)
    assert.equal(shouldAcceptNavigationSuccess(attempt), true)
    assert.equal(result.status, 'available')
    assert.equal(result.requiresLogin, true)
    assert.equal(result.finalUrl, bookmark().url)
    assert.equal(result.verifiedFailure, undefined)
  }
  assert.equal(getNavigationHeaderOutcome(401, {})?.status, 'available')
  assert.equal(hasVerifiedHttpFailure(navigation(401)), false)
  assert.equal(shouldFallbackToGet(401), false, 'an anonymous HEAD login requirement does not need a GET')
  const previousFailure: AvailabilityResult = {
    ...bookmark(), status: 'failed', finalUrl: bookmark().url, detail: 'old failure', badgeText: 'old',
    errorCode: 'http-404', verifiedFailure: 'http-missing', historyStatus: 'persistent', abnormalStreak: 3
  }
  const retested = buildFailureClassification(previousFailure, [navigation(401)], null, false)
  assert.equal(retested.errorCode, undefined)
  assert.equal(retested.verifiedFailure, undefined)
  assert.equal(retested.abnormalStreak, 0)
})

test('a verified session-refresh handshake is normal without following or storing its token URL', async () => {
  const item = bookmark('session', 'https://app.example.net/keys')
  const target = 'https://session.example.org/v1/client/handshake?redirect_url=https%3A%2F%2Fapp.example.net%2Fkeys&__clerk_api_version=2026-05-12&__session=fixture'
  const attempt: NavigationAttempt = {
    ...failure('sensitive-redirect'), finalUrl: item.url,
    networkEvidence: { requestSent: true, requestedUrl: item.url, statusUrl: item.url, finalUrl: target,
      statusCode: 307, finalResponseObserved: false,
      redirects: [{ url: item.url, redirectUrl: target, statusCode: 307 }], timing: {} }
  }
  const result = await inspectAvailabilityWithEvidence(item, {
    timeouts, ready: async () => true, navigate: async () => attempt,
    resolveRedirect: async () => { throw Error('session refresh is not a bookmark migration') },
    probe: async () => { throw Error('the token-bearing target must not be requested') }
  })
  assert.equal(result?.status, 'available')
  assert.equal(result?.finalUrl, item.url)
  assert.equal(buildAvailabilityDeletionRequest([result!]), null)
  assert.equal(JSON.stringify(result).includes('__session'), false)
  assert.equal(hasVerifiedLoginRequirement({ ...failure('ungranted-redirect'), finalUrl: target }), false,
    'a handshake-looking URL alone does not prove any response')
})

test('a responding same-site session-expiry redirect is normal without executing logout', async () => {
  const item = bookmark('expired', 'https://example.net/orders')
  const target = 'https://example.net/logout'
  const attempt: NavigationAttempt = {
    ...failure('sensitive-redirect'), finalUrl: item.url,
    networkEvidence: { requestSent: true, requestedUrl: item.url, statusUrl: item.url, finalUrl: target,
      statusCode: 302, finalResponseObserved: false,
      redirects: [{ url: item.url, redirectUrl: target, statusCode: 302 }], timing: {} }
  }
  const result = await inspectAvailabilityWithEvidence(item, {
    timeouts, ready: async () => true, navigate: async () => attempt,
    resolveRedirect: async () => { throw Error('logout must not execute') }
  })
  assert.equal(result?.status, 'available')
  assert.equal(result?.finalUrl, item.url)
  assert.equal(buildAvailabilityDeletionRequest([result!]), null)
  assert.equal(hasVerifiedLoginRequirement({ ...failure('sensitive-redirect'), finalUrl: target }), false)
})

test('HTTP upgrades and known safe redirects are requested together without broadening permission scope', () => {
  const item = bookmark('http', 'http://original.example.net/article')
  const other = bookmark('https', 'https://same.example.net/page')
  const result = { ...healthy(item), status: 'review' as const, errorCode: 'ungranted-redirect', finalUrl: 'https://moved.example.org/article' }
  const origins = collectAvailabilityPermissionOrigins([item, other], [result, result])
  assert.deepEqual(origins, [
    'http://original.example.net/*', 'https://moved.example.org/*',
    'https://original.example.net/*', 'https://same.example.net/*'
  ])
  assert.equal(origins.some(origin => origin.includes('*://') || origin.includes('://*')), false)
})

test('permission planning never includes stale, out-of-scope, unsafe or session-bearing destinations', () => {
  const item = bookmark('current')
  const base = { ...healthy(item), errorCode: 'ungranted-redirect' }
  const results = [
    { ...base, url: 'https://edited.example.net/old', finalUrl: 'https://stale.example.net/' },
    { ...base, id: 'outside', finalUrl: 'https://outside.example.net/' },
    { ...base, finalUrl: 'http://downgrade.example.net/' },
    { ...base, finalUrl: 'https://other.example.net/logout' },
    { ...base, finalUrl: 'http://127.0.0.1/' },
    { ...base, finalUrl: 'https://session.example.org/v1/client/handshake?__session=fixture' }
  ]
  assert.deepEqual(collectAvailabilityPermissionOrigins([item], results), ['https://example.net/*'])
})

test('URL-only login hints, blocked requests and challenge pages never invent a successful response', () => {
  const noResponse = failure('login-required')
  const noRequest = navigation(401)
  noRequest.networkEvidence!.requestSent = false
  const unfinished = navigation(401)
  unfinished.networkEvidence!.finalResponseObserved = false
  const challenge = navigation(401)
  challenge.networkEvidence!.challenge = true
  const urlOnly = { ...failure('ungranted-redirect'), finalUrl: 'https://example.net/login' }
  const cancelled = navigation(401, { errorCode: 'cancelled' })
  const missing = navigation(404, { finalUrl: 'https://example.net/login' })
  for (const attempt of [noResponse, noRequest, unfinished, challenge, urlOnly, cancelled, missing]) {
    assert.equal(hasVerifiedLoginRequirement(attempt), false)
    assert.equal(shouldAcceptNavigationSuccess(attempt), false)
    if (attempt === challenge) continue
    const result = buildFailureClassification(bookmark(), [attempt], null, false)
    assert.notEqual(result.status, 'available')
    assert.equal(result.requiresLogin, undefined)
  }
  const gate = buildFailureClassification(bookmark(), [challenge], null, false)
  assert.equal(gate.requiresLogin, undefined, 'a responding challenge is not a login requirement')
  assert.equal(buildFailureClassification(bookmark(), [noResponse], null, false).errorCode, 'unverified-network-endpoint')
})

test('independent authentication responses count as available but denied probes cannot supply that evidence', () => {
  for (const method of ['HEAD', 'GET']) {
    for (const status of [401, 302]) {
      const probe = classifyAvailabilityProbeResult({
        ok: status === 302, status, finalUrl: bookmark().url, redirected: false, errorCode: '',
        detail: 'HTTP ' + status, ...(status === 302 ? { requiresLogin: true } : {})
      }, method)
      for (const errorCode of ['timeout', 'net::ERR_BLOCKED_BY_CLIENT']) {
        const result = buildFailureClassification(bookmark(), [failure(errorCode)], probe, true)
        assert.equal(result.status, 'available')
        assert.equal(result.requiresLogin, true)
        assert.equal(result.finalUrl, bookmark().url)
      }
    }
  }
  const blocked = classifyAvailabilityProbeResult({
    ok: false, status: 401, finalUrl: bookmark().url, redirected: false, errorCode: 'permission-missing',
    detail: 'Not requested', requiresLogin: true
  }, 'HEAD')
  assert.equal(buildFailureClassification(bookmark(), [failure('permission-missing')], blocked, true).status, 'review')
})

test('login availability survives duplicate caching and recovers old abnormal history without deletion', async () => {
  const cache = createAvailabilityEvidenceCache()
  const item = bookmark()
  const first = await cache.inspect(item, async () => buildFailureClassification(item, [navigation(401)], null, false))
  const cached = await cache.inspect(bookmark('duplicate'), async () => { throw Error('same-run success should be reused') })
  assert.equal(cached?.requiresLogin, true)
  assert.equal(cached?.status, 'available')
  assert.equal(cached?.id, 'duplicate')
  const history = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarks: new Map([[item.id, first!.url]]), currentEntries: [],
    previousEntries: [{ ...item, status: 'review', streak: 3 }], completedAt: 1234
  })
  assert.equal(history.summary.totalAbnormal, 0)
  assert.equal(history.summary.recoveredCount, 1)
  assert.equal(history.recoveredResults[0].id, item.id)
  assert.equal(buildAvailabilityDeletionRequest([first!, cached!]), null)
})

test('resolved redirect and unsupported optional DNS do not erase real HTTP evidence', () => {
  const redirected = failure('ungranted-redirect')
  redirected.finalUrl = 'https://example.net/target'
  const result = buildFailureClassification(bookmark(), [redirected, navigation(404)], {
    kind: 'unknown', method: 'HEAD', label: 'unsupported', detail: 'DNS API unavailable', errorCode: 'unsupported-dns-boundary'
  }, true)
  assert.equal(result.badgeText, '页面不存在')
  assert.equal(result.verifiedFailure, 'http-missing')
  assert.match(result.detail, /404/)
})

test('error-body interruption preserves a verified final HTTP status', () => {
  const attempt = navigation(503, { errorCode: 'net::ERR_CONNECTION_RESET' })
  attempt.networkEvidence!.errorCode = 'net::ERR_CONNECTION_RESET'
  const result = buildFailureClassification(bookmark(), [attempt], null, false)
  assert.equal(result.badgeText, '临时异常')
})

test('offline, proxy and TLS failures remain reviewable and skip redundant probes', async () => {
  for (const code of ['net::ERR_INTERNET_DISCONNECTED', 'net::ERR_PROXY_CONNECTION_FAILED', 'net::ERR_TUNNEL_CONNECTION_FAILED', 'net::ERR_CERT_AUTHORITY_INVALID', 'net::ERR_SSL_PROTOCOL_ERROR']) {
    const result = await inspectAvailabilityWithEvidence(bookmark(), {
      timeouts, ready: async () => true, navigate: async () => failure(code), resolveRedirect: async () => '',
      probe: async () => { throw Error('local environment failure should not trigger another request') }
    })
    assert.equal(result?.status, 'review')
    assert.match(result!.badgeText, /网络环境|证书/)
    const repeated = buildFailureClassification(bookmark(), [failure(code), failure(code)], { kind: 'network', method: 'GET', label: 'network', detail: 'network' }, true)
    assert.equal(repeated.status, 'review')
  }
})

test('response headers distinguish HTML, no-content, attachments and HTTP errors', () => {
  const metadata = readAvailabilityResponseHeaders([
    { name: 'Content-Type', value: 'APPLICATION/PDF; charset=binary' },
    { name: 'Content-Disposition', value: 'attachment; filename="file.pdf"' },
    { name: 'Retry-After', value: '1.5' }
  ])
  assert.deepEqual(metadata, { contentType: 'application/pdf', attachment: true, challenge: false, retryAfterMs: 1500 })
  assert.equal(getNavigationHeaderOutcome(200, metadata)?.status, 'available')
  assert.equal(getNavigationHeaderOutcome(403, metadata)?.status, 'failed')
  assert.equal(getNavigationHeaderOutcome(204, {})?.status, 'available')
  assert.equal(getNavigationHeaderOutcome(200, { contentType: 'text/html' }), null)
  assert.equal(getNavigationHeaderOutcome(200, { contentType: 'application/xhtml+xml' }), null)
  assert.equal(isHttpRedirectStatus(304), false)
  assert.equal(isHttpRedirectStatus(302), true)
  assert.equal(shouldAcceptNavigationSuccess(navigation(304)), true)
})

test('intermediate browser challenges are not terminal HTTP verdicts or successful DOM loads', () => {
  for (const status of [200, 401, 403, 503]) {
    const metadata = readAvailabilityResponseHeaders([{ name: 'CF-Mitigated', value: 'challenge' }], 0, status)
    assert.equal(metadata.challenge, true)
    assert.equal(getNavigationHeaderOutcome(status, metadata), null)
    const attempt = navigation(status)
    Object.assign(attempt.networkEvidence!, metadata)
    assert.equal(hasVerifiedHttpFailure(attempt), false)
    assert.equal(shouldAcceptNavigationSuccess(attempt), false)
    assert.equal(shouldWaitForNavigationChallenge(attempt.networkEvidence, true), true)
    const result = buildFailureClassification(bookmark(), [attempt], null, false)
    assert.equal(result.status, 'available', 'a CDN challenge response proves the site is online')
    assert.equal(result.errorCode, undefined)
    assert.equal(result.finalUrl, bookmark().url)
  }
  const unobserved = buildFailureClassification(bookmark(), [failure('challenge-required')], null, false)
  assert.equal(unobserved.status, 'review', 'a challenge without an observed response proves nothing')
  assert.equal(isUnverifiedAvailabilityErrorCode(unobserved.errorCode), true)
  const jiasule = readAvailabilityResponseHeaders([{ name: 'X-Via-JSL', value: 'fixture,-' }], 0, 521)
  assert.equal(jiasule.challenge, true, 'observed Jiasule 521 browser checks need time for the reload')
  assert.equal(getNavigationHeaderOutcome(521, jiasule), null)
  assert.equal(readAvailabilityResponseHeaders([{ name: 'X-Via-JSL', value: 'fixture,-' }], 0, 200).challenge, false)
  assert.equal(getNavigationHeaderOutcome(521, readAvailabilityResponseHeaders([], 0, 521))?.status, 'failed',
    'a plain origin 521 is not invented into a challenge')
  assert.equal(shouldWaitForNavigationChallenge({ requestSent: true, requestedUrl: bookmark().url, redirects: [], timing: {} }, true), true)
  assert.equal(shouldWaitForNavigationChallenge(navigation().networkEvidence, true), false)
})

test('challenge completion is healthy; an unresolved challenge never triggers anonymous fallback', async () => {
  const confirmed = await inspectAvailabilityWithEvidence(bookmark(), {
    timeouts, ready: async () => true, resolveRedirect: async () => '',
    navigate: async () => navigation()
  })
  assert.equal(confirmed?.status, 'available')
  const unresolved = navigation(403, { errorCode: 'challenge-required' })
  unresolved.networkEvidence!.challenge = true
  const pending = await inspectAvailabilityWithEvidence(bookmark(), {
    timeouts, ready: async () => true, navigate: async () => unresolved,
    resolveRedirect: async () => { throw Error('challenge should not be treated as a redirect') },
    probe: async () => { throw Error('an anonymous probe cannot complete a browser challenge') }
  })
  assert.equal(pending?.status, 'available')
})

test('safe authorized cross-origin hops reach a verified result but denied hops remain pending', async () => {
  const item = bookmark()
  const canonical = 'https://canonical.example.org/page'
  for (const granted of [true, false]) {
    const visited: string[] = []
    const result = await inspectAvailabilityWithEvidence(item, {
      timeouts, ready: async () => true,
      navigate: async url => {
        visited.push(url)
        return url === item.url ? { ...failure('ungranted-redirect'), finalUrl: canonical } : navigation(200, { finalUrl: url })
      },
      resolveRedirect: async (url, attempt) => {
        const candidate = getSafeAvailabilityRedirectUrl(url, attempt)
        return granted ? candidate : ''
      },
      probe: async () => { throw Error('redirect permissions cannot be bypassed by probing') }
    })
    assert.equal(result?.status, granted ? 'redirected' : 'review')
    assert.deepEqual(visited, granted ? [item.url, canonical] : [item.url])
    if (!granted) assert.equal(result?.errorCode, 'ungranted-redirect')
  }
})

test('two real connection failures remain actionable when optional DNS is unavailable', async () => {
  for (const errorCode of ['net::ERR_CONNECTION_CLOSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_REFUSED', 'net::ERR_NAME_NOT_RESOLVED', 'net::ERR_ADDRESS_UNREACHABLE']) {
    let calls = 0
    const result = await inspectAvailabilityWithEvidence(bookmark(), {
      timeouts, ready: async () => true, resolveRedirect: async () => '',
      navigate: async () => {
        calls++
        return { ...failure(errorCode), networkEvidence: { requestSent: true, requestedUrl: bookmark().url,
          errorCode, redirects: [], timing: {} } }
      },
      probe: async () => { throw Error('the optional DNS API is not required for two actual navigation failures') }
    })
    assert.equal(calls, 2)
    assert.equal(result?.status, 'failed')
    assert.equal(result?.verifiedFailure, 'repeated-network')
    assert.equal(requireRepeatedFailureEvidence(result!, false).status, 'failed')
  }
  const mixed = buildFailureClassification(bookmark(), [failure('net::ERR_CONNECTION_RESET'), failure('net::ERR_CONNECTION_CLOSED')], null, false)
  assert.equal(mixed.status, 'review', 'uncorrelated failures without actual request evidence stay reviewable')
  const timeoutsOnly = buildFailureClassification(bookmark(), [failure('timeout'), failure('timeout')], null, false)
  assert.equal(timeoutsOnly.status, 'review')
})

test('a responding server redirect to an ungranted target is a redirect, not an availability fault', async () => {
  const item = bookmark('moved', 'https://old.example.net/app?page=2')
  const target = 'https://new.example.org/app?page=2'
  const blocked: NavigationAttempt = {
    ...failure('ungranted-redirect'), finalUrl: target,
    networkEvidence: { requestSent: true, requestedUrl: item.url, statusUrl: item.url, finalUrl: target, statusCode: 301,
      finalResponseObserved: false, redirects: [{ url: item.url, redirectUrl: target, statusCode: 301 }], timing: {} }
  }
  let navigations = 0
  const result = await inspectAvailabilityWithEvidence(item, {
    timeouts, ready: async () => true, navigate: async () => { navigations++; return blocked },
    resolveRedirect: async () => '',
    probe: async () => { throw Error('an observed redirect needs no anonymous probe') }
  })
  assert.equal(navigations, 1)
  assert.equal(result?.status, 'redirected')
  assert.equal(result?.finalUrl, target)
  assert.equal(result?.errorCode, undefined)
  assert.equal(buildAvailabilityDeletionRequest([result!]), null)
  const scriptOnly = buildFailureClassification(item, [{ ...failure('ungranted-redirect'), finalUrl: target }], null, false)
  assert.equal(scriptOnly.status, 'review', 'without an observed response, the source server is not verified')
})

test('a server redirect into a protected billing page proves the bookmark responds without requesting it', async () => {
  const item = bookmark('console', 'https://console.example.net/settings/plans')
  const moved = 'https://platform.example.org/settings/plans'
  const billing = 'https://platform.example.org/settings/billing'
  const result = await inspectAvailabilityWithEvidence(item, {
    timeouts, ready: async () => true,
    navigate: async url => url === item.url
      ? { ...failure('ungranted-redirect'), finalUrl: moved, networkEvidence: { requestSent: true, requestedUrl: url, statusUrl: url,
        finalUrl: moved, statusCode: 301, finalResponseObserved: false, redirects: [{ url, redirectUrl: moved, statusCode: 301 }], timing: {} } }
      : { ...failure('sensitive-redirect'), finalUrl: url, networkEvidence: { requestSent: true, requestedUrl: url, statusUrl: url,
        finalUrl: billing, statusCode: 307, finalResponseObserved: false, redirects: [{ url, redirectUrl: billing, statusCode: 307 }], timing: {} } },
    resolveRedirect: async (url, attempt) => getSafeAvailabilityRedirectUrl(url, attempt),
    probe: async () => { throw Error('the protected target must not be requested') }
  })
  assert.equal(result?.status, 'redirected')
  assert.equal(result?.finalUrl, moved, 'only the verified safe hop is offered, never the billing target')
  assert.equal(result?.errorCode, undefined)
  const unobserved = buildFailureClassification(item, [{ ...failure('sensitive-redirect'), finalUrl: billing }], null, false)
  assert.equal(unobserved.errorCode, 'sensitive-redirect', 'a protected target without a server response stays protected')
})

test('two unanswered navigations fail even when the optional DNS probe cannot run', async () => {
  let calls = 0
  const result = await inspectAvailabilityWithEvidence(bookmark(), {
    timeouts, ready: async () => true, resolveRedirect: async () => '',
    navigate: async () => {
      calls++
      const errorCode = calls === 1 ? 'timeout' : 'net::ERR_TIMED_OUT'
      return { ...failure(errorCode), networkEvidence: { requestSent: true, requestedUrl: bookmark().url, errorCode, redirects: [], timing: {} } }
    },
    probe: async () => ({ kind: 'unknown', method: 'HEAD', label: '探测受限', detail: 'DNS API unavailable', errorCode: 'unsupported-dns-boundary' })
  })
  assert.equal(calls, 2)
  assert.equal(result?.status, 'failed')
  assert.equal(result?.badgeText, '连接超时')
  assert.equal(result?.verifiedFailure, undefined, 'timeouts need a repeat in a later run before cleanup')
  assert.equal(requireRepeatedFailureEvidence(result!, false).status, 'review')
  assert.equal(requireRepeatedFailureEvidence(result!, true).status, 'failed')
  const reachable = buildFailureClassification(bookmark(), [failure('timeout'), failure('timeout')].map(attempt => ({
    ...attempt, networkEvidence: { requestSent: true, requestedUrl: bookmark().url, errorCode: 'timeout', redirects: [], timing: {} }
  })), { kind: 'ok', method: 'HEAD', label: 'HTTP 200', detail: 'HTTP 200' }, true)
  assert.equal(reachable.status, 'review', 'a successful independent probe keeps a slow page reviewable')
})

test('verified first-run failures survive per-bookmark evidence projection', async () => {
  for (const statusCode of [404, 410]) {
    const item = bookmark()
    const result = await createAvailabilityEvidenceCache().inspect(item,
      async () => buildFailureClassification(item, [navigation(statusCode)], null, false))
    assert.equal(result?.verifiedFailure, 'http-missing')
    assert.equal(requireRepeatedFailureEvidence(result!, false).status, 'failed')
  }
  const anonymous = buildFailureClassification(bookmark(), [failure('timeout')], {
    kind: 'missing', method: 'HEAD', label: 'HTTP 404', detail: 'HTTP 404'
  }, true)
  assert.equal(anonymous.status, 'review')
  assert.equal(anonymous.verifiedFailure, undefined)
})

test('review and failed bookmarks share direct deletion without changing classification', () => {
  const review = { ...healthy(bookmark('review')), status: 'review' as const }
  const failed = { ...healthy(bookmark('failed')), status: 'failed' as const }
  const request = buildAvailabilityDeletionRequest([review, failed, review, healthy(bookmark('healthy'))])!
  assert.equal(request.candidates.length, 2)
  assert.match(request.copy, /1 条仍待确认/)
  assert.deepEqual(request.candidates, [
    { id: 'review', expectedUrl: review.url }, { id: 'failed', expectedUrl: failed.url }
  ])
  review.url = 'https://changed.example.net/'
  assert.equal(request.candidates[0].expectedUrl, 'https://example.net/page', 'confirmation freezes exact URL identity')
  assert.equal(review.status, 'review', 'deleting is not evidence for a status promotion')
  assert.equal(buildAvailabilityDeletionRequest([healthy(bookmark())]), null)
  assert.match(buildAvailabilityDeletionRequest([failed])!.title, /Bookmark failed/)
})

test('retest actions state the need for authorization without granting it implicitly', () => {
  assert.equal(getAvailabilityRetestLabel([{ errorCode: 'ungranted-redirect' }]), '授权并重测')
  assert.equal(getAvailabilityRetestLabel([{ errorCode: 'permission-missing' }]), '授权并重测')
  assert.equal(getAvailabilityRetestLabel([{ errorCode: 'http-404' }]), '重新检测')
  assert.equal(getAvailabilityRetestLabel([{ errorCode: 'ungranted-redirect' }], true), '重新检测中…')
})

test('status parsing never treats URL numbers or durations as HTTP evidence', () => {
  assert.equal(extractAvailabilityHttpStatus('http-429'), 429)
  assert.equal(extractAvailabilityHttpStatus('HTTP/1.1 503 Service Unavailable'), 503)
  assert.equal(extractAvailabilityHttpStatus('statusCode=404'), 404)
  assert.equal(extractAvailabilityHttpStatus('https://example.net/429 request failed'), 0)
  assert.equal(extractAvailabilityHttpStatus('超过 120 秒仍未完成'), 0)
})

test('URL identity preserves slash changes and repeated query value order', () => {
  assert.equal(isRedirectedNavigation('https://example.net/a', 'https://example.net/a/'), true)
  assert.equal(isRedirectedNavigation('https://example.net/a//b', 'https://example.net/a/b'), true)
  assert.equal(isRedirectedNavigation('https://example.net/a?x=1&x=2', 'https://example.net/a?x=2&x=1'), true)
  assert.equal(isRedirectedNavigation('https://example.net/a?b=2&a=1', 'https://example.net/a?a=1&b=2'), false)
  assert.equal(isRedirectedNavigation('https://example.net:443/a', 'https://example.net/a'), false)
})

test('redirects and retries share one cumulative request budget', async () => {
  let now = 0
  const requestedTimeouts: number[] = []
  const result = await inspectAvailabilityWithEvidence(bookmark(), {
    timeouts, now: () => now, ready: async () => true,
    navigate: async (url, timeoutMs) => { requestedTimeouts.push(timeoutMs); now += timeoutMs; return { ...failure('ungranted-redirect'), finalUrl: url + '/next' } },
    resolveRedirect: async (_url, attempt) => attempt.finalUrl,
    probe: async () => { throw Error('exhausted budget must not start a probe') }
  })
  assert.deepEqual(requestedTimeouts, [5000, 7000, 4000])
  assert.equal(result?.errorCode, 'detection-budget-exhausted')
  assert.equal(result?.status, 'review')
})

test('explicit pauses do not consume request budgets', async () => {
  let now = 0
  let count = 0
  const requested: number[] = []
  const result = await inspectAvailabilityWithEvidence(bookmark(), {
    timeouts, now: () => now, ready: async () => { now += 360000; return true }, resolveRedirect: async () => '',
    navigate: async (_url, timeoutMs) => { requested.push(timeoutMs); now += 100; return ++count === 1 ? failure('net::ERR_CONNECTION_RESET') : navigation() }
  })
  assert.equal(result?.status, 'available')
  assert.deepEqual(requested, [5000, 7000])
})

test('redirect loops stop without following a repeated or unapproved target', async () => {
  let calls = 0
  const item = bookmark('1', 'https://example.net/a')
  const result = await inspectAvailabilityWithEvidence(item, {
    timeouts, ready: async () => true,
    navigate: async (url) => { calls++; return { ...failure('ungranted-redirect'), finalUrl: url.endsWith('/a') ? 'https://example.net/b' : item.url } },
    resolveRedirect: async (_url, attempt) => attempt.finalUrl,
    probe: async () => { throw Error('a loop is not repaired by a probe') }
  })
  assert.equal(result?.errorCode, 'redirect-loop')
  assert.equal(calls, 2)
  const denied = await inspectAvailabilityWithEvidence(item, {
    timeouts, ready: async () => true, navigate: async () => failure('ungranted-redirect'),
    resolveRedirect: async () => '', probe: async () => { throw Error('unapproved redirects must not be probed') }
  })
  assert.equal(denied?.status, 'review')
})

test('cancellation discards a late positive result', async () => {
  let active = true
  const result = await inspectAvailabilityWithEvidence(bookmark(), {
    timeouts, ready: async () => true, isActive: () => active, resolveRedirect: async () => '',
    navigate: async () => { active = false; return navigation() }
  })
  assert.equal(result, null)
})

test('same-run duplicate URLs share success while keeping bookmark identity', async () => {
  const cache = createAvailabilityEvidenceCache()
  let calls = 0
  const first = bookmark('one')
  const second = bookmark('two')
  const results = await Promise.all([first, second].map(item => cache.inspect(item, async () => { calls++; return healthy(item) })))
  assert.equal(calls, 1)
  assert.deepEqual(results.map(result => result?.id), ['one', 'two'])
  assert.deepEqual(results.map(result => result?.path), [first.path, second.path])
  assert.equal((await cache.inspect({ ...second, status: 'review' } as BookmarkRecord, async () => { throw Error('cached') }))?.status, 'available')
})

test('failures are rechecked and separate runs have separate evidence', async () => {
  const item = bookmark()
  const cache = createAvailabilityEvidenceCache()
  let calls = 0
  await cache.inspect(item, async () => { calls++; return { ...healthy(item), status: 'review' } })
  await cache.inspect(item, async () => { calls++; return healthy(item) })
  await cache.inspect(item, async () => { calls++; return healthy(item) })
  assert.equal(calls, 2)
  await createAvailabilityEvidenceCache().inspect(item, async () => { calls++; return healthy(item) })
  assert.equal(calls, 3)
})

test('evidence cache is bounded and preserves query and hash identity', async () => {
  const cache = createAvailabilityEvidenceCache(2)
  let calls = 0
  const run = (url: string) => { const item = bookmark('1', url); return cache.inspect(item, async () => { calls++; return healthy(item) }) }
  await run('https://example.net/a?x=1&x=2')
  await run('https://example.net/a?x=2&x=1')
  await run('https://example.net/a#client-route')
  await run('https://example.net/a?x=1&x=2')
  assert.equal(calls, 4)
})

test('ten thousand same-site entries do not block another site or repeatedly resolve URLs', async () => {
  const scheduler = createAvailabilityRunScheduler({ profile: { concurrency: 2, domainConcurrency: 1 } })
  const held = scheduler.tryAcquire('https://busy.example.net')!
  const items = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), url: 'https://busy.example.net/' + index }))
  items.push({ id: 'other', url: 'https://other.example.net/' })
  let lookups = 0
  const order: string[] = []
  await runAvailabilityQueue({ items, scheduler, getUrl: item => { lookups++; return item.url },
    processItem: item => { order.push(item.id); if (item.id === 'other') held.release() }
  })
  assert.equal(order[0], 'other')
  assert.equal(order.length, items.length)
  assert.equal(lookups, items.length)
  assert.equal(scheduler.getSnapshot().activeCount, 0)
})

test('global and same-domain concurrency remain bounded', async () => {
  const scheduler = createAvailabilityRunScheduler({ profile: { concurrency: 3, domainConcurrency: 1 } })
  const counts = new Map<string, number>()
  let global = 0
  let maxGlobal = 0
  const items = Array.from({ length: 36 }, (_, index) => 'https://host' + index % 4 + '.example.net/' + index)
  await runAvailabilityQueue({ items, scheduler, getUrl: item => item, processItem: async item => {
    const host = new URL(item).hostname
    counts.set(host, (counts.get(host) || 0) + 1)
    assert.equal(counts.get(host), 1)
    global++; maxGlobal = Math.max(maxGlobal, global)
    await new Promise(resolve => setTimeout(resolve, 1))
    counts.set(host, counts.get(host)! - 1); global--
  } })
  assert.equal(maxGlobal, 3)
  assert.equal(global, 0)
})

test('queue drains in-flight work before reporting a fatal failure', async () => {
  const entered = gate()
  const release = gate()
  const failed = gate()
  let settled = false
  const started: string[] = []
  const scheduler = createAvailabilityRunScheduler({ profile: { concurrency: 2 } })
  const operation = runAvailabilityQueue({ items: ['a', 'b', 'c'], scheduler, getUrl: item => 'https://' + item + '.example.net',
    onFatalError: () => failed.resolve(), processItem: async item => {
      started.push(item)
      if (item === 'a') { await entered.promise; throw Error('fixture fatal') }
      if (item === 'b') { entered.resolve(); await release.promise }
    }
  })
  const rejected = assert.rejects(operation, /fixture fatal/)
  void operation.then(() => { settled = true }, () => { settled = true })
  await failed.promise
  assert.equal(settled, false)
  assert.deepEqual(started, ['a', 'b'])
  release.resolve()
  await rejected
  assert.equal(scheduler.getSnapshot().activeCount, 0)
})

test('fatal errors wake paused workers and cancellation aborts cooldown waits', async () => {
  let continuation = 0
  const scheduler = createAvailabilityRunScheduler({ profile: { concurrency: 2 } })
  await assert.rejects(runAvailabilityQueue({ items: ['a', 'b'], scheduler, getUrl: item => 'https://' + item + '.example.net',
    shouldContinue: () => ++continuation === 1 ? true : new Promise<boolean>(() => {}),
    processItem: () => { throw Error('fatal while paused') }
  }), /fatal while paused/)
  const controller = new AbortController()
  scheduler.recordOutcome('https://blocked.example.net', { kind: 'throttle', statusCode: 429, retryAfterMs: 10000 })
  let processed = 0
  const waiting = runAvailabilityQueue({ items: ['https://blocked.example.net'], scheduler, getUrl: item => item,
    signal: controller.signal, onWait: () => controller.abort(), processItem: () => { processed++ }
  })
  await waiting
  assert.equal(processed, 0)
})

test('Retry-After is honored and long limits defer only affected sites', async () => {
  const now = 1000
  assert.equal(parseAvailabilityRetryAfter('2', now), 2000)
  assert.equal(parseAvailabilityRetryAfter('-1', now), undefined)
  assert.equal(parseAvailabilityRetryAfter(new Date(now + 9000).toUTCString(), now), 9000)
  const scheduler = createAvailabilityRunScheduler({ now: () => now, profile: { concurrency: 2 } })
  scheduler.recordOutcome('https://limited.example.net', { kind: 'throttle', statusCode: 429, retryAfterMs: 120000 })
  assert.equal(scheduler.getCooldownDelay('https://limited.example.net'), 120000)
  const processed: string[] = []
  const deferred: string[] = []
  await runAvailabilityQueue({ items: ['https://limited.example.net/a', 'https://normal.example.net/b'], scheduler, getUrl: item => item,
    processItem: item => { processed.push(item) }, onDeferred: (item, { retryAfterMs }) => {
      deferred.push(item); assert.equal(retryAfterMs, 120000)
      const result = buildDeferredAvailabilityResult(bookmark('limited', item), retryAfterMs)
      assert.equal(result.status, 'review'); assert.equal(result.errorCode, 'site-cooldown')
    }
  })
  assert.deepEqual(processed, ['https://normal.example.net/b'])
  assert.deepEqual(deferred, ['https://limited.example.net/a'])
})

test('repeated throttling opens a same-run site circuit and success clears it', () => {
  let now = 1000
  const scheduler = createAvailabilityRunScheduler({ now: () => now })
  scheduler.recordOutcome('https://limited.example.net', { statusCode: 429, retryAfterMs: 0 })
  assert.equal(scheduler.getDeferralDelay('https://limited.example.net'), 0)
  scheduler.recordOutcome('https://limited.example.net', { statusCode: 429, retryAfterMs: 0 })
  assert.ok(scheduler.getDeferralDelay('https://limited.example.net') > 0)
  scheduler.recordOutcome('https://limited.example.net', { kind: 'success' })
  now += 20000
  assert.equal(scheduler.getDeferralDelay('https://limited.example.net'), 0)
  assert.equal(scheduler.getSnapshot().slowedDomainCount, 0)
})

test('client watchdog rejects stalled requests, sends cancellation and bounds cancellation itself', async () => {
  const originalChrome = (globalThis as any).chrome
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const timers = new Map<number, { callback: () => void; ms: number }>()
  const messages: any[] = []
  let next = 0
  ;(globalThis as any).setTimeout = (callback: () => void, ms: number) => { timers.set(++next, { callback, ms }); return next }
  ;(globalThis as any).clearTimeout = (id: number) => timers.delete(id)
  ;(globalThis as any).chrome = { runtime: { sendMessage: (message: any, callback: (value: unknown) => void) => {
    messages.push({ message, callback })
    if (message.type === 'availability:cancel' && message.checkId !== 'stalled-cancel') callback({ ok: true })
  } } }
  const fire = (ms: number) => {
    const entry = [...timers.entries()].find(([, value]) => value.ms === ms)
    assert.ok(entry, 'expected watchdog duration ' + ms)
    timers.delete(entry[0]); entry[1].callback()
  }
  try {
    const check = requestNavigationCheck('https://example.net', 1000, 'stalled')
    const rejected = assert.rejects(check, (error: any) => error.code === 'availability-runtime-timeout')
    fire(6000)
    await rejected
    assert.ok(messages.some(entry => entry.message.type === 'availability:cancel' && entry.message.checkId === 'stalled'))
    const cancel = cancelNavigationCheck('stalled-cancel')
    const cancelRejected = assert.rejects(cancel, (error: any) => error.code === 'availability-runtime-timeout')
    fire(2000)
    await cancelRejected
    const probe = requestAvailabilityProbe('https://example.net', 'HEAD', 1000, 'probe')
    const probeRejected = assert.rejects(probe, (error: any) => error.code === 'availability-runtime-timeout')
    fire(6000)
    await probeRejected
    const engine = assertAvailabilityEngineReady()
    const engineRejected = assert.rejects(engine, (error: any) => error.code === 'availability-engine-mismatch')
    fire(3000)
    await engineRejected
    assert.equal(messages.filter(entry => entry.message.type === 'availability:engine').length, 1)
    assert.equal(timers.size, 0)
  } finally {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    ;(globalThis as any).chrome = originalChrome
  }
})

for (const [name, run] of tests) {
  try { await run() } catch (error) { console.error('FAILED:', name); throw error }
}
console.log('Availability health tests passed: ' + tests.length + ' scenarios, including 10,001-item queue fairness and message watchdogs.')
