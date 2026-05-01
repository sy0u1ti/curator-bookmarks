export type PageExtractionStatus = 'ok' | 'limited' | 'fallback' | 'remote' | 'combined' | 'failed'

export interface PageContentSourceContext {
  label: string
  title: string
  description: string
  headings: string[]
  mainText: string
  contentType: string
  source: string
  extractionStatus: PageExtractionStatus
  contentLength: number
  warnings: string[]
}

export interface PageContentContext {
  finalUrl: string
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogType: string
  canonicalUrl: string
  lang: string
  headings: string[]
  mainText: string
  linkContext: string[]
  contentType: string
  source: string
  extractionStatus: PageExtractionStatus
  contentLength: number
  warnings: string[]
  sourceContexts: PageContentSourceContext[]
}

interface ExtractHtmlOptions {
  url?: unknown
  currentTitle?: unknown
  contentType?: unknown
}

interface FallbackOptions {
  currentTitle?: unknown
  contentType?: unknown
  error?: unknown
}

const MAIN_TEXT_LIMIT = 6000
const MAIN_TEXT_SHORT_LIMIT = 3600
const MAX_HEADINGS = 28
const MAX_LINK_CONTEXT = 18
const MAX_LIST_TEXT_LENGTH = 120
const MIN_USEFUL_MAIN_TEXT_LENGTH = 420
const JINA_READER_PREFIX = 'https://r.jina.ai/http://'

const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.markdown-body',
  '.post-content',
  '.entry-content',
  '.article-content',
  '.article-body',
  '.content',
  '#content',
  '.docs-content',
  '.documentation',
  '.main-content'
]

const NOISE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'nav',
  'header',
  'footer',
  'aside',
  '[role="navigation"]',
  '[aria-hidden="true"]'
].join(',')

export function extractPageContentFromHtml(html: string, options: ExtractHtmlOptions = {}): PageContentContext {
  const finalUrl = String(options.url || '').trim()
  const documentNode = new DOMParser().parseFromString(String(html || ''), 'text/html')
  const title = cleanText(
    documentNode.querySelector('title')?.textContent ||
      queryMeta(documentNode, 'meta[property="og:title"]') ||
      options.currentTitle ||
      ''
  )
  const description =
    queryMeta(documentNode, 'meta[name="description"]') ||
    queryMeta(documentNode, 'meta[property="og:description"]')
  const ogTitle = queryMeta(documentNode, 'meta[property="og:title"]')
  const ogDescription = queryMeta(documentNode, 'meta[property="og:description"]')
  const ogType = queryMeta(documentNode, 'meta[property="og:type"]')
  const lang = cleanText(
    documentNode.documentElement.getAttribute('lang') ||
      queryMeta(documentNode, 'meta[http-equiv="content-language"]')
  )
  const canonicalUrl = resolveUrl(
    documentNode.querySelector('link[rel~="canonical"]')?.getAttribute('href') || '',
    finalUrl
  )
  const headings = collectHeadings(documentNode)
  const linkContext = collectLinkContext(documentNode, finalUrl)
  const mainText = extractMainText(documentNode)
  const warnings: string[] = []

  if (!mainText || mainText.length < MIN_USEFUL_MAIN_TEXT_LENGTH) {
    warnings.push('正文抽取内容较少，结果置信度可能偏低。')
  }

  const context = normalizePageContentContext({
    finalUrl,
    title,
    description,
    ogTitle,
    ogDescription,
    ogType,
    canonicalUrl,
    lang,
    headings,
    mainText,
    linkContext,
    contentType: '',
    source: 'html',
    extractionStatus: mainText.length >= MIN_USEFUL_MAIN_TEXT_LENGTH ? 'ok' : 'limited',
    contentLength: mainText.length,
    warnings
  })

  return {
    ...context,
    contentType: detectContentType(context, options.contentType)
  }
}

