const POLL_INTERVAL_MS = 1000
// Nextcloud keeps a login token for twenty minutes.
const LOGIN_TIMEOUT_MS = 20 * 60 * 1000

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, POLL_INTERVAL_MS)
    signal.addEventListener('abort', abort, { once: true })
  })
}

/**
 * Nextcloud's browser login (Login Flow v2): the user signs in on the server's
 * own page, in a tab, and the server hands back an app password for this device.
 */
export async function runNextcloudLogin(
  serverUrl: string,
  signal: AbortSignal
): Promise<{ username: string; password: string }> {
  const failure = new Error('无法开始 Nextcloud 登录，请检查地址。')
  let flow: { login?: string; poll?: { token?: string; endpoint?: string } }
  try {
    const response = await fetch(`${serverUrl.replace(/\/+$/, '')}/index.php/login/v2`, { method: 'POST', signal })
    if (response.status !== 200) throw failure
    flow = await response.json()
  } catch (error) {
    if (signal.aborted) throw error
    throw failure
  }
  const { login, poll } = flow
  if (!login || !poll?.token || !poll.endpoint || !/^https?:\/\//i.test(login) || !/^https?:\/\//i.test(poll.endpoint)) {
    throw failure
  }
  // The app-password exchange belongs to the server the user authorized.
  // Never send its one-time token to a different origin returned in JSON.
  const origin = new URL(serverUrl).origin
  if (new URL(poll.endpoint).origin !== origin) throw failure

  await chrome.tabs.create({ url: login })
  const deadline = Date.now() + LOGIN_TIMEOUT_MS
  while (Date.now() < deadline) {
    await waitForPoll(signal)
    const response = await fetch(poll.endpoint, {
      method: 'POST',
      body: `token=${encodeURIComponent(poll.token)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal
    })
    // 404 until the user has signed in
    if (response.status === 404) continue
    if (response.status !== 200) break
    const result = await response.json().catch(() => null) as { loginName?: string; appPassword?: string } | null
    if (typeof result?.loginName === 'string' && result.loginName && typeof result.appPassword === 'string' && result.appPassword) {
      return { username: result.loginName, password: result.appPassword }
    }
    break
  }
  throw new Error('Nextcloud 登录未完成，请重试。')
}
