/*
 * QA-only event and transport controls. The production sync worker loads after
 * this file. Browser data, UI permissions and the user's network are untouched.
 */
if (!chrome.runtime.getManifest().name.startsWith('Curator QA sync modes ')) throw new Error('QA only')
const qaNativeFetch = globalThis.fetch.bind(globalThis)
const qaNativeNow = Date.now.bind(Date)
const qaStartupListeners = []
const qaState = {
  clockOffset: 0, online: true, failNext: 0, gate: false, held: 0, requests: 0, alarms: 0, startups: 0,
  completionGate: false, completionsHeld: 0,
}
const qaReleases = new Set()
const qaCompletionReleases = new Set()
const qaClearNotification = chrome.notifications.clear.bind(chrome.notifications)
chrome.notifications.clear = async notificationId => {
  if (qaState.completionGate && notificationId.startsWith('curator-sync-pending-')) {
    qaState.completionsHeld++
    await new Promise(resolve => qaCompletionReleases.add(resolve))
  }
  return qaClearNotification(notificationId)
}
const qaAddStartup = chrome.runtime.onStartup.addListener.bind(chrome.runtime.onStartup)
chrome.runtime.onStartup.addListener = listener => { qaStartupListeners.push(listener); qaAddStartup(listener) }
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'curator-sync-check') qaState.alarms++ })
Date.now = () => qaNativeNow() + qaState.clockOffset
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => qaState.online })
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input))
  if (url.protocol === 'chrome-extension:') return qaNativeFetch(input, init)
  const provider = /^(?:oauth2|www)\.googleapis\.com$|^(?:www\.dropbox\.com|api\.dropboxapi\.com|content\.dropboxapi\.com)$/.test(url.hostname)
  if (!provider && url.origin !== __QA_BASE__) throw new Error('QA refused an unconfigured network destination')
  qaState.requests++
  if (qaState.failNext > 0) {
    qaState.failNext--
    return new Response('QA temporary service failure', { status: 503 })
  }
  if (qaState.gate) {
    qaState.held++
    await new Promise((resolve, reject) => {
      const signal = init?.signal || (typeof input === 'object' ? input.signal : undefined)
      const release = () => {
        qaReleases.delete(release)
        signal?.removeEventListener('abort', abort)
        resolve()
      }
      const abort = () => {
        qaReleases.delete(release)
        reject(new DOMException('QA request cancelled', 'AbortError'))
      }
      qaReleases.add(release)
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
    })
  }
  return qaNativeFetch(provider ? `${__QA_BASE__}/oauth/${url.hostname}${url.pathname}${url.search}` : input, init)
}
chrome.identity.launchWebAuthFlow = async ({ url }) => {
  const auth = new URL(url)
  if (auth.searchParams.get('code_challenge_method') !== 'S256') throw new Error('Missing PKCE')
  return `${chrome.identity.getRedirectURL()}?code=fixture-code&state=${encodeURIComponent(auth.searchParams.get('state'))}`
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'qa:sync-control') return
  if (sender.id !== chrome.runtime.id || new URL(sender.url).pathname !== '/src/options/options.html') {
    reply({ ok: false, error: 'QA control is restricted to the isolated options page' })
    return
  }
  const run = async () => {
    if (message.action === 'state') return { ...qaState }
    if (message.action === 'clock') qaState.clockOffset = Number(message.offset) || 0
    if (message.action === 'online') {
      const changed = !qaState.online && Boolean(message.online)
      qaState.online = Boolean(message.online)
      if (changed) globalThis.dispatchEvent(new Event('online'))
    }
    if (message.action === 'fail-next') qaState.failNext = Number(message.count) || 0
    if (message.action === 'gate') {
      qaState.gate = Boolean(message.enabled)
      if (!qaState.gate) for (const release of [...qaReleases]) release()
    }
    if (message.action === 'completion-gate') {
      qaState.completionGate = Boolean(message.enabled)
      if (!qaState.completionGate) {
        for (const release of qaCompletionReleases) release()
        qaCompletionReleases.clear()
      }
    }
    if (message.action === 'startup') {
      qaState.startups++
      for (const listener of qaStartupListeners) listener()
    }
    return { ...qaState }
  }
  run().then(result => reply({ ok: true, result }), error => reply({ ok: false, error: error.message }))
  return true
})
