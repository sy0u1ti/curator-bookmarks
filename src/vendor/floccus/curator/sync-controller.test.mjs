/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const imports = {
  '../src/lib/Account': 'Account',
  '../src/lib/browser/BrowserAccount': 'Account',
  '../src/lib/browser/BrowserAccountStorage': 'Storage',
  '../src/lib/browser/BrowserTree': 'Tree',
  '../src/lib/browser-api': 'browser',
}
const result = await build({
  entryPoints: ['src/vendor/floccus/curator/SyncController.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'controller-test-dependencies',
    setup(build) {
      build.onResolve({ filter: /^\.\.\/src\/lib\// }, args =>
        imports[args.path] ? { path: imports[args.path], namespace: 'controller-test' } : undefined)
      build.onLoad({ filter: /.*/, namespace: 'controller-test' }, args => ({
        contents: `export default globalThis.__curatorControllerTest.${args.path};`,
      }))
    },
  }],
})

async function scenario(run) {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout
  const previous = globalThis.__curatorControllerTest
  const data = { enabled: true, notifyOnly: false, syncing: false }
  const account = { id: 'qa', syncing: false, getData: () => ({ ...data }), setData: async changes => { Object.assign(data, changes) } }
  const timers = new Map()
  let next = 1
  globalThis.__curatorControllerTest = {
    Account: { get: async () => account },
    Storage: {}, Tree: {}, browser: {},
  }
  globalThis.setTimeout = (callback, delay) => {
    const id = next++
    timers.set(id, { callback, delay })
    return id
  }
  globalThis.clearTimeout = id => timers.delete(id)
  try {
    // A fresh module reads this test's dependency object instead of retaining
    // another scenario's mutable account.
    const code = result.outputFiles[0].text + `\n// scenario ${crypto.randomUUID()}`
    const { default: Controller } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    const controller = new Controller({})
    const calls = []
    controller.scheduleSync = async id => { calls.push({ id, action: 'sync' }) }
    controller.scheduleCheck = async id => { calls.push({ id, action: 'check' }) }
    const flush = async () => {
      const pending = [...timers.values()]
      timers.clear()
      for (const timer of pending) timer.callback()
      for (let index = 0; index < 5; index++) await Promise.resolve()
    }
    await run({ controller, account, data, timers, calls, flush })
  } finally {
    globalThis.setTimeout = originalSet
    globalThis.clearTimeout = originalClear
    globalThis.__curatorControllerTest = previous
  }
}

test('disabling automatic sync while a change is debounced prevents the upload', () => scenario(async ({ controller, account, data, calls, flush }) => {
  await controller.scheduleSyncOrCheck(account, true)
  data.enabled = false
  await flush()
  assert.deepEqual(calls, [])
}))

test('switching a pending upload to notify-only performs a check instead', () => scenario(async ({ controller, account, data, calls, flush }) => {
  await controller.scheduleSyncOrCheck(account, true)
  data.notifyOnly = true
  await flush()
  assert.deepEqual(calls, [{ id: 'qa', action: 'check' }])
}))

test('cancelling a debounced change clears its timer and does not disable future automatic changes', () => scenario(async ({ controller, account, data, calls, timers, flush }) => {
  await controller.scheduleSyncOrCheck(account, true)
  await controller.cancelSync(account.id, true)
  assert.equal(timers.size, 0)
  await flush()
  assert.deepEqual(calls, [])
  assert.equal(data.enabled, true)
  await controller.scheduleSyncOrCheck(account, true)
  await flush()
  assert.deepEqual(calls, [{ id: 'qa', action: 'sync' }])
}))

test('a burst of changes coalesces to one action using the current mode', () => scenario(async ({ controller, account, data, calls, timers, flush }) => {
  for (let index = 0; index < 4; index++) {
    data.notifyOnly = index % 2 === 1
    await controller.scheduleSyncOrCheck(account, true)
  }
  assert.equal(timers.size, 1)
  data.notifyOnly = false
  await flush()
  assert.deepEqual(calls, [{ id: 'qa', action: 'sync' }])
}))

