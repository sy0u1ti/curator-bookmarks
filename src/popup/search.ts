import { pinyin } from 'pinyin-pro'
import type { BookmarkRecord } from '../shared/types.js'
import { normalizeText, stripCommonUrlPrefix } from '../shared/text.js'
import { getEffectiveBookmarkTags, type BookmarkTagRecord } from '../shared/bookmark-tags.js'

export const MAX_POPUP_SEARCH_RESULTS = 20
export const POPUP_SEARCH_ASYNC_THRESHOLD = 1200
const SEARCH_PREFILTER_THRESHOLD = 1200
const SEARCH_CHUNK_SIZE = 260

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
}

export interface PopupSearchResult extends PopupSearchBookmark {
  score: number
  matchReasons: string[]
}

export interface CooperativeSearchOptions {
  isActive: () => boolean
  yieldWork?: () => Promise<unknown>
}

export function indexBookmarkForSearch(bookmark: BookmarkRecord, tagRecord: BookmarkTagRecord | null = null): PopupSearchBookmark {
  const normalizedPath = normalizeText(bookmark.path || '')
  const normalizedDomain = normalizeText(bookmark.domain || '')
  const tagSummary = normalizeText(tagRecord?.summary || '')
  const tagContentType = normalizeText(tagRecord?.contentType || '')
  const tagTopics = normalizeSearchList(tagRecord?.topics)
  const tagTags = normalizeSearchList(getEffectiveBookmarkTags(tagRecord))
  const tagAliases = normalizeSearchList(tagRecord?.aliases)
  const pinyinTokens = buildPinyinSearchTokens([
    bookmark.title,
    bookmark.path,
    ...(tagRecord?.topics || []),
    ...getEffectiveBookmarkTags(tagRecord),
    ...(tagRecord?.aliases || [])
  ])

  return {
    ...bookmark,
    normalizedPath,
    tagSummary,
    tagContentType,
    tagTopics,
    tagTags,
    tagAliases,
    tagPinyinFull: pinyinTokens.full,
    tagPinyinInitials: pinyinTokens.initials,
    searchText: [
      bookmark.normalizedTitle,
      bookmark.normalizedUrl,
      normalizedPath,
      normalizedDomain,
      tagContentType,
      ...tagTopics,
      ...tagTags,
      ...tagAliases,
      ...pinyinTokens.full,
      ...pinyinTokens.initials,
      tagSummary
    ]
      .filter(Boolean)
      .join(' ')
  }
}

export function searchBookmarks(
  query: string,
  bookmarks: PopupSearchBookmark[]
): PopupSearchResult[] {
  const normalizedQuery = normalizeQuery(query)
  const queryTerms = getQueryTerms(normalizedQuery)
  const candidates = getSearchCandidates(bookmarks, normalizedQuery, queryTerms)
  const results: PopupSearchResult[] = []

  for (const bookmark of candidates) {
    const match = scoreBookmarkWithReasons(bookmark, normalizedQuery, queryTerms)
    if (match.score > 0) {
      appendTopSearchResult(results, {
        ...bookmark,
        score: match.score,
        matchReasons: match.reasons
      })
    }
  }

  return results
}

export async function searchBookmarksCooperatively(
  query: string,
  bookmarks: PopupSearchBookmark[],
  options: CooperativeSearchOptions
): Promise<PopupSearchResult[]> {
  const normalizedQuery = normalizeQuery(query)
  const queryTerms = getQueryTerms(normalizedQuery)
  const candidates = await getSearchCandidatesCooperatively(
    bookmarks,
    normalizedQuery,
    queryTerms,
    options
  )
  const results: PopupSearchResult[] = []

  for (let index = 0; index < candidates.length; index += SEARCH_CHUNK_SIZE) {
    assertSearchActive(options)
    const chunk = candidates.slice(index, index + SEARCH_CHUNK_SIZE)

    for (const bookmark of chunk) {
      const match = scoreBookmarkWithReasons(bookmark, normalizedQuery, queryTerms)
      if (match.score > 0) {
        appendTopSearchResult(results, {
          ...bookmark,
          score: match.score,
          matchReasons: match.reasons
        })
      }
    }

    if (index + SEARCH_CHUNK_SIZE < candidates.length) {
      await yieldSearchWork(options)
    }
  }

  return results
}

