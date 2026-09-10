import { displayUrl } from '../../shared/text.js'
import { formatDateTime } from '../shared-options/utils.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'
import { OptionDetails } from './OptionDetails.js'
import type { BookmarkAddHistoryEntry } from '../sections/bookmark-add-history.js'

export function BookmarkAddHistoryCard({ entry }: { entry: BookmarkAddHistoryEntry }) {
  const originalFolder = entry.originalFolderPath || '未归档'
  const targetFolder = entry.targetFolderPath || '未归档'
  return (
    <article className="min-w-0 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-h-6 items-center rounded-full border border-ds-border bg-ds-surface-2 px-2.5 text-xs font-medium text-ds-text-secondary">{entry.moved ? '已移动' : '位置未变'}</span>
        <span className={OPTION_VALUE_CLASS}>{formatDateTime(entry.createdAt)}</span>
      </div>
      <strong className="mt-3 block text-[15px] font-semibold leading-6 text-ds-text-primary [overflow-wrap:anywhere]">{entry.title || '未命名书签'}</strong>
      <div className="mt-1 truncate text-[13px] leading-5 text-ds-text-secondary" title={entry.url}>{displayUrl(entry.url)}</div>
      <p className="mb-0 mt-2 text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere]">
        {entry.moved ? <>{originalFolder}<span className="px-2 text-ds-text-muted" aria-label="移至">→</span></> : null}{targetFolder}
      </p>
      <OptionDetails className="mt-3" label="整理详情" ariaLabel={'整理详情：' + entry.title}>
        <div className="grid gap-2 text-[13px] leading-[1.65] text-ds-text-secondary [overflow-wrap:anywhere]">
          <p className="m-0 text-xs text-ds-text-muted">推荐类型：{entry.recommendationKind === 'new' ? '新建文件夹' : '已有文件夹'} · 模型置信度 {Math.round(entry.confidence * 100)}%</p>
          {entry.reason ? <p className="m-0">{entry.reason}</p> : null}
          {entry.summary ? <p className="m-0">{entry.summary}</p> : null}
        </div>
      </OptionDetails>
    </article>
  )
}
