import { OPTION_INSET_CLASS } from './option-layout-classes.js'
import { memo, startTransition, useEffect, useState } from 'react'
import { runIdle } from '../../shared/idle.js'
import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { Checkbox } from '../../ui/base/Checkbox'
import { TextSwap } from '../../ui/motion/TextSwap'
import { useMotionEntrance } from '../../ui/motion/useMotionEntrance'
import { handleDuplicateAction } from '../options-controller'
import { useDuplicateGroupsState } from './duplicate-groups-store.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import type {
  DuplicateBookmarkViewModel,
  DuplicateGroupViewModel,
  DuplicateSelectionStatsViewModel
} from './duplicate-groups-types.js'

// Large catalogs can have hundreds of groups. Rendering them all at once froze
// the section switch, so the first groups render immediately and the rest are
// appended in small idle-time chunks below them.
const DUPLICATE_GROUP_INITIAL_RENDER_COUNT = 24
const DUPLICATE_GROUP_RENDER_CHUNK_SIZE = 24

const DUPLICATE_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const RESULTS_CLASS = 'mt-4 flex flex-col gap-2'
const EMPTY_CLASS =
  `${OPTION_INSET_CLASS} p-[14px_16px] text-[13px] leading-[1.55] text-ds-text-secondary shadow-none transition-colors hover:border-ds-border hover:bg-ds-hover`
const DOCKED_SELECTION_CLASS =
  't-panel-slide sticky top-3 z-[5] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-ds-sm border border-ds-border bg-ds-surface-2 p-[12px_14px] [filter:var(--ds-filter-card)] [--panel-translate-y:12px] max-[760px]:static max-[760px]:grid-cols-1'
const DOCKED_COPY_CLASS = 'min-w-0'
const DOCKED_TITLE_CLASS = 'block text-sm font-bold text-ds-text-primary'
const DOCKED_TEXT_CLASS = 'mt-[5px] text-xs leading-[1.55] text-[rgba(245,245,247,0.58)]'
const DOCKED_WARNING_CLASS = `${DOCKED_TEXT_CLASS} font-semibold text-ds-danger-text`
const DOCKED_ACTIONS_CLASS =
  'flex flex-wrap items-center justify-end gap-2 max-[760px]:justify-start'
const DOCKED_ACTION_BUTTON_CLASS = 'max-[760px]:flex-1 max-[760px]:basis-[132px]'
const GROUP_CARD_CLASS =
  `duplicate-group ${OPTION_INSET_CLASS} p-4 shadow-none`
const GROUP_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-start justify-between gap-2.5 max-[760px]:flex-col max-[760px]:items-stretch'
const GROUP_COPY_CLASS = 'min-w-0'
const GROUP_TITLE_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-normal text-ds-text-primary max-[760px]:whitespace-normal'
const GROUP_SUBTITLE_CLASS = 'mb-0 mt-1 text-xs leading-relaxed text-ds-text-secondary'
const RECOMMENDATION_TEXT_CLASS =
  'mb-0 mt-2 text-xs leading-relaxed text-ds-text-secondary'
const ITEM_LIST_CLASS = 'mt-3 flex flex-col'
const ITEM_ROW_CLASS =
  'duplicate-item grid grid-cols-[24px_minmax(0,1fr)] items-start gap-2.5 border-t border-ds-border-subtle px-2 py-3 transition-colors hover:bg-ds-hover'
const ITEM_ROW_PENDING_CLASS = 'bg-ds-danger-soft'
const ITEM_CHECK_LABEL_CLASS =
  'inline-flex size-6 items-center justify-center self-start'
const ITEM_COPY_CLASS = 'min-w-0'
const ITEM_META_CLASS =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5'
const ITEM_TITLE_CLASS =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold text-ds-text-primary max-[760px]:whitespace-normal'
const ITEM_DETAIL_CLASS = 'text-right text-xs leading-relaxed text-ds-text-secondary tabular-nums'
const ITEM_PATH_CLASS =
  'min-w-0 truncate text-xs leading-relaxed text-ds-text-secondary max-[520px]:whitespace-normal max-[520px]:[overflow-wrap:anywhere]'
