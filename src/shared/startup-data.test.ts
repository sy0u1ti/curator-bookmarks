import assert from 'node:assert/strict'
import { consumeStartupData, prefetchStartupData } from './startup-data.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolveTask, rejectTask) => {
    resolve = resolveTask
    reject = rejectTask
  })
  return { promise, resolve, reject }
}

// A separately evaluated copy models the classic preboot bundle handing its
// pending RPC to Vite's module graph in the same document.
const secondModuleUrl = new URL('./startup-data.js?entry=react', import.meta.url).href
const secondModule: typeof import('./startup-data.js') = await import(secondModuleUrl)
const tree = deferred<string[]>()
let reads = 0
let unsubscribed = 0
prefetchStartupData('handoff', () => { reads++; return tree.promise }, () => () => { unsubscribed++ })
secondModule.prefetchStartupData('handoff', async () => { reads++; return ['duplicate'] })
assert.equal(reads, 1, 'Both entry points must share the first in-flight browser read.')
const firstRead = secondModule.consumeStartupData('handoff', async () => { reads++; return ['duplicate'] })
tree.resolve(['first'])
assert.deepEqual(await firstRead, ['first'])
assert.equal(unsubscribed, 1, 'The first consumer releases temporary invalidation listeners.')
assert.equal(reads, 1)

prefetchStartupData('handoff', async () => { reads++; return ['duplicate'] })
assert.equal(reads, 1, 'A late prefetch call must not cache data for the next refresh.')
assert.deepEqual(await consumeStartupData('handoff', async () => { reads++; return ['fresh'] }), ['fresh'])
assert.equal(reads, 2, 'Explicit refreshes must always load fresh data.')

let invalidate = () => {}
let staleCleanup = 0
const oldTree = deferred<string[]>()
prefetchStartupData('changed', () => oldTree.promise, onChange => {
  invalidate = onChange
  return () => { staleCleanup++ }
})
invalidate()
assert.deepEqual(await consumeStartupData('changed', async () => ['updated']), ['updated'])
assert.equal(staleCleanup, 1)
oldTree.reject(new Error('Abandoned read failed'))
await Promise.resolve()

const pendingTree = deferred<string[]>()
let invalidatePending = () => {}
let pendingCleanup = false
prefetchStartupData('changed-while-reading', () => pendingTree.promise, onChange => {
  invalidatePending = onChange
  return () => { pendingCleanup = true }
})
const pendingRead = consumeStartupData('changed-while-reading', async () => ['newer'])
assert.equal(pendingCleanup, false, 'Pending reads must keep their invalidation listener.')
invalidatePending()
pendingTree.resolve(['older'])
assert.deepEqual(await pendingRead, ['newer'], 'Changes during a pending prefetch must be reflected before hydration.')
assert.equal(pendingCleanup, true)

const readError = new Error('Chrome storage unavailable')
prefetchStartupData('rejected', async () => { throw readError })
await new Promise(resolve => setTimeout(resolve, 0))
await assert.rejects(consumeStartupData('rejected', async () => 'unexpected'), error => error === readError)
assert.equal(await consumeStartupData('rejected', async () => 'recovered'), 'recovered')

prefetchStartupData('throws', () => { throw readError })
await assert.rejects(consumeStartupData('throws', async () => 'unexpected'), error => error === readError)
assert.equal(await consumeStartupData('without-preboot', async () => 'fallback'), 'fallback')

prefetchStartupData('newtab-independent', async () => 'newtab')
prefetchStartupData('popup-independent', async () => 'popup')
assert.equal(await consumeStartupData('newtab-independent', async () => 'unexpected'), 'newtab')
assert.equal(await consumeStartupData('popup-independent', async () => 'unexpected'), 'popup')

console.log('Startup prefetch handoff, invalidation, refresh, and failure tests passed.')