export function getQueryTerms(query: string): string[] {
  return [...new Set(String(query || '').split(/\s+/).filter(Boolean))]
}

export function normalizeQuery(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value))
}

export function scoreBookmark(
  bookmark: PopupSearchBookmark,
  normalizedQuery: string,
  queryTerms: string[]
): number {
  return scoreBookmarkWithReasons(bookmark, normalizedQuery, queryTerms).score
}

function scoreBookmarkWithReasons(
  bookmark: PopupSearchBookmark,
  normalizedQuery: string,
  queryTerms: string[]
): { score: number; reasons: string[] } {
  const title = bookmark.normalizedTitle
  const url = bookmark.normalizedUrl
  const domain = normalizeText(bookmark.domain || '')
  let score = 0
  let matched = false
  const reasons: string[] = []

  if (!normalizedQuery) {
    return { score: 0, reasons: [] }
  }

  if (title === normalizedQuery) {
    score += 620
    matched = true
    addReason(reasons, `命中：标题 ${bookmark.title}`)
  }

  if (title.startsWith(normalizedQuery)) {
    score += 420
    matched = true
    addReason(reasons, `命中：标题前缀 ${normalizedQuery}`)
  }

  const titleIndex = title.indexOf(normalizedQuery)
  if (titleIndex !== -1) {
    score += 300 - Math.min(titleIndex, 120)
    matched = true
    addReason(reasons, `命中：标题 ${normalizedQuery}`)
  }

  if (url.startsWith(normalizedQuery) || domain.startsWith(normalizedQuery)) {
    score += 250
    matched = true
    addReason(reasons, `命中：网址 ${normalizedQuery}`)
  }

  const urlIndex = Math.max(url.indexOf(normalizedQuery), domain.indexOf(normalizedQuery))
  if (urlIndex !== -1) {
    score += 190 - Math.min(urlIndex, 100)
    matched = true
    addReason(reasons, `命中：网址 ${normalizedQuery}`)
  }

  const semanticMatch = scoreSemanticFields(bookmark, normalizedQuery, queryTerms, reasons)
  if (semanticMatch.score > 0) {
    score += semanticMatch.score
    matched = true
  }

  let allTermsPresent = queryTerms.length > 0

  for (const term of queryTerms) {
    let termMatched = false
    const termTitleIndex = title.indexOf(term)
    const termUrlIndex = url.indexOf(term)

    if (termTitleIndex !== -1) {
      score += 72 - Math.min(termTitleIndex, 40)
      termMatched = true
      matched = true
      addReason(reasons, `命中：标题 ${term}`)
    }

    if (termUrlIndex !== -1) {
      score += 45 - Math.min(termUrlIndex, 40)
      termMatched = true
      matched = true
      addReason(reasons, `命中：网址 ${term}`)
    }

    if (
      !termMatched &&
      termMatchedSemanticField(bookmark, term)
    ) {
      termMatched = true
    }

    if (!termMatched) {
      allTermsPresent = false
    }
  }

  if (allTermsPresent && queryTerms.length > 1) {
    score += 120
  }

  const titleFuzzy = subsequenceScore(title, normalizedQuery)
  const urlFuzzy = subsequenceScore(url, normalizedQuery)
  const fuzzyScore = Math.max(titleFuzzy * 2, urlFuzzy)

  if (fuzzyScore > 0) {
    score += fuzzyScore
    matched = true
    addReason(reasons, `命中：模糊匹配 ${normalizedQuery}`)
  }

  if (title.includes(normalizedQuery) && url.includes(normalizedQuery)) {
    score += 38
  }

  score -= Math.floor(bookmark.title.length / 28)

  return {
    score: matched ? Math.max(score, 0) : 0,
    reasons: reasons.slice(0, 3)
  }
}

