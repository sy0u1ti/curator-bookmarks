import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createMemoryCache } from '../src/shared/cache.js'

test('memory cache stores and retrieves values', () => {
  const cache = createMemoryCache<string, number>({ maxEntries: 2 })

  cache.set('a', 1)

  assert.equal(cache.get('a'), 1)
  assert.equal(cache.size, 1)
})

test('memory cache has checks entries even when value is undefined', () => {
  const cache = createMemoryCache<string, undefined>({ maxEntries: 2 })

  cache.set('present', undefined)

  assert.equal(cache.has('present'), true)
  assert.equal(cache.get('missing'), undefined)
  assert.equal(cache.has('missing'), false)
})

test('memory cache normalizes keys before lookup', () => {
  const cache = createMemoryCache<string, string>({
    maxEntries: 2,
    normalizeKey: (key) => key.trim().toLowerCase()
  })

  cache.set('  React ', 'docs')

  assert.equal(cache.get('react'), 'docs')
  assert.equal(cache.has(' REACT '), true)
})

test('memory cache evicts the least recently used entry past capacity', () => {
  const cache = createMemoryCache<string, number>({ maxEntries: 2 })

  cache.set('a', 1)
  cache.set('b', 2)
  assert.equal(cache.get('a'), 1)
  cache.set('c', 3)

  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.get('a'), 1)
  assert.equal(cache.get('c'), 3)
})

test('memory cache expires entries by ttl', () => {
  let now = 100
  const cache = createMemoryCache<string, string>({
    maxEntries: 2,
    ttlMs: 50,
    now: () => now
  })

  cache.set('query', 'result')
  now = 149
  assert.equal(cache.get('query'), 'result')

  now = 199
  assert.equal(cache.get('query'), undefined)
  assert.equal(cache.size, 0)
})

test('memory cache clears entries on version change', () => {
  const cache = createMemoryCache<string, string>({
    maxEntries: 2,
    version: 'bookmarks-v1'
  })

  cache.set('query', 'result')
  cache.setVersion('bookmarks-v2')

  assert.equal(cache.get('query'), undefined)
  assert.equal(cache.size, 0)
})

test('memory cache prunes stale entries without touching valid entries', () => {
  let now = 0
  const cache = createMemoryCache<string, number>({
    maxEntries: 3,
    ttlMs: 100,
    now: () => now
  })

  cache.set('old', 1)
  now = 50
  cache.set('fresh', 2)
  now = 101
  cache.prune()

  assert.equal(cache.get('old'), undefined)
  assert.equal(cache.get('fresh'), 2)
  assert.deepEqual([...cache.keys()], ['fresh'])
})
