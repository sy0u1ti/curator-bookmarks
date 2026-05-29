import type { BookmarkTagIndex } from '../../shared/bookmark-tags.js'
import { getEffectiveBookmarkTags, normalizeBookmarkTagIndex } from '../../shared/bookmark-tags.js'
import {
  buildBookmarkTagUsageStats,
  deleteBookmarkTags,
  renameBookmarkTag,
  type BookmarkTagUsageStat
} from '../../shared/tag-management.js'
import type { BookmarkRecord } from '../../shared/types.js'
import { buildTagCloudItems } from '../../shared/tag-cloud.js'
import { dom } from '../shared-options/dom.js'
import { startTagCloudPhysics, stopTagCloudPhysics } from './tag-cloud-runtime.js'
import { renderTagManagementCloudIsland } from '../components/TagManagementCloudIsland.js'

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

  const cloud = renderTagCloud(summary.stats)
  if (cloud) {
    startTagCloudPhysics(cloud)
  }
}

function renderTagCloud(stats: BookmarkTagUsageStat[]): HTMLElement | null {
  const widthPx = Math.max(960, Math.floor(dom.tagManagementResults?.clientWidth || 0))
  const heightPx = Math.min(820, Math.max(520, Math.floor(window.innerHeight * 0.68)))
  const items = buildTagCloudItems(stats, {
    widthPx,
    heightPx
  })

  return renderTagManagementCloudIsland(dom.tagManagementResults, items)
}

export function stopActiveTagCloud(): void {
  const cloud = dom.tagManagementResults?.querySelector<HTMLElement>('[data-tag-cloud-root]')
  stopTagCloudPhysics(cloud)
}
