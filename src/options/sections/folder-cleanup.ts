import { STORAGE_KEYS } from '../../shared/constants.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { createBookmark, moveBookmark, removeBookmarkTree } from '../../shared/bookmarks-api.js'
import type { BookmarkTagIndex } from '../../shared/bookmark-tags.js'
import { setLocalStorage } from '../../shared/storage.js'
import {
  analyzeFolderCleanup,
  type FolderCleanupOperationKind,
  type FolderCleanupSuggestion
} from '../../shared/folder-cleanup.js'
import { availabilityState, aiNamingState, folderCleanupState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import { formatDateTime, isInteractionLocked } from '../shared-options/utils.js'

interface FolderCleanupCallbacks {
  confirm: (options?: {
    title?: string
    copy?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: string
    label?: string
  }) => Promise<boolean>
  hydrateAvailabilityCatalog: (options?: { preserveResults?: boolean }) => Promise<void>
  renderAvailabilitySection: () => void
}

const KIND_LABELS = {
  'empty-folder': '空文件夹',
  'deep-single-bookmark': '深层单书签',
  'single-path-chain': '单一路径',
  'same-name-folders': '同名合并',
  'large-folder-split': '超大拆分'
}

const OPERATION_BACKUP_KIND = {
  delete: 'folder-cleanup-delete',
  move: 'folder-cleanup-move',
  merge: 'folder-cleanup-merge',
  split: 'folder-cleanup-move',
  preview: 'folder-cleanup-move'
} as const

export function hydrateFolderCleanupState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return
  }

  folderCleanupState.lastAnalyzedAt = Number(rawState.lastAnalyzedAt) || 0
  folderCleanupState.statusMessage = String(rawState.statusMessage || '').trim()
}

export async function analyzeFolderCleanupSuggestions(callbacks: FolderCleanupCallbacks) {
  if (!folderCleanupState.rootNode || folderCleanupState.running || folderCleanupState.executing) {
    return
  }

  folderCleanupState.running = true
  folderCleanupState.statusMessage = '正在扫描文件夹结构…'
  renderFolderCleanupSection(callbacks)

  try {
    folderCleanupState.suggestions = analyzeFolderCleanup(folderCleanupState.rootNode, {
      tagIndex: aiNamingState.tagIndex as BookmarkTagIndex,
      reservedFolderTitles: getReservedFolderCleanupTitles()
    })
    folderCleanupState.lastAnalyzedAt = Date.now()
    folderCleanupState.statusMessage = folderCleanupState.suggestions.length
      ? `已生成 ${folderCleanupState.suggestions.length} 条建议。`
      : '未发现需要清理的文件夹。'
    await persistFolderCleanupState()
  } catch (error) {
    folderCleanupState.statusMessage = error instanceof Error
      ? `文件夹扫描失败：${error.message}`
      : '文件夹扫描失败，请刷新页面后重试。'
  } finally {
    folderCleanupState.running = false
    renderFolderCleanupSection(callbacks)
  }
}

