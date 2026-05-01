import { STORAGE_KEYS } from './constants.js'
import { getLocalStorage, setLocalStorage, removeLocalStorage } from './storage.js'
import type { BookmarkRecord } from './types.js'

export const BOOKMARK_TAG_SCHEMA_VERSION = 1
export const BOOKMARK_TAG_INDEX_VERSION = 1
export const BOOKMARK_TAG_SUMMARY_LIMIT = 500
export const BOOKMARK_TAG_TOPICS_LIMIT = 8
export const BOOKMARK_TAG_TAGS_LIMIT = 12
export const BOOKMARK_TAG_ALIASES_LIMIT = 20
export const BOOKMARK_TAG_FIELD_LIMIT = 40
export const BOOKMARK_TAG_TAG_TEXT_LIMIT = 24
export const BOOKMARK_TAG_INDEX_SAFE_BYTES = 4 * 1024 * 1024

const TRACKING_PARAM_NAMES = new Set([
  'fbclid',
  'gclid',
  'yclid',
  'mc_cid',
  'mc_eid',
  'spm',
  'igshid',
  'msclkid',
  'ref',
  'ref_src'
])

const GENERIC_TAG_VALUES = new Set([
  '网站',
  '网页',
  '页面',
  '内容',
  '文章页面',
  '工具类页面',
  '首页',
  '未分类',
  '其他'
])

export type BookmarkTagSource = 'ai_naming' | 'auto_analyze' | 'popup_smart' | 'imported' | 'manual'

export interface BookmarkTagExtraction {
  status: string
  source: string
  warnings: string[]
}

export interface BookmarkTagRecord {
  schemaVersion: 1
  bookmarkId: string
  url: string
  normalizedUrl: string
  duplicateKey: string
  title: string
  path: string
  summary: string
  contentType: string
  topics: string[]
  tags: string[]
  manualTags?: string[]
  manualUpdatedAt?: number
  aliases: string[]
  confidence: number
  source: BookmarkTagSource
  model: string
  extraction: BookmarkTagExtraction
  generatedAt: number
  updatedAt: number
}

export interface BookmarkTagIndex {
  version: 1
  updatedAt: number
  records: Record<string, BookmarkTagRecord>
}

export interface BookmarkTagAnalysisInput {
  summary?: unknown
  contentType?: unknown
  content_type?: unknown
  topics?: unknown
  tags?: unknown
  aliases?: unknown
  confidence?: unknown
  model?: unknown
  extraction?: unknown
}

export interface BookmarkTagBuildInput {
  bookmark: Partial<BookmarkRecord> & {
    id?: unknown
    bookmarkId?: unknown
    title?: unknown
    url?: unknown
    path?: unknown
  }
  analysis: BookmarkTagAnalysisInput
  source: BookmarkTagSource
  model?: unknown
  extraction?: unknown
  now?: number
}

export interface BookmarkTagImportPayload {
  app?: string
  version?: number
  exportedAt?: number
  records?: unknown
}

export interface BookmarkTagImportResult {
  index: BookmarkTagIndex
  added: number
  overwritten: number
  skipped: number
  unmatched: number
}

export type BatchManualTagOperationType = 'add' | 'remove' | 'rename' | 'merge'

export interface BatchManualTagOperation {
  type: BatchManualTagOperationType
  bookmarkIds?: unknown
  tags?: unknown
  fromTag?: unknown
  toTag?: unknown
  now?: number
}

export interface BatchManualTagChange {
  bookmarkId: string
  title: string
  url: string
  before: string[]
  after: string[]
}

export interface BatchManualTagUpdateResult {
  index: BookmarkTagIndex
  changed: BatchManualTagChange[]
  unchanged: number
  missing: number
}

export interface BookmarkTagUsageStat {
  tag: string
  effectiveCount: number
  manualCount: number
  aiCount: number
  bookmarkIds: string[]
}

export interface BookmarkTagUsageSummary {
  stats: BookmarkTagUsageStat[]
  totalBookmarks: number
  taggedBookmarks: number
  untaggedBookmarks: number
  manualTaggedBookmarks: number
  aiOnlyTaggedBookmarks: number
}

export function createEmptyBookmarkTagIndex(updatedAt = 0): BookmarkTagIndex {
  return {
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt,
    records: {}
  }
}