function scoreSemanticFields(
  bookmark: PopupSearchBookmark,
  normalizedQuery: string,
  queryTerms: string[],
  reasons: string[]
): { score: number } {
  let score = 0
  const summaryEnabled = shouldUseSummaryForQuery(normalizedQuery)
  const terms = queryTerms.length ? queryTerms : [normalizedQuery]

  score += scoreListField(bookmark.tagAliases, normalizedQuery, terms, 65, (label) => {
    addReason(reasons, `命中：别名 ${label}`)
  })
  score += scoreListField(bookmark.tagTags, normalizedQuery, terms, 60, (labels) => {
    addReason(reasons, `标签：${labels}`)
  })
  score += scoreListField(bookmark.tagTopics, normalizedQuery, terms, 50, (labels) => {
    addReason(reasons, `主题：${labels}`)
  })
  score += scoreTextField(bookmark.normalizedPath, normalizedQuery, terms, 40, () => {
    addReason(reasons, `命中：文件夹 ${bookmark.path || ''}`.trim())
  })
  score += scoreTextField(bookmark.tagContentType, normalizedQuery, terms, 10, () => {
    addReason(reasons, `命中：类型 ${bookmark.tagContentType}`)
  })
  score += scoreListField(bookmark.tagPinyinInitials, normalizedQuery, terms, 58, () => {
    addReason(reasons, `命中：首字母 ${normalizedQuery}`)
  })
  score += scoreListField(bookmark.tagPinyinFull, normalizedQuery, terms, 52, () => {
    addReason(reasons, `命中：拼音 ${normalizedQuery}`)
  })

  if (summaryEnabled) {
    score += scoreTextField(bookmark.tagSummary, normalizedQuery, terms, 22, () => {
      addReason(reasons, `命中：摘要 ${normalizedQuery}`)
    })
  }

  return { score }
}

function scoreListField(
  values: string[],
  normalizedQuery: string,
  queryTerms: string[],
  weight: number,
  onMatch: (label: string) => void
): number {
  if (!values.length) {
    return 0
  }

  let score = 0
  const matchedLabels: string[] = []
  for (const value of values) {
    if (value === normalizedQuery) {
      score += weight + 22
      matchedLabels.push(value)
    } else if (value.startsWith(normalizedQuery)) {
      score += weight + 10
      matchedLabels.push(value)
    } else if (value.includes(normalizedQuery)) {
      score += weight
      matchedLabels.push(value)
    } else {
      const matchedTerms = queryTerms.filter((term) => value.includes(term))
      if (matchedTerms.length) {
        score += Math.round(weight * (matchedTerms.length / queryTerms.length))
        matchedLabels.push(value)
      }
    }
  }

  if (matchedLabels.length) {
    onMatch(matchedLabels.slice(0, 3).join(' / '))
  }

  return score
}

function scoreTextField(
  value: string,
  normalizedQuery: string,
  queryTerms: string[],
  weight: number,
  onMatch: () => void
): number {
  if (!value) {
    return 0
  }

  if (value === normalizedQuery) {
    onMatch()
    return weight + 16
  }

  if (value.startsWith(normalizedQuery)) {
    onMatch()
    return weight + 8
  }

  if (value.includes(normalizedQuery)) {
    onMatch()
    return weight
  }

  const matchedTerms = queryTerms.filter((term) => value.includes(term))
  if (!matchedTerms.length) {
    return 0
  }

  onMatch()
  return Math.round(weight * (matchedTerms.length / queryTerms.length))
}

function termMatchedSemanticField(bookmark: PopupSearchBookmark, term: string): boolean {
  return [
    bookmark.normalizedPath,
    bookmark.tagSummary,
    bookmark.tagContentType,
    ...bookmark.tagTopics,
    ...bookmark.tagTags,
    ...bookmark.tagAliases,
    ...bookmark.tagPinyinFull,
    ...bookmark.tagPinyinInitials
  ].some((value) => value.includes(term))
}

function shouldUseSummaryForQuery(normalizedQuery: string): boolean {
  if (normalizedQuery.length < 2) {
    return false
  }
  return !/^[\u3400-\u9fff]$/u.test(normalizedQuery)
}

function normalizeSearchList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))]
}

function buildPinyinSearchTokens(values: unknown[]): { full: string[]; initials: string[] } {
  const full = new Set<string>()
  const initials = new Set<string>()

  for (const value of values) {
    const text = String(value || '')
    const matches = text.match(/[\u3400-\u9fff]+/gu) || []
    for (const match of matches) {
      const fullToken = buildPinyinToken(match, {})
      const initialsToken = buildPinyinToken(match, { pattern: 'first' })
      if (fullToken) {
        full.add(fullToken)
      }
      if (initialsToken) {
        initials.add(initialsToken)
      }
    }
  }

  return {
    full: [...full],
    initials: [...initials]
  }
}

