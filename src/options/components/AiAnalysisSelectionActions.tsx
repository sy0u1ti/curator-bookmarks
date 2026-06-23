import { Button } from '../../ui'
import {
  AI_ANALYSIS_CONFIRM_BUTTON_ACTIVE_CLASS,
  AI_ANALYSIS_CONFIRM_ICON_CLASS,
  AI_ANALYSIS_PRIMARY_BUTTON_CLASS,
  AI_ANALYSIS_SELECTION_GROUP_CLASS,
  AI_ANALYSIS_SMALL_BUTTON_CLASS
} from './ai-analysis-classes.js'
import { handleAiAnalysisAction } from '../options-controller'
import { useAiAnalysisSelectionActions } from './ai-analysis-status-store.js'

const AI_SELECTION_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AI_SELECTION_HEADER_COPY_CLASS = 'min-w-0'
const AI_SELECTION_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const AI_SELECTION_SUBTITLE_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-ds-text-secondary'
const AI_SELECTION_ACTIONS_CLASS =
  'flex min-w-0 flex-[0_0_auto] flex-wrap items-center justify-end gap-2.5 max-[760px]:flex-col max-[760px]:items-start max-[760px]:justify-start'

export function AiAnalysisSelectionActions() {
  const state = useAiAnalysisSelectionActions()

  if (state.hidden) {
    return null
  }

  return (
    <div className={AI_ANALYSIS_SELECTION_GROUP_CLASS}>
      <div className={AI_SELECTION_HEADER_CLASS}>
        <div className={AI_SELECTION_HEADER_COPY_CLASS}>
          <strong className={AI_SELECTION_HEADER_TITLE_CLASS}>{state.countLabel}</strong>
          <p className={AI_SELECTION_SUBTITLE_CLASS}>只会应用状态为“建议改名”的条目；“待确认”与“失败”结果需要先人工判断。</p>
        </div>
        <div className={AI_SELECTION_ACTIONS_CLASS}>
          <Button
            className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            aria-label="全选书签智能分析结果"
            disabled={state.selectAllDisabled}
            focusableWhenDisabled={state.selectAllDisabled}
            onClick={() => handleAiAnalysisAction('select-all')}
          >
            全选
          </Button>
          <Button
            className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            aria-label="全选书签智能分析高置信结果"
            disabled={state.selectHighConfidenceDisabled}
            focusableWhenDisabled={state.selectHighConfidenceDisabled}
            onClick={() => handleAiAnalysisAction('select-high-confidence')}
          >
            全选高置信
          </Button>
          <Button
            className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            aria-label="清空书签智能分析已选建议"
            disabled={state.clearDisabled}
            focusableWhenDisabled={state.clearDisabled}
            onClick={() => handleAiAnalysisAction('clear-selection')}
          >
            清空选择
          </Button>
          <Button
            className={[
              AI_ANALYSIS_SMALL_BUTTON_CLASS,
              state.moveConfirm ? AI_ANALYSIS_CONFIRM_BUTTON_ACTIVE_CLASS : ''
            ].filter(Boolean).join(' ')}
            size="sm"
            type="button"
            variant="secondary"
            aria-label="将书签智能分析已选建议移动至推荐文件夹"
            title={state.moveTitle}
            disabled={state.moveDisabled}
            focusableWhenDisabled={state.moveDisabled}
            onClick={() => handleAiAnalysisAction('move-selection-to-suggested')}
          >
            {state.moveConfirm ? (
              <>
                <span className={AI_ANALYSIS_CONFIRM_ICON_CLASS} aria-hidden="true">{'\u2713\u2713'}</span> 确认移动
              </>
            ) : (
              state.moveLabel
            )}
          </Button>
          <Button
            className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
            size="sm"
            type="button"
            variant="primary"
            aria-label="应用书签智能分析已选建议"
            disabled={state.applyDisabled}
            focusableWhenDisabled={state.applyDisabled}
            onClick={() => handleAiAnalysisAction('apply-selection')}
          >
            应用所选建议
          </Button>
        </div>
      </div>
    </div>
  )
}
