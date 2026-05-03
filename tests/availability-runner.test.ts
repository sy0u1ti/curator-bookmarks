import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createAvailabilityRunScheduler,
  formatAvailabilityRunnerStatus,
  getAvailabilityDomainKey,
  normalizeAvailabilitySpeedProfile,
  runAvailabilityQueue
} from '../src/options/sections/availability-runner.js'

test('normalizes the balanced availability profile from existing constants', () => {
  const profile = normalizeAvailabilitySpeedProfile('balanced')

  assert.equal(profile.name, 'balanced')
  assert.equal(profile.label, '平衡模式')
  assert.equal(profile.concurrency, 2)
  assert.equal(profile.domainConcurrency, 1)
  assert.equal(profile.navigationTimeoutMs, 30000)
  assert.equal(profile.retryNavigationTimeoutMs, 45000)
  assert.equal(profile.probeTimeoutMs, 20000)
})

test('limits one active task per domain while allowing another domain', () => {
  const scheduler = createAvailabilityRunScheduler({
    profile: {
      concurrency: 2,
      domainConcurrency: 1,
      pollIntervalMs: 10
    }
  })

  const first = scheduler.tryAcquire('https://example.com/a')
  assert.ok(first)
  assert.equal(scheduler.tryAcquire('https://www.example.com/b'), null)

  const secondDomain = scheduler.tryAcquire('https://docs.example.net/a')
  assert.ok(secondDomain)
  assert.equal(scheduler.tryAcquire('https://another.example.org/a'), null)

  first.release()
  const sameDomainAfterRelease = scheduler.tryAcquire('https://example.com/c')
  assert.ok(sameDomainAfterRelease)

  sameDomainAfterRelease.release()
  secondDomain.release()
  assert.equal(scheduler.getSnapshot().activeCount, 0)
})

test('records timeout and 429 outcomes as domain cooldowns', () => {
  let nowMs = 1000
  const scheduler = createAvailabilityRunScheduler({
    now: () => nowMs,
    profile: {
      timeoutCooldownMs: 3000,
      throttleCooldownMs: 8000,
      pollIntervalMs: 50
    }
  })

  scheduler.recordOutcome('https://slow.example/a', {
    errorCode: 'timeout',
    detail: '后台导航超时'
  })
  assert.equal(scheduler.getSnapshot().slowedDomainCount, 1)
  assert.equal(scheduler.getSnapshot().lastSlowdownReason, '超时')
  assert.equal(scheduler.tryAcquire('https://slow.example/b'), null)

  nowMs += 4000
  const recoveredLease = scheduler.tryAcquire('https://slow.example/c')
  assert.ok(recoveredLease)
  scheduler.recordOutcome('https://slow.example/c', { kind: 'success' })
  recoveredLease.release()

  scheduler.recordOutcome('https://api.example/a', { statusCode: 429 })
  const snapshot = scheduler.getSnapshot()
  assert.equal(snapshot.slowedDomainCount, 1)
  assert.equal(snapshot.lastSlowdownReason, 'HTTP 429')
  assert.match(formatAvailabilityRunnerStatus(snapshot), /自动降速/)
})

test('runs adaptive queue with same-domain serialization and cancellation checks', async () => {
  const scheduler = createAvailabilityRunScheduler({
    profile: {
      concurrency: 2,
      domainConcurrency: 1,
      pollIntervalMs: 1
    }
  })
  const activeByDomain = new Map<string, number>()
  const maxActiveByDomain = new Map<string, number>()
  const completed: string[] = []

  await runAvailabilityQueue({
    items: [
      { id: 'a', url: 'https://example.com/a' },
      { id: 'b', url: 'https://example.com/b' },
      { id: 'c', url: 'https://example.net/c' }
    ],
    scheduler,
    getUrl: (item) => item.url,
    wait: async () => {},
    shouldContinue: () => true,
    processItem: async (item, { scheduler: queueScheduler }) => {
      const domain = getAvailabilityDomainKey(item.url)
      const nextActive = (activeByDomain.get(domain) || 0) + 1
      activeByDomain.set(domain, nextActive)
      maxActiveByDomain.set(domain, Math.max(maxActiveByDomain.get(domain) || 0, nextActive))

      await new Promise((resolve) => setTimeout(resolve, 1))
      queueScheduler.recordOutcome(item.url, { kind: 'success' })
      completed.push(item.id)
      activeByDomain.set(domain, (activeByDomain.get(domain) || 1) - 1)
    }
  })

  assert.deepEqual(new Set(completed), new Set(['a', 'b', 'c']))
  assert.equal(maxActiveByDomain.get('example.com'), 1)
  assert.equal(scheduler.getSnapshot().activeCount, 0)
})
