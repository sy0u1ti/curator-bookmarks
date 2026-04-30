import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BookmarkRecord } from '../src/shared/types.js'
import {
  indexBookmarkForSearch,
  normalizeQuery,
  scoreBookmark,
  searchBookmarks,
  searchBookmarksCooperatively
} from '../src/popup/search.js'

function bookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  const title = overrides.title || 'Example'
  const url = overrides.url || 'https://example.com'
  return {
    id: overrides.id || title,
    title,
    url,
    displayUrl: overrides.displayUrl || url,
    normalizedTitle: overrides.normalizedTitle || title.toLowerCase(),
    normalizedUrl: overrides.normalizedUrl || url.replace(/^https?:\/\//, '').toLowerCase(),
    duplicateKey: overrides.duplicateKey || url,
    domain: overrides.domain || 'example.com',
    path: overrides.path || 'Bookmarks Bar',
    ancestorIds: overrides.ancestorIds || ['1'],
    parentId: overrides.parentId || '1',
    index: overrides.index || 0,
    dateAdded: overrides.dateAdded || 0
  }
}

test('normalizes popup search queries for URL-like input', () => {
  assert.equal(normalizeQuery('  https://www.Example.com/docs  '), 'example.com/docs')
})

test('indexes bookmarks with path and domain search text', () => {
  const indexed = indexBookmarkForSearch(bookmark({
    title: 'OpenAI Docs',
    normalizedTitle: 'openai docs',
    normalizedUrl: 'platform.openai.com/docs',
    domain: 'platform.openai.com',
    path: 'AI / Docs'
  }))

  assert.equal(indexed.normalizedPath, 'ai / docs')
  assert.ok(indexed.searchText.includes('platform.openai.com'))
  assert.ok(indexed.searchText.includes('ai / docs'))
})

test('ranks exact and prefix title matches before weaker URL matches', () => {
  const exact = indexBookmarkForSearch(bookmark({
    id: 'exact',
    title: 'OpenAI',
    normalizedTitle: 'openai',
    normalizedUrl: 'example.com/openai'
  }))
  const urlOnly = indexBookmarkForSearch(bookmark({
    id: 'url',
    title: 'Reference',
    normalizedTitle: 'reference',
    normalizedUrl: 'openai.com/reference'
  }))

  const results = searchBookmarks('openai', [urlOnly, exact])
  assert.equal(results[0].id, 'exact')
  assert.ok(scoreBookmark(exact, 'openai', ['openai']) > scoreBookmark(urlOnly, 'openai', ['openai']))
})

test('cooperative search can be cancelled by caller state', async () => {
  const bookmarks = Array.from({ length: 1301 }, (_value, index) => {
    return indexBookmarkForSearch(bookmark({
      id: `bookmark-${index}`,
      title: `Bookmark ${index}`,
      normalizedTitle: `bookmark ${index}`,
      normalizedUrl: `example.com/${index}`
    }))
  })
  let active = true

  let cancellationMessage = ''
  try {
    await searchBookmarksCooperatively('bookmark', bookmarks, {
      isActive: () => active,
      yieldWork: async () => {
        active = false
      }
    })
  } catch (error) {
    cancellationMessage = error instanceof Error ? error.message : String(error)
  }
  assert.equal(cancellationMessage, 'search-cancelled')
})
