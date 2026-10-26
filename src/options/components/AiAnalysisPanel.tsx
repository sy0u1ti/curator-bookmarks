import { AiAnalysisActions } from './AiAnalysisActions.js'
import { AiAnalysisDecisionMetrics } from './AiAnalysisDecisionMetrics.js'
import { AiAnalysisProgressPanel } from './AiAnalysisProgressPanel.js'
import { AiAnalysisResults } from './AiAnalysisResults.js'
import { AiAnalysisResultsFilter } from './AiAnalysisResultsFilter.js'
import { AiAnalysisResultsHeader } from './AiAnalysisResultsHeader.js'
import { AiAnalysisResultsPagination } from './AiAnalysisResultsPagination.js'
import { AiAnalysisScopePickerButton } from './AiAnalysisScopePicker.js'
import { AiAnalysisSelectionActions } from './AiAnalysisSelectionActions.js'
import { AiAnalysisStatusCard } from './AiAnalysisStatusCard.js'
import { AiConfigLink } from './AiConfigLink.js'
import { AI_ANALYSIS_RESULTS_GROUP_CLASS } from './ai-analysis-classes.js'
import { useAiConfigLinkState } from './ai-config-link-store.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_RUN_ACTIONS_CLASS,
  OPTION_RUN_CELL_CLASS,
  OPTION_RUN_CELL_TITLE_CLASS,
  OPTION_RUN_HEADER_CLASS
} from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'

const AI_ANALYSIS_TOOLBAR_ACTIONS_CLASS = OPTION_RUN_ACTIONS_CLASS

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

export function AiAnalysisPanel({ hidden }: OptionsPanelVisibilityProps) {
  const { configured } = useAiConfigLinkState()

  return (
    <section id="ai" className={OPTION_PANEL_CLASS} aria-labelledby="ai-title" hidden={hidden}>
      <OptionPanelHeader
        titleId="ai-title"
        title="书签智能分析"
      />

      {configured ? (
        <>
          <div className={OPTION_RUN_HEADER_CLASS}>
            <div className={OPTION_RUN_CELL_CLASS}>
              <strong className={OPTION_RUN_CELL_TITLE_CLASS}>分析范围</strong>
              <div className="mt-3">
                <AiAnalysisScopePickerButton className="min-w-full" />
              </div>
            </div>
            <AiAnalysisStatusCard />
            <div className={AI_ANALYSIS_TOOLBAR_ACTIONS_CLASS}>
              <AiConfigLink />
              <AiAnalysisActions />
            </div>
          </div>

          <AiAnalysisProgressPanel>
            <AiAnalysisDecisionMetrics />
          </AiAnalysisProgressPanel>

          <AiAnalysisSelectionActions />

          <div className={AI_ANALYSIS_RESULTS_GROUP_CLASS}>
            <AiAnalysisResultsHeader />
            <AiAnalysisResultsFilter />
            <AiAnalysisResults />
            <AiAnalysisResultsPagination />
          </div>
        </>
      ) : (
        <div className="mt-6">
          <OptionEmptyState
            title="先配置 AI 渠道"
            description="填写服务地址并选择模型后，即可开始分析。本机服务可不填密钥。"
            actions={[{ action: 'configure-ai', label: '配置 AI 渠道', variant: 'primary' }]}
          />
        </div>
      )}
    </section>
  )
}
