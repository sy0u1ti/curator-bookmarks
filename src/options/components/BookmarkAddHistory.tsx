import { useBookmarkAddHistoryState } from './bookmark-add-history-store.js'
import { BookmarkAddHistoryHeader } from './BookmarkAddHistoryHeader.js'
import { BookmarkAddHistoryList } from './BookmarkAddHistoryList.js'
import { BookmarkAddHistorySummary } from './BookmarkAddHistorySummary.js'

const BOOKMARK_ADD_HISTORY_RESULTS_CLASS = 'mt-[18px] flex flex-col gap-3'

export function BookmarkAddHistory() {
  const state = useBookmarkAddHistoryState()
  const hasSummary = Number(state.summary.total) > 0

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
