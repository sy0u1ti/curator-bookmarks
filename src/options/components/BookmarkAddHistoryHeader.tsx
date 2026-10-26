import { Button } from '../../ui/base/Button'
import { handleBookmarkAddHistoryClear } from '../options-controller'
import type { BookmarkAddHistoryHeaderState } from './BookmarkAddHistoryTypes.js'

const BOOKMARK_ADD_HISTORY_HEADER_CLASS =
  'flex flex-wrap items-center justify-between gap-3'
const BOOKMARK_ADD_HISTORY_HEADER_COPY_CLASS = 'min-w-0'
const BOOKMARK_ADD_HISTORY_SUBTITLE_CLASS =
  'm-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const BOOKMARK_ADD_HISTORY_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2.5'

export function BookmarkAddHistoryHeader({ state }: { state: BookmarkAddHistoryHeaderState }) {
  return (
    <div className={BOOKMARK_ADD_HISTORY_HEADER_CLASS}>
      <div className={BOOKMARK_ADD_HISTORY_HEADER_COPY_CLASS}>
        <p className={BOOKMARK_ADD_HISTORY_SUBTITLE_CLASS}>
          {state.subtitle}
        </p>
      </div>
      <div className={BOOKMARK_ADD_HISTORY_ACTIONS_CLASS}>
        {!state.clearDisabled ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            aria-label="清空 AI 整理记录"
            onClick={handleBookmarkAddHistoryClear}
          >
            清空记录
          </Button>
        ) : null}
      </div>
    </div>
  )
}
