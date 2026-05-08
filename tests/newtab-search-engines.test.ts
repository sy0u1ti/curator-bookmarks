import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  SEARCH_MULTI_OPEN_LIMIT,
  buildSearchEngineUrl,
  normalizeEnabledSearchEngineIds,
  normalizeSearchEngineId,
  planSearchOpenTargets
} from '../src/newtab/search-engines.js'

test('newtab web search is controlled by an explicit user setting', () => {
  const html = readFileSync('src/newtab/newtab.html', 'utf8')
  const script = readFileSync('src/newtab/newtab.ts', 'utf8')

  assert.match(html, /id="search-web-enabled"/)
  assert.match(html, /关闭后仅保留本地书签搜索/)
  assert.match(script, /webSearchEnabled:\s*true/)
  assert.match(script, /if \(state\.searchSettings\.webSearchEnabled === false\) \{[\s\S]*?return[\s\S]*?\}/)
})

test('normalizes search engine selection and enabled order', () => {
  assert.equal(normalizeSearchEngineId('perplexity'), 'perplexity')
  assert.equal(normalizeSearchEngineId('unknown'), 'google')
  assert.equal(normalizeSearchEngineId('default'), 'google')
  assert.deepEqual(
    normalizeEnabledSearchEngineIds(['default', 'bing', 'bing', 'chatgpt', 'bad'], 'google'),
    ['google', 'bing', 'chatgpt']
  )
})

test('builds search URLs from local engine templates', () => {
  assert.equal(
    buildSearchEngineUrl('react table', 'bing'),
    'https://www.bing.com/search?q=react%20table'
  )
  assert.equal(
    buildSearchEngineUrl('AI 书签', 'chatgpt'),
    'https://chatgpt.com/?q=AI%20%E4%B9%A6%E7%AD%BE'
  )
})

test('plans single and multi engine search targets with a popup-safe cap', () => {
  assert.deepEqual(
    planSearchOpenTargets('curator', 'duckduckgo', ['google', 'duckduckgo'], false),
    [
      {
        engineId: 'duckduckgo',
        engineName: 'DuckDuckGo',
        url: 'https://duckduckgo.com/?q=curator'
      }
    ]
  )

  const targets = planSearchOpenTargets(
    'curator',
    'google',
    ['google', 'bing', 'baidu', 'duckduckgo', 'perplexity'],
    true
  )
  assert.equal(targets.length, SEARCH_MULTI_OPEN_LIMIT)
  assert.deepEqual(
    targets.map((target) => target.engineId),
    ['google', 'bing', 'baidu', 'duckduckgo']
  )
})
