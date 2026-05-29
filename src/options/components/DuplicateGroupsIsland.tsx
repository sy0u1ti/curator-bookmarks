import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import { Button, Checkbox, ThemeProvider } from '../../ui'

export interface DuplicateBookmarkViewModel {
  id: string
  title: string
  url: string
  path: string
  parentId?: string
  ancestorIds?: unknown[]
  dateAdded?: number
}

export interface DuplicateGroupViewModel {
  id: string
  displayUrl: string
  items: DuplicateBookmarkViewModel[]
  folders: unknown[]
  isCrossFolder: boolean
  hasTitleVariants: boolean
  risk: string
  latestItemId: string
  oldestItemId: string
  shorterPathItemId: string
  fullerTitleItemId: string
  taggedItemId: string
  newTabSourceItemId: string
  recentItemId: string
  recommendedKeepId: string
  recommendation: {
    reason?: string
  }
}

export interface DuplicateSelectionStatsViewModel {
  deleteCount: number
  keepCount: number
  groupCount: number
  unsafeGroupCount: number
}

export interface DuplicateGroupsState {
  catalogLoading: boolean
  currentScopeFolderId: string
  groups: DuplicateGroupViewModel[]
  locked: boolean
  selectedIds: Set<unknown>
  selectionStats: DuplicateSelectionStatsViewModel
  tagBadgeLabels: Record<string, string>
}

const roots = new WeakMap<Element, Root>()

export function renderDuplicateGroupsIsland(container: Element, state: DuplicateGroupsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <DuplicateGroups state={state} />
      </ThemeProvider>
    )
  })
}

function DuplicateGroups({ state }: { state: DuplicateGroupsState }) {
  if (!state.catalogLoading && !state.groups.length) {
    return <div className="detect-empty">当前未发现重复书签。</div>
  }

  if (!state.groups.length) {
    return <div className="detect-empty">正在分析重复书签。</div>
  }

  return (
    <>
      <DuplicateDockedSelection locked={state.locked} selectionStats={state.selectionStats} />
      {state.groups.map((group) => (
        <DuplicateGroupCard group={group} key={group.id} state={state} />
      ))}
    </>
  )
}

function DuplicateDockedSelection({
  locked,
  selectionStats
}: {
  locked: boolean
  selectionStats: DuplicateSelectionStatsViewModel
}) {
  if (!selectionStats.deleteCount) {
    return null
  }

  const unsafe = selectionStats.unsafeGroupCount > 0

  return (
    <div className="duplicate-docked-selection" role="region" aria-label="已选重复书签操作">
      <div className="duplicate-docked-selection-copy">
        <strong>已选 {selectionStats.deleteCount} 条待移入回收站</strong>
        <p>
          将保留 {selectionStats.keepCount} 条，涉及 {selectionStats.groupCount} 组；确认前不会处理。
        </p>
        {unsafe ? (
          <p className="duplicate-docked-selection-warning">
            {selectionStats.unsafeGroupCount} 组已全选；每组至少保留 1 条后才能移入回收站。
          </p>
        ) : null}
      </div>
      <div className="duplicate-docked-selection-actions">
        <Button
          className="options-button secondary small"
          type="button"
          data-duplicate-clear-selection="true"
          disabled={locked}
          unstyled
        >
          清空选择
        </Button>
        <Button
          className="options-button danger small"
          type="button"
          data-duplicate-delete-selection="true"
          disabled={locked || unsafe}
          unstyled
        >
          移入回收站
        </Button>
      </div>
    </div>
  )
}

