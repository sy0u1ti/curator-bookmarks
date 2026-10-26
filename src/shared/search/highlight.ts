import { normalizeSearchTextCompact } from '../text.js'
import { findPinyinMatchIndex } from './pinyin-match.js'
import type { PinyinTokens } from './pinyin.js'

export function getPinyinEvidenceText(tokens: PinyinTokens | undefined, query: string, initials: boolean): string[] {
  const term = normalizeSearchTextCompact(query)
  const matches = new Set<string>()
  for (const run of tokens?.runs || []) {
    const value = initials ? run.initials : run.full
    const starts = initials ? null : run.syllableStarts
    for (let start = findPinyinMatchIndex(value, term, starts); start >= 0; start = findPinyinMatchIndex(value, term, starts, start + 1)) {
      const first = initials ? start : run.syllableStarts.indexOf(start)
      const end = initials ? start + term.length : run.syllableStarts.findIndex(offset => offset >= start + term.length)
      matches.add(run.text.slice(first, end < 0 ? undefined : end))
    }
  }
  return [...matches]
}

/** Map normalized matches back to original text. Literal phrases retain punctuation. */
export function getSearchHighlightTerms(text: string, terms: readonly string[], literal = false): string[] {
  const matches = new Set<string>()
  const characters = [...text]
  let normalized = ''
  const offsets: number[] = []
  for (let index = 0; index < characters.length; index++) {
    const value = literal ? characters[index].toLowerCase() : normalizeSearchTextCompact(characters[index])
    normalized += value
    offsets.push(...Array(value.length).fill(index))
  }
  for (const term of terms) {
    const needle = literal ? term.toLowerCase() : normalizeSearchTextCompact(term)
    if (!needle) continue
    for (let start = normalized.indexOf(needle); start >= 0; start = normalized.indexOf(needle, start + 1)) {
      matches.add(characters.slice(offsets[start], offsets[start + needle.length - 1] + 1).join(''))
    }
  }
  return [...matches]
}
