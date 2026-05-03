import type { BookmarkRecord, FolderRecord } from '../../shared/types.js'
import {
  buildBookmarkPathSegments,
  formatBookmarkPath,
  formatFolderPath
} from '../../shared/bookmark-path.js'
import {
  clearAiBookmarkTags,
  getEffectiveBookmarkTags,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTags,
  saveManualBookmarkTags,
  type BookmarkTagIndex,
  type BookmarkTagRecord
} from '../../shared/bookmark-tags.js'
import { displayUrl, extractDomain, normalizeText } from '../../shared/text.js'
import { moveBookmark } from '../../shared/bookmarks-api.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { ROOT_ID } from '../../shared/constants.js'
import { renderDotMatrixLoader } from '../../shared/dot-matrix-loader.js'
import { cancelExitMotion, closeWithExitMotion } from '../../shared/motion.js'
import {
  matchesParsedSearchQuery,
  parseSearchQuery
} from '../../shared/search-query.js'
import type { ContentSnapshotIndex } from '../../shared/content-snapshots.js'
import { buildContentSnapshotSearchMap } from '../../shared/content-snapshots.js'
import { aiNamingState, availabilityState, contentSnapshotState, dashboardState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'
import { compareByPathTitle, formatDateTime } from '../shared-options/utils.js'
import { deleteBookmarksToRecycle } from './recycle.js'

export type DashboardViewMode = 'cards'
export type DashboardSortKey = 'date-desc' | 'date-asc' | 'title-asc' | 'domain-asc'

export interface DashboardFilters {
  query?: string
  folderId?: string
  domain?: string
  month?: string
  sortKey?: DashboardSortKey
}

export interface DashboardItem extends BookmarkRecord {
  folderTitle: string
  topFolderId: string
  topFolderTitle: string
  monthKey: string
  monthLabel: string
  hasKnownDate: boolean
  tagSummary: string
  tags: string[]
  aiTags: string[]
  hasManualTags: boolean
  topics: string[]
  aliases: string[]
  summary: string
  searchText: string
}

export interface DashboardFolderTarget {
  id: string
  title: string
  path: string
  normalizedPath: string
  bookmarkCount: number
  folderCount: number
}

export interface DashboardModel {
  items: DashboardItem[]
  folders: FolderRecord[]
  folderTargets: DashboardFolderTarget[]
  totalBookmarks: number
  totalFolders: number
  domainCount: number
  unknownDateCount: number
}

export interface DashboardDragStateSnapshot {
  armed: boolean
  active: boolean
  moving: boolean
  bookmarkId: string
  pointerId: number
  hoverFolderId: string
  hoverDeleteTarget: boolean
  originX: number
  originY: number
  currentX: number
  currentY: number
}

interface DashboardDragState extends DashboardDragStateSnapshot {
  captureElement: HTMLElement | null
}

interface DashboardVirtualState {
  items: DashboardItem[]
  scrollTop: number
  containerHeight: number
  columnCount: number
  rowStride: number
  frame: number
  sectionFrame: number
  resetScrollOnNextRender: boolean
  resizeObserver: ResizeObserver | null
  observedElement: HTMLElement | null
}

interface DashboardModelCacheKey {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  tagIndex: BookmarkTagIndex | null
  tagRecords: BookmarkTagIndex['records'] | null
  tagUpdatedAt: number
  contentSnapshotIndex: ContentSnapshotIndex | null
  contentSnapshotRecords: ContentSnapshotIndex['records'] | null
  contentSnapshotUpdatedAt: number
  contentSnapshotSearchMap: Map<string, string> | null
  contentSnapshotSearchMapSize: number
  includeFullText: boolean
}

interface DashboardRenderCache {
  modelKey: DashboardModelCacheKey | null
  model: DashboardModel | null
  visibleModel: DashboardModel | null
  visibleQuery: string
  visibleFolderId: string
  visibleDomain: string
  visibleMonth: string
  visibleSortKey: DashboardSortKey
  visibleItems: DashboardItem[] | null
}

interface DashboardCallbacks {
  renderAvailabilitySection: () => void
  hydrateAvailabilityCatalog: (options?: { preserveResults?: boolean }) => Promise<void>
  regenerateAiTags: (bookmark: BookmarkRecord, signal?: AbortSignal) => Promise<void>
  openMoveModal: (source: string) => void
  closeMoveModal: () => void
  confirm: (options: {
    title: string
    copy: string
    confirmLabel: string
    label: string
    tone: string
  }) => Promise<boolean>
  recycleCallbacks: any
}

export const DASHBOARD_DRAG_MOVE_THRESHOLD = 4
const DASHBOARD_CARD_HEIGHT = 176
const DASHBOARD_GRID_GAP = 10
const DASHBOARD_CARD_MIN_WIDTH = 340
const DASHBOARD_VIRTUAL_OVERSCAN_ROWS = 3
const DASHBOARD_VIRTUAL_THRESHOLD = 120

let dashboardStatusTimer = 0
let dashboardTagRegenerateController: AbortController | null = null
let closingDashboardTagEditor = false
const dashboardRenderCache: DashboardRenderCache = {
  modelKey: null,
  model: null,
  visibleModel: null,
  visibleQuery: '',
  visibleFolderId: '',
  visibleDomain: '',
  visibleMonth: '',
  visibleSortKey: 'date-desc',
  visibleItems: null
}

const virtualState: DashboardVirtualState = {
  items: [],
  scrollTop: 0,
  containerHeight: 0,
  columnCount: 1,
  rowStride: DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP,
  frame: 0,
  sectionFrame: 0,
  resetScrollOnNextRender: false,
  resizeObserver: null,
  observedElement: null
}

const dragState: DashboardDragState = {
  ...createDashboardDragState(),
  captureElement: null
}

export function buildDashboardModel({
  bookmarks = [],
  folders = [],
  tagIndex = null,
  contentSnapshotIndex = null,
  contentSnapshotSearchMap = null,
  includeFullText = false
}: {
  bookmarks?: BookmarkRecord[]
  folders?: FolderRecord[]
  tagIndex?: BookmarkTagIndex | null
  contentSnapshotIndex?: ContentSnapshotIndex | null
  contentSnapshotSearchMap?: Map<string, string> | null
  includeFullText?: boolean
} = {}): DashboardModel {
  const folderMap = new Map(folders.map((folder) => [String(folder.id), folder]))
  const tagRecords = tagIndex?.records || {}
  const snapshotSearchMap = contentSnapshotIndex
    ? buildContentSnapshotSearchMap(contentSnapshotIndex, { includeFullText })
    : new Map<string, string>()
  const items = bookmarks.map((bookmark) => {
    const tagRecord = tagRecords[String(bookmark.id)] || null
    const folder = folderMap.get(String(bookmark.parentId || '')) || null
    const topFolder = getTopFolder(bookmark, folderMap)
    const dateMeta = getDashboardDateMeta(bookmark.dateAdded)
    const tags = normalizeDashboardTextList(getEffectiveBookmarkTags(tagRecord))
    const aiTags = normalizeDashboardTextList(tagRecord?.tags)
    const hasManualTags = Boolean(tagRecord?.manualTags?.length)
    const topics = normalizeDashboardTextList(tagRecord?.topics)
    const aliases = normalizeDashboardTextList(tagRecord?.aliases)
    const summary = String(tagRecord?.summary || '').replace(/\s+/g, ' ').trim()
    const snapshotSearchText =
      contentSnapshotSearchMap?.get(String(bookmark.id)) ||
      snapshotSearchMap.get(String(bookmark.id)) ||
      ''
    const tagSummary = tags.slice(0, 4).join(' / ')
    const domain = String(bookmark.domain || extractDomain(bookmark.url) || '').trim()
    const searchText = normalizeText([
      bookmark.title,
      bookmark.url,
      domain,
      bookmark.path,
      tagRecord?.title,
      tagRecord?.path,
      tagRecord?.contentType,
      summary,
      ...tags,
      ...topics,
      ...aliases,
      snapshotSearchText
    ].join(' '))

    return {
      ...bookmark,
      domain,
      folderTitle: folder?.title || bookmark.path || '未归档路径',
      topFolderId: topFolder?.id || '',
      topFolderTitle: topFolder?.title || '未归档路径',
      monthKey: dateMeta.key,
      monthLabel: dateMeta.label,
      hasKnownDate: dateMeta.known,
      tagSummary,
      tags,
      aiTags,
      hasManualTags,
      topics,
      aliases,
      summary,
      searchText
    }
  })

  const domainSet = new Set(items.map((item) => item.domain).filter(Boolean))
  return {
    items,
    folders: folders.slice().sort(compareByPathTitle),
    folderTargets: getDashboardFolderTargets(folders),
    totalBookmarks: items.length,
    totalFolders: folders.filter((folder) => String(folder.id) !== ROOT_ID).length,
    domainCount: domainSet.size,
    unknownDateCount: items.filter((item) => !item.hasKnownDate).length
  }
}

export function filterDashboardItems(items: DashboardItem[], filters: DashboardFilters = {}): DashboardItem[] {
  const parsedQuery = parseSearchQuery(filters.query || '')
  const folderId = String(filters.folderId || '').trim()
  const domain = String(filters.domain || '').trim()
  const month = String(filters.month || '').trim()

  return items.filter((item) => {
    if (!matchesParsedSearchQuery(parsedQuery, {
      searchText: item.searchText,
      domain: item.domain,
      url: item.normalizedUrl || item.url,
      path: item.path,
      type: item.searchText,
      dateAdded: item.dateAdded
    })) {
      return false
    }

    if (parsedQuery.textTerms.length && !parsedQuery.textTerms.every((term) => item.searchText.includes(term))) {
      return false
    }

    if (
      folderId &&
      String(item.parentId || '') !== folderId &&
      !(Array.isArray(item.ancestorIds) && item.ancestorIds.map(String).includes(folderId))
    ) {
      return false
    }

    if (domain && item.domain !== domain) {
      return false
    }

    if (month && item.monthKey !== month) {
      return false
    }

    return true
  })
}

export function sortDashboardItems(
  items: DashboardItem[],
  sortKey: DashboardSortKey = 'date-desc'
): DashboardItem[] {
  return items.slice().sort((left, right) => {
    if (sortKey === 'title-asc') {
      return left.title.localeCompare(right.title, 'zh-CN') || compareDashboardItemPath(left, right)
    }

    if (sortKey === 'domain-asc') {
      return left.domain.localeCompare(right.domain, 'zh-CN') || left.title.localeCompare(right.title, 'zh-CN')
    }

    if (sortKey === 'date-asc') {
      return compareDashboardDates(left, right, 'asc') || compareDashboardItemPath(left, right)
    }

    return compareDashboardDates(left, right, 'desc') || compareDashboardItemPath(left, right)
  })
}

export function getDashboardFolderTargets(folders: FolderRecord[]): DashboardFolderTarget[] {
  return folders
    .filter((folder) => String(folder.id) !== ROOT_ID)
    .slice()
    .sort(compareByPathTitle)
    .map((folder) => ({
      id: String(folder.id),
      title: folder.title || '未命名文件夹',
      path: folder.path || folder.title || '未命名文件夹',
      normalizedPath: folder.normalizedPath || normalizeText(folder.path || folder.title || ''),
      bookmarkCount: Number(folder.bookmarkCount) || 0,
      folderCount: Number(folder.folderCount) || 0
    }))
}

export function createDashboardDragState(
  overrides: Partial<DashboardDragStateSnapshot> = {}
): DashboardDragStateSnapshot {
  return {
    armed: false,
    active: false,
    moving: false,
    bookmarkId: '',
    pointerId: -1,
    hoverFolderId: '',
    hoverDeleteTarget: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    ...overrides
  }
}

export function hasDashboardDragPassedThreshold(
  state: DashboardDragStateSnapshot,
  x: number,
  y: number,
  threshold = DASHBOARD_DRAG_MOVE_THRESHOLD
): boolean {
  return Math.hypot(x - state.originX, y - state.originY) > threshold
}

export function updateDashboardDragHover(
  state: DashboardDragStateSnapshot,
  hoverFolderId: string
): DashboardDragStateSnapshot {
  return {
    ...state,
    hoverFolderId: String(hoverFolderId || '').trim()
  }
}

export function getDashboardSelectionLabel(
  item: Pick<DashboardItem, 'title' | 'path' | 'url'>
): string {
  const title = String(item.title || '').replace(/\s+/g, ' ').trim() || '未命名书签'
  const context = String(item.path || displayUrl(item.url) || '')
    .replace(/\s+/g, ' ')
    .trim()

  return context
    ? `选择书签：${title}，位置：${context}`
    : `选择书签：${title}`
}

export function resetDashboardDragStateSnapshot(): DashboardDragStateSnapshot {
  return createDashboardDragState()
}

export function syncDashboardSelection(selection: Set<string>, validIds: Set<string>): Set<string> {
  for (const selectedId of [...selection]) {
    if (!validIds.has(String(selectedId))) {
      selection.delete(String(selectedId))
    }
  }
  return selection
}

export function getSelectedDashboardBookmarks(): BookmarkRecord[] {
  return [...dashboardState.selectedIds]
    .map((id) => availabilityState.bookmarkMap.get(String(id)))
    .filter(Boolean)
}

export function removeDashboardSelectionIds(bookmarkIds: unknown[]): void {
  for (const bookmarkId of bookmarkIds) {
    dashboardState.selectedIds.delete(String(bookmarkId))
  }
}

export function renderDashboardSection(): void {
  if (!dom.dashboardResults) {
    return
  }

  const { model, visibleItems } = getDashboardRenderData()

  syncDashboardSelection(
    dashboardState.selectedIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  syncDashboardSelection(
    dashboardState.expandedTagIds,
    new Set(model.items.map((item) => String(item.id)))
  )

  dom.dashboardTotal.textContent = `(${model.totalBookmarks})`
  dom.dashboardResultCount.textContent = visibleItems.length === model.items.length
    ? `${visibleItems.length} 条书签`
    : `${visibleItems.length} / ${model.items.length} 条书签`
  dom.dashboardStatus.innerHTML = availabilityState.deleting
    ? renderDashboardLoadingLabel('正在处理所选书签...', {
      loaderClass: 'dashboard-status-dot-loader'
    })
    : escapeHtml(dashboardState.statusMessage || '')
  dom.dashboardQuery.value = dashboardState.query
  renderDashboardSearchTools()
  renderDashboardFolderBreadcrumbs()

  renderDashboardSelectionBar(visibleItems)
  renderDashboardCards(visibleItems)
  renderDashboardTagEditor(model)

  if (dragState.active) {
    renderDashboardDragOverlay(model)
  }
}

export function handleDashboardInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) {
    return
  }

  if (target.matches('input[data-dashboard-select]')) {
    const bookmarkId = String(target.getAttribute('data-dashboard-select') || '').trim()
    if (bookmarkId && 'checked' in target && target.checked) {
      dashboardState.selectedIds.add(bookmarkId)
    } else if (bookmarkId) {
      dashboardState.selectedIds.delete(bookmarkId)
    }
    renderDashboardSection()
    return
  }

  if (target.id === 'dashboard-tag-editor-input') {
    dashboardState.tagEditorDraft = target.value
    dashboardState.tagEditorStatus = ''
    return
  }

  if (target.id !== 'dashboard-query') {
    return
  }

  dashboardState.query = target.value
  resetDashboardVirtualScroll()
  scheduleDashboardSectionRender()
}

