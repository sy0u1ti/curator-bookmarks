import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildDashboardFolderBookmarkCounts,
  buildDashboardModel,
  filterAndSortDashboardItems,
  filterDashboardItems,
  getDashboardDateMeta,
  getDashboardFolderTargets,
  getDashboardTopFolder,
  sortDashboardItems
} from '../src/shared/dashboard-model.js'
import type { BookmarkTagIndex } from '../src/shared/bookmark-tags.js'
import type { ContentSnapshotIndex } from '../src/shared/content-snapshots.js'
import type { BookmarkRecord, FolderRecord } from '../src/shared/types.js'

function bookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  const title = overrides.title || 'Example'
  const url = overrides.url || 'https://example.com'
  const normalizedUrl = overrides.normalizedUrl || url.replace(/^https?:\/\//, '').toLowerCase()
  return {
    id: overrides.id || title,
    title,
    url,
    displayUrl: overrides.displayUrl || url,
    normalizedTitle: overrides.normalizedTitle || title.toLowerCase(),
    normalizedUrl,
    duplicateKey: overrides.duplicateKey || normalizedUrl,
    domain: overrides.domain || '',
    path: overrides.path || '书签栏 / 工具',
    ancestorIds: overrides.ancestorIds || ['1', '10'],
    parentId: overrides.parentId || '10',
    index: overrides.index || 0,
    dateAdded: overrides.dateAdded ?? Date.UTC(2026, 0, 2, 3, 4, 5)
  }
}

function folder(overrides: Partial<FolderRecord>): FolderRecord {
  const title = overrides.title || '工具'
  const path = overrides.path || `书签栏 / ${title}`
  return {
    id: overrides.id || title,
    title,
    path,
    normalizedTitle: overrides.normalizedTitle || title.toLowerCase(),
    normalizedPath: overrides.normalizedPath || path.toLowerCase(),
    depth: overrides.depth ?? 1,
    folderCount: overrides.folderCount ?? 0,
    bookmarkCount: overrides.bookmarkCount ?? 0
  }
}

test('builds dashboard items with folder, date, tag, snapshot and summary metadata', () => {
  const bookmarks = [
    bookmark({
      id: 'b1',
      title: 'React Table Guide',
      url: 'https://docs.example.com/react-table',
      path: '书签栏 / 开发 / React',
      ancestorIds: ['1', '10'],
      parentId: '10',
      dateAdded: Date.UTC(2026, 1, 3, 4, 5, 6)
    }),
    bookmark({
      id: 'b2',
      title: 'Untimed',
      url: 'https://unknown.example.com',
      parentId: 'missing',
      ancestorIds: [],
      dateAdded: 0
    })
  ]
  const folders = [
    folder({ id: '0', title: 'root', path: 'root' }),
    folder({ id: '1', title: '开发', path: '书签栏 / 开发', folderCount: 1, bookmarkCount: 0 }),
    folder({ id: '10', title: 'React', path: '书签栏 / 开发 / React', bookmarkCount: 1 })
  ]
  const tagIndex: BookmarkTagIndex = {
    version: 1,
    updatedAt: 1,
    records: {
      b1: {
        schemaVersion: 1,
        bookmarkId: 'b1',
        url: bookmarks[0].url,
        normalizedUrl: bookmarks[0].url,
        duplicateKey: bookmarks[0].url,
        title: 'React 表格教程',
        path: '开发 / React',
        summary: '  advanced table filtering   ',
        contentType: '教程',
        topics: ['前端', '表格'],
        tags: ['ai tag'],
        manualTags: ['React', 'Data Grid'],
        aliases: ['TanStack'],
        confidence: 0.9,
        source: 'ai_naming',
        model: 'test-model',
        extraction: { status: 'ok', source: 'html', warnings: [] },
        generatedAt: 1,
        updatedAt: 1
      }
    }
  }
  const contentSnapshotIndex: ContentSnapshotIndex = {
    version: 1,
    updatedAt: 1,
    records: {
      b1: {
        snapshotId: 's1',
        bookmarkId: 'b1',
        url: bookmarks[0].url,
        title: 'Snapshot title',
        summary: 'snapshot includes column pinning',
        headings: ['Virtualized Rows'],
        canonicalUrl: '',
        finalUrl: bookmarks[0].url,
        contentType: 'article',
        source: 'html',
        extractionStatus: 'ok',
        extractedAt: 1,
        hasFullText: false,
        fullTextBytes: 0,
        fullTextStorage: 'none',
        warnings: []
      }
    }
  }

  const model = buildDashboardModel({ bookmarks, folders, tagIndex, contentSnapshotIndex })
  const first = model.items[0]

  assert.equal(model.totalBookmarks, 2)
  assert.equal(model.totalFolders, 2)
  assert.equal(model.domainCount, 2)
  assert.equal(model.unknownDateCount, 1)
  assert.equal(first.folderTitle, 'React')
  assert.equal(first.topFolderId, '1')
  assert.equal(first.topFolderTitle, '开发')
  assert.equal(first.monthKey, '2026-02')
  assert.equal(first.hasKnownDate, true)
  assert.deepEqual(first.tags, ['React', 'Data Grid'])
  assert.deepEqual(first.aiTags, ['ai tag'])
  assert.equal(first.hasManualTags, true)
  assert.equal(first.tagSummary, 'React / Data Grid')
  assert.equal(first.summary, 'advanced table filtering')
  assert.equal(first.searchText.includes('column pinning'), true)
  assert.deepEqual(first.normalizedAncestorIds, ['1', '10'])
  assert.equal(model.items[1].folderTitle, '书签栏 / 工具')
  assert.equal(model.items[1].monthKey, 'unknown')
})