export function normalizeBookmarkTagIndex(rawIndex: unknown): BookmarkTagIndex {
  const source = rawIndex && typeof rawIndex === 'object'
    ? rawIndex as { updatedAt?: unknown; records?: unknown }
    : {}
  const rawRecords = source.records && typeof source.records === 'object'
    ? source.records as Record<string, unknown>
    : {}
  const records: Record<string, BookmarkTagRecord> = {}

  for (const [fallbackBookmarkId, rawRecord] of Object.entries(rawRecords)) {
    const record = normalizeBookmarkTagRecord(rawRecord, { bookmarkId: fallbackBookmarkId })
    if (record) {
      records[record.bookmarkId] = record
    }
  }

  return {
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt: normalizeTimestamp(source.updatedAt) || latestRecordUpdatedAt(records) || 0,
    records
  }
}

export function normalizeBookmarkTagRecord(
  rawRecord: unknown,
  fallback: Partial<BookmarkTagRecord> = {}
): BookmarkTagRecord | null {
  const source = rawRecord && typeof rawRecord === 'object'
    ? rawRecord as Record<string, unknown>
    : {}
  const bookmarkId = cleanText(source.bookmarkId ?? fallback.bookmarkId)
  const url = cleanText(source.url ?? fallback.url)

  if (!bookmarkId || !url) {
    return null
  }

  const normalizedUrl = normalizeBookmarkTagUrl(source.normalizedUrl ?? url)
  const duplicateKey = cleanText(source.duplicateKey) || buildBookmarkTagDuplicateKey(normalizedUrl || url)
  const generatedAt = normalizeTimestamp(source.generatedAt ?? fallback.generatedAt) || Date.now()
  const updatedAt = normalizeTimestamp(source.updatedAt ?? fallback.updatedAt) || generatedAt
  const hasManualTags = hasOwn(source, 'manualTags') || fallback.manualTags !== undefined
  const manualUpdatedAt = normalizeTimestamp(source.manualUpdatedAt ?? fallback.manualUpdatedAt) || updatedAt

  const record: BookmarkTagRecord = {
    schemaVersion: BOOKMARK_TAG_SCHEMA_VERSION,
    bookmarkId,
    url,
    normalizedUrl,
    duplicateKey,
    title: cleanText(source.title ?? fallback.title, 180),
    path: cleanText(source.path ?? fallback.path, 240),
    summary: cleanText(source.summary ?? fallback.summary, BOOKMARK_TAG_SUMMARY_LIMIT),
    contentType: cleanText(source.contentType ?? source.content_type ?? fallback.contentType, BOOKMARK_TAG_FIELD_LIMIT),
    topics: normalizeTagTextList(source.topics ?? fallback.topics, BOOKMARK_TAG_TOPICS_LIMIT, BOOKMARK_TAG_FIELD_LIMIT),
    tags: normalizeBookmarkTags(source.tags ?? fallback.tags),
    aliases: normalizeTagTextList(source.aliases ?? fallback.aliases, BOOKMARK_TAG_ALIASES_LIMIT, BOOKMARK_TAG_FIELD_LIMIT),
    confidence: normalizeBookmarkTagConfidence(source.confidence ?? fallback.confidence),
    source: normalizeBookmarkTagSource(source.source ?? fallback.source),
    model: cleanText(source.model ?? fallback.model, 120),
    extraction: normalizeBookmarkTagExtraction(source.extraction ?? fallback.extraction),
    generatedAt,
    updatedAt
  }

  if (hasManualTags) {
    const manualTags = normalizeBookmarkTags(source.manualTags ?? fallback.manualTags)
    if (manualTags.length) {
      record.manualTags = manualTags
      record.manualUpdatedAt = manualUpdatedAt
    }
  }

  return record
}

export function buildBookmarkTagRecord({
  bookmark,
  analysis,
  source,
  model = '',
  extraction = null,
  now = Date.now()
}: BookmarkTagBuildInput): BookmarkTagRecord | null {
  const bookmarkId = cleanText(bookmark.bookmarkId ?? bookmark.id)
  const url = cleanText(bookmark.url)
  if (!bookmarkId || !url) {
    return null
  }

  return normalizeBookmarkTagRecord({
    schemaVersion: BOOKMARK_TAG_SCHEMA_VERSION,
    bookmarkId,
    url,
    normalizedUrl: normalizeBookmarkTagUrl(url),
    duplicateKey: buildBookmarkTagDuplicateKey(url),
    title: bookmark.title,
    path: bookmark.path,
    summary: analysis.summary,
    contentType: analysis.contentType ?? analysis.content_type,
    topics: analysis.topics,
    tags: analysis.tags,
    aliases: analysis.aliases,
    confidence: analysis.confidence,
    source,
    model: model || analysis.model,
    extraction: extraction || analysis.extraction,
    generatedAt: now,
    updatedAt: now
  })
}

export function hasUsefulBookmarkTagData(record: BookmarkTagRecord | null): record is BookmarkTagRecord {
  return Boolean(
    record &&
    (
      record.summary ||
      record.contentType ||
      record.topics.length ||
      record.tags.length ||
      Boolean(record.manualTags?.length) ||
      record.aliases.length
    )
  )
}