export function renderFolderCleanupSection(callbacks: FolderCleanupCallbacks) {
  if (!dom.folderCleanupResults) {
    return
  }

  const suggestions = folderCleanupState.suggestions.filter((suggestion) => (
    !folderCleanupState.executedSuggestionIds.has(suggestion.id)
  ))
  const summary = summarizeSuggestions(suggestions)
  const locked = isInteractionLocked() || folderCleanupState.running || folderCleanupState.executing

  setText(dom.folderCleanupSummaryTotal, String(suggestions.length))
  setText(dom.folderCleanupSummaryEmpty, String(summary.empty))
  setText(dom.folderCleanupSummaryDeep, String(summary.deep))
  setText(dom.folderCleanupSummarySameName, String(summary.sameName))
  setText(dom.folderCleanupSummaryLarge, String(summary.large))
  setText(dom.folderCleanupCount, `${suggestions.length} 条建议`)

  if (dom.folderCleanupStatus) {
    dom.folderCleanupStatus.className = `options-chip ${folderCleanupState.running ? 'warning' : suggestions.length ? 'success' : 'muted'}`
    dom.folderCleanupStatus.textContent = getStatusText(suggestions.length)
  }

  if (dom.folderCleanupAnalyze) {
    dom.folderCleanupAnalyze.disabled = locked || availabilityState.catalogLoading
    dom.folderCleanupAnalyze.textContent = folderCleanupState.running ? '扫描中…' : '重新扫描'
  }

  if (dom.folderCleanupResultsSubtitle) {
    dom.folderCleanupResultsSubtitle.textContent = folderCleanupState.lastAnalyzedAt
      ? `上次扫描：${formatDateTime(folderCleanupState.lastAnalyzedAt)}。所有危险操作都会先确认并触发自动备份 hook。`
      : '所有建议默认只预览，不会自动修改书签。'
  }

  if (availabilityState.catalogLoading) {
    dom.folderCleanupResults.innerHTML = '<div class="detect-empty">正在读取书签树，请稍候…</div>'
    return
  }

  if (!folderCleanupState.rootNode) {
    dom.folderCleanupResults.innerHTML = '<div class="detect-empty">暂未读取到书签树，请刷新页面后重试。</div>'
    return
  }

  if (!suggestions.length) {
    dom.folderCleanupResults.innerHTML = `<div class="detect-empty">${escapeHtml(folderCleanupState.statusMessage || '当前未发现需要清理的文件夹。')}</div>`
    return
  }

  dom.folderCleanupResults.innerHTML = suggestions.map((suggestion) => buildSuggestionCard(suggestion, locked)).join('')
}

export async function handleFolderCleanupClick(event: Event, callbacks: FolderCleanupCallbacks) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const actionButton = target.closest('[data-folder-cleanup-action]') as HTMLElement | null
  if (!actionButton || folderCleanupState.running || folderCleanupState.executing || isInteractionLocked()) {
    return
  }

  const suggestionId = String(actionButton.getAttribute('data-folder-cleanup-action') || '')
  const suggestion = folderCleanupState.suggestions.find((item) => item.id === suggestionId)
  if (!suggestion || !suggestion.canExecute) {
    return
  }

  const confirmed = await callbacks.confirm({
    title: getConfirmTitle(suggestion),
    copy: getConfirmCopy(suggestion),
    confirmLabel: getConfirmLabel(suggestion.operation),
    tone: suggestion.severity === 'danger' ? 'danger' : 'warning',
    label: 'Folder Cleanup'
  })
  if (!confirmed) {
    return
  }

  await executeFolderCleanupSuggestion(suggestion, callbacks)
}

async function executeFolderCleanupSuggestion(
  suggestion: FolderCleanupSuggestion,
  callbacks: FolderCleanupCallbacks
) {
  folderCleanupState.executing = true
  folderCleanupState.statusMessage = '正在执行清理操作…'
  renderFolderCleanupSection(callbacks)

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: OPERATION_BACKUP_KIND[suggestion.operation],
      source: 'options',
      reason: suggestion.title,
      targetBookmarkIds: suggestion.bookmarkIds,
      targetFolderIds: suggestion.folderIds,
      estimatedChangeCount: Math.max(suggestion.bookmarkIds.length, suggestion.folderIds.length)
    })

    if (suggestion.operation === 'delete') {
      await deleteFolders(suggestion.folderIds)
    } else if (suggestion.operation === 'move') {
      await moveBookmarksAndRemoveFolders(suggestion)
    } else if (suggestion.operation === 'merge') {
      await mergeFolders(suggestion)
    } else if (suggestion.operation === 'split') {
      await splitLargeFolder(suggestion)
    }

    folderCleanupState.executedSuggestionIds.add(suggestion.id)
    folderCleanupState.statusMessage = '清理操作已完成。'
    await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    if (folderCleanupState.rootNode) {
      folderCleanupState.suggestions = analyzeFolderCleanup(folderCleanupState.rootNode, {
        tagIndex: aiNamingState.tagIndex as BookmarkTagIndex,
        reservedFolderTitles: getReservedFolderCleanupTitles()
      })
      folderCleanupState.lastAnalyzedAt = Date.now()
      await persistFolderCleanupState()
    }
  } catch (error) {
    folderCleanupState.statusMessage = error instanceof Error
      ? `清理失败：${error.message}`
      : '清理失败，请刷新页面后重试。'
  } finally {
    folderCleanupState.executing = false
    callbacks.renderAvailabilitySection()
  }
}

