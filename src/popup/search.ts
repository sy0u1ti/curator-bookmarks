import type { BookmarkRecord } from '../shared/types.js'
import {
  normalizeSearchTextCompact,
  normalizeText,
  stripCommonUrlPrefix
} from '../shared/text.js'
import { createTopKCollector } from '../shared/search/topk.js'
import { getEffectiveBookmarkTags, type BookmarkTagRecord } from '../shared/bookmark-tags.js'
import {
  buildSearchTextQuery,
  matchesParsedSearchQuery,
  matchesSearchSiteFilter,
  parseSearchQuery,
  type ParsedSearchQuery
} from '../shared/search-query.js'
import type { PinyinSearchFields, PinyinTokens } from '../shared/search/pinyin.js'
import { canRecoverTitleTerm, chineseTitleFragmentCost, getTitleWords, titleAbbreviationCost } from '../shared/search/fuzzy-title.js'
import {
  buildContentSnapshotSearchText,
  type ContentSnapshotRecord
} from '../shared/content-snapshot-search.js'

export const MAX_POPUP_SEARCH_RESULTS = 20
export const POPUP_SEARCH_ASYNC_THRESHOLD = 1200
const SEARCH_PREFILTER_THRESHOLD = 64
const SEARCH_CHUNK_SIZE = 260
const FIRST_BATCH_MAX_SCAN_WITH_RESULTS = 8000
const INDEXED_TERM_CACHE_LIMIT = 256
const RECOVERED_POSTING_CACHE_BUDGET = 250_000
const MAX_TITLE_DOMAIN_BOOST = 320
const URL_STRUCTURE_PATTERN = /[/?#:@%\\]/
const RECENT_SORT_TERMS = new Set(['recent', 'newest', 'latest', '最近', '新近', '最近优先'])

export interface PopupSearchBookmark extends BookmarkRecord {
  normalizedPath: string
  tagSummary: string
  tagContentType: string
  tagTopics: string[]
  tagTags: string[]
  tagAliases: string[]
  tagPinyinFull: string[]
  tagPinyinInitials: string[]
  searchText: string
  searchTextCompact?: string
  pinyinEnriched?: boolean
  pinyinBaseSearchText?: string
  pinyinFields?: PinyinSearchFields
}

export interface PopupSearchResult extends PopupSearchBookmark {
  score: number
  matchReasons: string[]
}

export interface CooperativeSearchOptions {
  isActive: () => boolean
  yieldWork?: () => Promise<unknown>
}

interface ParsedPopupSearchQuery extends ParsedSearchQuery {
  normalizedQuery: string
  recencyHint: boolean
  hasStructuredFilters: boolean
  compactQuery: string
  compactDomainQuery: string
  domainTerms: Set<string>
  termCompacts: string[]
  literalTermFlags: boolean[]
  domainEvidenceCache: Map<string, DomainQueryEvidence>
  phraseTerms: string[]
  approximateTerms?: string[][]
  approximateDistances?: Map<string, number>[]
  recoveryScoreCeiling?: number
  siteMatchCache: Map<string, boolean>
}

interface DomainQueryEvidence {
  score: number
  termWeights: number[]
  termBoosts: number[]
  maximumCorroboration: number
}

interface CompactSearchField {
  value: string
  label: string
  weight: number
  titlePinyin?: boolean
  initials?: boolean
}

// Per-bookmark derived text that only depends on the indexed fields. Scoring
// used to rebuild it for every bookmark on every keystroke; with 10k bookmarks
// that regex work dominated each search pass. Entries are validated against the
// source fields they were built from, so in-place patches (catalog refresh,
// pinyin enrichment) naturally invalidate them.
interface PopupSearchBookmarkDerived {
  normalizedTitle: string
  normalizedUrl: string
  domain: string | undefined
  normalizedPath: string
  tagSummary: string
  tagContentType: string
  tagAliases: string[]
  tagTags: string[]
  tagTopics: string[]
  tagPinyinFull: string[]
  tagPinyinInitials: string[]
  normalizedDomain: string
  compactUrl: string
  compactFields: CompactSearchField[]
  contextScoreCeiling: number
  searchText: string
  searchTextCompact: string
  compactSearchText: string
  pinyinFields: PinyinSearchFields | undefined
  titlePinyinFields: CompactSearchField[]
  titlePinyinSearchText: string
  approximateTokens: string[] | null
  titleWords: string[]
  titleApproximateTokens: string[]
}

interface SearchAccelerationIndex {
  length: number
  identity: PopupSearchBookmark[]
  gramPostings: Map<string, number[]>
  shortPostings: Map<string, number[]>
  termPostingCache: Map<string, number[]>
  tokenPostings: Map<string, number[]>
  tokenGrams: Map<string, string[]>
  tokensByLength: Map<number, string[]>
  fuzzyTermCache: Map<string, Map<string, number>>
  recoveredTermCache: Map<string, RecoveredSearchTerm>
  recoveredPostingCount: number
  bookmarks: PopupSearchBookmark[]
  titlePostings: Map<string, number[]>
  titlePrefixTop: Map<string, number[]>
  exactTitles: Map<string, number[]>
  titleTermCache: Map<string, number[]>
}

interface RecoveredSearchTerm {
  postings: number[]
  minimumCost: number
}

interface RankedSearchBookmark {
  bookmark: PopupSearchBookmark
  score: number
}

const derivedCache = new WeakMap<PopupSearchBookmark, PopupSearchBookmarkDerived>()
const accelerationIndexes = new WeakMap<PopupSearchBookmark[], SearchAccelerationIndex>()
const buildingIndexes = new WeakMap<PopupSearchBookmark[], { index: SearchAccelerationIndex | null; next: number }>()
const compactTermCache = new Map<string, string>()
const COMPACT_TERM_CACHE_LIMIT = 512
const searchPathCollator = new Intl.Collator('zh-Hans-CN')

export function warmSearchAcceleration(bookmarks: PopupSearchBookmark[]): void {
  if (bookmarks.length >= SEARCH_PREFILTER_THRESHOLD) {
    buildingIndexes.delete(bookmarks)
    const index = createSearchAccelerationIndex(bookmarks)
    addBookmarksToSearchAccelerationIndex(index, bookmarks, 0, bookmarks.length)
    accelerationIndexes.set(bookmarks, index)
  }
}

export function invalidateSearchAccelerationForBookmarks(
  bookmarks: PopupSearchBookmark[]
): void {
  accelerationIndexes.delete(bookmarks)
  buildingIndexes.delete(bookmarks)
  scheduledAccelerationWarmups.delete(bookmarks)
}

const scheduledAccelerationWarmups = new WeakSet<PopupSearchBookmark[]>()
const ACCELERATION_WARM_CHUNK_SIZE = 32

function requestSearchIdle(callback: () => void, timeout = 5000): void {
  const requestIdle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number }).requestIdleCallback
  if (typeof requestIdle === 'function') requestIdle(callback, { timeout })
  else setTimeout(callback, 0)
}

export function scheduleSearchAccelerationWarmup(bookmarks: PopupSearchBookmark[]): void {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD || accelerationIndexes.has(bookmarks) || buildingIndexes.has(bookmarks) || scheduledAccelerationWarmups.has(bookmarks)) {
    return
  }
  scheduledAccelerationWarmups.add(bookmarks)
  const state = {
    index: null as SearchAccelerationIndex | null,
    next: 0
  }
  buildingIndexes.set(bookmarks, state)

  const warmChunk = () => {
    if (buildingIndexes.get(bookmarks) !== state) {
      return
    }
    state.index ||= createSearchAccelerationIndex(bookmarks)
    const deadline = performance.now() + 4
    do {
      const end = Math.min(bookmarks.length, state.next + ACCELERATION_WARM_CHUNK_SIZE)
      addBookmarksToSearchAccelerationIndex(state.index, bookmarks, state.next, end)
      state.next = end
    } while (state.next < bookmarks.length && performance.now() < deadline)
    if (state.next < bookmarks.length) {
      requestSearchIdle(warmChunk)
      return
    }
    buildingIndexes.delete(bookmarks)
    scheduledAccelerationWarmups.delete(bookmarks)
    accelerationIndexes.set(bookmarks, state.index)
  }

  requestSearchIdle(warmChunk)
}

function getCompactTerm(term: string): string {
  const cached = compactTermCache.get(term)
  if (cached !== undefined) {
    return cached
  }
  if (compactTermCache.size >= COMPACT_TERM_CACHE_LIMIT) {
    compactTermCache.clear()
  }
  const compact = normalizeSearchTextCompact(term)
  compactTermCache.set(term, compact)
  return compact
}

