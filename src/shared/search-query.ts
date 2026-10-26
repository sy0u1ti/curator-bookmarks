import { normalizeText, stripCommonUrlPrefix } from './text.js'
import { parseSearchDateExpression, type SearchDateRange } from './search/date.js'

export type { SearchDateRange } from './search/date.js'
export type SearchChipKind = 'site' | 'url' | 'folder' | 'type' | 'time' | 'exclude' | 'sort'
export interface SearchTermGroup {
  /** The original concept; alternatives never replace another required group. */
  term: string
  alternatives: string[]
  literal: boolean
}

export interface ParsedSearchQuery {
  rawQuery: string
  textTerms: string[]
  literalTerms: string[]
  siteFilters: string[]
  urlFilters: string[]
  folderFilters: string[]
  typeFilters: string[]
  excludedTerms: string[]
  dateRange: SearchDateRange | null
  sort: 'relevance' | 'recent'
  recencyHint: boolean
  termGroups?: SearchTermGroup[]
  chips: Array<{ kind: SearchChipKind; label: string; value: string }>
}

interface SearchQueryToken { value: string; literal: boolean }
const OPERATORS: Record<string, 'site' | 'url' | 'folder' | 'type' | 'exclude' | 'sort'> = {
  site: 'site', domain: 'site', 站点: 'site', 域名: 'site', url: 'url',
  folder: 'folder', path: 'folder', 文件夹: 'folder', 目录: 'folder', 路径: 'folder',
  type: 'type', kind: 'type', 类型: 'type', 类别: 'type',
  exclude: 'exclude', 排除: 'exclude', sort: 'sort', 排序: 'sort'
}
const EXCLUDE_COMMANDS = new Set(['排除', '不要', '过滤掉', '剔除', '去掉', 'exclude', 'excluding'])
const RECENT_TERMS = new Set(['recent', 'newest', 'latest', '最近', '新近', '最近优先'])
const REQUEST_PREFIX = /^(?:(?:(?:请|麻烦)\s*(?:帮我|帮忙)?|帮我|帮忙)\s*(?:找一下|找找|查一下|查找|搜索|看看|找)\s*|(?:找一下|找找|查一下)\s*|(?:搜索|查找)\s+|please\s+(?:find|search|show)\s+(?:me\s+)?|(?:find|show)\s+me\s+)/i

/** One grammar is shared by local search, semantic plans, chips and pinyin readiness. */
export function parseSearchQuery(query: unknown, now = Date.now()): ParsedSearchQuery {
  const rawQuery = normalizeText(stripCommonUrlPrefix(query))
  let input = rawQuery.replace(REQUEST_PREFIX, '')
  const request = input !== rawQuery || /^找(?=上周|本周|昨天|今天|去年)/.test(input)
  if (request) input = input.replace(/^找/, '')
  const tokens = tokenizeSearchQuery(input)
  const parsed: ParsedSearchQuery = {
    rawQuery, textTerms: [], literalTerms: [], siteFilters: [], urlFilters: [], folderFilters: [],
    typeFilters: [], excludedTerms: [], dateRange: null, sort: 'relevance', recencyHint: false, chips: []
  }
  const dates: SearchDateRange[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token.literal) {
      parsed.textTerms.push(token.value)
      parsed.literalTerms.push(token.value)
      continue
    }
    const operator = /^([^:：]+)[:：](.*)$/.exec(token.value)
    const kind = operator && Object.hasOwn(OPERATORS, operator[1]) ? OPERATORS[operator[1]] : undefined
    if (kind) {
      let value = operator![2]
      if (!value && tokens[index + 1] && !/^\w+[:：]/.test(tokens[index + 1].value)) value = tokens[++index].value
      value = normalizeFilterValue(value)
      if (value && applyOperator(parsed, kind, value)) continue
    }
    if (token.value.startsWith('-') && token.value.length > 1) {
      parsed.excludedTerms.push(normalizeFilterValue(token.value.slice(1)))
      continue
    }
    // Standalone commands are explicit. Never infer negation from no-code,
    // not found, 过滤器 or 排除法, nor from a substring inside a product name.
    if (EXCLUDE_COMMANDS.has(token.value) && tokens[index + 1]) {
      parsed.excludedTerms.push(normalizeFilterValue(tokens[++index].value))
      continue
    }
    if (request && /^(?:不要|过滤掉)(.+)$/.test(token.value)) {
      parsed.excludedTerms.push(normalizeFilterValue(token.value.replace(/^(?:不要|过滤掉)/, '')))
      continue
    }
    let matchedTime = false
    for (let count = Math.min(3, tokens.length - index); count >= 1; count--) {
      const parts = tokens.slice(index, index + count)
      if (parts.some(part => part.literal || /[:：]/.test(part.value))) continue
      let value = parts.map(part => part.value).join(' ')
      // Request scaffolding is only stripped beside a complete time expression.
      if (request) value = value.replace(/(?:收藏|保存|添加)?的?(?:那个|这个)?$/, '')
      const range = parseSearchDateExpression(value, now)
      if (!range) continue
      dates.push(range)
      index += count - 1
      matchedTime = true
      break
    }
    if (matchedTime) continue
    if (RECENT_TERMS.has(token.value)) {
      parsed.recencyHint = true
      continue
    }
    if (request && /^(?:收藏的|保存的|添加的|那个|这个|一些|一个|书签|链接|saved|bookmarks?)$/.test(token.value)) continue
    parsed.textTerms.push(...token.value.normalize('NFKC')
      .replace(/([a-z0-9])([\u3400-\u9fff])/gi, '$1 $2')
      .replace(/([\u3400-\u9fff])([a-z0-9])/gi, '$1 $2')
      .split(/\s+/).filter(Boolean))
  }
  for (const key of ['textTerms', 'literalTerms', 'siteFilters', 'urlFilters', 'folderFilters', 'typeFilters', 'excludedTerms'] as const) {
    parsed[key] = [...new Set(parsed[key].filter(Boolean))]
  }
  if (dates.length) {
    parsed.dateRange = {
      from: Math.max(...dates.map(date => date.from)), to: Math.min(...dates.map(date => date.to)),
      label: [...new Set(dates.map(date => date.label))].join(' ∩ ')
    }
  }
  parsed.chips = buildSearchQueryChips(parsed)
  return parsed
}

