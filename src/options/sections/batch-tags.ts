import {
  applyBatchManualTagOperation,
  buildBookmarkTagUsageSummary,
  getEffectiveBookmarkTags,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTags,
  saveBookmarkTagIndex,
  type BatchManualTagOperationType,
  type BookmarkTagIndex
} from '../../shared/bookmark-tags.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { displayUrl, normalizeText } from '../../shared/text.js'
import type { BookmarkRecord } from '../../shared/types.js'
import { aiNamingState, availabilityState, batchTagsState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'

interface BatchTagsCallbacks {
  renderAvailabilitySection: () => void
  confirm: (options: {
    title: string
    copy: string
    confirmLabel: string
    label: string
    tone: string
  }) => Promise<boolean>
}

type BatchTagFilter = 'all' | 'manual' | 'ai-only' | 'untagged'

export function renderBatchTagsSection() {
  if (!dom.batchTagsTotal) {
    return
  }

  const bookmarks = getBatchTagBookmarks()
  const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex as BookmarkTagIndex)
  const summary = buildBookmarkTagUsageSummary(tagIndex, bookmarks)
  const visibleBookmarks = getVisibleBatchTagBookmarks()
  const selectedCount = getSelectedBatchTagBookmarks().length

  dom.batchTagsTotal.textContent = String(summary.totalBookmarks)
  dom.batchTagsManual.textContent = String(summary.manualTaggedBookmarks)
  dom.batchTagsAiOnly.textContent = String(summary.aiOnlyTaggedBookmarks)
  dom.batchTagsUntagged.textContent = String(summary.untaggedBookmarks)
  dom.batchTagsSelectionCount.textContent = `${selectedCount} 条已选择`
  dom.batchTagsStatus.textContent = batchTagsState.status || `${visibleBookmarks.length} 条当前结果`

  if (dom.batchTagsQuery && dom.batchTagsQuery !== document.activeElement) {
    dom.batchTagsQuery.value = String(batchTagsState.query || '')
  }
  if (dom.batchTagsFilter && dom.batchTagsFilter !== document.activeElement) {
    dom.batchTagsFilter.value = String(batchTagsState.filter || 'all')
  }
  if (dom.batchTagsOperation && dom.batchTagsOperation !== document.activeElement) {
    dom.batchTagsOperation.value = String(batchTagsState.operation || 'add')
  }

  renderBatchTagOperationFields()
  renderBatchTagStats(summary.stats)
  renderBatchTagBookmarkList(visibleBookmarks)

  const busy = Boolean(batchTagsState.applying)
  dom.batchTagsSelectVisible.disabled = busy || visibleBookmarks.length === 0
  dom.batchTagsSelectUntagged.disabled = busy || summary.untaggedBookmarks === 0
  dom.batchTagsClearSelection.disabled = busy || selectedCount === 0
  dom.batchTagsApply.disabled = busy || selectedCount === 0
  dom.batchTagsApply.textContent = busy ? '写入中...' : '预览并应用'
}

export function handleBatchTagsInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
    return
  }

  if (target.id === 'batch-tags-query') {
    batchTagsState.query = target.value
  } else if (target.id === 'batch-tags-filter') {
    batchTagsState.filter = target.value
  } else if (target.id === 'batch-tags-operation') {
    batchTagsState.operation = target.value
  }

  batchTagsState.status = ''
  renderBatchTagsSection()
}

export function handleBatchTagsClick(event: Event, callbacks: BatchTagsCallbacks) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const checkbox = target.closest('input[data-batch-tag-select]') as HTMLInputElement | null
  if (checkbox) {
    toggleBatchTagSelection(checkbox.getAttribute('data-bookmark-id'), checkbox.checked)
    return
  }

  const action = target.closest('[data-batch-tag-action]')?.getAttribute('data-batch-tag-action') || ''
  if (!action) {
    return
  }

  if (action === 'select-visible') {
    selectBatchTagBookmarks(getVisibleBatchTagBookmarks().map((bookmark) => String(bookmark.id)))
  } else if (action === 'select-untagged') {
    const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex as BookmarkTagIndex)
    const ids = getBatchTagBookmarks()
      .filter((bookmark) => !getEffectiveBookmarkTags(tagIndex.records[String(bookmark.id)]).length)
      .map((bookmark) => String(bookmark.id))
    selectBatchTagBookmarks(ids)
  } else if (action === 'clear-selection') {
    batchTagsState.selectedIds.clear()
  } else if (action === 'select-tag') {
    const tag = target.closest('[data-batch-tag-value]')?.getAttribute('data-batch-tag-value') || ''
    const normalizedTag = tag.toLowerCase()
    const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex as BookmarkTagIndex)
    const ids = getBatchTagBookmarks()
      .filter((bookmark) => {
        return getEffectiveBookmarkTags(tagIndex.records[String(bookmark.id)])
          .some((item) => item.toLowerCase() === normalizedTag)
      })
      .map((bookmark) => String(bookmark.id))
    selectBatchTagBookmarks(ids)
  } else if (action === 'apply') {
    void applySelectedBatchTagOperation(callbacks)
  }

  renderBatchTagsSection()
}