function getBookmarkDerived(bookmark: PopupSearchBookmark): PopupSearchBookmarkDerived {
  const cached = derivedCache.get(bookmark)
  if (
    cached &&
    cached.normalizedTitle === bookmark.normalizedTitle &&
    cached.normalizedUrl === bookmark.normalizedUrl &&
    cached.domain === bookmark.domain &&
    cached.normalizedPath === bookmark.normalizedPath &&
    cached.tagSummary === bookmark.tagSummary &&
    cached.tagContentType === bookmark.tagContentType &&
    cached.tagAliases === bookmark.tagAliases &&
    cached.tagTags === bookmark.tagTags &&
    cached.tagTopics === bookmark.tagTopics &&
    cached.tagPinyinFull === bookmark.tagPinyinFull &&
    cached.tagPinyinInitials === bookmark.tagPinyinInitials &&
    cached.pinyinFields === bookmark.pinyinFields &&
    cached.searchText === bookmark.searchText &&
    cached.searchTextCompact === bookmark.searchTextCompact
  ) {
    return cached
  }

  const compactFields = buildCompactSearchFields(bookmark)
  const compactSearchText = buildCompactSearchText(compactFields)
  const titlePinyinFields = compactFields.filter(field => field.titlePinyin)
  let contextScoreCeiling = 0
  for (let index = 3; index < compactFields.length; index++) {
    const field = compactFields[index]
    if (!field.titlePinyin && field.value) contextScoreCeiling = Math.max(contextScoreCeiling, field.weight * 8)
  }
  const titleWords = getTitleWords(bookmark.title)
  const derived: PopupSearchBookmarkDerived = {
    normalizedTitle: bookmark.normalizedTitle,
    normalizedUrl: bookmark.normalizedUrl,
    domain: bookmark.domain,
    normalizedPath: bookmark.normalizedPath,
    tagSummary: bookmark.tagSummary,
    tagContentType: bookmark.tagContentType,
    tagAliases: bookmark.tagAliases,
    tagTags: bookmark.tagTags,
    tagTopics: bookmark.tagTopics,
    tagPinyinFull: bookmark.tagPinyinFull,
    tagPinyinInitials: bookmark.tagPinyinInitials,
    searchText: bookmark.searchText,
    searchTextCompact: bookmark.searchTextCompact || '',
    normalizedDomain: normalizeText(bookmark.domain || ''),
    compactUrl: normalizeSearchTextCompact(bookmark.normalizedUrl),
    compactFields,
    contextScoreCeiling,
    compactSearchText,
    pinyinFields: bookmark.pinyinFields,
    titlePinyinFields,
    titlePinyinSearchText: buildCompactSearchText(titlePinyinFields),
    titleWords,
    titleApproximateTokens: [...new Set([
      ...titleWords,
      ...(bookmark.normalizedTitle.match(/[a-z][a-z0-9]{2,}/g) || []),
      ...(bookmark.pinyinFields?.title.full || [])
    ])],
    approximateTokens: null
  }
  derivedCache.set(bookmark, derived)
  return derived
}

export function indexBookmarkForSearch(
  bookmark: BookmarkRecord,
  tagRecord: BookmarkTagRecord | null = null,
  snapshotRecord: ContentSnapshotRecord | null = null,
  options: { includeFullText?: boolean } = {}
): PopupSearchBookmark {
  const normalizedPath = normalizeText(bookmark.path || '')
  const normalizedDomain = normalizeText(bookmark.domain || '')
  const tagSummary = normalizeText(tagRecord?.summary || '')
  const tagContentType = normalizeText(tagRecord?.contentType || '')
  const tagTopics = normalizeSearchList(tagRecord?.topics)
  const tagTags = normalizeSearchList(getEffectiveBookmarkTags(tagRecord))
  const tagAliases = normalizeSearchList(tagRecord?.aliases)
  const snapshotSearchText = buildContentSnapshotSearchText(snapshotRecord, options)

  const searchText = [
    bookmark.normalizedTitle,
    bookmark.normalizedUrl,
    normalizedPath,
    normalizedDomain,
    tagContentType,
    ...tagTopics,
    ...tagTags,
    ...tagAliases,
    tagSummary,
    snapshotSearchText
  ]
    .filter(Boolean)
    .join('\u0000')

  return {
    ...bookmark,
    normalizedPath,
    tagSummary,
    tagContentType,
    tagTopics,
    tagTags,
    tagAliases,
    tagPinyinFull: [],
    tagPinyinInitials: [],
    pinyinFields: undefined,
    searchText,
    searchTextCompact: normalizeSearchTextCompact(searchText)
  }
}

export function searchBookmarks(
  query: string,
  bookmarks: PopupSearchBookmark[]
): PopupSearchResult[] {
  return searchBookmarksWithLimit(query, bookmarks, MAX_POPUP_SEARCH_RESULTS)
}

export function searchBookmarksTopK(
  query: string,
  bookmarks: PopupSearchBookmark[],
  limit: number,
  offset = 0
): PopupSearchResult[] {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0))
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0))
  if (!safeLimit) {
    return []
  }

  return searchBookmarksWithLimit(query, bookmarks, safeLimit + safeOffset)
    .slice(safeOffset, safeOffset + safeLimit)
}

export interface PopupSearchFirstBatch {
  results: PopupSearchResult[]
  scanned: number
  complete: boolean
}

export function searchBookmarksFirstBatch(
  query: string,
  bookmarks: PopupSearchBookmark[],
  limit = MAX_POPUP_SEARCH_RESULTS
): PopupSearchFirstBatch {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0))
  const parsedQuery = parsePopupSearchQuery(query)
  if (!safeLimit) {
    return { results: [], scanned: 0, complete: false }
  }

  const indexedCandidates = getIndexedSearchCandidates(bookmarks, parsedQuery, safeLimit)
  if (indexedCandidates) {
    const results = searchRankedCandidates(indexedCandidates, parsedQuery, safeLimit)
    return {
      results,
      scanned: indexedCandidates.length,
      complete: true
    }
  }
  if (!canUseFastFirstBatch(parsedQuery)) {
    return { results: [], scanned: 0, complete: false }
  }

  const topResults = createTopKCollector<PopupSearchResult>(safeLimit, compareSearchResults)
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  let scanned = 0

  for (const bookmark of bookmarks) {
    if (topResults.size >= safeLimit && scanned >= FIRST_BATCH_MAX_SCAN_WITH_RESULTS) break
    scanned += 1
    if (!matchesFastFirstBatchCandidate(bookmark, parsedQuery, terms)) {
      continue
    }

    const score = getQuickSearchScore(bookmark, parsedQuery, terms)
    if (score > 0) {
      topResults.add({
        ...bookmark,
        score,
        matchReasons: []
      })
    }

  }

  const ranked = topResults.sortedValues()
  // A weak URL/path preview can be replaced by a better fuzzy title. Do not
  // let a quick Enter latch onto that provisional bookmark while ranking runs.
  if (shouldRecoverSearch(parsedQuery, ranked)) return { results: [], scanned, complete: false }
  return {
    results: searchRankedCandidates(ranked.map(bookmark => ({ bookmark, score: bookmark.score })), parsedQuery, safeLimit),
    scanned,
    complete: scanned >= bookmarks.length
  }
}

function searchBookmarksWithLimit(
  query: string,
  bookmarks: PopupSearchBookmark[],
  limit: number
): PopupSearchResult[] {
  const parsedQuery = parsePopupSearchQuery(query)
  const indexedCandidates = getIndexedSearchCandidates(bookmarks, parsedQuery, limit)
  if (indexedCandidates) {
    return searchRankedCandidates(indexedCandidates, parsedQuery, limit)
  }

  return searchCandidatesWithLimit(bookmarks, parsedQuery, limit)
}

function searchCandidatesWithLimit(
  candidates: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  limit: number
): PopupSearchResult[] {
  const topResults = createTopKCollector<RankedSearchBookmark>(limit, compareRankedSearchBookmarks)
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  for (const bookmark of candidates) {
    const score = getQuickSearchScore(bookmark, parsedQuery, terms)
    if (score > 0) topResults.add({ bookmark, score })
  }
  if (!shouldRecoverSearch(parsedQuery, topResults.sortedValues())) {
    return searchRankedCandidates(topResults.sortedValues(), parsedQuery, limit)
  }
  // During background index construction, preserve typo recovery without
  // blocking the input on construction of the whole inverted index.
  return scoreFallbackCandidates(candidates, parsedQuery, limit)
}

function scoreFallbackCandidates(
  candidates: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  limit: number
): PopupSearchResult[] {
  const tokens = new Set<string>()
  if (parsedQuery.textTerms.some(isApproximateLatinTerm)) {
    for (const bookmark of candidates) {
      for (const token of collectApproximateSearchTokens(bookmark)) tokens.add(token)
    }
  }
  prepareScanApproximateTerms(parsedQuery, tokens)
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  const collector = createTopKCollector<RankedSearchBookmark>(limit, compareRankedSearchBookmarks)
  for (const bookmark of candidates) {
    const score = getQuickSearchScore(bookmark, parsedQuery, terms)
    if (score > 0) collector.add({ bookmark, score })
  }
  return searchRankedCandidates(collector.sortedValues(), parsedQuery, limit)
}

