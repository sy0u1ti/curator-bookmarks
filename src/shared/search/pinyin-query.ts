
const PINYIN_LIKE_REGEX = /(?:^|[\s:"'“”‘’])([a-z]{2,})(?=$|[\s"'“”‘’])/i

export function queryLooksLikePinyin(query: string): boolean {
  const trimmed = String(query || '').trim()
  if (trimmed.length < 2) {
    return false
  }
  return PINYIN_LIKE_REGEX.test(trimmed)
}

export function requiresPinyinTokens(query: string): boolean {
  return queryLooksLikePinyin(query)
}
