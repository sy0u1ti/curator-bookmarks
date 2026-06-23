import { AiAnalysisActions } from './AiAnalysisActions.js'
import { AiAnalysisDecisionMetrics } from './AiAnalysisDecisionMetrics.js'
import { AiAnalysisProgressPanel } from './AiAnalysisProgressPanel.js'
import { AiAnalysisResults } from './AiAnalysisResults.js'
import { AiAnalysisResultsFilter } from './AiAnalysisResultsFilter.js'
import { AiAnalysisResultsHeader } from './AiAnalysisResultsHeader.js'
import { AiAnalysisResultsPagination } from './AiAnalysisResultsPagination.js'
import { AiAnalysisScopePicker } from './AiAnalysisScopePicker.js'
import { AiAnalysisSelectionActions } from './AiAnalysisSelectionActions.js'
import { AiAnalysisStatusCard } from './AiAnalysisStatusCard.js'
import { AiConfigLink } from './AiConfigLink.js'
import { AI_ANALYSIS_RESULTS_GROUP_CLASS } from './ai-analysis-classes.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_PANEL_TITLE_CLASS,
  OPTION_SECTION_LABEL_CLASS
} from './option-layout-classes.js'

const AI_ANALYSIS_TOOLBAR_CLASS =
  'mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 max-[1180px]:grid-cols-[minmax(0,1fr)] max-[1180px]:items-start'
const AI_ANALYSIS_TOOLBAR_ACTIONS_CLASS =
  'flex flex-wrap items-center justify-end gap-3 max-[1180px]:justify-start max-[760px]:flex-col max-[760px]:items-start'
const AI_ANALYSIS_DECISION_HEADER_CLASS =
  'flex min-w-0 items-start justify-between gap-[14px] max-[760px]:flex-col'
const AI_ANALYSIS_DECISION_TITLE_CLASS =
  'font-[650] text-ds-text-primary [overflow-wrap:anywhere]'
const AI_ANALYSIS_DECISION_COPY_CLASS =
  'mt-[5px] mb-0 text-[13px] leading-[1.5] text-ds-text-muted'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

export function AiAnalysisPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="ai" className={OPTION_PANEL_CLASS} aria-labelledby="ai-title" hidden={hidden}>
      <p className={OPTION_SECTION_LABEL_CLASS}>Smart Bookmark Analysis</p>
      <h1 id="ai-title" className={OPTION_PANEL_TITLE_CLASS}>书签智能分析</h1>

      <AiAnalysisScopePicker />

      <div className={AI_ANALYSIS_TOOLBAR_CLASS}>
        <AiAnalysisStatusCard />

        <div className={AI_ANALYSIS_TOOLBAR_ACTIONS_CLASS}>
          <AiConfigLink />
          <AiAnalysisActions />
        </div>
      </div>

      <AiAnalysisProgressPanel>
        <div className={AI_ANALYSIS_DECISION_HEADER_CLASS}>
          <div>
            <strong className={AI_ANALYSIS_DECISION_TITLE_CLASS}>决策面板</strong>
            <p className={AI_ANALYSIS_DECISION_COPY_CLASS}>先查看可直接应用的建议，再处理待确认、低置信和失败项。</p>
          </div>
        </div>
        <AiAnalysisDecisionMetrics />
      </AiAnalysisProgressPanel>

      <AiAnalysisSelectionActions />

      <div className={AI_ANALYSIS_RESULTS_GROUP_CLASS}>
        <AiAnalysisResultsHeader />
        <AiAnalysisResultsFilter />
        <AiAnalysisResults />
        <AiAnalysisResultsPagination />
      </div>
    </section>
  )
}
