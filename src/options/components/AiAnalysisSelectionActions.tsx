import { Button } from '../../ui/base/Button'
import { SelectionDock } from './SelectionDock'
import {
  AI_ANALYSIS_SELECTION_GROUP_CLASS,
  AI_ANALYSIS_SMALL_BUTTON_CLASS
} from './ai-analysis-classes.js'
import { handleAiAnalysisAction } from '../options-controller'
import { useAiAnalysisSelectionActions } from './ai-analysis-status-store.js'

const AI_SELECTION_HEADER_CLASS = 'options-selection-bar'
const AI_SELECTION_HEADER_COPY_CLASS = 'min-w-0'
const AI_SELECTION_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const AI_SELECTION_ACTIONS_CLASS = 'options-selection-actions'

export function AiAnalysisSelectionActions() {
  const state = useAiAnalysisSelectionActions()
  const entered = !state.hidden

  return (
    <SelectionDock open={entered} label="已选分析建议操作">
      <div className={AI_ANALYSIS_SELECTION_GROUP_CLASS}>
        <div className={AI_SELECTION_HEADER_CLASS}>
          <div className={AI_SELECTION_HEADER_COPY_CLASS}>
            <strong className={AI_SELECTION_HEADER_TITLE_CLASS}>
              <span className="tabular-nums">{state.countLabel}</span>
            </strong>
          </div>
          <div className={AI_SELECTION_ACTIONS_CLASS}>
            <Button
              className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
              size="sm"
              type="button"
              variant="secondary"
              aria-label="取消选择书签智能分析建议"
              disabled={state.clearDisabled}
              focusableWhenDisabled={state.clearDisabled}
              onClick={() => handleAiAnalysisAction('clear-selection')}
            >
              取消选择
            </Button>
            <Button
              className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
              size="sm"
              type="button"
              variant="secondary"
              aria-label="将书签智能分析已选建议移动至推荐文件夹"
              title={state.moveTitle}
              disabled={state.moveDisabled}
              focusableWhenDisabled={state.moveDisabled}
              onClick={() => handleAiAnalysisAction('move-selection-to-suggested')}
            >
              {state.moveLabel}
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
              应用改名建议
            </Button>
          </div>
        </div>
      </div>
    </SelectionDock>
  )
}