async function deleteFolders(folderIds: string[]) {
  for (const folderId of sortFolderIdsDeepFirst(folderIds)) {
    await removeBookmarkTree(folderId)
  }
}

async function moveBookmarksAndRemoveFolders(suggestion: FolderCleanupSuggestion) {
  const targetFolderId = String(suggestion.targetFolderId || '').trim()
  if (!targetFolderId) {
    throw new Error('缺少移动目标文件夹。')
  }

  for (const bookmarkId of suggestion.bookmarkIds) {
    await moveBookmark(bookmarkId, targetFolderId)
  }
  await deleteFolders(suggestion.folderIds)
}

async function mergeFolders(suggestion: FolderCleanupSuggestion) {
  const targetFolderId = String(suggestion.targetFolderId || '').trim()
  if (!targetFolderId) {
    throw new Error('缺少合并目标文件夹。')
  }

  const sourceFolderIds = suggestion.folderIds.filter((folderId) => folderId !== targetFolderId)
  for (const bookmarkId of suggestion.bookmarkIds) {
    await moveBookmark(bookmarkId, targetFolderId)
  }
  await deleteFolders(sourceFolderIds)
}

async function splitLargeFolder(suggestion: FolderCleanupSuggestion) {
  const targetFolderId = String(suggestion.targetFolderId || suggestion.primaryFolderId || '').trim()
  if (!targetFolderId || !suggestion.splitGroups?.length) {
    throw new Error('缺少拆分目标。')
  }

  for (const group of suggestion.splitGroups) {
    const folder = await createBookmark({
      parentId: targetFolderId,
      title: sanitizeFolderTitle(group.label)
    })
    for (const bookmarkId of group.bookmarkIds) {
      await moveBookmark(bookmarkId, folder.id)
    }
  }
}

function buildSuggestionCard(suggestion: FolderCleanupSuggestion, locked: boolean): string {
  const previewOpen = folderCleanupState.selectedSuggestionId === suggestion.id
  const operationCopy = getOperationCopy(suggestion)
  const splitPreview = suggestion.splitGroups?.length
    ? `<div class="folder-cleanup-split-preview">${suggestion.splitGroups.map((group) => `
        <span class="options-chip muted">${escapeHtml(group.label)} · ${group.count}</span>
      `).join('')}</div>`
    : ''
  const bookmarkPreview = suggestion.bookmarks.length
    ? `<p class="detect-result-detail">涉及书签：${escapeHtml(suggestion.bookmarks.slice(0, 4).map((bookmark) => bookmark.title).join('、'))}${suggestion.bookmarks.length > 4 ? '…' : ''}</p>`
    : ''

  return `
    <article class="detect-result-card folder-cleanup-card">
      <div class="detect-result-head">
        <span class="options-chip ${suggestion.severity === 'danger' ? 'danger' : suggestion.severity === 'warning' ? 'warning' : 'muted'}">${escapeHtml(KIND_LABELS[suggestion.kind])}</span>
        <div class="detect-result-actions">
          <button class="detect-result-action" type="button" data-folder-cleanup-preview="${escapeAttr(suggestion.id)}">${previewOpen ? '收起预览' : '查看预览'}</button>
          <button
            class="detect-result-action ${suggestion.severity === 'danger' ? 'danger' : ''}"
            type="button"
            data-folder-cleanup-action="${escapeAttr(suggestion.id)}"
            ${locked || !suggestion.canExecute ? 'disabled' : ''}
          >${escapeHtml(operationCopy)}</button>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(suggestion.title)}</strong>
        <p class="detect-result-path">${escapeHtml(suggestion.summary)}</p>
        <p class="detect-result-detail">${escapeHtml(suggestion.reason)}</p>
        ${bookmarkPreview}
        ${splitPreview}
        <div class="folder-cleanup-preview ${previewOpen ? '' : 'hidden'}">
          ${suggestion.folders.map((folder) => `
            <div class="folder-cleanup-preview-row">
              <strong>${escapeHtml(folder.path || folder.title)}</strong>
              <span>${folder.descendantBookmarkCount} 个书签 · ${folder.depth} 层</span>
            </div>
          `).join('')}
        </div>
      </div>
    </article>
  `
}

