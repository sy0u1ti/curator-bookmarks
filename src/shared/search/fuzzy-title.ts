export function getTitleWords(title: string): string[] {
  return title
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .match(/[a-z][a-z0-9]*/g) || []
}

export function canRecoverTitleTerm(term: string): boolean {
  return /^[a-z]{3,24}$/.test(term) || /^[\u3400-\u9fff]{3,16}$/.test(term)
}

// Match word prefixes, not arbitrary scattered letters: vscode can stand for
// Visual Studio Code, while unrelated letters deep inside a word cannot.
export function titleAbbreviationCost(words: string[], query: string): number | null {
  return findTitleAbbreviation(words, query)?.cost ?? null
}

export function findTitleAbbreviation(words: string[], query: string): { cost: number; terms: string[] } | null {
  if (!/^[a-z]{3,24}$/.test(query)) return null
  let states = new Map<number, string[]>()
  for (const word of words) {
    const next = new Map<number, string[]>()
    states.set(0, [])
    for (const [offset, used] of states) {
      let length = 0
      while (length < word.length && offset + length < query.length && word[length] === query[offset + length]) {
        length++
        const end = offset + length
        const terms = [...used, word]
        if (end === query.length && terms.length >= 2) return { cost: terms.length, terms }
        if (end < query.length && (!next.has(end) || next.get(end)!.length > terms.length)) next.set(end, terms)
      }
    }
    states = next
  }
  return null
}

export function chineseTitleFragmentCost(title: string, query: string): number | null {
  return findChineseTitleFragment(title, query)?.cost ?? null
}

export function findChineseTitleFragment(title: string, query: string): { cost: number; terms: string[] } | null {
  if (!/^[\u3400-\u9fff]{3,16}$/.test(query)) return null
  let bestGap = Infinity
  let bestTerms: string[] = []
  for (let start = title.indexOf(query[0]); start !== -1; start = title.indexOf(query[0], start + 1)) {
    let cursor = start + 1
    let matched = 1
    const chunks = [query[0]]
    while (matched < query.length) {
      const next = title.indexOf(query[matched], cursor)
      if (next < 0) break
      if (next === cursor) chunks[chunks.length - 1] += query[matched]
      else chunks.push(query[matched])
      cursor = next + 1
      matched++
    }
    const gap = cursor - start - query.length
    if (matched === query.length && gap <= Math.min(8, query.length) && gap < bestGap) {
      bestGap = gap
      bestTerms = chunks
    }
  }
  if (Number.isFinite(bestGap)) return { cost: 1 + bestGap / 4, terms: bestTerms }

  // Two remembered chunks may be entered in either order. Both must be real,
  // non-overlapping title fragments of at least two characters.
  for (let split = 2; split <= query.length - 2; split++) {
    const left = query.slice(0, split)
    const right = query.slice(split)
    for (let a = title.indexOf(left); a !== -1; a = title.indexOf(left, a + 1)) {
      for (let b = title.indexOf(right); b !== -1; b = title.indexOf(right, b + 1)) {
        if (a + left.length > b && b + right.length > a) continue
        const span = Math.max(a + left.length, b + right.length) - Math.min(a, b)
        if (span - query.length <= Math.min(8, query.length)) return { cost: 2 + (span - query.length) / 4, terms: [left, right] }
      }
    }
  }
  return null
}

export function getApproximateTokenCost(term: string, token: string): number | null {
  if (term === token) return null
  const limit = term.length >= 8 ? 2 : 1
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

    if (rowBest > limit) return limit + 1
    previousPreviousRow = previousRow
    previousRow = currentRow
  }

  return previousRow[right.length] ?? limit + 1
}
