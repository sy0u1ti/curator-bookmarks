import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const source = await readFile(new URL('./search.ts', import.meta.url), 'utf8')
const bundle = await build({
  stdin: {
    contents: `${source}
export function exhaustiveSearch(query, bookmarks, limit = 20) { return searchCandidatesWithLimit(bookmarks, parsePopupSearchQuery(query), limit); }
export function hasReadyIndex(bookmarks) { return accelerationIndexes.has(bookmarks); }
export { parseSearchQuery, matchesParsedSearchQuery } from '../shared/search-query.js';
export * from './natural-search.js';
export { buildPinyinTokensSync, enrichPinyinTokensCooperatively } from '../shared/search/pinyin.js';
export { requiresPinyinTokens } from '../shared/search/pinyin-query.js';
export { buildPopupSearchRowPresentation } from './popup-row-presentation.js';
export { buildLightPopupSearchIndexFromCatalog, enrichExistingPopupSearchIndexWithSnapshotFullTextFromCatalog, patchLightPopupSearchIndexFromCatalog } from './search-index.js';
export { buildBookmarkCatalogSnapshot } from '../shared/bookmark-catalog.js';
export { setContentFullTextOperationsForTest } from '../shared/content-snapshots.js';
export { buildNewTabSearchIndex, prepareNewTabSearchIndex, getNaturalSearchBookmarkSuggestionsFromIndex, getPopupSearchBookmarkSuggestionsFromIndex } from '../newtab/content-state.js';
`, resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'ts'
  }, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent'
})
const engine = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
// These tests explicitly choose warm/cold paths, without background index races.
globalThis.requestIdleCallback = () => 1
const now = new Date(2026, 9, 23, 12).getTime()
const record = (id, title, url = `https://neutral.invalid/${id}`, overrides = {}) => ({
  id, title, url, normalizedTitle: title.toLowerCase(), normalizedUrl: url.replace(/^https?:\/\//, '').toLowerCase(),
  displayUrl: url, domain: new URL(url).hostname.replace(/^www\./, ''), duplicateKey: url,
  path: 'Library', parentId: '1', ancestorIds: ['1'], index: 0, dateAdded: now - 1000, ...overrides
})
const index = records => records.map(item => engine.indexBookmarkForSearch(item))
const rows = results => results.map(({ id, score }) => ({ id, score }))
const ids = results => results.map(({ id }) => id)
const names = index([
  record('filter', '过滤器'), record('eliminate', '排除法'), record('normal', '其他资料'),
  record('nocode', 'No code tools'), record('paint', 'Painting tools'), record('notfound', 'Not found')
])
for (const [query, id] of [['过滤器', 'filter'], ['排除法', 'eliminate'], ['no code tools', 'nocode'], ['not found', 'notfound']]) {
  assert.deepEqual(engine.parseSearchQuery(query).excludedTerms, [])
  assert.equal(engine.searchBookmarks(query, names)[0]?.id, id)
}
assert.deepEqual(engine.parseSearchQuery("O'Reilly React").textTerms, ["o'reilly", 'react'])
assert.deepEqual(engine.parseSearchQuery('folder:"我的 资料" "not found" -"no code"').textTerms, ['not found'])
assert.deepEqual(engine.parseSearchQuery('react 排除 vue').excludedTerms, ['vue'])
assert.deepEqual(engine.parseSearchQuery('帮我找上周收藏的那个 React 表格教程，不要广告', now).excludedTerms, ['广告'])

for (const query of ['kw订阅', 'ｋｗ订阅', 'ｋａｗ', 'kw,', 'kw bj', 'react']) assert.equal(engine.requiresPinyinTokens(query), true, query)
for (const query of ['"kawang"', 'folder:work', 'type:docs', 'site:github.com', '-kawang']) assert.equal(engine.requiresPinyinTokens(query), false, query)
const poly = index([record('music', '音乐'), record('important', '重要'), record('card', '卡网订阅'), record('bank', '银行'), record('run', '运行')])
await engine.enrichPinyinTokensCooperatively(poly, { yieldWork: () => Promise.resolve() })
for (const [query, expected] of [['yinyue', 'music'], ['yy', 'music'], ['zhongyao', 'important'], ['zy', 'important'], ['kw订阅', 'card'], ['ｋｗ订阅', 'card'], ['ｋａｗ', 'card'], ['yinhang', 'bank'], ['yunxing', 'run']]) {
  assert.equal(engine.searchBookmarks(query, poly)[0]?.id, expected, query)
}

const march31 = new Date(2026, 2, 31, 12).getTime()
for (const query of ['最近1个月', '最近一个月']) {
  const parsed = engine.parseSearchQuery(query, march31)
  assert.equal(parsed.dateRange.from, new Date(2026, 1, 28).getTime())
  assert.deepEqual(engine.buildLocalNaturalSearchPlan(query, march31).dateRange, parsed.dateRange)
}
for (const query of ['今天', '昨天', '前天', '本周', '上周', '最近三天', '最近2周', '去年', '2026-02-28']) {
  const parsed = engine.parseSearchQuery(query, now)
  const plan = engine.buildLocalNaturalSearchPlan(query, now)
  assert.deepEqual(plan.dateRange, parsed.dateRange, query)
  assert.equal(engine.matchesParsedSearchQuery(parsed, { searchText: '', dateAdded: parsed.dateRange.to - 1 }), true)
  assert.equal(engine.matchesParsedSearchQuery(parsed, { searchText: '', dateAdded: parsed.dateRange.to }), false)
}
for (const query of ['最近邻算法', '目的地', '请求', '资料库', '我的世界', '"昨天"', '"not found"']) {
  const local = engine.buildLocalNaturalSearchPlan(query, now)
  assert.equal(local.dateRange, null, query)
  assert.deepEqual(local.query.textTerms, [query.replaceAll('"', '').toLowerCase()])
}
const impossible = engine.parseSearchQuery('昨天 今天 react', now)
assert.ok(impossible.dateRange.from >= impossible.dateRange.to)
assert.equal(impossible.chips.filter(chip => chip.kind === 'time').length, 1)
assert.deepEqual(engine.searchBookmarks(impossible, index([record('today', 'React', undefined, { dateAdded: now })])), [])

const records = [
  record('target', 'React tutorial guide', 'https://github.com/react/learn'),
  record('original', 'React 教程', 'https://github.com/react/zh'),
  record('outside', 'React 教程', 'https://elsewhere.invalid/react'),
  record('unrelated', 'Tutorial', 'https://cooking.invalid/'),
  record('vue', 'Vue guide', 'https://github.com/vue/'),
  ...Array.from({ length: 160 }, (_, n) => record(`filler-${n}`, `Example item ${n}`))
]
const corpus = index(records)
const local = engine.buildLocalNaturalSearchPlan('site:github.com react 教程', now)
const ai = engine.normalizeNaturalSearchAiPlan({
  queries: ['tutorial'], keywords: ['guide'], excluded_terms: ['react'], date_range: { from: '2030-01-01', to: '2030-02-01' },
  term_groups: [{ term: '教程', alternatives: ['instruction'] }, { term: 'invented', alternatives: ['cooking'] }]
}, local, now)
assert.deepEqual(ai.query.siteFilters, ['github.com'])
assert.deepEqual(ai.excludedTerms, [])
assert.equal(ai.dateRange, null)
for (const warm of [false, true]) {
  if (warm) engine.warmSearchAcceleration(corpus)
  for (const plan of [local, ai]) {
    const results = engine.searchNaturalBookmarks(plan, corpus)
    assert.deepEqual(new Set(ids(results)), new Set(['target', 'original']))
    assert.equal(results[0].id, 'original')
    assert.deepEqual(rows(results), rows(engine.exhaustiveSearch(plan.query, corpus)))
    assert.deepEqual(rows(await engine.searchNaturalBookmarksCooperatively(plan, corpus, { isActive: () => true, yieldWork: () => Promise.resolve() })), rows(results))
  }
}
assert.equal(engine.hasReadyIndex(corpus), true)
const datePlan = engine.buildLocalNaturalSearchPlan('最近3天 react 教程', now)
engine.searchNaturalBookmarks(datePlan, corpus)
assert.equal(engine.hasReadyIndex(corpus), true, 'dates execute against the existing master index')

const excluded = index([
  ...Array.from({ length: 40 }, (_, n) => record(`ad-${n}`, 'React', `https://ads.invalid/${n}`)),
  record('allowed', 'React handbook')
])
const excludePlan = engine.buildLocalNaturalSearchPlan('react -ads', now)
assert.deepEqual(ids(engine.searchNaturalBookmarks(excludePlan, excluded)), ['allowed'])
engine.warmSearchAcceleration(excluded)
assert.deepEqual(ids(engine.searchNaturalBookmarks(excludePlan, excluded)), ['allowed'])
assert.deepEqual(ids(engine.searchNaturalBookmarks(engine.buildLocalNaturalSearchPlan('"not found"', now), names)), ['notfound'])

const ranked = index([record('old', 'React', undefined, { dateAdded: now - 100000 }), record('new', 'React guide', undefined, { dateAdded: now })])
assert.equal(engine.searchBookmarks('react', ranked)[0].id, 'old')
assert.equal(engine.searchBookmarks('sort:new react', ranked)[0].id, 'new')
const newtabIndex = engine.prepareNewTabSearchIndex(engine.buildNewTabSearchIndex({ bookmarks: records }))
assert.deepEqual(ids(await engine.getNaturalSearchBookmarkSuggestionsFromIndex(local.rawQuery, newtabIndex, 6, { naturalSearchPlan: local })), ids(engine.searchNaturalBookmarks(local, corpus, 6)))

const snapshot = { bookmarkId: 'snapshot', snapshotId: 's', url: 'https://neutral.invalid/snapshot', title: 'Quantum Note', summary: 'alpha', headings: ['beta'], contentType: '文档', source: 'fallback', extractionStatus: 'success', finalUrl: '', canonicalUrl: '', fullTextStorage: 'local', fullText: 'special body phrase 广告', hasFullText: true }
const snapshotEntry = engine.indexBookmarkForSearch(record('snapshot', 'Saved resource'), null, snapshot, { includeFullText: true })
for (const query of ['"quantum note"', 'type:文档', '"special body phrase"']) assert.equal(engine.searchBookmarks(query, [snapshotEntry])[0]?.id, 'snapshot', query)
for (const query of ['fallback', '"alpha 文档"', 'special -广告']) assert.deepEqual(engine.searchBookmarks(query, [snapshotEntry]), [], query)
const bodyCorpus = [snapshotEntry, ...index(records)]
engine.warmSearchAcceleration(bodyCorpus)
for (const query of ['special', '广告', '广', '"special body phrase"', 'special -广告', 'saved special', 'type:文档']) {
  assert.deepEqual(rows(engine.searchBookmarks(query, bodyCorpus)), rows(engine.exhaustiveSearch(query, bodyCorpus)), `body index/scan: ${query}`)
}
const changed = engine.indexBookmarkForSearch(record('snapshot', 'Cooking', 'https://recipes.invalid/'), {
  url: 'https://old.invalid/', aliases: ['oldframework'], tags: ['automatic'], manualTags: ['personal']
}, snapshot, { includeFullText: true })
for (const query of ['oldframework', 'special', 'alpha', 'automatic']) assert.deepEqual(engine.searchBookmarks(query, [changed]), [], query)
assert.equal(engine.searchBookmarks('personal', [changed])[0]?.id, 'snapshot', 'manual tags belong to the bookmark')

const literal = engine.searchBookmarks('"react.js"', index([record('literal-url', 'ReactJS', 'https://neutral.invalid/react.js')]))[0]
const presentation = engine.buildPopupSearchRowPresentation({ ...literal, query: 'react.js', literalTerms: ['react.js'] })
assert.deepEqual(presentation.titleTerms, [])
assert.deepEqual(presentation.reasonTokens, ['网址命中'])
const visibleTitle = engine.searchBookmarks('react', index([record('title-and-url', 'React Guide', 'https://neutral.invalid/react')]))[0]
assert.deepEqual(engine.buildPopupSearchRowPresentation({ ...visibleTitle, query: 'react' }).reasonTokens, [], 'a URL repeat does not duplicate visible title evidence')

const sourceBookmark = record('snapshot', '卡网正文')
const catalog = engine.buildBookmarkCatalogSnapshot({
  rootNode: { id: '0', title: '', children: [{ id: '1', title: 'Library', children: [{ id: sourceBookmark.id, parentId: '1', title: sourceBookmark.title, url: sourceBookmark.url, dateAdded: now }] }] },
  snapshotState: { settings: { fullTextSearchEnabled: true }, index: { version: 1, updatedAt: 1, records: { snapshot } } }
})
const light = engine.buildLightPopupSearchIndexFromCatalog(catalog)
await engine.enrichPinyinTokensCooperatively(light, { yieldWork: () => Promise.resolve() })
const pinyinBefore = light[0].pinyinFields
await engine.enrichExistingPopupSearchIndexWithSnapshotFullTextFromCatalog(light, catalog)
assert.equal(light[0].pinyinFields, pinyinBefore, 'body hydration does not reset unrelated pinyin')
assert.equal(light[0].fullText, snapshot.fullText.toLowerCase())
assert.ok(!light[0].searchText.includes('special body phrase'), 'body text is not duplicated into light fields')
assert.equal(await engine.enrichExistingPopupSearchIndexWithSnapshotFullTextFromCatalog(light, catalog), 0, 'unchanged body patches are idempotent')
const fullNewtab = engine.prepareNewTabSearchIndex(engine.buildNewTabSearchIndex({ bookmarks: [sourceBookmark], snapshotIndex: catalog.snapshotState.index }), true)
assert.deepEqual(ids(await engine.getPopupSearchBookmarkSuggestionsFromIndex('special', fullNewtab, 6)), ['snapshot'])
const disabledNewtab = engine.prepareNewTabSearchIndex(engine.buildNewTabSearchIndex({ bookmarks: [sourceBookmark], snapshotIndex: catalog.snapshotState.index }), false)
assert.deepEqual(await engine.getPopupSearchBookmarkSuggestionsFromIndex('special', disabledNewtab, 6), [], 'shared light entries never retain a disabled body')
const legacyBodyIndex = engine.prepareNewTabSearchIndex(engine.buildNewTabSearchIndex({
  bookmarks: [sourceBookmark],
  snapshotIndex: { ...catalog.snapshotState.index, records: { snapshot: { ...snapshot, hasFullText: false } } }
}), true)
assert.deepEqual(ids(await engine.getPopupSearchBookmarkSuggestionsFromIndex('special', legacyBodyIndex, 6)), ['snapshot'], 'stored text remains searchable when a legacy availability flag is stale')
const changedBodyIndex = engine.prepareNewTabSearchIndex(engine.buildNewTabSearchIndex({
  bookmarks: [record('snapshot', 'Cooking', 'https://recipes.invalid/')],
  snapshotIndex: { ...catalog.snapshotState.index, records: { snapshot: { ...snapshot, fullTextStorage: 'idb', fullTextRef: 'old-page' } } }
}), true)
const restoreObsoleteBodyReads = engine.setContentFullTextOperationsForTest({ getMany: async () => { throw new Error('obsolete body must not be read') } })
try {
  assert.deepEqual(ids(await engine.getPopupSearchBookmarkSuggestionsFromIndex('cooking', changedBodyIndex, 6)), ['snapshot'])
  assert.deepEqual(await engine.getPopupSearchBookmarkSuggestionsFromIndex('special', changedBodyIndex, 6), [], 'an obsolete body is not a live query dependency')
} finally { restoreObsoleteBodyReads() }
const renamedCatalog = engine.buildBookmarkCatalogSnapshot({ rootNode: { id: '0', title: '', children: [{ id: '1', title: 'Library', children: [{ id: sourceBookmark.id, parentId: '1', title: 'New title', url: sourceBookmark.url, dateAdded: now }] }] }, snapshotState: catalog.snapshotState })
assert.notEqual(renamedCatalog.version, catalog.version, 'catalog revisions include searchable titles')

// Dates must survive a DST boundary in local calendar time, not drift by an hour.
const originalTz = process.env.TZ
process.env.TZ = 'America/New_York'
try {
  const afterDst = new Date(2026, 2, 9, 12).getTime()
  const yesterday = engine.parseSearchQuery('昨天', afterDst).dateRange
  assert.equal(yesterday.from, new Date(2026, 2, 8).getTime())
  assert.equal(yesterday.to, new Date(2026, 2, 9).getTime())
  assert.equal(yesterday.to - yesterday.from, 23 * 60 * 60 * 1000)
} finally {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
}

// More than K variants and duplicates cannot move or lose the best result.
for (const query of ['react 教程', 'site:github.com react 教程', 'guide react', 'sort:new react 教程', '"react" 教程', 'raect 教程']) {
  const plan = engine.buildLocalNaturalSearchPlan(query, now)
  for (const limit of [1, 6, 20, 35]) assert.deepEqual(rows(engine.searchBookmarksTopK(plan.query, corpus, limit)), rows(engine.exhaustiveSearch(plan.query, corpus, limit)), query)
}

// Vary all fields and posting-list orders rather than only checking one happy
// path per operator. The reference deliberately skips candidate pruning.
let seed = 0x172962
const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max }
const words = ['react', 'React.js', 'ReactJS', 'tutorial', 'guide', '表格', '教程', 'table', 'grid', 'code', '卡网', '文档', '前端开发', 'manual', 'typescript', '工具', 'tools', 'any', '路由', '广告']
const propertyCorpus = Array.from({ length: 320 }, (_, n) => {
  const item = record(`property-${n}`, Array.from({ length: 1 + random(4) }, () => words[random(words.length)]).join(random(2) ? ' ' : ' / '),
    `https://${['github', 'docs', 'react', 'neutral'][random(4)]}.invalid/${words[random(10)]}/${n}`,
    { path: `Library / ${words[random(words.length)]}`, dateAdded: now - random(7) * 86400000 })
  return engine.indexBookmarkForSearch(item,
    { url: item.url, aliases: [words[random(words.length)]], tags: [words[random(words.length)]], summary: words[random(words.length)] },
    { url: item.url, summary: words[random(words.length)], contentType: n % 2 ? '文档' : '工具', headings: [], fullTextStorage: 'local', fullText: `body ${words[random(words.length)]} 独立正文` },
    { includeFullText: true })
})
await engine.enrichPinyinTokensCooperatively(propertyCorpus, { yieldWork: () => Promise.resolve() })
engine.warmSearchAcceleration(propertyCorpus)
const propertyQueries = [...words, ...Array.from({ length: 40 }, () => `${words[random(words.length)]} ${words[random(words.length)]}`),
  'kw', 'qdkf', 'kaw', 'vsc', 'raect 教程', 'typscript 文档', 'any -manual', 'react -广告', 'site:docs.invalid react 教程',
  'folder:表格 教程', 'recent react 教程', 'sort:new react 教程', '最近三天 工具', '昨天 今天 react', 'type:文档 table',
  '"react.js" 教程', '"独立正文" table', '"re" 文档', '优化前端', 'react table 教程']
let differentialChecks = 0
for (const query of propertyQueries) {
  for (const parsed of [engine.parseSearchQuery(query, now), engine.buildLocalNaturalSearchPlan(query, now).query]) {
    for (const limit of [1, 6, 20, 35]) {
      assert.deepEqual(rows(engine.searchBookmarksTopK(parsed, propertyCorpus, limit)), rows(engine.exhaustiveSearch(parsed, propertyCorpus, limit)),
        `index/scan (${parsed.termGroups ? 'semantic' : 'local'}), K=${limit}: ${query}`)
      differentialChecks++
    }
  }
}
console.log(`Search plan index/scan differential checks: ${differentialChecks} passed.`)
console.log('Search plans: constraints, synonyms, date bounds, pinyin, content identity, body index and literal evidence passed.')
