import { displayUrl } from '../../shared/text.js'
import { formatDateTime } from '../shared-options/utils.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'
import type { BookmarkAddHistoryEntry } from '../sections/bookmark-add-history.js'

const BOOKMARK_ADD_HISTORY_CARD_CLASS =
  'rounded-[18px] border border-[var(--ui-divider-subtle)] bg-[#171719] p-[16px_16px_15px]'
const BOOKMARK_ADD_HISTORY_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3'
const BOOKMARK_ADD_HISTORY_HEAD_LEFT_CLASS =
  'flex min-w-0 flex-wrap items-center gap-2.5'
const BOOKMARK_ADD_HISTORY_COPY_CLASS = 'mt-3 min-w-0'
const BOOKMARK_ADD_HISTORY_TITLE_CLASS =
  'block min-w-0 text-[15px] font-semibold leading-[1.4] text-[var(--ui-text-primary)] [overflow-wrap:anywhere]'
const BOOKMARK_ADD_HISTORY_URL_CLASS =
  'mt-[7px] inline-block text-[13px] leading-[1.6] text-[var(--ui-text-secondary)] [overflow-wrap:anywhere] [word-break:break-word]'
const BOOKMARK_ADD_HISTORY_PATH_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-[var(--ui-text-disabled)] [overflow-wrap:anywhere] [word-break:break-word]'
const BOOKMARK_ADD_HISTORY_DETAIL_CLASS =
  'mt-[7px] text-[13px] leading-[1.6] text-[var(--ui-text-secondary)] [overflow-wrap:anywhere] [word-break:break-word]'
const BOOKMARK_ADD_HISTORY_SUMMARY_CLASS =
  'text-[13px] leading-[1.65] text-[var(--ui-text-secondary)]'
const BOOKMARK_ADD_HISTORY_BADGE_BASE_CLASS =
  'inline-flex min-h-7 max-w-full flex-none items-center justify-center rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0] whitespace-nowrap max-[760px]:whitespace-normal'
const BOOKMARK_ADD_HISTORY_BADGE_TONE_CLASS = {
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-secondary)]',
  success: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]'
} as const

export function BookmarkAddHistoryCard({ entry }: { entry: BookmarkAddHistoryEntry }) {
  const confidencePercent = Math.round(entry.confidence * 100)
  const folderKindText = entry.recommendationKind === 'new' ? '新建文件夹' : '已有文件夹'
  const movementText = entry.moved ? '已移动' : '已在目标文件夹'
  const originalFolder = entry.originalFolderPath || '未归档路径'
  const targetFolder = entry.targetFolderPath || '未归档路径'

  return (
    <article className={BOOKMARK_ADD_HISTORY_CARD_CLASS}>
      <div className={BOOKMARK_ADD_HISTORY_HEAD_CLASS}>
        <div className={BOOKMARK_ADD_HISTORY_HEAD_LEFT_CLASS}>
          <HistoryBadge tone={entry.moved ? 'success' : 'muted'}>
            {movementText}
          </HistoryBadge>
          <HistoryBadge>{folderKindText}</HistoryBadge>
          <HistoryBadge>{`${confidencePercent}%`}</HistoryBadge>
        </div>
        <span className={OPTION_VALUE_CLASS}>{formatDateTime(entry.createdAt)}</span>
      </div>
      <div className={BOOKMARK_ADD_HISTORY_COPY_CLASS}>
        <strong className={BOOKMARK_ADD_HISTORY_TITLE_CLASS}>{entry.title || '未命名书签'}</strong>
        <div className={BOOKMARK_ADD_HISTORY_URL_CLASS}>{displayUrl(entry.url)}</div>
        <p className={BOOKMARK_ADD_HISTORY_PATH_CLASS} title={targetFolder}>
          {targetFolder}
        </p>
        {entry.moved ? (
          <div className={BOOKMARK_ADD_HISTORY_DETAIL_CLASS}>
            从 {originalFolder} 移动到 {targetFolder}。
          </div>
        ) : (
          <div className={BOOKMARK_ADD_HISTORY_DETAIL_CLASS}>书签已位于推荐文件夹：{targetFolder}。</div>
        )}
        {entry.reason ? <div className={BOOKMARK_ADD_HISTORY_DETAIL_CLASS}>原因：{entry.reason}</div> : null}
        {entry.summary ? <div className={BOOKMARK_ADD_HISTORY_SUMMARY_CLASS}>摘要：{entry.summary}</div> : null}
      </div>
    </article>
  )
}

function HistoryBadge({
  children,
  tone = 'muted'
}: {
  children: string
  tone?: keyof typeof BOOKMARK_ADD_HISTORY_BADGE_TONE_CLASS
}) {
  return (
    <span className={[
      BOOKMARK_ADD_HISTORY_BADGE_BASE_CLASS,
      BOOKMARK_ADD_HISTORY_BADGE_TONE_CLASS[tone]
    ].join(' ')}>
      {children}
    </span>
  )
}