function renderBatchTagOperationFields() {
  const operation = getBatchTagOperation()
  const isPairOperation = operation === 'rename' || operation === 'merge'
  dom.batchTagsInput.classList.toggle('hidden', isPairOperation)
  dom.batchTagsFrom.classList.toggle('hidden', !isPairOperation)
  dom.batchTagsTo.classList.toggle('hidden', !isPairOperation)
  const tagInput = dom.batchTagsInput as unknown as HTMLInputElement
  const fromInput = dom.batchTagsFrom as unknown as HTMLInputElement
  const toInput = dom.batchTagsTo as unknown as HTMLInputElement
  tagInput.placeholder = operation === 'remove'
    ? '要移除的手动标签，多个用逗号分隔'
    : '要添加的手动标签，多个用逗号分隔'
  fromInput.placeholder = operation === 'merge' ? '要合并的标签' : '原标签'
  toInput.placeholder = operation === 'merge' ? '合并到目标标签' : '新标签'
}

function renderBatchTagStats(stats: ReturnType<typeof buildBookmarkTagUsageSummary>['stats']) {
  if (!dom.batchTagsStats) {
    return
  }

  if (!stats.length) {
    dom.batchTagsStats.innerHTML = '<div class="detect-empty">暂无标签统计。</div>'
    return
  }

  dom.batchTagsStats.innerHTML = stats.slice(0, 40).map((stat) => `
    <button
      class="batch-tags-stat-chip"
      type="button"
      data-batch-tag-action="select-tag"
      data-batch-tag-value="${escapeAttr(stat.tag)}"
      title="选择使用“${escapeAttr(stat.tag)}”的书签"
    >
      <strong>${escapeHtml(stat.tag)}</strong>
      <span>${stat.effectiveCount} 条</span>
    </button>
  `).join('')
}

function renderBatchTagBookmarkList(bookmarks: BookmarkRecord[]) {
  const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex as BookmarkTagIndex)
  if (!dom.batchTagsPreview) {
    return
  }

  if (!bookmarks.length) {
    dom.batchTagsPreview.innerHTML = '<div class="detect-empty">没有符合当前筛选条件的书签。</div>'
    return
  }

  dom.batchTagsPreview.innerHTML = bookmarks.slice(0, 120).map((bookmark) => {
    const bookmarkId = String(bookmark.id)
    const record = tagIndex.records[bookmarkId] || null
    const effectiveTags = getEffectiveBookmarkTags(record)
    const manualTags = normalizeBookmarkTags(record?.manualTags)
    const sourceLabel = manualTags.length ? '手动优先' : effectiveTags.length ? '仅 AI 标签' : '未打标签'
    const tagHtml = effectiveTags.length
      ? effectiveTags.map((tag) => `<span class="options-chip muted">${escapeHtml(tag)}</span>`).join('')
      : '<span class="options-chip warning">未打标签</span>'
    return `
      <label class="detect-result-card batch-tags-bookmark-row">
        <span class="detect-result-main">
          <span class="detect-result-title">${escapeHtml(bookmark.title || '未命名书签')}</span>
          <span class="detect-result-url">${escapeHtml(displayUrl(bookmark.url))}</span>
          <span class="detect-result-meta">${escapeHtml(bookmark.path || '未归档路径')} · ${sourceLabel}</span>
          <span class="batch-tags-bookmark-tags">${tagHtml}</span>
        </span>
        <input
          type="checkbox"
          data-batch-tag-select
          data-bookmark-id="${escapeAttr(bookmarkId)}"
          ${batchTagsState.selectedIds.has(bookmarkId) ? 'checked' : ''}
          aria-label="选择 ${escapeAttr(bookmark.title || '未命名书签')}"
        >
      </label>
    `
  }).join('')
}

