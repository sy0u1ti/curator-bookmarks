/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { build } from 'esbuild'
import { buildSyncEngine } from './build.mjs'

const result = await build({ entryPoints: ['src/vendor/floccus/curator/oauth.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { authorizeOAuth } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const redirect = 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/'
const client = { clientId: 'fixture-client', clientSecret: 'fixture-secret' }

async function scenario(type, options = {}, run = authorizeOAuth) {
  const originalChrome = globalThis.chrome
  const originalFetch = globalThis.fetch
  const calls = []
  let auth
  globalThis.chrome = { identity: {
    getRedirectURL: () => redirect,
    launchWebAuthFlow: async ({ url, interactive }) => {
      assert.equal(interactive, true)
      auth = new URL(url)
      if (options.cancel) throw new Error('The user did not approve access.')
      return options.callback?.(auth) ?? `${redirect}?code=fixture-code&state=${auth.searchParams.get('state')}`
    }
  } }
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    if (String(url).endsWith('/token')) {
      const params = new URLSearchParams(init.body)
      assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
      assert.equal(auth.searchParams.get('code_challenge'), createHash('sha256').update(params.get('code_verifier')).digest('base64url'))
      assert.equal(params.get('redirect_uri'), redirect)
      assert.equal(params.get('client_id'), client.clientId)
      assert.equal(params.get('client_secret'), type === 'google-drive' ? client.clientSecret : null)
      return Response.json(options.credentials ?? { access_token: 'fixture-access', refresh_token: 'fixture-refresh' }, { status: options.tokenStatus ?? 200 })
    }
    if (type === 'dropbox') {
      assert.equal(init.method, 'POST')
      assert.equal(init.headers['Content-Type'], 'application/json')
      assert.equal(init.body, 'null', 'Dropbox requires a JSON null request body for current_account')
    }
    return Response.json(type === 'google-drive' ? { user: { displayName: 'Test Google' } } : { name: { display_name: 'Test Dropbox' } })
  }
  try {
    return await run(type, client, calls)
  } finally {
    globalThis.chrome = originalChrome
    globalThis.fetch = originalFetch
  }
}

for (const provider of ['google-drive', 'dropbox']) {
  test(`${provider}: S256 authorization, token exchange and account lookup`, async () => {
    assert.deepEqual(await scenario(provider), {
      refreshToken: 'fixture-refresh', username: provider === 'google-drive' ? 'Test Google' : 'Test Dropbox'
    })
  })
}

test('wrong callback origin, path and state are rejected before any token request', async () => {
  for (const callback of [
    auth => `https://other.chromiumapp.org/?code=fixture-code&state=${auth.searchParams.get('state')}`,
    auth => `${redirect}other?code=fixture-code&state=${auth.searchParams.get('state')}`,
    () => `${redirect}?code=fixture-code&state=wrong`
  ]) {
    await scenario('google-drive', { callback }, async (type, client, calls) => {
      await assert.rejects(() => authorizeOAuth(type, client), /校验失败/)
      assert.equal(calls.length, 0)
    })
  }
})

test('closing or declining consent never exchanges a code', async () => {
  for (const options of [
    { cancel: true },
    { callback: auth => `${redirect}?error=access_denied&state=${auth.searchParams.get('state')}` }
  ]) {
    await scenario('google-drive', options, async (type, client, calls) => {
      await assert.rejects(() => authorizeOAuth(type, client), /已取消 Google 登录/)
      assert.equal(calls.length, 0)
    })
  }
})

test('token errors identify publisher setup without leaking provider response text', async () => {
  await scenario('google-drive', {
    tokenStatus: 401, credentials: { error: 'invalid_client', error_description: 'private-provider-detail' }
  }, async (type, client) => {
    await assert.rejects(() => authorizeOAuth(type, client), error => {
      assert.match(error.message, /扩展发行方/)
      assert.doesNotMatch(error.message, /private-provider-detail/)
      return true
    })
  })
  await assert.rejects(() => scenario('dropbox', { credentials: { access_token: 'without-refresh' } }), /重新登录/)
})

test('the real engine uses bundled clients, commits custom clients only after success and checks its extension identity', async () => {
  const { code } = await buildSyncEngine({
    oauth: {
      extensionId: 'qa-extension',
      clients: {
        'google-drive': { clientId: 'publisher-google', clientSecret: 'publisher-secret' },
        dropbox: { clientId: 'publisher-dropbox' }
      }
    }
  })
  const load = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
  const originalChrome = globalThis.chrome
  const originalFetch = globalThis.fetch
  const stored = {}
  let cancel = false
  let logins = 0
  const tokens = []
  globalThis.chrome = {
    runtime: { id: 'qa-extension' },
    storage: { local: {
      async get(keys) {
        if (typeof keys === 'string') return { [keys]: stored[keys] }
        if (Array.isArray(keys)) return Object.fromEntries(keys.map(key => [key, stored[key]]))
        return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, stored[key] ?? fallback]))
      },
      async set(values) { Object.assign(stored, structuredClone(values)) },
      async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key] }
    } },
    identity: {
      getRedirectURL: () => redirect,
      async launchWebAuthFlow({ url }) {
        logins++
        if (cancel) throw new Error('The user did not approve access.')
        const auth = new URL(url)
        return `${redirect}?code=code&state=${auth.searchParams.get('state')}`
      }
    }
  }
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/token')) {
      tokens.push(new URLSearchParams(init.body))
      return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh' })
    }
    return Response.json({ user: { displayName: 'Fixture' }, name: { display_name: 'Fixture' } })
  }
  try {
    const engine = load()
    const settings = await engine.getOAuthSettings()
    assert.equal(settings.clients['google-drive'].source, 'bundled')
    assert.equal(settings.clients['google-drive'].available, true)
    assert.doesNotMatch(JSON.stringify(settings), /publisher-secret/)
    await engine.authorize('google-drive')
    assert.equal(tokens.at(-1).get('client_id'), 'publisher-google')
    assert.equal(tokens.at(-1).get('client_secret'), 'publisher-secret')
    await engine.authorize('dropbox')
    assert.equal(tokens.at(-1).get('client_id'), 'publisher-dropbox')
    assert.equal(stored['curatorSync:oauthClients'], undefined, 'default login must not convert publisher settings into custom overrides')

    cancel = true
    await assert.rejects(() => engine.authorize('google-drive', { clientId: 'custom-google', clientSecret: 'custom-secret' }), /已取消/)
    assert.equal((await engine.getOAuthSettings()).clients['google-drive'].source, 'bundled')
    cancel = false
    await engine.authorize('google-drive', { clientId: 'custom-google', clientSecret: 'custom-secret' })
    assert.equal(stored['curatorSync:oauthClients']['google-drive'].clientId, 'custom-google')
    assert.equal((await engine.getOAuthSettings()).clients['google-drive'].source, 'custom')
    const before = logins
    await assert.rejects(() => engine.authorize('google-drive', { clientId: 'different-client' }), /这个 Google 客户端的密钥/)
    assert.equal(logins, before, 'a secret must never be reused for a different client id')
    await engine.authorize('google-drive')
    assert.equal(tokens.at(-1).get('client_id'), 'custom-google', 'existing custom installations remain usable')

    delete stored['curatorSync:oauthClients']
    globalThis.chrome.runtime.id = 'another-extension'
    assert.equal((await engine.getOAuthSettings()).clients['google-drive'].available, false)
    await assert.rejects(() => engine.authorize('google-drive'), /扩展身份不一致/)
  } finally {
    globalThis.chrome = originalChrome
    globalThis.fetch = originalFetch
  }
})
