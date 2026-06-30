import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import {
  OPTION_GROUP_CLASS,
  OPTION_COPY_CLASS,
  OPTION_COPY_TEXT_CLASS,
  OPTION_COPY_TITLE_CLASS,
  OPTION_ROW_CLASS,
  SCOPE_PICKER_LABEL_CLASS,
  SCOPE_PICKER_TRIGGER_CLASS
} from './option-layout-classes.js'
import { handleScopePickerTriggerOpen } from '../options-controller'
import { useOptionsFocusTargetRef } from './options-focus-target-store.js'
import { useScopePickerTrigger } from './scope-picker-store.js'
import type { ScopePickerSource } from './scope-picker-types.js'

const sourceLabels: Record<ScopePickerSource, string> = {
  availability: '检测范围',
  history: '历史范围'
}

const sourceAriaLabels: Record<ScopePickerSource, string> = {
  availability: '选择检测范围',
  history: '选择历史范围'
}

export function ScopePickerTrigger({
  source
}: {
  source: ScopePickerSource
}) {
  const state = useScopePickerTrigger(source)

  return (
    <div className={OPTION_GROUP_CLASS}>
      <div className={OPTION_ROW_CLASS}>
        <div className={OPTION_COPY_CLASS}>
          <strong className={OPTION_COPY_TITLE_CLASS}>{sourceLabels[source]}</strong>
          <p className={OPTION_COPY_TEXT_CLASS}>{state.copy}</p>
        </div>
        <ScopePickerTriggerButton source={source} />
      </div>
    </div>
  )
}

export function ScopePickerTriggerButton({
  className = '',
  source
}: {
  className?: string
  source: ScopePickerSource
}) {
  const state = useScopePickerTrigger(source)
  const prefix = source === 'availability' ? 'availability' : 'history'
  const triggerRef = useOptionsFocusTargetRef<HTMLButtonElement>(`${prefix}-scope-trigger`)

  return (
    <Button
      ref={triggerRef}
      className={[SCOPE_PICKER_TRIGGER_CLASS, className].filter(Boolean).join(' ')}
      type="button"
      aria-label={sourceAriaLabels[source]}
      title={state.label}
      disabled={state.disabled}
      focusableWhenDisabled={state.disabled}
      onClick={() => handleScopePickerTriggerOpen(source)}
      unstyled
    >
      <Icon className="text-ds-accent-hover" name="ChevronDown" size={14} aria-hidden="true" />
      <span className={SCOPE_PICKER_LABEL_CLASS}>{state.label}</span>
    </Button>
  )
}
