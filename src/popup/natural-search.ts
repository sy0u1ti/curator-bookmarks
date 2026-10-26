import {
  buildSearchQueryChips, parseSearchQuery, type ParsedSearchQuery, type SearchDateRange, type SearchTermGroup
} from '../shared/search-query.js'
import { normalizeText } from '../shared/text.js'
import {
  searchBookmarksCooperatively, searchBookmarksTopK, type CooperativeSearchOptions,
  type PopupSearchBookmark, type PopupSearchResult
} from './search.js'

export type NaturalSearchDateRange = SearchDateRange
export interface NaturalSearchPlan {
  rawQuery: string
  /** Complete executable query, including every original hard constraint. */
  query: ParsedSearchQuery
  /** Human-readable rewrite examples for the AI prompt; never independent searches. */
  queries: string[]
  highlightQuery: string
  dateRange: SearchDateRange | null
  excludedTerms: string[]
  explanation: string
  source: 'local' | 'ai'
}

const SYNONYMS = [
  ['教程', '教学', '入门', '指南', 'tutorial', 'guide', 'course'],
  ['表格', '数据表', 'table', 'grid', 'datatable', 'data grid'],
  ['文档', 'docs', 'doc', 'documentation', 'manual'],
  ['视频', 'video', 'youtube', 'bilibili', '哔哩'],
  ['论文', 'paper', 'arxiv', 'research'],
  ['博客', '文章', 'blog', 'article', 'post'],
  ['工具', 'tool', 'tools', 'utility']
]
const CHINESE_CONCEPTS = SYNONYMS.flat().filter(term => /^[\u3400-\u9fff]+$/.test(term)).sort((a, b) => b.length - a.length)

function splitConcepts(term: string): string[] {
  // Split compound concept phrases such as 表格教程, not substrings inside
  // names such as 资料库、搜索引擎、目的地 or 最近邻算法.
  const output: string[] = []
  let rest = term
  while (rest) {
    const concept = CHINESE_CONCEPTS.find(value => rest.startsWith(value))
    if (!concept) return [term]
    output.push(concept)
    rest = rest.slice(concept.length)
  }
  return output
}

export function buildLocalNaturalSearchPlan(input: string | ParsedSearchQuery, now = Date.now()): NaturalSearchPlan {
  const parsed = typeof input === 'string' ? parseSearchQuery(input, now) : input
  const groups: SearchTermGroup[] = parsed.textTerms.flatMap(term => {
    const literal = parsed.literalTerms.includes(term)
    return (literal ? [term] : splitConcepts(term)).map(value => ({
      term: value, literal, alternatives: literal ? [value] : [...new Set([value, ...(SYNONYMS.find(group => group.includes(value)) || [])])]
    }))
  })
  const query = { ...parsed, textTerms: groups.map(group => group.term), termGroups: groups }
  return makePlan(query, 'local')
}

function makePlan(query: ParsedSearchQuery, source: NaturalSearchPlan['source'], explanation = ''): NaturalSearchPlan {
  const groups = query.termGroups || []
  const phrase = (value: string) => /\s|["'“‘]/.test(value) ? `"${value.replace(/"/g, '')}"` : value
  const original = groups.map(group => group.literal ? `"${group.term.replace(/"/g, '')}"` : phrase(group.term)).join(' ')
  const translated = groups.map(group => phrase(group.alternatives.find(value => /^[a-z ]+$/.test(value)) || group.term)).join(' ')
  return {
    rawQuery: query.rawQuery, query, queries: [...new Set([original, translated].filter(Boolean))],
    highlightQuery: original, dateRange: query.dateRange, excludedTerms: query.excludedTerms,
    explanation: explanation || (groups.some(group => group.alternatives.length > 1) ? '按关键词与同义表达匹配' : '按原始关键词与筛选匹配'), source
  }
}

export function normalizeNaturalSearchAiPlan(raw: unknown, fallback: NaturalSearchPlan, _now = Date.now()): NaturalSearchPlan {
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const proposed = Array.isArray(data.term_groups) ? data.term_groups : []
  const groups = (fallback.query.termGroups || []).map(group => {
    if (group.literal) return group
    const match = proposed.find(item => item && typeof item === 'object' && normalizeText(item.term) === group.term)
    const alternatives = match && Array.isArray(match.alternatives)
      ? match.alternatives.filter((value: unknown): value is string => typeof value === 'string' && value.length <= 80)
        .map(normalizeText).filter((value: string) => value && !/[:：\u0000\n]/.test(value) && !value.startsWith('-'))
      : []
    return { ...group, alternatives: [...new Set([...group.alternatives, ...alternatives])].slice(0, 12) }
  })
  // Dates, exclusions and operators came from the user grammar. A model may
  // express an existing concept differently, never remove a required concept,
  // invent a date/negative condition, or reinterpret a quoted literal.
  const query = { ...fallback.query, termGroups: groups }
  query.chips = buildSearchQueryChips(query)
  const plan = makePlan(query, 'ai', typeof data.explanation === 'string' ? data.explanation.slice(0, 120) : '')
  // Preserve compatible rewrite descriptions from older providers; execution
  // always consumes plan.query and cannot escape its global constraints.
  if (Array.isArray(data.queries)) {
    plan.queries = [...new Set([...plan.queries, ...data.queries.filter((value): value is string => typeof value === 'string' && value.length <= 80).map(normalizeText)])].slice(0, 5)
  }
  return plan
}

export function searchNaturalBookmarks(plan: NaturalSearchPlan, bookmarks: PopupSearchBookmark[], limit = 20): PopupSearchResult[] {
  return searchBookmarksTopK(plan.query, bookmarks, limit)
}

export function searchNaturalBookmarksCooperatively(
  plan: NaturalSearchPlan, bookmarks: PopupSearchBookmark[], options: CooperativeSearchOptions, limit = 20
): Promise<PopupSearchResult[]> {
  return searchBookmarksCooperatively(plan.query, bookmarks, options, limit)
}