export function handleDashboardKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  if (dashboardState.tagEditorBookmarkId && isDashboardTagEditorEvent(event)) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeDashboardTagEditor()
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void saveDashboardTagEditor()
    }
    return
  }

  const tagToggle = target.closest<HTMLElement>('[data-dashboard-toggle-tags]')
  if (!tagToggle || (event.key !== 'Enter' && event.key !== ' ')) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  const bookmarkId = String(tagToggle.getAttribute('data-dashboard-toggle-tags') || '').trim()
  if (!bookmarkId) {
    return
  }

  if (dashboardState.expandedTagIds.has(bookmarkId)) {
    dashboardState.expandedTagIds.delete(bookmarkId)
  } else {
    dashboardState.expandedTagIds.clear()
    dashboardState.expandedTagIds.add(bookmarkId)
  }
  renderDashboardSection()
}

export async function handleDashboardClick(event: Event, callbacks: DashboardCallbacks): Promise<void> {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  const folderFilterButton = target.closest<HTMLElement>('[data-dashboard-folder-filter]')
  if (folderFilterButton) {
    applyDashboardFolderFilter(folderFilterButton.getAttribute('data-dashboard-folder-filter'))
    return
  }

  const selectionInput = target.closest<HTMLInputElement>('input[data-dashboard-select]')
  if (selectionInput) {
    const bookmarkId = String(selectionInput.getAttribute('data-dashboard-select') || '').trim()
    if (bookmarkId && selectionInput.checked) {
      dashboardState.selectedIds.add(bookmarkId)
    } else if (bookmarkId) {
      dashboardState.selectedIds.delete(bookmarkId)
    }
    renderDashboardSection()
    return
  }

  const actionButton = target.closest<HTMLElement>('[data-dashboard-action]')
  if (actionButton) {
    const action = actionButton.getAttribute('data-dashboard-action')
    if (action === 'select-visible') {
      selectVisibleDashboardItems()
    } else if (action === 'clear-selection') {
      dashboardState.selectedIds.clear()
      renderDashboardSection()
    } else if (action === 'move-selected') {
      callbacks.openMoveModal('dashboard')
    } else if (action === 'delete-selected') {
      await deleteSelectedDashboardItems(callbacks)
    } else if (action === 'move-one') {
      const bookmarkId = String(actionButton.getAttribute('data-dashboard-bookmark-id') || '').trim()
      moveSingleDashboardItem(bookmarkId, callbacks)
    } else if (action === 'exit-dashboard') {
      window.location.hash = '#general'
    } else if (action === 'edit-tags') {
      const bookmarkId = String(actionButton.getAttribute('data-dashboard-bookmark-id') || '').trim()
      openDashboardTagEditor(bookmarkId)
    } else if (action === 'close-tag-editor') {
      if (!cancelDashboardTagRegeneration()) {
        closeDashboardTagEditor()
      }
    } else if (action === 'save-tags') {
      await saveDashboardTagEditor()
    } else if (action === 'clear-ai-tags') {
      await clearDashboardAiTags()
    } else if (action === 'regenerate-ai-tags') {
      await regenerateDashboardAiTags(callbacks)
    }
    return
  }

  const copyButton = target.closest<HTMLElement>('[data-dashboard-copy]')
  if (copyButton) {
    await copyDashboardBookmarkUrl(String(copyButton.getAttribute('data-dashboard-copy') || '').trim())
    return
  }

}

