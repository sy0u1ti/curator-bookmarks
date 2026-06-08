import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactNode } from 'react'
import { displayUrl } from '../../shared/text.js'
import { Button, Card, ThemeProvider } from '../../ui'
import { formatDateTime } from '../shared-options/utils.js'
import type { BookmarkAddHistoryEntry } from '../sections/bookmark-add-history.js'

const roots = new WeakMap<Element, Root>()

export function renderBookmarkAddHistoryIsland(
  container: Element,
  entries: BookmarkAddHistoryEntry[]
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <BookmarkAddHistoryList entries={entries} />
      </ThemeProvider>
    )
  })
}

export interface BookmarkAddHistorySummaryState {
  existing: number
  moved: number
  newFolder: number
  total: number
}

export interface BookmarkAddHistoryHeaderState {
  clearDisabled: boolean
  subtitle: string
  timestamp: string
}

export function renderBookmarkAddHistoryHeaderIsland(
  container: Element,
  state: BookmarkAddHistoryHeaderState
): void {
  renderBookmarkAddHistoryNode(container, <BookmarkAddHistoryHeader state={state} />)
}

export function renderBookmarkAddHistorySummaryIsland(
  container: Element,
  state: BookmarkAddHistorySummaryState
): void {
  renderBookmarkAddHistoryNode(container, <BookmarkAddHistorySummary state={state} />)
}

function renderBookmarkAddHistoryNode(container: Element, node: ReactNode): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(<ThemeProvider>{node}</ThemeProvider>)
  })
}

function BookmarkAddHistoryHeader({ state }: { state: BookmarkAddHistoryHeaderState }) {
  return (
    <div className="detect-results-header">
      <div>
        <strong>自动分析添加记录</strong>
        <p id="bookmark-add-history-subtitle" className="detect-results-subtitle">
          {state.subtitle}
        </p>
      </div>
      <div className="detect-results-actions">
        <span id="bookmark-add-history-timestamp" className="option-value">
          {state.timestamp}
        </span>
        <Button
          id="bookmark-add-history-clear"
          className="options-button secondary small"
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清空自动分析添加历史记录"
          disabled={state.clearDisabled}
        >
          清空自动分析添加历史
        </Button>
      </div>
    </div>
  )
}

const historyMetrics = [
  {
    label: '总记录',
    key: 'total',
    valueId: 'bookmark-add-history-total'
  },
  {
    label: '已移动',
    key: 'moved',
    valueId: 'bookmark-add-history-moved'
  },
  {
    label: '匹配已有文件夹',
    key: 'existing',
    valueId: 'bookmark-add-history-existing'
  },
  {
    label: '新建文件夹',
    key: 'newFolder',
    valueId: 'bookmark-add-history-new'
  }
] satisfies Array<{
  key: keyof BookmarkAddHistorySummaryState
  label: string
  valueId: string
}>

function BookmarkAddHistorySummary({ state }: { state: BookmarkAddHistorySummaryState }) {
  return (
    <div className="detect-history-grid bookmark-add-history-grid">
      {historyMetrics.map((metric) => (
        <Card className="summary-card compact" key={metric.valueId}>
          <span className="summary-label">{metric.label}</span>
          <strong id={metric.valueId}>{state[metric.key]}</strong>
        </Card>
      ))}
    </div>
  )
}

function BookmarkAddHistoryList({ entries }: { entries: BookmarkAddHistoryEntry[] }) {
  if (!entries.length) {
    return (
      <div className="detect-empty with-cta" data-empty-key="bookmark-add-history">
        <p className="detect-empty-title">还没有自动分析添加记录</p>
        <p className="detect-empty-detail">
          开启「自动分析」后，新增普通网页书签并完成分类时会写入这里。
        </p>
        <div className="detect-empty-actions">
          <Button
            className="options-button primary small"
            size="sm"
            type="button"
            data-empty-cta="open-auto-analyze"
          >
            开启自动分析
          </Button>
          <Button
            className="options-button secondary small"
            size="sm"
            type="button"
            variant="secondary"
            data-empty-cta="configure-ai"
          >
            配置 AI 渠道
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {entries.map((entry) => (
        <BookmarkAddHistoryCard entry={entry} key={entry.id} />
      ))}
    </>
  )
}

function BookmarkAddHistoryCard({ entry }: { entry: BookmarkAddHistoryEntry }) {
  const confidencePercent = Math.round(entry.confidence * 100)
  const folderKindText = entry.recommendationKind === 'new' ? '新建文件夹' : '已有文件夹'
  const movementText = entry.moved ? '已移动' : '已在目标文件夹'
  const originalFolder = entry.originalFolderPath || '未归档路径'
  const targetFolder = entry.targetFolderPath || '未归档路径'

  return (
    <article className="detect-result-card bookmark-add-history-card">
      <div className="detect-result-head">
        <div className="detect-result-head-left">
          <span className={['options-chip', entry.moved ? 'success' : 'muted'].join(' ')}>
            {movementText}
          </span>
          <span className="options-chip muted">{folderKindText}</span>
          <span className="options-chip muted">{confidencePercent}%</span>
        </div>
        <span className="option-value">{formatDateTime(entry.createdAt)}</span>
      </div>
      <div className="detect-result-copy">
        <strong>{entry.title || '未命名书签'}</strong>
        <div className="detect-result-url">{displayUrl(entry.url)}</div>
        <p className="detect-result-path" title={targetFolder}>
          {targetFolder}
        </p>
        {entry.moved ? (
          <div className="detect-result-detail">
            从 {originalFolder} 移动到 {targetFolder}。
          </div>
        ) : (
          <div className="detect-result-detail">书签已位于推荐文件夹：{targetFolder}。</div>
        )}
        {entry.reason ? <div className="detect-result-detail">原因：{entry.reason}</div> : null}
        {entry.summary ? <div className="history-run-summary">摘要：{entry.summary}</div> : null}
      </div>
    </article>
  )
}
