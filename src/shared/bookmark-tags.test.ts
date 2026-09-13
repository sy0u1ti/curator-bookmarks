import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createEmptyBookmarkTagIndex,
  mergeBookmarkTagImport,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTagRecord,
  type BookmarkTagRecord
} from './bookmark-tags.js'

function buildRecord(
  bookmarkId: string,
  url: string,
  overrides: Partial<BookmarkTagRecord> = {}
): BookmarkTagRecord {
  const record = normalizeBookmarkTagRecord({
    bookmarkId,
    url,
    title: bookmarkId,
    path: 'Bookmarks bar / Work',
    tags: ['saved'],
    source: 'imported',
    generatedAt: 10,
    updatedAt: 10,
    ...overrides
  })
  assert.ok(record)
  return record
}

test('tag import rejects a cross-profile ID collision and matches the actual URL', () => {
  const record = buildRecord('10', 'https://saved.example/guide')
  const result = mergeBookmarkTagImport(createEmptyBookmarkTagIndex(), {
    records: [record]
  }, [
    { id: '10', url: 'https://unrelated.example/', path: record.path },
    { id: '25', url: record.url, path: record.path }
  ])

  assert.equal(result.added, 1)
  assert.equal(result.unmatched, 0)
  assert.deepEqual(Object.keys(result.index.records), ['25'])
  assert.equal(result.index.records['25'].url, record.url)
})

for (const [label, importedUrl, collidingUrl] of [
  ['fragment routes', 'https://saved.example/#/A', 'https://saved.example/#/B'],
  ['trailing slashes', 'https://saved.example/guide', 'https://saved.example/guide/']
]) {
  test(`tag import distinguishes ${label} when profile IDs collide`, () => {
    const record = buildRecord('10', importedUrl)
    const result = mergeBookmarkTagImport(createEmptyBookmarkTagIndex(), {
      records: [record]
    }, [
      { id: '10', url: collidingUrl, path: record.path },
      { id: '25', url: importedUrl, path: record.path }
    ])

    assert.equal(result.added, 1)
    assert.equal(result.unmatched, 0)
    assert.deepEqual(Object.keys(result.index.records), ['25'])
    assert.equal(result.index.records['25'].url, importedUrl)
  })
}

test('tag import derives URL identity from the URL instead of stale exported lookup fields', () => {
  const record = buildRecord('10', 'https://saved.example/guide', {
    normalizedUrl: 'https://unrelated.example',
    duplicateKey: 'https://unrelated.example'
  })
  const result = mergeBookmarkTagImport(createEmptyBookmarkTagIndex(), {
    records: [record]
  }, [{ id: '10', url: 'https://unrelated.example/', path: record.path }])

  assert.equal(result.unmatched, 1)
  assert.deepEqual(result.index.records, {})
})

test('tag import keeps same-URL records separate by folder even when profile IDs collide', () => {
  const url = 'https://shared.example/guide'
  const result = mergeBookmarkTagImport(createEmptyBookmarkTagIndex(), {
    records: [
      buildRecord('10', url, { path: 'Bookmarks bar / Work', tags: ['work'] }),
      buildRecord('20', url, { path: 'Bookmarks bar / Personal', tags: ['personal'] })
    ]
  }, [
    { id: '10', url, path: 'Bookmarks bar / Personal' },
    { id: '20', url, path: 'Bookmarks bar / Work' }
  ])

  assert.equal(result.added, 2)
  assert.deepEqual(result.index.records['20'].tags, ['work'])
  assert.deepEqual(result.index.records['10'].tags, ['personal'])
})

test('tag import preserves distinct folders whose names differ only in case', () => {
  const url = 'https://shared.example/guide'
  const result = mergeBookmarkTagImport(createEmptyBookmarkTagIndex(), {
    records: [
      buildRecord('10', url, { path: 'Bookmarks bar / Work', tags: ['upper'] }),
      buildRecord('20', url, { path: 'Bookmarks bar / work', tags: ['lower'] })
    ]
  }, [
    { id: '10', url, path: 'Bookmarks bar / work' },
    { id: '20', url, path: 'Bookmarks bar / Work' }
  ])

  assert.equal(result.added, 2)
  assert.deepEqual(result.index.records['20'].tags, ['upper'])
  assert.deepEqual(result.index.records['10'].tags, ['lower'])
})

test('tag import preserves a verified ID after a folder move and accepts standard URL equivalences', () => {
  const record = buildRecord('10', 'HTTPS://SAVED.EXAMPLE:443/guide')
  const result = mergeBookmarkTagImport(createEmptyBookmarkTagIndex(), {
    records: [record]
  }, [{ id: '10', url: 'https://saved.example/guide', path: 'Bookmarks bar / Renamed' }])

  assert.equal(result.added, 1)
  assert.equal(result.index.records['10'].path, 'Bookmarks bar / Renamed')
})

test('tag import reports ambiguous URL matches instead of choosing an arbitrary folder', () => {
  const url = 'https://shared.example/guide'
  const result = mergeBookmarkTagImport(createEmptyBookmarkTagIndex(), {
    records: [buildRecord('old-profile-id', url, { path: '' })]
  }, [
    { id: '10', url, path: 'Bookmarks bar / Work' },
    { id: '20', url, path: 'Bookmarks bar / Personal' }
  ])

  assert.equal(result.unmatched, 1)
  assert.deepEqual(result.index.records, {})
})

test('tag import preserves newer records and current manual tags when importing newer AI data', () => {
  const url = 'https://saved.example/guide'
  const currentRecord = buildRecord('25', url, {
    tags: ['current-ai'],
    manualTags: ['my-choice'],
    manualUpdatedAt: 30,
    updatedAt: 30
  })
  const current = normalizeBookmarkTagIndex({ records: { 25: currentRecord } })
  const bookmarks = [{ id: '25', url, path: currentRecord.path }]
  const olderResult = mergeBookmarkTagImport(current, {
    records: [buildRecord('10', url, { tags: ['old-ai'], updatedAt: 20 })]
  }, bookmarks)
  assert.equal(olderResult.skipped, 1)
  assert.deepEqual(olderResult.index.records['25'], currentRecord)

  for (const manualFields of [{}, { manualTags: ['old-choice'], manualUpdatedAt: 20 }]) {
    const result = mergeBookmarkTagImport(current, {
      records: [buildRecord('10', url, { tags: ['new-ai'], updatedAt: 40, ...manualFields })]
    }, bookmarks)
    assert.equal(result.overwritten, 1)
    assert.deepEqual(result.index.records['25'].tags, ['new-ai'])
    assert.deepEqual(result.index.records['25'].manualTags, ['my-choice'])
    assert.equal(result.index.records['25'].manualUpdatedAt, 30)
  }
})

test('tag import accepts an explicitly newer manual choice', () => {
  const url = 'https://saved.example/guide'
  const currentRecord = buildRecord('25', url, {
    manualTags: ['old-choice'],
    manualUpdatedAt: 20,
    updatedAt: 20
  })
  const result = mergeBookmarkTagImport(
    normalizeBookmarkTagIndex({ records: { 25: currentRecord } }),
    { records: [buildRecord('10', url, {
      manualTags: ['new-choice'],
      manualUpdatedAt: 40,
      updatedAt: 40
    })] },
    [{ id: '25', url, path: currentRecord.path }]
  )

  assert.deepEqual(result.index.records['25'].manualTags, ['new-choice'])
  assert.equal(result.index.records['25'].manualUpdatedAt, 40)
})
