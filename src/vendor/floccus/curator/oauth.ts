/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import type { SyncOAuthAdapterType, SyncOAuthClient } from '../../../shared/sync/sync-contract'

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)))

/** Each attempt owns its client and PKCE values; a cancelled login changes nothing. */
export async function authorizeOAuth(type: SyncOAuthAdapterType, client: SyncOAuthClient): Promise<{ refreshToken: string; username: string }> {
  const google = type === 'google-drive'
  const provider = google ? 'Google' : 'Dropbox'
  if (!chrome.identity?.launchWebAuthFlow) throw new Error('未授予账号登录权限，请重新点击登录。')
  const verifier = random(), state = random()
  const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const redirect = chrome.identity.getRedirectURL()
  const auth = new URL(google ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://www.dropbox.com/oauth2/authorize')
  const values = {
    client_id: client.clientId, response_type: 'code', redirect_uri: redirect, state,
    code_challenge: challenge, code_challenge_method: 'S256',
    scope: google ? 'https://www.googleapis.com/auth/drive.file' : 'files.content.write files.content.read files.metadata.write account_info.read',
    ...(google ? { access_type: 'offline', prompt: 'consent' } : { token_access_type: 'offline' })
  }
  for (const [key,value] of Object.entries(values)) auth.searchParams.set(key,value)
  let result: string | undefined
  try {
    result = await chrome.identity.launchWebAuthFlow({ interactive: true, url: auth.href })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (/cancel|closed|not approve|denied/i.test(detail)) throw new Error(`已取消 ${provider} 登录。`)
    throw new Error(`无法打开 ${provider} 登录，请检查网络后重试。`)
  }
  if (!result) throw new Error('授权未完成。')
  const callback = new URL(result), expected = new URL(redirect)
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname || callback.searchParams.get('state') !== state) {
    throw new Error('授权响应校验失败，请重新连接。')
  }
  const code = callback.searchParams.get('code')
  if (callback.searchParams.get('error') === 'access_denied') throw new Error(`已取消 ${provider} 登录。`)
  if (!code || callback.searchParams.has('error')) throw new Error(`${provider} 授权未完成，请重新登录。`)
  const token = await fetch(google ? 'https://oauth2.googleapis.com/token' : 'https://www.dropbox.com/oauth2/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: client.clientId, redirect_uri: redirect, code_verifier: verifier, grant_type: 'authorization_code',
      ...(google && client.clientSecret ? { client_secret: client.clientSecret } : {})
    }).toString()
  })
  const credentials = await token.json().catch(() => null)
  if (!token.ok || !credentials?.access_token || !credentials.refresh_token) {
    if (credentials?.error === 'invalid_client' || credentials?.error === 'unauthorized_client') {
      throw new Error(`此版本的 ${provider} 登录配置无效，请由扩展发行方更新。`)
    }
    throw new Error(`无法取得 ${provider} 账号授权，请重新登录。`)
  }
  const account = await fetch(google
    ? 'https://www.googleapis.com/drive/v3/about?fields=user/displayName'
    : 'https://api.dropboxapi.com/2/users/get_current_account', {
    method: google ? 'GET' : 'POST', signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${credentials.access_token}`,
      ...(!google ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(!google ? { body: 'null' } : {}),
  })
  if (!account.ok) throw new Error('账号信息读取失败，请重新连接。')
  const about = await account.json()
  return {
    refreshToken: credentials.refresh_token,
    username: google ? about.user?.displayName || '' : about.name?.display_name || ''
  }
}
