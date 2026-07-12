import { Card } from '../../ui/base/Card'
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

const BOOKMARK_ADD_HISTORY_SUMMARY_CLASS =
  'mt-4 grid grid-cols-[minmax(150px,0.65fr)_minmax(0,2fr)] gap-4 rounded-ds-sm border-ds-border-subtle bg-ds-surface-1 p-4 max-[760px]:grid-cols-1'
const BOOKMARK_ADD_HISTORY_PRIMARY_CLASS = 'grid content-center gap-1 border-r border-ds-border-subtle pr-4 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:pb-3 max-[760px]:pr-0'
const BOOKMARK_ADD_HISTORY_SECONDARY_CLASS = 'grid grid-cols-3 gap-x-5 gap-y-2 max-[620px]:grid-cols-1'
const BOOKMARK_ADD_HISTORY_SECONDARY_ITEM_CLASS = 'flex items-baseline justify-between gap-3 border-b border-ds-border-subtle py-1.5'
const BOOKMARK_ADD_HISTORY_SUMMARY_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-secondary'
const BOOKMARK_ADD_HISTORY_SUMMARY_VALUE_CLASS =
  'block text-[28px] font-[650] leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'
const BOOKMARK_ADD_HISTORY_SECONDARY_VALUE_CLASS = 'text-sm font-semibold text-ds-text-primary tabular-nums'

export function BookmarkAddHistorySummary({ state }: { state: BookmarkAddHistorySummaryState }) {
  return (
    <Card className={BOOKMARK_ADD_HISTORY_SUMMARY_CLASS}>
      <div className={BOOKMARK_ADD_HISTORY_PRIMARY_CLASS}>
        <span className={BOOKMARK_ADD_HISTORY_SUMMARY_LABEL_CLASS}>总记录</span>
        <strong className={BOOKMARK_ADD_HISTORY_SUMMARY_VALUE_CLASS}>{state.total}</strong>
      </div>
      <dl className={BOOKMARK_ADD_HISTORY_SECONDARY_CLASS}>
        {historyMetrics.slice(1).map((metric) => (
          <div className={BOOKMARK_ADD_HISTORY_SECONDARY_ITEM_CLASS} key={metric.key}>
            <dt className={BOOKMARK_ADD_HISTORY_SUMMARY_LABEL_CLASS}>{metric.label}</dt>
            <dd className={BOOKMARK_ADD_HISTORY_SECONDARY_VALUE_CLASS}>{state[metric.key]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
