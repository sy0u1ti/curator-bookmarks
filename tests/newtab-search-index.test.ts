import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildNewTabSearchIndex,
  getSearchBookmarkSuggestionsFromIndex,
  normalizeNewTabSearchText
} from '../src/newtab/content-state.js'

test('builds a reusable newtab search index from bookmark sections', () => {
  const index = buildNewTabSearchIndex([
    {
      title: 'Work',
      path: 'Bookmarks / Work',
      bookmarks: [
        { id: '1', title: 'React Table Guide', url: 'https://example.com/react-table' },
        { id: '2', title: 'Empty URL', url: '' }
      ]
    },
    {
      title: 'Design',
      path: 'Bookmarks / Design',
      bookmarks: [
        { id: '3', title: '', url: 'https://design.example.com/' }
      ]
    }
  ])

  assert.equal(index.length, 2)
  assert.deepEqual(
    index.map((entry) => ({
      id: entry.id,
      title: entry.title,
      folderTitle: entry.folderTitle,
      order: entry.order
    })),
    [
      { id: '1', title: 'React Table Guide', folderTitle: 'Work', order: 0 },
      { id: '3', title: 'https://design.example.com/', folderTitle: 'Design', order: 1 }
    ]
  )
})

test('uses precomputed normalized fields when ranking newtab bookmark suggestions', () => {
  const index = buildNewTabSearchIndex([
    {
      title: 'Development',
      path: 'Bookmarks / Development',
      bookmarks: [
        { id: '1', title: 'React Table Guide', url: 'https://example.com/react-table' },
        { id: '2', title: 'Weekly Notes', url: 'https://example.com/react-notes' },
        { id: '3', title: 'Design Tokens', url: 'https://example.com/tokens' }
      ]
    },
    {
      title: 'React',
      path: 'Bookmarks / React',
      bookmarks: [
        { id: '4', title: 'Hooks Reference', url: 'https://example.com/hooks' }
      ]
    }
  ])

  const suggestions = getSearchBookmarkSuggestionsFromIndex('react', index, 4)

  assert.deepEqual(
    suggestions.map((suggestion) => ({
      id: suggestion.id,
      score: suggestion.score,
      order: suggestion.order
    })),
    [
      { id: '1', score: 1, order: 0 },
      { id: '2', score: 3, order: 1 },
      { id: '4', score: 4, order: 3 }
    ]
  )
})

test('normalizes newtab search text consistently', () => {
  assert.equal(normalizeNewTabSearchText('  Ｒｅａｃｔ   TABLE  '), 'react table')
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('', [], 6), [])
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('react', [], 0), [])
})
