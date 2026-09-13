import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDuplicateGroups } from '../options/sections/duplicates.js'
import { shouldReuseBookmarkForSave } from '../service-worker/save-guards.js'
import { normalizeBookmarkSaveUrl } from './bookmark-save-url.js'
import { extractBookmarkData } from './bookmark-tree.js'
import { buildDuplicateKey } from './text.js'

const distinctUrls = [
  ['http://example.com/guide', 'https://example.com/guide'],
  ['https://example.com/guide', 'https://www.example.com/guide'],
  ['https://example.com:8443/guide', 'https://example.com/guide'],
  ['https://example.com/Guide', 'https://example.com/guide'],
  ['https://example.com/guide', 'https://example.com/guide/'],
  ['https://example.com/?id=AbC', 'https://example.com/?id=abc'],
  ['https://example.com/?a=1&b=2', 'https://example.com/?b=2&a=1'],
  ['https://example.com/#/inbox', 'https://example.com/#/archive'],
  ['https://example.com/guide#install', 'https://example.com/guide#usage'],
  ['file:///C:/Docs/Guide.html', 'file:///D:/Docs/Guide.html'],
  ['javascript:alert("A")', 'javascript:alert("a")']
] as const

test('cleanup and quick save preserve every meaningful part of a bookmark URL', () => {
  for (const [left, right] of distinctUrls) {
    assert.notEqual(buildDuplicateKey(left), buildDuplicateKey(right), `${left} and ${right}`)
    assert.equal(shouldReuseBookmarkForSave(left, right), false, `Saving ${right} must not reuse ${left}`)
  }
})

test('URL identity still normalizes host case, default ports and the implicit root path', () => {
  assert.equal(buildDuplicateKey('https://EXAMPLE.com:443'), buildDuplicateKey('https://example.com/'))
  assert.equal(buildDuplicateKey('http://EXAMPLE.com:80/a'), buildDuplicateKey('http://example.com/a'))
  assert.equal(normalizeBookmarkSaveUrl('example.com/Guide'), buildDuplicateKey('https://example.com/Guide'))
  assert.equal(shouldReuseBookmarkForSave('', ''), false)
  assert.notEqual(buildDuplicateKey('invalid/Case'), buildDuplicateKey('invalid/case'))
})

test('the real cleanup catalog groups exact URL copies without suggesting distinct resources for removal', () => {
  const urls = [...new Set(distinctUrls.flat()), 'https://EXAMPLE.com:443/guide']
  const root: chrome.bookmarks.BookmarkTreeNode = {
    id: '0', title: '', syncing: false, children: [{
      id: '1', title: '书签栏', syncing: false, children: urls.map((url, index) => ({
        id: String(index + 10), parentId: '1', title: `Resource ${index}`, url, dateAdded: index, syncing: false
      }))
    }]
  }
  const groups = buildDuplicateGroups(extractBookmarkData(root).bookmarks)
  assert.equal(groups.length, 1)
  assert.deepEqual(new Set(groups[0].items.map(item => item.url)), new Set([
    'https://example.com/guide', 'https://EXAMPLE.com:443/guide'
  ]))
})