const ITEM_STATE_CLASS = 'whitespace-nowrap text-xs font-medium leading-relaxed text-ds-text-secondary'

export function DuplicateGroups() {
  const state = useDuplicateGroupsState()
  const renderCount = useProgressiveRenderCount(state.groups.length)

  if (!state.catalogLoading && !state.groups.length) {
    return (
      <div className={RESULTS_CLASS}>
        <OptionEmptyState
          title="未发现重复书签"
          description="按 URL 聚合检测；发现重复后会给出推荐保留项，其余可移入回收站。"
        />
      </div>
    )
  }

  if (!state.groups.length) {
    return (
      <div className={RESULTS_CLASS}>
        <div className={EMPTY_CLASS}>正在分析重复书签。</div>
      </div>
    )
  }

  return (
    <div className={RESULTS_CLASS}>
      <DuplicateDockedSelection locked={state.locked} selectionStats={state.selectionStats} />
      {state.groups.slice(0, renderCount).map((group) => (
        <DuplicateGroupCard
          currentScopeFolderId={state.currentScopeFolderId}
          group={group}
          key={group.id}
          locked={state.locked}
          selectedIds={state.selectedIds}
          selectionKey={getDuplicateGroupSelectionKey(group, state.selectedIds)}
          taggedLabel={state.tagBadgeLabels[String(group.taggedItemId)] || ''}
        />
      ))}
    </div>
  )
}

function useProgressiveRenderCount(total: number): number {
  const [count, setCount] = useState(DUPLICATE_GROUP_INITIAL_RENDER_COUNT)

  useEffect(() => {
    if (count >= total) {
      return undefined
    }

    let cancelled = false
    runIdle(() => {
      if (!cancelled) {
        startTransition(() => setCount((current) => current + DUPLICATE_GROUP_RENDER_CHUNK_SIZE))
      }
    }, { timeout: 200 })
    return () => {
      cancelled = true
    }
  }, [count, total])

  return Math.min(count, total)
}

