import { Button } from '../../ui/base/Button.js'
import { navigateToOptionsEmptyStateAction } from '../options-section-store.js'
import type { BookmarkAddHistoryEntry } from '../sections/bookmark-add-history.js'
import { BookmarkAddHistoryCard } from './BookmarkAddHistoryCard.js'

const EMPTY_STATE_CLASS =
  'grid gap-2 rounded-[18px] border border-[var(--ui-divider-subtle)] bg-[#171719] p-[22px_22px_20px] text-left text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const EMPTY_TITLE_CLASS =
  'm-0 text-sm font-bold leading-[1.4] text-[var(--ui-text-primary)]'
const EMPTY_DETAIL_CLASS =
  'm-0 text-xs leading-[1.6] text-[var(--ui-text-secondary)]'
const EMPTY_ACTIONS_CLASS = 'mt-1 flex flex-wrap gap-2'

export function BookmarkAddHistoryList({ entries }: { entries: BookmarkAddHistoryEntry[] }) {
  if (!entries.length) {
    return (
      <div className={EMPTY_STATE_CLASS}>
        <p className={EMPTY_TITLE_CLASS}>还没有自动分析添加记录</p>
        <p className={EMPTY_DETAIL_CLASS}>
          开启「自动分析」后，新增普通网页书签并完成分类时会写入这里。
        </p>
        <div className={EMPTY_ACTIONS_CLASS}>
          <Button
            size="sm"
            type="button"
            variant="primary"
            onClick={() => navigateToOptionsEmptyStateAction('open-auto-analyze')}
          >
            开启自动分析
          </Button>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => navigateToOptionsEmptyStateAction('configure-ai')}
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
