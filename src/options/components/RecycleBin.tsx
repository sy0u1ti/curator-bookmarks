import { displayUrl } from '../../shared/text.js'
import { useState } from 'react'
import { Input } from '../../ui/base/Input'
import { Button } from '../../ui/base/Button'
import { CheckboxControl } from '../../ui/base/Checkbox'
import { handleRecycleAction } from '../options-controller'
import { formatDateTime } from '../shared-options/utils.js'
import { OPTION_RESULT_CHECKBOX_CLASS } from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import { useRecycleBinState } from './recycle-bin-store.js'
import type { RecycleEntryViewModel } from './recycle-bin-types.js'

const RECYCLE_RESULTS_LIST_CLASS = 'mt-4 flex flex-col gap-3'
const RECYCLE_PAGE_SIZE = 30
const RECYCLE_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] [transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background-color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:border-ds-border-hover hover:bg-ds-hover'
const RECYCLE_CARD_SELECTED_CLASS = 'border-ds-border-hover bg-ds-selected'
const RECYCLE_CARD_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3 max-[760px]:flex-col'
const RECYCLE_CARD_HEAD_LEFT_CLASS = 'flex min-w-0 flex-wrap items-center gap-2.5'
const RECYCLE_CHECK_CLASS =
  'inline-flex items-center gap-2 text-xs font-semibold text-ds-text-secondary'
const RECYCLE_CARD_ACTIONS_CLASS = 'flex min-w-0 flex-wrap items-center justify-end gap-2.5'
const RECYCLE_CARD_ACTION_CLASS = 'shrink-0'
const RECYCLE_CARD_COPY_CLASS = 'mt-3 min-w-0'
const RECYCLE_CARD_TITLE_CLASS =
  'block min-w-0 text-[15px] font-semibold leading-[1.4] text-ds-text-primary [overflow-wrap:anywhere]'
const RECYCLE_CARD_URL_CLASS =
  'mt-[7px] inline-block text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const RECYCLE_CARD_DETAIL_CLASS =
  'mt-[7px] text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const RECYCLE_CARD_PATH_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-ds-text-disabled [overflow-wrap:anywhere] [word-break:break-word]'

export function RecycleBin() {
  const state = useRecycleBinState()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = state.entries.filter(entry => `${entry.title} ${entry.url} ${entry.path}`.toLocaleLowerCase().includes(normalizedQuery))
  const pageCount = Math.ceil(filtered.length / RECYCLE_PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(0, pageCount - 1))
  const visible = filtered.slice(currentPage * RECYCLE_PAGE_SIZE, (currentPage + 1) * RECYCLE_PAGE_SIZE)
  const visibleSelectedCount = visible.filter(entry => state.selectedIds.has(String(entry.recycleId))).length
  const hiddenSelectedCount = state.selectedIds.size - visibleSelectedCount

  return (
    <div className={RECYCLE_RESULTS_LIST_CLASS}>
      {state.entries.length ? <Input aria-label="搜索回收站记录" placeholder="搜索标题、网址或原文件夹" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /> : null}
      {state.selectedIds.size > 0 ? (
        <p role="status" className="m-0 text-xs text-ds-text-secondary">
          当前页已选 {visibleSelectedCount} 条，其他页或筛选外已选 {hiddenSelectedCount} 条。
        </p>
      ) : null}
      {state.entries.length ? (
        visible.map((entry) => (
          <RecycleEntryCard
            disabled={state.disabled}
            entry={entry}
            key={entry.recycleId}
            selected={state.selectedIds.has(String(entry.recycleId))}
          />
        ))
      ) : (
        <OptionEmptyState
          title="回收站为空"
          description="各清理功能删除的书签会先进入这里，恢复时尽量放回原文件夹。"
        />
      )}
      {state.entries.length && !filtered.length ? <p className="text-sm text-ds-text-secondary">没有匹配的回收记录。</p> : null}
      {pageCount > 1 ? <div className="flex items-center justify-between gap-3">
        <Button size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</Button>
        <span className="text-xs tabular-nums text-ds-text-secondary">第 {currentPage + 1} / {pageCount} 页 · {filtered.length} 条</span>
        <Button size="sm" variant="secondary" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>下一页</Button>
      </div> : null}
    </div>
  )
}

function RecycleEntryCard({
  disabled,
  entry,
  selected
}: {
  disabled: boolean
  entry: RecycleEntryViewModel
  selected: boolean
}) {
  const selectionLabel = getRecycleEntryActionLabel('选择回收站书签', entry)
  const restoreLabel = getRecycleEntryActionLabel('恢复书签', entry)
  const clearLabel = getRecycleEntryActionLabel('清除记录', entry)

  return (
    <article
      className={[
        RECYCLE_CARD_CLASS,
        selected ? RECYCLE_CARD_SELECTED_CLASS : ''
      ].filter(Boolean).join(' ')}
    >
      <div className={RECYCLE_CARD_HEAD_CLASS}>
        <div className={RECYCLE_CARD_HEAD_LEFT_CLASS}>
          <label className={RECYCLE_CHECK_CLASS} htmlFor={`recycle-entry-${entry.recycleId}`}>
            <CheckboxControl
              id={`recycle-entry-${entry.recycleId}`}
              aria-label={selectionLabel}
              checked={selected}
              className={OPTION_RESULT_CHECKBOX_CLASS}
              disabled={disabled}
              onCheckedChange={(checked) => handleRecycleAction({
                action: 'toggle-entry',
                checked,
                recycleId: entry.recycleId
              })}
              unstyled
            />
            <span>选择</span>
          </label>
        </div>
        <div className={RECYCLE_CARD_ACTIONS_CLASS}>
          <Button variant="secondary" size="sm"
            className={RECYCLE_CARD_ACTION_CLASS}
            type="button"
            aria-label={restoreLabel}
            disabled={disabled}
            onClick={() => handleRecycleAction({
              action: 'restore-entry',
              recycleId: entry.recycleId
            })}
          >
            恢复书签
          </Button>
          <Button variant="danger" size="sm"
            className={RECYCLE_CARD_ACTION_CLASS}
            type="button"
            aria-label={clearLabel}
            disabled={disabled}
            onClick={() => handleRecycleAction({
              action: 'clear-entry',
              recycleId: entry.recycleId
            })}
          >
            清除记录
          </Button>
        </div>
      </div>
      <div className={RECYCLE_CARD_COPY_CLASS}>
        <strong className={RECYCLE_CARD_TITLE_CLASS}>{entry.title || '未命名书签'}</strong>
        <div className={RECYCLE_CARD_URL_CLASS}>{displayUrl(entry.url)}</div>
        <div className={RECYCLE_CARD_DETAIL_CLASS}>
          来源：{entry.source || '删除'} · 删除于 {formatDateTime(entry.deletedAt)}
        </div>
        <div className={RECYCLE_CARD_PATH_CLASS} title={entry.path || '未归档路径'}>
          {entry.path || '未归档路径'}
        </div>
      </div>
    </article>
  )
}

function getRecycleEntryActionLabel(action: string, entry: RecycleEntryViewModel): string {
  const title = String(entry?.title || displayUrl(entry?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}...` : title

  return `${action}：${safeTitle || '未命名书签'}`
}
