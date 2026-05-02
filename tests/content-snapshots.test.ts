import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildContentSnapshotRecord,
  buildContentSnapshotSearchText,
  normalizeContentSnapshotSettings
} from '../src/shared/content-snapshots.js'
import { CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT } from '../src/shared/constants.js'

const bookmark = {
  id: '42',
  title: 'React 文档',
  url: 'https://react.dev/learn'
}

test('content snapshot keeps summary and headings searchable by default', () => {
  const { record } = buildContentSnapshotRecord({
    bookmark,
    context: {
      finalUrl: 'https://react.dev/learn',
      canonicalUrl: 'https://react.dev/learn',
      description: 'React 官方学习文档',
      headings: ['快速开始', '添加交互'],
      contentType: 'documentation',
      mainText: 'React lets you build user interfaces.'
    },
    settings: normalizeContentSnapshotSettings({ saveFullText: false }),
    now: 1000
  })

  assert.equal(record.summary, 'React 官方学习文档')
  assert.deepEqual(record.headings, ['快速开始', '添加交互'])
  assert.equal(record.hasFullText, false)
  assert.match(buildContentSnapshotSearchText(record), /react 官方学习文档/)
  assert.match(buildContentSnapshotSearchText(record), /快速开始/)
})

test('content snapshot stores short full text in local index', () => {
  const { record, fullTextRecord } = buildContentSnapshotRecord({
    bookmark,
    context: {
      mainText: '短正文用于全文搜索',
      contentType: 'article'
    },
    settings: normalizeContentSnapshotSettings({ saveFullText: true }),
    now: 1000
  })

  assert.equal(record.fullTextStorage, 'local')
  assert.equal(record.fullText, '短正文用于全文搜索')
  assert.equal(fullTextRecord, null)
})

test('content snapshot settings preserve independent storage fields', () => {
  const settings = normalizeContentSnapshotSettings({
    enabled: false,
    saveFullText: true,
    fullTextSearchEnabled: true,
    localOnlyNoAiUpload: true
  })

  assert.equal(settings.enabled, false)
  assert.equal(settings.saveFullText, true)
  assert.equal(settings.fullTextSearchEnabled, true)
  assert.equal(settings.localOnlyNoAiUpload, true)
})

test('content snapshot moves full text over 20KB to IndexedDB record', () => {
  const largeText = 'a'.repeat(CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT + 1)
  const { record, fullTextRecord } = buildContentSnapshotRecord({
    bookmark,
    context: {
      mainText: largeText,
      contentType: 'article'
    },
    settings: normalizeContentSnapshotSettings({ saveFullText: true }),
    now: 1000
  })

  assert.equal(record.fullTextStorage, 'idb')
  assert.equal(record.fullText, undefined)
  assert.equal(record.fullTextRef, record.snapshotId)
  assert.equal(fullTextRecord?.text.length, CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT + 1)
})