export function getEffectiveBookmarkTags(record: BookmarkTagRecord | null | undefined): string[] {
  if (!record) {
    return []
  }

  const manualTags = normalizeBookmarkTags(record.manualTags)
  if (manualTags.length) {
    return manualTags
  }

  return normalizeBookmarkTags(record.tags)
}

export function buildBookmarkTagUsageSummary(
  index: BookmarkTagIndex | null | undefined,
  bookmarks: Array<Partial<BookmarkRecord> & { id?: unknown }> = []
): BookmarkTagUsageSummary {
  const normalizedIndex = normalizeBookmarkTagIndex(index)
  const bookmarkIds = new Set(bookmarks.map((bookmark) => cleanText(bookmark.id)).filter(Boolean))
  const records = bookmarkIds.size
    ? [...bookmarkIds].map((bookmarkId) => normalizedIndex.records[bookmarkId]).filter(Boolean)
    : Object.values(normalizedIndex.records)
  const statMap = new Map<string, BookmarkTagUsageStat>()
  let taggedBookmarks = 0
  let manualTaggedBookmarks = 0
  let aiOnlyTaggedBookmarks = 0

  for (const record of records) {
    const manualTags = normalizeBookmarkTags(record.manualTags)
    const aiTags = normalizeBookmarkTags(record.tags)
    const effectiveTags = getEffectiveBookmarkTags(record)
    const hasManualTags = manualTags.length > 0
    if (effectiveTags.length) {
      taggedBookmarks += 1
    }
    if (hasManualTags) {
      manualTaggedBookmarks += 1
    } else if (aiTags.length) {
      aiOnlyTaggedBookmarks += 1
    }

    for (const tag of effectiveTags) {
      const key = tag.toLowerCase()
      const stat = statMap.get(key) || {
        tag,
        effectiveCount: 0,
        manualCount: 0,
        aiCount: 0,
        bookmarkIds: []
      }
      stat.effectiveCount += 1
      stat.bookmarkIds.push(record.bookmarkId)
      if (hasManualTags) {
        stat.manualCount += 1
      } else {
        stat.aiCount += 1
      }
      statMap.set(key, stat)
    }
  }

  const totalBookmarks = bookmarkIds.size || records.length
  return {
    stats: [...statMap.values()].sort((left, right) => {
      return right.effectiveCount - left.effectiveCount || left.tag.localeCompare(right.tag, 'zh-Hans-CN')
    }),
    totalBookmarks,
    taggedBookmarks,
    untaggedBookmarks: Math.max(totalBookmarks - taggedBookmarks, 0),
    manualTaggedBookmarks,
    aiOnlyTaggedBookmarks
  }
}

export function getUntaggedBookmarkIds(
  index: BookmarkTagIndex | null | undefined,
  bookmarks: Array<Partial<BookmarkRecord> & { id?: unknown }> = []
): string[] {
  const normalizedIndex = normalizeBookmarkTagIndex(index)
  return bookmarks
    .filter((bookmark) => {
      const bookmarkId = cleanText(bookmark.id)
      return bookmarkId && !getEffectiveBookmarkTags(normalizedIndex.records[bookmarkId]).length
    })
    .map((bookmark) => cleanText(bookmark.id))
}

