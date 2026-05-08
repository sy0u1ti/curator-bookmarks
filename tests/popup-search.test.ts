import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BookmarkRecord } from '../src/shared/types.js'
import {
  indexBookmarkForSearch,
  normalizeQuery,
  scoreBookmark,
  searchBookmarks,
  searchBookmarksTopK,
  searchBookmarksCooperatively
} from '../src/popup/search.js'
import { enrichBookmarkPinyinTokens } from '../src/shared/search/pinyin.js'

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

test('searches Chinese bookmarks through local pinyin initials', async () => {
  const indexed = indexBookmarkForSearch(bookmark({
    id: 'baidu',
    title: '百度',
    normalizedTitle: '百度',
    normalizedUrl: 'baidu.com',
    domain: 'baidu.com',
    path: '工具 / 搜索'
  }))

  await enrichBookmarkPinyinTokens(indexed)

  const results = searchBookmarks('bd', [indexed])
  assert.equal(results[0]?.id, 'baidu')
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('首字母 bd')))
})

test('keeps pinyin matches in large top-k indexes without direct text prefilter', async () => {
  const bookmarks = Array.from({ length: 1300 }, (_value, index) =>
    indexBookmarkForSearch(bookmark({
      id: `latin-${index}`,
      title: `Latin Bookmark ${index}`,
      normalizedTitle: `latin bookmark ${index}`,
      normalizedUrl: `example.com/${index}`
    }))
  )
  const target = indexBookmarkForSearch(bookmark({
    id: 'visual-weather',
    title: '可视化全球天气实况',
    normalizedTitle: '可视化全球天气实况',
    normalizedUrl: 'earth.nullschool.net/current/wind',
    domain: 'earth.nullschool.net',
    path: '书签栏 / 工具 / 好玩'
  }))

  await enrichBookmarkPinyinTokens(target)
  const results = searchBookmarksTopK('keshihua', [...bookmarks, target], 5)

  assert.equal(results[0]?.id, 'visual-weather')
})

test('searches AI tags and aliases for semantic local matches', () => {
  const indexed = indexBookmarkForSearch(bookmark({
    id: 'table',
    title: 'TanStack Table',
    normalizedTitle: 'tanstack table',
    normalizedUrl: 'tanstack.com/table',
    domain: 'tanstack.com',
    path: 'Frontend / React'
  }), {
    schemaVersion: 1,
    bookmarkId: 'table',
    url: 'https://tanstack.com/table',
    normalizedUrl: 'https://tanstack.com/table',
    duplicateKey: 'https://tanstack.com/table',
    title: 'TanStack Table',
    path: 'Frontend / React',
    summary: 'Headless UI library for building tables and data grids in React.',
    contentType: '工具',
    topics: ['React'],
    tags: ['table', 'grid', '表格库'],
    aliases: ['React 表格库', 'TanStack Table'],
    confidence: 0.92,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'ok', source: 'html', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })

  const results = searchBookmarks('React 表格库', [indexed])
  assert.equal(results[0]?.id, 'table')
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('标签') || reason.includes('别名')))
})

test('searches AI summaries for longer semantic queries but ignores noisy single characters', () => {
  const indexed = indexBookmarkForSearch(bookmark({
    id: 'agent-memory',
    title: 'Paper Notes',
    normalizedTitle: 'paper notes',
    normalizedUrl: 'notes.example.org/memory',
    domain: 'notes.example.org',
    path: 'AI / Papers'
  }), {
    schemaVersion: 1,
    bookmarkId: 'agent-memory',
    url: 'https://notes.example.org/memory',
    normalizedUrl: 'https://notes.example.org/memory',
    duplicateKey: 'https://notes.example.org/memory',
    title: 'Paper Notes',
    path: 'AI / Papers',
    summary: 'Survey about LLM agent memory, retrieval, long-term context and planning.',
    contentType: '论文',
    topics: ['LLM agent memory'],
    tags: ['LLM', 'agent', 'memory'],
    aliases: [],
    confidence: 0.81,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'ok', source: 'html', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })
  const summaryOnly = indexBookmarkForSearch(bookmark({
    id: 'summary-only',
    title: 'ZZZ',
    normalizedTitle: 'zzz',
    normalizedUrl: 'zzz.test',
    domain: 'zzz.test',
    path: 'Root'
  }), {
    schemaVersion: 1,
    bookmarkId: 'summary-only',
    url: 'https://zzz.test',
    normalizedUrl: 'https://zzz.test',
    duplicateKey: 'https://zzz.test',
    title: 'ZZZ',
    path: 'Root',
    summary: 'a a a a noisy repeated text',
    contentType: '',
    topics: [],
    tags: [],
    aliases: [],
    confidence: 0.2,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'limited', source: 'fallback', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })

  const semanticResults = searchBookmarks('LLM agent memory', [indexed])
  assert.equal(semanticResults[0]?.id, 'agent-memory')
  assert.ok(semanticResults[0]?.matchReasons.some((reason) => reason.includes('标签') || reason.includes('摘要')))

  assert.equal(searchBookmarks('a', [summaryOnly]).length, 0)
})

