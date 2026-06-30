import { useMemo, type ReactNode } from 'react'
import { AiTaskStatus } from '../../ui/ai/AiTaskStatus'
import { StatusBusyLoadingLabel } from './LoadingLabel.js'
import {
  useAiAnalysisDuration,
  useAiAnalysisProgress
} from './ai-analysis-status-store.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'

const OPTIONS_PROGRESS_TRACK_CLASS =
  'mt-[14px] h-[7px] rounded-ds-sm border border-ds-border-subtle bg-ds-surface-2'
const OPTIONS_PROGRESS_BAR_CLASS = 'rounded-ds-sm bg-ds-accent-hover'
const AI_ANALYSIS_DECISION_PANEL_CLASS =
  'mt-[18px] border-ds-border-subtle bg-ds-surface-1'
const AI_ANALYSIS_PROGRESS_COPY_CLASS =
  'mt-0 mb-0 text-[13px] leading-[1.55] text-ds-text-muted'

export function AiAnalysisProgressPanel({ children }: { children: ReactNode }) {
  const state = useAiAnalysisProgress()
  const { durationLabel } = useAiAnalysisDuration()
  const title = useMemo(() => (
    <strong>
      {state.busy ? (
        <StatusBusyLoadingLabel label={state.progressLabel} />
      ) : (
        state.progressLabel
      )}
    </strong>
  ), [state.busy, state.progressLabel])
  const description = useMemo(() => (
    <p className={AI_ANALYSIS_PROGRESS_COPY_CLASS}>
      {state.progressCopy}
    </p>
  ), [state.progressCopy])
  const statusNode = useMemo(() => <span className={OPTION_VALUE_CLASS}>{durationLabel}</span>, [durationLabel])

  return (
    <AiTaskStatus
      status="idle"
      className={AI_ANALYSIS_DECISION_PANEL_CLASS}
      label="执行进度"
      title={title}
      description={description}
      progress={state.progressValue}
      progressClassName={OPTIONS_PROGRESS_TRACK_CLASS}
      progressIndicatorClassName={OPTIONS_PROGRESS_BAR_CLASS}
      statusNode={statusNode}
      aria-label="书签智能分析决策概览"
    >
      {children}
    </AiTaskStatus>
  )
}
