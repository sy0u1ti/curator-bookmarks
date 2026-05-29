import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import { Button, Checkbox, ThemeProvider } from '../../ui'
import { formatDateTime } from '../shared-options/utils.js'

export interface RecycleEntryViewModel {
  recycleId: string
  bookmarkId: string
  title: string
  url: string
  parentId: string
  index: number
  path: string
  source: string
  deletedAt: number
}

export interface RecycleBinState {
  entries: RecycleEntryViewModel[]
  selectedIds: Set<unknown>
  disabled: boolean
}

const roots = new WeakMap<Element, Root>()

export function renderRecycleBinIsland(container: Element, state: RecycleBinState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <RecycleBinList state={state} />
      </ThemeProvider>
    )
  })
}

function RecycleBinList({ state }: { state: RecycleBinState }) {
  if (!state.entries.length) {
    return <div className="detect-empty">回收站当前为空。</div>
  }

  return (
    <>
      {state.entries.map((entry) => (
        <RecycleEntryCard
          disabled={state.disabled}
          entry={entry}
          key={entry.recycleId}
          selected={state.selectedIds.has(String(entry.recycleId))}
        />
      ))}
    </>
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
  const clearLabel = getRecycleEntryActionLabel('清除回收站记录', entry)

  return (
    <article className={['detect-result-card', selected ? 'selected' : ''].filter(Boolean).join(' ')}>
      <div className="detect-result-head">
        <div className="detect-result-head-left">
          <Checkbox
            aria-label={selectionLabel}
            checked={selected}
            className="detect-result-check-box"
            data-recycle-id={entry.recycleId}
            data-recycle-select="true"
            disabled={disabled}
            label="选择"
            labelAttributes={{
              'data-recycle-id': entry.recycleId,
              'data-recycle-select': 'true'
            }}
            labelClassName="detect-result-check"
          />
          <span className="options-chip muted">回收站</span>
        </div>
        <div className="detect-result-actions">
          <Button
            className="detect-result-action"
            type="button"
            data-recycle-restore={entry.recycleId}
            aria-label={restoreLabel}
            disabled={disabled}
            unstyled
          >
            恢复书签
          </Button>
          <Button
            className="detect-result-action danger"
            type="button"
            data-recycle-clear={entry.recycleId}
            aria-label={clearLabel}
            disabled={disabled}
            unstyled
          >
            清除
          </Button>
        </div>
      </div>
      <div className="detect-result-copy">
        <strong>{entry.title || '未命名书签'}</strong>
        <div className="detect-result-url">{displayUrl(entry.url)}</div>
        <div className="detect-result-detail">
          来源：{entry.source || '删除'} · 删除于 {formatDateTime(entry.deletedAt)}
        </div>
        <div className="detect-result-path" title={entry.path || '未归档路径'}>
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
