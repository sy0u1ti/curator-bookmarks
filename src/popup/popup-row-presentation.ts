import { extractDomain, normalizeSearchTextCompact } from '../shared/text.js'
import { buildPinyinTokensSync, getPinyinHighlightTerms } from '../shared/search/pinyin.js'
import { findChineseTitleFragment, findTitleAbbreviation, getApproximateTokenCost, getTitleWords } from '../shared/search/fuzzy-title.js'
import type { SearchMatchEvidence } from '../shared/search/match-evidence.js'
import { getSearchHighlightTerms } from '../shared/search/highlight.js'

// Rendering, virtualization and drag geometry must use the same row pitch.
export const POPUP_BOOKMARK_ROW_HEIGHT = 60
export const POPUP_SEARCH_DETAIL_ROW_HEIGHT = 68

export interface PopupSearchRowPresentation {
  domain: string
  folder: string
  titleTerms: string[]
  domainTerms: string[]
  folderTerms: string[]
  reasonTokens: string[]
  rowHeight: number
}

export function getPopupBookmarkDomain(url: string, fallback: string): string {
  return extractDomain(url) || fallback
}

export function getPopupFolderLabel(path = ''): string {
  return path.split(/\s+(?:>|\/)\s+/).filter(Boolean).at(-1) || ''
}

function getVisibleHighlightTerms(text: string, terms: readonly string[], pinyin = false, literal = false): string[] {
  if (literal) return getSearchHighlightTerms(text, terms, true).map(term => term.toLowerCase())
  const highlights = new Set<string>()
  const characters = [...text]
  let compact = ''
  const offsets: number[] = []
  for (let index = 0; index < characters.length; index++) {
    const normalized = normalizeSearchTextCompact(characters[index])
    compact += normalized
    offsets.push(...Array(normalized.length).fill(index))
  }
  for (const term of terms) {
    if (text.toLowerCase().includes(term.toLowerCase())) highlights.add(term)
    const needle = normalizeSearchTextCompact(term)
    if (needle) {
      for (let start = compact.indexOf(needle); start >= 0; start = compact.indexOf(needle, start + 1)) {
        highlights.add(characters.slice(offsets[start], offsets[start + needle.length - 1] + 1).join(''))
      }
    }
    if (pinyin) {
      for (const match of getPinyinHighlightTerms(text, term)) highlights.add(match)
    }
  }
  return [...new Set([...highlights].map(term => term.toLowerCase()))]
}

function getRecoveredTitleTerms(title: string, term: string, field: string): string[] {
  const query = normalizeSearchTextCompact(term)
  if (field === '标题近似') {
    const tokens = new Set([
      ...getTitleWords(title),
      ...(title.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []),
      ...buildPinyinTokensSync([title]).full
    ])
    return [...tokens].flatMap(token => getApproximateTokenCost(query, token) === null
      ? [] : getVisibleHighlightTerms(title, [token], true))
  }
  if (field === '标题缩写') {
    return getVisibleHighlightTerms(title, findTitleAbbreviation(getTitleWords(title), query)?.terms || [])
  }
  if (field === '标题片段') {
    return getVisibleHighlightTerms(title, findChineseTitleFragment(normalizeSearchTextCompact(title), query)?.terms || [])
  }
  return []
}