function applyOperator(parsed: ParsedSearchQuery, kind: typeof OPERATORS[string], value: string): boolean {
  if (kind === 'sort') {
    if (/^(new|recent|latest|newest|最近|最新)$/.test(value)) parsed.sort = 'recent'
    else if (/^(relevance|相关性)$/.test(value)) parsed.sort = 'relevance'
    else return false
  } else {
    const key = kind === 'exclude' ? 'excludedTerms' : `${kind}Filters` as const
    parsed[key].push(value)
  }
  return true
}

export function buildSearchQueryChips(parsed: ParsedSearchQuery): ParsedSearchQuery['chips'] {
  const chips: ParsedSearchQuery['chips'] = []
  for (const [kind, label, values] of [
    ['site', '站点', parsed.siteFilters], ['url', '网址', parsed.urlFilters],
    ['folder', '文件夹', parsed.folderFilters], ['type', '类型', parsed.typeFilters],
    ['exclude', '排除', parsed.excludedTerms]
  ] as const) {
    for (const value of values) chips.push({ kind, label: `${label}：${value}`, value })
  }
  if (parsed.dateRange) chips.push({ kind: 'time', label: `时间：${parsed.dateRange.label}`, value: parsed.dateRange.label })
  if (parsed.sort === 'recent') chips.push({ kind: 'sort', label: '排序：最近添加', value: 'recent' })
  else if (parsed.recencyHint) chips.push({ kind: 'sort', label: '排序：相关性 · 最近偏好', value: 'recent-preference' })
  return chips
}

export function buildSearchTextQuery(parsed: ParsedSearchQuery): string {
  return parsed.textTerms.join(' ')
}

export function matchesParsedSearchQuery(parsed: ParsedSearchQuery, target: {
  searchText: string; domain?: string; url?: string; path?: string; type?: string; dateAdded?: number
}): boolean {
  const url = normalizeText(stripCommonUrlPrefix(target.url))
  if (parsed.siteFilters.length && !parsed.siteFilters.some(filter => matchesSearchSiteFilter(filter, target.domain || '', url))) return false
  if (parsed.urlFilters.length && !parsed.urlFilters.some(filter => url.includes(filter))) return false
  if (parsed.folderFilters.length && !parsed.folderFilters.some(filter => normalizeText(target.path).includes(filter))) return false
  if (parsed.typeFilters.length && !parsed.typeFilters.some(filter => normalizeText(target.type).includes(filter))) return false
  if (parsed.excludedTerms.some(term => normalizeText(target.searchText).includes(term))) return false
  if (parsed.dateRange) {
    const date = Number(target.dateAdded)
    if (!Number.isFinite(date) || date < parsed.dateRange.from || date >= parsed.dateRange.to) return false
  }
  return true
}

export function matchesSearchSiteFilter(filter: string, domain: string, url = ''): boolean {
  const hostname = normalizeSearchHostname(domain || url)
  const requested = normalizeSearchHostname(filter)
  return Boolean(hostname && requested && (hostname === requested || hostname.endsWith(`.${requested}`)))
}

function normalizeSearchHostname(value: string): string {
  const normalized = normalizeFilterValue(value).replace(/\.$/, '')
  if (/^(?:[a-z0-9_-]+\.)*[a-z0-9_-]+$/.test(normalized)) return normalized
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) ? normalized : `https://${normalized}`)
      .hostname.replace(/^www\./, '').replace(/\.$/, '')
  } catch { return '' }
}

function normalizeFilterValue(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value))
}

function tokenizeSearchQuery(source: string): SearchQueryToken[] {
  const tokens: SearchQueryToken[] = []
  let current = ''
  let quote = ''
  let literal = false
  const push = () => {
    if (current.trim()) tokens.push({ value: current.trim(), literal })
    current = ''; literal = false
  }
  for (const char of source) {
    if (quote) {
      if (char === quote) quote = ''
      else current += char
      continue
    }
    // A quote starts a phrase, an excluded phrase or an operator value. The
    // apostrophe in O'Reilly is ordinary text, not an unterminated phrase.
    if (/["'“‘]/.test(char) && (!current || current === '-' || /^[^:：]+[:：]$/.test(current))) {
      literal = !current
      quote = char === '“' ? '”' : char === '‘' ? '’' : char
      continue
    }
    if (/[\s，。！？；、]/.test(char)) push()
    else current += char
  }
  push()
  return tokens
}
