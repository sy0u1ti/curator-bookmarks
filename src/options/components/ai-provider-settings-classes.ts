import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'
import { OPTION_SURFACE_CLASS } from './option-layout-classes.js'

export const AI_PROVIDER_CARD_CLASS =
  `mt-5 ${OPTION_SURFACE_CLASS} gap-0 p-6 text-ds-text-primary max-[760px]:p-4`

export const AI_PROVIDER_CARD_ATTENTION_CLASS = 'outline outline-1 outline-ds-border-hover outline-offset-2'

export const AI_PROVIDER_HEADER_CLASS =
  'flex items-start justify-between gap-[18px] max-[760px]:flex-col'

export const AI_PROVIDER_COPY_CLASS = 'min-w-0'

export const AI_PROVIDER_TITLE_CLASS =
  'm-0 text-base font-bold leading-[1.35] text-ds-text-primary'

export const AI_PROVIDER_BODY_CLASS = 'mt-6 flex flex-col gap-4'

export const AI_PROVIDER_SUBTITLE_CLASS =
  'm-0 mt-2 text-[13px] leading-[1.7] text-ds-text-disabled'

export const AI_PROVIDER_STATUS_BADGE_CLASS =
  'inline-flex min-h-6 min-w-20 w-fit flex-none items-center justify-center whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold leading-none tracking-[0]'

export const AI_PROVIDER_STATUS_TONE_CLASS: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}

export const AI_PROVIDER_FIELD_CLASS = 'm-0 flex min-w-0 flex-col gap-2 border-0 p-0'

export const AI_PROVIDER_FIELD_LABEL_CLASS =
  'text-xs font-semibold leading-[1.2] tracking-[0] text-ds-text-muted'

export const AI_PROVIDER_INPUT_CLASS =
  'min-h-[50px] w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-4 text-sm text-ds-text-primary placeholder:text-ds-text-disabled focus:bg-ds-hover'

export const AI_PROVIDER_MODEL_FIELD_CLASS = 'flex min-w-0 flex-col gap-3'

export const AI_PROVIDER_MODEL_GROUP_CLASS =
  'ai-provider-model-group grid w-full grid-cols-[minmax(0,1fr)_152px] items-stretch gap-2 max-[520px]:grid-cols-1'

export const AI_PROVIDER_MODEL_SELECT_HOST_CLASS =
  'ai-provider-model-select-host min-w-0 w-full'

export const AI_PROVIDER_EFFORT_HOST_CLASS =
  'ai-provider-effort-host flex min-h-[50px] min-w-0 w-full items-center [&>*]:w-full'

export const AI_PROVIDER_HINTS_CLASS = 'flex min-w-0 flex-col gap-1.5'

export const AI_PROVIDER_SELECT_HOST_CLASS = 'min-w-0'

export const AI_PROVIDER_SELECT_ROOT_CLASS = 'w-full'

export const AI_PROVIDER_SELECT_TRIGGER_CLASS =
  'min-h-[50px] w-full rounded-ds-sm border-ds-border bg-ds-surface-2 text-ds-text-primary focus-visible:shadow-ds-focus'

export const AI_PROVIDER_FETCH_BUTTON_CLASS =
  'min-h-[50px] min-w-[140px] flex-none whitespace-nowrap px-5'

export const AI_PROVIDER_CHECK_CLASS =
  'inline-flex w-fit cursor-pointer items-center gap-2 text-xs text-ds-text-secondary'

export const AI_PROVIDER_CONNECTIVITY_CLASS =
  'relative m-0 pl-[18px] text-[13px] font-medium leading-[1.65] before:absolute before:left-0 before:top-[7px] before:size-2 before:rounded-full'

export const AI_PROVIDER_CONNECTIVITY_TONE_CLASS: Record<string, string> = {
  danger: 'text-ds-danger-text before:bg-ds-danger',
  muted: 'text-ds-text-muted before:bg-ds-text-disabled',
  success: 'text-ds-success-text before:bg-ds-success',
  warning: 'text-ds-warning before:bg-ds-warning'
}

export const AI_PROVIDER_ACTIONS_CLASS =
  'mt-0.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t border-ds-border-subtle pt-[18px] max-[520px]:grid-cols-1'

export const AI_PROVIDER_ACTION_BUTTONS_CLASS =
  'ml-auto flex items-center justify-end gap-2.5'

