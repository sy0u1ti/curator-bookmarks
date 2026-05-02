import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildFallbackPageContentFromUrl,
  buildJinaReaderUrl,
  buildPageContextForAi,
  buildRemotePageContentFromText,
  combinePageContentContexts,
  decideDirectPageFetch,
  appendPageContentWarnings,
  getDirectPageFetchFailureWarning,
  getDirectPageFetchOriginPattern,
  isCorsLikeFetchFailure,
  sanitizeHtmlForInertParsing,
  shouldUseRemoteContent
} from '../src/options/sections/content-extraction.js'

test('builds Jina Reader URLs without double r.jina.ai prefixes', () => {
  assert.equal(
    buildJinaReaderUrl('http://example.com/docs'),
    'https://r.jina.ai/http://example.com/docs'
  )
  assert.equal(
    buildJinaReaderUrl('https://example.com/docs'),
    'https://r.jina.ai/http://https://example.com/docs'
  )
})

test('builds fallback context from known URL shapes', () => {
  const context = buildFallbackPageContentFromUrl('https://github.com/openai/openai-node', {
    currentTitle: 'GitHub - openai/openai-node'
  })

  assert.equal(context.title, 'openai / openai-node')
  assert.equal(context.contentType, 'github_repo')
  assert.equal(shouldUseRemoteContent(context), true)
})

test('skips direct page fetch without optional origin permission', () => {
  const originPattern = getDirectPageFetchOriginPattern('https://111.com/docs')
  const decision = decideDirectPageFetch('https://111.com/docs', false)

  assert.equal(originPattern, 'https://111.com/*')
  assert.equal(decision.allowed, false)
  assert.equal(decision.originPattern, 'https://111.com/*')
  assert.equal(decision.reason, 'missing-origin-permission')
  assert.match(decision.warning, /未授权访问 https:\/\/111\.com/)
})

test('allows direct page fetch only for http origins with granted permission', () => {
  assert.deepEqual(
    decideDirectPageFetch('chrome://extensions', true),
    {
      allowed: false,
      originPattern: '',
      reason: 'unsupported-scheme',
      warning: '该链接类型不支持直接抓取，已使用有限上下文。'
    }
  )

  assert.deepEqual(
    decideDirectPageFetch('https://example.com/article', true),
    {
      allowed: true,
      originPattern: 'https://example.com/*',
      reason: 'allowed',
      warning: ''
    }
  )
})

test('normalizes CORS-like fetch failures into graceful fallback warnings', () => {
  const corsError = new TypeError('Failed to fetch')
  const context = appendPageContentWarnings(
    buildFallbackPageContentFromUrl('https://111.com/', {
      currentTitle: '111',
      error: corsError
    }),
    [getDirectPageFetchFailureWarning(corsError)]
  )

  assert.equal(isCorsLikeFetchFailure(corsError), true)
  assert.equal(context.extractionStatus, 'failed')
  assert.ok(context.warnings.some((warning) => /直接抓取网页被浏览器或站点策略拦截/.test(warning)))
  assert.ok(context.warnings.some((warning) => /网页内容抓取失败/.test(warning)))
})

test('sanitizes fetched HTML before inert DOM parsing', () => {
  const sanitized = sanitizeHtmlForInertParsing(`
    <meta http-equiv="Content-Security-Policy" content="script-src 'none'">
    <script>alert('x')</script>
    <a href="javascript:alert(1)" onclick="alert(2)">打开</a>
  `)

  assert.doesNotMatch(sanitized, /Content-Security-Policy/i)
  assert.doesNotMatch(sanitized, /<script/i)
  assert.doesNotMatch(sanitized, /javascript:/i)
  assert.doesNotMatch(sanitized, /onclick/i)
})

test('normalizes remote markdown content into AI page context', () => {
  const context = buildRemotePageContentFromText(
    [
      'Title: Example Article',
      '',
      'Markdown Content:',
      '# Example Article',
      'This article explains bookmark organization with AI powered browser extensions.',
      '## Details',
      'It covers extraction, summarization, classification and review workflows.'
    ].join('\n'),
    { url: 'https://example.com/article' }
  )
  const aiContext = buildPageContextForAi(context, { mainTextLimit: 1200 })

  assert.equal(context.extractionStatus, 'remote')
  assert.equal(aiContext.title, 'Example Article')
  assert.deepEqual(aiContext.headings, ['Example Article', 'Details'])
  assert.ok(/bookmark organization/.test(String(aiContext.main_text_excerpt)))
})

test('combines local and Jina Reader contexts for AI analysis', () => {
  const localText = Array(8)
    .fill('Local extraction keeps browser-visible metadata, headings, navigation clues and page-specific link context.')
    .join('\n\n')
  const remoteText = [
    'Title: Remote Article',
    '',
    'Markdown Content:',
    '# Remote Article',
    Array(8)
      .fill('Jina Reader provides cleaner markdown body content for bookmark naming and folder classification.')
      .join('\n\n')
  ].join('\n')
  const combined = combinePageContentContexts(
    {
      finalUrl: 'https://example.com/article',
      title: 'Local Article Title',
      description: 'Local meta description',
      headings: ['Local Heading'],
      mainText: localText,
      linkContext: ['Docs -> example.com/docs'],
      contentType: 'article',
      source: 'html',
      extractionStatus: 'ok' as const,
      contentLength: localText.length,
      warnings: []
    },
    buildRemotePageContentFromText(remoteText, { url: 'https://example.com/article' })
  )
  const aiContext = buildPageContextForAi(combined, { mainTextLimit: 2400 })
  const extraction = aiContext.extraction as { status?: string }
  const sourceContexts = aiContext.source_contexts as unknown[]

  assert.equal(combined.extractionStatus, 'combined')
  assert.equal(extraction.status, 'combined')
  assert.equal(Array.isArray(sourceContexts), true)
  assert.equal(sourceContexts.length, 2)
  assert.ok(/本地抽取正文/.test(String(aiContext.main_text_excerpt)))
  assert.ok(/Jina Reader 正文/.test(String(aiContext.main_text_excerpt)))
})