export function applyBatchManualTagOperation(
  currentIndex: BookmarkTagIndex | null | undefined,
  bookmarks: Array<Partial<BookmarkRecord> & { id?: unknown; title?: unknown; url?: unknown; path?: unknown }>,
  operation: BatchManualTagOperation
): BatchManualTagUpdateResult {
  const current = normalizeBookmarkTagIndex(currentIndex)
  const bookmarkMap = new Map<string, Partial<BookmarkRecord> & { id?: unknown; title?: unknown; url?: unknown; path?: unknown }>()
  for (const bookmark of bookmarks) {
    const id = cleanText(bookmark.id)
    if (id) {
      bookmarkMap.set(id, bookmark)
    }
  }

  const requestedIds = normalizeBookmarkTagIds(operation.bookmarkIds)
  const targetIds = requestedIds.length ? requestedIds : [...bookmarkMap.keys()]
  const nextRecords = { ...current.records }
  const changed: BatchManualTagChange[] = []
  let unchanged = 0
  let missing = 0
  const now = normalizeTimestamp(operation.now) || Date.now()

  const addTags = normalizeBookmarkTags(operation.tags)
  const fromTags = normalizeBookmarkTags(operation.fromTag)
  const toTags = normalizeBookmarkTags(operation.toTag)
  const fromTag = fromTags[0] || ''
  const toTag = toTags[0] || ''

  for (const bookmarkId of targetIds) {
    const bookmark = bookmarkMap.get(bookmarkId)
    if (!bookmark) {
      missing += 1
      continue
    }

    const existingRecord = nextRecords[bookmarkId] || null
    const currentManualTags = normalizeBookmarkTags(existingRecord?.manualTags)
    const baseTags = currentManualTags.length
      ? currentManualTags
      : operation.type === 'remove'
        ? []
        : getEffectiveBookmarkTags(existingRecord)
    const nextManualTags = applyManualTagListOperation(baseTags, {
      type: operation.type,
      addTags,
      fromTag,
      toTag
    })

    if (sameTagList(currentManualTags, nextManualTags)) {
      unchanged += 1
      continue
    }

    const nextRecord = buildManualTagBatchRecord(bookmark, existingRecord, nextManualTags, now)
    if (hasUsefulBookmarkTagData(nextRecord)) {
      nextRecords[bookmarkId] = nextRecord
    } else {
      delete nextRecords[bookmarkId]
    }
    changed.push({
      bookmarkId,
      title: cleanText(bookmark.title, 180) || existingRecord?.title || '未命名书签',
      url: cleanText(bookmark.url) || existingRecord?.url || '',
      before: currentManualTags,
      after: nextManualTags
    })
  }

  const index: BookmarkTagIndex = {
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt: now,
    records: nextRecords
  }
  assertBookmarkTagIndexWithinQuota(index)
  return {
    index,
    changed,
    unchanged,
    missing
  }
}

export function normalizeBookmarkTagUrl(value: unknown): string {
  const rawUrl = cleanText(value)
  try {
    const parsedUrl = new URL(rawUrl)
    parsedUrl.hostname = parsedUrl.hostname.toLowerCase()
    parsedUrl.hash = ''

    for (const key of [...parsedUrl.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase()
      if (normalizedKey.startsWith('utm_') || TRACKING_PARAM_NAMES.has(normalizedKey)) {
        parsedUrl.searchParams.delete(key)
      }
    }

    const normalized = parsedUrl.toString().replace(/\/(?=$|\?)/, '')
    return normalized
  } catch {
    return rawUrl
      .replace(/#.*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
  }
}

export function buildBookmarkTagDuplicateKey(value: unknown): string {
  return normalizeBookmarkTagUrl(value)
}

export function normalizeBookmarkTagConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normalizeNumericConfidence(value)
  }

  const rawText = String(value ?? '').trim().toLowerCase()
  if (!rawText) {
    return 0
  }

  const fractionMatch = rawText.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*100$/)
  if (fractionMatch) {
    return clampConfidence(Number(fractionMatch[1]) / 100)
  }

  const percentMatch = rawText.match(/^(-?\d+(?:\.\d+)?)\s*%$/)
  if (percentMatch) {
    return clampConfidence(Number(percentMatch[1]) / 100)
  }

  const numeric = Number(rawText)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return normalizeNumericConfidence(numeric)
}

export function normalizeTagTextList(rawList: unknown, limit: number, itemLimit = BOOKMARK_TAG_FIELD_LIMIT): string[] {
  const values = Array.isArray(rawList)
    ? rawList
    : typeof rawList === 'string'
      ? rawList.split(/[,，、\n]/)
      : []
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const text = cleanText(value, itemLimit)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= limit) {
      break
    }
  }

  return output
}

export function normalizeBookmarkTags(rawList: unknown, limit = BOOKMARK_TAG_TAGS_LIMIT): string[] {
  const values = Array.isArray(rawList)
    ? rawList
    : typeof rawList === 'string'
      ? rawList.split(/[,，、\n]/)
      : []
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const candidates = splitCompositeTag(value)
    for (const candidate of candidates) {
      const text = cleanShortTag(candidate)
      const key = text.toLowerCase()
      if (!text || seen.has(key)) {
        continue
      }
      seen.add(key)
      output.push(text)
      if (output.length >= limit) {
        return output
      }
    }
  }

  return output
}

export function estimateJsonSizeBytes(value: unknown): number {
  const json = JSON.stringify(value)
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length
  }
  return json.length
}

export function assertBookmarkTagIndexWithinQuota(index: BookmarkTagIndex): void {
  const size = estimateJsonSizeBytes({
    [STORAGE_KEYS.bookmarkTagIndex]: index
  })
  if (size > BOOKMARK_TAG_INDEX_SAFE_BYTES) {
    throw new Error('标签库数据过大，已阻止写入。请先导出或清理标签数据后重试。')
  }
}

export async function loadBookmarkTagIndex(): Promise<BookmarkTagIndex> {
  const stored = await getLocalStorage([STORAGE_KEYS.bookmarkTagIndex])
  return normalizeBookmarkTagIndex(stored[STORAGE_KEYS.bookmarkTagIndex])
}

