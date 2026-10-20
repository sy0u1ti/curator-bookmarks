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
  if (!/^[a-z]{3,24}$/.test(query)) return null
  let states = new Map<number, number>()
  for (const word of words) {
    const next = new Map<number, number>()
    states.set(0, 0)
    for (const [offset, used] of states) {
      let length = 0
      while (length < word.length && offset + length < query.length && word[length] === query[offset + length]) {
        length++
        const end = offset + length
        const count = used + 1
        if (end === query.length && count >= 2) return count
        if (end < query.length) next.set(end, Math.min(next.get(end) ?? Infinity, count))
      }
    }
    states = next
  }
  return null
}

export function chineseTitleFragmentCost(title: string, query: string): number | null {
  if (!/^[\u3400-\u9fff]{3,16}$/.test(query)) return null
  let bestGap = Infinity
  for (let start = title.indexOf(query[0]); start !== -1; start = title.indexOf(query[0], start + 1)) {
    let cursor = start + 1
    let matched = 1
    while (matched < query.length) {
      const next = title.indexOf(query[matched], cursor)
      if (next < 0) break
      cursor = next + 1
      matched++
    }
    const gap = cursor - start - query.length
    if (matched === query.length && gap <= Math.min(8, query.length)) bestGap = Math.min(bestGap, gap)
  }
  if (Number.isFinite(bestGap)) return 1 + bestGap / 4

  // Two remembered chunks may be entered in either order. Both must be real,
  // non-overlapping title fragments of at least two characters.
  for (let split = 2; split <= query.length - 2; split++) {
    const left = query.slice(0, split)
    const right = query.slice(split)
    for (let a = title.indexOf(left); a !== -1; a = title.indexOf(left, a + 1)) {
      for (let b = title.indexOf(right); b !== -1; b = title.indexOf(right, b + 1)) {
        if (a + left.length > b && b + right.length > a) continue
        const span = Math.max(a + left.length, b + right.length) - Math.min(a, b)
        if (span - query.length <= Math.min(8, query.length)) return 2 + (span - query.length) / 4
      }
    }
  }
  return null
}