export function handleDashboardTagPointerOver(event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  const tagToggle = target?.closest<HTMLElement>('[data-dashboard-toggle-tags]')
  const bookmarkId = String(tagToggle?.getAttribute('data-dashboard-toggle-tags') || '').trim()
  if (!bookmarkId || dashboardState.expandedTagIds.has(bookmarkId)) {
    return
  }

  dashboardState.expandedTagIds.clear()
  dashboardState.expandedTagIds.add(bookmarkId)
  renderDashboardSection()
}

export function handleDashboardTagPointerOut(event: PointerEvent): void {
  if (!dashboardState.expandedTagIds.size) {
    return
  }

  const target = event.target as HTMLElement | null
  const boundary = target?.closest<HTMLElement>('[data-dashboard-toggle-tags], .dashboard-tag-popover')
  if (!boundary) {
    return
  }

  const nextTarget = event.relatedTarget as HTMLElement | null
  if (
    nextTarget &&
    (
      boundary.contains(nextTarget) ||
      Boolean(nextTarget.closest('[data-dashboard-toggle-tags], .dashboard-tag-popover'))
    )
  ) {
    return
  }

  closeDashboardTagPopover()
}

export function handleDashboardDocumentClick(event: MouseEvent): void {
  if (dashboardState.tagEditorBookmarkId && !isDashboardTagEditorEvent(event)) {
    if (!dashboardState.tagEditorSaving) {
      closeDashboardTagEditor()
    }
    return
  }

  if (!dashboardState.expandedTagIds.size) {
    return
  }

  if (isDashboardTagPopoverEvent(event)) {
    return
  }

  closeDashboardTagPopover()
}

export function handleDashboardDocumentFocusIn(event: FocusEvent): void {
  if (dashboardState.tagEditorBookmarkId && !isDashboardTagEditorEvent(event)) {
    if (!dashboardState.tagEditorSaving) {
      closeDashboardTagEditor()
    }
    return
  }

  if (!dashboardState.expandedTagIds.size) {
    return
  }

  if (isDashboardTagPopoverEvent(event)) {
    return
  }

  closeDashboardTagPopover()
}

export function closeDashboardTagPopover(): boolean {
  if (!dashboardState.expandedTagIds.size) {
    return false
  }

  const bookmarkId = String([...dashboardState.expandedTagIds][0] || '')
  const popover = findDashboardCardElement(bookmarkId)?.querySelector<HTMLElement>('.dashboard-tag-popover')
  if (popover) {
    void closeWithExitMotion(popover, 'is-closing', () => {
      if (dashboardState.expandedTagIds.has(bookmarkId)) {
        dashboardState.expandedTagIds.delete(bookmarkId)
      }
      renderDashboardSection()
    }, 180)
  } else {
    dashboardState.expandedTagIds.clear()
    renderDashboardSection()
  }
  return true
}

export function closeDashboardTagEditor(): boolean {
  const closingBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (!closingBookmarkId) {
    return false
  }
  if (dashboardState.tagEditorBusyAction === 'regenerate-ai' && dashboardState.tagEditorSaving) {
    return cancelDashboardTagRegeneration()
  }
  if (dashboardState.tagEditorSaving) {
    return false
  }

  if (closingDashboardTagEditor) {
    return true
  }

  const editor = dom.dashboardTagEditor
  if (!editor || editor.classList.contains('hidden')) {
    clearDashboardTagEditorState()
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
    return true
  }

  closingDashboardTagEditor = true
  void closeWithExitMotion(editor, 'is-closing', () => {
    clearDashboardTagEditorState()
    closingDashboardTagEditor = false
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
  }, 220).catch(() => {
    clearDashboardTagEditorState()
    closingDashboardTagEditor = false
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
  })
  return true
}

function clearDashboardTagEditorState(): void {
  dashboardState.tagEditorBookmarkId = ''
  dashboardState.tagEditorDraft = ''
  dashboardState.tagEditorStatus = ''
  dashboardState.tagEditorSaving = false
  dashboardState.tagEditorBusyAction = ''
  dashboardState.tagEditorReturnFocusId = ''
  dashboardTagRegenerateController = null
}

function restoreDashboardTagEditorFocus(bookmarkId: string): void {
  const returnFocusId = String(dashboardState.tagEditorReturnFocusId || bookmarkId || '').trim()
  if (!returnFocusId) {
    return
  }

  window.setTimeout(() => {
    const card = findDashboardCardElement(returnFocusId)
    const editButton = card?.querySelector<HTMLElement>('[data-dashboard-action="edit-tags"]')
    if (editButton && document.contains(editButton) && !editButton.hasAttribute('disabled')) {
      editButton.focus()
    }
  }, 0)
}

function openDashboardTagEditor(bookmarkId: string): void {
  const { model } = getDashboardRenderData()
  const item = model.items.find((entry) => String(entry.id) === String(bookmarkId))
  if (!item) {
    return
  }

  dashboardState.expandedTagIds.clear()
  dashboardState.tagEditorBookmarkId = String(item.id)
  dashboardState.tagEditorReturnFocusId = String(item.id)
  dashboardState.tagEditorDraft = item.tags.join('\n')
  dashboardState.tagEditorStatus = item.hasManualTags
    ? '当前显示的是手动标签，AI 标签仍可单独重新生成或清除。'
    : item.tags.length
      ? '当前显示的是 AI 标签，保存后会作为手动标签保留。'
      : '当前没有标签，保存后会创建手动标签。'
  dashboardState.tagEditorSaving = false
  dashboardState.tagEditorBusyAction = ''
  dashboardTagRegenerateController = null
  closingDashboardTagEditor = false
  if (dom.dashboardTagEditor) {
    cancelExitMotion(dom.dashboardTagEditor, 'is-closing')
  }
  renderDashboardSection()
  window.setTimeout(() => dom.dashboardTagEditorInput?.focus(), 0)
}

async function saveDashboardTagEditor(): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(dashboardState.tagEditorBookmarkId))
  if (!bookmark || dashboardState.tagEditorSaving) {
    return
  }

  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'save'
  dashboardState.tagEditorStatus = '正在保存标签...'
  renderDashboardTagEditor()

  try {
    const manualTags = normalizeBookmarkTags(dashboardState.tagEditorDraft)
    const savedIndex = await saveManualBookmarkTags(bookmark, dashboardState.tagEditorDraft)
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(savedIndex)
    const savedRecord = aiNamingState.tagIndex.records[String(bookmark.id)] || null
    dashboardState.statusMessage = manualTags.length
      ? '标签已保存。'
      : savedRecord?.tags?.length
        ? '已清除手动标签，显示 AI 标签。'
        : '已清除手动标签。'
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    closeDashboardTagEditor()
    renderDashboardSection()
  } catch (error) {
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardState.tagEditorStatus = error instanceof Error ? error.message : '标签保存失败。'
    renderDashboardTagEditor()
  }
}

async function clearDashboardAiTags(): Promise<void> {
  const bookmarkId = String(dashboardState.tagEditorBookmarkId || '').trim()
  if (!bookmarkId || dashboardState.tagEditorSaving) {
    return
  }

  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'clear-ai'
  dashboardState.tagEditorStatus = '正在清除 AI 标签...'
  renderDashboardTagEditor()

  try {
    const savedIndex = await clearAiBookmarkTags(bookmarkId)
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(savedIndex)
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    const record = aiNamingState.tagIndex.records[bookmarkId] || null
    if (!record?.manualTags?.length) {
      dashboardState.tagEditorDraft = ''
    }
    dashboardState.tagEditorStatus = record?.manualTags?.length
      ? '已清除 AI 标签，当前仍显示手动标签。'
      : '已清除 AI 标签，当前没有标签。'
    dashboardState.statusMessage = '已清除 AI 标签。'
    renderDashboardSection()
  } catch (error) {
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardState.tagEditorStatus = error instanceof Error ? error.message : 'AI 标签清除失败。'
    renderDashboardTagEditor()
  }
}

async function regenerateDashboardAiTags(callbacks: DashboardCallbacks): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(dashboardState.tagEditorBookmarkId))
  if (!bookmark || dashboardState.tagEditorSaving) {
    return
  }

  dashboardTagRegenerateController?.abort()
  dashboardTagRegenerateController = new AbortController()
  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'regenerate-ai'
  dashboardState.tagEditorStatus = '正在重新生成 AI 标签...'
  renderDashboardTagEditor()

  try {
    await callbacks.regenerateAiTags(bookmark, dashboardTagRegenerateController.signal)
    const bookmarkId = String(bookmark.id)
    const record = aiNamingState.tagIndex.records[bookmarkId] || null
    if (!record?.manualTags?.length) {
      dashboardState.tagEditorDraft = getEffectiveBookmarkTags(record).join('\n')
    }
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardTagRegenerateController = null
    dashboardState.tagEditorStatus = record?.manualTags?.length
      ? 'AI 标签已重新生成，当前仍显示手动标签。'
      : getEffectiveBookmarkTags(record).length
        ? 'AI 标签已重新生成。'
        : 'AI 已完成分析，但没有生成可展示的标签。'
    dashboardState.statusMessage = 'AI 标签已重新生成。'
    renderDashboardSection()
  } catch (error) {
    const wasCancelled = dashboardTagRegenerateController?.signal.aborted === true
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardTagRegenerateController = null
    dashboardState.tagEditorStatus = wasCancelled && isAbortError(error)
      ? '已取消重新生成 AI 标签。'
      : error instanceof Error ? error.message : 'AI 标签重新生成失败。'
    renderDashboardTagEditor()
  }
}

