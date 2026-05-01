import { createBookmarkIdentity } from '../../shared/bookmark-identity.js'
import { STORAGE_KEYS } from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { buildDuplicateKey } from '../../shared/text.js'
import type {
  AvailabilityResult,
  AvailabilityStatus,
  BookmarkRecord
} from '../../shared/types.js'
import { normalizeHistoryRunScope } from '../shared-options/state.js'
import { isRedirectedNavigation } from './classifier.js'

export const PENDING_AVAILABILITY_SNAPSHOT_VERSION = 1

export interface PendingAvailabilityResultSnapshot {
  id: string
  identity: string
  fingerprint: string
  title: string
  url: string
  finalUrl: string
  path: string
  parentId: string
  index: number
  ancestorIds: string[]
  status: Exclude<AvailabilityStatus, 'available'>
  badgeText: string
  detail: string
  historyStatus: 'new' | 'persistent' | ''
  abnormalStreak: number
}

export interface PendingAvailabilitySnapshot {
  version: typeof PENDING_AVAILABILITY_SNAPSHOT_VERSION
  savedAt: number
  completedAt: number
  runOutcome: string
  probeEnabled: boolean
  scope: ReturnType<typeof normalizeHistoryRunScope>
  summary: {
    checkedBookmarks: number
    availableCount: number
    redirectedCount: number
    reviewCount: number
    failedCount: number
    ignoredCount: number
  }
  results: {
    review: PendingAvailabilityResultSnapshot[]
    failed: PendingAvailabilityResultSnapshot[]
    redirected: PendingAvailabilityResultSnapshot[]
  }
}

export interface ReconciledPendingAvailabilitySnapshot {
  reviewResults: AvailabilityResult[]
  failedResults: AvailabilityResult[]
  redirectResults: AvailabilityResult[]
  currentHistoryEntries: Array<{
    id: string
    title: string
    url: string
    path: string
    status: 'review' | 'failed'
    streak: number
  }>
  droppedCount: number
  matchedCount: number
}

export function normalizePendingAvailabilitySnapshot(rawSnapshot: unknown): PendingAvailabilitySnapshot | null {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') {
    return null
  }

  const snapshot = rawSnapshot as Record<string, unknown>
  const results = snapshot.results && typeof snapshot.results === 'object'
    ? snapshot.results as Record<string, unknown>
    : {}

  return {
    version: PENDING_AVAILABILITY_SNAPSHOT_VERSION,
    savedAt: Number(snapshot.savedAt) || 0,
    completedAt: Number(snapshot.completedAt) || 0,
    runOutcome: String(snapshot.runOutcome || ''),
    probeEnabled: snapshot.probeEnabled === true,
    scope: normalizeHistoryRunScope(snapshot.scope),
    summary: normalizePendingSummary(snapshot.summary),
    results: {
      review: normalizePendingResultArray(results.review, 'review'),
      failed: normalizePendingResultArray(results.failed, 'failed'),
      redirected: normalizePendingResultArray(results.redirected, 'redirected')
    }
  }
}

export function buildPendingAvailabilitySnapshot({
  reviewResults = [],
  failedResults = [],
  redirectResults = [],
  scope = normalizeHistoryRunScope(),
  savedAt = Date.now(),
  completedAt = 0,
  runOutcome = '',
  probeEnabled = false,
  summary = {}
}: {
  reviewResults?: AvailabilityResult[]
  failedResults?: AvailabilityResult[]
  redirectResults?: AvailabilityResult[]
  scope?: ReturnType<typeof normalizeHistoryRunScope>
  savedAt?: number
  completedAt?: number
  runOutcome?: string
  probeEnabled?: boolean
  summary?: Partial<PendingAvailabilitySnapshot['summary']>
} = {}): PendingAvailabilitySnapshot {
  const normalizedSummary = normalizePendingSummary(summary)

  return {
    version: PENDING_AVAILABILITY_SNAPSHOT_VERSION,
    savedAt,
    completedAt,
    runOutcome,
    probeEnabled,
    scope: normalizeHistoryRunScope(scope),
    summary: {
      ...normalizedSummary,
      redirectedCount: redirectResults.length,
      reviewCount: reviewResults.length,
      failedCount: failedResults.length
    },
    results: {
      review: reviewResults.map((result) => serializePendingResult(result, 'review')),
      failed: failedResults.map((result) => serializePendingResult(result, 'failed')),
      redirected: redirectResults.map((result) => serializePendingResult(result, 'redirected'))
    }
  }
}

