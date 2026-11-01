import { Button } from '../../ui/base/Button'
import { StableLabel } from '../../ui/base/StatusMessage'
import {
  AI_ANALYSIS_PRIMARY_BUTTON_CLASS,
  AI_ANALYSIS_SMALL_BUTTON_CLASS
} from './ai-analysis-classes.js'
import { handleAiAnalysisAction } from '../options-controller'
import { useAiAnalysisActions } from './ai-analysis-status-store.js'
import { RunActionSlot } from './RunActionSlot'

export function AiAnalysisActions() {
  const state = useAiAnalysisActions()
  const active = !state.pauseHidden || !state.stopHidden

  return (
    <RunActionSlot active={active} primary={
      <Button
        className={AI_ANALYSIS_PRIMARY_BUTTON_CLASS}
        size="lg"
        type="button"
        variant="primary"
        disabled={state.actionDisabled || active}
        tabIndex={active ? -1 : undefined}
        focusableWhenDisabled={state.actionDisabled}
        onClick={() => handleAiAnalysisAction('start')}
      >
        <StableLabel text={state.actionLabel} reserve={['开始分析并生成建议', '重新分析并生成建议']} />
      </Button>
    }>
        <Button
          className={`${AI_ANALYSIS_SMALL_BUTTON_CLASS} ${state.pauseHidden ? 'invisible' : ''}`}
          size="sm"
          type="button"
          variant="secondary"
          disabled={state.pauseDisabled || state.pauseHidden}
          aria-hidden={state.pauseHidden || undefined}
          tabIndex={state.pauseHidden ? -1 : undefined}
          focusableWhenDisabled={state.pauseDisabled}
          onClick={() => handleAiAnalysisAction('pause-toggle')}
        >
          <StableLabel text={state.pauseLabel} reserve={['继续生成', '暂停生成']} />
        </Button>
        <Button
          className={`${AI_ANALYSIS_SMALL_BUTTON_CLASS} ${state.stopHidden ? 'invisible' : ''}`}
          size="sm"
          type="button"
          variant="secondary"
          disabled={state.stopDisabled || state.stopHidden}
          aria-hidden={state.stopHidden || undefined}
          tabIndex={state.stopHidden ? -1 : undefined}
          focusableWhenDisabled={state.stopDisabled}
          onClick={() => handleAiAnalysisAction('stop')}
        >
          <StableLabel text={state.stopLabel} reserve={['停止中…', '停止本次生成']} />
        </Button>
    </RunActionSlot>
  )
}
