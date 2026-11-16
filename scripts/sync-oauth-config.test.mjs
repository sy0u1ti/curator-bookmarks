import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { test } from 'node:test'
import { resolveSyncOAuthBuild } from './sync-oauth-config.mjs'

const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const der = publicKey.export({ type: 'spki', format: 'der' })
const environment = {
  CURATOR_EXTENSION_PUBLIC_KEY: der.toString('base64'),
  CURATOR_GOOGLE_CLIENT_ID: 'curator.apps.googleusercontent.com',
  CURATOR_GOOGLE_CLIENT_SECRET: 'publisher-fixture-secret',
  CURATOR_DROPBOX_CLIENT_ID: 'curatorDropboxApp'
}

test('release builds require the publisher identity and both login providers', () => {
  for (const field of Object.keys(environment)) {
    assert.throws(() => resolveSyncOAuthBuild({ ...environment, [field]: '' }, { release: true }))
  }
  assert.throws(() => resolveSyncOAuthBuild({ ...environment, CURATOR_EXTENSION_PUBLIC_KEY: 'invalid' }, { release: true }), /公钥/)
})

test('the manifest key and registered OAuth redirect share the same extension id', () => {
  const { publicKey: key, oauth } = resolveSyncOAuthBuild(environment, { release: true })
  const expected = [...createHash('sha256').update(der).digest().slice(0, 16)]
    .flatMap(byte => [byte >> 4, byte & 15]).map(nibble => 'abcdefghijklmnop'[nibble]).join('')
  assert.equal(key, der.toString('base64'))
  assert.equal(oauth.extensionId, expected)
  assert.equal(oauth.clients['google-drive'].clientSecret, environment.CURATOR_GOOGLE_CLIENT_SECRET)
  assert.equal(oauth.clients.dropbox.clientId, environment.CURATOR_DROPBOX_CLIENT_ID)
})

test('development can build without clients but rejects half configured Google login', () => {
  assert.deepEqual(resolveSyncOAuthBuild({}).oauth.clients, {})
  assert.throws(() => resolveSyncOAuthBuild({ CURATOR_GOOGLE_CLIENT_ID: environment.CURATOR_GOOGLE_CLIENT_ID }), /同时配置/)
})

test('publisher setup preserves an explicitly registered unpacked installation', () => {
  const installedId = 'abcdefghijklmnopabcdefghijklmnop'
  const config = { ...environment, CURATOR_DEVELOPMENT_EXTENSION_ID: installedId }
  const development = resolveSyncOAuthBuild(config)
  assert.equal(development.publicKey, '')
  assert.equal(development.oauth.extensionId, installedId)
  assert.deepEqual(development.oauth.clients, resolveSyncOAuthBuild(environment).oauth.clients)
  const release = resolveSyncOAuthBuild(config, { release: true })
  assert.equal(release.publicKey, der.toString('base64'))
  assert.equal(release.oauth.extensionId, resolveSyncOAuthBuild(environment, { release: true }).oauth.extensionId)
  assert.notEqual(release.oauth.extensionId, installedId)
})

test('development identities must be exact Chrome extension ids', () => {
  for (const id of ['short', 'q'.repeat(32), 'A'.repeat(32), 'a'.repeat(33)]) {
    assert.throws(() => resolveSyncOAuthBuild({ ...environment, CURATOR_DEVELOPMENT_EXTENSION_ID: id }), /32 位 ID/)
  }
})