export function handleFolderCleanupPreviewClick(event: Event, callbacks: FolderCleanupCallbacks) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const previewButton = target.closest('[data-folder-cleanup-preview]') as HTMLElement | null
  if (!previewButton) {
    return
  }

  const suggestionId = String(previewButton.getAttribute('data-folder-cleanup-preview') || '')
  folderCleanupState.selectedSuggestionId =
    folderCleanupState.selectedSuggestionId === suggestionId ? '' : suggestionId
  renderFolderCleanupSection(callbacks)
}

function summarizeSuggestions(suggestions: FolderCleanupSuggestion[]) {
  return {
    empty: suggestions.filter((suggestion) => suggestion.kind === 'empty-folder').length,
    deep: suggestions.filter((suggestion) => suggestion.kind === 'deep-single-bookmark' || suggestion.kind === 'single-path-chain').length,
    sameName: suggestions.filter((suggestion) => suggestion.kind === 'same-name-folders').length,
    large: suggestions.filter((suggestion) => suggestion.kind === 'large-folder-split').length
  }
}

function getStatusText(visibleSuggestionCount: number): string {
  if (folderCleanupState.running) {
    return '扫描中'
  }
  if (folderCleanupState.executing) {
    return '执行中'
  }
  if (folderCleanupState.lastAnalyzedAt) {
    return visibleSuggestionCount ? '有建议' : '已扫描'
  }
  return visibleSuggestionCount ? '有建议' : '未扫描'
}

function getReservedFolderCleanupTitles(): string[] {
  const inboxTitle = String(managerState.inboxSettings?.folderTitle || '').trim()
  return inboxTitle ? [inboxTitle] : []
}

function getOperationCopy(suggestion: FolderCleanupSuggestion): string {
  if (!suggestion.canExecute) {
    return '仅预览'
  }
  if (suggestion.operation === 'delete') {
    return '确认删除'
  }
  if (suggestion.operation === 'merge') {
    return '确认合并'
  }
  if (suggestion.operation === 'split') {
    return '确认拆分'
  }
  return '确认移动'
}

function getConfirmLabel(operation: FolderCleanupOperationKind): string {
  if (operation === 'delete') {
    return '删除文件夹'
  }
  if (operation === 'merge') {
    return '合并文件夹'
  }
  if (operation === 'split') {
    return '拆分文件夹'
  }
  return '移动书签'
}

function getConfirmTitle(suggestion: FolderCleanupSuggestion): string {
  return `确认${getConfirmLabel(suggestion.operation)}？`
}

function getConfirmCopy(suggestion: FolderCleanupSuggestion): string {
  const target = suggestion.targetFolderId
    ? suggestion.folders.find((folder) => folder.id === suggestion.targetFolderId)?.path || '目标文件夹'
    : ''
  return [
    suggestion.summary,
    target ? `目标：${target}` : '',
    `涉及 ${suggestion.folderIds.length} 个文件夹、${suggestion.bookmarkIds.length} 个书签。执行前会调用自动备份 hook。`
  ].filter(Boolean).join('\n')
}

function sortFolderIdsDeepFirst(folderIds: string[]): string[] {
  const depthById = new Map(folderCleanupState.suggestions
    .flatMap((suggestion) => suggestion.folders)
    .map((folder) => [folder.id, folder.depth]))

  return folderIds.slice().sort((left, right) => (
    (depthById.get(right) || 0) - (depthById.get(left) || 0)
  ))
}

async function persistFolderCleanupState() {
  await setLocalStorage({
    [STORAGE_KEYS.folderCleanupState]: {
      version: 1,
      lastAnalyzedAt: folderCleanupState.lastAnalyzedAt,
      statusMessage: folderCleanupState.statusMessage
    }
  })
}

function sanitizeFolderTitle(title: string): string {
  return String(title || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '拆分分组'
}

function setText(element, value: string) {
  if (element) {
    element.textContent = value
  }
}
