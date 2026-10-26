import { parseSearchQuery, type ParsedSearchQuery } from '../search-query.js'
import { normalizeSearchTextCompact } from '../text.js'

export function queryLooksLikePinyin(query: string | ParsedSearchQuery): boolean {
  const parsed = typeof query === 'string' ? parseSearchQuery(query) : query
  const groups = parsed.termGroups || parsed.textTerms.map(term => ({ term, alternatives: [term], literal: parsed.literalTerms.includes(term) }))
  return groups.some(group => !group.literal && group.alternatives.some(term => /^[a-z]{2,}$/.test(normalizeSearchTextCompact(term))))
}

export function requiresPinyinTokens(query: string | ParsedSearchQuery): boolean {
  return queryLooksLikePinyin(query)
}
