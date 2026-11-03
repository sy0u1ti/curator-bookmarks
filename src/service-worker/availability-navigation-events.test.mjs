import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { build } from 'esbuild'

// Execute the production handlers and probe redirect loop, replacing only browser/network IO.
const source = await readFile(new URL('./service-worker.ts', import.meta.url), 'utf8')
function section(start, end) {
  const first = source.indexOf(start)
  const last = source.indexOf(end, first + start.length)
  assert.ok(first >= 0 && last > first, `Missing worker section: ${start}`)
  return source.slice(first, last)
}
const bundled = await build({
  stdin: {
    resolveDir: path.resolve('src/service-worker'), loader: 'ts',
    contents: `
      import { assessSensitiveExternalUrl, isAuthenticationEntryUrl, isAuthenticationExitUrl } from '../shared/sensitive-url.js'
      import { getNavigationHeaderOutcome, hasVerifiedLoginRequirement, isHttpRedirectStatus, readAvailabilityResponseHeaders, shouldWaitForNavigationChallenge } from '../shared/availability-evidence.js'
      const pendingChecks = new Map()
      const detachWebRequestListeners = () => {}
      const releaseNavigationCheckReservation = () => {}
      const unregisterNavigationProbeTab = async () => {}
      const removeNavigationOriginFirewall = async () => {}
      let closed = 0
      let started = 0
      const closeNavigationTabAndReleaseFirewall = async () => { closed++ }
      let probeHop
      let probeRequests = []
      const throwIfAvailabilityProbeUnavailable = () => {}
      const containsHostPermission = async () => true
      const getOriginPermissionPattern = url => new URL(url).origin + '/*'
      const runWithAvailabilityProbeDeadline = async promise => promise
      const serializeAvailabilityProbeHop = async (_url, _signal, _deadline, work) => work()
      const fetchAvailabilityProbeHop = async url => {
        probeRequests.push(url)
        if (probeRequests.length > 1) throw Error('Protected login target must not be requested')
        return probeHop
      }
      ${section('async function performAvailabilityProbeRedirectChain(', 'function getAvailabilityProbeRemainingMs(')}
      ${section('chrome.webNavigation.onCommitted.addListener', 'chrome.tabs.onRemoved.addListener')}
      ${section('function createWebRequestListeners(', 'function detachWebRequestListeners(')}
      ${section('function getPendingState(', 'async function closeNavigationTabAndReleaseFirewall(')}
      ${section('function finalizeSensitiveNavigationTarget(', 'function normalizeTimeout(')}
      globalThis.fixture = {
        start(url = 'https://example.net/page') {
          started++
          const results = []
          const state = { tabId: 41, checkId: 'event-fixture', requestedUrl: url, lastUrl: url,
            lastAttemptedUrl: '', navigationStarted: false, challengeSeen: false, settled: false,
            timeoutId: 0, networkEvidence: null, resolve: result => results.push(result) }
          pendingChecks.set(41, state)
          return { state, results, listeners: createWebRequestListeners(state),
            finish: result => finalizeNavigationCheck(41, { finalUrl: url, detail: '', ...result }) }
        },
        async probe(hop) {
          probeHop = hop
          probeRequests = []
          const result = await performAvailabilityProbeRedirectChain({
            url: 'https://example.net/page', method: 'HEAD', deadlineAtMs: 1000, signal: {}
          })
          return { result, requests: probeRequests }
        },
        get closed() { return closed },
        get started() { return started }
      }
    `
  },
  bundle: true, write: false, platform: 'browser', format: 'iife'
})
const events = {}
const context = {
  URL, URLSearchParams, console, clearTimeout,
  chrome: { webNavigation: Object.fromEntries(['onCommitted', 'onDOMContentLoaded', 'onCompleted', 'onErrorOccurred']
    .map(name => [name, { addListener: callback => { events[name] = callback } }])) }
}
vm.runInNewContext(bundled.outputFiles[0].text, context)
const fixture = context.fixture
const request = (requestId, extra = {}) => ({
  requestId, tabId: 41, frameId: 0, url: 'https://example.net/page', timeStamp: 1000,
  method: 'GET', ...extra
})
const documentEvent = extra => ({ tabId: 41, frameId: 0, url: 'https://example.net/page', ...extra })