test('filters popup search locally by site folder and content type operators', () => {
  const githubDocs = indexBookmarkForSearch(bookmark({
    id: 'github-docs',
    title: 'React Docs Mirror',
    normalizedTitle: 'react docs mirror',
    normalizedUrl: 'github.com/reactjs/react.dev',
    domain: 'github.com',
    path: 'Frontend / React'
  }), {
    schemaVersion: 1,
    bookmarkId: 'github-docs',
    url: 'https://github.com/reactjs/react.dev',
    normalizedUrl: 'https://github.com/reactjs/react.dev',
    duplicateKey: 'https://github.com/reactjs/react.dev',
    title: 'React Docs Mirror',
    path: 'Frontend / React',
    summary: 'React documentation mirror.',
    contentType: '文档',
    topics: ['React'],
    tags: ['docs'],
    aliases: [],
    confidence: 0.8,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'ok', source: 'html', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })
  const blogPost = indexBookmarkForSearch(bookmark({
    id: 'blog',
    title: 'React Blog',
    normalizedTitle: 'react blog',
    normalizedUrl: 'example.com/react',
    domain: 'example.com',
    path: 'Reading / Blogs'
  }), {
    schemaVersion: 1,
    bookmarkId: 'blog',
    url: 'https://example.com/react',
    normalizedUrl: 'https://example.com/react',
    duplicateKey: 'https://example.com/react',
    title: 'React Blog',
    path: 'Reading / Blogs',
    summary: 'React article.',
    contentType: '文章',
    topics: ['React'],
    tags: ['blog'],
    aliases: [],
    confidence: 0.8,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'ok', source: 'html', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })

  const results = searchBookmarks('site:github.com folder:frontend type:文档 react', [blogPost, githubDocs])
  assert.deepEqual(results.map((item) => item.id), ['github-docs'])
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('站点 github.com')))
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('文件夹 frontend')))
})

test('filters popup search with spaced operators and quoted phrases', () => {
  const githubDocs = indexBookmarkForSearch(bookmark({
    id: 'github-docs',
    title: 'React Data Grid Docs',
    normalizedTitle: 'react data grid docs',
    normalizedUrl: 'github.com/reactjs/react.dev',
    domain: 'github.com',
    path: 'Frontend Resources / React Docs'
  }), {
    schemaVersion: 1,
    bookmarkId: 'github-docs',
    url: 'https://github.com/reactjs/react.dev',
    normalizedUrl: 'https://github.com/reactjs/react.dev',
    duplicateKey: 'https://github.com/reactjs/react.dev',
    title: 'React Data Grid Docs',
    path: 'Frontend Resources / React Docs',
    summary: 'React data grid documentation.',
    contentType: '技术文档',
    topics: ['React'],
    tags: ['docs'],
    aliases: [],
    confidence: 0.8,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'ok', source: 'html', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })
  const blogPost = indexBookmarkForSearch(bookmark({
    id: 'blog',
    title: 'React Data Grid Blog Video',
    normalizedTitle: 'react data grid blog video',
    normalizedUrl: 'example.com/react-grid-video',
    domain: 'example.com',
    path: 'Frontend Resources / React Docs'
  }), {
    schemaVersion: 1,
    bookmarkId: 'blog',
    url: 'https://example.com/react-grid-video',
    normalizedUrl: 'https://example.com/react-grid-video',
    duplicateKey: 'https://example.com/react-grid-video',
    title: 'React Data Grid Blog Video',
    path: 'Frontend Resources / React Docs',
    summary: 'React data grid video article.',
    contentType: '文章',
    topics: ['React'],
    tags: ['blog'],
    aliases: [],
    confidence: 0.8,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'ok', source: 'html', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })
  const splitPhrase = indexBookmarkForSearch(bookmark({
    id: 'split-phrase',
    title: 'React Data Spreadsheet Grid Docs',
    normalizedTitle: 'react data spreadsheet grid docs',
    normalizedUrl: 'github.com/reactjs/grid-docs',
    domain: 'github.com',
    path: 'Frontend Resources / React Docs'
  }), {
    schemaVersion: 1,
    bookmarkId: 'split-phrase',
    url: 'https://github.com/reactjs/grid-docs',
    normalizedUrl: 'https://github.com/reactjs/grid-docs',
    duplicateKey: 'https://github.com/reactjs/grid-docs',
    title: 'React Data Spreadsheet Grid Docs',
    path: 'Frontend Resources / React Docs',
    summary: 'React data spreadsheet grid documentation.',
    contentType: '技术文档',
    topics: ['React'],
    tags: ['docs'],
    aliases: [],
    confidence: 0.8,
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: { status: 'ok', source: 'html', warnings: [] },
    generatedAt: 1,
    updatedAt: 1
  })

  const results = searchBookmarks(
    'site: "github.com" folder: "Frontend Resources" type: 技术文档 "data grid" -video',
    [blogPost, splitPhrase, githubDocs]
  )

  assert.deepEqual(results.map((item) => item.id), ['github-docs'])
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('站点 github.com')))
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('文件夹 frontend resources')))
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('类型 技术文档')))
})