export function buildFallbackPageContentFromUrl(
  url: unknown,
  options: FallbackOptions = {}
): PageContentContext {
  const finalUrl = String(url || '').trim()
  const parsedUrl = parseUrlSafely(finalUrl)
  const hostname = parsedUrl?.hostname.replace(/^www\./i, '') || ''
  const pathname = parsedUrl?.pathname || ''
  const filename = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || '')
  const readableFilename = cleanText(
    filename
      .replace(/\.[a-z0-9]{1,8}$/i, '')
      .replace(/[-_]+/g, ' ')
  )
  const lowerContentType = String(options.contentType || '').toLowerCase()
  let title = cleanText(options.currentTitle) || readableFilename || hostname || finalUrl
  let description = ''
  let source = lowerContentType ? 'non-html' : 'fallback'
  const warnings = [
    options.error
      ? `网页内容抓取失败：${getErrorMessage(options.error)}`
      : lowerContentType
        ? `非 HTML 页面：${lowerContentType}`
        : '未能抽取网页正文，已基于 URL 生成有限上下文。'
  ]

  if (lowerContentType.includes('pdf') || /\.pdf($|[?#])/i.test(finalUrl)) {
    title = readableFilename || title || 'PDF 文档'
    description = '该书签指向 PDF 文档，当前版本未抽取 PDF 正文。'
    source = 'pdf'
  } else if (hostname === 'github.com') {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length >= 2) {
      title = `${segments[0]} / ${segments[1]}`
      const githubPath = segments.slice(2).join(' / ')
      description = segments.some((segment) => /^readme(\.md)?$/i.test(segment))
        ? 'GitHub README 页面，当前使用页面元信息或 URL 生成轻量快照。'
        : githubPath
          ? `GitHub 页面：${githubPath}`
          : 'GitHub 仓库页面，当前使用页面元信息或 URL 生成轻量快照。'
    }
    source = 'github'
  } else if (hostname === 'www.npmjs.com' || hostname === 'npmjs.com') {
    const packageName = pathname.replace(/^\/package\//, '').split('/').filter(Boolean).join('/')
    title = packageName || title || 'npm package'
    description = 'npm package page'
    source = 'npm'
  } else if (hostname === 'youtu.be' || hostname.endsWith('youtube.com')) {
    title = title || 'YouTube 视频'
    description = 'YouTube 视频或频道页面，当前保存标题、描述元信息与轻量 fallback。'
    source = 'youtube'
  } else if (isDocumentationHost(hostname)) {
    title = readableFilename || title || hostname
    description = '文档页，当前基于页面元信息或 URL 路径生成轻量快照。'
    source = 'docs'
  }

  const context = normalizePageContentContext({
    finalUrl,
    title,
    description,
    ogTitle: '',
    ogDescription: '',
    ogType: '',
    canonicalUrl: '',
    lang: '',
    headings: [],
    mainText: '',
    linkContext: [],
    contentType: '',
    source,
    extractionStatus: options.error ? 'failed' : 'fallback',
    contentLength: 0,
    warnings
  })

  return {
    ...context,
    contentType: detectContentType(context, lowerContentType)
  }
}

export function buildRemotePageContentFromText(
  text: unknown,
  { url = '', currentTitle = '' }: { url?: unknown; currentTitle?: unknown } = {}
): PageContentContext {
  const rawText = String(text || '')
  const title =
    matchLine(rawText, /^Title:\s*(.+)$/im) ||
    matchLine(rawText, /^#\s+(.+)$/m) ||
    cleanText(currentTitle)
  const description = matchLine(rawText, /^Description:\s*(.+)$/im)
  const contentStart = rawText.search(/^Markdown Content:\s*$/im)
  const content = cleanMarkdownText(
    contentStart >= 0
      ? rawText.slice(contentStart).replace(/^Markdown Content:\s*/im, '')
      : rawText
  )
  const headings = collectMarkdownHeadings(rawText)
  const warnings = content.length < MIN_USEFUL_MAIN_TEXT_LENGTH
    ? ['远程解析返回内容较少，结果置信度可能偏低。']
    : []
  const context = normalizePageContentContext({
    finalUrl: String(url || '').trim(),
    title,
    description,
    ogTitle: '',
    ogDescription: '',
    ogType: '',
    canonicalUrl: '',
    lang: '',
    headings,
    mainText: content,
    linkContext: [],
    contentType: '',
    source: 'jina-reader',
    extractionStatus: content ? 'remote' : 'limited',
    contentLength: content.length,
    warnings
  })

  return {
    ...context,
    contentType: detectContentType(context)
  }
}

export function normalizePageContentContext(context: Partial<PageContentContext>): PageContentContext {
  const mainText = cleanText(context.mainText || '')
  return {
    finalUrl: String(context.finalUrl || '').trim(),
    title: truncateCleanText(context.title, 280),
    description: truncateCleanText(context.description, 420),
    ogTitle: truncateCleanText(context.ogTitle, 280),
    ogDescription: truncateCleanText(context.ogDescription, 420),
    ogType: truncateCleanText(context.ogType, 80),
    canonicalUrl: String(context.canonicalUrl || '').trim(),
    lang: truncateCleanText(context.lang, 40),
    headings: normalizeTextList(context.headings, MAX_HEADINGS, MAX_LIST_TEXT_LENGTH),
    mainText,
    linkContext: normalizeTextList(context.linkContext, MAX_LINK_CONTEXT, 160),
    contentType: truncateCleanText(context.contentType, 80),
    source: truncateCleanText(context.source, 80),
    extractionStatus: normalizeExtractionStatus(context.extractionStatus),
    contentLength: Number(context.contentLength) || mainText.length,
    warnings: normalizeTextList(context.warnings, 8, 160),
    sourceContexts: normalizeSourceContexts(context.sourceContexts)
  }
}

export function buildPageContextForAi(
  context: PageContentContext,
  { mainTextLimit = MAIN_TEXT_LIMIT } = {}
): Record<string, unknown> {
  const normalized = normalizePageContentContext(context)
  return {
    title: normalized.title,
    description: normalized.description,
    og_title: normalized.ogTitle,
    og_description: normalized.ogDescription,
    og_type: normalized.ogType,
    canonical_url: normalized.canonicalUrl,
    lang: normalized.lang,
    headings: normalized.headings,
    main_text_excerpt: buildMainTextExcerpt(normalized.mainText, mainTextLimit),
    main_text_length: normalized.contentLength || normalized.mainText.length,
    link_context: normalized.linkContext,
    content_type: normalized.contentType,
    extraction: {
      status: normalized.extractionStatus,
      source: normalized.source,
      warnings: normalized.warnings
    },
    source_contexts: normalized.sourceContexts.map((sourceContext) => ({
      label: sourceContext.label,
      title: sourceContext.title,
      description: sourceContext.description,
      headings: sourceContext.headings,
      main_text_excerpt: buildMainTextExcerpt(
        sourceContext.mainText,
        Math.max(1200, Math.round(mainTextLimit / Math.max(normalized.sourceContexts.length, 1)))
      ),
      main_text_length: sourceContext.contentLength || sourceContext.mainText.length,
      content_type: sourceContext.contentType,
      extraction: {
        status: sourceContext.extractionStatus,
        source: sourceContext.source,
        warnings: sourceContext.warnings
      }
    }))
  }
}

export function combinePageContentContexts(
  localContext: Partial<PageContentContext>,
  remoteContext: Partial<PageContentContext>
): PageContentContext {
  const local = normalizePageContentContext(localContext)
  const remote = normalizePageContentContext(remoteContext)
  const mainText = cleanText([
    local.mainText ? `本地抽取正文：\n${local.mainText}` : '',
    remote.mainText ? `Jina Reader 正文：\n${remote.mainText}` : ''
  ].filter(Boolean).join('\n\n'))
  const context = normalizePageContentContext({
    finalUrl: remote.finalUrl || local.finalUrl,
    title: local.title || remote.title,
    description: local.description || remote.description,
    ogTitle: local.ogTitle || remote.ogTitle,
    ogDescription: local.ogDescription || remote.ogDescription,
    ogType: local.ogType || remote.ogType,
    canonicalUrl: local.canonicalUrl || remote.canonicalUrl,
    lang: local.lang || remote.lang,
    headings: normalizeTextList([...local.headings, ...remote.headings], MAX_HEADINGS, MAX_LIST_TEXT_LENGTH),
    mainText,
    linkContext: normalizeTextList([...local.linkContext, ...remote.linkContext], MAX_LINK_CONTEXT, 160),
    contentType: chooseCombinedContentType(local.contentType, remote.contentType),
    source: 'html+jina-reader',
    extractionStatus: 'combined',
    contentLength: (local.contentLength || local.mainText.length) + (remote.contentLength || remote.mainText.length),
    warnings: normalizeTextList([
      ...local.warnings,
      ...remote.warnings
    ], 8, 160),
    sourceContexts: [
      buildSourceContext('本地抽取', local),
      buildSourceContext('Jina Reader', remote)
    ].filter((sourceContext) => Boolean(
      sourceContext.title ||
      sourceContext.description ||
      sourceContext.mainText ||
      sourceContext.headings.length
    ))
  })

  return {
    ...context,
    contentType: chooseCombinedContentType(context.contentType, detectContentType(context))
  }
}

export function shouldUseRemoteContent(context: PageContentContext | null | undefined): boolean {
  if (!context) {
    return true
  }

  const normalized = normalizePageContentContext(context)
  return (
    normalized.extractionStatus === 'failed' ||
    normalized.mainText.length < MIN_USEFUL_MAIN_TEXT_LENGTH
  )
}

export function buildJinaReaderUrl(url: unknown): string {
  const normalized = String(url || '').trim()
  if (!normalized) {
    return ''
  }

  const target = normalized
    .replace(/^http:\/\//i, '')
    .replace(/^https:\/\//i, 'https://')
  return `${JINA_READER_PREFIX}${target}`
}

export function detectContentType(
  context: Partial<PageContentContext>,
  rawContentType: unknown = ''
): string {
  const url = String(context.finalUrl || '').toLowerCase()
  const hostname = parseUrlSafely(context.finalUrl)?.hostname.replace(/^www\./i, '') || ''
  const text = [
    context.title,
    context.description,
    context.ogTitle,
    context.ogDescription,
    context.ogType,
    ...(Array.isArray(context.headings) ? context.headings : [])
  ].join(' ').toLowerCase()
  const contentType = String(rawContentType || '').toLowerCase()

  if (contentType.includes('pdf') || /\.pdf($|[?#])/i.test(url)) {
    return 'pdf'
  }

  if (hostname === 'github.com' && /^\/[^/]+\/[^/]+\/?$/.test(parseUrlSafely(context.finalUrl)?.pathname || '')) {
    return 'github_repo'
  }

  if (hostname === 'youtu.be' || hostname.endsWith('youtube.com')) {
    return 'video'
  }

  if (hostname.includes('reddit.com') || hostname.includes('stackoverflow.com') || /forum|discussion|thread/.test(text)) {
    return 'forum'
  }

  if (hostname === 'www.npmjs.com' || hostname === 'npmjs.com') {
    return 'package'
  }

  if (isDocumentationHost(hostname) || /docs|documentation|api reference|guide|教程|文档/.test(text)) {
    return 'documentation'
  }

  if (/product|price|pricing|cart|sku|商品|价格|购买/.test(text)) {
    return 'product'
  }

  if (/paper|abstract|arxiv|doi|论文|摘要/.test(text) || hostname.includes('arxiv.org')) {
    return 'paper'
  }

  if (/blog|article|post|news|博客|文章|新闻/.test(text)) {
    return 'article'
  }

  if (!context.mainText || String(context.mainText || '').length < MIN_USEFUL_MAIN_TEXT_LENGTH) {
    return 'limited_page'
  }

  return 'web_page'
}

function queryMeta(documentNode: Document, selector: string): string {
  return truncateCleanText(documentNode.querySelector(selector)?.getAttribute('content') || '', 420)
}

function collectHeadings(documentNode: Document): string[] {
  return normalizeTextList(
    Array.from(documentNode.querySelectorAll('h1, h2, h3')).map((node) => node.textContent || ''),
    MAX_HEADINGS,
    MAX_LIST_TEXT_LENGTH
  )
}

function collectLinkContext(documentNode: Document, baseUrl: string): string[] {
  const links = Array.from(documentNode.querySelectorAll('a[href]'))
    .map((node) => {
      const text = truncateCleanText(node.textContent || '', 72)
      const href = resolveUrl(node.getAttribute('href') || '', baseUrl)
      if (!text || text.length < 3 || !href) {
        return ''
      }

      const parsedHref = parseUrlSafely(href)
      const urlLabel = parsedHref
        ? `${parsedHref.hostname.replace(/^www\./i, '')}${parsedHref.pathname}`.replace(/\/+$/, '')
        : href
      return `${text} -> ${truncateCleanText(urlLabel, 80)}`
    })
    .filter(Boolean)

  return normalizeTextList(links, MAX_LINK_CONTEXT, 160)
}

function extractMainText(documentNode: Document): string {
  const candidates = CONTENT_SELECTORS
    .flatMap((selector) => Array.from(documentNode.querySelectorAll(selector)))
    .filter(Boolean)
  const target = candidates
    .map((element) => ({
      element,
      score: scoreContentCandidate(element)
    }))
    .sort((left, right) => right.score - left.score)[0]?.element || documentNode.body

  return extractReadableText(target)
}

function scoreContentCandidate(element: Element): number {
  const text = cleanText(element.textContent || '')
  if (!text) {
    return 0
  }

  const linkText = cleanText(
    Array.from(element.querySelectorAll('a'))
      .map((node) => node.textContent || '')
      .join(' ')
  )
  const paragraphCount = element.querySelectorAll('p, li, pre, blockquote').length
  const linkRatio = linkText.length / Math.max(text.length, 1)
  return text.length + paragraphCount * 80 - Math.round(linkRatio * text.length * 0.7)
}

function extractReadableText(element: Element | null | undefined): string {
  if (!element) {
    return ''
  }

  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll(NOISE_SELECTOR).forEach((node) => node.remove())
  const blocks = Array.from(clone.querySelectorAll('p, li, blockquote, pre, h1, h2, h3'))
    .map((node) => cleanText(node.textContent || ''))
    .filter((text) => text.length >= 18)
  const text = blocks.length >= 3
    ? blocks.join('\n\n')
    : cleanText(clone.textContent || '')

  return text
}

function buildMainTextExcerpt(text: string, limit: number): string {
  const normalized = cleanText(text)
  const effectiveLimit = Math.max(1200, Math.min(Number(limit) || MAIN_TEXT_LIMIT, 10000))
  if (normalized.length <= Math.min(effectiveLimit, MAIN_TEXT_SHORT_LIMIT)) {
    return normalized
  }

  const paragraphs = normalized
    .split(/\n{2,}|(?<=[。！？.!?])\s+/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= 40)
  if (paragraphs.length >= 8) {
    const budget = effectiveLimit
    const head = takeParagraphs(paragraphs.slice(0, 6), Math.round(budget * 0.45))
    const middleStart = Math.max(0, Math.floor(paragraphs.length / 2) - 2)
    const middle = takeParagraphs(paragraphs.slice(middleStart, middleStart + 5), Math.round(budget * 0.25))
    const tail = takeParagraphs(paragraphs.slice(-5), Math.round(budget * 0.25))
    return truncateCleanText(
      [head, middle ? `[中段摘录]\n${middle}` : '', tail ? `[结尾摘录]\n${tail}` : '']
        .filter(Boolean)
        .join('\n\n'),
      budget
    )
  }

  const headLength = Math.round(effectiveLimit * 0.5)
  const middleLength = Math.round(effectiveLimit * 0.25)
  const tailLength = Math.round(effectiveLimit * 0.2)
  const middleStart = Math.max(0, Math.floor(normalized.length / 2) - Math.floor(middleLength / 2))
  return [
    normalized.slice(0, headLength),
    `[中段摘录]\n${normalized.slice(middleStart, middleStart + middleLength)}`,
    `[结尾摘录]\n${normalized.slice(Math.max(0, normalized.length - tailLength))}`
  ].join('\n\n')
}

function takeParagraphs(paragraphs: string[], limit: number): string {
  const chunks = []
  let length = 0
  for (const paragraph of paragraphs) {
    if (length + paragraph.length > limit && chunks.length) {
      break
    }
    chunks.push(paragraph)
    length += paragraph.length
  }

  return chunks.join('\n\n')
}

function cleanMarkdownText(text: string): string {
  return cleanText(
    text
      .replace(/^URL Source:.*$/gim, '')
      .replace(/^Markdown Content:\s*$/gim, '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/`{1,3}/g, '')
  )
}

function collectMarkdownHeadings(text: string): string[] {
  return normalizeTextList(
    String(text || '')
      .split('\n')
      .map((line) => line.match(/^#{1,3}\s+(.+)$/)?.[1] || '')
      .filter(Boolean),
    MAX_HEADINGS,
    MAX_LIST_TEXT_LENGTH
  )
}

function matchLine(text: string, pattern: RegExp): string {
  return truncateCleanText(String(text || '').match(pattern)?.[1] || '', 280)
}

function normalizeTextList(values: unknown, limit: number, itemLimit: number): string[] {
  const source = Array.isArray(values) ? values : []
  const seen = new Set<string>()
  return source
    .map((value) => truncateCleanText(value, itemLimit))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function normalizeSourceContexts(values: unknown): PageContentSourceContext[] {
  const source = Array.isArray(values) ? values : []
  return source
    .map((value) => {
      const item = value && typeof value === 'object'
        ? value as Partial<PageContentSourceContext>
        : {}
      const mainText = cleanText(item.mainText || '')
      return {
        label: truncateCleanText(item.label, 48),
        title: truncateCleanText(item.title, 280),
        description: truncateCleanText(item.description, 420),
        headings: normalizeTextList(item.headings, MAX_HEADINGS, MAX_LIST_TEXT_LENGTH),
        mainText,
        contentType: truncateCleanText(item.contentType, 80),
        source: truncateCleanText(item.source, 80),
        extractionStatus: normalizeExtractionStatus(item.extractionStatus),
        contentLength: Number(item.contentLength) || mainText.length,
        warnings: normalizeTextList(item.warnings, 6, 160)
      }
    })
    .filter((item) => Boolean(item.title || item.description || item.mainText || item.headings.length))
    .slice(0, 4)
}

function buildSourceContext(label: string, context: PageContentContext): PageContentSourceContext {
  const normalized = normalizePageContentContext(context)
  return {
    label,
    title: normalized.title,
    description: normalized.description,
    headings: normalized.headings,
    mainText: normalized.mainText,
    contentType: normalized.contentType,
    source: normalized.source,
    extractionStatus: normalized.extractionStatus,
    contentLength: normalized.contentLength || normalized.mainText.length,
    warnings: normalized.warnings
  }
}

function chooseCombinedContentType(primary: unknown, fallback: unknown): string {
  const primaryType = truncateCleanText(primary, 80)
  const fallbackType = truncateCleanText(fallback, 80)
  if (primaryType && primaryType !== 'limited_page') {
    return primaryType
  }
  return fallbackType || primaryType
}

function normalizeExtractionStatus(value: unknown): PageExtractionStatus {
  const normalized = String(value || '').trim()
  if (['ok', 'limited', 'fallback', 'remote', 'combined', 'failed'].includes(normalized)) {
    return normalized as PageExtractionStatus
  }
  return 'fallback'
}

function resolveUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl || undefined).href
  } catch {
    return String(value || '').trim()
  }
}

function parseUrlSafely(url: unknown): URL | null {
  try {
    return new URL(String(url || ''))
  } catch {
    return null
  }
}

function isDocumentationHost(hostname: string): boolean {
  return (
    hostname.includes('docs.') ||
    hostname.includes('developer.') ||
    hostname.endsWith('.readthedocs.io') ||
    hostname === 'developer.mozilla.org' ||
    hostname === 'docs.github.com' ||
    hostname === 'learn.microsoft.com'
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

function truncateCleanText(value: unknown, limit = 280): string {
  const text = cleanText(value)
  if (text.length <= limit) {
    return text
  }

  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
