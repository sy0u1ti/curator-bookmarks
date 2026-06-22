import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

export const AI_PROVIDER_CARD_CLASS =
  'mt-5 rounded-[var(--ui-radius-group)] border border-[rgba(255,255,255,0.06)] bg-[rgba(24,24,26,0.92)] p-[26px_24px_24px] text-[var(--ui-text-primary)] shadow-none max-[760px]:p-4'

export const AI_PROVIDER_CARD_ATTENTION_CLASS = '!border-[rgba(245,245,247,0.36)]'

export const AI_PROVIDER_HEADER_CLASS =
  'flex items-start justify-between gap-[18px] max-[760px]:flex-col'

export const AI_PROVIDER_COPY_CLASS = 'min-w-0'

export const AI_PROVIDER_TITLE_CLASS =
  'm-0 text-[17px] font-bold leading-[1.35] text-[var(--ui-text-primary)]'

export const AI_PROVIDER_BODY_CLASS = 'mt-[22px] flex flex-col gap-[18px]'

export const AI_PROVIDER_NOTICE_CLASS =
  'm-0 text-sm font-semibold leading-[1.7] text-[var(--ui-text-secondary)]'

export const AI_PROVIDER_SUBTITLE_CLASS =
  'm-0 mt-2 text-[13px] leading-[1.7] text-[var(--ui-text-disabled)]'

export const AI_PROVIDER_STATUS_BADGE_CLASS =
  'inline-flex min-h-6 w-fit flex-none items-center justify-center rounded-full border px-2.5 text-[11px] font-semibold leading-none tracking-[0]'

export const AI_PROVIDER_STATUS_TONE_CLASS: Record<string, string> = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.08)] text-[#ffb7b0]',
  muted: 'border-[var(--ui-surface-hover)] bg-[rgba(255,255,255,0.055)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(156,232,177,0.36)] bg-[rgba(156,232,177,0.17)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
}

export const AI_PROVIDER_FLOW_CLASS =
  'grid list-none grid-cols-5 gap-2.5 p-0 m-0 max-[900px]:grid-cols-[repeat(auto-fit,minmax(112px,1fr))]'

export const AI_PROVIDER_FLOW_STEP_CLASS =
  'min-w-0 rounded-[16px] bg-[rgba(255,255,255,0.035)] p-3 text-[var(--ui-text-tertiary)]'

export const AI_PROVIDER_FLOW_INDEX_CLASS =
  'mb-2.5 inline-grid size-[22px] place-items-center rounded-full bg-[rgba(245,245,247,0.09)] text-[11px] font-bold text-[var(--ui-text-secondary)]'

export const AI_PROVIDER_FLOW_TITLE_CLASS =
  'block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-[var(--ui-text-primary)]'

export const AI_PROVIDER_FLOW_COPY_CLASS =
  'm-0 mt-[5px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-[1.35] text-[var(--ui-text-disabled)]'

export const AI_PROVIDER_QUICK_ROW_CLASS =
  'grid grid-cols-[minmax(260px,1fr)_minmax(260px,0.62fr)] items-start gap-3 max-[900px]:grid-cols-1'

export const AI_PROVIDER_API_KEY_GROUP_CLASS = 'flex min-w-0 flex-col gap-3'

export const AI_PROVIDER_FIELD_CLASS = 'm-0 flex min-w-0 flex-col gap-2.5 border-0 p-0'

export const AI_PROVIDER_FIELD_LABEL_CLASS =
  'text-xs font-semibold leading-[1.2] tracking-[0] text-[var(--ui-text-tertiary)]'

export const AI_PROVIDER_INPUT_CLASS =
  'min-h-[50px] w-full rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-4 text-sm text-[var(--ui-text-primary)] shadow-none outline-none placeholder:text-[var(--ui-text-disabled)] focus:border-[var(--ui-focus-ring)] focus:bg-[var(--ui-surface-hover)] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus:ring-0 focus-visible:border-[var(--ui-focus-ring)] focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus-visible:ring-0'

