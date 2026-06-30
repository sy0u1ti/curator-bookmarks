import { Card } from '../../ui/base/Card'
import { NumberPop } from '../../ui/motion/NumberPop'
import type { BookmarkAddHistorySummaryState } from './BookmarkAddHistoryTypes.js'

const historyMetrics = [
  {
    label: '总记录',
    key: 'total'
  },
  {
    label: '已移动',
    key: 'moved'
  },
  {
    label: '匹配已有文件夹',
    key: 'existing'
  },
  {
    label: '新建文件夹',
    key: 'newFolder'
  }
] satisfies Array<{
  key: keyof BookmarkAddHistorySummaryState
  label: string
}>

const BOOKMARK_ADD_HISTORY_GRID_CLASS =
  'grid grid-cols-4 gap-3 mt-4 max-[1180px]:grid-cols-3 max-[760px]:grid-cols-1'
const BOOKMARK_ADD_HISTORY_SUMMARY_CARD_CLASS =
  'min-w-0 rounded-ds-sm border-ds-border-subtle bg-ds-surface-1 p-[16px_16px_14px]'
const BOOKMARK_ADD_HISTORY_SUMMARY_LABEL_CLASS =
  'block text-[11px] font-semibold uppercase leading-normal tracking-[0] text-ds-text-disabled'
const BOOKMARK_ADD_HISTORY_SUMMARY_VALUE_CLASS =
  'mt-2 block text-[22px] font-[650] leading-none tracking-[0] text-ds-text-primary'

export function BookmarkAddHistorySummary({ state }: { state: BookmarkAddHistorySummaryState }) {
  return (
    <div className={BOOKMARK_ADD_HISTORY_GRID_CLASS}>
      {historyMetrics.map((metric) => (
        <Card className={BOOKMARK_ADD_HISTORY_SUMMARY_CARD_CLASS} key={metric.key}>
          <span className={BOOKMARK_ADD_HISTORY_SUMMARY_LABEL_CLASS}>{metric.label}</span>
          <strong className={BOOKMARK_ADD_HISTORY_SUMMARY_VALUE_CLASS}>
            <NumberPop text={state[metric.key]} />
          </strong>
        </Card>
      ))}
    </div>
  )
}