test('dashboard model reuses the hydrated snapshot search map when provided', () => {
  const contentSnapshotIndex: ContentSnapshotIndex = {
    version: 1,
    updatedAt: 1,
    records: {
      b1: {
        snapshotId: 's1',
        bookmarkId: 'b1',
        url: 'https://docs.example.com/react-table',
        title: 'Snapshot title',
        summary: 'slow fallback snapshot term',
        headings: [],
        canonicalUrl: '',
        finalUrl: 'https://docs.example.com/react-table',
        contentType: 'article',
        source: 'html',
        extractionStatus: 'ok',
        extractedAt: 1,
        hasFullText: false,
        fullTextBytes: 0,
        fullTextStorage: 'none',
        warnings: []
      }
    }
  }
  const hydratedSearchMap = new Map([['b1', 'precomputed fast search term']])
  const model = buildDashboardModel({
    bookmarks: [bookmark({ id: 'b1', title: 'React Table Guide' })],
    contentSnapshotIndex,
    contentSnapshotSearchMap: hydratedSearchMap
  })

  assert.equal(model.items[0].searchText.includes('precomputed fast search term'), true)
  assert.equal(model.items[0].searchText.includes('slow fallback snapshot term'), false)
})

test('filters dashboard items by query, folder ancestor, domain and month', () => {
  const model = buildDashboardModel({
    bookmarks: [
      bookmark({
        id: 'b1',
        title: 'React Table Guide',
        url: 'https://docs.example.com/react-table',
        path: '书签栏 / 开发 / React',
        ancestorIds: ['1', '10'],
        parentId: '10',
        dateAdded: Date.UTC(2026, 1, 3)
      }),
      bookmark({
        id: 'b2',
        title: 'Vue Grid',
        url: 'https://vue.example.com/grid',
        path: '书签栏 / 开发 / Vue',
        ancestorIds: ['1', '20'],
        parentId: '20',
        dateAdded: Date.UTC(2026, 2, 3)
      })
    ],
    folders: [
      folder({ id: '1', title: '开发', path: '书签栏 / 开发' }),
      folder({ id: '10', title: 'React', path: '书签栏 / 开发 / React' }),
      folder({ id: '20', title: 'Vue', path: '书签栏 / 开发 / Vue' })
    ]
  })

  assert.deepEqual(filterDashboardItems(model.items, { query: 'react' }).map((item) => item.id), ['b1'])
  assert.deepEqual(filterDashboardItems(model.items, { folderId: '1' }).map((item) => item.id), ['b1', 'b2'])
  assert.deepEqual(filterDashboardItems(model.items, { folderId: '10' }).map((item) => item.id), ['b1'])
  assert.deepEqual(filterDashboardItems(model.items, { domain: 'vue.example.com' }).map((item) => item.id), ['b2'])
  assert.deepEqual(filterDashboardItems(model.items, { month: '2026-02' }).map((item) => item.id), ['b1'])
  assert.deepEqual(filterDashboardItems(model.items, { query: 'site:docs.example.com -vue' }).map((item) => item.id), ['b1'])
  const originalNow = Date.now
  Date.now = () => Date.UTC(2026, 2, 10)
  try {
    assert.deepEqual(
      filterDashboardItems(model.items, { query: '最近 2 周' }).map((item) => item.id),
      ['b2']
    )
  } finally {
    Date.now = originalNow
  }
  assert.deepEqual(
    filterDashboardItems(model.items, {
      query: 'site: docs.example.com folder: "开发 / React" "react table"'
    }).map((item) => item.id),
    ['b1']
  )
})

test('sorts dashboard items without mutating the original list', () => {
  const model = buildDashboardModel({
    bookmarks: [
      bookmark({
        id: 'old',
        title: 'Zoo',
        url: 'https://b.example.com/old',
        path: 'B',
        dateAdded: Date.UTC(2026, 0, 1)
      }),
      bookmark({
        id: 'new',
        title: 'Alpha',
        url: 'https://a.example.com/new',
        path: 'A',
        dateAdded: Date.UTC(2026, 0, 2)
      }),
      bookmark({
        id: 'unknown',
        title: 'Middle',
        url: 'https://c.example.com/unknown',
        path: 'C',
        dateAdded: 0
      })
    ]
  })

  const original = model.items.map((item) => item.id)

  assert.deepEqual(sortDashboardItems(model.items, 'date-desc').map((item) => item.id), ['new', 'old', 'unknown'])
  assert.deepEqual(sortDashboardItems(model.items, 'date-asc').map((item) => item.id), ['old', 'new', 'unknown'])
  assert.deepEqual(sortDashboardItems(model.items, 'title-asc').map((item) => item.id), ['new', 'unknown', 'old'])
  assert.deepEqual(sortDashboardItems(model.items, 'domain-asc').map((item) => item.id), ['new', 'old', 'unknown'])
  assert.deepEqual(model.items.map((item) => item.id), original)
})

