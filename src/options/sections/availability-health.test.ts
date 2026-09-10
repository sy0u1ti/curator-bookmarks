import assert from 'node:assert/strict'
import { buildDeferredAvailabilityResult, createAvailabilityEvidenceCache, inspectAvailabilityWithEvidence } from './availability-pipeline.js'
import { createAvailabilityRunScheduler, runAvailabilityQueue } from './availability-runner.js'
import { buildFailureClassification, isRedirectedNavigation, shouldAcceptNavigationSuccess } from './classifier.js'
import { extractAvailabilityHttpStatus, getNavigationHeaderOutcome, isHttpRedirectStatus, parseAvailabilityRetryAfter, readAvailabilityResponseHeaders } from '../../shared/availability-evidence.js'
import { cancelNavigationCheck, requestNavigationCheck, requestAvailabilityProbe } from '../../shared/messages.js'
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
  assert.equal(result?.status, 'review', 'anonymous HTTP errors do not prove a bookmark is safe to delete')
  assert.match(result!.detail, new RegExp(String(status)))
})

test('resolved redirect and unsupported optional DNS do not erase real HTTP evidence', () => {
  const redirected = failure('ungranted-redirect')
  redirected.finalUrl = 'https://example.net/target'
  const result = buildFailureClassification(bookmark(), [redirected, navigation(404)], {
    kind: 'unknown', method: 'HEAD', label: 'unsupported', detail: 'DNS API unavailable', errorCode: 'unsupported-dns-boundary'
  }, true)
  assert.equal(result.badgeText, '资源不存在·待确认')
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
  assert.deepEqual(metadata, { contentType: 'application/pdf', attachment: true, retryAfterMs: 1500 })
  assert.equal(getNavigationHeaderOutcome(200, metadata)?.status, 'available')
  assert.equal(getNavigationHeaderOutcome(403, metadata)?.status, 'failed')
  assert.equal(getNavigationHeaderOutcome(204, {})?.status, 'available')
  assert.equal(getNavigationHeaderOutcome(200, { contentType: 'text/html' }), null)
  assert.equal(getNavigationHeaderOutcome(200, { contentType: 'application/xhtml+xml' }), null)
  assert.equal(isHttpRedirectStatus(304), false)
  assert.equal(isHttpRedirectStatus(302), true)
  assert.equal(shouldAcceptNavigationSuccess(navigation(304)), true)
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