function normalizePendingSummary(summary: unknown): PendingAvailabilitySnapshot['summary'] {
  if (!summary || typeof summary !== 'object') {
    return {
      checkedBookmarks: 0,
      availableCount: 0,
      redirectedCount: 0,
      reviewCount: 0,
      failedCount: 0,
      ignoredCount: 0
    }
  }

  const value = summary as Record<string, unknown>
  return {
    checkedBookmarks: Math.max(0, Number(value.checkedBookmarks) || 0),
    availableCount: Math.max(0, Number(value.availableCount) || 0),
    redirectedCount: Math.max(0, Number(value.redirectedCount) || 0),
    reviewCount: Math.max(0, Number(value.reviewCount) || 0),
    failedCount: Math.max(0, Number(value.failedCount) || 0),
    ignoredCount: Math.max(0, Number(value.ignoredCount) || 0)
  }
}

export async function savePendingAvailabilitySnapshot(snapshot: PendingAvailabilitySnapshot): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.pendingAvailabilityResults]: snapshot
  })
}

export function reconcilePendingAvailabilitySnapshot(
  snapshot: PendingAvailabilitySnapshot | null,
  bookmarkMap: Map<string, BookmarkRecord>,
  scope = normalizeHistoryRunScope()
): ReconciledPendingAvailabilitySnapshot | null {
  if (!snapshot || !snapshot.savedAt || !bookmarkMap.size) {
    return null
  }

  const expectedScope = normalizeHistoryRunScope(scope)
  if (String(snapshot.scope?.key || 'all') !== String(expectedScope.key || 'all')) {
    return null
  }

  const identityIndex = buildBookmarkIdentityIndex(bookmarkMap)
  const usedBookmarkIds = new Set<string>()
  const restored = {
    reviewResults: [] as AvailabilityResult[],
    failedResults: [] as AvailabilityResult[],
    redirectResults: [] as AvailabilityResult[],
    currentHistoryEntries: [] as ReconciledPendingAvailabilitySnapshot['currentHistoryEntries'],
    droppedCount: 0,
    matchedCount: 0
  }

  restoreResultGroup(snapshot.results.review, 'review', restored, bookmarkMap, identityIndex, usedBookmarkIds)
  restoreResultGroup(snapshot.results.failed, 'failed', restored, bookmarkMap, identityIndex, usedBookmarkIds)
  restoreResultGroup(snapshot.results.redirected, 'redirected', restored, bookmarkMap, identityIndex, usedBookmarkIds)

  return restored
}

function normalizePendingResultArray(
  entries: unknown,
  fallbackStatus: PendingAvailabilityResultSnapshot['status']
): PendingAvailabilityResultSnapshot[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries
    .map((entry) => normalizePendingResult(entry, fallbackStatus))
    .filter(Boolean) as PendingAvailabilityResultSnapshot[]
}

function normalizePendingResult(
  entry: unknown,
  fallbackStatus: PendingAvailabilityResultSnapshot['status']
): PendingAvailabilityResultSnapshot | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const result = entry as Record<string, unknown>
  const id = String(result.id || '').trim()
  const url = String(result.url || '').trim()
  const identity = String(result.identity || '').trim()
  const fingerprint = String(result.fingerprint || '').trim()

  if ((!id && !identity && !fingerprint) || !url) {
    return null
  }

  const status = normalizePendingStatus(result.status, fallbackStatus)
  return {
    id,
    identity,
    fingerprint,
    title: String(result.title || '未命名书签').trim() || '未命名书签',
    url,
    finalUrl: String(result.finalUrl || url).trim(),
    path: String(result.path || '').trim(),
    parentId: String(result.parentId || '').trim(),
    index: Number.isFinite(Number(result.index)) ? Number(result.index) : 0,
    ancestorIds: Array.isArray(result.ancestorIds)
      ? result.ancestorIds.map((folderId) => String(folderId)).filter(Boolean)
      : [],
    status,
    badgeText: String(result.badgeText || getDefaultBadgeText(status)).trim() || getDefaultBadgeText(status),
    detail: String(result.detail || '').trim(),
    historyStatus: normalizeHistoryStatus(result.historyStatus),
    abnormalStreak: Math.max(0, Number(result.abnormalStreak) || 0)
  }
}

