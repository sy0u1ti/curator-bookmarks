import { useAiAnalysisStatus } from './ai-analysis-status-store.js'
import { OPTION_RUN_CELL_CLASS, OPTION_RUN_CELL_TITLE_CLASS } from './option-layout-classes.js'
import { StatusMessage } from '../../ui/base/StatusMessage'

const AI_ANALYSIS_STATUS_META_CLASS =
  'flex min-w-0 items-center justify-between gap-3'
const AI_ANALYSIS_STATUS_TITLE_CLASS = OPTION_RUN_CELL_TITLE_CLASS
const AI_ANALYSIS_STATUS_COPY_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const AI_ANALYSIS_STATUS_BADGE_BASE_CLASS =
  'inline-flex min-h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 text-xs font-medium leading-none tracking-[0]'
const AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-border bg-ds-bg-page text-ds-text-secondary',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning-text'
}

export function AiAnalysisStatusCard() {
  const state = useAiAnalysisStatus()
  const isError = state.badgeTone === 'danger'
  const badgeClassName = [
    AI_ANALYSIS_STATUS_BADGE_BASE_CLASS,
    AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES[state.badgeTone] || AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES.muted
  ].join(' ')

  return (
    <div className={OPTION_RUN_CELL_CLASS}>
      <div className={AI_ANALYSIS_STATUS_META_CLASS}>
        <strong className={AI_ANALYSIS_STATUS_TITLE_CLASS}>分析状态</strong>
        <span className={badgeClassName}>
          {state.badgeText}
        </span>
      </div>
      <StatusMessage className={AI_ANALYSIS_STATUS_COPY_CLASS} tone={isError ? 'error' : 'neutral'}>
        {state.statusCopy}
      </StatusMessage>
    </div>
  )
}
