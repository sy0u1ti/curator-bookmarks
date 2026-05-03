import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDuplicateGroups } from '../src/options/sections/duplicates.js'
import { aiNamingState, availabilityState, contentSnapshotState } from '../src/options/shared-options/state.js'

function bookmark(id, url, parentId, ancestorIds = []) {
  return {
    id,
    title: `书签 ${id}`,
    url,
    duplicateKey: 'example.com/same',
    parentId,
    ancestorIds,
    path: parentId === '20' ? '书签栏 / 标签页' : '书签栏 / 资料',
    dateAdded: Number(id) || 1
  }
}

test('duplicate detection excludes bookmarks under configured folders', () => {
  availabilityState.folderMap = new Map([
    ['10', { title: '资料', path: '书签栏 / 资料' }],
    ['20', { title: '标签页', path: '书签栏 / 标签页' }]
  ])

  const groups = buildDuplicateGroups([
    bookmark('1', 'https://example.com/same', '10', ['1', '10']),
    bookmark('2', 'https://example.com/same', '20', ['1', '20'])
  ], {
    excludedFolderIds: ['20']
  })

  assert.equal(groups.length, 0)
})

test('duplicate detection keeps normal duplicates while dropping excluded copies', () => {
  availabilityState.folderMap = new Map([
    ['10', { title: '资料', path: '书签栏 / 资料' }],
    ['11', { title: '稍后读', path: '书签栏 / 稍后读' }],
    ['20', { title: '标签页', path: '书签栏 / 标签页' }]
  ])

  const groups = buildDuplicateGroups([
    bookmark('1', 'https://example.com/same', '10', ['1', '10']),
    bookmark('2', 'https://example.com/same', '11', ['1', '11']),
    bookmark('3', 'https://example.com/same', '20', ['1', '20'])
  ], {
    excludedFolderIds: ['20']
  })

  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].items.map((item) => String(item.id)).sort(), ['1', '2'])
})

test('duplicate detection excludes direct children by parent id', () => {
  const groups = buildDuplicateGroups([
    bookmark('1', 'https://example.com/same', '10'),
    bookmark('2', 'https://example.com/same', '20')
  ], {
    excludedFolderIds: ['20']
  })

  assert.equal(groups.length, 0)
})

test('duplicate recommendation prefers manual tags over recency', () => {
  availabilityState.folderMap = new Map([
    ['10', { title: '资料', path: '书签栏 / 资料' }],
    ['11', { title: '归档', path: '书签栏 / 归档' }]
  ])
  aiNamingState.tagIndex = {
    version: 1,
    updatedAt: 100,
    records: {
      1: {
        bookmarkId: '1',
        url: 'https://example.com/same',
        normalizedUrl: 'https://example.com/same',
        duplicateKey: 'example.com/same',
        title: 'Tagged',
        path: '书签栏 / 资料',
        summary: '',
        contentType: '',
        topics: [],
        tags: [],
        manualTags: ['keep'],
        aliases: [],
        confidence: 0,
        source: 'manual',
        model: '',
        extraction: { status: 'idle', warnings: [] },
        generatedAt: 0,
        updatedAt: 100
      }
    }
  }

  const groups = buildDuplicateGroups([
    { ...bookmark('1', 'https://example.com/same', '10'), dateAdded: 1 },
    { ...bookmark('2', 'https://example.com/same', '11'), dateAdded: 999 }
  ])

  assert.equal(groups[0].recommendedKeepId, '1')
  assert.equal(groups[0].recommendation.kind, 'manual-tags')
  assert.equal(groups[0].taggedItemId, '1')

  aiNamingState.tagIndex = { version: 1, updatedAt: 0, records: {} }
})

test('duplicate recommendation uses snapshot and newtab source signals when present', () => {
  availabilityState.folderMap = new Map([
    ['20', { title: '标签页', path: '书签栏 / 标签页' }],
    ['30', { title: '资料', path: '书签栏 / 资料' }]
  ])
  contentSnapshotState.index = {
    version: 1,
    updatedAt: 100,
    records: {
      3: {
        snapshotId: 'snapshot-3',
        bookmarkId: '3',
        url: 'https://example.com/same',
        title: 'Snapshot',
        summary: '已保存摘要',
        headings: [],
        canonicalUrl: '',
        finalUrl: '',
        contentType: '',
        source: 'local',
        extractionStatus: 'ok',
        extractedAt: 100,
        hasFullText: false,
        fullTextBytes: 0,
        fullTextStorage: 'none',
        warnings: []
      }
    }
  }

  const snapshotGroups = buildDuplicateGroups([
    { ...bookmark('3', 'https://example.com/same', '30'), dateAdded: 1 },
    { ...bookmark('4', 'https://example.com/same', '20'), dateAdded: 999 }
  ])
  assert.equal(snapshotGroups[0].recommendedKeepId, '3')
  assert.equal(snapshotGroups[0].recommendation.kind, 'summary')

  contentSnapshotState.index = { version: 1, updatedAt: 0, records: {} }
  const newTabGroups = buildDuplicateGroups([
    { ...bookmark('5', 'https://example.com/same', '30'), dateAdded: 999 },
    { ...bookmark('6', 'https://example.com/same', '20'), dateAdded: 1 }
  ])

  assert.equal(newTabGroups[0].recommendedKeepId, '6')
  assert.equal(newTabGroups[0].recommendation.kind, 'newtab-source')
  assert.equal(newTabGroups[0].newTabSourceItemId, '6')
})
