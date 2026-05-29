import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { displayUrl } from '../../shared/text.js'
import { Button, ThemeProvider } from '../../ui'
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