function cancelDashboardTagRegeneration(): boolean {
  if (dashboardState.tagEditorBusyAction !== 'regenerate-ai' || !dashboardState.tagEditorSaving) {
    return false
  }

  dashboardState.tagEditorStatus = '正在取消重新生成 AI 标签...'
  dashboardTagRegenerateController?.abort()
  renderDashboardTagEditor()
  return true
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isDashboardTagPopoverEvent(event: Event): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      Boolean(item.closest('[data-dashboard-toggle-tags], .dashboard-tag-popover'))
  })
}

function isDashboardTagEditorEvent(event: Event): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      Boolean(item.closest('[data-dashboard-action="edit-tags"], .dashboard-tag-editor'))
  })
}

export function handleDashboardPointerDown(event: PointerEvent): void {
  if (
    event.button !== 0 ||
    !event.isPrimary ||
    availabilityState.catalogLoading ||
    availabilityState.deleting ||
    dragState.moving
  ) {
    return
  }

  const target = event.target as HTMLElement | null
  if (!target || shouldIgnoreDashboardDragTarget(target)) {
    return
  }

  const card = target.closest<HTMLElement>('[data-dashboard-card]')
  const bookmarkId = String(card?.getAttribute('data-dashboard-bookmark-id') || '').trim()
  if (!card || !bookmarkId || !availabilityState.bookmarkMap.has(bookmarkId)) {
    return
  }

  suppressDashboardNativeSelection(event)
  cancelDashboardDrag({ silent: true })

  dragState.armed = true
  dragState.active = false
  dragState.bookmarkId = bookmarkId
  dragState.pointerId = event.pointerId
  dragState.originX = event.clientX
  dragState.originY = event.clientY
  dragState.currentX = event.clientX
  dragState.currentY = event.clientY
  dragState.hoverFolderId = ''
  dragState.hoverDeleteTarget = false
  dragState.captureElement = card

  try {
    card.setPointerCapture(event.pointerId)
  } catch {
    // Some synthetic events and older Chromium edge cases cannot capture; drag still works via bubbling.
  }
}

export function handleDashboardPointerMove(event: PointerEvent): void {
  if (!isDashboardDragPointer(event)) {
    return
  }

  if (event.pointerType !== 'touch') {
    suppressDashboardNativeSelection(event)
  }

  dragState.currentX = event.clientX
  dragState.currentY = event.clientY

  if (
    dragState.armed &&
    !dragState.active &&
    hasDashboardDragPassedThreshold(dragState, event.clientX, event.clientY)
  ) {
    startDashboardDrag()
  }

  if (!dragState.active) {
    return
  }

  suppressDashboardNativeSelection(event)
  updateDashboardDragPreviewPosition()
  updateDashboardDropHoverFromPoint(event.clientX, event.clientY)
}

export async function handleDashboardPointerUp(event: PointerEvent, callbacks: DashboardCallbacks): Promise<void> {
  if (!isDashboardDragPointer(event)) {
    return
  }

  if (!dragState.active) {
    cancelDashboardDrag({ silent: true })
    return
  }

  suppressDashboardNativeSelection(event)
  updateDashboardDropHoverFromPoint(event.clientX, event.clientY)

  const bookmarkId = dragState.bookmarkId
  const dropOnDeleteTarget = dragState.hoverDeleteTarget
  const folderId = dragState.hoverFolderId
  if (dropOnDeleteTarget) {
    dragState.moving = true
    dom.dashboardDragOverlay?.classList.add('is-moving')
    if (dom.dashboardDragHint) {
      dom.dashboardDragHint.textContent = '等待确认删除...'
    }

    await closeDashboardDragForFollowUp({ silent: true })
    await deleteDashboardBookmarkFromDrop(bookmarkId, callbacks)
    return
  }

  if (!folderId) {
    cancelDashboardDrag({ silent: true })
    return
  }

  dragState.moving = true
  dom.dashboardDragOverlay?.classList.add('is-moving')
  if (dom.dashboardDragHint) {
    dom.dashboardDragHint.textContent = '正在移动书签...'
  }

  await moveDashboardBookmarkToFolder(bookmarkId, folderId, callbacks)
  cancelDashboardDrag({ silent: true })
}

export function handleDashboardPointerCancel(): void {
  cancelDashboardDrag({ silent: true })
}

export function cancelDashboardDrag({ silent = false }: { silent?: boolean } = {}): boolean {
  const wasActive = resetDashboardDragState()
  void hideDashboardDragOverlay()

  if (wasActive && !silent) {
    setDashboardStatus('已取消移动。')
  }

  return wasActive
}

export function selectVisibleDashboardItems(): void {
  const { visibleItems } = getDashboardRenderData()
  for (const item of visibleItems) {
    dashboardState.selectedIds.add(String(item.id))
  }
  renderDashboardSection()
}

export async function deleteSelectedDashboardItems(callbacks: DashboardCallbacks): Promise<void> {
  const selectedBookmarks = getSelectedDashboardBookmarks()
  if (!selectedBookmarks.length || availabilityState.deleting) {
    return
  }

  const confirmed = await callbacks.confirm({
    title: `删除 ${selectedBookmarks.length} 条书签？`,
    copy: '这些书签会从 Chrome 书签中移除并进入回收站。你仍可在回收站里恢复它们。',
    confirmLabel: '删除并移入回收站',
    label: '移入回收站',
    tone: 'danger'
  })
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(
    selectedBookmarks.map((bookmark) => bookmark.id),
    '书签仪表盘批量删除',
    callbacks.recycleCallbacks
  )
}

async function deleteDashboardBookmarkFromDrop(
  bookmarkId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url) {
    setDashboardStatus('删除失败：书签不存在。')
    return
  }

  const confirmed = await callbacks.confirm({
    title: '删除这个书签？',
    copy: `“${bookmark.title || '未命名书签'}” 会从 Chrome 书签中移除并进入回收站，可在回收站恢复。`,
    confirmLabel: '删除并移入回收站',
    label: '移入回收站',
    tone: 'danger'
  })
  if (!confirmed) {
    setDashboardStatus('已取消删除。')
    return
  }

  dashboardState.selectedIds.delete(String(bookmarkId))
  await deleteBookmarksToRecycle([bookmarkId], '书签仪表盘拖拽删除', callbacks.recycleCallbacks)
  setDashboardStatus(
    availabilityState.bookmarkMap.has(String(bookmarkId))
      ? (availabilityState.lastError || '删除失败，请稍后重试。')
      : '已删除书签，并移入回收站。'
  )
}

function moveSingleDashboardItem(bookmarkId: string, callbacks: DashboardCallbacks): void {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url || availabilityState.deleting) {
    return
  }

  managerState.moveDashboardBookmarkId = String(bookmarkId)
  callbacks.openMoveModal('dashboard-single')
}

export function getSingleDashboardMoveBookmark(): BookmarkRecord | null {
  const bookmarkId = String(managerState.moveDashboardBookmarkId || '').trim()
  if (!bookmarkId) {
    return null
  }
  return availabilityState.bookmarkMap.get(bookmarkId) || null
}

export async function moveSelectedDashboardBookmarks(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const selectedBookmarks = getSelectedDashboardBookmarks()
  if (!selectedBookmarks.length) {
    callbacks.closeMoveModal()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const movedIds: string[] = []
  let moveError: unknown = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: `书签仪表盘批量移动 ${selectedBookmarks.length} 条`,
      targetBookmarkIds: selectedBookmarks.map((bookmark) => String(bookmark.id)),
      targetFolderIds: [folderId],
      estimatedChangeCount: selectedBookmarks.length
    })

    for (const bookmark of selectedBookmarks) {
      if (String(bookmark.parentId || '') === folderId) {
        continue
      }
      await moveBookmark(bookmark.id, folderId)
      movedIds.push(bookmark.id)
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    callbacks.closeMoveModal()

    if (movedIds.length) {
      removeDashboardSelectionIds(movedIds)
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    const targetFolder = availabilityState.folderMap.get(folderId)
    if (moveError) {
      availabilityState.lastError = moveError instanceof Error
        ? `仪表盘批量移动过程中断，已移动 ${movedIds.length} 条：${moveError.message}`
        : `仪表盘批量移动过程中断，已移动 ${movedIds.length} 条。`
    } else if (movedIds.length) {
      availabilityState.lastError = `已将 ${movedIds.length} 条书签移动到 ${targetFolder?.path || targetFolder?.title || '目标文件夹'}。`
    } else {
      availabilityState.lastError = '所选书签已在目标文件夹。'
    }

    callbacks.renderAvailabilitySection()
  }
}

export async function moveSingleDashboardBookmark(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const bookmarkId = String(managerState.moveDashboardBookmarkId || '').trim()
  const bookmark = bookmarkId ? availabilityState.bookmarkMap.get(bookmarkId) : null
  const targetFolder = availabilityState.folderMap.get(String(folderId))
  if (!bookmark?.url || !targetFolder) {
    callbacks.closeMoveModal()
    setDashboardStatus('移动失败：目标书签或文件夹不存在。')
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  let moved = false
  let moveError: unknown = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: '书签仪表盘单项移动',
      targetBookmarkIds: [bookmarkId],
      targetFolderIds: [folderId],
      estimatedChangeCount: 1
    })

    if (String(bookmark.parentId || '') !== folderId) {
      await moveBookmark(bookmarkId, folderId)
      moved = true
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    callbacks.closeMoveModal()

    if (moved) {
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (moveError) {
      setDashboardStatus(moveError instanceof Error ? `移动失败：${moveError.message}` : '移动失败，请稍后重试。')
    } else if (moved) {
      setDashboardStatus(`已移动到 ${targetFolder.path || targetFolder.title}。`)
    } else {
      setDashboardStatus('书签已在该文件夹。')
    }
  }
}

