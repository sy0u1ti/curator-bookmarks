import { useAiAnalysisResultsHeader, useAiAnalysisSelectionActions } from './ai-analysis-status-store.js'
import { Button } from '../../ui/base/Button'
import { handleAiAnalysisAction } from '../options-controller'
import { OPTION_LIST_HEADER_CLASS } from './option-layout-classes.js'

const AI_RESULTS_HEADER_CLASS = OPTION_LIST_HEADER_CLASS
const AI_RESULTS_HEADER_COPY_CLASS = 'min-w-0'
const AI_RESULTS_HEADER_TITLE_CLASS =
  'block text-sm font-semibold leading-5 tracking-[-0.01em] text-ds-text-primary'
const AI_RESULTS_SUBTITLE_CLASS =
  'mt-1 mb-0 text-xs leading-[1.5] text-ds-text-secondary'

export function AiAnalysisResultsHeader() {
  const state = useAiAnalysisResultsHeader()
  const selection = useAiAnalysisSelectionActions()

  return (
    <div className={AI_RESULTS_HEADER_CLASS}>
      <div className={AI_RESULTS_HEADER_COPY_CLASS}>
        <strong className={AI_RESULTS_HEADER_TITLE_CLASS}>分析结果 <span className="ml-2 text-xs font-medium text-ds-text-muted tabular-nums">{state.resultCount}</span></strong>
        {state.subtitle ? <p className={AI_RESULTS_SUBTITLE_CLASS}>{state.subtitle}</p> : null}
      </div>
      {!selection.selectAllDisabled || !selection.selectHighConfidenceDisabled ? <div className="flex flex-wrap items-center gap-2">
        {!selection.selectAllDisabled ? <Button
          size="sm" variant="secondary" aria-label="全选书签智能分析结果"
          onClick={() => handleAiAnalysisAction('select-all')}
        >全选</Button> : null}
        {!selection.selectHighConfidenceDisabled ? <Button
          size="sm" variant="secondary" aria-label="全选书签智能分析高置信结果"
          onClick={() => handleAiAnalysisAction('select-high-confidence')}
        >全选高置信</Button> : null}
      </div> : null}
    </div>
  )
}
