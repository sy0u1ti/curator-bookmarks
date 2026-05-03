import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildChromeFaviconUrl,
  formatFaviconAccentCssRgb,
  getFaviconAccentCacheEntry,
  normalizeFaviconAccentCache,
  removeFaviconAccentCacheEntry,
  selectFaviconAccentColor,
  upsertFaviconAccentCacheEntry
} from '../src/newtab/favicon-cache.js'

test('builds chrome favicon urls with page url, size and refresh token', () => {
  const faviconUrl = buildChromeFaviconUrl(
    'chrome-extension://extension-id/_favicon/',
    'https://example.com/docs?q=1',
    {
      size: 64,
      cacheToken: 123
    }
  )
  const parsedUrl = new URL(faviconUrl)

  assert.equal(parsedUrl.protocol, 'chrome-extension:')
  assert.equal(parsedUrl.host, 'extension-id')
  assert.equal(parsedUrl.pathname, '/_favicon/')
  assert.equal(parsedUrl.searchParams.get('pageUrl'), 'https://example.com/docs?q=1')
  assert.equal(parsedUrl.searchParams.get('size'), '64')
  assert.equal(parsedUrl.searchParams.get('cache'), '1')
  assert.equal(parsedUrl.searchParams.get('refresh'), '123')
})

test('normalizes favicon accent cache by age, color shape and limit', () => {
  const cache = normalizeFaviconAccentCache({
    stale: {
      url: 'https://stale.example/',
      color: { r: 10, g: 20, b: 30 },
      updatedAt: 1
    },
    newest: {
      url: 'https://newest.example/',
      color: { r: 260, g: 12.4, b: -5 },
      updatedAt: 1100
    },
    older: {
      url: 'https://older.example/',
      color: { r: 40, g: 50, b: 60 },
      updatedAt: 1000
    },
    invalid: {
      url: 'https://invalid.example/',
      color: null,
      updatedAt: 1200
    }
  }, {
    now: 1200,
    maxAgeMs: 500,
    limit: 1
  })

  assert.deepEqual(Object.keys(cache), ['newest'])
  assert.deepEqual(cache.newest.color, { r: 255, g: 12, b: 0 })
})

test('returns cached favicon accent only for the same bookmark url', () => {
  const cache = upsertFaviconAccentCacheEntry(
    {},
    '42',
    'https://example.com/',
    { r: 20, g: 120, b: 220 },
    { now: 1000 }
  )

  assert.equal(
    getFaviconAccentCacheEntry(cache, '42', 'https://changed.example/', { now: 1200 }),
    null
  )
  assert.deepEqual(
    getFaviconAccentCacheEntry(cache, '42', 'https://example.com/', { now: 1200 })?.color,
    { r: 20, g: 120, b: 220 }
  )
  assert.deepEqual(removeFaviconAccentCacheEntry(cache, '42'), {})
})

test('selects a saturated favicon accent color from image pixels', () => {
  const pixels = new Uint8ClampedArray([
    240, 240, 240, 255,
    35, 128, 220, 255,
    38, 132, 222, 255,
    34, 124, 215, 255,
    250, 250, 250, 255,
    12, 12, 12, 0
  ])

  const color = selectFaviconAccentColor(pixels)

  assert.ok(color)
  assert.match(formatFaviconAccentCssRgb(color), /^3[4-8] 12[4-9] 21[5-9]$/)
})
