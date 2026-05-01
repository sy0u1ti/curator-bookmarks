import {
  BOOKMARK_ADD_HISTORY_LIMIT,
  STORAGE_KEYS
} from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { displayUrl } from '../../shared/text.js'
import { availabilityState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'
import { formatDateTime } from '../shared-options/utils.js'

export interface BookmarkAddHistoryEntry {
  id: string
  createdAt: number
  bookmarkId: string
  title: string
  url: string
  originalFolderPath: string
  targetFolderPath: string
  targetFolderId: string
  recommendationKind: 'existing' | 'new'
  moved: boolean
  confidence: number
  reason: string
  summary: string
  suggestedTitle: string
}

function normalizeConfidence(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, 1)) : 0
}

function normalizeRecommendationKind(value: unknown): 'existing' | 'new' {
  return String(value || '').trim() === 'new' ? 'new' : 'existing'
}

function normalizeHistoryEntry(entry: any): BookmarkAddHistoryEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const bookmarkId = String(entry.bookmarkId || '').trim()
  const url = String(entry.url || '').trim()
  const createdAt = Number(entry.createdAt) || 0
  if (!bookmarkId || !url || !createdAt) {
    return null
  }

  const targetFolderPath = String(entry.targetFolderPath || entry.folderPath || '').trim()
  return {
    id: String(entry.id || `bookmark-add-${createdAt}-${bookmarkId}`).trim(),
    createdAt,
    bookmarkId,
    title: String(entry.title || '未命名书签').trim() || '未命名书签',
    url,
    originalFolderPath: String(entry.originalFolderPath || '').trim(),
    targetFolderPath,
    targetFolderId: String(entry.targetFolderId || '').trim(),
    recommendationKind: normalizeRecommendationKind(entry.recommendationKind),
    moved: Boolean(entry.moved),
    confidence: normalizeConfidence(entry.confidence),
    reason: String(entry.reason || '').trim(),
    summary: String(entry.summary || '').trim(),
    suggestedTitle: String(entry.suggestedTitle || '').trim()
  }
}

export function normalizeBookmarkAddHistory(rawHistory: unknown): BookmarkAddHistoryEntry[] {
  const source = rawHistory && typeof rawHistory === 'object'
    ? rawHistory as { entries?: unknown }
    : {}
  const entries = Array.isArray(source.entries)
    ? source.entries
    : Array.isArray(rawHistory)
      ? rawHistory
      : []

  return entries
    .map((entry) => normalizeHistoryEntry(entry))
    .filter(Boolean)
    .sort((left, right) => right!.createdAt - left!.createdAt)
    .slice(0, BOOKMARK_ADD_HISTORY_LIMIT) as BookmarkAddHistoryEntry[]
}

export function serializeBookmarkAddHistory(
  entries: BookmarkAddHistoryEntry[] = managerState.bookmarkAddHistory
) {
  return {
    version: 1,
    entries: normalizeBookmarkAddHistory(entries).map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      bookmarkId: entry.bookmarkId,
      title: entry.title,
      url: entry.url,
      originalFolderPath: entry.originalFolderPath,
      targetFolderPath: entry.targetFolderPath,
      targetFolderId: entry.targetFolderId,
      recommendationKind: entry.recommendationKind,
      moved: entry.moved,
      confidence: entry.confidence,
      reason: entry.reason,
      summary: entry.summary,
      suggestedTitle: entry.suggestedTitle
    }))
  }
}

export function hydrateBookmarkAddHistory(rawHistory: unknown): void {
  managerState.bookmarkAddHistory = normalizeBookmarkAddHistory(rawHistory)
}

async function saveBookmarkAddHistory(entries = managerState.bookmarkAddHistory): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.bookmarkAddHistory]: serializeBookmarkAddHistory(entries)
  })
}

function getBookmarkAddHistorySummary() {
  const entries = managerState.bookmarkAddHistory
  return {
    total: entries.length,
    moved: entries.filter((entry) => entry.moved).length,
    existing: entries.filter((entry) => entry.recommendationKind === 'existing').length,
    newFolder: entries.filter((entry) => entry.recommendationKind === 'new').length
  }
}

