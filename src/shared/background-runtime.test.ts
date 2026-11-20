import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BackgroundRuntimeError, createBackgroundReadyCheck, recoverFromBackgroundRuntime } from './background-runtime.js'

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

test('a stale extension page reloads only once instead of looping', () => {
  const descriptors = ['window', 'document', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  const values = new Map<string, string>()
  let reloads = 0
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { reload: () => { reloads++ } } }
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: { dataset: { curatorSurface: 'popup' } } }
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    }
  })
  try {
    assert.equal(recoverFromBackgroundRuntime(new Error('not a runtime error')), false)
    const error = new BackgroundRuntimeError('background-outdated')
    assert.equal(recoverFromBackgroundRuntime(error), true)
    assert.equal(reloads, 1)
    assert.equal(recoverFromBackgroundRuntime(error), false)
    assert.equal(reloads, 1)
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