async function runningScenario(run) {
  const previous = globalThis.__curatorControllerTest
  const data = {
    enabled: true, localRoot: 'root', strategy: 'default',
    syncing: false, scheduled: false, pendingChanges: null,
  }
  const calls = []
  const gates = []
  const tasks = []
  const hooks = {}
  let running = 0
  let maximumRunning = 0
  let notifications = 0
  let backups = 0
  const gate = () => {
    const value = Promise.withResolvers()
    gates.push(value)
    return value
  }
  const account = {
    id: 'qa', syncing: false,
    getData: () => ({ ...data }),
    getLabel: () => 'QA',
    setData: async changes => { Object.assign(data, changes) },
    cancelSync: async () => { account.syncing = false },
    async sync(strategy, forceSync) {
      running++
      maximumRunning = Math.max(maximumRunning, running)
      const attempt = calls.length + 1
      calls.push({ strategy, forceSync })
      account.syncing = true
      data.syncing = 0.5
      data.scheduled = false
      try {
        await hooks.beforeSuccess?.(attempt)
        account.syncing = false
        Object.assign(data, { syncing: false, scheduled: false, lastSync: attempt, error: null })
        await hooks.afterSuccess?.(attempt)
      } finally {
        running--
      }
    },
  }
  globalThis.__curatorControllerTest = {
    Account: { get: async () => account, getAllAccounts: async () => [account] },
    Storage: {}, Tree: {},
    browser: {
      runtime: { getPlatformInfo: async () => ({}) },
      notifications: {
        async clear() {
          notifications++
          await hooks.clearNotification?.(notifications)
        },
      },
    },
  }
  try {
    const code = result.outputFiles[0].text + `\nvoid ${JSON.stringify(crypto.randomUUID())}`
    const { default: Controller } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    const controller = new Controller({
      async beforeLocalOverwrite() {
        backups++
        await hooks.beforeOverwrite?.(backups)
      },
    })
    const start = (strategy, forceSync = false) => {
      const task = controller.syncAccount(account.id, strategy, forceSync)
      tasks.push(task)
      return task
    }
    await run({
      account, controller, data, hooks, calls, gate, start,
      maximumRunning: () => maximumRunning,
      backups: () => backups,
    })
  } finally {
    for (const pending of gates) pending.resolve()
    await Promise.allSettled(tasks)
    globalThis.__curatorControllerTest = previous
  }
}

test('a follow-up sync waits for account cleanup and retains its direction and force flag', () => runningScenario(async ({ hooks, gate, start, calls, maximumRunning }) => {
  const entered = gate(), release = gate()
  hooks.afterSuccess = async attempt => {
    if (attempt === 1) {
      entered.resolve()
      await release.promise
    }
  }
  const first = start()
  await entered.promise
  const second = start('slave', true)
  release.resolve()
  await Promise.all([first, second])
  assert.deepEqual(calls, [{ strategy: undefined, forceSync: false }, { strategy: 'slave', forceSync: true }])
  assert.equal(maximumRunning(), 1)
}))

test('a follow-up sync is retained while the completed run clears its notification', () => runningScenario(async ({ hooks, gate, start, calls }) => {
  const entered = gate(), release = gate()
  hooks.clearNotification = async attempt => {
    if (attempt === 1) {
      entered.resolve()
      await release.promise
    }
  }
  const first = start()
  await entered.promise
  const second = start('overwrite')
  release.resolve()
  await Promise.all([first, second])
  assert.deepEqual(calls, [{ strategy: undefined, forceSync: false }, { strategy: 'overwrite', forceSync: false }])
}))

test('requests arriving during recovery preparation run serially without losing their modes', () => runningScenario(async ({ hooks, gate, start, calls, backups, maximumRunning }) => {
  const entered = gate(), release = gate()
  hooks.beforeOverwrite = async attempt => {
    if (attempt === 1) {
      entered.resolve()
      await release.promise
    }
  }
  const first = start('slave')
  await entered.promise
  const second = start('overwrite', true)
  const third = start()
  release.resolve()
  await Promise.all([first, second, third])
  assert.deepEqual(calls, [
    { strategy: 'slave', forceSync: false },
    { strategy: 'overwrite', forceSync: true },
    { strategy: undefined, forceSync: false },
  ])
  assert.equal(backups(), 1)
  assert.equal(maximumRunning(), 1)
}))

test('cancelling during cleanup also cancels queued requests but allows a later explicit run', () => runningScenario(async ({ controller, account, data, hooks, gate, start, calls }) => {
  const entered = gate(), release = gate()
  hooks.clearNotification = async attempt => {
    if (attempt === 1) {
      entered.resolve()
      await release.promise
    }
  }
  const first = start()
  await entered.promise
  const second = start('slave')
  await controller.cancelSync(account.id, true)
  release.resolve()
  await Promise.all([first, second])
  assert.equal(calls.length, 1)
  assert.equal(data.scheduled, false)
  assert.equal(data.enabled, true)
  await start('overwrite')
  assert.equal(calls.length, 2)
}))

test('request admission reports maintenance conflicts before acknowledging a run', () => runningScenario(async ({ controller, account, gate, calls }) => {
  const entered = gate(), release = gate()
  const maintenance = controller.maintainProfile(account.id, async () => {
    entered.resolve()
    await release.promise
  })
  await entered.promise
  try {
    assert.throws(() => controller.requestSync(account.id), /运行|取消|完成/)
    assert.deepEqual(calls, [])
  } finally {
    release.resolve()
    await maintenance
  }
}))

test('immediate repeated requests transfer run ownership without discarding the next run', () => runningScenario(async ({ start, calls, maximumRunning }) => {
  for (let attempt = 0; attempt < 20; attempt++) await start()
  assert.equal(calls.length, 20)
  assert.equal(maximumRunning(), 1)
}))