export function getDashboardRenderData() {
  const model = getCachedDashboardModel({
    bookmarks: availabilityState.allBookmarks,
    folders: availabilityState.allFolders,
    tagIndex: (aiNamingState.tagIndex as BookmarkTagIndex) || null,
    contentSnapshotIndex: contentSnapshotState.index,
    contentSnapshotSearchMap: contentSnapshotState.searchTextMap,
    includeFullText: contentSnapshotState.settings.fullTextSearchEnabled
  })
  const visibleItems = getCachedDashboardVisibleItems(model, {
    query: dashboardState.query,
    folderId: dashboardState.folderId,
    domain: dashboardState.domain,
    month: dashboardState.month,
    sortKey: dashboardState.sortKey
  })

  return {
    model,
    visibleItems
  }
}

function getCachedDashboardModel({
  bookmarks,
  folders,
  tagIndex,
  contentSnapshotIndex,
  contentSnapshotSearchMap,
  includeFullText
}: {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  tagIndex: BookmarkTagIndex | null
  contentSnapshotIndex: ContentSnapshotIndex | null
  contentSnapshotSearchMap: Map<string, string> | null
  includeFullText: boolean
}): DashboardModel {
  const key: DashboardModelCacheKey = {
    bookmarks,
    folders,
    tagIndex,
    tagRecords: tagIndex?.records || null,
    tagUpdatedAt: Number(tagIndex?.updatedAt) || 0,
    contentSnapshotIndex,
    contentSnapshotRecords: contentSnapshotIndex?.records || null,
    contentSnapshotUpdatedAt: Number(contentSnapshotIndex?.updatedAt) || 0,
    contentSnapshotSearchMap,
    contentSnapshotSearchMapSize: contentSnapshotSearchMap?.size || 0,
    includeFullText
  }

  if (dashboardRenderCache.model && dashboardRenderCache.modelKey && isDashboardModelCacheKeyEqual(dashboardRenderCache.modelKey, key)) {
    return dashboardRenderCache.model
  }

  const model = buildDashboardModel({
    bookmarks,
    folders,
    tagIndex,
    contentSnapshotIndex,
    contentSnapshotSearchMap,
    includeFullText
  })
  dashboardRenderCache.modelKey = key
  dashboardRenderCache.model = model
  dashboardRenderCache.visibleItems = null
  dashboardRenderCache.visibleModel = null
  return model
}

function isDashboardModelCacheKeyEqual(left: DashboardModelCacheKey, right: DashboardModelCacheKey): boolean {
  return (
    left.bookmarks === right.bookmarks &&
    left.folders === right.folders &&
    left.tagIndex === right.tagIndex &&
    left.tagRecords === right.tagRecords &&
    left.tagUpdatedAt === right.tagUpdatedAt &&
    left.contentSnapshotIndex === right.contentSnapshotIndex &&
    left.contentSnapshotRecords === right.contentSnapshotRecords &&
    left.contentSnapshotUpdatedAt === right.contentSnapshotUpdatedAt &&
    left.contentSnapshotSearchMap === right.contentSnapshotSearchMap &&
    left.contentSnapshotSearchMapSize === right.contentSnapshotSearchMapSize &&
    left.includeFullText === right.includeFullText
  )
}

function getCachedDashboardVisibleItems(
  model: DashboardModel,
  filters: DashboardFilters = {}
): DashboardItem[] {
  const query = String(filters.query || '')
  const folderId = String(filters.folderId || '')
  const domain = String(filters.domain || '')
  const month = String(filters.month || '')
  const sortKey = filters.sortKey || 'date-desc'

  if (
    dashboardRenderCache.visibleItems &&
    dashboardRenderCache.visibleModel === model &&
    dashboardRenderCache.visibleQuery === query &&
    dashboardRenderCache.visibleFolderId === folderId &&
    dashboardRenderCache.visibleDomain === domain &&
    dashboardRenderCache.visibleMonth === month &&
    dashboardRenderCache.visibleSortKey === sortKey
  ) {
    return dashboardRenderCache.visibleItems
  }

  const visibleItems = sortDashboardItems(
    filterDashboardItems(model.items, {
      query,
      folderId,
      domain,
      month
    }),
    sortKey
  )
  dashboardRenderCache.visibleModel = model
  dashboardRenderCache.visibleQuery = query
  dashboardRenderCache.visibleFolderId = folderId
  dashboardRenderCache.visibleDomain = domain
  dashboardRenderCache.visibleMonth = month
  dashboardRenderCache.visibleSortKey = sortKey
  dashboardRenderCache.visibleItems = visibleItems
  return visibleItems
}

function getDashboardTagRecord(bookmarkId: string): BookmarkTagRecord | null {
  const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex)
  return tagIndex.records[String(bookmarkId)] || null
}

function renderDashboardSearchTools(): void {
  const parsed = parseSearchQuery(dashboardState.query)
  const chips = parsed.chips

  dom.dashboardSearchChips?.classList.toggle('hidden', chips.length === 0)
  if (dom.dashboardSearchChips) {
    dom.dashboardSearchChips.innerHTML = chips
      .map((chip) => `<span class="dashboard-search-chip ${escapeAttr(chip.kind)}">${escapeHtml(chip.label)}</span>`)
      .join('')
  }

}

function renderDashboardFolderBreadcrumbs(): void {
  if (!dom.dashboardFolderBreadcrumbs) {
    return
  }

  const selectedFolderId = String(dashboardState.folderId || '').trim()
  const selectedFolder = selectedFolderId
    ? availabilityState.folderMap.get(selectedFolderId)
    : null

  dom.dashboardFolderBreadcrumbs.classList.toggle('hidden', !selectedFolder)
  dom.dashboardFolderBreadcrumbs.innerHTML = selectedFolder
    ? buildDashboardFolderBreadcrumbMarkup(selectedFolder)
    : ''
}

function buildDashboardFolderBreadcrumbMarkup(folder: FolderRecord): string {
  const segments = buildBookmarkPathSegments(folder, availabilityState.folderMap)
  if (!segments.length) {
    return ''
  }

  return `
    <ol class="dashboard-folder-breadcrumb-list">
      <li>
        <button
          class="dashboard-folder-breadcrumb-link"
          type="button"
          data-dashboard-folder-filter=""
        >全部书签</button>
      </li>
      ${segments.map((segment) => {
        const content = segment.current || !segment.id
          ? `
            <span
              class="dashboard-folder-breadcrumb-current"
              aria-current="page"
              title="${escapeAttr(segment.path)}"
            >${escapeHtml(segment.label)}</span>
          `
          : `
            <button
              class="dashboard-folder-breadcrumb-link"
              type="button"
              data-dashboard-folder-filter="${escapeAttr(segment.id)}"
              title="${escapeAttr(segment.path)}"
            >${escapeHtml(segment.label)}</button>
          `

        return `
          <li class="dashboard-folder-breadcrumb-separator" aria-hidden="true">&gt;</li>
          <li>${content}</li>
        `
      }).join('')}
    </ol>
  `
}

function renderDashboardSelectionBar(visibleItems: DashboardItem[]): void {
  const selectedCount = getSelectedDashboardBookmarks().length
  dom.dashboardSelectionGroup.classList.toggle('hidden', selectedCount === 0)
  dom.dashboardSelectionCount.textContent = `${selectedCount} 条已选择`
  dom.dashboardSelectVisible.disabled = availabilityState.deleting || visibleItems.length === 0
  dom.dashboardClearSelection.disabled = availabilityState.deleting || selectedCount === 0
  dom.dashboardMoveSelection.disabled = availabilityState.deleting || selectedCount === 0
  dom.dashboardDeleteSelection.disabled = availabilityState.deleting || selectedCount === 0

  dom.dashboardPanel
    ?.querySelectorAll<HTMLButtonElement>('[data-dashboard-action="select-visible"]')
    .forEach((button) => {
      button.disabled = availabilityState.deleting || visibleItems.length === 0
    })
}

function applyDashboardFolderFilter(folderId: unknown): void {
  const normalizedFolderId = String(folderId || '').trim()
  const selectedFolder = normalizedFolderId
    ? availabilityState.folderMap.get(normalizedFolderId)
    : null

  dashboardState.folderId = selectedFolder ? normalizedFolderId : ''
  dashboardState.selectedIds.clear()
  dashboardState.expandedTagIds.clear()
  resetDashboardVirtualScroll()
  setDashboardStatus(selectedFolder
    ? `已筛选：${formatFolderPath(selectedFolder, availabilityState.folderMap) || selectedFolder.title}`
    : '已显示全部书签')
}