test('keeps quoted phrase filtering intact for large popup search indexes', () => {
  const phraseMatch = indexBookmarkForSearch(bookmark({
    id: 'phrase-match',
    title: 'React Data Grid Docs',
    normalizedTitle: 'react data grid docs',
    normalizedUrl: 'github.com/reactjs/react.dev',
    domain: 'github.com',
    path: 'Frontend Resources / React Docs'
  }))
  const splitPhrase = indexBookmarkForSearch(bookmark({
    id: 'split-phrase',
    title: 'React Data Spreadsheet Grid Docs',
    normalizedTitle: 'react data spreadsheet grid docs',
    normalizedUrl: 'github.com/reactjs/grid-docs',
    domain: 'github.com',
    path: 'Frontend Resources / React Docs'
  }))
  const fillerBookmarks = Array.from({ length: 1201 }, (_value, index) => {
    return indexBookmarkForSearch(bookmark({
      id: `filler-${index}`,
      title: `React Data Grid Archive ${index}`,
      normalizedTitle: `react data grid archive ${index}`,
      normalizedUrl: `archive.example.com/react-data-grid-${index}`,
      domain: 'archive.example.com',
      path: 'Archive'
    }))
  })

  const results = searchBookmarks('"data grid" site:github.com', [
    splitPhrase,
    ...fillerBookmarks,
    phraseMatch
  ])

  assert.deepEqual(results.map((item) => item.id), ['phrase-match'])
})

test('matches short latin typos with approximate local scoring', () => {
  const indexed = indexBookmarkForSearch(bookmark({
    id: 'openai',
    title: 'OpenAI Docs',
    normalizedTitle: 'openai docs',
    normalizedUrl: 'platform.openai.com/docs',
    domain: 'platform.openai.com',
    path: 'AI / Docs'
  }))

  const results = searchBookmarks('opneai', [indexed])
  assert.equal(results[0]?.id, 'openai')
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('近似 openai / opneai')))
})

test('uses recent sort hints to boost newer matching bookmarks', () => {
  const oldReact = indexBookmarkForSearch(bookmark({
    id: 'old-react',
    title: 'React Guide',
    normalizedTitle: 'react guide',
    normalizedUrl: 'old.example.com/react',
    dateAdded: Date.now() - 240 * 24 * 60 * 60 * 1000
  }))
  const recentReact = indexBookmarkForSearch(bookmark({
    id: 'recent-react',
    title: 'React Guide',
    normalizedTitle: 'react guide',
    normalizedUrl: 'new.example.com/react',
    dateAdded: Date.now() - 2 * 24 * 60 * 60 * 1000
  }))

  const results = searchBookmarks('react 最近', [oldReact, recentReact])
  assert.equal(results[0]?.id, 'recent-react')
  assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('最近添加优先')))
})

test('filters popup results by flexible structured date ranges', () => {
  const now = new Date(2026, 4, 4, 15).getTime()
  const recent = indexBookmarkForSearch(bookmark({
    id: 'recent-react',
    title: 'React Table Guide',
    normalizedTitle: 'react table guide',
    normalizedUrl: 'github.com/react/table',
    domain: 'github.com',
    path: 'Frontend',
    dateAdded: new Date(2026, 4, 1).getTime()
  }))
  const old = indexBookmarkForSearch(bookmark({
    id: 'old-react',
    title: 'React Table Guide',
    normalizedTitle: 'react table guide',
    normalizedUrl: 'github.com/react/archive',
    domain: 'github.com',
    path: 'Frontend',
    dateAdded: new Date(2026, 3, 1).getTime()
  }))

  const originalNow = Date.now
  Date.now = () => now
  try {
    const results = searchBookmarks('React 最近 2 周 site:github.com', [old, recent])
    assert.deepEqual(results.map((result) => result.id), ['recent-react'])
    assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('最近 2 周')))
    assert.ok(results[0]?.matchReasons.some((reason) => reason.includes('站点 github.com')))
  } finally {
    Date.now = originalNow
  }
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
