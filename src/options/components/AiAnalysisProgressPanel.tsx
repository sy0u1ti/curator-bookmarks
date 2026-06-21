import { AiTaskStatus } from '../../ui/ai/AiTaskStatus.js'
import { StatusBusyLoadingLabel } from './LoadingLabel.js'
import {
  useAiAnalysisDuration,
  useAiAnalysisProgress
} from './ai-analysis-status-store.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'

const OPTIONS_PROGRESS_TRACK_CLASS =
  '!mt-[14px] !h-[7px] !rounded-none !border !border-[var(--ui-divider-subtle)] !bg-black'
const OPTIONS_PROGRESS_BAR_CLASS = '!rounded-none !bg-[var(--ui-accent-strong)]'
const AI_ANALYSIS_DECISION_PANEL_CLASS =
  'mt-[18px] !rounded-[12px] !border-[var(--ui-divider-subtle)] !bg-[rgba(255,255,255,0.025)] !p-[14px_16px_16px]'
const AI_ANALYSIS_PROGRESS_COPY_CLASS =
  'mt-0 mb-0 text-[13px] leading-[1.65] text-[var(--ui-text-tertiary)]'

export function AiAnalysisProgressPanel({ children }: { children: React.ReactNode }) {
  const state = useAiAnalysisProgress()
  const { durationLabel } = useAiAnalysisDuration()
  const title = (
    <strong>
      {state.busy ? (
        <StatusBusyLoadingLabel label={state.progressLabel} />
      ) : (
        state.progressLabel
      )}
    </strong>
  )
  const description = (
    <p className={AI_ANALYSIS_PROGRESS_COPY_CLASS}>
      {state.progressCopy}
    </p>
  )
  const statusNode = <span className={OPTION_VALUE_CLASS}>{durationLabel}</span>

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