function normalizePendingStatus(
  status: unknown,
  fallbackStatus: PendingAvailabilityResultSnapshot['status']
): PendingAvailabilityResultSnapshot['status'] {
  const normalizedStatus = String(status || fallbackStatus).trim()
  if (normalizedStatus === 'failed' || normalizedStatus === 'redirected') {
    return normalizedStatus
  }
  return 'review'
}

function normalizeHistoryStatus(status: unknown): PendingAvailabilityResultSnapshot['historyStatus'] {
  const normalizedStatus = String(status || '').trim()
  if (normalizedStatus === 'new' || normalizedStatus === 'persistent') {
    return normalizedStatus
  }
  return ''
}

function serializePendingResult(
  result: AvailabilityResult,
  status: PendingAvailabilityResultSnapshot['status']
): PendingAvailabilityResultSnapshot {
  const bookmarkIdentity = createBookmarkIdentity(result)
  return {
    id: String(result.id || ''),
    identity: bookmarkIdentity.identity,
    fingerprint: bookmarkIdentity.fingerprint,
    title: String(result.title || '未命名书签'),
    url: String(result.url || ''),
    finalUrl: String(result.finalUrl || result.url || ''),
    path: String(result.path || ''),
    parentId: String(result.parentId || ''),
    index: Number.isFinite(Number(result.index)) ? Number(result.index) : 0,
    ancestorIds: Array.isArray(result.ancestorIds) ? result.ancestorIds.map((folderId) => String(folderId)).filter(Boolean) : [],
    status,
    badgeText: String(result.badgeText || getDefaultBadgeText(status)),
    detail: String(result.detail || ''),
    historyStatus: result.historyStatus || '',
    abnormalStreak: Math.max(0, Number(result.abnormalStreak) || 0)
  }
}

function buildBookmarkIdentityIndex(bookmarkMap: Map<string, BookmarkRecord>) {
  const byIdentity = new Map<string, BookmarkRecord[]>()
  const byFingerprint = new Map<string, BookmarkRecord[]>()
  const byUrlAndPath = new Map<string, BookmarkRecord[]>()

  for (const bookmark of bookmarkMap.values()) {
    const bookmarkIdentity = createBookmarkIdentity(bookmark)
    appendIndexedBookmark(byIdentity, bookmarkIdentity.identity, bookmark)
    appendIndexedBookmark(byFingerprint, bookmarkIdentity.fingerprint, bookmark)
    appendIndexedBookmark(byUrlAndPath, buildUrlPathKey(bookmark), bookmark)
  }

  return {
    byIdentity,
    byFingerprint,
    byUrlAndPath
  }
}

function appendIndexedBookmark(
  index: Map<string, BookmarkRecord[]>,
  key: string,
  bookmark: BookmarkRecord
): void {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) {
    return
  }

  const entries = index.get(normalizedKey) || []
  entries.push(bookmark)
  index.set(normalizedKey, entries)
}