export async function saveBookmarkTagIndex(index: BookmarkTagIndex): Promise<BookmarkTagIndex> {
  const normalized = normalizeBookmarkTagIndex({
    ...index,
    updatedAt: Date.now()
  })
  assertBookmarkTagIndexWithinQuota(normalized)
  await setLocalStorage({
    [STORAGE_KEYS.bookmarkTagIndex]: normalized
  })
  return normalized
}

export async function clearBookmarkTagIndex(): Promise<void> {
  await removeLocalStorage(STORAGE_KEYS.bookmarkTagIndex)
}

export async function upsertBookmarkTagRecord(record: BookmarkTagRecord): Promise<BookmarkTagIndex> {
  const normalizedRecord = normalizeBookmarkTagRecord(record)
  if (!hasUsefulBookmarkTagData(normalizedRecord)) {
    return loadBookmarkTagIndex()
  }

  const current = await loadBookmarkTagIndex()
  const existingRecord = current.records[normalizedRecord.bookmarkId]
  const now = Date.now()
  const nextRecord: BookmarkTagRecord = {
    ...normalizedRecord,
    updatedAt: now
  }
  if (existingRecord?.manualTags?.length && normalizedRecord.manualTags === undefined) {
    nextRecord.manualTags = existingRecord.manualTags
    nextRecord.manualUpdatedAt = existingRecord.manualUpdatedAt
  }
  const nextIndex: BookmarkTagIndex = {
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt: now,
    records: {
      ...current.records,
      [normalizedRecord.bookmarkId]: nextRecord
    }
  }

  return saveBookmarkTagIndex(nextIndex)
}

export async function upsertBookmarkTagFromAnalysis(input: BookmarkTagBuildInput): Promise<BookmarkTagRecord | null> {
  const record = buildBookmarkTagRecord(input)
  if (!hasUsefulBookmarkTagData(record)) {
    return null
  }

  const index = await upsertBookmarkTagRecord(record)
  return index.records[record.bookmarkId] || null
}

export async function saveManualBookmarkTags(
  bookmark: Partial<BookmarkRecord> & { id?: unknown; title?: unknown; url?: unknown; path?: unknown },
  rawTags: unknown,
  now = Date.now()
): Promise<BookmarkTagIndex> {
  const bookmarkId = cleanText(bookmark.id)
  const url = cleanText(bookmark.url)
  if (!bookmarkId || !url) {
    throw new Error('无法保存标签：书签信息不完整。')
  }

  const current = await loadBookmarkTagIndex()
  const existingRecord = current.records[bookmarkId]
  const manualTags = normalizeBookmarkTags(rawTags)
  if (!manualTags.length) {
    return clearManualBookmarkTags(bookmarkId)
  }
  const baseRecord = existingRecord || normalizeBookmarkTagRecord({
    schemaVersion: BOOKMARK_TAG_SCHEMA_VERSION,
    bookmarkId,
    url,
    normalizedUrl: normalizeBookmarkTagUrl(url),
    duplicateKey: buildBookmarkTagDuplicateKey(url),
    title: bookmark.title,
    path: bookmark.path,
    summary: '',
    contentType: '',
    topics: [],
    tags: [],
    aliases: [],
    confidence: 0,
    source: 'manual',
    model: '',
    extraction: { status: '', source: '', warnings: [] },
    generatedAt: now,
    updatedAt: now
  })
  if (!baseRecord) {
    throw new Error('无法保存标签：标签记录无效。')
  }

  const normalizedRecord = normalizeBookmarkTagRecord({
    ...baseRecord,
    bookmarkId,
    url,
    normalizedUrl: normalizeBookmarkTagUrl(url),
    duplicateKey: buildBookmarkTagDuplicateKey(url),
    title: cleanText(bookmark.title) || baseRecord?.title,
    path: cleanText(bookmark.path) || baseRecord?.path,
    source: existingRecord?.source || 'manual',
    manualTags,
    manualUpdatedAt: now,
    updatedAt: now
  })

  if (!normalizedRecord) {
    throw new Error('无法保存标签：标签记录无效。')
  }

  return saveBookmarkTagIndex({
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt: now,
    records: {
      ...current.records,
      [bookmarkId]: normalizedRecord
    }
  })
}

