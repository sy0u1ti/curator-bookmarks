import type { BookmarkRecord } from '../shared/types.js'
import { normalizeText, stripCommonUrlPrefix } from '../shared/text.js'

export const MAX_POPUP_SEARCH_RESULTS = 20
export const POPUP_SEARCH_ASYNC_THRESHOLD = 1200
const SEARCH_PREFILTER_THRESHOLD = 1200
const SEARCH_CHUNK_SIZE = 260

export interface PopupSearchBookmark extends BookmarkRecord {
  normalizedPath: string
  searchText: string
}

export interface PopupSearchResult extends PopupSearchBookmark {
  score: number
}

export interface CooperativeSearchOptions {
  isActive: () => boolean
  yieldWork?: () => Promise<unknown>
}

export function indexBookmarkForSearch(bookmark: BookmarkRecord): PopupSearchBookmark {
  const normalizedPath = normalizeText(bookmark.path || '')
  const normalizedDomain = normalizeText(bookmark.domain || '')
  return {
    ...bookmark,
    normalizedPath,
    searchText: [
      bookmark.normalizedTitle,
      bookmark.normalizedUrl,
      normalizedPath,
      normalizedDomain
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
    const score = scoreBookmark(bookmark, normalizedQuery, queryTerms)
    if (score > 0) {
      appendTopSearchResult(results, { ...bookmark, score })
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
      const score = scoreBookmark(bookmark, normalizedQuery, queryTerms)
      if (score > 0) {
        appendTopSearchResult(results, { ...bookmark, score })
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
  const title = bookmark.normalizedTitle
  const url = bookmark.normalizedUrl
  let score = 0
  let matched = false

  if (!normalizedQuery) {
    return 0
  }

  if (title === normalizedQuery) {
    score += 620
    matched = true
  }

  if (title.startsWith(normalizedQuery)) {
    score += 420
    matched = true
  }

  const titleIndex = title.indexOf(normalizedQuery)
  if (titleIndex !== -1) {
    score += 300 - Math.min(titleIndex, 120)
    matched = true
  }

  if (url.startsWith(normalizedQuery)) {
    score += 250
    matched = true
  }

  const urlIndex = url.indexOf(normalizedQuery)
  if (urlIndex !== -1) {
    score += 190 - Math.min(urlIndex, 100)
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
    }

    if (termUrlIndex !== -1) {
      score += 45 - Math.min(termUrlIndex, 40)
      termMatched = true
      matched = true
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
  }

  if (title.includes(normalizedQuery) && url.includes(normalizedQuery)) {
    score += 38
  }

  score -= Math.floor(bookmark.title.length / 28)

  return matched ? Math.max(score, 0) : 0
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
