import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createSearchBenchmarkRecords, SEARCH_BENCHMARK_QUERIES } from './search-benchmark-fixture.mjs'

const source = await readFile(new URL('./search.ts', import.meta.url), 'utf8')
const bundle = await build({
  stdin: {
    contents: `${source}
export function exhaustiveSearch(query, bookmarks, limit = 20) {
  return searchCandidatesWithLimit(bookmarks, parsePopupSearchQuery(query), limit);
}
export { enrichPinyinTokensCooperatively } from '../shared/search/pinyin.js';
export { enrichLightPopupSearchIndexWithPinyin } from './search-index.js';
export function recoveredCacheStats(bookmarks) {
  const index = accelerationIndexes.get(bookmarks);
  return { entries: index.recoveredTermCache.size, postings: index.recoveredPostingCount };
}
`,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'ts'
  },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent'
})
const engine = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const ids = results => results.map(result => result.id)
const rows = results => results.map(({ id, score }) => ({ id, score }))
const record = (id, title, url = `https://example.invalid/${id}`, path = 'Library') => ({
  ...createSearchBenchmarkRecords(1)[0], id, title, normalizedTitle: title.toLowerCase(),
  url, normalizedUrl: url.replace(/^https?:\/\//, '').toLowerCase(),
  domain: new URL(url).hostname, path, dateAdded: 1700000000000
})
const index = records => records.map(bookmark => engine.indexBookmarkForSearch(bookmark))
let assertions = 0
function equal(actual, expected, message) {
  assertions++
  assert.deepEqual(actual, expected, message)
}

// Compare index retrieval and its pruning to an exhaustive scorer. This catches
// candidate loss independently of the ranking implementation.
const large = index(createSearchBenchmarkRecords(10000))
engine.warmSearchAcceleration(large)
for (const query of [...SEARCH_BENCHMARK_QUERIES, 'react api -前端', 'recent rust', 'folder:python api', 'site:react.example.org', 'recent']) {
  equal(rows(engine.searchBookmarks(query, large)), rows(engine.exhaustiveSearch(query, large)), `indexed/exhaustive: ${query}`)
  equal(rows(await engine.searchBookmarksCooperatively(query, large, { isActive: () => true })),
    rows(engine.searchBookmarks(query, large)), `cooperative: ${query}`)
  const batch = engine.searchBookmarksFirstBatch(query, large)
  equal(batch.complete, true, `prepared first batch is final: ${query}`)
  equal(rows(batch.results), rows(engine.searchBookmarks(query, large)), `first batch: ${query}`)
}

const tail = index(Array.from({ length: 12000 }, (_, position) =>
  record(`tail-${position}`, position === 11999 ? 'Reference Manual' : `Reference Manual supplemental ${position}`)))
engine.warmSearchAcceleration(tail)
equal(engine.searchBookmarks('reference manual', tail)[0]?.id, 'tail-11999', 'best match after 8000 must survive')
equal(rows(engine.searchBookmarksTopK('reference manual', tail, 12, 18)),
  rows(engine.exhaustiveSearch('reference manual', tail, 30)).slice(18, 30), 'pagination must use the same complete ranking')

const cases = index([
  record('exact', 'React'),
  record('prefix', 'React documentation'),
  record('substring', 'Preact resources'),
  record('punctuation', 'React.js reference'),
  record('compact', 'ReactJS reference'),
  record('typo', 'TypeScript Handbook', 'https://typescriptlang.org/'),
  record('cjk', '前端开发工具'),
  record('unicode', 'Résumé café 日本語 검색'),
  record('site', 'React guides', 'https://docs.github.com/en'),
  record('bad-host', 'React guides', 'https://notgithub.com/en'),
  record('url-only', 'React guides', 'https://example.invalid/?source=github.com'),
  record('grams-only', 'abc xxx bcd xxx cde xxx def'),
  ...createSearchBenchmarkRecords(200).map(item => ({ ...item, id: `filler-${item.id}` }))
])
engine.warmSearchAcceleration(cases)
equal(engine.searchBookmarks('react', cases)[0]?.id, 'exact', 'exact title beats prefix, substring and metadata')
equal(engine.searchBookmarks('Ｒｅａｃｔ', cases)[0]?.id, 'exact', 'fullwidth Latin input')
equal(ids(engine.searchBookmarks('"react.js"', cases)), ['punctuation'], 'quoted punctuation stays literal')
equal(ids(engine.searchBookmarks('site:github.com react', cases)), ['site'], 'hostname boundary filtering')
assert.ok(ids(engine.searchBookmarks('url:github.com react', cases)).includes('url-only'))
equal(ids(engine.searchBookmarks('abcdef', cases)), [], 'gram co-occurrence is not a substring match')
equal(ids(engine.searchBookmarks('résumé', cases)), ['unicode'], 'accented Latin')
equal(ids(engine.searchBookmarks('검색', cases)), ['unicode'], 'Unicode beyond the original compact character range')
for (const query of ['typscript', 'ytpescript']) {
  equal(engine.searchBookmarks(query, cases)[0]?.normalizedTitle.includes('typescript'), true, `spelling recovery: ${query}`)
}
for (const query of ['typescript handbook', 'typscript handbook']) {
  equal(engine.searchBookmarks(query, cases)[0]?.id, 'typo', `spelling and term coverage: ${query}`)
}
equal(ids(engine.searchBookmarks('"typscript"', cases)), [], 'quoted misspellings must not expand')
equal(ids(engine.searchBookmarks('typescript zqxvnonexistent', cases)), [], 'all requested terms are required')
equal(ids(engine.searchBookmarks('site:github.com typscript', cases)), [], 'typo recovery cannot escape filters')
assert.ok(!ids(engine.searchBookmarks('typscript -handbook', cases)).includes('typo'), 'typo recovery preserves exclusions')

await engine.enrichLightPopupSearchIndexWithPinyin(cases, { yieldWork: () => Promise.resolve() })
engine.warmSearchAcceleration(cases)
equal(engine.searchBookmarks('qianduankaifagongju', cases)[0]?.id, 'cjk', 'full pinyin')
assert.ok(ids(engine.searchBookmarks('qdkf', cases)).includes('cjk'), 'pinyin initials')

const replacement = engine.indexBookmarkForSearch(record('cjk', 'Changed nebula title'))
Object.assign(cases.find(bookmark => bookmark.id === 'cjk'), replacement)
engine.invalidateSearchAccelerationForBookmarks(cases)
engine.warmSearchAcceleration(cases)
equal(ids(engine.searchBookmarks('"前端开发工具"', cases)), [], 'mutated title removes old postings')
equal(engine.searchBookmarks('nebula', cases)[0]?.id, 'cjk', 'mutated title gains new postings')

// The title match must beat newer siblings whose only match is the folder.
const cardBookmarks = index([
  ...Array.from({ length: 1300 }, (_, position) => ({
    ...record(`card-shop-${position}`, `小铺 ${position}`, `https://shop.invalid/${position}`, '书签栏 / 市场 / 卡网'),
    dateAdded: 1800000000000 + position
  })),
  record('card-price', '卡网订阅比价 | PriceAI', 'https://priceai.cc/channels', '书签栏 / 市场 / 卡网'),
  record('card-title-only', '卡网大全', 'https://catalog.invalid/', '书签栏 / 资源'),
  record('card-exact', '卡网', 'https://cards.invalid/', '书签栏 / 资源'),
  record('card-infix', '常用卡网收藏', 'https://collected.invalid/', '书签栏 / 市场 / 卡网')
])
await engine.enrichLightPopupSearchIndexWithPinyin(cardBookmarks, { yieldWork: () => Promise.resolve() })
for (const warm of [false, true]) {
  if (warm) engine.warmSearchAcceleration(cardBookmarks)
  for (const query of ['kawang', 'kaw', 'kw']) {
    const results = engine.searchBookmarks(query, cardBookmarks)
    equal(results[0]?.id, 'card-exact', `exact pinyin title first (${query}, warm=${warm})`)
    assert.ok(ids(results).indexOf('card-price') > 0 && ids(results).indexOf('card-price') < 3,
      `PriceAI title must precede folder-only matches (${query}, warm=${warm})`)
    equal(results[3]?.id, 'card-infix', 'title infix pinyin also beats an exact folder pinyin match')
    equal(rows(results), rows(engine.exhaustiveSearch(query, cardBookmarks)), `pinyin source ranking/exhaustive: ${query}`)
    equal(rows(await engine.searchBookmarksCooperatively(query, cardBookmarks, { isActive: () => true })),
      rows(results), `pinyin source cooperative: ${query}`)
  }
  const scoped = engine.searchBookmarks('folder:卡网 kawang', cardBookmarks)
  equal(scoped[0]?.id, 'card-price', 'folder filters keep the title match above its siblings')
}
const cardResults = engine.searchBookmarks('kawang', cardBookmarks)
assert.ok(cardResults.find(row => row.id === 'card-price').matchReasons.some(reason => reason.startsWith('命中：标题拼音')))
assert.ok(cardResults.find(row => row.id.startsWith('card-shop-')).matchReasons.some(reason => reason.startsWith('命中：文件夹拼音')))
assert.ok(!cardResults.find(row => row.id.startsWith('card-shop-')).matchReasons.some(reason => reason.startsWith('命中：标题拼音')))

// The raw-title prefix shortcut must still consider a Chinese exact title.
const mixedTitleScripts = index([
  ...Array.from({ length: 1300 }, (_, position) => ({
    ...record(`latin-prefix-${position}`, `kawang store ${position}`), dateAdded: 1800000000000 + position
  })),
  record('han-title', '卡网')
])
await engine.enrichLightPopupSearchIndexWithPinyin(mixedTitleScripts, { yieldWork: () => Promise.resolve() })
engine.warmSearchAcceleration(mixedTitleScripts)
equal(engine.searchBookmarks('kawang', mixedTitleScripts)[0]?.id, 'han-title', 'Chinese exact title survives Latin-prefix shortcut')
equal(rows(engine.searchBookmarks('kawang', mixedTitleScripts)), rows(engine.exhaustiveSearch('kawang', mixedTitleScripts)), 'mixed-script shortcut is lossless')

const fuzzyRecords = [
  record('cards', '卡网订阅比价 | PriceAI', 'https://priceai.cc/channels', '书签栏 / 市场 / 卡网'),
  record('editor', 'Visual Studio Code', 'https://code.visualstudio.com/', 'Tools'),
  record('typescript', 'TypeScript Handbook', 'https://typescriptlang.org/docs/'),
  record('react-guide', 'React Documentation', 'https://react.dev/learn'),
  record('docker-guide', 'Docker installation', 'https://docs.docker.com/'),
  record('frontend', '前端开发性能优化指南'),
  record('home', '我爱我家'),
  record('search-engine', '搜索引擎使用指南'),
  record('weak-path', 'Unrelated store', 'https://store.invalid/', '卡网比价 / kawagn / vscode / typscript'),
  ...createSearchBenchmarkRecords(1300).map(item => ({ ...item, id: `fuzzy-filler-${item.id}` }))
]
const fuzzyCorpus = index(fuzzyRecords)
await engine.enrichLightPopupSearchIndexWithPinyin(fuzzyCorpus, { yieldWork: () => Promise.resolve() })
const fuzzyCases = [
  ['卡网比价', 'cards'], ['比价卡网', 'cards'], ['卡网价', 'cards'],
  ['kawagn', 'cards'], ['kw 订阅', 'cards'], ['kw bj', 'cards'], ['价 卡网', 'cards'],
  ['vscode', 'editor'], ['vsc', 'editor'], ['studio visual', 'editor'],
  ['typscript handbook', 'typescript'], ['typsc handbook', 'typescript'],
  ['raect doc', 'react-guide'], ['dokcer insta', 'docker-guide'],
  ['前端优化', 'frontend'], ['优化前端', 'frontend'], ['前端性能指南', 'frontend'],
  ['我爱我家', 'home'], ['帮我找一下 我爱我家', 'home'], ['搜索引擎', 'search-engine'],
  ['site:priceai.cc 卡网比价', 'cards']
]
for (const warm of [false, true]) {
  if (warm) engine.warmSearchAcceleration(fuzzyCorpus)
  for (const [query, target] of fuzzyCases) {
    const results = engine.searchBookmarks(query, fuzzyCorpus)
    equal(results[0]?.id, target, `fuzzy intent: ${query}, warm=${warm}`)
    equal(rows(results), rows(engine.exhaustiveSearch(query, fuzzyCorpus)), `fuzzy exhaustive: ${query}`)
    equal(rows(await engine.searchBookmarksCooperatively(query, fuzzyCorpus, {
      isActive: () => true, yieldWork: () => Promise.resolve()
    })), rows(results), `fuzzy cooperative: ${query}`)
    const batch = engine.searchBookmarksFirstBatch(query, fuzzyCorpus)
    if (batch.complete) equal(rows(batch.results), rows(results), `complete fuzzy first batch: ${query}`)
  }
  for (const query of ['"卡网比价"', '"vscode"', '卡网比价 -priceai', 'site:other.invalid 卡网比价', 'react qzxvnonexistent', 'abcdqzxv', '卡猫比花', 'rct']) {
    const results = engine.searchBookmarks(query, fuzzyCorpus)
    if (query === '"vscode"') assert.ok(!ids(results).includes('editor'), 'quotes must not expand abbreviations')
    else if (query === '"卡网比价"') assert.ok(!ids(results).includes('cards'), 'quotes must not expand title fragments')
    else if (query === '卡网比价 -priceai') assert.ok(!ids(results).includes('cards'), 'fuzzy recovery must preserve exclusions')
    else equal(ids(results), [], `negative precision guard: ${query}`)
  }
}
for (const [query, label] of [['卡网比价', '标题片段'], ['vscode', '标题缩写'], ['raect doc', '标题近似']]) {
  assert.ok(engine.searchBookmarks(query, fuzzyCorpus)[0]?.matchReasons.some(reason => reason.startsWith(`命中：${label}`)), `${query} explains fuzzy matching`)
}

// Reuse term expansions without reusing a previous query's filters or results.
for (const query of [
  'site:priceai.cc kawagn', 'site:other.invalid kawagn', '"kawagn"',
  'folder:市场 卡网比价', 'folder:tools 卡网比价', '卡网比价 -priceai',
  'typsc handbook', 'typsc api', 'typsc qzxvnonexistent', 'vscode -studio'
]) {
  equal(rows(engine.searchBookmarks(query, fuzzyCorpus)), rows(engine.exhaustiveSearch(query, fuzzyCorpus)), `cached term scope: ${query}`)
}
Object.assign(fuzzyCorpus.find(bookmark => bookmark.id === 'cards'),
  engine.indexBookmarkForSearch(record('cards', '星河订阅比价 | PriceAI', 'https://priceai.cc/channels', '书签栏 / 市场 / 卡网')))
engine.invalidateSearchAccelerationForBookmarks(fuzzyCorpus)
engine.warmSearchAcceleration(fuzzyCorpus)
assert.ok(!ids(engine.searchBookmarks('卡网比价', fuzzyCorpus)).includes('cards'), 'renaming invalidates cached title fragments')
equal(engine.searchBookmarks('星河比价', fuzzyCorpus)[0]?.id, 'cards', 'renaming creates new title fragment candidates')

// Broad abbreviation candidates must not grow the retained posting cache
// without bounds, even when every query is different and returns no result.
const cacheCorpus = index(Array.from({ length: 1200 }, (_, position) =>
  record(`cache-${position}`, 'abcdefghijklmnopqrstuvwxyz')))
engine.warmSearchAcceleration(cacheCorpus)
for (let position = 0; position < 260; position++) {
  const suffix = String.fromCharCode(97 + Math.floor(position / 26), 97 + position % 26)
  equal(ids(engine.searchBookmarks(`zqxv${suffix}`, cacheCorpus)), [], 'shared letters are not a title abbreviation')
}
assert.ok(engine.recoveredCacheStats(cacheCorpus).postings <= 250_000, 'expanded terms respect their retained ID budget')
equal(rows(engine.searchBookmarks('zqxvaa', cacheCorpus)), rows(engine.exhaustiveSearch('zqxvaa', cacheCorpus)), 'evicted expansions rebuild losslessly')
for (let position = 0; position < 270; position++) engine.searchBookmarks(`zqxv${position}`, cacheCorpus)
assert.ok(engine.recoveredCacheStats(cacheCorpus).entries <= 256, 'empty expansions also respect the cache entry limit')

// Deterministic varied records exercise title shortcuts, filters, compact
// matching and score ties; expected results come from a full corpus scan.
let seed = 84739
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
const words = ['react', 'rust', 'guide', 'api', '前端', '设计', 'c++', 'react.js']
const varied = Array.from({ length: 1600 }, (_, position) => {
  const title = Array.from({ length: 1 + Math.floor(random() * 5) }, () => words[Math.floor(random() * words.length)]).join(' ')
  const bookmark = record(`varied-${position}`, title, `https://${position % 3 ? 'docs.example.org' : 'other.invalid'}/${position}`, `Folder ${position % 9}`)
  bookmark.dateAdded += position * 1000
  return engine.indexBookmarkForSearch(bookmark, { tags: [words[position % words.length]], aliases: ['manual'] })
})
engine.warmSearchAcceleration(varied)
for (const word of words) {
  for (const query of [word, `${word} api`, `site:docs.example.org ${word}`, `"${word}" -rust`]) {
    equal(rows(engine.searchBookmarks(query, varied)), rows(engine.exhaustiveSearch(query, varied)), `varied exhaustive: ${query}`)
  }
}
await engine.enrichLightPopupSearchIndexWithPinyin(varied, { yieldWork: () => Promise.resolve() })
engine.warmSearchAcceleration(varied)
for (const query of ['qianduan', 'sheji', 'qd', 'sj', 'qianduan api', 'react sheji', 'folder:3 qianduan']) {
  equal(rows(engine.searchBookmarks(query, varied)), rows(engine.exhaustiveSearch(query, varied)), `varied pinyin source exhaustive: ${query}`)
}
let active = true
await assert.rejects(engine.searchBookmarksCooperatively('react', index(createSearchBenchmarkRecords(1300)), {
  isActive: () => active,
  yieldWork: async () => { active = false }
}), /search-cancelled/)
const idleCallbacks = []
const originalIdle = globalThis.requestIdleCallback
try {
  globalThis.requestIdleCallback = callback => { idleCallbacks.push(callback); return idleCallbacks.length }
  const deferredIndex = index(createSearchBenchmarkRecords(1400))
  let reads = 0
  const firstDate = deferredIndex[0].dateAdded
  Object.defineProperty(deferredIndex[0], 'dateAdded', { get: () => { reads++; return firstDate } })
  engine.scheduleSearchAccelerationWarmup(deferredIndex)
  equal(reads, 0, 'scheduling must not sort or construct the index in the input task')
  engine.invalidateSearchAccelerationForBookmarks(deferredIndex)
  Object.assign(deferredIndex[1399], engine.indexBookmarkForSearch(record('replacement', 'Orbital Atlas')))
  engine.scheduleSearchAccelerationWarmup(deferredIndex)
  while (idleCallbacks.length) idleCallbacks.shift()()
  equal(engine.searchBookmarksFirstBatch('orbital atlas', deferredIndex).complete, true, 'idle warmup finishes the current generation')
  equal(engine.searchBookmarks('orbital atlas', deferredIndex)[0]?.id, 'replacement', 'cancelled idle work must not publish an old index')
} finally {
  if (originalIdle) globalThis.requestIdleCallback = originalIdle
  else delete globalThis.requestIdleCallback
}
console.log(`Search accuracy passed: ${assertions} assertions plus pinyin, URL and cancellation checks.`)
