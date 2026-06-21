import { getQueryTerms, normalizeQuery } from '../search.js'

const markClass = 'rounded-md bg-white/[0.12] px-[0.02em] text-white shadow-none'

export function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlightText(text, query).map((part, index) => {
        const key = `${index}:${part.text}`
        return part.highlight ? <mark className={markClass} key={key}>{part.text}</mark> : <span key={key}>{part.text}</span>
      })}
    </>
  )
}

function splitHighlightText(text: string, query: string): Array<{ highlight: boolean; text: string }> {
  const safeText = String(text || '')
  const terms = getQueryTerms(normalizeQuery(query))

  if (!terms.length || !safeText) {
    return [{ highlight: false, text: safeText }]
  }

  const lowerText = safeText.toLowerCase()
  const ranges: Array<[number, number]> = []

  for (const term of terms.sort((left, right) => right.length - left.length)) {
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