export const AI_PROVIDER_MODEL_FIELD_CLASS = 'min-w-0'

export const AI_PROVIDER_MODEL_TOOLS_CLASS =
  'grid grid-cols-[minmax(180px,1fr)_auto] items-start gap-3 max-[760px]:grid-cols-1'

export const AI_PROVIDER_MODEL_CONTROL_CLASS = 'flex min-w-0 flex-col gap-2.5'

export const AI_PROVIDER_MODEL_LABEL_CLASS =
  'block text-xs font-semibold leading-[1.2] text-[rgba(245,245,247,0.72)]'

export const AI_PROVIDER_SELECT_HOST_CLASS = 'min-w-0'

export const AI_PROVIDER_SELECT_ROOT_CLASS = 'w-full'

export const AI_PROVIDER_SELECT_TRIGGER_CLASS =
  'min-h-[50px] w-full rounded-[var(--ui-radius-control)] border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-primary)] focus-visible:ring-[rgba(59,130,246,0.12)]'

export const AI_PROVIDER_FETCH_BUTTON_CLASS = 'min-h-[50px] w-full min-w-[72px]'

export const AI_PROVIDER_CHECK_CLASS =
  'inline-flex w-fit cursor-pointer items-center gap-3 text-[13px] text-[var(--ui-text-secondary)]'

export const AI_PROVIDER_CONNECTIVITY_CLASS =
  'rounded-[16px] border p-3.5 text-[13px] leading-[1.65]'

export const AI_PROVIDER_CONNECTIVITY_TONE_CLASS: Record<string, string> = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.08)] text-[#ffb7b0]',
  muted: 'border-[rgba(255,255,255,0.07)] bg-[rgba(17,17,19,0.72)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(170,237,189,0.28)] bg-[rgba(170,237,189,0.12)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.08)] text-[#ffdca5]'
}

export const AI_PROVIDER_ACTIONS_CLASS =
  'mt-0.5 flex flex-wrap items-center justify-between gap-3.5 border-t border-[rgba(255,255,255,0.06)] pt-[18px]'

export const AI_PROVIDER_ACTION_BUTTONS_CLASS =
  'flex flex-wrap items-center justify-end gap-2.5'

export const AI_PROVIDER_SAVE_STATE_CLASS =
  'relative inline-flex min-h-[34px] items-center rounded-full pl-[18px] text-[13px] font-semibold before:absolute before:left-0 before:size-2 before:rounded-full'

export const AI_PROVIDER_SAVE_TONE_CLASS: Record<string, string> = {
  danger: 'text-[#ffb7b0] before:bg-[#ff8a82]',
  muted: 'text-[var(--ui-text-tertiary)] before:bg-[rgba(245,245,247,0.28)]',
  success: 'text-[#e2ffe9] before:bg-[#9ce8b1] before:shadow-[0_0_0_4px_rgba(156,232,177,0.11)]',
  warning: 'text-[#ffdca5] before:bg-[#ffc86e] before:shadow-[0_0_0_4px_rgba(255,200,110,0.1)]'
}

export const AI_PROVIDER_FIELD_TIP_CLASS =
  'm-0 text-[13px] leading-[1.7] text-[var(--ui-text-disabled)]'

export const AI_PROVIDER_INLINE_ACTION_CLASS =
  'inline rounded-[var(--ui-radius-control)] border-0 bg-transparent px-1.5 text-[13px] font-semibold text-[var(--ui-text-primary)] hover:text-[var(--ui-text-secondary)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:outline-none disabled:cursor-default disabled:opacity-55'

export const AI_PROVIDER_ADVANCED_CLASS =
  'mt-1 border-t border-[rgba(255,255,255,0.055)] pt-4'