export async function clearManualBookmarkTags(bookmarkId: unknown): Promise<BookmarkTagIndex> {
  const id = cleanText(bookmarkId)
  const current = await loadBookmarkTagIndex()
  const existingRecord = id ? current.records[id] : null
  if (!id || !existingRecord || existingRecord.manualTags === undefined) {
    return current
  }

  const {
    manualTags: _manualTags,
    manualUpdatedAt: _manualUpdatedAt,
    ...recordWithoutManualTags
  } = existingRecord
  const nextRecord = normalizeBookmarkTagRecord({
    ...recordWithoutManualTags,
    updatedAt: Date.now()
  })
  const nextRecords = { ...current.records }
  if (hasUsefulBookmarkTagData(nextRecord)) {
    nextRecords[id] = nextRecord
  } else {
    delete nextRecords[id]
  }

  return saveBookmarkTagIndex({
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt: Date.now(),
    records: nextRecords
  })
}

export async function clearAiBookmarkTags(bookmarkId: unknown): Promise<BookmarkTagIndex> {
  const id = cleanText(bookmarkId)
  const current = await loadBookmarkTagIndex()
  const existingRecord = id ? current.records[id] : null
  if (!id || !existingRecord) {
    return current
  }

  const nextRecord = normalizeBookmarkTagRecord({
    ...existingRecord,
    tags: [],
    updatedAt: Date.now()
  })
  const nextRecords = { ...current.records }
  if (hasUsefulBookmarkTagData(nextRecord)) {
    nextRecords[id] = nextRecord
  } else {
    delete nextRecords[id]
  }

  return saveBookmarkTagIndex({
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt: Date.now(),
    records: nextRecords
  })
}

export async function removeBookmarkTagRecord(bookmarkId: unknown): Promise<BookmarkTagIndex> {
  const id = cleanText(bookmarkId)
  const current = await loadBookmarkTagIndex()
  if (!id || !current.records[id]) {
    return current
  }

  const nextRecords = { ...current.records }
  delete nextRecords[id]

  return saveBookmarkTagIndex({
    version: BOOKMARK_TAG_INDEX_VERSION,
    updatedAt: Date.now(),
    records: nextRecords
  })
}

export function buildBookmarkTagExport(
  index: BookmarkTagIndex,
  bookmarks: Array<Partial<BookmarkRecord> & { id?: unknown }> = []
): { app: 'curator-bookmarks'; version: 1; exportedAt: number; records: BookmarkTagRecord[] } {
  const validBookmarkIds = new Set(bookmarks.map((bookmark) => cleanText(bookmark.id)).filter(Boolean))
  const records = Object.values(index.records)
    .filter((record) => !validBookmarkIds.size || validBookmarkIds.has(record.bookmarkId))
    .map((record) => normalizeBookmarkTagRecord(record))
    .filter(Boolean) as BookmarkTagRecord[]

  return {
    app: 'curator-bookmarks',
    version: BOOKMARK_TAG_INDEX_VERSION,
    exportedAt: Date.now(),
    records
  }
}

export function mergeBookmarkTagImport(
  currentIndex: BookmarkTagIndex,
  payload: unknown,
  bookmarks: Array<Partial<BookmarkRecord> & { id?: unknown; url?: unknown; title?: unknown; path?: unknown }>
): BookmarkTagImportResult {
  const current = normalizeBookmarkTagIndex(currentIndex)
  const bookmarkMatch = buildBookmarkMatchMaps(bookmarks)
  const rawRecords = normalizeBookmarkTagImportRecords(payload)
  const nextRecords = { ...current.records }
  const result: BookmarkTagImportResult = {
    index: {
      version: BOOKMARK_TAG_INDEX_VERSION,
      updatedAt: Date.now(),
      records: nextRecords
    },
    added: 0,
    overwritten: 0,
    skipped: 0,
    unmatched: 0
  }

  for (const rawRecord of rawRecords) {
    const importedRecord = normalizeBookmarkTagRecord(rawRecord)
    if (!importedRecord) {
      result.skipped += 1
      continue
    }

    const matchedBookmark = findImportMatchedBookmark(importedRecord, bookmarkMatch)
    if (!matchedBookmark) {
      result.unmatched += 1
      continue
    }

    const bookmarkId = cleanText(matchedBookmark.id)
    const existing = nextRecords[bookmarkId]
    if (existing && importedRecord.updatedAt <= existing.updatedAt) {
      result.skipped += 1
      continue
    }

    const normalizedRecord = normalizeBookmarkTagRecord({
      ...importedRecord,
      bookmarkId,
      url: cleanText(matchedBookmark.url) || importedRecord.url,
      normalizedUrl: normalizeBookmarkTagUrl(cleanText(matchedBookmark.url) || importedRecord.url),
      duplicateKey: buildBookmarkTagDuplicateKey(cleanText(matchedBookmark.url) || importedRecord.url),
      title: cleanText(matchedBookmark.title) || importedRecord.title,
      path: cleanText(matchedBookmark.path) || importedRecord.path,
      source: 'imported'
    })

    if (!normalizedRecord) {
      result.skipped += 1
      continue
    }

    nextRecords[bookmarkId] = normalizedRecord
    if (existing) {
      result.overwritten += 1
    } else {
      result.added += 1
    }
  }

  result.index.updatedAt = Date.now()
  assertBookmarkTagIndexWithinQuota(result.index)
  return result
}

function normalizeBookmarkTagImportRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  const source = payload && typeof payload === 'object'
    ? payload as BookmarkTagImportPayload
    : {}
  return Array.isArray(source.records) ? source.records : []
}

function buildBookmarkMatchMaps(
  bookmarks: Array<Partial<BookmarkRecord> & { id?: unknown; url?: unknown }>
): {
  byId: Map<string, Partial<BookmarkRecord> & { id?: unknown; url?: unknown }>
  byNormalizedUrl: Map<string, Partial<BookmarkRecord> & { id?: unknown; url?: unknown }>
  byDuplicateKey: Map<string, Partial<BookmarkRecord> & { id?: unknown; url?: unknown }>
} {
  const byId = new Map()
  const byNormalizedUrl = new Map()
  const byDuplicateKey = new Map()

  for (const bookmark of bookmarks) {
    const id = cleanText(bookmark.id)
    const url = cleanText(bookmark.url)
    if (!id || !url) {
      continue
    }
    byId.set(id, bookmark)
    byNormalizedUrl.set(normalizeBookmarkTagUrl(url), bookmark)
    byDuplicateKey.set(buildBookmarkTagDuplicateKey(url), bookmark)
  }

  return { byId, byNormalizedUrl, byDuplicateKey }
}

function findImportMatchedBookmark(
  record: BookmarkTagRecord,
  maps: ReturnType<typeof buildBookmarkMatchMaps>
): (Partial<BookmarkRecord> & { id?: unknown; url?: unknown }) | null {
  return maps.byId.get(record.bookmarkId) ||
    maps.byNormalizedUrl.get(record.normalizedUrl) ||
    maps.byDuplicateKey.get(record.duplicateKey) ||
    null
}

