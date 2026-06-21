import { Button } from '../../ui/base/Button.js'
import {
  AI_ANALYSIS_PRIMARY_BUTTON_CLASS,
  AI_ANALYSIS_SMALL_BUTTON_CLASS
} from './ai-analysis-classes.js'
import { handleAiAnalysisAction } from '../options-controller'
import { useAiAnalysisActions } from './ai-analysis-status-store.js'

export function AiAnalysisActions() {
  const state = useAiAnalysisActions()

  return (
    <>
      <Button
        className={AI_ANALYSIS_PRIMARY_BUTTON_CLASS}
        type="button"
        variant="primary"
        disabled={state.actionDisabled}
        focusableWhenDisabled={state.actionDisabled}
        onClick={() => handleAiAnalysisAction('start')}
      >
        {state.actionLabel}
      </Button>
      {state.pauseHidden ? null : (
        <Button
          className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          disabled={state.pauseDisabled}
          focusableWhenDisabled={state.pauseDisabled}
          onClick={() => handleAiAnalysisAction('pause-toggle')}
        >
          {state.pauseLabel}
        </Button>
      )}
      {state.stopHidden ? null : (
        <Button
          className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          disabled={state.stopDisabled}
          focusableWhenDisabled={state.stopDisabled}
          onClick={() => handleAiAnalysisAction('stop')}
        >
          {state.stopLabel}
        </Button>
      )}
    </>
  )
}