function renderDashboardCards(items: DashboardItem[]): void {
  if (availabilityState.catalogLoading) {
    virtualState.items = []
    dom.dashboardResults.classList.remove('is-virtualized')
    dom.dashboardResults.innerHTML = renderDashboardEmptyLoading('正在读取书签目录。')
    return
  }

  if (!items.length) {
    virtualState.items = []
    dom.dashboardResults.classList.remove('is-virtualized')
    dom.dashboardResults.innerHTML = dashboardState.query
      ? '<div class="detect-empty">当前搜索没有匹配的书签。</div>'
      : '<div class="detect-empty">没有可展示的书签。</div>'
    return
  }

  ensureDashboardVirtualGrid()
  virtualState.items = items

  if (items.length < DASHBOARD_VIRTUAL_THRESHOLD || !dom.dashboardResults.clientHeight) {
    dom.dashboardResults.classList.remove('is-virtualized')
    dom.dashboardResults.innerHTML = items.map((item) => buildDashboardCard(item)).join('')
    reconcileDashboardTransientUiWithRenderedItems(new Set(items.map((item) => String(item.id))))
    return
  }

  dom.dashboardResults.classList.add('is-virtualized')
  updateDashboardVirtualMetrics()

  const columnCount = Math.max(1, virtualState.columnCount)
  const totalRows = Math.ceil(items.length / columnCount)
  const totalHeight = Math.max(0, totalRows * virtualState.rowStride - DASHBOARD_GRID_GAP)
  const maxScrollTop = Math.max(0, totalHeight - virtualState.containerHeight)
  if (dom.dashboardResults.scrollTop > maxScrollTop) {
    dom.dashboardResults.scrollTop = maxScrollTop
  }
  virtualState.scrollTop = dom.dashboardResults.scrollTop

  const startRow = Math.max(0, Math.floor(virtualState.scrollTop / virtualState.rowStride) - DASHBOARD_VIRTUAL_OVERSCAN_ROWS)
  const endRow = Math.min(
    totalRows,
    Math.ceil((virtualState.scrollTop + virtualState.containerHeight) / virtualState.rowStride) + DASHBOARD_VIRTUAL_OVERSCAN_ROWS
  )
  const startIndex = startRow * columnCount
  const endIndex = Math.min(items.length, endRow * columnCount)
  const renderedItems = items.slice(startIndex, endIndex)
  const renderedIds = new Set(renderedItems.map((item) => String(item.id)))
  reconcileDashboardTransientUiWithRenderedItems(renderedIds)

  dom.dashboardResults.innerHTML = `
    <div class="dashboard-virtual-spacer" style="height: ${Math.ceil(totalHeight)}px;">
      <div
        class="dashboard-virtual-window"
        style="transform: translate3d(0, ${Math.round(startRow * virtualState.rowStride)}px, 0); grid-template-columns: repeat(${columnCount}, minmax(0, 1fr));"
      >
        ${renderedItems.map((item) => buildDashboardCard(item)).join('')}
      </div>
    </div>
  `
  updateDashboardFloatingEditorPosition(renderedIds)
}

function ensureDashboardVirtualGrid(): void {
  const container = dom.dashboardResults
  if (!container || virtualState.observedElement === container) {
    return
  }

  virtualState.observedElement?.removeEventListener('scroll', handleDashboardVirtualScroll)
  virtualState.resizeObserver?.disconnect()
  virtualState.observedElement = container

  container.addEventListener('scroll', handleDashboardVirtualScroll, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    virtualState.resizeObserver = new ResizeObserver(() => {
      scheduleDashboardVirtualRender()
    })
    virtualState.resizeObserver.observe(container)
  }
}

function handleDashboardVirtualScroll(): void {
  const container = dom.dashboardResults
  if (!container?.classList.contains('is-virtualized')) {
    return
  }

  virtualState.scrollTop = container.scrollTop
  scheduleDashboardVirtualRender()
}

function scheduleDashboardVirtualRender(): void {
  if (virtualState.frame) {
    return
  }

  virtualState.frame = window.requestAnimationFrame(() => {
    virtualState.frame = 0
    if (virtualState.items.length) {
      renderDashboardCards(virtualState.items)
    }
  })
}

function scheduleDashboardSectionRender(): void {
  if (virtualState.sectionFrame) {
    return
  }

  virtualState.sectionFrame = window.requestAnimationFrame(() => {
    virtualState.sectionFrame = 0
    renderDashboardSection()
  })
}

function resetDashboardVirtualScroll(): void {
  virtualState.scrollTop = 0
  virtualState.resetScrollOnNextRender = true
  if (dom.dashboardResults) {
    dom.dashboardResults.scrollTop = 0
  }
}

function updateDashboardVirtualMetrics(): void {
  const container = dom.dashboardResults
  if (!container) {
    virtualState.containerHeight = 0
    virtualState.columnCount = 1
    return
  }

  if (virtualState.resetScrollOnNextRender) {
    container.scrollTop = 0
    virtualState.resetScrollOnNextRender = false
  }

  const style = window.getComputedStyle(container)
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
  const paddingRight = Number.parseFloat(style.paddingRight) || 0
  const contentWidth = Math.max(1, container.clientWidth - paddingLeft - paddingRight)
  const minCardWidth = Math.min(DASHBOARD_CARD_MIN_WIDTH, contentWidth)

  virtualState.containerHeight = Math.max(1, container.clientHeight)
  virtualState.columnCount = Math.max(
    1,
    Math.floor((contentWidth + DASHBOARD_GRID_GAP) / (minCardWidth + DASHBOARD_GRID_GAP))
  )
  virtualState.rowStride = DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP
}

function reconcileDashboardTransientUiWithRenderedItems(renderedIds: Set<string>): void {
  for (const expandedId of [...dashboardState.expandedTagIds]) {
    if (!renderedIds.has(String(expandedId))) {
      dashboardState.expandedTagIds.delete(String(expandedId))
    }
  }

  const editorBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (
    editorBookmarkId &&
    !dashboardState.tagEditorSaving &&
    !renderedIds.has(editorBookmarkId)
  ) {
    clearDashboardTagEditorState()
    dom.dashboardTagEditor?.classList.add('hidden')
    dom.dashboardTagEditor?.setAttribute('aria-hidden', 'true')
  }
}

function updateDashboardFloatingEditorPosition(renderedIds: Set<string>): void {
  const editorBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (editorBookmarkId && renderedIds.has(editorBookmarkId)) {
    positionDashboardTagEditor(editorBookmarkId)
  }
}

function renderDashboardTagEditor(existingModel?: DashboardModel): void {
  if (!dom.dashboardTagEditor) {
    return
  }

  const bookmarkId = String(dashboardState.tagEditorBookmarkId || '').trim()
  if (!bookmarkId) {
    dom.dashboardTagEditor.classList.add('hidden')
    dom.dashboardTagEditor.setAttribute('aria-hidden', 'true')
    return
  }

  const model = existingModel || getDashboardRenderData().model
  const item = model.items.find((entry) => String(entry.id) === bookmarkId)
  const record = getDashboardTagRecord(bookmarkId)
  if (!item) {
    closeDashboardTagEditor()
    return
  }

  dom.dashboardTagEditor.classList.remove('hidden')
  dom.dashboardTagEditor.setAttribute('aria-hidden', 'false')
  dom.dashboardTagEditorTitle.textContent = item.title || '未命名书签'
  dom.dashboardTagEditorMeta.textContent = `${displayUrl(item.url)} · ${item.path || '未归档路径'}`
  dom.dashboardTagEditorInput.value = dashboardState.tagEditorDraft
  dom.dashboardTagEditorInput.disabled = dashboardState.tagEditorSaving
  const busyAction = String(dashboardState.tagEditorBusyAction || '')
  const statusText = dashboardState.tagEditorStatus || '用逗号、顿号或换行分隔标签。'
  dom.dashboardTagEditorStatus.textContent = statusText
  const hasAiTags = Boolean(record?.tags?.length)
  dom.dashboardTagEditorSave.disabled = dashboardState.tagEditorSaving
  dom.dashboardTagEditorSave.innerHTML = busyAction === 'save'
    ? renderDashboardLoadingLabel('保存中...', {
      wrapperClass: 'button-loading-label',
      loaderClass: 'dashboard-button-dot-loader'
    })
    : '保存标签'
  dom.dashboardTagEditorClearAi.disabled = dashboardState.tagEditorSaving || !hasAiTags
  dom.dashboardTagEditorClearAi.innerHTML = busyAction === 'clear-ai'
    ? renderDashboardLoadingLabel('清除中...', {
      wrapperClass: 'button-loading-label',
      loaderClass: 'dashboard-button-dot-loader'
    })
    : '清除 AI 标签'
  dom.dashboardTagEditorRegenerateAi.disabled =
    dashboardState.tagEditorSaving ||
    availabilityState.catalogLoading ||
    aiNamingState.running ||
    aiNamingState.applying
  dom.dashboardTagEditorRegenerateAi.innerHTML = busyAction === 'regenerate-ai'
    ? renderDashboardLoadingLabel('生成中...', {
      variant: 'spiral',
      wrapperClass: 'button-loading-label',
      loaderClass: 'dashboard-button-dot-loader'
    })
    : '重新生成 AI 标签'
  dom.dashboardTagEditor
    ?.querySelectorAll<HTMLButtonElement>('[data-dashboard-action="close-tag-editor"]')
    .forEach((button) => {
      const canCancelGeneration = busyAction === 'regenerate-ai' && dashboardState.tagEditorSaving
      button.disabled = dashboardState.tagEditorSaving && !canCancelGeneration
      button.textContent = canCancelGeneration ? '取消生成' : '取消'
      button.classList.toggle('danger', canCancelGeneration)
      button.classList.toggle('secondary', !canCancelGeneration)
    })
  positionDashboardTagEditor(bookmarkId)
}

