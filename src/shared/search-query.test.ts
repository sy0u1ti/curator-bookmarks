import assert from 'node:assert/strict'
import { matchesParsedSearchQuery, parseSearchQuery } from './search-query.js'

for (const query of ['"not found"', "'not found'", '“not found”', '‘not found’', '"not found']) {
  const parsed = parseSearchQuery(query)
  assert.deepEqual(parsed.textTerms, ['not found'], `${query} must retain its literal text`)
  assert.deepEqual(parsed.literalTerms, ['not found'])
  assert.deepEqual(parsed.excludedTerms, [], 'exclusion words inside quotes are ordinary text')
}

for (const value of ['我爱我家', '昨天', '最近3天', 'site:github.com', '-youtube', 'new']) {
  const parsed = parseSearchQuery(`"${value}"`)
  assert.deepEqual(parsed.textTerms, [value], `quoted ${value} must remain searchable text`)
  assert.deepEqual(parsed.literalTerms, [value])
  assert.deepEqual(parsed.chips, [], 'literal text must not silently become a filter')
  assert.equal(parsed.dateRange, null)
}

const combined = parseSearchQuery('folder:"我的资料" "not found" -"no code"')
assert.deepEqual(combined.folderFilters, ['我的资料'])
assert.deepEqual(combined.textTerms, ['not found'])
assert.deepEqual(combined.excludedTerms, ['no code'])
assert.deepEqual(combined.chips.map((chip) => chip.kind), ['folder', 'exclude'])

const nestedOperator = parseSearchQuery('"read site:github.com docs"')
assert.deepEqual(nestedOperator.textTerms, ['read site:github.com docs'])
assert.deepEqual(nestedOperator.siteFilters, [])

const naturalQuery = parseSearchQuery('帮我找一下 最近3天 react 不要 vue', new Date(2026, 8, 10, 12).getTime())
assert.deepEqual(naturalQuery.textTerms, ['react'])
assert.deepEqual(naturalQuery.excludedTerms, ['vue'])
assert.ok(naturalQuery.dateRange, 'unquoted local natural-language rules must still work')

const siteQuery = parseSearchQuery('site:github.com')
const matchesSite = (url: string, domain = new URL(url).hostname) => matchesParsedSearchQuery(siteQuery, {
  searchText: url,
  domain,
  url
})

for (const url of ['https://github.com/openai', 'https://docs.github.com/en', 'https://www.github.com/openai']) {
  assert.equal(matchesSite(url), true, `${url} is within the requested site`)
}
for (const url of [
  'https://notgithub.com/openai',
  'https://github.com.example.org/openai',
  'https://example.org/github.com/docs',
  'https://example.org/?source=github.com'
]) {
  assert.equal(matchesSite(url), false, `${url} is a different site`)
}
assert.equal(matchesSite('https://github.com/openai', ''), true, 'URL-only callers should still resolve the hostname')

for (const operator of ['domain', '站点', '域名']) {
  const parsed = parseSearchQuery(`${operator}:github.com`)
  assert.equal(matchesParsedSearchQuery(parsed, {
    searchText: 'github.com',
    domain: 'notgithub.com',
    url: 'https://notgithub.com'
  }), false, `${operator} should share site-boundary semantics`)
}

const urlQuery = parseSearchQuery('url:github.com')
assert.deepEqual(urlQuery.siteFilters, [])
assert.deepEqual(urlQuery.urlFilters, ['github.com'])
assert.equal(matchesParsedSearchQuery(urlQuery, {
  searchText: '',
  url: 'https://example.org/?source=github.com'
}), true, 'the explicit URL operator should retain substring search')
assert.equal(matchesParsedSearchQuery(parseSearchQuery('site:github.com url:/issues'), {
  searchText: '', domain: 'github.com', url: 'github.com/openai/docs'
}), false, 'site and URL filters should both apply when combined')

console.log('Search query semantics tests passed.')
