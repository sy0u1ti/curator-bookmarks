import {
  type AiAnalysisDecisionMetricsState,
  useAiAnalysisDecisionMetrics
} from './ai-analysis-status-store.js'
import { AI_ANALYSIS_METRIC_LABEL_CLASS } from './ai-analysis-classes.js'

const metrics: Array<{
  key: keyof AiAnalysisDecisionMetricsState
  label: string
}> = [
  { key: 'eligible', label: '可处理' },
  { key: 'suggested', label: '已建议' },
  { key: 'manualReview', label: '待确认' },
  { key: 'unchanged', label: '无需改名' },
  { key: 'highConfidence', label: '高置信' },
  { key: 'mediumConfidence', label: '中置信' },
  { key: 'lowConfidence', label: '低置信' },
  { key: 'failed', label: '失败' }
]

const AI_ANALYSIS_DECISION_GRID_CLASS =
  'mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-ds-sm border border-ds-border-subtle bg-[var(--ds-border-subtle)] max-[760px]:grid-cols-1'
const AI_ANALYSIS_DECISION_CELL_CLASS =
  'min-w-0 bg-ds-surface-1 p-[10px_12px]'
const AI_ANALYSIS_DECISION_VALUE_CLASS =
  'mt-1.5 block text-base font-[650] leading-[1.2] text-ds-text-primary [overflow-wrap:anywhere]'

export function AiAnalysisDecisionMetrics() {
  const state = useAiAnalysisDecisionMetrics()

  return (
    <div className={AI_ANALYSIS_DECISION_GRID_CLASS}>
      {metrics.map((metric) => (
        <div className={AI_ANALYSIS_DECISION_CELL_CLASS} key={metric.key}>
          <span className={AI_ANALYSIS_METRIC_LABEL_CLASS}>{metric.label}</span>
          <strong className={AI_ANALYSIS_DECISION_VALUE_CLASS}>{state[metric.key]}</strong>
        </div>
      ))}
    </div>
  )
}
