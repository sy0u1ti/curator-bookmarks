import {
  useAvailabilityDecisionMetrics
} from './availability-overview-store.js'
import { NumberPop } from '../../ui/motion/NumberPop'
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

const AVAILABILITY_DECISION_GRID_CLASS =
  'mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-ds-sm border border-ds-border-subtle bg-[var(--ds-border-subtle)] max-[760px]:grid-cols-1'
const AVAILABILITY_DECISION_METRIC_CLASS = 'min-w-0 bg-ds-surface-1 p-[10px_12px]'
const AVAILABILITY_DECISION_LABEL_CLASS =
  'block font-mono text-[11px] font-semibold uppercase leading-normal tracking-[0] text-ds-text-disabled'
const AVAILABILITY_DECISION_VALUE_CLASS =
  'mt-1.5 block [overflow-wrap:anywhere] text-base font-[650] leading-[1.2] text-ds-text-primary'

export function AvailabilityDecisionMetrics() {
  const state = useAvailabilityDecisionMetrics()

  return (
    <div className={AVAILABILITY_DECISION_GRID_CLASS}>
      {metrics.map((metric) => (
        <div key={metric.key} className={AVAILABILITY_DECISION_METRIC_CLASS}>
          <span className={AVAILABILITY_DECISION_LABEL_CLASS}>{metric.label}</span>
          <strong className={AVAILABILITY_DECISION_VALUE_CLASS}>
            {metric.key === 'scope' ? state[metric.key] : <NumberPop text={state[metric.key]} />}
          </strong>
        </div>
      ))}
    </div>
  )
}