export function buildPopupSearchRowPresentation({
  title, url, displayUrl = '', path = '', parentId = '', scopeFolderId = '', query, literalTerms = [], matchReasons, matchEvidence
}: {
  title: string
  url: string
  displayUrl?: string
  path?: string
  parentId?: string
  scopeFolderId?: string
  query: string
  literalTerms?: readonly string[]
  matchReasons: readonly string[]
  matchEvidence?: readonly SearchMatchEvidence[]
}): PopupSearchRowPresentation {
  const phraseWords = new Set(literalTerms.flatMap(term => term.split(/\s+/)))
  const terms = [...new Set(query.toLowerCase().split(/\s+/).filter(term => term && !phraseWords.has(term)))]
  const domain = getPopupBookmarkDomain(url, displayUrl)
  const leafFolder = getPopupFolderLabel(path)
  const folder = scopeFolderId && parentId === scopeFolderId ? '' : leafFolder
  const visibleTerms = (text: string) => [
    ...getVisibleHighlightTerms(text, terms), ...getVisibleHighlightTerms(text, literalTerms, false, true)
  ]
  const titleTerms = new Set(visibleTerms(title))
  const domainTerms = visibleTerms(domain)
  const leafTerms = new Set(visibleTerms(leafFolder))
  const reasonTokens = new Set<string>()

  const evidence: readonly SearchMatchEvidence[] = matchEvidence ?? matchReasons.flatMap(reason => {
    const match = /^命中：(\S+)\s+(.*)$/.exec(reason)
    return match ? [{ field: match[1], term: match[2] }] : []
  })
  // Only expand the exact field/term that scoring matched. Another query term
  // may be literal Latin in the title even when this one matched folder pinyin.
  for (const { field, term, text: matchedText, literal } of evidence) {
    if (field.startsWith('标题')) {
      if (matchedText) {
        for (const text of matchedText) titleTerms.add(text.toLowerCase())
        continue
      }
      if (!literalTerms.includes(term)) {
        if (field === '标题拼音' || field === '标题首字母') {
          for (const highlight of getPinyinHighlightTerms(title, term)) titleTerms.add(highlight)
        }
        for (const highlight of getRecoveredTitleTerms(title, term, field)) titleTerms.add(highlight)
      }
      continue
    }
    if (field === '站点') {
      for (const text of matchedText || getVisibleHighlightTerms(domain, [term], false, literal || literalTerms.includes(term))) {
        if (!domainTerms.includes(text.toLowerCase())) domainTerms.push(text.toLowerCase())
      }
      continue
    }
    if (field.startsWith('文件夹')) {
      const pinyin = !literalTerms.includes(term) && (field === '文件夹拼音' || field === '文件夹首字母')
      const highlights = matchedText
        ? getVisibleHighlightTerms(leafFolder, matchedText, false, true)
        : getVisibleHighlightTerms(leafFolder, [term], pinyin, literal || literalTerms.includes(term))
      for (const highlight of highlights) leafTerms.add(highlight)
      if (!highlights.length) reasonTokens.add('上级目录命中')
    } else if (field === '网址') {
      const titleExplainsTerm = evidence.some(item => item.term === term && item.field.startsWith('标题') &&
        (item.text?.length || getVisibleHighlightTerms(title, [term], false, literal || literalTerms.includes(term)).length))
      if (!titleExplainsTerm && !getVisibleHighlightTerms(domain, [term], false, literal || literalTerms.includes(term)).length) reasonTokens.add('网址命中')
    } else if (field === '近似' || field === '模糊匹配') {
      if (!titleTerms.size && !domainTerms.length && !leafTerms.size) reasonTokens.add('近似匹配')
    } else {
      const labels: Record<string, string> = {
        主题: '标签命中', 别名: '别名命中', 摘要: '摘要命中', 网页内容: '正文命中', 类型: '类型命中'
      }
      const label = field.startsWith('标签') ? '标签命中' : labels[field]
      if (label) reasonTokens.add(label)
    }
  }
  if (matchReasons.some(reason => /^(标签|主题)：/.test(reason))) reasonTokens.add('标签命中')
  return {
    domain, folder, titleTerms: [...titleTerms], domainTerms,
    folderTerms: folder ? [...leafTerms] : [],
    reasonTokens: [...reasonTokens].filter(Boolean),
    rowHeight: reasonTokens.size ? POPUP_SEARCH_DETAIL_ROW_HEIGHT : POPUP_BOOKMARK_ROW_HEIGHT
  }
}