function prepareScanApproximateTerms(parsedQuery: ParsedPopupSearchQuery, tokens: Set<string>): void {
  parsedQuery.approximateDistances = getCandidateRequiredTerms(parsedQuery).filter(Boolean).map(term => {
    const matches = new Map<string, number>()
    if (!isApproximateLatinTerm(term) || term.length > 48 || parsedQuery.phraseTerms.includes(term)) return matches
    for (const token of tokens) {
      const cost = getApproximateTokenCost(term, token)
      if (cost !== null) matches.set(token, cost)
    }
    return matches
  })
  parsedQuery.approximateTerms = parsedQuery.approximateDistances.map(matches => [...matches.keys()])
}

function shouldRecoverSearch(parsedQuery: ParsedPopupSearchQuery, results: { score: number }[]): boolean {
  if (results[0]?.score >= 1480) return false
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  return terms.length > 0 && terms.length <= 6 && terms.some(term =>
    !parsedQuery.phraseTerms.includes(term) && (isApproximateLatinTerm(term) || canRecoverTitleTerm(term))
  )
}

function searchRankedCandidates(
  candidates: RankedSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  limit: number
): PopupSearchResult[] {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0))
  if (!safeLimit) {
    return []
  }

  // Every candidate uses the same relevance score. Only visible results need
  // human-readable explanations; building those strings dominated query time.
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  return candidates.slice(0, safeLimit).map(candidate => {
    const reasons: string[] = []
    getQuickSearchScore(candidate.bookmark, parsedQuery, terms, undefined, false, reasons)
    return {
      ...candidate.bookmark,
      score: candidate.score,
      matchReasons: reasons.length ? prioritizeSearchReasons(reasons, 3) : [`命中：本地索引 ${parsedQuery.normalizedQuery}`]
    }
  })
}

function compareRankedSearchBookmarks(
  left: RankedSearchBookmark,
  right: RankedSearchBookmark
): number {
  if (right.score !== left.score) {
    return right.score - left.score
  }
  return compareBookmarkOrder(left.bookmark, right.bookmark)
}

export async function searchBookmarksCooperatively(
  query: string,
  bookmarks: PopupSearchBookmark[],
  options: CooperativeSearchOptions
): Promise<PopupSearchResult[]> {
  assertSearchActive(options)
  const parsedQuery = parsePopupSearchQuery(query)
  const indexed = getIndexedSearchCandidates(bookmarks, parsedQuery, MAX_POPUP_SEARCH_RESULTS)
  if (indexed) return searchRankedCandidates(indexed, parsedQuery, MAX_POPUP_SEARCH_RESULTS)
  const collector = createTopKCollector<RankedSearchBookmark>(MAX_POPUP_SEARCH_RESULTS, compareRankedSearchBookmarks)
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  await processSearchChunks(bookmarks, options, bookmark => {
    const score = getQuickSearchScore(bookmark, parsedQuery, terms)
    if (score > 0) collector.add({ bookmark, score })
  })
  if (!shouldRecoverSearch(parsedQuery, collector.sortedValues())) {
    return searchRankedCandidates(collector.sortedValues(), parsedQuery, MAX_POPUP_SEARCH_RESULTS)
  }
  const tokens = new Set<string>()
  if (terms.some(isApproximateLatinTerm)) {
    await processSearchChunks(bookmarks, options, bookmark => {
      for (const token of collectApproximateSearchTokens(bookmark)) tokens.add(token)
    })
  }
  prepareScanApproximateTerms(parsedQuery, tokens)
  const recovered = createTopKCollector<RankedSearchBookmark>(MAX_POPUP_SEARCH_RESULTS, compareRankedSearchBookmarks)
  await processSearchChunks(bookmarks, options, bookmark => {
    const score = getQuickSearchScore(bookmark, parsedQuery, terms)
    if (score > 0) recovered.add({ bookmark, score })
  })
  return searchRankedCandidates(recovered.sortedValues(), parsedQuery, MAX_POPUP_SEARCH_RESULTS)
}

async function processSearchChunks<T>(
  items: T[],
  options: CooperativeSearchOptions,
  processItem: (item: T, index: number) => void,
  start = 0
): Promise<void> {
  if (start >= items.length) {
    return
  }

  assertSearchActive(options)
  let end = Math.min(start + SEARCH_CHUNK_SIZE, items.length)
  for (let index = start; index < end; index += 1) {
    processItem(items[index], index)
  }

  if (end < items.length) {
    await yieldSearchWork(options)
    await processSearchChunks(items, options, processItem, end)
  }
}

export function getQueryTerms(query: string): string[] {
  return [...new Set(String(query || '').split(/\s+/).filter(Boolean))]
}

export function normalizeQuery(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value))
}

function parsePopupSearchQuery(query: string): ParsedPopupSearchQuery {
  const parsed = parseSearchQuery(query)
  const excludedTerms = parsed.excludedTerms
  const isUnquotedRecencyTerm = (term: string) => !parsed.literalTerms.includes(term) && isRecencyHintTerm(term)
  const recencyHint = parsed.textTerms.some(isUnquotedRecencyTerm)
  const textTerms = parsed.textTerms.filter((term) => !isUnquotedRecencyTerm(term))
  const normalizedQuery = buildSearchTextQuery({ ...parsed, textTerms, excludedTerms })
  const hasStructuredFilters = Boolean(
    parsed.siteFilters.length ||
    parsed.urlFilters.length ||
    parsed.folderFilters.length ||
    parsed.typeFilters.length ||
    excludedTerms.length ||
    parsed.dateRange
  )
  const compactQuery = normalizeSearchTextCompact(normalizedQuery)
  return {
    ...parsed,
    textTerms,
    excludedTerms,
    normalizedQuery,
    recencyHint,
    hasStructuredFilters,
    compactQuery,
    compactDomainQuery: URL_STRUCTURE_PATTERN.test(normalizedQuery.normalize('NFKC')) ? '' : compactQuery,
    domainTerms: new Set(textTerms.filter(term => !URL_STRUCTURE_PATTERN.test(term.normalize('NFKC')))),
    termCompacts: textTerms.map(getCompactTerm),
    literalTermFlags: textTerms.map(term => parsed.literalTerms.includes(term)),
    domainEvidenceCache: new Map(),
    phraseTerms: parsed.literalTerms,
    siteMatchCache: new Map()
  }
}

function isRecencyHintTerm(term: string): boolean {
  const normalized = normalizeText(term).replace(/^sort[:：]/, '')
  return RECENT_SORT_TERMS.has(normalized) || (normalized === 'new' && /^sort[:：]/.test(term))
}

function canUseFastFirstBatch(parsedQuery: ParsedPopupSearchQuery): boolean {
  if (
    !parsedQuery.normalizedQuery ||
    parsedQuery.hasStructuredFilters ||
    parsedQuery.recencyHint
  ) {
    return false
  }

  return true
}

function matchesFastFirstBatchCandidate(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery,
  terms: string[]
): boolean {
  if (!terms.length || !matchesRequiredPhraseTerms(bookmark, parsedQuery)) {
    return false
  }

  return terms.every((term) => matchesSearchCandidateText(bookmark, term))
}