function positionDashboardTagEditor(bookmarkId: string): void {
  const editor = dom.dashboardTagEditor
  const card = findDashboardCardElement(bookmarkId)
  if (!editor || !card) {
    return
  }

  const margin = 16
  const gap = 12
  const cardRect = card.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  const editorWidth = Math.min(editorRect.width || 430, window.innerWidth - margin * 2)
  const editorHeight = Math.min(editorRect.height || 300, window.innerHeight - margin * 2)
  const hasRightSpace = cardRect.right + gap + editorWidth <= window.innerWidth - margin
  const hasLeftSpace = cardRect.left - gap - editorWidth >= margin

  let left = hasRightSpace
    ? cardRect.right + gap
    : hasLeftSpace
      ? cardRect.left - gap - editorWidth
      : Math.min(Math.max(cardRect.left, margin), window.innerWidth - editorWidth - margin)
  let top = cardRect.top

  left = Math.min(Math.max(left, margin), window.innerWidth - editorWidth - margin)
  top = Math.min(Math.max(top, margin), window.innerHeight - editorHeight - margin)

  editor.style.left = `${Math.round(left)}px`
  editor.style.top = `${Math.round(top)}px`
  editor.style.right = 'auto'
}

function findDashboardCardElement(bookmarkId: string): HTMLElement | null {
  const cards = dom.dashboardResults?.querySelectorAll<HTMLElement>('[data-dashboard-card]') || []
  for (const card of cards) {
    if (String(card.getAttribute('data-dashboard-bookmark-id') || '') === String(bookmarkId)) {
      return card
    }
  }
  return null
}

