import { normalizeText } from '../text.js'

export interface PinyinTokens {
  full: string[]
  initials: string[]
}

export interface PinyinEnrichTarget {
  tagPinyinFull: string[]
  tagPinyinInitials: string[]
  searchText: string
  title: string
  path?: string
  tagTopics?: string[]
  tagTags?: string[]
  tagAliases?: string[]
  pinyinEnriched?: boolean
  pinyinBaseSearchText?: string
}

export interface CooperativeEnrichOptions {
  isActive?: () => boolean
  yieldWork?: () => Promise<unknown>
  batchSize?: number
  onProgress?: (processed: number, total: number) => void
}

let pinyinModulePromise: Promise<typeof import('pinyin-pro')> | null = null

function loadPinyinModule(): Promise<typeof import('pinyin-pro')> {
  if (!pinyinModulePromise) {
    pinyinModulePromise = import('pinyin-pro')
  }
  return pinyinModulePromise
}

export async function ensurePinyinModuleLoaded(): Promise<void> {
  await loadPinyinModule()
}

export function isPinyinModuleLoaded(): boolean {
  return pinyinModulePromise !== null
}

const CHINESE_REGEX = /[㐀-鿿]/u
const PINYIN_LIKE_REGEX = /^[a-z][a-z0-9]*$/i

export function queryHasChinese(query: string): boolean {
  return CHINESE_REGEX.test(String(query || ''))
}

export function queryLooksLikePinyin(query: string): boolean {
  const trimmed = String(query || '').trim()
  if (trimmed.length < 3) {
    return false
  }
  return PINYIN_LIKE_REGEX.test(trimmed)
}

export function requiresPinyinTokens(query: string): boolean {
  return queryLooksLikePinyin(query)
}

function buildPinyinToken(
  pinyin: typeof import('pinyin-pro').pinyin,
  text: string,
  options: Record<string, unknown>
): string {
  return normalizeText(
    pinyin(text, {
      toneType: 'none',
      type: 'array',
      ...options
    }).join('')
  )
}

export function buildPinyinTokensSync(
  pinyin: typeof import('pinyin-pro').pinyin,
  values: unknown[]
): PinyinTokens {
  const full = new Set<string>()
  const initials = new Set<string>()

  for (const value of values) {
    const text = String(value || '')
    const matches = text.match(/[㐀-鿿]+/gu) || []
    for (const match of matches) {
      const fullToken = buildPinyinToken(pinyin, match, {})
      const initialsToken = buildPinyinToken(pinyin, match, { pattern: 'first' })
      if (fullToken) {
        full.add(fullToken)
      }
      if (initialsToken) {
        initials.add(initialsToken)
      }
    }
  }

  return {
    full: [...full],
    initials: [...initials]
  }
}

function getPinyinSourceValues(target: PinyinEnrichTarget): unknown[] {
  return [
    target.title,
    target.path || '',
    ...(target.tagTopics || []),
    ...(target.tagTags || []),
    ...(target.tagAliases || [])
  ]
}

function applyPinyinTokens(target: PinyinEnrichTarget, tokens: PinyinTokens): boolean {
  const baseSearchText = target.pinyinBaseSearchText ?? target.searchText
  target.pinyinBaseSearchText = baseSearchText
  target.pinyinEnriched = true

  const newFull = tokens.full
  const newInitials = tokens.initials
  if (!newFull.length && !newInitials.length) {
    target.tagPinyinFull = []
    target.tagPinyinInitials = []
    target.searchText = baseSearchText
    return false
  }

  target.tagPinyinFull = newFull
  target.tagPinyinInitials = newInitials
  const enrichedSegment = [...newFull, ...newInitials].join(' ')
  target.searchText = enrichedSegment ? `${baseSearchText} ${enrichedSegment}`.trim() : baseSearchText
  return true
}

export async function enrichBookmarkPinyinTokens(target: PinyinEnrichTarget): Promise<boolean> {
  const mod = await loadPinyinModule()
  const tokens = buildPinyinTokensSync(mod.pinyin, getPinyinSourceValues(target))
  return applyPinyinTokens(target, tokens)
}

function defaultYieldWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export async function enrichPinyinTokensCooperatively(
  targets: PinyinEnrichTarget[],
  options: CooperativeEnrichOptions = {}
): Promise<{ processed: number; enriched: number; aborted: boolean }> {
  if (!targets.length) {
    return { processed: 0, enriched: 0, aborted: false }
  }

  const mod = await loadPinyinModule()
  const isActive = options.isActive ?? (() => true)
  const yieldWork = options.yieldWork ?? defaultYieldWork
  const batchSize = Math.max(50, options.batchSize ?? 250)
  const total = targets.length

  let processed = 0
  let enriched = 0

  for (let index = 0; index < targets.length; index += batchSize) {
    if (!isActive()) {
      return { processed, enriched, aborted: true }
    }

    const end = Math.min(index + batchSize, targets.length)
    for (let cursor = index; cursor < end; cursor += 1) {
      const target = targets[cursor]
      const tokens = buildPinyinTokensSync(mod.pinyin, getPinyinSourceValues(target))
      if (applyPinyinTokens(target, tokens)) {
        enriched += 1
      }
      processed += 1
    }

    if (options.onProgress) {
      options.onProgress(processed, total)
    }

    if (end < targets.length) {
      await yieldWork()
    }
  }

  return { processed, enriched, aborted: false }
}
