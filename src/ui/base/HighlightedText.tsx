// Highlights decorate text without changing its font metrics or spacing.
const HIGHLIGHT_MARK_CLASS = 'inline box-decoration-clone rounded-[0.12em] bg-ds-text-primary/[0.12] p-0 align-baseline text-ds-text-primary shadow-none [font:inherit]'

/** Renders `text` with every occurrence of the search terms wrapped in a mark.
 * The popup and the options folder picker share this so their highlight rules
 * cannot drift apart. */
export function HighlightedText({ terms, text }: { terms: string[]; text: string }) {
  return (
    <>
      {splitHighlightText(text, terms).map((part, index) => {
        const key = `${index}:${part.text}`
        return part.highlight
          ? <mark className={HIGHLIGHT_MARK_CLASS} key={key}>{part.text}</mark>
          : <span key={key}>{part.text}</span>
      })}
    </>
  )
}

/** Whitespace-separated, de-duplicated highlight terms. Callers normalize the
 * query first (popup search and options use different normalizers). */
export function getHighlightTerms(query: string): string[] {
  return [...new Set(String(query || '').split(/\s+/).filter(Boolean))]
}

/** Splits `text` into plain and highlighted parts for the given terms. Terms
 * are matched case-insensitively; overlapping ranges merge into one mark. */
export function splitHighlightText(text: string, terms: string[]): Array<{ highlight: boolean; text: string }> {
  const safeText = String(text || '')
  const normalizedTerms = terms.flatMap((term) => {
    const normalized = String(term || '').trim().toLowerCase()
    return normalized ? [normalized] : []
  })

  if (!normalizedTerms.length || !safeText) {
    return [{ highlight: false, text: safeText }]
  }

  const lowerText = safeText.toLowerCase()
  const ranges: Array<[number, number]> = []

  for (const term of normalizedTerms.sort((left, right) => right.length - left.length)) {
    let fromIndex = 0
    while (fromIndex < lowerText.length) {
      const matchIndex = lowerText.indexOf(term, fromIndex)
      if (matchIndex === -1) {
        break
      }
      ranges.push([matchIndex, matchIndex + term.length])
      fromIndex = matchIndex + term.length
    }
  }

  if (!ranges.length) {
    return [{ highlight: false, text: safeText }]
  }

  ranges.sort((left, right) => left[0] - right[0])
  const mergedRanges: Array<[number, number]> = []

  for (const currentRange of ranges) {
    const previousRange = mergedRanges.at(-1)
    if (!previousRange || currentRange[0] > previousRange[1]) {
      mergedRanges.push([...currentRange])
      continue
    }

    previousRange[1] = Math.max(previousRange[1], currentRange[1])
  }

  const parts: Array<{ highlight: boolean; text: string }> = []
  let cursor = 0

  for (const [start, end] of mergedRanges) {
    if (start > cursor) {
      parts.push({ highlight: false, text: safeText.slice(cursor, start) })
    }
    parts.push({ highlight: true, text: safeText.slice(start, end) })
    cursor = end
  }

  if (cursor < safeText.length) {
    parts.push({ highlight: false, text: safeText.slice(cursor) })
  }

  return parts.length ? parts : [{ highlight: false, text: safeText }]
}
