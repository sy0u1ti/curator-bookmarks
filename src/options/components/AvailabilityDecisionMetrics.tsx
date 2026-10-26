import {
  useAvailabilityDecisionMetrics
} from './availability-overview-store.js'
import type { AvailabilityDecisionMetricsState } from './availability-overview-types.js'

// Progress and scope are owned by the progress row and the scope picker; this
// grid only carries the history-derived counts shown nowhere else.
const metrics: Array<{
  key: keyof AvailabilityDecisionMetricsState
  label: string
}> = [
  { key: 'newCount', label: '新增异常' },
  { key: 'persistent', label: '持续异常' },
  { key: 'recovered', label: '已恢复' },
  { key: 'ignored', label: '忽略过滤' }
]

const AVAILABILITY_DECISION_CLASS =
  'mt-4 grid grid-cols-4 gap-x-5 gap-y-2 max-[760px]:grid-cols-2'
const AVAILABILITY_DECISION_ITEM_CLASS = 'flex min-w-0 items-baseline justify-between gap-3 border-b border-ds-border-subtle py-1.5'
const AVAILABILITY_DECISION_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-secondary'
const AVAILABILITY_DECISION_VALUE_CLASS = 'text-sm font-semibold text-ds-text-primary tabular-nums [overflow-wrap:anywhere]'

export function AvailabilityDecisionMetrics() {
  const state = useAvailabilityDecisionMetrics()

  return (
    <dl className={AVAILABILITY_DECISION_CLASS}>
      {metrics.map((metric) => (
        <div key={metric.key} className={AVAILABILITY_DECISION_ITEM_CLASS}>
          <dt className={AVAILABILITY_DECISION_LABEL_CLASS}>{metric.label}</dt>
          <dd className={AVAILABILITY_DECISION_VALUE_CLASS}>{state[metric.key]}</dd>
        </div>
      ))}
    </dl>
  )
}