export const AI_PROVIDER_ADVANCED_TRIGGER_CLASS =
  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--ui-radius-control)] px-1.5 py-1 text-[13px] font-semibold text-[var(--ui-text-tertiary)] transition-colors after:size-2 after:rotate-45 after:border-b after:border-r after:border-[rgba(245,245,247,0.54)] after:transition-transform data-[panel-open]:after:rotate-[225deg] hover:bg-[var(--ui-surface-hover)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:outline-none'

export const AI_PROVIDER_ADVANCED_PANEL_CLASS = 'mt-4 overflow-hidden'

export const AI_PROVIDER_ADVANCED_NOTE_CLASS =
  'm-0 mb-3.5 rounded-[14px] bg-[rgba(255,255,255,0.035)] p-3.5 text-[13px] leading-[1.65] text-[var(--ui-text-tertiary)]'

export const AI_PROVIDER_GRID_CLASS =
  'grid grid-cols-2 items-start gap-3.5 max-[760px]:grid-cols-1'

export const AI_PROVIDER_DIALOG_BACKDROP_CLASS =
  `fixed inset-0 z-30 grid place-items-center bg-black/70 p-5 backdrop-blur-[14px] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const AI_PROVIDER_DIALOG_CLASS =
  `fixed left-1/2 top-1/2 z-40 max-h-[calc(100vh-40px)] w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[var(--ui-bg-main)] p-[24px_24px_22px] text-[var(--ui-text-primary)] shadow-none transition-[scale,opacity] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 max-[640px]:max-w-[calc(100vw-32px)] max-[640px]:p-5 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const AI_PROVIDER_DIALOG_EYEBROW_CLASS =
  'm-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[rgba(245,245,247,0.28)]'

export const AI_PROVIDER_DIALOG_TITLE_CLASS =
  'm-0 mt-2.5 text-[26px] font-semibold leading-[1.1] tracking-[0] text-[var(--ui-text-primary)]'

export const AI_PROVIDER_DIALOG_COPY_CLASS =
  'm-0 mt-3.5 text-sm leading-[1.75] text-[var(--ui-text-secondary)]'

export const AI_PROVIDER_DIALOG_FIELD_CLASS = 'mt-4 flex min-w-0 flex-col gap-2.5'

export const AI_PROVIDER_TEXTAREA_CLASS =
  'min-h-[132px] rounded-[var(--ui-radius-control)] border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-3.5 py-3 text-[var(--ui-text-primary)] placeholder:text-[var(--ui-text-disabled)] focus:border-[var(--ui-focus-ring)] focus:bg-[var(--ui-surface-hover)] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus:ring-0 focus-visible:border-[var(--ui-focus-ring)] focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus-visible:ring-0'

export const AI_PROVIDER_DIALOG_HINT_CLASS =
  'm-0 mt-3.5 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'

export const AI_PROVIDER_DIALOG_ACTIONS_CLASS =
  'mt-[22px] flex flex-wrap items-center justify-between gap-3 max-[640px]:flex-col-reverse max-[640px]:items-stretch'

export const AI_PROVIDER_DIALOG_CLOSE_CLASS =
  'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-3 text-sm font-medium leading-none text-[var(--ui-text-primary)] outline-none transition-colors hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)]'

export const AI_CONFIG_LINK_CLASS =
  'inline-flex min-h-[38px] items-center justify-center rounded-[var(--ui-radius-control)] border px-4 text-xs font-medium leading-[1.2] no-underline transition-colors focus-visible:outline-none'

export const AI_CONFIG_LINK_DEFAULT_CLASS =
  'border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-primary)] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)]'

export const AI_CONFIG_LINK_CONFIGURED_CLASS =
  'border-[rgba(156,232,177,0.36)] bg-[rgba(156,232,177,0.12)] text-[#e2ffe9] hover:border-[rgba(156,232,177,0.54)] hover:bg-[rgba(156,232,177,0.16)] focus-visible:border-[rgba(156,232,177,0.54)] focus-visible:bg-[rgba(156,232,177,0.16)]'

export function aiProviderToneClass(tone: string | undefined, classes: Record<string, string>) {
  return classes[tone || 'muted'] || classes.muted || ''
}
