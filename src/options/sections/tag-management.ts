import type { BookmarkTagIndex } from '../../shared/bookmark-tags.js'
import { getEffectiveBookmarkTags, normalizeBookmarkTagIndex } from '../../shared/bookmark-tags.js'
import {
  buildBookmarkTagUsageStats,
  deleteBookmarkTags,
  renameBookmarkTag,
  type BookmarkTagUsageStat
} from '../../shared/tag-management.js'
import type { BookmarkRecord } from '../../shared/types.js'
import { buildTagCloudItems, type TagCloudItem } from '../../shared/tag-cloud.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'
import { dom } from '../shared-options/dom.js'
import { startTagCloudPhysics, stopTagCloudPhysics } from './tag-cloud-runtime.js'

export interface TagManagementSummary {
  totalTags: number
  taggedBookmarks: number
  manualTags: number
  stats: BookmarkTagUsageStat[]
}

export function buildTagUsageSummary(index: BookmarkTagIndex, bookmarks: BookmarkRecord[] = []): TagManagementSummary {
  const normalized = normalizeBookmarkTagIndex(index)
  const bookmarkIds = new Set(bookmarks.map((bookmark) => bookmark.id))
  const scopedIndex = bookmarkIds.size
    ? normalizeBookmarkTagIndex({
      ...normalized,
      records: Object.fromEntries(
        Object.entries(normalized.records).filter(([bookmarkId]) => bookmarkIds.has(bookmarkId))
      )
    })
    : normalized
  const stats = buildBookmarkTagUsageStats(scopedIndex)

  return {
    totalTags: stats.length,
    taggedBookmarks: Object.values(scopedIndex.records)
      .filter((record) => getEffectiveBookmarkTags(record).length > 0).length,
    manualTags: stats.filter((stat) => stat.manualCount > 0).length,
    stats
  }
}

export function renameTagInIndex(index: BookmarkTagIndex, sourceTag: string, targetTag: string): BookmarkTagIndex {
  const result = renameBookmarkTag(index, sourceTag, targetTag)
  if (!String(sourceTag || '').trim() || !String(targetTag || '').trim()) {
    throw new Error('请输入要重命名的标签和新标签名。')
  }
  if (String(sourceTag).trim().toLowerCase() === String(targetTag).trim().toLowerCase()) {
    throw new Error('新标签名与原标签相同。')
  }
  if (!result.affectedRecords) {
    throw new Error(`没有找到标签「${sourceTag}」。`)
  }
  return result.index
}

export function deleteTagFromIndex(index: BookmarkTagIndex, sourceTag: string): BookmarkTagIndex {
  if (!String(sourceTag || '').trim()) {
    throw new Error('请输入要删除的标签。')
  }
  const result = deleteBookmarkTags(index, [sourceTag])
  if (!result.affectedRecords) {
    throw new Error(`没有找到标签「${sourceTag}」。`)
  }
  return result.index
}

export function renderTagManagementSection({
  index,
  bookmarks,
  status = '',
  loading = false
}: {
  index: BookmarkTagIndex
  bookmarks: BookmarkRecord[]
  status?: string
  loading?: boolean
}): void {
  if (!dom.tagManagementResults) {
    return
  }
  stopActiveTagCloud()

  const summary = buildTagUsageSummary(index, bookmarks)
  dom.tagManagementTotal.textContent = `${summary.totalTags} 个标签`
  dom.tagManagementTaggedBookmarks.textContent = `${summary.taggedBookmarks} 条书签`
  dom.tagManagementManual.textContent = `${summary.manualTags} 个手动标签`
  dom.tagManagementStatus.textContent = status || (loading ? '正在读取标签统计...' : '')

  if (dom.tagManagementRefresh) {
    dom.tagManagementRefresh.disabled = loading
  }
  if (dom.tagManagementRename) {
    dom.tagManagementRename.disabled = loading || summary.totalTags === 0
  }
  if (dom.tagManagementDelete) {
    dom.tagManagementDelete.disabled = loading || summary.totalTags === 0
  }

  if (!summary.totalTags) {
    dom.tagManagementResults.innerHTML = `
      <div class="detect-empty">
        还没有可管理的标签。先在 popup、书签仪表盘或智能分析里添加标签，之后这里会显示使用频率和整理操作。
      </div>
    `
    return
  }

  const cloud = renderTagCloud(summary.stats)
  dom.tagManagementResults.replaceChildren(cloud)
  if (cloud) {
    startTagCloudPhysics(cloud)
  }
}

function renderTagCloud(stats: BookmarkTagUsageStat[]): HTMLElement {
  const widthPx = Math.max(960, Math.floor(dom.tagManagementResults?.clientWidth || 0))
  const heightPx = Math.min(820, Math.max(520, Math.floor(window.innerHeight * 0.68)))
  const items = buildTagCloudItems(stats, {
    widthPx,
    heightPx
  })

  const root = document.createElement('div')
  root.className = 'tag-management-cloud'
  root.setAttribute('role', 'list')
  root.setAttribute('aria-label', '标签词云，字号越大表示使用越频繁')
  root.dataset.tagCloudRoot = ''

  const fragment = document.createDocumentFragment()
  for (const item of items) {
    const template = document.createElement('template')
    template.innerHTML = renderTagCloudItem(item).trim()
    const button = template.content.firstElementChild
    if (button) {
      fragment.appendChild(button)
    }
  }
  root.appendChild(fragment)
  return root
}

function renderTagCloudItem(item: TagCloudItem): string {
  const style = [
    `--tag-x: ${item.leftPercent}%`,
    `--tag-y: ${item.topPercent}%`,
    `--tag-size: ${item.fontSizePx}px`,
    `--tag-alpha: ${item.opacity}`
  ].join('; ')
  const className = [
    'tag-management-cloud-word',
    `is-${item.tier}`,
    item.accent ? 'is-prominent' : '',
    item.tail ? 'is-tail' : ''
  ].filter(Boolean).join(' ')

  return `
    <button
      class="${className}"
      type="button"
      role="listitem"
      data-tag-cloud-word
      data-tag-fill="${escapeAttr(item.tag)}"
      data-tag-x="${item.leftPercent}"
      data-tag-y="${item.topPercent}"
      data-tag-tier="${escapeAttr(item.tier)}"
      data-tag-radius="${item.radiusPx}"
      data-tag-collision-width="${item.collisionWidthPx}"
      data-tag-collision-height="${item.collisionHeightPx}"
      data-tag-collision-strength="${item.collisionStrength}"
      data-tag-mass="${item.mass}"
      data-tag-phase="${item.phase}"
      data-tag-flow="${item.flowStrength}"
      style="${escapeAttr(style)}"
      title="${escapeAttr(item.tag)}"
      aria-label="选择标签 ${escapeAttr(item.tag)}"
    >${escapeHtml(item.tag)}</button>
  `
}

export function stopActiveTagCloud(): void {
  const cloud = dom.tagManagementResults?.querySelector<HTMLElement>('[data-tag-cloud-root]')
  stopTagCloudPhysics(cloud)
}