const resolved = fixture.start()
resolved.listeners.beforeRequest(request('challenge'))
resolved.listeners.headersReceived(request('challenge', { statusCode: 403, responseHeaders: [{ name: 'cf-mitigated', value: 'challenge' }] }))
resolved.listeners.completed(request('challenge', { statusCode: 403 }))
events.onDOMContentLoaded(documentEvent())
events.onCompleted(documentEvent())
assert.equal(resolved.results.length, 0, 'the challenge document must remain alive for automatic verification')
resolved.listeners.beforeRequest(request('replacement'))
events.onDOMContentLoaded(documentEvent())
assert.equal(resolved.results.length, 0, 'the old DOM event cannot complete a replacement with no headers yet')
resolved.listeners.headersReceived(request('challenge', { statusCode: 500, responseHeaders: [] }))
resolved.listeners.errorOccurred(request('challenge', { error: 'net::ERR_ABORTED' }))
events.onErrorOccurred(documentEvent({ error: 'net::ERR_ABORTED' }))
assert.equal(resolved.results.length, 0, 'late events from the old request cannot fail the replacement')
resolved.listeners.headersReceived(request('replacement', { statusCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/html' }] }))
events.onDOMContentLoaded(documentEvent())
assert.equal(resolved.results.length, 1)
assert.equal(resolved.results[0].status, 'available')
assert.equal(resolved.results[0].networkEvidence.requestId, 'replacement')
assert.equal(resolved.results[0].networkEvidence.challenge, false)

const pending = fixture.start()
pending.listeners.beforeRequest(request('pending'))
pending.listeners.headersReceived(request('pending', { statusCode: 200, responseHeaders: [{ name: 'CF-Mitigated', value: 'challenge' }] }))
pending.listeners.completed(request('pending', { statusCode: 200 }))
events.onCompleted(documentEvent())
assert.equal(pending.results.length, 0, 'even a challenge with HTTP 200 is not final content')
pending.finish({ status: 'failed', errorCode: 'timeout' })
assert.equal(pending.results[0].errorCode, 'challenge-required')

const jiasule = fixture.start()
jiasule.listeners.beforeRequest(request('jsl'))
jiasule.listeners.headersReceived(request('jsl', { statusCode: 521, responseHeaders: [{ name: 'X-Via-JSL', value: 'fixture,-' }] }))
events.onDOMContentLoaded(documentEvent())
assert.equal(jiasule.results.length, 0)
jiasule.listeners.beforeRequest(request('jsl-complete'))
jiasule.listeners.headersReceived(request('jsl-complete', { statusCode: 200, responseHeaders: [{ name: 'X-Via-JSL', value: 'fixture,-' }] }))
jiasule.listeners.completed(request('jsl-complete', { statusCode: 200 }))
assert.equal(jiasule.results[0].status, 'available')

for (const statusCode of [404, 410, 521]) {
  const missing = fixture.start()
  missing.listeners.beforeRequest(request('http-' + statusCode))
  missing.listeners.headersReceived(request('http-' + statusCode, { statusCode, responseHeaders: [] }))
  events.onDOMContentLoaded(documentEvent())
  assert.equal(missing.results.length, 1)
  assert.equal(missing.results[0].errorCode, 'http-' + statusCode)
}
const login = fixture.start()
login.listeners.beforeRequest(request('login'))
login.listeners.beforeRedirect(request('login', { statusCode: 302, redirectUrl: 'https://example.net/login' }))
assert.equal(login.results[0].status, 'available')
assert.equal(login.results[0].errorCode, '')
assert.equal(login.results[0].finalUrl, 'https://example.net/page', 'protected login target is not followed or exposed as an approved next hop')

for (const target of [
  'https://identity.example.org/oauth/authorize?SAMLRequest=fixture',
  'https://example.net/zh/signin',
  'https://example.net/login/login.htm',
  'https://example.net/logout',
  'https://example.net/logout.php',
  'https://session.example.org/v1/client/handshake?redirect_url=https%3A%2F%2Fexample.net%2Fpage&__clerk_api_version=2026-05-12&__session=fixture'
]) {
  const authentication = fixture.start()
  authentication.listeners.beforeRequest(request('authentication'))
  authentication.listeners.beforeRedirect(request('authentication', { statusCode: 302, redirectUrl: target }))
  assert.equal(authentication.results.length, 1)
  assert.equal(authentication.results[0].status, 'available')
  assert.equal(authentication.results[0].errorCode, '')
  assert.equal(authentication.results[0].finalUrl, 'https://example.net/page')
  const probe = await fixture.probe({ ok: false, status: 302, redirectUrl: target })
  assert.equal(probe.result.ok, true)
  assert.equal(probe.result.requiresLogin, true)
  assert.equal(probe.result.redirected, false)
  assert.equal(probe.result.finalUrl, 'https://example.net/page')
  assert.deepEqual(Array.from(probe.requests), ['https://example.net/page'])
}

const auth401 = fixture.start()
auth401.listeners.beforeRequest(request('auth401'))
auth401.listeners.headersReceived(request('auth401', { statusCode: 401, responseHeaders: [] }))
assert.equal(auth401.results[0].status, 'available', 'an actual authentication response proves the site is reachable')
assert.equal(auth401.results[0].errorCode, '')

const clientLogin = fixture.start()
clientLogin.listeners.beforeRequest(request('source'))
clientLogin.listeners.headersReceived(request('source', { statusCode: 200, responseHeaders: [] }))
clientLogin.listeners.beforeRequest(request('target', { url: 'https://example.net/login' }))
assert.equal(clientLogin.results[0].status, 'available', 'a script login redirect must preserve the responding document as evidence')
assert.equal(clientLogin.results[0].networkEvidence.requestId, 'source')
assert.equal(clientLogin.results[0].networkEvidence.statusCode, 200)
assert.equal(clientLogin.results[0].finalUrl, 'https://example.net/page')

const directLogin = fixture.start('https://auth.example.org/')
directLogin.listeners.beforeRequest(request('direct-login', { url: 'https://auth.example.org/' }))
assert.equal(directLogin.results.length, 0, 'an otherwise permitted login hostname must be allowed to respond')
directLogin.listeners.headersReceived(request('direct-login', { url: 'https://auth.example.org/', statusCode: 200, responseHeaders: [] }))
directLogin.listeners.completed(request('direct-login', { url: 'https://auth.example.org/', statusCode: 200 }))
assert.equal(directLogin.results[0].status, 'available')

const noResponse = fixture.start()
events.onErrorOccurred(documentEvent({ url: 'https://example.net/login', error: 'net::ERR_BLOCKED_BY_CLIENT' }))
assert.equal(noResponse.results[0].status, 'failed', 'a URL-only observation does not prove the website responded')
assert.equal(noResponse.results[0].errorCode, 'sensitive-redirect')

const accountAction = fixture.start()
accountAction.listeners.beforeRequest(request('action'))
accountAction.listeners.beforeRedirect(request('action', { statusCode: 302, redirectUrl: 'https://example.net/login/reset-password' }))
assert.equal(accountAction.results[0].status, 'failed')
assert.equal(accountAction.results[0].errorCode, 'sensitive-redirect')
const protectedProbe = await fixture.probe({ ok: false, status: 302, redirectUrl: 'https://example.net/login/reset-password' })
assert.equal(protectedProbe.result.ok, false)
assert.equal(protectedProbe.result.errorCode, 'sensitive-redirect')
assert.deepEqual(Array.from(protectedProbe.requests), ['https://example.net/page'])

const cancelled = fixture.start()
cancelled.listeners.beforeRequest(request('cancel'))
cancelled.listeners.headersReceived(request('cancel', { statusCode: 403, responseHeaders: [{ name: 'cf-mitigated', value: 'challenge' }] }))
cancelled.finish({ status: 'failed', errorCode: 'cancelled' })
assert.equal(cancelled.results[0].errorCode, 'cancelled')
assert.equal(fixture.closed, fixture.started, 'each check closes exactly once')

console.log('Availability navigation event regressions passed: challenge replacement races, Jiasule, HTTP failures, login and cancellation.')
