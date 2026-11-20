import { useBookmarkAddHistoryState } from './bookmark-add-history-store.js'
import { BookmarkAddHistoryHeader } from './BookmarkAddHistoryHeader.js'
import { BookmarkAddHistoryList } from './BookmarkAddHistoryList.js'
import { BookmarkAddHistorySummary } from './BookmarkAddHistorySummary.js'
import { OptionEmptyState } from './OptionEmptyState.js'

const BOOKMARK_ADD_HISTORY_RESULTS_CLASS = 'mt-[18px] flex flex-col gap-3'

export function BookmarkAddHistory() {
  const state = useBookmarkAddHistoryState()
  const hasSummary = Number(state.summary.total) > 0

  if (!state.entries.length) {
    return (
      <OptionEmptyState
        embedded
        title="还没有 AI 整理记录"
        description="AI 自动整理完成后会记录新增书签的保存位置。"
        actions={[
          { action: 'open-auto-analyze', label: '开启自动分析', variant: 'primary' },
          { action: 'configure-ai', label: '配置 AI 服务', variant: 'secondary' }
        ]}
      />
    )
  }

  return (
    <>
      <BookmarkAddHistoryHeader state={state.header} />
      {hasSummary ? <BookmarkAddHistorySummary state={state.summary} /> : null}
      <div className={BOOKMARK_ADD_HISTORY_RESULTS_CLASS}>
        <BookmarkAddHistoryList entries={state.entries} />
      </div>
    </>
  )
}
