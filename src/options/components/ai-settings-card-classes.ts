export const AI_SETTINGS_CARD_CLASS =
  'mt-5 rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[#0d0d0e] p-[22px_24px] text-[var(--ui-text-primary)] shadow-none max-[760px]:p-4'

export const AI_SETTINGS_NARROW_CARD_CLASS =
  'mt-5 rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[#0d0d0e] p-[22px_24px_20px] text-[var(--ui-text-primary)] shadow-none max-[760px]:p-4'

export const AI_SETTINGS_HEADER_CLASS =
  'mb-2 flex min-w-0 items-start justify-between gap-3 max-[760px]:flex-col'

export const AI_SETTINGS_BODY_CLASS = 'mt-4 flex flex-col gap-3.5'

export const AI_SETTINGS_TITLE_CLASS = 'm-0 text-base font-bold leading-[1.35] text-[var(--ui-text-primary)]'

export const AI_SETTINGS_SUBTITLE_CLASS =
  'mt-1.5 text-[13px] leading-[1.7] text-[var(--ui-text-disabled)]'

export const AI_SETTINGS_STATUS_BADGE_CLASS =
  'inline-flex min-h-6 w-fit flex-none items-center justify-center rounded-full border border-[var(--ui-surface-hover)] bg-[rgba(255,255,255,0.055)] px-2.5 text-[11px] font-semibold leading-none tracking-[0] text-[var(--ui-text-tertiary)]'

export const AI_SETTINGS_INLINE_STATUS_CLASS =
  'inline-flex min-h-6 w-fit flex-none items-center justify-center rounded-full border px-[9px] text-[10px] font-semibold leading-none tracking-[0]'

export const AI_SETTINGS_STATUS_TONE_CLASS = {
  muted: 'border-[var(--ui-surface-hover)] bg-[rgba(255,255,255,0.055)] text-[var(--ui-text-tertiary)]',
  success: 'border-[rgba(156,232,177,0.36)] bg-[rgba(156,232,177,0.17)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
} as const

export const AI_SETTINGS_ROW_CLASS =
  'grid min-h-[34px] grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px] max-[760px]:grid-cols-1 max-[760px]:items-start'

export const AI_SETTINGS_COPY_CLASS = 'min-w-0'

export const AI_SETTINGS_TITLE_ROW_CLASS = 'flex min-w-0 flex-wrap items-center gap-2.5'

export const AI_SETTINGS_ROW_TITLE_CLASS =
  'block text-sm font-bold leading-[1.4] text-[var(--ui-text-primary)]'

export const AI_SETTINGS_SECONDARY_CLASS =
  'mt-[3px] block text-[13px] leading-[1.65] text-[var(--ui-text-disabled)]'

export const AI_SETTINGS_SWITCH_WRAP_CLASS =
  'relative inline-block h-[1.8em] w-[3.7em] flex-none cursor-pointer text-sm has-[[data-disabled]]:cursor-default'

export const AI_SETTINGS_SWITCH_CONTROL_CLASS =
  'absolute inset-0 rounded-[30px] bg-[#313033] outline-none transition-colors duration-200 data-[checked]:bg-[#1e293b] data-[disabled]:opacity-50 focus-visible:shadow-[0_0_0_2px_rgba(59,130,246,0.32)]'

export const AI_SETTINGS_SWITCH_THUMB_CLASS =
  'absolute bottom-[0.2em] left-[0.2em] size-[1.4em] rounded-[20px] bg-[#aeaaae] transition-[transform,background-color] duration-[400ms] data-[checked]:translate-x-[1.9em] data-[checked]:bg-[#3b82f6]'

export const AI_SETTINGS_ADVANCED_CLASS =
  'mt-4 grid border-t border-[rgba(255,255,255,0.075)] pt-4'

export const AI_SETTINGS_ADVANCED_TRIGGER_CLASS =
  'w-fit rounded-md border border-[var(--ui-surface-hover)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ui-text-secondary)] transition-colors hover:border-[var(--ui-divider)] hover:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus-ring)]'

export const AI_SETTINGS_ADVANCED_PANEL_CLASS =
  'mt-2 overflow-hidden text-[13px] leading-[1.65] text-[var(--ui-text-tertiary)]'

export const AI_SETTINGS_ADVANCED_NOTE_CLASS = 'm-0'

export const AI_SETTINGS_FIELD_TIP_CLASS =
  'mt-3 text-[13px] leading-[1.65] text-[var(--ui-text-tertiary)]'

export const AI_SETTINGS_HELP_TOOLTIP_CLASS =
  'ml-1.5 inline-flex size-4 cursor-help items-center justify-center rounded-full border border-[var(--ui-surface-hover)] bg-transparent p-0 text-[11px] leading-none text-[var(--ui-text-secondary)] align-[1px] shadow-none hover:border-[var(--ui-divider)] hover:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus-ring)]'

export const AI_SETTINGS_HELP_TOOLTIP_POPUP_CLASS =
  'z-[80] w-[min(300px,calc(100vw-48px))] rounded-[10px] border border-[var(--ui-surface-hover)] bg-[var(--ui-bg-main)] p-[10px_12px] text-left text-xs font-medium leading-[1.6] text-[var(--ui-text-primary)] shadow-[0_18px_42px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)] data-starting-style:translate-y-1 data-starting-style:opacity-0 data-ending-style:translate-y-1 data-ending-style:opacity-0 motion-reduce:transition-none'
