import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({ entryPoints: ['src/options/sync/nextcloud-login.ts'], bundle: true, format: 'esm', platform: 'node', write: false })
const { runNextcloudLogin } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const flow = endpoint => ({ login: 'https://nextcloud.example/login', poll: { token: 'one-time-fixture', endpoint } })

test('Nextcloud login polls only its authorized server and releases abort listeners', async () => {
  const fetch = globalThis.fetch, chrome = globalThis.chrome, controller = new AbortController()
  const calls = [], tabs = []
  globalThis.chrome = { tabs: { create: async details => { tabs.push(details.url); return { id: 1 } } } }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: options.body })
    if (calls.length === 1) return Response.json(flow('https://nextcloud.example/poll'))
    if (calls.length === 2) return new Response('', { status: 404 })
    return Response.json({ loginName: 'fixture-user', appPassword: 'fixture-app-password' })
  }
  try {
    assert.deepEqual(await runNextcloudLogin('https://nextcloud.example', controller.signal), { username: 'fixture-user', password: 'fixture-app-password' })
    assert.deepEqual(tabs, ['https://nextcloud.example/login'])
    assert.equal(calls.length, 3)
    assert.equal(calls[2].body, 'token=one-time-fixture')
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  } finally { globalThis.fetch = fetch; globalThis.chrome = chrome }
})

test('Nextcloud refuses a cross-origin token exchange before opening a login tab', async () => {
  const fetch = globalThis.fetch, chrome = globalThis.chrome
  let opened = false, count = 0
  globalThis.chrome = { tabs: { create: async () => { opened = true } } }
  globalThis.fetch = async () => { count++; return Response.json(flow('https://another.example/poll')) }
  try {
    await assert.rejects(runNextcloudLogin('https://nextcloud.example', new AbortController().signal), /无法开始/)
    assert.equal(opened, false)
    assert.equal(count, 1)
  } finally { globalThis.fetch = fetch; globalThis.chrome = chrome }
})

test('cancelling Nextcloud login stops before another poll', async () => {
  const fetch = globalThis.fetch, chrome = globalThis.chrome, controller = new AbortController()
  let count = 0
  globalThis.chrome = { tabs: { create: async () => { controller.abort() } } }
  globalThis.fetch = async () => { count++; return Response.json(flow('https://nextcloud.example/poll')) }
  try {
    await assert.rejects(runNextcloudLogin('https://nextcloud.example', controller.signal), { name: 'AbortError' })
    assert.equal(count, 1)
  } finally { globalThis.fetch = fetch; globalThis.chrome = chrome }
})