function getQuickSearchScore(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery,
  terms: string[],
  preparedDerived?: PopupSearchBookmarkDerived,
  filtersChecked = false,
  reasons?: string[]
): number {
  if ((!filtersChecked && !matchesSearchCandidateFilters(bookmark, parsedQuery)) || !matchesRequiredPhraseTerms(bookmark, parsedQuery)) return 0
  const query = parsedQuery.normalizedQuery
  const derived = preparedDerived || getBookmarkDerived(bookmark)
  if (reasons) {
    matchesStructuredFilters(bookmark, parsedQuery, reasons)
    if (parsedQuery.recencyHint) addReason(reasons, '排序：最近添加优先')
  }
  if (!query) {
    return parsedQuery.hasStructuredFilters || parsedQuery.recencyHint
      ? 1 + (parsedQuery.recencyHint ? getBookmarkRecencyBoost(bookmark) : 0)
      : 0
  }

  let termScore = 0
  let typoCount = 0
  let recoveryCost = 0
  let corroboration = 0
  let allTitleTerms = true
  let allIdentityTerms = true
  const domainEvidence = getDomainQueryEvidence(derived, parsedQuery, terms)
  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex]
    const compact = parsedQuery.termCompacts[termIndex]
    const literal = parsedQuery.literalTermFlags[termIndex]
    const titleMatch = bookmark.normalizedTitle.includes(term)
    const compactTitleMatch = Boolean(!titleMatch && !literal && compact && derived.compactFields[0].value.includes(compact))
    const titlePinyinMatch = Boolean(!titleMatch && !compactTitleMatch && !literal && compact && derived.titlePinyinSearchText.includes(compact))
    const directTitleMatch = titleMatch || compactTitleMatch || titlePinyinMatch
    const domainWeight = domainEvidence.termWeights[termIndex]
    const checkUrl = !domainWeight && (!directTitleMatch || Boolean(reasons))
    const urlMatch = checkUrl && bookmark.normalizedUrl.includes(term)
    const compactUrlMatch = Boolean(checkUrl && !urlMatch && !literal && compact && derived.compactUrl.includes(compact))
    let weight = 0
    if (titleMatch) weight = 320
    else if (compactTitleMatch || titlePinyinMatch) weight = 280
    else if (domainWeight) weight = domainWeight
    else if (urlMatch) weight = 180
    else if (compactUrlMatch) weight = 160
    else if (!literal && derived.compactSearchText.includes(compact || '\u0000\u0000')) weight = 120
    else if ((literal ? getBookmarkLiteralSearchText(bookmark) : derived.searchText).includes(term)) weight = 40
    let titleTerm = weight >= 280
    let recoveredLabel = ''
    if (weight < 280 && parsedQuery.approximateTerms && !literal) {
      const recovery = recoverSearchTerm(bookmark, derived, parsedQuery, term, termIndex)
      if (recovery && (!weight || recovery.title)) {
        weight = recovery.title ? 280 : 40
        titleTerm = recovery.title
        typoCount++
        recoveryCost += recovery.cost
        recoveredLabel = recovery.label
      }
    }
    if (!weight) return 0
    allTitleTerms &&= titleTerm
    allIdentityTerms &&= titleTerm || domainWeight > 0
    termScore += weight
    if (titleTerm && !recoveredLabel) {
      corroboration += domainEvidence.termBoosts[termIndex]
    }
    if (reasons) {
      if (recoveredLabel) addFieldMatchReason(reasons, recoveredLabel, term)
      else if (titleMatch || compactTitleMatch) addFieldMatchReason(reasons, '标题', term)
      else if (titlePinyinMatch) {
        const field = getBestTitlePinyinField(derived, compact)
        if (field) addFieldMatchReason(reasons, field.label, term)
      }
      if (domainWeight) addFieldMatchReason(reasons, '站点', bookmark.domain || term)
      else if (urlMatch || compactUrlMatch) addFieldMatchReason(reasons, '网址', term)
      if (!titleTerm && !domainWeight && !urlMatch && !compactUrlMatch && !recoveredLabel) {
        addFieldMatchReason(reasons, getContextMatchLabel(bookmark, derived, term, literal ? '' : compact), term)
      }
    }
  }
  if (reasons && terms.length > 1) addReason(reasons, buildQueryCoverageReason(terms))
  if (typoCount) {
    return Math.max(1, (allTitleTerms ? 1320 : 500) - recoveryCost * 40 +
      (parsedQuery.recencyHint ? getBookmarkRecencyBoost(bookmark) : 0))
  }

  // Keep match-quality tiers, then add bounded independent title/host evidence.
  // The hostname inside a URL and repeated tags must never count as new fields.
  const compactQuery = parsedQuery.phraseTerms.length ? '' : parsedQuery.compactQuery
  let score = Math.max(
    getTitleTextScore(bookmark.normalizedTitle, derived.compactFields[0].value, query, compactQuery),
    domainEvidence.score
  )
  for (let fieldIndex = 3; fieldIndex < derived.compactFields.length; fieldIndex++) {
    const field = derived.compactFields[fieldIndex]
    const ceiling = field.titlePinyin ? (field.initials ? 2400 : 3600) : field.weight * 8
    if (score >= ceiling) continue
    score = Math.max(score, field.titlePinyin
      ? getTitlePinyinFieldScore(field, compactQuery)
      : relevanceFieldScore(field.value, compactQuery, field.weight * 8, field.weight * 5, field.weight * 3))
  }
  if (score < 1000) score = Math.max(score, relevanceFieldScore(bookmark.normalizedUrl, query, 1000, 800, 600))
  if (score < 900) score = Math.max(score, relevanceFieldScore(derived.compactUrl, compactQuery, 900, 700, 500))
  score += termScore / Math.max(1, terms.length)
  if (terms.length > 1) {
    if (allTitleTerms) score = Math.max(score, 1600 + termScore / terms.length)
    else if (allIdentityTerms) score = Math.max(score, 1500 + termScore / terms.length)
    score += scoreOrderedTermProximity(bookmark.normalizedTitle, terms)
  }
  score += corroboration / Math.max(1, terms.length)
  if (parsedQuery.recencyHint) score += getBookmarkRecencyBoost(bookmark)
  return Math.max(1, score)
}

function getDomainQueryEvidence(
  derived: PopupSearchBookmarkDerived, parsedQuery: ParsedPopupSearchQuery, terms: string[]
): DomainQueryEvidence {
  const cached = parsedQuery.domainEvidenceCache.get(derived.normalizedDomain)
  if (cached) return cached
  const domain = derived.normalizedDomain
  const compactDomain = derived.compactFields[2].value
  const termWeights: number[] = []
  const termBoosts: number[] = []
  for (let index = 0; index < terms.length; index++) {
    const term = terms[index]
    const compact = !parsedQuery.literalTermFlags[index] && parsedQuery.domainTerms.has(term)
      ? parsedQuery.termCompacts[index] : ''
    const weight = domain.includes(term) ? 220 : compact && compactDomain.includes(compact) ? 200 : 0
    termWeights.push(weight)
    termBoosts.push(weight ? getDomainCorroborationScore(derived, term, compact) : 0)
  }
  // Many bookmarks share a host. Cache only query-local host evidence, not
  // result scores, so titles, filters, exclusions and live updates stay independent.
  const evidence = {
    score: Math.max(
      relevanceFieldScore(domain, parsedQuery.normalizedQuery, 1500, 1150, 900),
      relevanceFieldScore(compactDomain, parsedQuery.phraseTerms.length ? '' : parsedQuery.compactDomainQuery, 1300, 1000, 700)
    ),
    termWeights,
    termBoosts,
    maximumCorroboration: termBoosts.reduce((sum, score) => sum + score, 0) / Math.max(1, terms.length)
  }
  parsedQuery.domainEvidenceCache.set(domain, evidence)
  return evidence
}

function getDomainCorroborationScore(derived: PopupSearchBookmarkDerived, term: string, compact: string): number {
  const domain = derived.normalizedDomain
  let index = domain.indexOf(term)
  if (index < 0 && compact && compact !== term) {
    const compatibleTerm = normalizeText(term.normalize('NFKC'))
    if (compatibleTerm !== term) {
      term = compatibleTerm
      index = domain.indexOf(term)
    }
  }
  if (index < 0) return compact && derived.compactFields[2].value.includes(compact) ? 160 : 0
  let best = 0
  while (index >= 0) {
    const startsLabel = index === 0 || /[.-]/.test(domain[index - 1])
    const end = index + term.length
    const endsLabel = end === domain.length || /[.-]/.test(domain[end])
    const score = startsLabel ? (endsLabel ? MAX_TITLE_DOMAIN_BOOST : 280) : 140
    best = Math.max(best, score)
    if (best === MAX_TITLE_DOMAIN_BOOST) break
    index = domain.indexOf(term, index + 1)
  }
  return best
}

function addFieldMatchReason(reasons: string[], label: string, term: string): void {
  const prefix = `命中：${label} `
  if (!reasons.some(reason => reason.startsWith(prefix))) addReason(reasons, `${prefix}${term}`)
}

function getContextMatchLabel(
  bookmark: PopupSearchBookmark, derived: PopupSearchBookmarkDerived, term: string, compact: string
): string {
  let best: CompactSearchField | undefined
  let bestScore = 0
  if (compact) {
    for (const field of derived.compactFields.slice(3)) {
      if (field.titlePinyin) continue
      const score = relevanceFieldScore(field.value, compact, field.weight * 8, field.weight * 5, field.weight * 3)
      if (score > bestScore) {
        best = field
        bestScore = score
      }
    }
  }
  if (best) return best.label.replace(/^紧凑/, '')
  if (bookmark.tagAliases.some(value => value.includes(term))) return '别名'
  if (bookmark.tagTags.some(value => value.includes(term))) return '标签'
  if (bookmark.tagTopics.some(value => value.includes(term))) return '主题'
  if (bookmark.normalizedPath.includes(term)) return '文件夹'
  if (bookmark.tagSummary.includes(term)) return '摘要'
  if (bookmark.tagContentType.includes(term)) return '类型'
  return '网页内容'
}

function recoverSearchTerm(
  bookmark: PopupSearchBookmark,
  derived: PopupSearchBookmarkDerived,
  parsedQuery: ParsedPopupSearchQuery,
  term: string,
  termIndex: number
): { cost: number; title: boolean; label: string } | null {
  const variants = parsedQuery.approximateDistances?.[termIndex]
  let titleCost = Infinity
  for (const token of derived.titleApproximateTokens) {
    titleCost = Math.min(titleCost, variants?.get(token) ?? Infinity)
  }
  if (Number.isFinite(titleCost)) return { cost: titleCost, title: true, label: '标题近似' }
  const fragmentCost = chineseTitleFragmentCost(derived.compactFields[0].value, term)
  if (fragmentCost !== null) return { cost: fragmentCost, title: true, label: '标题片段' }
  const abbreviationCost = titleAbbreviationCost(derived.titleWords, term)
  if (abbreviationCost !== null) return { cost: abbreviationCost, title: true, label: '标题缩写' }
  let contextCost = Infinity
  if (variants?.size) {
    for (const token of collectApproximateSearchTokens(bookmark)) {
      contextCost = Math.min(contextCost, variants.get(token) ?? Infinity)
    }
  }
  return Number.isFinite(contextCost) ? { cost: contextCost, title: false, label: '近似' } : null
}