async function applySelectedBatchTagOperation(callbacks: BatchTagsCallbacks) {
  if (batchTagsState.applying) {
    return
  }

  const operation = buildBatchManualTagOperation()
  const selectedBookmarks = getSelectedBatchTagBookmarks()
  const preview = applyBatchManualTagOperation(
    aiNamingState.tagIndex as BookmarkTagIndex,
    selectedBookmarks,
    operation
  )

  if (!preview.changed.length) {
    batchTagsState.status = '没有可写入的标签变化。'
    renderBatchTagsSection()
    return
  }

  const confirmed = await callbacks.confirm({
    title: '确认批量修改标签？',
    copy: `将修改 ${preview.changed.length} 条书签的手动标签。写入前会自动创建备份；AI 标签会保留，但不会覆盖手动标签。`,
    confirmLabel: '确认修改标签',
    label: 'Batch Tags',
    tone: 'warning'
  })
  if (!confirmed) {
    return
  }

  batchTagsState.applying = true
  batchTagsState.status = '正在创建自动备份...'
  renderBatchTagsSection()

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-tag-update',
      source: 'options',
      reason: `批量标签：${getBatchTagOperationLabel(operation.type)}`,
      targetBookmarkIds: preview.changed.map((change) => change.bookmarkId),
      estimatedChangeCount: preview.changed.length
    })
    const savedIndex = await saveBookmarkTagIndex(preview.index)
    aiNamingState.tagIndex = savedIndex
    batchTagsState.status = `已修改 ${preview.changed.length} 条书签标签。`
    callbacks.renderAvailabilitySection()
  } catch (error) {
    batchTagsState.status = error instanceof Error ? error.message : '批量标签写入失败。'
  } finally {
    batchTagsState.applying = false
    renderBatchTagsSection()
  }
}

function buildBatchManualTagOperation() {
  const type = getBatchTagOperation()
  return {
    type,
    bookmarkIds: [...batchTagsState.selectedIds],
    tags: dom.batchTagsInput?.value || '',
    fromTag: dom.batchTagsFrom?.value || '',
    toTag: dom.batchTagsTo?.value || ''
  }
}

function getBatchTagOperation(): BatchManualTagOperationType {
  const value = String(batchTagsState.operation || 'add')
  if (value === 'remove' || value === 'rename' || value === 'merge') {
    return value
  }
  return 'add'
}

function getBatchTagOperationLabel(type: BatchManualTagOperationType): string {
  if (type === 'remove') {
    return '移除手动标签'
  }
  if (type === 'rename') {
    return '重命名标签'
  }
  if (type === 'merge') {
    return '合并标签'
  }
  return '添加手动标签'
}

function getVisibleBatchTagBookmarks(): BookmarkRecord[] {
  const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex as BookmarkTagIndex)
  const query = normalizeText(batchTagsState.query || '')
  const filter = String(batchTagsState.filter || 'all') as BatchTagFilter

  return getBatchTagBookmarks().filter((bookmark) => {
    const record = tagIndex.records[String(bookmark.id)] || null
    const effectiveTags = getEffectiveBookmarkTags(record)
    const manualTags = normalizeBookmarkTags(record?.manualTags)
    const matchesFilter =
      filter === 'all' ||
      (filter === 'manual' && manualTags.length > 0) ||
      (filter === 'ai-only' && manualTags.length === 0 && effectiveTags.length > 0) ||
      (filter === 'untagged' && effectiveTags.length === 0)
    if (!matchesFilter) {
      return false
    }
    if (!query) {
      return true
    }
    return normalizeText([
      bookmark.title,
      bookmark.url,
      bookmark.path,
      ...effectiveTags
    ].join(' ')).includes(query)
  })
}

function getSelectedBatchTagBookmarks(): BookmarkRecord[] {
  const selectedIds = batchTagsState.selectedIds
  return getBatchTagBookmarks().filter((bookmark) => selectedIds.has(String(bookmark.id)))
}

function getBatchTagBookmarks(): BookmarkRecord[] {
  return (availabilityState.allBookmarks as BookmarkRecord[]).filter((bookmark) => {
    return bookmark && bookmark.id && bookmark.url
  })
}

function toggleBatchTagSelection(bookmarkId: unknown, selected: boolean) {
  const id = String(bookmarkId || '').trim()
  if (!id) {
    return
  }
  if (selected) {
    batchTagsState.selectedIds.add(id)
  } else {
    batchTagsState.selectedIds.delete(id)
  }
  batchTagsState.status = ''
  renderBatchTagsSection()
}

function selectBatchTagBookmarks(bookmarkIds: string[]) {
  for (const bookmarkId of bookmarkIds) {
    if (bookmarkId) {
      batchTagsState.selectedIds.add(bookmarkId)
    }
  }
  batchTagsState.status = `${bookmarkIds.length} 条书签已加入选择。`
}