export const AI_PROVIDER_SAVE_STATE_CLASS =
  'relative inline-flex min-h-[34px] items-center rounded-full pl-[18px] text-[13px] font-semibold before:absolute before:left-0 before:size-2 before:rounded-full'

export const AI_PROVIDER_SAVE_TONE_CLASS: Record<string, string> = {
  danger: 'text-ds-danger-text before:bg-ds-danger',
  muted: 'text-ds-text-muted before:bg-ds-text-disabled',
  success: 'text-ds-success-text before:bg-ds-success',
  warning: 'text-ds-warning before:bg-ds-warning'
}

export const AI_PROVIDER_FIELD_TIP_CLASS =
  'm-0 text-[13px] leading-[1.7] text-ds-text-disabled'

export const AI_PROVIDER_ADVANCED_CLASS =
  'mt-1 border-t border-ds-border-subtle pt-4'

export const AI_PROVIDER_ADVANCED_TRIGGER_CLASS =
  'ai-provider-advanced-trigger w-fit max-w-full gap-3 after:size-2 after:rotate-45 after:border-b after:border-r after:border-current after:transition-transform after:duration-ds-fast data-[panel-open]:after:rotate-[225deg] motion-reduce:after:transition-none'

export const AI_PROVIDER_ADVANCED_PANEL_CLASS = 'mt-4 overflow-hidden'

export const AI_PROVIDER_GRID_CLASS =
  'grid grid-cols-2 items-start gap-3.5 max-[760px]:grid-cols-1'

export const AI_PROVIDER_MODEL_ROW_CLASS = `ai-provider-model-row ${AI_PROVIDER_GRID_CLASS}`

export const AI_PROVIDER_DIALOG_BACKDROP_CLASS =
  `options-modal-backdrop ai-provider-dialog-backdrop fixed inset-0 z-30 grid place-items-center bg-black/70 p-5 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const AI_PROVIDER_DIALOG_CLASS =
  `options-modal-panel ai-provider-dialog-panel z-40 max-w-[520px] rounded-ds-dialog border border-ds-border-subtle bg-ds-app ds-inset-dialog text-ds-text-primary shadow-none max-[640px]:rounded-ds-card max-[640px]:ds-inset-card ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const AI_PROVIDER_DIALOG_EYEBROW_CLASS =
  'm-0 text-xs font-medium leading-4 text-ds-text-secondary'

export const AI_PROVIDER_DIALOG_TITLE_CLASS =
  'm-0 mt-2.5 text-2xl font-semibold leading-[1.1] tracking-[0] text-ds-text-primary'

export const AI_PROVIDER_DIALOG_COPY_CLASS =
  'm-0 mt-3.5 text-sm leading-[1.75] text-ds-text-secondary'

export const AI_PROVIDER_DIALOG_FIELD_CLASS = 'mt-4 flex min-w-0 flex-col gap-2.5'

export const AI_PROVIDER_TEXTAREA_CLASS =
  'min-h-[132px] rounded-ds-sm border-ds-border bg-ds-surface-2 px-3.5 py-3 text-ds-text-primary placeholder:text-ds-text-disabled focus:bg-ds-hover'

export const AI_PROVIDER_DIALOG_HINT_CLASS =
  'm-0 mt-3.5 text-[13px] leading-[1.7] text-ds-text-secondary'

export const AI_PROVIDER_DIALOG_ACTIONS_CLASS =
  'mt-[22px] flex flex-wrap items-center justify-between gap-3 max-[640px]:flex-col-reverse max-[640px]:items-stretch'

export const AI_PROVIDER_DIALOG_CLOSE_CLASS =
  'inline-flex h-9 items-center justify-center gap-2 rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3 text-sm font-medium leading-none text-ds-text-primary outline-none transition-colors hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover'

export const AI_CONFIG_LINK_CLASS =
  'inline-flex min-h-10 cursor-pointer appearance-none items-center justify-center rounded-ds-sm border px-4 text-xs font-medium leading-[1.2] no-underline transition-colors focus-visible:outline-none'

export const AI_CONFIG_LINK_DEFAULT_CLASS =
  'border-ds-border bg-ds-surface-2 text-ds-text-primary hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover'

export function aiProviderToneClass(tone: string | undefined, classes: Record<string, string>) {
  return classes[tone || 'muted'] || classes.muted || ''
}
