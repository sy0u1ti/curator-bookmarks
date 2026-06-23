import { Button } from '../../ui'
import { handleAiAnalysisScopePickerOpen } from '../options-controller'
import { useAiAnalysisScopePicker } from './ai-analysis-status-store.js'
import {
  OPTION_GROUP_CLASS,
  OPTION_COPY_CLASS,
  OPTION_COPY_TEXT_CLASS,
  OPTION_COPY_TITLE_CLASS,
  OPTION_ROW_CLASS,
  SCOPE_PICKER_LABEL_CLASS,
  SCOPE_PICKER_TRIGGER_CLASS
} from './option-layout-classes.js'
import { useOptionsFocusTargetRef } from './options-focus-target-store.js'

export function AiAnalysisScopePicker() {
  const state = useAiAnalysisScopePicker()
  const triggerRef = useOptionsFocusTargetRef<HTMLButtonElement>('ai-scope-trigger')

  return (
    <div className={OPTION_GROUP_CLASS}>
      <div className={OPTION_ROW_CLASS}>
        <div className={OPTION_COPY_CLASS}>
          <strong className={OPTION_COPY_TITLE_CLASS}>分析范围</strong>
          <p className={OPTION_COPY_TEXT_CLASS}>{state.copy}</p>
        </div>
        <Button
          ref={triggerRef}
          className={SCOPE_PICKER_TRIGGER_CLASS}
          type="button"
          aria-label="选择书签智能分析范围"
          title={state.label}
          disabled={state.disabled}
          focusableWhenDisabled={state.disabled}
          onClick={handleAiAnalysisScopePickerOpen}
          unstyled
        >
          <span className={SCOPE_PICKER_LABEL_CLASS}>{state.label}</span>
        </Button>
      </div>
    </div>
  )
}
