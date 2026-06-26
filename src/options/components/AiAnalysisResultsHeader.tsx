import { useAiAnalysisResultsHeader } from './ai-analysis-status-store.js'

const AI_RESULTS_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AI_RESULTS_HEADER_COPY_CLASS = 'min-w-0'
const AI_RESULTS_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const AI_RESULTS_SUBTITLE_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'

export function AiAnalysisResultsHeader() {
  const state = useAiAnalysisResultsHeader()

  return (
    <div className={AI_RESULTS_HEADER_CLASS}>
      <div className={AI_RESULTS_HEADER_COPY_CLASS}>
        <strong className={AI_RESULTS_HEADER_TITLE_CLASS}>书签智能分析</strong>
        <p className={AI_RESULTS_SUBTITLE_CLASS}>{state.subtitle}</p>
      </div>
    </div>
  )
}
