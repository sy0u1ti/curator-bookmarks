import {
  OPTION_SWITCH_CONTROL_CLASS,
  OPTION_SWITCH_THUMB_CLASS,
  OPTION_SWITCH_WRAP_CLASS
} from '../../ui/switch-classes'
import { OPTION_SURFACE_CLASS } from './option-layout-classes.js'

export const AI_SETTINGS_CARD_CLASS =
  `options-interactive-surface mt-6 overflow-hidden ${OPTION_SURFACE_CLASS} gap-0 p-0 text-ds-text-primary max-[760px]:mt-4`

export const AI_SETTINGS_NARROW_CARD_CLASS = AI_SETTINGS_CARD_CLASS

export const AI_SETTINGS_HEADER_CLASS =
  'mb-0 flex min-w-0 items-start justify-between gap-3 border-b border-ds-border-subtle px-5 py-4 max-[760px]:flex-col max-[760px]:px-4'

export const AI_SETTINGS_HEADER_BORDERLESS_CLASS =
  'mb-0 flex min-w-0 items-start justify-between gap-3 border-b border-transparent px-5 py-4 max-[760px]:flex-col max-[760px]:px-4'

export const AI_SETTINGS_BODY_CLASS = 'mt-0 flex flex-col divide-y divide-ds-border-subtle'

export const AI_SETTINGS_TITLE_CLASS = 'm-0 text-sm font-semibold leading-[1.35] tracking-[-0.01em] text-ds-text-primary'

export const AI_SETTINGS_SUBTITLE_CLASS =
  'mt-1 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'

export const AI_SETTINGS_STATUS_BADGE_CLASS =
  'inline-flex min-h-6 w-fit flex-none items-center justify-center rounded-full border border-ds-border bg-ds-bg-page px-2.5 text-xs font-medium leading-none tracking-[0] text-ds-text-secondary'

export const AI_SETTINGS_INLINE_STATUS_CLASS =
  'inline-flex min-h-6 w-fit flex-none items-center justify-center rounded-full border px-2.5 text-xs font-medium leading-none tracking-[0]'

export const AI_SETTINGS_STATUS_TONE_CLASS = {
  muted: 'border-ds-border bg-ds-bg-page text-ds-text-secondary',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning-text'
} as const

export const AI_SETTINGS_ROW_CLASS =
  'grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-5 py-4 transition-colors duration-ds-fast ease-ds-standard hover:bg-ds-hover/50 max-[760px]:gap-4 max-[760px]:px-4'

export const AI_SETTINGS_FOOTER_CLASS =
  'flex flex-wrap items-center justify-end gap-2.5 border-t border-ds-border-subtle bg-ds-bg-page/65 px-5 py-3.5 max-[760px]:px-4'

export const AI_SETTINGS_COPY_CLASS = 'min-w-0'

export const AI_SETTINGS_TITLE_ROW_CLASS = 'flex min-h-6 min-w-0 flex-wrap items-center justify-start gap-2'

export const AI_SETTINGS_ROW_TITLE_CLASS =
  'block text-sm font-medium leading-[1.4] text-ds-text-primary'

export const AI_SETTINGS_SECONDARY_CLASS =
  'mt-1 block text-[13px] leading-[1.55] text-ds-text-secondary'

export const AI_SETTINGS_SWITCH_WRAP_CLASS = OPTION_SWITCH_WRAP_CLASS

export const AI_SETTINGS_SWITCH_CONTROL_CLASS = OPTION_SWITCH_CONTROL_CLASS

export const AI_SETTINGS_SWITCH_THUMB_CLASS = OPTION_SWITCH_THUMB_CLASS

export const AI_SETTINGS_FIELD_TIP_CLASS =
  'm-0 px-5 py-3.5 text-[13px] leading-[1.55] text-ds-text-secondary max-[760px]:px-4'

export const AI_SETTINGS_LOADING_BADGE_CLASS =
  'inline-flex h-2.5 w-14 flex-none rounded-full bg-ds-text-primary/[0.055]'

export const AI_SETTINGS_LOADING_SWITCH_CLASS =
  'absolute inset-0 rounded-full border-0 bg-ds-surface-3/80'

export const AI_SETTINGS_READY_BODY_CLASS = 'options-settings-ready-body'
