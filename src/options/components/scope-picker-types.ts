export type ScopePickerSource = 'availability' | 'history'

export interface ScopePickerTriggerState {
  copy: string
  countLabel?: string
  disabled: boolean
  label: string
}

export type ScopePickerTriggersState = Record<ScopePickerSource, ScopePickerTriggerState>
