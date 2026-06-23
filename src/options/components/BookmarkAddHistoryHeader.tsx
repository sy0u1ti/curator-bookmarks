import { Button } from '../../ui'
import { handleBookmarkAddHistoryClear } from '../options-controller'
import type { BookmarkAddHistoryHeaderState } from './BookmarkAddHistoryTypes.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'

const BOOKMARK_ADD_HISTORY_HEADER_CLASS =
  'flex flex-wrap items-center justify-between gap-3'
const BOOKMARK_ADD_HISTORY_HEADER_COPY_CLASS = 'min-w-0'
const BOOKMARK_ADD_HISTORY_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const BOOKMARK_ADD_HISTORY_SUBTITLE_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-ds-text-secondary'
const BOOKMARK_ADD_HISTORY_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5'

export function BookmarkAddHistoryHeader({ state }: { state: BookmarkAddHistoryHeaderState }) {
  return (
    <div className={BOOKMARK_ADD_HISTORY_HEADER_CLASS}>
      <div className={BOOKMARK_ADD_HISTORY_HEADER_COPY_CLASS}>
        <strong className={BOOKMARK_ADD_HISTORY_TITLE_CLASS}>自动分析添加记录</strong>
        <p className={BOOKMARK_ADD_HISTORY_SUBTITLE_CLASS}>
          {state.subtitle}
        </p>
      </div>
      <div className={BOOKMARK_ADD_HISTORY_ACTIONS_CLASS}>
        <span className={OPTION_VALUE_CLASS}>
          {state.timestamp}
        </span>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清空自动分析添加历史记录"
          disabled={state.clearDisabled}
          onClick={handleBookmarkAddHistoryClear}
        >
          清空自动分析添加历史
        </Button>
      </div>
    </div>
  )
}