function normalizeBookmarkTagIds(value: unknown): string[] {
  const rawIds = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const rawId of rawIds) {
    const id = cleanText(rawId)
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function applyManualTagListOperation(
  currentTags: string[],
  operation: {
    type: BatchManualTagOperationType
    addTags: string[]
    fromTag: string
    toTag: string
  }
): string[] {
  if (operation.type === 'add') {
    return normalizeBookmarkTags([...currentTags, ...operation.addTags])
  }

  if (operation.type === 'remove') {
    const removeKeys = new Set(operation.addTags.map((tag) => tag.toLowerCase()))
    return normalizeBookmarkTags(currentTags.filter((tag) => !removeKeys.has(tag.toLowerCase())))
  }

  if ((operation.type === 'rename' || operation.type === 'merge') && operation.fromTag && operation.toTag) {
    const fromKey = operation.fromTag.toLowerCase()
    const nextTags = currentTags.map((tag) => {
      return tag.toLowerCase() === fromKey ? operation.toTag : tag
    })
    return normalizeBookmarkTags(nextTags)
  }

  return normalizeBookmarkTags(currentTags)
}

function sameTagList(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  return left.every((tag, index) => tag.toLowerCase() === right[index].toLowerCase())
}

function buildManualTagBatchRecord(
  bookmark: Partial<BookmarkRecord> & { id?: unknown; title?: unknown; url?: unknown; path?: unknown },
  existingRecord: BookmarkTagRecord | null,
  manualTags: string[],
  now: number
): BookmarkTagRecord | null {
  const bookmarkId = cleanText(bookmark.id)
  const url = cleanText(bookmark.url) || existingRecord?.url || ''
  if (!bookmarkId || !url) {
    return null
  }

  const baseRecord = existingRecord || normalizeBookmarkTagRecord({
    schemaVersion: BOOKMARK_TAG_SCHEMA_VERSION,
    bookmarkId,
    url,
    normalizedUrl: normalizeBookmarkTagUrl(url),
    duplicateKey: buildBookmarkTagDuplicateKey(url),
    title: bookmark.title,
    path: bookmark.path,
    summary: '',
    contentType: '',
    topics: [],
    tags: [],
    aliases: [],
    confidence: 0,
    source: 'manual',
    model: '',
    extraction: { status: '', source: '', warnings: [] },
    generatedAt: now,
    updatedAt: now
  })
  if (!baseRecord) {
    return null
  }

  if (!manualTags.length) {
    const {
      manualTags: _manualTags,
      manualUpdatedAt: _manualUpdatedAt,
      ...recordWithoutManualTags
    } = baseRecord
    return normalizeBookmarkTagRecord({
      ...recordWithoutManualTags,
      title: cleanText(bookmark.title, 180) || baseRecord.title,
      path: cleanText(bookmark.path, 240) || baseRecord.path,
      updatedAt: now
    })
  }

  return normalizeBookmarkTagRecord({
    ...baseRecord,
    bookmarkId,
    url,
    normalizedUrl: normalizeBookmarkTagUrl(url),
    duplicateKey: buildBookmarkTagDuplicateKey(url),
    title: cleanText(bookmark.title, 180) || baseRecord.title,
    path: cleanText(bookmark.path, 240) || baseRecord.path,
    manualTags,
    manualUpdatedAt: now,
    updatedAt: now
  })
}

function normalizeBookmarkTagSource(value: unknown): BookmarkTagSource {
  const source = String(value || '').trim()
  if (
    source === 'ai_naming' ||
    source === 'auto_analyze' ||
    source === 'popup_smart' ||
    source === 'imported' ||
    source === 'manual'
  ) {
    return source
  }
  return 'imported'
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function normalizeBookmarkTagExtraction(value: unknown): BookmarkTagExtraction {
  const source = value && typeof value === 'object'
    ? value as { status?: unknown; source?: unknown; warnings?: unknown }
    : {}

  return {
    status: cleanText(source.status, 40),
    source: cleanText(source.source, 80),
    warnings: normalizeTagTextList(source.warnings, 4)
  }
}

function splitCompositeTag(value: unknown): string[] {
  const text = cleanText(value, 120)
    .replace(/^#+/, '')
    .replace(/^标签\s*[:：]\s*/i, '')
  if (!text) {
    return []
  }

  const rawPieces = /[,，、/|;；]/.test(text)
    ? text.split(/[,，、/|;；]+/)
    : [text]
  const pieces: string[] = []

  for (const piece of rawPieces) {
    const normalizedPiece = cleanText(piece, 80)
    if (!normalizedPiece) {
      continue
    }

    const compatibilityMatches = [...normalizedPiece.matchAll(/([A-Za-z0-9.+#-]+|[\u3400-\u9fff]{2,})\s*兼容/g)]
      .map((match) => `${match[1].trim()} 兼容`)
    if (compatibilityMatches.length >= 2) {
      pieces.push(...compatibilityMatches)
      continue
    }

    if (normalizedPiece.length >= 7 && /[与和及]/.test(normalizedPiece)) {
      pieces.push(...normalizedPiece.split(/[与和及]+/))
    } else {
      pieces.push(normalizedPiece)
    }
  }

  const expandedPieces: string[] = []
  for (const piece of pieces) {
    const textPiece = cleanText(piece, 80)
    if (!textPiece) {
      continue
    }

    if (textPiece.endsWith('博客') && textPiece.length > 4) {
      expandedPieces.push(textPiece.slice(0, -2), '博客')
      continue
    }

    expandedPieces.push(textPiece)
  }

  return expandedPieces
}

function cleanShortTag(value: unknown): string {
  let text = cleanText(value, 80)
    .replace(/^#+/, '')
    .replace(/^标签\s*[:：]\s*/i, '')
    .replace(/^(关于|有关)\s*/, '')
    .replace(/[。.!！?？]+$/g, '')
    .trim()

  if (!text || GENERIC_TAG_VALUES.has(text)) {
    return ''
  }

  if (looksLikeDescriptionTag(text)) {
    return ''
  }

  const words = text.split(/\s+/).filter(Boolean)
  if (/^[\x00-\x7F\s]+$/.test(text) && words.length > 3) {
    text = words.slice(0, 3).join(' ')
  }

  return cleanText(text, BOOKMARK_TAG_TAG_TEXT_LIMIT)
}

function looksLikeDescriptionTag(value: string): boolean {
  const text = String(value || '').trim()
  if (text.length < 14) {
    return false
  }

  return /^(一个|一种|用于|提供|支持|关于|记录|介绍)/.test(text) ||
    /[，。；：,.!?]/.test(text) ||
    /(页面|内容|文章).*(工具|服务|功能|系统)/.test(text)
}

function normalizeTimestamp(value: unknown): number {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

function latestRecordUpdatedAt(records: Record<string, BookmarkTagRecord>): number {
  return Object.values(records).reduce((latest, record) => {
    return Math.max(latest, Number(record.updatedAt) || 0)
  }, 0)
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(value, 1))
}

function normalizeNumericConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value > 1 && value <= 100) {
    return clampConfidence(value / 100)
  }
  return clampConfidence(value)
}

function cleanText(value: unknown, limit = 1000): string {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length <= limit ? text : text.slice(0, limit).trim()
}
