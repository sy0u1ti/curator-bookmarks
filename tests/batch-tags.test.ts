import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyBatchManualTagOperation,
  buildBookmarkTagUsageSummary,
  getEffectiveBookmarkTags,
  getUntaggedBookmarkIds,
  type BookmarkTagIndex
} from '../src/shared/bookmark-tags.js'

const bookmarks = [
  { id: '1', title: 'React Table', url: 'https://example.com/react', path: '前端' },
  { id: '2', title: 'TypeScript', url: 'https://example.com/ts', path: '前端' },
  { id: '3', title: 'No Tags', url: 'https://example.com/empty', path: '待整理' }
]

const tagIndex: BookmarkTagIndex = {
  version: 1,
  updatedAt: 1,
  records: {
    1: {
      schemaVersion: 1,
      bookmarkId: '1',
      url: 'https://example.com/react',
      normalizedUrl: 'https://example.com/react',
      duplicateKey: 'https://example.com/react',
      title: 'React Table',
      path: '前端',
      summary: '',
      contentType: '',
      topics: [],
      tags: ['AI 标签', 'React'],
      manualTags: ['手动标签'],
      manualUpdatedAt: 1,
      aliases: [],
      confidence: 0.8,
      source: 'ai_naming',
      model: 'fixture',
      extraction: { status: '', source: '', warnings: [] },
      generatedAt: 1,
      updatedAt: 1
    },
    2: {
      schemaVersion: 1,
      bookmarkId: '2',
      url: 'https://example.com/ts',
      normalizedUrl: 'https://example.com/ts',
      duplicateKey: 'https://example.com/ts',
      title: 'TypeScript',
      path: '前端',
      summary: '',
      contentType: '',
      topics: [],
      tags: ['AI 标签', 'TypeScript'],
      aliases: [],
      confidence: 0.7,
      source: 'ai_naming',
      model: 'fixture',
      extraction: { status: '', source: '', warnings: [] },
      generatedAt: 1,
      updatedAt: 1
    }
  }
}

test('effective tags prefer manual tags and keep AI tags stored', () => {
  assert.deepEqual(getEffectiveBookmarkTags(tagIndex.records['1']), ['手动标签'])
  assert.deepEqual(tagIndex.records['1'].tags, ['AI 标签', 'React'])
})

test('batch add creates manual tags from effective tags without deleting AI tags', () => {
  const result = applyBatchManualTagOperation(tagIndex, bookmarks, {
    type: 'add',
    bookmarkIds: ['2'],
    tags: ['手动新增'],
    now: 2
  })

  assert.equal(result.changed.length, 1)
  assert.deepEqual(result.index.records['2'].manualTags, ['AI 标签', 'TypeScript', '手动新增'])
  assert.deepEqual(result.index.records['2'].tags, ['AI 标签', 'TypeScript'])
})

test('batch remove only removes manual tags', () => {
  const result = applyBatchManualTagOperation(tagIndex, bookmarks, {
    type: 'remove',
    bookmarkIds: ['1', '2'],
    tags: ['手动标签', 'AI 标签'],
    now: 2
  })

  assert.deepEqual(result.index.records['1'].manualTags, undefined)
  assert.deepEqual(result.index.records['2'].manualTags, undefined)
  assert.deepEqual(result.index.records['2'].tags, ['AI 标签', 'TypeScript'])
})

test('batch rename AI-only effective tag writes manual override and preserves AI tags', () => {
  const result = applyBatchManualTagOperation(tagIndex, bookmarks, {
    type: 'rename',
    bookmarkIds: ['2'],
    fromTag: 'TypeScript',
    toTag: 'TS',
    now: 2
  })

  assert.deepEqual(result.index.records['2'].manualTags, ['AI 标签', 'TS'])
  assert.deepEqual(result.index.records['2'].tags, ['AI 标签', 'TypeScript'])
})

test('usage summary reports untagged bookmarks', () => {
  const summary = buildBookmarkTagUsageSummary(tagIndex, bookmarks)
  assert.equal(summary.totalBookmarks, 3)
  assert.equal(summary.manualTaggedBookmarks, 1)
  assert.equal(summary.aiOnlyTaggedBookmarks, 1)
  assert.equal(summary.untaggedBookmarks, 1)
  assert.deepEqual(getUntaggedBookmarkIds(tagIndex, bookmarks), ['3'])
})