function restoreResultGroup(
  entries: PendingAvailabilityResultSnapshot[],
  status: PendingAvailabilityResultSnapshot['status'],
  restored: ReconciledPendingAvailabilitySnapshot,
  bookmarkMap: Map<string, BookmarkRecord>,
  identityIndex: ReturnType<typeof buildBookmarkIdentityIndex>,
  usedBookmarkIds: Set<string>
): void {
  for (const entry of entries) {
    const bookmark = findPendingResultBookmark(entry, bookmarkMap, identityIndex, usedBookmarkIds)
    if (!bookmark) {
      restored.droppedCount += 1
      continue
    }

    const nextResult = buildAvailabilityResultFromPendingEntry(entry, bookmark, status)
    if (!nextResult) {
      restored.droppedCount += 1
      continue
    }

    usedBookmarkIds.add(String(bookmark.id))
    restored.matchedCount += 1

    if (status === 'redirected') {
      restored.redirectResults.push(nextResult)
      continue
    }

    restored.currentHistoryEntries.push({
      id: nextResult.id,
      title: nextResult.title,
      url: nextResult.url,
      path: nextResult.path,
      status,
      streak: Math.max(1, Number(nextResult.abnormalStreak) || 1)
    })

    if (status === 'failed') {
      restored.failedResults.push(nextResult)
    } else {
      restored.reviewResults.push(nextResult)
    }
  }
}

function findPendingResultBookmark(
  entry: PendingAvailabilityResultSnapshot,
  bookmarkMap: Map<string, BookmarkRecord>,
  identityIndex: ReturnType<typeof buildBookmarkIdentityIndex>,
  usedBookmarkIds: Set<string>
): BookmarkRecord | null {
  const directBookmark = entry.id ? bookmarkMap.get(String(entry.id)) : null
  if (directBookmark && !usedBookmarkIds.has(String(directBookmark.id)) && isPendingEntryMatch(entry, directBookmark)) {
    return directBookmark
  }

  return (
    findFirstUnused(identityIndex.byIdentity.get(entry.identity), usedBookmarkIds) ||
    findFirstUnused(identityIndex.byFingerprint.get(entry.fingerprint), usedBookmarkIds) ||
    findFirstUnused(identityIndex.byUrlAndPath.get(buildUrlPathKey(entry)), usedBookmarkIds) ||
    null
  )
}

function findFirstUnused(
  candidates: BookmarkRecord[] | undefined,
  usedBookmarkIds: Set<string>
): BookmarkRecord | null {
  return candidates?.find((bookmark) => !usedBookmarkIds.has(String(bookmark.id))) || null
}

function isPendingEntryMatch(
  entry: PendingAvailabilityResultSnapshot,
  bookmark: BookmarkRecord
): boolean {
  const bookmarkIdentity = createBookmarkIdentity(bookmark)
  return (
    Boolean(entry.identity && entry.identity === bookmarkIdentity.identity) ||
    Boolean(entry.fingerprint && entry.fingerprint === bookmarkIdentity.fingerprint) ||
    buildUrlPathKey(entry) === buildUrlPathKey(bookmark)
  )
}

function buildAvailabilityResultFromPendingEntry(
  entry: PendingAvailabilityResultSnapshot,
  bookmark: BookmarkRecord,
  status: PendingAvailabilityResultSnapshot['status']
): AvailabilityResult | null {
  const finalUrl = String(entry.finalUrl || bookmark.url || '').trim()
  if (status === 'redirected' && (!finalUrl || !isRedirectedNavigation(bookmark.url, finalUrl))) {
    return null
  }

  return {
    ...bookmark,
    status,
    badgeText: entry.badgeText || getDefaultBadgeText(status),
    finalUrl: status === 'redirected' ? finalUrl : bookmark.url,
    detail: entry.detail || '从上次待处理快照恢复。',
    historyStatus: status === 'redirected' ? '' : entry.historyStatus,
    abnormalStreak: status === 'redirected' ? 0 : Math.max(1, Number(entry.abnormalStreak) || 1)
  }
}

function buildUrlPathKey(bookmark: Pick<BookmarkRecord, 'url' | 'path'>): string {
  return [
    buildDuplicateKey(bookmark.url),
    String(bookmark.path || '').toLowerCase().replace(/\s+/g, ' ').trim()
  ].join('\n')
}

function getDefaultBadgeText(status: PendingAvailabilityResultSnapshot['status']): string {
  if (status === 'failed') {
    return '高置信异常'
  }
  if (status === 'redirected') {
    return '已跳转'
  }
  return '低置信异常'
}
