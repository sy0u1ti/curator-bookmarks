import {
  useAvailabilityDecisionMetrics
} from './availability-overview-store.js'
import type { AvailabilityDecisionMetricsState } from './availability-overview-types.js'

const metrics: Array<{
  key: keyof AvailabilityDecisionMetricsState
  label: string
}> = [
  { key: 'scope', label: '本次范围' },
  { key: 'progress', label: '扫描进度' },
  { key: 'newCount', label: '新增异常' },
  { key: 'persistent', label: '持续异常' },
  { key: 'recovered', label: '已恢复' },
  { key: 'ignored', label: '忽略过滤' }
]

const AVAILABILITY_DECISION_CLASS =
  'mt-3 grid grid-cols-[minmax(170px,0.8fr)_minmax(0,2fr)] gap-4 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-4 max-[760px]:grid-cols-1'
const AVAILABILITY_PRIMARY_CLASS = 'grid content-center gap-1 border-r border-ds-border-subtle pr-4 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:pb-3 max-[760px]:pr-0'
const AVAILABILITY_SECONDARY_CLASS = 'grid grid-cols-2 gap-x-5 gap-y-2 max-[520px]:grid-cols-1'
const AVAILABILITY_SECONDARY_ITEM_CLASS = 'flex min-w-0 items-baseline justify-between gap-3 border-b border-ds-border-subtle py-1.5'
const AVAILABILITY_DECISION_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-secondary'
const AVAILABILITY_PRIMARY_VALUE_CLASS = 'text-[26px] font-[650] leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'
const AVAILABILITY_SECONDARY_VALUE_CLASS = 'text-sm font-semibold text-ds-text-primary tabular-nums [overflow-wrap:anywhere]'

export function AvailabilityDecisionMetrics() {
  const state = useAvailabilityDecisionMetrics()

  return (
    <div className={AVAILABILITY_DECISION_CLASS}>
      <div className={AVAILABILITY_PRIMARY_CLASS}>
        <span className={AVAILABILITY_DECISION_LABEL_CLASS}>扫描进度</span>
        <strong className={AVAILABILITY_PRIMARY_VALUE_CLASS}>{state.progress}</strong>
      </div>
      <dl className={AVAILABILITY_SECONDARY_CLASS}>
        {metrics.filter((metric) => metric.key !== 'progress').map((metric) => (
          <div key={metric.key} className={AVAILABILITY_SECONDARY_ITEM_CLASS}>
            <dt className={AVAILABILITY_DECISION_LABEL_CLASS}>{metric.label}</dt>
            <dd className={AVAILABILITY_SECONDARY_VALUE_CLASS}>{state[metric.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
