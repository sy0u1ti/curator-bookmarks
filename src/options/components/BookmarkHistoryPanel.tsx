import { BookmarkAddHistory } from './BookmarkAddHistory.js'
import { OPTION_PANEL_CLASS, OPTION_TOOL_PANEL_CLASS } from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'

const BOOKMARK_HISTORY_GROUP_CLASS = OPTION_TOOL_PANEL_CLASS

export function BookmarkHistoryPanel({ hidden }: { hidden: boolean }) {
  return (
    <section
      id="bookmark-history"
      className={OPTION_PANEL_CLASS}
      aria-labelledby="bookmark-history-title"
      hidden={hidden}
    >
      <OptionPanelHeader
        titleId="bookmark-history-title"
        title="AI 整理记录"
      />

      <div className={BOOKMARK_HISTORY_GROUP_CLASS}>
        <BookmarkAddHistory />
      </div>
    </section>
  )
}