function relevanceFieldScore(value: string, query: string, exact: number, prefix: number, substring: number): number {
  if (!value || !query) return 0
  if (value === query) return exact
  if (value.startsWith(query)) return prefix + getBoundaryMatchBonus(value, 0, query.length, 40)
  let index = value.indexOf(query)
  let best = 0
  while (index >= 0) {
    best = Math.max(best, substring + getBoundaryMatchBonus(value, index, query.length, 40) - Math.min(index, 100))
    index = value.indexOf(query, index + 1)
  }
  return best
}

function getTitleTextScore(title: string, compactTitle: string, query: string, compactQuery: string): number {
  const literalScore = relevanceFieldScore(title, query, 5000, 2600, 1600)
  if (!compactQuery || literalScore >= 3600) return literalScore
  if (!literalScore) return relevanceFieldScore(compactTitle, compactQuery, 3600, 2200, 1300)
  if (compactTitle === compactQuery) return Math.max(literalScore, 3600)
  // A compact infix cannot beat any literal title hit. Only an exact or
  // compact-prefix match can improve it; avoid scanning the same title twice.
  if (literalScore >= 2240 || !compactTitle.startsWith(compactQuery)) return literalScore
  return Math.max(literalScore, 2200 + getBoundaryMatchBonus(compactTitle, 0, compactQuery.length, 40))
}

function getTitlePinyinFieldScore(field: CompactSearchField, query: string): number {
  // Short initials can coincide with ordinary words (e.g. "any"). Keep them
  // discoverable without letting an accidental acronym outrank a literal prefix.
  return field.initials
    ? relevanceFieldScore(field.value, query, 2400, 2000, 1300)
    : relevanceFieldScore(field.value, query, 3600, 2200, 1300)
}

function getBestTitlePinyinField(derived: PopupSearchBookmarkDerived, query: string): CompactSearchField | undefined {
  let best: CompactSearchField | undefined
  let bestScore = 0
  for (const field of derived.titlePinyinFields) {
    const score = getTitlePinyinFieldScore(field, query)
    if (score > bestScore) {
      best = field
      bestScore = score
    }
  }
  return best
}

function getTitlePinyinScore(derived: PopupSearchBookmarkDerived, query: string): number {
  let score = 0
  for (const field of derived.titlePinyinFields) {
    score = Math.max(score, getTitlePinyinFieldScore(field, query))
  }
  return score
}

function rankIndexedCandidates(
  bookmarks: PopupSearchBookmark[],
  candidateIndexes: number[],
  parsedQuery: ParsedPopupSearchQuery,
  terms: string[],
  limit: number
): RankedSearchBookmark[] {
  const collector = createTopKCollector<RankedSearchBookmark>(limit, compareRankedSearchBookmarks)
  for (const bookmarkIndex of candidateIndexes) {
    // With no direct matches, every result pays at least one recovery step.
    // Postings follow the final tie order, so a full heap at that ceiling is final.
    if (parsedQuery.recoveryScoreCeiling !== undefined && collector.size >= limit &&
      collector.worst!.score >= parsedQuery.recoveryScoreCeiling) break
    const bookmark = bookmarks[bookmarkIndex]
    if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) continue
    const derived = derivedCache.get(bookmark) || getBookmarkDerived(bookmark)
    const worst = collector.size >= limit ? collector.worst : undefined
    if (worst && parsedQuery.normalizedQuery && !parsedQuery.approximateTerms) {
      // Bound metadata by this bookmark's actual fields. Check title (including
      // pinyin), host and URL separately, including the host's support for each term.
      // This is a score bound, never a cap on the number of candidates.
      const query = parsedQuery.normalizedQuery
      const compactQuery = parsedQuery.phraseTerms.length ? '' : parsedQuery.compactQuery
      const compactTerm = terms.length === 1 ? parsedQuery.termCompacts[0] : ''
      const literalTerm = terms.length === 1 && parsedQuery.literalTermFlags[0]
      const domainEvidence = getDomainQueryEvidence(derived, parsedQuery, terms)
      const termBound = terms.length === 1
        ? bookmark.normalizedTitle.includes(terms[0]) ? 320
          : !literalTerm && compactTerm && derived.compactFields[0].value.includes(compactTerm) ? 280
            : !literalTerm && compactTerm && derived.titlePinyinSearchText.includes(compactTerm) ? 280
            : domainEvidence.termWeights[0] ? domainEvidence.termWeights[0]
                : bookmark.normalizedUrl.includes(terms[0]) ? 180
                  : !literalTerm && compactTerm && derived.compactUrl.includes(compactTerm) ? 160 : 120
        : 320
      const corroborationBound = terms.length === 1
        ? termBound >= 280 ? domainEvidence.termBoosts[0] : 0
        : domainEvidence.maximumCorroboration
      let fieldBound = Math.max(
        getTitleTextScore(bookmark.normalizedTitle, derived.compactFields[0].value, query, compactQuery),
        getTitlePinyinScore(derived, compactQuery),
        domainEvidence.score,
        derived.contextScoreCeiling,
        terms.length > 1 ? 1600 : 0
      )
      if (fieldBound < 1000) fieldBound = Math.max(fieldBound, relevanceFieldScore(bookmark.normalizedUrl, query, 1000, 800, 600))
      if (fieldBound < 900) fieldBound = Math.max(fieldBound, relevanceFieldScore(derived.compactUrl, compactQuery, 900, 700, 500))
      const upperBound = fieldBound + termBound + corroborationBound +
        (terms.length > 1 ? scoreOrderedTermProximity(bookmark.normalizedTitle, terms) : 0) + (parsedQuery.recencyHint ? 120 : 0)
      if (upperBound < worst.score || (upperBound === worst.score && compareBookmarkOrder(bookmark, worst.bookmark) >= 0)) continue
    }
    const score = getQuickSearchScore(bookmark, parsedQuery, terms, derived, true)
    if (score > 0) collector.add({ bookmark, score })
  }
  return collector.sortedValues()
}

function buildCompactSearchFields(bookmark: PopupSearchBookmark): CompactSearchField[] {
  return [
    { value: normalizeSearchTextCompact(bookmark.normalizedTitle), label: '紧凑标题', weight: 240 },
    { value: normalizeSearchTextCompact(bookmark.normalizedUrl), label: '紧凑网址', weight: 170 },
    { value: normalizeSearchTextCompact(bookmark.domain || ''), label: '紧凑站点', weight: 210 },
    { value: normalizeSearchTextCompact(bookmark.normalizedPath), label: '紧凑文件夹', weight: 80 },
    ...bookmark.tagAliases.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '紧凑别名',
      weight: 130
    })),
    ...bookmark.tagTags.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '紧凑标签',
      weight: 120
    })),
    ...bookmark.tagTopics.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '紧凑主题',
      weight: 100
    })),
    ...(bookmark.pinyinFields ? [
      ...buildCompactPinyinFields(bookmark.pinyinFields.title, '标题', 240, true),
      ...buildCompactPinyinFields(bookmark.pinyinFields.path, '文件夹', 40),
      ...buildCompactPinyinFields(bookmark.pinyinFields.metadata, '标签', 100)
    ] : buildCompactPinyinFields({ full: bookmark.tagPinyinFull, initials: bookmark.tagPinyinInitials }, '', 100))
  ]
}

function buildCompactPinyinFields(tokens: PinyinTokens, source: string, weight: number, titlePinyin = false): CompactSearchField[] {
  return [
    ...tokens.full.map(value => ({ value: normalizeSearchTextCompact(value), label: `${source}拼音`, weight, titlePinyin })),
    ...tokens.initials.map(value => ({ value: normalizeSearchTextCompact(value), label: `${source}首字母`, weight, titlePinyin, initials: true }))
  ]
}

function buildCompactSearchText(fields: CompactSearchField[]): string {
  return fields
    .map((field) => field.value)
    .filter(Boolean)
    .join('\u0000')
}