function DuplicateDockedSelection({
  locked,
  selectionStats
}: {
  locked: boolean
  selectionStats: DuplicateSelectionStatsViewModel
}) {
  const entered = useMotionEntrance(Boolean(selectionStats.deleteCount))

  if (!selectionStats.deleteCount) {
    return null
  }

  const unsafe = selectionStats.unsafeGroupCount > 0

  return (
    <section className={DOCKED_SELECTION_CLASS} data-open={entered ? 'true' : 'false'} aria-label="已选重复书签操作">
      <div className={DOCKED_COPY_CLASS}>
        <strong className={DOCKED_TITLE_CLASS}>
          <TextSwap
            animate={entered}
            text={`已选 ${selectionStats.deleteCount} 条待移入回收站`}
          />
        </strong>
        <p className={DOCKED_TEXT_CLASS}>
          保留 {selectionStats.keepCount} 条，涉及 {selectionStats.groupCount} 组。
        </p>
        {unsafe ? (
          <p className={DOCKED_WARNING_CLASS}>
            {selectionStats.unsafeGroupCount} 组已全选；每组至少保留 1 条后才能移入回收站。
          </p>
        ) : null}
      </div>
      <div className={DOCKED_ACTIONS_CLASS}>
        <Button
          className={DOCKED_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          disabled={locked}
          onClick={() => handleDuplicateAction({ action: 'clear-selection' })}
        >
          清空选择
        </Button>
        <Button
          className={DOCKED_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="danger"
          disabled={locked || unsafe}
          onClick={() => handleDuplicateAction({ action: 'delete-selection' })}
        >
          移入回收站
        </Button>
      </div>
    </section>
  )
}

interface DuplicateGroupCardProps extends DuplicateItemContext {
  group: DuplicateGroupViewModel
  // The selected set is mutated in place; this key changes when this group's
  // selection does, so unchanged cards skip re-rendering on every toggle.
  selectionKey: string
}

interface DuplicateItemContext {
  currentScopeFolderId: string
  locked: boolean
  selectedIds: Set<unknown>
  taggedLabel: string
}

const DuplicateGroupCard = memo(function DuplicateGroupCard({
  currentScopeFolderId,
  group,
  locked,
  selectedIds,
  taggedLabel
}: DuplicateGroupCardProps) {
  const context: DuplicateItemContext = { currentScopeFolderId, locked, selectedIds, taggedLabel }
  const selectedCount = getDuplicateGroupSelectedCount(group, selectedIds)
  const keepCount = Math.max(0, group.items.length - selectedCount)
  const recommendedItem = getDuplicateGroupItem(group, group.recommendedKeepId) || group.items[0]
  const orderedItems = recommendedItem
    ? [recommendedItem, ...group.items.filter(item => item.id !== recommendedItem.id)]
    : group.items
  const reviewNote = [
    group.hasTitleVariants ? '标题不同' : '',
    group.isCrossFolder ? '分布在不同文件夹' : ''
  ].filter(Boolean).join('、')

  return (
    <article
      className={GROUP_CARD_CLASS}
      data-duplicate-group={group.id}
    >
      <div className={GROUP_HEADER_CLASS}>
        <div className={GROUP_COPY_CLASS}>
          <strong className={GROUP_TITLE_CLASS} title={group.displayUrl}>{group.displayUrl}</strong>
          <p className={GROUP_SUBTITLE_CLASS}>
            {group.items.length} 个副本 · {group.folders.length} 个文件夹
            {selectedCount > 0 ? ` · 已选 ${selectedCount} 条，保留 ${keepCount} 条` : ''}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={locked}
          aria-label={`按推荐选择 ${group.displayUrl} 的待清理副本`}
          onClick={() => handleDuplicateAction({ action: 'group-strategy', groupId: group.id, strategy: 'recommended' })}
        >
          选择其余副本
        </Button>
      </div>
      {reviewNote ? <p className={RECOMMENDATION_TEXT_CLASS}>{reviewNote}，请确认是否需要分别保留。</p> : null}
      {selectedCount === group.items.length ? (
        <p className="mb-0 mt-2 text-xs font-semibold text-ds-danger-text" role="alert">已选中全部副本，至少保留 1 条才能清理。</p>
      ) : null}
      <div className={ITEM_LIST_CLASS}>
        {orderedItems.map((item) => (
          <DuplicateItemRow context={context} group={group} item={item} key={item.id} />
        ))}
      </div>
    </article>
  )
})

function DuplicateItemRow({
  context,
  group,
  item
}: {
  context: DuplicateItemContext
  group: DuplicateGroupViewModel
  item: DuplicateBookmarkViewModel
}) {
  const itemId = String(item.id)
  const selected = context.selectedIds.has(itemId)
  const recommended = itemId === String(group.recommendedKeepId)
  const selectionLabel = getDuplicateItemSelectionLabel(item)
  const sourceWarning = selected && itemId === String(group.newTabSourceItemId)
  const showRecommendation = recommended && group.recommendation.reason &&
    !(sourceWarning && group.recommendation.kind === 'newtab-source')
  const explainedKind = showRecommendation ? group.recommendation.kind : ''
  const tagExplained = ['manual-tags', 'ai-tags', 'summary', 'tagged'].includes(explainedKind || '')
  const details = [
    !tagExplained && itemId === String(group.taggedItemId) ? context.taggedLabel || '有整理信息' : '',
    !sourceWarning && explainedKind !== 'newtab-source' && itemId === String(group.newTabSourceItemId) ? '新标签页来源' : '',
    explainedKind !== 'recent' && itemId === String(group.recentItemId) ? '最近访问' : '',
    isBookmarkInCurrentDuplicateScope(item, context.currentScopeFolderId) ? '当前范围' : ''
  ].filter(Boolean).join(' · ')

  return (
    <div
      className={[
        ITEM_ROW_CLASS,
        selected ? ITEM_ROW_PENDING_CLASS : ''
      ].filter(Boolean).join(' ')}
      data-bookmark-id={itemId}
      data-recommended={recommended || undefined}
    >
      <Checkbox
        aria-label={selectionLabel}
        checked={selected}
        disabled={context.locked}
        labelClassName={ITEM_CHECK_LABEL_CLASS}
        onCheckedChange={(checked) => handleDuplicateAction({
          action: 'toggle-item',
          bookmarkId: item.id,
          checked
        })}
      />
      <div className={ITEM_COPY_CLASS}>
        <div className={ITEM_META_CLASS}>
          <strong className={ITEM_TITLE_CLASS} title={`${item.title || '未命名书签'}\n${item.url}`}>{item.title || '未命名书签'}</strong>
          <span className={`${ITEM_STATE_CLASS} ${selected ? 'text-ds-danger-text' : recommended ? 'text-ds-text-primary' : ''}`}>
            {selected ? '待清理' : recommended ? '推荐保留' : '保留'}
          </span>
          <span className={ITEM_PATH_CLASS} title={item.path || '未归档路径'}>{item.path || '未归档路径'}</span>
          <span className={ITEM_DETAIL_CLASS} title={Number(item.dateAdded) > 0 ? new Date(Number(item.dateAdded)).toLocaleString('zh-CN') : undefined}>
            {formatDuplicateDate(item.dateAdded)}
          </span>
        </div>
        {showRecommendation ? <p className={RECOMMENDATION_TEXT_CLASS}>{group.recommendation.reason}</p> : null}
        {details ? <p className="mb-0 mt-1 text-xs leading-relaxed text-ds-text-secondary">{details}</p> : null}
        {sourceWarning ? (
          <p className="mb-0 mt-1 text-xs leading-relaxed text-ds-danger-text">此副本用于新标签页，清理后该入口也会移除。</p>
        ) : null}
      </div>
    </div>
  )
}

function getDuplicateGroupSelectedCount(group: DuplicateGroupViewModel, selectedIds: Set<unknown>): number {
  return group.items.filter((item) => selectedIds.has(String(item.id))).length
}

function getDuplicateGroupSelectionKey(group: DuplicateGroupViewModel, selectedIds: Set<unknown>): string {
  let key = ''
  for (const item of group.items) {
    if (selectedIds.has(String(item.id))) {
      key += `${String(item.id)},`
    }
  }
  return key
}

function getDuplicateGroupItem(group: DuplicateGroupViewModel, bookmarkId: unknown): DuplicateBookmarkViewModel | null {
  const normalizedId = String(bookmarkId || '')
  return group.items.find((item) => String(item.id) === normalizedId) || null
}

function getDuplicateItemSelectionLabel(item: DuplicateBookmarkViewModel): string {
  const title = String(item?.title || displayUrl(item?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}...` : title
  const path = String(item?.path || '').replace(/\s+/g, ' ').trim()

  return path
    ? `移入回收站：${safeTitle || '未命名书签'}，位置：${path}`
    : `移入回收站：${safeTitle || '未命名书签'}`
}

function isBookmarkInCurrentDuplicateScope(item: DuplicateBookmarkViewModel, scopeFolderId: string): boolean {
  const normalizedScopeFolderId = String(scopeFolderId || '').trim()
  if (!normalizedScopeFolderId) {
    return false
  }

  const ancestorIds = Array.isArray(item.ancestorIds) ? item.ancestorIds.map((id) => String(id)) : []
  return String(item.parentId || '') === normalizedScopeFolderId || ancestorIds.includes(normalizedScopeFolderId)
}

function formatDuplicateDate(timestamp: unknown): string {
  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0) {
    return '未知时间'
  }

  return DUPLICATE_DATE_FORMATTER.format(value)
}