function buildDashboardCard(item: DashboardItem): string {
  const selected = dashboardState.selectedIds.has(String(item.id))
  const expanded = dashboardState.expandedTagIds.has(String(item.id))
  const selectionLabel = getDashboardSelectionLabel(item)
  const visibleTagLimit = 1
  const tags = item.tags.slice(0, visibleTagLimit)
  const hiddenTagCount = Math.max(0, item.tags.length - tags.length)
  const copyLabel = dashboardState.copyFeedbackId === String(item.id) ? '已复制' : '复制'
  const faviconUrl = getDashboardFaviconUrl(item.url)
  const tagStatusTitle = item.hasManualTags
    ? '已有手动标签'
    : item.aiTags.length
      ? '已有 AI 标签'
      : '未生成 AI 标签'
  const itemPath = formatBookmarkPath(item.path) || '未归档路径'
  const tagMarkup = tags.length
    ? tags.map((tag) => `<span class="dashboard-mini-chip">${escapeHtml(tag)}</span>`).join('')
    : ''
  const toggleMarkup = item.tags.length > visibleTagLimit
    ? `
        <button
          class="dashboard-mini-chip dashboard-tag-toggle"
          type="button"
          data-dashboard-toggle-tags="${escapeAttr(item.id)}"
          data-dashboard-no-drag
          aria-expanded="${expanded ? 'true' : 'false'}"
          aria-controls="dashboard-tag-popover-${escapeAttr(item.id)}"
          aria-label="查看 ${escapeAttr(String(hiddenTagCount))} 个隐藏标签"
        >+${escapeHtml(String(hiddenTagCount))}</button>
      `
    : ''
  const tagPopoverMarkup = expanded && item.tags.length
    ? `
        <div id="dashboard-tag-popover-${escapeAttr(item.id)}" class="dashboard-tag-popover" data-dashboard-no-drag role="dialog" aria-modal="false" aria-label="全部标签">
          <strong>全部标签</strong>
          <div class="dashboard-tag-popover-list">
            ${item.tags.map((tag) => `<span class="dashboard-mini-chip">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      `
    : ''

  return `
    <article
      class="dashboard-bookmark-card ${selected ? 'selected' : ''} ${expanded ? 'tags-expanded' : ''}"
      data-dashboard-card
      data-dashboard-bookmark-id="${escapeAttr(item.id)}"
    >
      <div class="dashboard-card-body">
        <span class="dashboard-favicon-shell" aria-hidden="true">
          ${faviconUrl ? `<img src="${escapeAttr(faviconUrl)}" alt="" loading="lazy" decoding="async" draggable="false">` : ''}
          <span>${escapeHtml(getFallbackLabel(item.title))}</span>
        </span>
        <div class="dashboard-card-copy">
          <div class="dashboard-card-title-row">
            <strong title="${escapeAttr(item.title || '未命名书签')}">${escapeHtml(item.title || '未命名书签')}</strong>
          </div>
          <a
            class="dashboard-card-url"
            href="${escapeAttr(item.url)}"
            target="_blank"
            rel="noreferrer noopener"
            data-dashboard-no-drag
          >${escapeHtml(displayUrl(item.url))}</a>
          <div class="dashboard-card-meta">
            <button
              class="dashboard-path-chip"
              type="button"
              data-dashboard-folder-filter="${escapeAttr(item.parentId || '')}"
              data-dashboard-no-drag
              title="${escapeAttr(itemPath)}"
              aria-label="按文件夹筛选：${escapeAttr(itemPath)}"
            >${escapeHtml(itemPath)}</button>
            ${tagMarkup}
            ${toggleMarkup}
          </div>
        </div>
        <div class="dashboard-card-side">
          <span
            class="dashboard-status-dot ${item.tags.length ? 'has-tags' : ''}"
            title="${escapeAttr(tagStatusTitle)}"
          ></span>
        </div>
      </div>
      <div class="dashboard-card-footer">
        <div class="dashboard-card-actions">
          <a class="detect-result-open" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer noopener" data-dashboard-no-drag>打开</a>
          <button class="detect-result-action" type="button" data-dashboard-copy="${escapeAttr(item.id)}" data-dashboard-no-drag>${escapeHtml(copyLabel)}</button>
          <button
            class="detect-result-action"
            type="button"
            data-dashboard-action="edit-tags"
            data-dashboard-bookmark-id="${escapeAttr(item.id)}"
            data-dashboard-no-drag
          >修改标签</button>
          <button
            class="detect-result-action"
            type="button"
            data-dashboard-action="move-one"
            data-dashboard-bookmark-id="${escapeAttr(item.id)}"
            data-dashboard-no-drag
            ${availabilityState.deleting ? 'disabled' : ''}
          >移动</button>
        </div>
        <label class="dashboard-card-check" data-dashboard-no-drag>
          <input
            type="checkbox"
            data-dashboard-select="${escapeAttr(item.id)}"
            aria-label="${escapeAttr(selectionLabel)}"
            ${selected ? 'checked' : ''}
            ${availabilityState.deleting ? 'disabled' : ''}
          >
          <span class="sr-only">${escapeHtml(selectionLabel)}</span>
        </label>
      </div>
      ${tagPopoverMarkup}
    </article>
  `
}

async function copyDashboardBookmarkUrl(bookmarkId: string): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url) {
    return
  }

  try {
    await navigator.clipboard.writeText(bookmark.url)
    setDashboardStatus('链接已复制。', bookmarkId)
  } catch {
    setDashboardStatus('复制失败，请手动复制链接。')
  }
}

async function moveDashboardBookmarkToFolder(
  bookmarkId: string,
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  const targetFolder = availabilityState.folderMap.get(String(folderId))
  if (!bookmark?.url || !targetFolder) {
    setDashboardStatus('移动失败：目标书签或文件夹不存在。')
    return
  }

  if (String(bookmark.parentId || '') === folderId) {
    setDashboardStatus('书签已在该文件夹。')
    return
  }

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: '书签仪表盘拖拽移动',
      targetBookmarkIds: [bookmarkId],
      targetFolderIds: [folderId],
      estimatedChangeCount: 1
    })
    await moveBookmark(bookmarkId, folderId)
    dashboardState.selectedIds.delete(bookmarkId)
    await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    setDashboardStatus(`已移动到 ${targetFolder.path || targetFolder.title}。`)
  } catch (error) {
    setDashboardStatus(error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。')
  }
}

function setDashboardStatus(message: string, copiedId = ''): void {
  dashboardState.statusMessage = message
  dashboardState.copyFeedbackId = copiedId
  renderDashboardSection()

  if (dashboardStatusTimer) {
    window.clearTimeout(dashboardStatusTimer)
  }

  dashboardStatusTimer = window.setTimeout(() => {
    dashboardState.statusMessage = ''
    dashboardState.copyFeedbackId = ''
    renderDashboardSection()
  }, 1800)
}

function renderDashboardLoadingLabel(
  label: string,
  {
    variant = 'bar',
    wrapperClass = 'status-loading-label',
    loaderClass = 'dashboard-status-dot-loader'
  }: {
    variant?: 'bar' | 'spiral'
    wrapperClass?: string
    loaderClass?: string
  } = {}
): string {
  return `
    <span class="${escapeAttr(wrapperClass)}">
      ${renderDotMatrixLoader({ variant, className: loaderClass })}
      <span>${escapeHtml(label)}</span>
    </span>
  `
}

function renderDashboardEmptyLoading(label: string): string {
  return `
    <div class="detect-empty dashboard-loading-empty">
      ${renderDashboardLoadingLabel(label, { variant: 'spiral' })}
    </div>
  `
}

function startDashboardDrag(): void {
  if (!dragState.armed || dragState.active || dragState.moving) {
    return
  }

  const bookmark = availabilityState.bookmarkMap.get(String(dragState.bookmarkId))
  if (!bookmark?.url) {
    cancelDashboardDrag({ silent: true })
    return
  }

  dragState.armed = false
  dragState.active = true
  renderDashboardDragOverlay()
  updateDashboardDragPreviewPosition()
}

function renderDashboardDragOverlay(existingModel?: DashboardModel): void {
  if (!dom.dashboardDragOverlay || !dom.dashboardFolderDropGrid || !dom.dashboardDragPreview) {
    return
  }

  ensureDashboardDragOverlayPortal()

  const model = existingModel || buildDashboardModel({
    bookmarks: availabilityState.allBookmarks,
    folders: availabilityState.allFolders,
    tagIndex: (aiNamingState.tagIndex as BookmarkTagIndex) || null,
    contentSnapshotIndex: contentSnapshotState.index,
    contentSnapshotSearchMap: contentSnapshotState.searchTextMap,
    includeFullText: contentSnapshotState.settings.fullTextSearchEnabled
  })
  const bookmark = availabilityState.bookmarkMap.get(String(dragState.bookmarkId))
  const faviconUrl = getDashboardFaviconUrl(bookmark?.url || '')

  dom.dashboardPanel?.classList.add('is-dashboard-dragging')
  cancelExitMotion(dom.dashboardDragOverlay, 'is-closing')
  dom.dashboardDragOverlay.classList.remove('hidden')
  dom.dashboardDragOverlay.classList.toggle('is-moving', dragState.moving)
  dom.dashboardDragOverlay.setAttribute('aria-hidden', 'false')
  setDashboardDeleteDropHover(dragState.hoverDeleteTarget)
  if (dom.dashboardDragHint) {
    dom.dashboardDragHint.innerHTML = dragState.moving
      ? renderDashboardLoadingLabel('正在移动书签...', {
        wrapperClass: 'status-loading-label',
        loaderClass: 'dashboard-status-dot-loader'
      })
      : '选择目标文件夹后松开即可移动。'
  }

  dom.dashboardFolderDropGrid.innerHTML = model.folderTargets.length
    ? model.folderTargets.map((folder) => buildDashboardFolderDropCard(folder)).join('')
    : '<div class="detect-empty">没有可用的目标文件夹。</div>'
  setDashboardDropHover(dragState.hoverFolderId)

  dom.dashboardDragPreview.innerHTML = `
    <span class="dashboard-favicon-shell" aria-hidden="true">
      ${faviconUrl ? `<img src="${escapeAttr(faviconUrl)}" alt="" loading="lazy" decoding="async" draggable="false">` : ''}
      <span>${escapeHtml(getFallbackLabel(bookmark?.title || ''))}</span>
    </span>
    <span>${escapeHtml(bookmark?.title || '未命名书签')}</span>
  `
}

function buildDashboardFolderDropCard(folder: DashboardFolderTarget): string {
  const active = dragState.hoverFolderId === folder.id
  const bookmarkCopy = `${folder.bookmarkCount} 个书签`
  const folderCopy = folder.folderCount ? ` · ${folder.folderCount} 个子文件夹` : ''
  return `
    <button
      class="dashboard-folder-drop-card ${active ? 'active' : ''}"
      type="button"
      role="option"
      aria-selected="${active ? 'true' : 'false'}"
      data-dashboard-drop-folder="${escapeAttr(folder.id)}"
      title="${escapeAttr(folder.path)}"
    >
      <span class="dashboard-folder-icon" aria-hidden="true"></span>
      <span class="dashboard-folder-copy">
        <strong>${escapeHtml(folder.title)}</strong>
        <span>${escapeHtml(folder.path)}</span>
        <small>${escapeHtml(bookmarkCopy + folderCopy)}</small>
      </span>
    </button>
  `
}

function updateDashboardDragPreviewPosition(): void {
  if (!dom.dashboardDragPreview || !dragState.active) {
    return
  }

  dom.dashboardDragPreview.style.left = `${dragState.currentX}px`
  dom.dashboardDragPreview.style.top = `${dragState.currentY}px`
  dom.dashboardDragPreview.style.transform =
    'translate3d(-50%, -50%, 0)'
}

function updateDashboardDropHoverFromPoint(x: number, y: number): void {
  const element = document.elementFromPoint(x, y) as HTMLElement | null
  const deleteTarget = element?.closest<HTMLElement>('[data-dashboard-delete-drop]')
  if (deleteTarget) {
    setDashboardDeleteDropHover(true)
    setDashboardDropHover('')
    return
  }

  setDashboardDeleteDropHover(false)
  const folderCard = element?.closest<HTMLElement>('[data-dashboard-drop-folder]')
  setDashboardDropHover(String(folderCard?.getAttribute('data-dashboard-drop-folder') || '').trim())
}

function setDashboardDeleteDropHover(active: boolean): void {
  dragState.hoverDeleteTarget = active
  dom.dashboardDeleteDropTarget?.classList.toggle('active', active)
}

function setDashboardDropHover(folderId: string): void {
  dragState.hoverFolderId = String(folderId || '').trim()
  dom.dashboardFolderDropGrid
    ?.querySelectorAll<HTMLElement>('[data-dashboard-drop-folder]')
    .forEach((card) => {
      card.classList.toggle(
        'active',
        card.getAttribute('data-dashboard-drop-folder') === dragState.hoverFolderId
      )
    })
}

function hideDashboardDragOverlay(): Promise<void> {
  const overlay = dom.dashboardDragOverlay
  if (!overlay || overlay.classList.contains('hidden')) {
    dom.dashboardPanel?.classList.remove('is-dashboard-dragging')
    clearDashboardDragOverlayContent()
    return Promise.resolve()
  }

  return closeWithExitMotion(overlay, 'is-closing', () => {
    dom.dashboardPanel?.classList.remove('is-dashboard-dragging')
    overlay.classList.add('hidden')
    overlay.classList.remove('is-moving')
    overlay.setAttribute('aria-hidden', 'true')
    clearDashboardDragOverlayContent()
  }, 220)
}

function clearDashboardDragOverlayContent(): void {
  setDashboardDeleteDropHover(false)
  if (dom.dashboardFolderDropGrid) {
    dom.dashboardFolderDropGrid.innerHTML = ''
  }
  if (dom.dashboardDragPreview) {
    dom.dashboardDragPreview.innerHTML = ''
    dom.dashboardDragPreview.style.transform = ''
    dom.dashboardDragPreview.style.left = ''
    dom.dashboardDragPreview.style.top = ''
  }
}

function ensureDashboardDragOverlayPortal(): void {
  if (!dom.dashboardDragOverlay || !document.body) {
    return
  }

  if (dom.dashboardDragOverlay.parentElement !== document.body) {
    document.body.appendChild(dom.dashboardDragOverlay)
  }
}

function releaseDashboardPointerCapture(): void {
  const captureElement = dragState.captureElement
  if (!captureElement || dragState.pointerId < 0) {
    return
  }

  try {
    if (captureElement.hasPointerCapture(dragState.pointerId)) {
      captureElement.releasePointerCapture(dragState.pointerId)
    }
  } catch {
    // Capture may already be gone after DOM updates.
  }
}

function resetDashboardDragState(): boolean {
  const wasActive = dragState.active || dragState.armed
  releaseDashboardPointerCapture()
  Object.assign(dragState, createDashboardDragState(), {
    captureElement: null
  })
  return wasActive
}

async function closeDashboardDragForFollowUp({ silent = false }: { silent?: boolean } = {}): Promise<boolean> {
  const wasActive = resetDashboardDragState()
  await hideDashboardDragOverlay()

  if (wasActive && !silent) {
    setDashboardStatus('已取消移动。')
  }

  return wasActive
}

function isDashboardDragPointer(event: PointerEvent): boolean {
  return dragState.pointerId === event.pointerId && (dragState.armed || dragState.active)
}

function shouldIgnoreDashboardDragTarget(target: HTMLElement): boolean {
  return Boolean(target.closest('a, button, input, label, select, textarea, [data-dashboard-no-drag]'))
}

function suppressDashboardNativeSelection(event?: Event): void {
  if (event?.cancelable) {
    event.preventDefault()
  }
  document.getSelection()?.removeAllRanges()
}

function getTopFolder(bookmark: BookmarkRecord, folderMap: Map<string, FolderRecord>): FolderRecord | null {
  const ancestorIds = Array.isArray(bookmark.ancestorIds) ? bookmark.ancestorIds.map(String) : []
  return folderMap.get(ancestorIds[0] || '') || folderMap.get(String(bookmark.parentId || '')) || null
}

function getDashboardDateMeta(value: unknown): { key: string; label: string; known: boolean } {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return {
      key: 'unknown',
      label: '未知时间',
      known: false
    }
  }

  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return {
      key: 'unknown',
      label: '未知时间',
      known: false
    }
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return {
    key: `${year}-${month}`,
    label: formatDateTime(timestamp),
    known: true
  }
}

function normalizeDashboardTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function compareDashboardDates(left: DashboardItem, right: DashboardItem, direction: 'asc' | 'desc'): number {
  if (left.hasKnownDate !== right.hasKnownDate) {
    return left.hasKnownDate ? -1 : 1
  }
  if (!left.hasKnownDate || !right.hasKnownDate) {
    return 0
  }

  const leftDate = Number(left.dateAdded) || 0
  const rightDate = Number(right.dateAdded) || 0
  return direction === 'asc' ? leftDate - rightDate : rightDate - leftDate
}

function compareDashboardItemPath(left: DashboardItem, right: DashboardItem): number {
  return compareByPathTitle(left, right) || left.title.localeCompare(right.title, 'zh-CN')
}

function getDashboardFaviconUrl(url: string): string {
  const runtimeId = typeof chrome !== 'undefined' ? chrome.runtime?.id : ''
  if (!runtimeId || !url) {
    return ''
  }
  return `chrome-extension://${runtimeId}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`
}

function getFallbackLabel(title: string): string {
  const trimmed = String(title || '').trim()
  return (trimmed[0] || '*').toUpperCase()
}
