import assert from 'node:assert/strict'
import {
  ACTIVE_FAVICON_MISS_TTL_MS,
  ACTIVE_FAVICON_POSITIVE_TTL_MS,
  buildActiveFaviconCandidates,
  getActiveFaviconOrigin,
  getChromeFaviconSourcePageUrl,
  getChromeFaviconSourceSize,
  isActiveFaviconEntryFresh,
  isChromeFaviconSource,
  mergeActiveFaviconStorePayload,
  normalizeActiveFaviconStore
} from './active-favicon.js'

assert.deepEqual(
  buildActiveFaviconCandidates('https://www.bilibili.com/video/BV1xx'),
  ['https://www.bilibili.com/favicon.ico', 'https://www.bilibili.com/apple-touch-icon.png'],
  'active candidates should target the bookmark origin root'
)
assert.deepEqual(buildActiveFaviconCandidates('chrome://extensions'), [], 'non-http bookmarks keep the browser icon source')
assert.deepEqual(buildActiveFaviconCandidates('not a url'), [])
assert.deepEqual(buildActiveFaviconCandidates(''), [])

assert.equal(getActiveFaviconOrigin('https://example.com/a?b=1#c'), 'https://example.com')
assert.equal(getActiveFaviconOrigin('http://example.com:8080/x'), 'http://example.com:8080')
assert.equal(getActiveFaviconOrigin('ftp://example.com/'), '')
assert.equal(getActiveFaviconOrigin('chrome-extension://abc/page.html'), '')

const chromeSource = 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs%3Fq%3D1&size=64&cache=1'
assert.equal(isChromeFaviconSource(chromeSource), true)
assert.equal(isChromeFaviconSource('https://example.com/favicon.ico'), false)
assert.equal(isChromeFaviconSource('data:image/png;base64,AAAA'), false)
assert.equal(getChromeFaviconSourcePageUrl(chromeSource), 'https://example.com/docs?q=1')
assert.equal(getChromeFaviconSourcePageUrl('https://example.com/'), '')
assert.equal(getChromeFaviconSourceSize(chromeSource), 64)
assert.equal(getChromeFaviconSourceSize('chrome-extension://id/_favicon/?pageUrl=x'), 32)
assert.equal(getChromeFaviconSourceSize('chrome-extension://id/_favicon/?pageUrl=x&size=999'), 32)

const now = 1_700_000_000_000
assert.equal(
  isActiveFaviconEntryFresh({ src: 'https://example.com/favicon.ico', at: now - ACTIVE_FAVICON_POSITIVE_TTL_MS + 1000 }, now),
  true
)
assert.equal(
  isActiveFaviconEntryFresh({ src: 'https://example.com/favicon.ico', at: now - ACTIVE_FAVICON_POSITIVE_TTL_MS - 1000 }, now),
  false
)
assert.equal(isActiveFaviconEntryFresh({ src: '', at: now - ACTIVE_FAVICON_MISS_TTL_MS + 1000 }, now), true)
assert.equal(isActiveFaviconEntryFresh({ src: '', at: now - ACTIVE_FAVICON_MISS_TTL_MS - 1000 }, now), false)

const normalized = normalizeActiveFaviconStore({
  entries: {
    'https://a.example': { src: 'https://a.example/favicon.ico', at: 30 },
    'https://b.example': { src: '', at: 20 },
    'bad-origin': { src: 'https://c.example/favicon.ico', at: 10 },
    'https://c.example': { src: 'file:///tmp/icon.png', at: 25 },
    'https://d.example': { src: 'https://d.example/icon.png' }
  }
})
assert.deepEqual(Object.keys(normalized.entries).sort(), ['https://a.example', 'https://b.example'])
assert.equal(normalized.entries['https://a.example'].src, 'https://a.example/favicon.ico')
assert.equal(normalized.entries['https://b.example'].src, '')

const merged = mergeActiveFaviconStorePayload(
  { entries: { 'https://a.example': { src: 'https://a.example/favicon.ico', at: 30 } } },
  {
    entries: {
      'https://a.example': { src: '', at: 40 },
      'https://b.example': { src: 'https://b.example/apple-touch-icon.png', at: 20 }
    }
  }
)
assert.equal(merged.entries['https://a.example'].src, '', 'the newer negative result should win the merge')
assert.equal(merged.entries['https://b.example'].src, 'https://b.example/apple-touch-icon.png')

console.log('Active favicon tests passed.')