function buildPinyinToken(text: string, options: Record<string, unknown>): string {
  return normalizeText(
    pinyin(text, {
      toneType: 'none',
      type: 'array',
      ...options
    }).join('')
  )
}

function addReason(reasons: string[], reason: string): void {
  const text = String(reason || '').replace(/\s+/g, ' ').trim()
  if (text && !reasons.includes(text)) {
    reasons.push(text)
  }
}

function getSearchCandidates(
  bookmarks: PopupSearchBookmark[],
  normalizedQuery: string,
  queryTerms: string[]
): PopupSearchBookmark[] {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD) {
    return bookmarks
  }

  const requiredTerms = queryTerms.length ? queryTerms : [normalizedQuery]
  const directMatches = bookmarks.filter((bookmark) => {
    const searchText = bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
    return requiredTerms.every((term) => searchText.includes(term))
  })

  if (directMatches.length) {
    return directMatches
  }

  const prefix = normalizedQuery.slice(0, Math.min(normalizedQuery.length, 3))
  if (!prefix) {
    return bookmarks
  }

  const prefixMatches = bookmarks.filter((bookmark) => {
    const searchText = bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
    return searchText.includes(prefix)
  })

  return prefixMatches.length ? prefixMatches : bookmarks
}

async function getSearchCandidatesCooperatively(
  bookmarks: PopupSearchBookmark[],
  normalizedQuery: string,
  queryTerms: string[],
  options: CooperativeSearchOptions
): Promise<PopupSearchBookmark[]> {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD) {
    return bookmarks
  }

  const requiredTerms = queryTerms.length ? queryTerms : [normalizedQuery]
  const directMatches: PopupSearchBookmark[] = []

  for (let index = 0; index < bookmarks.length; index += SEARCH_CHUNK_SIZE) {
    assertSearchActive(options)
    for (const bookmark of bookmarks.slice(index, index + SEARCH_CHUNK_SIZE)) {
      const searchText = bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
      if (requiredTerms.every((term) => searchText.includes(term))) {
        directMatches.push(bookmark)
      }
    }

    if (index + SEARCH_CHUNK_SIZE < bookmarks.length) {
      await yieldSearchWork(options)
    }
  }

  if (directMatches.length) {
    return directMatches
  }

  const prefix = normalizedQuery.slice(0, Math.min(normalizedQuery.length, 3))
  if (!prefix) {
    return bookmarks
  }

  const prefixMatches: PopupSearchBookmark[] = []
  for (let index = 0; index < bookmarks.length; index += SEARCH_CHUNK_SIZE) {
    assertSearchActive(options)
    for (const bookmark of bookmarks.slice(index, index + SEARCH_CHUNK_SIZE)) {
      const searchText = bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
      if (searchText.includes(prefix)) {
        prefixMatches.push(bookmark)
      }
    }

    if (index + SEARCH_CHUNK_SIZE < bookmarks.length) {
      await yieldSearchWork(options)
    }
  }

  return prefixMatches.length ? prefixMatches : bookmarks
}

function appendTopSearchResult(results: PopupSearchResult[], result: PopupSearchResult): void {
  results.push(result)
  results.sort(compareSearchResults)
  if (results.length > MAX_POPUP_SEARCH_RESULTS) {
    results.length = MAX_POPUP_SEARCH_RESULTS
  }
}

function compareSearchResults(left: PopupSearchResult, right: PopupSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  if (left.title.length !== right.title.length) {
    return left.title.length - right.title.length
  }

  return left.path.localeCompare(right.path, 'zh-Hans-CN')
}

function subsequenceScore(text: string, query: string): number {
  if (!text || !query || query.length < 2) {
    return 0
  }

  let textIndex = 0
  let queryIndex = 0
  let streak = 0
  let bestStreak = 0
  let gapPenalty = 0

  while (textIndex < text.length && queryIndex < query.length) {
    if (text[textIndex] === query[queryIndex]) {
      queryIndex += 1
      streak += 1
      bestStreak = Math.max(bestStreak, streak)
    } else if (queryIndex > 0) {
      streak = 0
      gapPenalty += 1
    }

    textIndex += 1
  }

  if (queryIndex !== query.length) {
    return 0
  }

  return 40 + query.length * 10 + bestStreak * 10 - gapPenalty
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