function buildBookmarkAddHistoryCard(entry: BookmarkAddHistoryEntry): string {
  const confidencePercent = Math.round(entry.confidence * 100)
  const folderKindText = entry.recommendationKind === 'new' ? '新建文件夹' : '已有文件夹'
  const movementText = entry.moved ? '已移动' : '已在目标文件夹'
  const originalFolder = entry.originalFolderPath || '未归档路径'
  const targetFolder = entry.targetFolderPath || '未归档路径'

  return `
    <article class="detect-result-card bookmark-add-history-card">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <span class="options-chip ${entry.moved ? 'success' : 'muted'}">${escapeHtml(movementText)}</span>
          <span class="options-chip muted">${escapeHtml(folderKindText)}</span>
          <span class="options-chip muted">${escapeHtml(String(confidencePercent))}%</span>
        </div>
        <span class="option-value">${escapeHtml(formatDateTime(entry.createdAt))}</span>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(entry.title || '未命名书签')}</strong>
        <div class="detect-result-url">${escapeHtml(displayUrl(entry.url))}</div>
        <p class="detect-result-path" title="${escapeAttr(targetFolder)}">${escapeHtml(targetFolder)}</p>
        ${entry.moved
          ? `<div class="detect-result-detail">从 ${escapeHtml(originalFolder)} 移动到 ${escapeHtml(targetFolder)}。</div>`
          : `<div class="detect-result-detail">书签已位于推荐文件夹：${escapeHtml(targetFolder)}。</div>`}
        ${entry.reason ? `<div class="detect-result-detail">原因：${escapeHtml(entry.reason)}</div>` : ''}
        ${entry.summary ? `<div class="history-run-summary">摘要：${escapeHtml(entry.summary)}</div>` : ''}
      </div>
    </article>
  `
}

export function renderBookmarkAddHistory(): void {
  if (!dom.bookmarkAddHistoryResults) {
    return
  }

  const entries = managerState.bookmarkAddHistory
  const summary = getBookmarkAddHistorySummary()
  const latestEntry = entries[0] || null

  dom.bookmarkAddHistoryTotal.textContent = String(summary.total)
  dom.bookmarkAddHistoryMoved.textContent = String(summary.moved)
  dom.bookmarkAddHistoryExisting.textContent = String(summary.existing)
  dom.bookmarkAddHistoryNew.textContent = String(summary.newFolder)
  dom.bookmarkAddHistoryTimestamp.textContent = latestEntry
    ? formatDateTime(latestEntry.createdAt)
    : '尚无历史'
  dom.bookmarkAddHistoryClear.disabled = summary.total === 0
  dom.bookmarkAddHistorySubtitle.textContent = summary.total
    ? `已保留最近 ${summary.total} 条自动分析添加记录，最近一次发生于 ${formatDateTime(latestEntry!.createdAt)}。`
    : '开启“自动分析”后，新增普通网页书签完成 AI 分类时会在这里记录保存位置。'

  dom.bookmarkAddHistoryResults.innerHTML = entries.length
    ? entries.map((entry) => buildBookmarkAddHistoryCard(entry)).join('')
    : '<div class="detect-empty">还没有自动分析添加记录。开启“自动分析”后，新增普通网页书签并完成分类时会写入这里。</div>'
}

export async function clearBookmarkAddHistory(callbacks: {
  renderAvailabilitySection: () => void
  confirm?: (options: {
    title: string
    copy: string
    confirmLabel: string
    label: string
    tone: string
  }) => Promise<boolean>
}): Promise<void> {
  if (!managerState.bookmarkAddHistory.length) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `清空 ${managerState.bookmarkAddHistory.length} 条添加书签历史？`,
        copy: '只会清空自动分析添加记录，不会删除已经保存的书签。',
        confirmLabel: '清空添加历史',
        label: '清空历史',
        tone: 'warning'
      })
    : true
  if (!confirmed) {
    return
  }

  managerState.bookmarkAddHistory = []
  await saveBookmarkAddHistory([])
  availabilityState.lastError = '已清空添加书签历史。'
  callbacks.renderAvailabilitySection()
}