function matchesStructuredFilters(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery,
  reasons: string[]
): boolean {
  if (!parsedQuery.hasStructuredFilters) {
    return true
  }

  if (!matchesParsedSearchQuery(parsedQuery, {
    searchText: getBookmarkLiteralSearchText(bookmark),
    domain: bookmark.domain,
    url: bookmark.normalizedUrl,
    path: bookmark.path,
    type: bookmark.tagContentType,
    dateAdded: bookmark.dateAdded
  })) {
    return false
  }

  if (parsedQuery.siteFilters.length) {
    const domain = getBookmarkDerived(bookmark).normalizedDomain
    const url = bookmark.normalizedUrl || ''
    const matchedSite = parsedQuery.siteFilters.find((filter) =>
      matchesSearchSiteFilter(filter, domain, url)
    )
    if (!matchedSite) {
      return false
    }
    addReason(reasons, `筛选：站点 ${matchedSite}`)
  }

  if (parsedQuery.urlFilters.length) {
    const matchedUrl = parsedQuery.urlFilters.find((filter) => bookmark.normalizedUrl.includes(filter))
    if (matchedUrl) {
      addReason(reasons, `筛选：网址 ${matchedUrl}`)
    }
  }

  if (parsedQuery.folderFilters.length) {
    const matchedFolder = parsedQuery.folderFilters.find((filter) =>
      bookmark.normalizedPath.includes(filter)
    )
    if (!matchedFolder) {
      return false
    }
    addReason(reasons, `筛选：文件夹 ${matchedFolder}`)
  }

  if (parsedQuery.typeFilters.length) {
    const matchedType = parsedQuery.typeFilters.find((filter) =>
      bookmark.tagContentType.includes(filter)
    )
    if (!matchedType) {
      return false
    }
    addReason(reasons, `筛选：类型 ${matchedType}`)
  }

  if (parsedQuery.excludedTerms.length) {
    addReason(reasons, `排除：${parsedQuery.excludedTerms.join('、')}`)
  }

  if (parsedQuery.dateRange) {
    addReason(reasons, `筛选：${parsedQuery.dateRange.label}`)
  }

  return true
}

function matchesRequiredPhraseTerms(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): boolean {
  const phraseTerms = parsedQuery.phraseTerms
  if (!phraseTerms.length) {
    return true
  }

  const searchText = getBookmarkLiteralSearchText(bookmark)
  return phraseTerms.every((term) => searchText.includes(term))
}

function isApproximateLatinTerm(term: string): boolean {
  return /^[a-z0-9][a-z0-9+.#-]{3,}$/i.test(term)
}

function collectApproximateSearchTokens(bookmark: PopupSearchBookmark): string[] {
  const derived = getBookmarkDerived(bookmark)
  if (derived.approximateTokens) {
    return derived.approximateTokens
  }

  const values = [
    bookmark.normalizedTitle,
    bookmark.normalizedUrl,
    derived.normalizedDomain,
    bookmark.normalizedPath,
    bookmark.tagSummary,
    bookmark.tagContentType,
    ...bookmark.tagTopics,
    ...bookmark.tagTags,
    ...bookmark.tagAliases,
    ...derived.titleApproximateTokens
  ]
  const tokens = new Set<string>()

  for (const value of values) {
    const matches = String(value || '').match(/[a-z][a-z0-9]{2,}/gi) || []
    for (const match of matches) {
      const token = normalizeText(match)
      if (token.length >= 3 && token.length <= 48) {
        tokens.add(token)
      }
    }
  }

  derived.approximateTokens = [...tokens]
  return derived.approximateTokens
}

function getApproximateDistanceLimit(term: string): number {
  return term.length >= 8 ? 2 : 1
}

function getApproximateTokenCost(term: string, token: string): number | null {
  if (term === token) return null
  const limit = getApproximateDistanceLimit(term)
  if (Math.abs(token.length - term.length) <= limit) {
    const distance = damerauLevenshteinDistance(term, token, limit)
    if (distance <= limit) return distance
  }
  // Allow one typo in a meaningful prefix while the user is still typing.
  if (term.length >= 5 && token.length > term.length && !token.startsWith(term)) {
    for (const length of [term.length - 1, term.length, term.length + 1]) {
      if (damerauLevenshteinDistance(term, token.slice(0, length), 1) <= 1) return 1.5
    }
  }
  return null
}

function damerauLevenshteinDistance(left: string, right: string, limit: number): number {
  let previousPreviousRow: number[] = new Array(right.length + 1).fill(0)
  let previousRow: number[] = Array.from({ length: right.length + 1 }, (_value, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = [leftIndex]
    let rowBest = currentRow[0]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      let distance = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + substitutionCost
      )

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(distance, previousPreviousRow[rightIndex - 2] + 1)
      }

      currentRow[rightIndex] = distance
      rowBest = Math.min(rowBest, distance)
    }

    if (rowBest > limit) {
      return limit + 1
    }

    previousPreviousRow = previousRow
    previousRow = currentRow
  }

  return previousRow[right.length] ?? limit + 1
}

function normalizeSearchList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  return [...new Set(values.flatMap(value => { const mappedResult = normalizeText(value); return mappedResult ? [mappedResult] : [] }))]
}

function addReason(reasons: string[], reason: string): void {
  const text = normalizeReasonText(reason)
  if (text && !reasons.includes(text)) {
    reasons.push(text)
  }
}

function normalizeReasonText(reason: string): string {
  const text = String(reason || '').replace(/\s+/g, ' ').trim()
  return text
}

function prioritizeSearchReasons(reasons: string[], limit: number): string[] {
  const visibleLimit = Math.max(0, limit)
  if (!visibleLimit || reasons.length <= visibleLimit) {
    return reasons.slice(0, visibleLimit)
  }

  // Query chips already show filters. Preserve the evidence that explains why
  // this particular result ranks here before spending slots on shared filters.
  const fieldReasons = reasons.filter(reason => reason.startsWith('命中：'))
  const explicitReasons = reasons.filter(isExplicitSearchReason)
  const supportingReasons = reasons.filter(reason => !reason.startsWith('命中：') && !isExplicitSearchReason(reason))
  return [...fieldReasons, ...explicitReasons, ...supportingReasons].slice(0, visibleLimit)
}

function isExplicitSearchReason(reason: string): boolean {
  return /^(筛选|排除|排序)：/.test(reason)
}

function buildQueryCoverageReason(queryTerms: string[]): string {
  const termSummary = formatReasonTerms(queryTerms)
  return termSummary ? `匹配：包含全部关键词 ${termSummary}` : ''
}

function formatReasonTerms(terms: string[]): string {
  const uniqueTerms = [...new Set(terms.flatMap(term => { const mappedResult = normalizeText(term); return mappedResult ? [mappedResult] : [] }))]
  const visibleTerms = uniqueTerms.slice(0, 4)
  if (!visibleTerms.length) {
    return ''
  }

  const suffix = uniqueTerms.length > visibleTerms.length ? ` 等 ${uniqueTerms.length} 个` : ''
  return `${visibleTerms.join(' / ')}${suffix}`
}

function getBookmarkRecencyBoost(bookmark: PopupSearchBookmark): number {
  const dateAdded = Number(bookmark.dateAdded)
  if (!Number.isFinite(dateAdded) || dateAdded <= 0) {
    return 0
  }

  const ageDays = Math.max(0, (Date.now() - dateAdded) / (24 * 60 * 60 * 1000))
  if (ageDays <= 7) {
    return 120
  }
  if (ageDays <= 30) {
    return 90
  }
  if (ageDays <= 90) {
    return 58
  }
  if (ageDays <= 180) {
    return 30
  }
  return 8
}

function getCandidateRequiredTerms(parsedQuery: ParsedPopupSearchQuery): string[] {
  return parsedQuery.textTerms.length
    ? parsedQuery.textTerms
    : [parsedQuery.normalizedQuery]
}

function createSearchAccelerationIndex(
  bookmarks: PopupSearchBookmark[]
): SearchAccelerationIndex {
  return {
    length: bookmarks.length,
    identity: bookmarks,
    gramPostings: new Map(),
    shortPostings: new Map(),
    termPostingCache: new Map(),
    tokenPostings: new Map(),
    tokenGrams: new Map(),
    tokensByLength: new Map(),
    fuzzyTermCache: new Map(),
    recoveredTermCache: new Map(),
    recoveredPostingCount: 0,
    bookmarks: bookmarks.slice().sort(compareBookmarkOrder),
    titlePostings: new Map(),
    titlePrefixTop: new Map(),
    exactTitles: new Map(),
    titleTermCache: new Map()
  }
}

