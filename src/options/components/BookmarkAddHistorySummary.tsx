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
  'options-interactive-surface m-0 mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-border-subtle max-[760px]:grid-cols-2'
const BOOKMARK_ADD_HISTORY_CELL_CLASS = 'grid content-center gap-2 bg-ds-surface-1 px-5 py-4 max-[760px]:px-4'
const BOOKMARK_ADD_HISTORY_SUMMARY_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-muted'
const BOOKMARK_ADD_HISTORY_SUMMARY_VALUE_CLASS =
  'm-0 block text-2xl font-semibold leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'

export function BookmarkAddHistorySummary({ state }: { state: BookmarkAddHistorySummaryState }) {
  return (
    <dl className={BOOKMARK_ADD_HISTORY_SUMMARY_CLASS}>
      {historyMetrics.map((metric) => (
        <div className={BOOKMARK_ADD_HISTORY_CELL_CLASS} key={metric.key}>
          <dt className={BOOKMARK_ADD_HISTORY_SUMMARY_LABEL_CLASS}>{metric.label}</dt>
          <dd className={BOOKMARK_ADD_HISTORY_SUMMARY_VALUE_CLASS}>{state[metric.key]}</dd>
        </div>
      ))}
    </dl>
  )
}
