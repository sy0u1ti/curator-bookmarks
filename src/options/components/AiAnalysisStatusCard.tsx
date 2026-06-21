import { useAiAnalysisStatus } from './ai-analysis-status-store.js'

const AI_ANALYSIS_STATUS_CARD_CLASS =
  'rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[var(--ui-surface)] p-[18px_20px] max-[760px]:px-4'
const AI_ANALYSIS_STATUS_META_CLASS =
  'flex flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AI_ANALYSIS_STATUS_TITLE_CLASS =
  'block text-[15px] font-[650] leading-normal tracking-[0] text-[var(--ui-text-primary)]'
const AI_ANALYSIS_STATUS_COPY_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const AI_ANALYSIS_STATUS_BADGE_BASE_CLASS =
  'inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0]'
const AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES: Record<string, string> = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.12)] text-[#ffb7b0]',
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
}

export function AiAnalysisStatusCard() {
  const state = useAiAnalysisStatus()
  const badgeClassName = [
    AI_ANALYSIS_STATUS_BADGE_BASE_CLASS,
    AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES[state.badgeTone] || AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES.muted
  ].join(' ')

  return (
    <div className={AI_ANALYSIS_STATUS_CARD_CLASS}>
      <div className={AI_ANALYSIS_STATUS_META_CLASS}>
        <span className={badgeClassName}>
          {state.badgeText}
        </span>
        <strong className={AI_ANALYSIS_STATUS_TITLE_CLASS}>执行方式</strong>
      </div>
      <p className={AI_ANALYSIS_STATUS_COPY_CLASS}>
        {state.statusCopy}
      </p>
    </div>
  )
}