function addBookmarksToSearchAccelerationIndex(
  index: SearchAccelerationIndex,
  bookmarks: PopupSearchBookmark[],
  start: number,
  end: number
): void {
  for (let bookmarkIndex = start; bookmarkIndex < end; bookmarkIndex += 1) {
    const bookmark = index.bookmarks[bookmarkIndex]
    const derived = getBookmarkDerived(bookmark)
    const fields = derived.compactFields
    for (const title of new Set([bookmark.normalizedTitle, fields[0].value, ...derived.titlePinyinFields.map(field => field.value)])) {
      collectSearchNgrams(title,
        gram => addIndexPosting(index.titlePostings, gram, bookmarkIndex),
        short => addIndexPosting(index.titlePostings, short, bookmarkIndex))
      addIndexPosting(index.exactTitles, title, bookmarkIndex)
    }
    for (let length = 1; length <= Math.min(12, bookmark.normalizedTitle.length); length++) {
      const prefix = bookmark.normalizedTitle.slice(0, length)
      if (/\s/.test(prefix)) break
      addTitlePrefixCandidate(index, prefix, bookmarkIndex)
    }
    for (const field of fields) {
      collectSearchNgrams(
        field.value,
        (gram) => addIndexPosting(index.gramPostings, gram, bookmarkIndex),
        (short) => addIndexPosting(index.shortPostings, short, bookmarkIndex)
      )
    }
    collectSearchNgrams(
      getBookmarkSearchText(bookmark),
      (gram) => addIndexPosting(index.gramPostings, gram, bookmarkIndex),
      (short) => addIndexPosting(index.shortPostings, short, bookmarkIndex)
    )
    for (const token of collectApproximateSearchTokens(bookmark)) {
      if (!index.tokenPostings.has(token)) {
        const byLength = index.tokensByLength.get(token.length) || []
        byLength.push(token)
        index.tokensByLength.set(token.length, byLength)
        const grams = new Set<string>()
        for (let offset = 0; offset + 2 <= token.length; offset++) grams.add(token.slice(offset, offset + 2))
        for (const gram of grams) {
          const tokens = index.tokenGrams.get(gram) || []
          tokens.push(token)
          index.tokenGrams.set(gram, tokens)
        }
      }
      addIndexPosting(index.tokenPostings, token, bookmarkIndex)
    }
  }
}

function addTitlePrefixCandidate(index: SearchAccelerationIndex, prefix: string, bookmarkIndex: number): void {
  let top = index.titlePrefixTop.get(prefix)
  if (!top) {
    top = []
    index.titlePrefixTop.set(prefix, top)
  }
  const compact = URL_STRUCTURE_PATTERN.test(prefix.normalize('NFKC')) ? '' : getCompactTerm(prefix)
  const scoreFor = (id: number) => {
    const bookmark = index.bookmarks[id]
    const derived = derivedCache.get(bookmark)!
    return relevanceFieldScore(bookmark.normalizedTitle, prefix, 5000, 2600, 1600) + 320 +
      getDomainCorroborationScore(derived, prefix, compact)
  }
  const score = scoreFor(bookmarkIndex)
  if (top.length >= MAX_POPUP_SEARCH_RESULTS && score <= scoreFor(top[top.length - 1])) return
  // Input IDs already follow the tie order; insert only strictly better scores.
  // Unlike posting lists, this bounded cache follows relevance, not recency.
  let position = top.length
  while (position > 0 && score > scoreFor(top[position - 1])) position--
  top.splice(position, 0, bookmarkIndex)
  if (top.length > MAX_POPUP_SEARCH_RESULTS) top.pop()
}

function getSearchAccelerationIndex(
  bookmarks: PopupSearchBookmark[]
): SearchAccelerationIndex | null {
  const cached = accelerationIndexes.get(bookmarks)
  if (cached && cached.identity === bookmarks && cached.length === bookmarks.length) {
    return cached
  }
  if (cached) invalidateSearchAccelerationForBookmarks(bookmarks)
  scheduleSearchAccelerationWarmup(bookmarks)
  return null
}

function collectSearchNgrams(
  value: string,
  addGram: (gram: string) => void,
  addShort: (short: string) => void
): void {
  const text = String(value || '')
  for (let start = 0; start < text.length; start += 1) {
    if (start + 3 <= text.length) addGram(text.slice(start, start + 3))
    if (start + 2 <= text.length) addShort(text.slice(start, start + 2))
    addShort(text[start])
  }
}

function addIndexPosting(
  postings: Map<string, number[]>,
  key: string,
  bookmarkIndex: number
): void {
  let list = postings.get(key)
  if (!list) {
    list = []
    postings.set(key, list)
  }
  if (list[list.length - 1] !== bookmarkIndex) {
    list.push(bookmarkIndex)
  }
}

function getIndexedSearchCandidates(
  bookmarks: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  limit: number
): RankedSearchBookmark[] | null {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD) return null
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  const index = getSearchAccelerationIndex(bookmarks)
  if (!index) return null
  if (terms.length === 1 && !parsedQuery.phraseTerms.length && !parsedQuery.hasStructuredFilters &&
    !parsedQuery.recencyHint && limit <= MAX_POPUP_SEARCH_RESULTS) {
    const term = terms[0]
    const prefixIds = index.titlePrefixTop.get(term)
    if (prefixIds?.length) {
      const prefix = mergePostingLists([
        prefixIds,
        index.exactTitles.get(term) || [],
        index.exactTitles.get(parsedQuery.compactQuery) || []
      ])
      const prefixResults = rankIndexedCandidates(index.bookmarks, prefix, parsedQuery, terms, limit)
      // Prefixes retain their best title/host evidence, not just the newest IDs.
      // Exact raw/compact/pinyin titles are checked separately. The other tiers,
      // including bounded corroboration, cannot reach the raw-prefix floor.
      if (prefixResults.length >= limit && prefixResults[limit - 1].score >= 2920) return prefixResults
    }
  }
  if (terms.length) {
    const titleLists = terms.map(term => getTitleTermPostings(index, term))
    const titleResults = rankIndexedCandidates(index.bookmarks, intersectPostingLists(titleLists), parsedQuery, terms, limit)
    const partialTitleBoost = MAX_TITLE_DOMAIN_BOOST * (terms.length - 1) / terms.length
    const otherFieldBound = 1820 + partialTitleBoost + (terms.length > 1 ? 48 : 0) + (parsedQuery.recencyHint ? 120 : 0)
    if (titleResults.length >= limit && titleResults[limit - 1].score > otherFieldBound) return titleResults
  }
  const postings = terms.map(term => getTermPostings(index, term))
  const candidates = terms.length
    ? intersectPostingLists(postings)
    : bookmarks.map((_bookmark, id) => id)
  const direct = rankIndexedCandidates(index.bookmarks, candidates, parsedQuery, terms, limit)
  if (!shouldRecoverSearch(parsedQuery, direct)) return direct
  // Recover misspellings through a vocabulary index, including errors in the
  // first letters. Never weaken quoted phrases or any structured filters.
  parsedQuery.approximateDistances = terms.map(term =>
    parsedQuery.phraseTerms.includes(term) ? new Map<string, number>() : getApproximateIndexedTerms(index, term)
  )
  parsedQuery.approximateTerms = parsedQuery.approximateDistances.map(matches => [...matches.keys()])
  const expanded = terms.map((term, termIndex) => parsedQuery.phraseTerms.includes(term)
    ? { postings: postings[termIndex], minimumCost: Infinity }
    : getRecoveredTermPostings(index, term))
  if (!direct.length) {
    const minimumCost = Math.min(...expanded.map(term => term.minimumCost))
    parsedQuery.recoveryScoreCeiling = 1320 - minimumCost * 40 + (parsedQuery.recencyHint ? 120 : 0)
  }
  return rankIndexedCandidates(index.bookmarks, intersectPostingLists(expanded.map(term => term.postings)), parsedQuery, terms, limit)
}

function getRecoveredTermPostings(index: SearchAccelerationIndex, term: string): RecoveredSearchTerm {
  const cached = index.recoveredTermCache.get(term)
  if (cached) return cached

  const lists = [getTermPostings(index, term)]
  let minimumCost = Infinity
  for (const [token, cost] of getApproximateIndexedTerms(index, term)) {
    lists.push(index.tokenPostings.get(token) || [])
    minimumCost = Math.min(minimumCost, cost)
  }
  if (canRecoverTitleTerm(term)) {
    const titleCandidates = intersectPostingLists([...new Set(term)].map(char => index.titlePostings.get(char) || []))
    if (/^[a-z]+$/.test(term)) {
      // Abbreviations use at least two words. Keep this cheap bound instead of
      // validating every possible abbreviation on a first, uncached query.
      lists.push(titleCandidates)
      if (titleCandidates.length) minimumCost = Math.min(minimumCost, 2)
    } else {
      const recoveredTitles: number[] = []
      for (const id of titleCandidates) {
        const bookmark = index.bookmarks[id]
        const derived = derivedCache.get(bookmark) || getBookmarkDerived(bookmark)
        // Literal titles already have postings and pay no recovery cost.
        if (derived.compactFields[0].value.includes(term)) continue
        const cost = chineseTitleFragmentCost(derived.compactFields[0].value, term)
        if (cost === null) continue
        recoveredTitles.push(id)
        minimumCost = Math.min(minimumCost, cost)
      }
      lists.push(recoveredTitles)
    }
  }
  const recovered = { postings: mergePostingLists(lists), minimumCost }
  // Cache term expansion, not final query results: filters, combinations and
  // ranking still run for each request. Bound both entry count and retained IDs.
  if (recovered.postings.length <= RECOVERED_POSTING_CACHE_BUDGET) {
    index.recoveredTermCache.set(term, recovered)
    index.recoveredPostingCount += recovered.postings.length
    while (index.recoveredTermCache.size > INDEXED_TERM_CACHE_LIMIT ||
      index.recoveredPostingCount > RECOVERED_POSTING_CACHE_BUDGET) {
      const oldest = index.recoveredTermCache.keys().next().value!
      index.recoveredPostingCount -= index.recoveredTermCache.get(oldest)!.postings.length
      index.recoveredTermCache.delete(oldest)
    }
  }
  return recovered
}

