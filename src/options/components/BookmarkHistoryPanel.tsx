import { BookmarkAddHistory } from './BookmarkAddHistory.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_PANEL_TITLE_CLASS,
  OPTION_SECTION_LABEL_CLASS
} from './option-layout-classes.js'

const BOOKMARK_HISTORY_GROUP_CLASS =
  'mt-5 rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[var(--ui-surface)] p-[18px_20px_20px] shadow-none max-[760px]:p-4'

export function BookmarkHistoryPanel({ hidden }: { hidden: boolean }) {
  return (
    <section
      id="bookmark-history"
      className={OPTION_PANEL_CLASS}
      aria-labelledby="bookmark-history-title"
      hidden={hidden}
    >
      <p className={OPTION_SECTION_LABEL_CLASS}>Auto Analysis Add History</p>
      <h1 id="bookmark-history-title" className={OPTION_PANEL_TITLE_CLASS}>自动分析添加历史</h1>

      <div className={BOOKMARK_HISTORY_GROUP_CLASS}>
        <BookmarkAddHistory />
      </div>
    </section>
  )
}