test('filters and sorts dashboard items with a bounded top result set', () => {
  const bookmarks = Array.from({ length: 30 }, (_, index) => bookmark({
    id: `old-${index}`,
    title: `React Archive ${index}`,
    url: `https://archive.example.com/react-${index}`,
    path: index % 2 === 0 ? '书签栏 / 开发 / React' : '其他书签 / 开发 / React',
    ancestorIds: index % 2 === 0 ? ['1', '10'] : ['2', '20'],
    parentId: index % 2 === 0 ? '10' : '20',
    domain: 'archive.example.com',
    dateAdded: Date.UTC(2026, 0, 1) + index
  })).concat([
    bookmark({
      id: 'newest',
      title: 'React Latest',
      url: 'https://docs.example.com/latest',
      path: '书签栏 / 开发 / React',
      ancestorIds: ['1', '10'],
      parentId: '10',
      domain: 'docs.example.com',
      dateAdded: Date.UTC(2026, 1, 1)
    }),
    bookmark({
      id: 'unknown',
      title: 'React Unknown',
      url: 'https://docs.example.com/unknown',
      path: '书签栏 / 开发 / React',
      ancestorIds: ['1', '10'],
      parentId: '10',
      domain: 'docs.example.com',
      dateAdded: 0
    }),
    bookmark({
      id: 'vue',
      title: 'Vue Grid',
      url: 'https://docs.example.com/vue',
      path: '书签栏 / 开发 / Vue',
      ancestorIds: ['1', '20'],
      parentId: '20',
      domain: 'docs.example.com',
      dateAdded: Date.UTC(2026, 2, 1)
    })
  ])
  const model = buildDashboardModel({ bookmarks })
  const filters = { query: 'react', folderId: '1', sortKey: 'date-desc' as const }
  const fullOrder = sortDashboardItems(filterDashboardItems(model.items, filters), filters.sortKey)
    .map((item) => item.id)
  const bounded = filterAndSortDashboardItems(model.items, filters, { limit: 4 })

  assert.deepEqual(bounded.map((item) => item.id), fullOrder.slice(0, 4))
  assert.equal(bounded.includes(model.items.find((item) => item.id === 'unknown')!), false)
  assert.deepEqual(
    filterAndSortDashboardItems(model.items, { query: 'react', sortKey: 'title-asc' }, { limit: 3 })
      .map((item) => item.id),
    sortDashboardItems(filterDashboardItems(model.items, { query: 'react' }), 'title-asc')
      .slice(0, 3)
      .map((item) => item.id)
  )
})

test('builds folder targets and exposes top-folder/date helpers', () => {
  const folders = [
    folder({ id: '0', title: 'root', path: 'root' }),
    folder({ id: '20', title: 'Vue', path: '书签栏 / 开发 / Vue', bookmarkCount: 3 }),
    folder({ id: '10', title: 'React', path: '书签栏 / 开发 / React', folderCount: 2 }),
    folder({ id: '2', title: '其他书签', path: '其他书签', folderCount: 1 }),
    folder({ id: '21', title: '归档', path: '其他书签 / 归档' }),
    folder({ id: '1', title: '书签栏', path: '书签栏', folderCount: 1 })
  ]
  const folderMap = new Map(folders.map((item) => [item.id, item]))

  assert.deepEqual(getDashboardFolderTargets(folders).map((item) => item.id), ['1', '10', '20', '2', '21'])
  assert.equal(getDashboardTopFolder(bookmark({ ancestorIds: ['20'], parentId: '10' }), folderMap)?.id, '20')
  assert.equal(getDashboardTopFolder(bookmark({ ancestorIds: [], parentId: '10' }), folderMap)?.id, '10')
  assert.deepEqual(getDashboardDateMeta(0), { key: 'unknown', label: '未知时间', known: false })
  assert.equal(getDashboardDateMeta(Date.UTC(2026, 11, 31)).key, '2026-12')
})

test('builds dashboard folder bookmark counts without depending on query filters', () => {
  const model = buildDashboardModel({
    bookmarks: [
      bookmark({ id: 'b1', ancestorIds: ['1', '10'], parentId: '10' }),
      bookmark({ id: 'b2', ancestorIds: ['1', '20'], parentId: '20' }),
      bookmark({ id: 'b3', ancestorIds: ['2'], parentId: '21' })
    ]
  })

  const counts = buildDashboardFolderBookmarkCounts(model.items)

  assert.equal(counts.get('1'), 2)
  assert.equal(counts.get('10'), 1)
  assert.equal(counts.get('20'), 1)
  assert.equal(counts.get('2'), 1)
  assert.equal(counts.get('21'), 1)
})