function getTitleTermPostings(index: SearchAccelerationIndex, term: string): number[] {
  const cached = index.titleTermCache.get(term)
  if (cached) return cached
  const compact = getCompactTerm(term)
  const raw = getGramPostings(index.titlePostings, index.titlePostings, term)
  const postings = compact && compact !== term
    ? mergePostingLists([raw, getGramPostings(index.titlePostings, index.titlePostings, compact)])
    : raw
  index.titleTermCache.set(term, postings)
  prunePostingCache(index.titleTermCache)
  return postings
}


function intersectPostingLists(postingLists: number[][]): number[] {
  if (!postingLists.length) return []
  if (postingLists.length === 1) return postingLists[0]
  const sorted = postingLists.slice().sort((left, right) => left.length - right.length)
  const firstPostings = sorted[0]
  const remainingPostings = sorted.slice(1)
  const intersections: number[] = []
  const cursors = new Array(remainingPostings.length).fill(0)

  for (const bookmarkIndex of firstPostings) {
    let matches = true
    for (let listIndex = 0; listIndex < remainingPostings.length; listIndex += 1) {
      const postings = remainingPostings[listIndex]
      let cursor = cursors[listIndex]
      while (cursor < postings.length && postings[cursor] < bookmarkIndex) {
        cursor += 1
      }
      cursors[listIndex] = cursor
      if (postings[cursor] !== bookmarkIndex) {
        matches = false
        break
      }
    }
    if (matches) {
      intersections.push(bookmarkIndex)
    }
  }

  return intersections
}

function getTermPostings(index: SearchAccelerationIndex, term: string): number[] {
  const cached = index.termPostingCache.get(term)
  if (cached) return cached
  const compact = getCompactTerm(term)
  const raw = getTextPostings(index, term)
  const postings = compact && compact !== term
    ? mergePostingLists([raw, getTextPostings(index, compact)])
    : raw
  index.termPostingCache.set(term, postings)
  prunePostingCache(index.termPostingCache)
  return postings
}

function getTextPostings(index: SearchAccelerationIndex, text: string): number[] {
  return getGramPostings(index.gramPostings, index.shortPostings, text)
}

function getGramPostings(grams: Map<string, number[]>, shorts: Map<string, number[]>, text: string): number[] {
  if (text.length < 3) return shorts.get(text) || []
  const lists: number[][] = []
  const seen = new Set<string>()
  for (let offset = 0; offset + 3 <= text.length; offset++) {
    const gram = text.slice(offset, offset + 3)
    if (seen.has(gram)) continue
    seen.add(gram)
    const list = grams.get(gram)
    if (!list) return []
    lists.push(list)
  }
  return intersectPostingLists(lists)
}

function mergePostingLists(lists: number[][]): number[] {
  const nonempty = lists.filter(list => list.length)
  if (nonempty.length <= 1) return nonempty[0] || []
  const merged = new Set<number>()
  for (const list of nonempty) for (const id of list) merged.add(id)
  return [...merged].sort((left, right) => left - right)
}

function getApproximateIndexedTerms(index: SearchAccelerationIndex, term: string): Map<string, number> {
  if (!isApproximateLatinTerm(term) || term.length > 48) return new Map()
  const cached = index.fuzzyTermCache.get(term)
  if (cached) return cached
  const limit = getApproximateDistanceLimit(term)
  const candidates = new Set<string>()
  if (term.length - 1 <= limit * 3) {
    for (let length = term.length - limit; length <= term.length + limit; length++) {
      for (const token of index.tokensByLength.get(length) || []) candidates.add(token)
    }
  }
  for (let offset = 0; offset + 2 <= term.length; offset++) {
    for (const token of index.tokenGrams.get(term.slice(offset, offset + 2)) || []) candidates.add(token)
  }
  const matches = new Map<string, number>()
  for (const token of candidates) {
    const cost = getApproximateTokenCost(term, token)
    if (cost !== null) matches.set(token, cost)
  }
  index.fuzzyTermCache.set(term, matches)
  prunePostingCache(index.fuzzyTermCache)
  return matches
}

function prunePostingCache<T>(cache: Map<string, T>): void {
  while (cache.size > INDEXED_TERM_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) {
      break
    }
    cache.delete(oldestKey)
  }
}

function matchesSearchCandidateFilters(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): boolean {
  if (!parsedQuery.hasStructuredFilters) {
    return true
  }

  if (parsedQuery.siteFilters.length) {
    const key = bookmark.domain || bookmark.normalizedUrl
    let matches = parsedQuery.siteMatchCache.get(key)
    if (matches === undefined) {
      matches = parsedQuery.siteFilters.some(filter => matchesSearchSiteFilter(filter, bookmark.domain || '', bookmark.normalizedUrl))
      parsedQuery.siteMatchCache.set(key, matches)
    }
    if (!matches) return false
  }
  if (parsedQuery.urlFilters.length && !parsedQuery.urlFilters.some(filter => bookmark.normalizedUrl.includes(filter))) return false
  if (parsedQuery.folderFilters.length && !parsedQuery.folderFilters.some(filter => bookmark.normalizedPath.includes(filter))) return false
  if (parsedQuery.typeFilters.length && !parsedQuery.typeFilters.some(filter => bookmark.tagContentType.includes(filter))) return false
  if (parsedQuery.excludedTerms.some(term => getBookmarkLiteralSearchText(bookmark).includes(term))) return false
  if (parsedQuery.dateRange) {
    const date = Number(bookmark.dateAdded)
    if (!Number.isFinite(date) || date < parsedQuery.dateRange.from || date > parsedQuery.dateRange.to) return false
  }
  return true
}

function getBookmarkSearchText(bookmark: PopupSearchBookmark): string {
  return bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
}

function getBookmarkLiteralSearchText(bookmark: PopupSearchBookmark): string {
  return bookmark.pinyinBaseSearchText ?? getBookmarkSearchText(bookmark)
}

function matchesSearchCandidateText(bookmark: PopupSearchBookmark, term: string): boolean {
  if (!term) {
    return true
  }

  const searchText = getBookmarkSearchText(bookmark)
  if (searchText.includes(term)) {
    return true
  }

  const compactTerm = getCompactTerm(term)
  if (!compactTerm) {
    return false
  }

  const derived = getBookmarkDerived(bookmark)
  return derived.compactSearchText.includes(compactTerm)
}

function getBoundaryMatchBonus(text: string, index: number, length: number, maxBonus: number): number {
  if (!text || !Number.isFinite(index) || !Number.isFinite(length) || maxBonus <= 0) {
    return 0
  }

  const start = Math.max(0, index)
  const end = Math.max(start, index + length)
  const leftBoundary = start <= 0 || isSearchBoundaryChar(text[start - 1] || '')
  const rightBoundary = end >= text.length || isSearchBoundaryChar(text[end] || '')

  if (leftBoundary && rightBoundary) {
    return maxBonus
  }
  if (leftBoundary || rightBoundary) {
    return Math.round(maxBonus * 0.6)
  }
  return 0
}

function isSearchBoundaryChar(value: string): boolean {
  return !/[a-z0-9]/i.test(value)
}

function scoreOrderedTermProximity(text: string, terms: string[]): number {
  const orderedTerms = terms
  if (!text || orderedTerms.length < 2) {
    return 0
  }

  let searchStart = 0
  let firstIndex = -1
  let lastEnd = -1

  for (const term of orderedTerms) {
    const index = text.indexOf(term, searchStart)
    if (index === -1) {
      return 0
    }

    if (firstIndex === -1) {
      firstIndex = index
    }
    lastEnd = index + term.length
    searchStart = index + term.length
  }

  const span = Math.max(1, lastEnd - firstIndex)
  return Math.max(0, 48 - Math.min(span, 48))
}

function compareSearchResults(left: PopupSearchResult, right: PopupSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  return compareBookmarkOrder(left, right)
}

function compareBookmarkOrder(left: PopupSearchBookmark, right: PopupSearchBookmark): number {
  const dateDelta = Number(right.dateAdded || 0) - Number(left.dateAdded || 0)
  if (dateDelta !== 0) {
    return dateDelta
  }

  if (left.title.length !== right.title.length) {
    return left.title.length - right.title.length
  }

  const pathOrder = searchPathCollator.compare(left.path, right.path)
  if (pathOrder) return pathOrder
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

function assertSearchActive(options: CooperativeSearchOptions): void {
  if (!options.isActive()) {
    throw new Error('search-cancelled')
  }
}

function yieldSearchWork(options: CooperativeSearchOptions): Promise<unknown> {
  if (options.yieldWork) {
    return options.yieldWork()
  }

  return Promise.resolve()
}
