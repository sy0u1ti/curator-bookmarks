import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BackgroundRuntimeError, createBackgroundReadyCheck } from './background-runtime.js'

test('concurrent readers share a check against the installed worker', async () => {
  let requests = 0
  const ready = createBackgroundReadyCheck('new-build', async () => {
    requests++
    return { ok: true, result: { buildId: 'new-build' } }
  })
  await Promise.all([ready(), ready(), ready()])
  await ready()
  assert.equal(requests, 1)
})

test('a different background build rejects before the caller can mutate data', async () => {
  const ready = createBackgroundReadyCheck('new-build', async () => ({ ok: true, result: { buildId: 'old-build' } }))
  let mutations = 0
  await assert.rejects(async () => { await ready(); mutations++ }, (error: unknown) => {
    assert.ok(error instanceof BackgroundRuntimeError)
    assert.equal(error.code, 'background-outdated')
    return true
  })
  assert.equal(mutations, 0)
})

test('a missing legacy response and a closed port can both recover on an explicit retry', async () => {
  for (const fail of [async () => undefined, async () => { throw new Error('The message port closed') }]) {
    let requests = 0
    const ready = createBackgroundReadyCheck('build', () => ++requests === 1
      ? fail()
      : Promise.resolve({ ok: true, result: { buildId: 'build' } }))
    await assert.rejects(ready, (error: unknown) => error instanceof BackgroundRuntimeError && error.code === 'background-unavailable')
    await ready()
    assert.equal(requests, 2)
  }
})

test('a hung worker has a bounded wait and does not poison a later check', async () => {
  let requests = 0
  const ready = createBackgroundReadyCheck('build', () => ++requests === 1
    ? new Promise(() => {})
    : Promise.resolve({ ok: true, result: { buildId: 'build' } }), 10)
  await assert.rejects(ready, BackgroundRuntimeError)
  await ready()
})