function DuplicateGroupCard({
  group,
  state
}: {
  group: DuplicateGroupViewModel
  state: DuplicateGroupsState
}) {
  const selectedCount = getDuplicateGroupSelectedCount(group, state.selectedIds)
  const keepCount = Math.max(0, group.items.length - selectedCount)
  const recommendedItem = getDuplicateGroupItem(group, group.recommendedKeepId) || group.items[0]
  const recommendedDeleteCount = Math.max(0, group.items.length - 1)
  const currentSelectionCopy = selectedCount > 0
    ? `已选 ${selectedCount} 条待移入回收站，保留 ${keepCount} 条。`
    : `按推荐可选择 ${recommendedDeleteCount} 条移入回收站，保留 1 条。`

  return (
    <article
      className={[
        'detect-result-card',
        'duplicate-group-card',
        group.risk === 'high' ? 'high-risk' : 'low-risk'
      ].join(' ')}
    >
      <div className="duplicate-group-header">
        <div className="duplicate-group-copy">
          <div className="duplicate-group-title-row">
            <strong title={group.displayUrl}>{group.displayUrl}</strong>
            <div className="duplicate-group-tags">
              <DuplicateGroupChips group={group} />
            </div>
          </div>
          <p className="detect-results-subtitle">
            {group.items.length} 条重复 · {group.folders.length} 个文件夹 · {currentSelectionCopy}
          </p>
        </div>
      </div>
      <div className="duplicate-recommendation">
        <div className="duplicate-recommendation-copy">
          <span className="options-chip success">推荐保留</span>
          <strong>{recommendedItem?.title || '未命名书签'}</strong>
          <p>
            {group.recommendation.reason} 按推荐会选择 {recommendedDeleteCount}
            {' '}条移入回收站；也可逐条勾选。
          </p>
          <div className="duplicate-recommendation-signals" aria-label="推荐依据">
            <DuplicateRecommendationSignals group={group} />
          </div>
        </div>
        <div className="duplicate-group-actions">
          <DuplicateStrategyButton
            disabled={state.locked}
            groupId={group.id}
            label="按推荐选择"
            strategy="recommended"
            className="duplicate-accept-suggestion"
          />
          <DuplicateStrategyButton
            disabled={state.locked}
            groupId={group.id}
            label="保留最新"
            strategy="newest"
          />
          <DuplicateStrategyButton
            disabled={state.locked}
            groupId={group.id}
            label="保留路径最短"
            strategy="shorter-path"
          />
        </div>
      </div>
      <div className="duplicate-item-list">
        {group.items.map((item) => (
          <DuplicateItemRow group={group} item={item} key={item.id} state={state} />
        ))}
      </div>
    </article>
  )
}

function DuplicateStrategyButton({
  className = '',
  disabled,
  groupId,
  label,
  strategy
}: {
  className?: string
  disabled: boolean
  groupId: string
  label: string
  strategy: string
}) {
  return (
    <Button
      className={['options-button secondary small', className].filter(Boolean).join(' ')}
      type="button"
      data-duplicate-keep-strategy={strategy}
      data-duplicate-group-id={groupId}
      disabled={disabled}
      unstyled
    >
      {label}
    </Button>
  )
}

function DuplicateGroupChips({ group }: { group: DuplicateGroupViewModel }) {
  const chips: Array<[string, string]> = [
    group.isCrossFolder ? ['warning', '跨文件夹'] : ['muted', '同文件夹'],
    group.hasTitleVariants ? ['warning', '标题不同'] : ['muted', '标题一致'],
    group.risk === 'high' ? ['danger', '高风险'] : ['success', '低风险']
  ]

  return (
    <>
      {chips.map(([tone, label]) => (
        <span className={`options-chip ${tone}`} key={label}>
          {label}
        </span>
      ))}
    </>
  )
}

function DuplicateRecommendationSignals({ group }: { group: DuplicateGroupViewModel }) {
  const signals: Array<[string, string]> = [
    ['最新', group.latestItemId],
    ['最早', group.oldestItemId],
    ['路径最短', group.shorterPathItemId],
    ['有标签/摘要', group.taggedItemId],
    ['新标签页来源', group.newTabSourceItemId],
    ['最近访问', group.recentItemId]
  ]

  return (
    <>
      {signals
        .filter(([, bookmarkId]) => Boolean(bookmarkId))
        .map(([label, bookmarkId]) => {
          const active = String(bookmarkId) === String(group.recommendedKeepId)
          return (
            <span className={['options-chip', active ? 'success' : 'muted'].join(' ')} key={label}>
              {label}
            </span>
          )
        })}
    </>
  )
}

function DuplicateItemRow({
  group,
  item,
  state
}: {
  group: DuplicateGroupViewModel
  item: DuplicateBookmarkViewModel
  state: DuplicateGroupsState
}) {
  const itemId = String(item.id)
  const selected = state.selectedIds.has(itemId)
  const recommended = itemId === String(group.recommendedKeepId)
  const selectionLabel = getDuplicateItemSelectionLabel(item)

  return (
    <div
      className={[
        'duplicate-item-row',
        selected ? 'selected pending-delete' : '',
        recommended ? 'recommended-keep' : ''
      ].filter(Boolean).join(' ')}
    >
      <Checkbox
        aria-label={selectionLabel}
        checked={selected}
        className="detect-result-check-box"
        data-bookmark-id={item.id}
        data-duplicate-select="true"
        disabled={state.locked}
        label="移入回收站"
        labelAttributes={{
          'data-bookmark-id': item.id,
          'data-duplicate-select': 'true'
        }}
        labelClassName="detect-result-check"
      />
      <div className="duplicate-item-copy">
        <div className="duplicate-item-meta">
          <strong title={item.title || '未命名书签'}>{item.title || '未命名书签'}</strong>
          <div className="duplicate-item-badges">
            <DuplicateItemBadges group={group} item={item} state={state} />
          </div>
        </div>
        <div className="detect-result-url">{displayUrl(item.url)}</div>
        <div className="detect-result-detail">添加于 {formatDuplicateDate(item.dateAdded)}</div>
        <div className="detect-result-path" title={item.path || '未归档路径'}>
          {item.path || '未归档路径'}
        </div>
      </div>
    </div>
  )
}

function DuplicateItemBadges({
  group,
  item,
  state
}: {
  group: DuplicateGroupViewModel
  item: DuplicateBookmarkViewModel
  state: DuplicateGroupsState
}) {
  const itemId = String(item.id)
  const badges: Array<[string, string]> = []

  if (state.selectedIds.has(itemId)) {
    badges.push(['danger', '待移入回收站'])
  } else if (itemId === String(group.recommendedKeepId)) {
    badges.push(['success', '推荐保留'])
  }

  if (itemId === String(group.latestItemId)) {
    badges.push(['muted', '最新'])
  }
  if (itemId === String(group.oldestItemId)) {
    badges.push(['muted', '最早'])
  }
  if (itemId === String(group.shorterPathItemId)) {
    badges.push(['muted', '路径更短'])
  }
  if (itemId === String(group.fullerTitleItemId) && group.hasTitleVariants) {
    badges.push(['muted', '标题更完整'])
  }
  if (itemId === String(group.taggedItemId)) {
    badges.push(['muted', state.tagBadgeLabels[itemId] || '有整理信息'])
  }
  if (itemId === String(group.newTabSourceItemId)) {
    badges.push(['muted', '新标签页来源'])
  }
  if (itemId === String(group.recentItemId)) {
    badges.push(['muted', '最近访问'])
  }
  if (isBookmarkInCurrentDuplicateScope(item, state.currentScopeFolderId)) {
    badges.push(['muted', '当前范围'])
  }

  const seen = new Set<string>()
  return (
    <>
      {badges
        .filter(([, label]) => {
          if (seen.has(label)) {
            return false
          }
          seen.add(label)
          return true
        })
        .map(([tone, label]) => (
          <span className={`options-chip ${tone}`} key={label}>
            {label}
          </span>
        ))}
    </>
  )
}

function getDuplicateGroupSelectedCount(group: DuplicateGroupViewModel, selectedIds: Set<unknown>): number {
  return group.items.filter((item) => selectedIds.has(String(item.id))).length
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

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value)
}
