import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

export const OPTIONS_MODAL_BACKDROP_CLASS =
  `fixed inset-0 z-30 grid place-items-center bg-black/70 p-5 backdrop-blur-[14px] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const OPTIONS_MODAL_PANEL_CLASS =
  `w-full max-w-[420px] max-h-[calc(100vh-40px)] min-w-0 overflow-auto rounded-[var(--ui-radius-panel)] border border-[var(--ui-divider-subtle)] bg-[var(--ui-bg-main)] p-[24px_24px_22px] text-[var(--ui-text-primary)] shadow-none outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 max-[640px]:p-5 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const OPTIONS_MODAL_WIDE_PANEL_CLASS = `${OPTIONS_MODAL_PANEL_CLASS} max-w-[620px]`

export const OPTIONS_MODAL_EYEBROW_CLASS =
  'm-0 text-[11px] font-bold uppercase leading-none tracking-[0.18em] text-[rgba(245,245,247,0.28)]'

export const OPTIONS_MODAL_EYEBROW_TONE_CLASS: Record<string, string> = {
  danger: 'text-[#ff8a82]',
  warning: 'text-[#ffc86e]'
}

export const OPTIONS_MODAL_TITLE_CLASS =
  'm-0 mt-2.5 text-[26px] font-[650] leading-[1.1] tracking-[0] text-[var(--ui-text-primary)] [overflow-wrap:anywhere] max-[640px]:text-[23px]'

export const OPTIONS_MODAL_COPY_CLASS =
  'm-0 mt-3.5 text-sm leading-[1.75] text-[var(--ui-text-secondary)] [overflow-wrap:anywhere]'

export const OPTIONS_MODAL_ACTIONS_CLASS =
  'mt-[22px] flex flex-wrap items-center justify-end gap-3 max-[640px]:flex-col-reverse max-[640px]:items-stretch'

export const OPTIONS_MODAL_BUTTON_CLASS = 'min-h-9 px-3'

export const OPTIONS_MODAL_PRIMARY_BUTTON_CLASS =
  '!border-[var(--ui-accent-line)] !bg-[var(--ui-accent-strong)] !text-[var(--ui-text-inverse)] hover:!border-[var(--ui-accent-line)] hover:!bg-[var(--ui-accent-strong)] hover:!text-[var(--ui-text-inverse)] hover:brightness-110 focus-visible:!border-[var(--ui-accent-line)] focus-visible:!bg-[var(--ui-accent-strong)] focus-visible:!text-[var(--ui-text-inverse)] focus-visible:brightness-110'

export const OPTIONS_MODAL_DANGER_BUTTON_CLASS =
  '!border-[rgba(255,138,130,0.24)] !bg-[rgba(255,138,130,0.08)] !text-[#ffb7b0] hover:!border-[rgba(255,138,130,0.36)] hover:!bg-[rgba(255,138,130,0.14)] hover:!text-[#ffd8d4] focus-visible:!border-[rgba(255,138,130,0.36)] focus-visible:!bg-[rgba(255,138,130,0.14)] focus-visible:!text-[#ffd8d4]'

export const OPTIONS_MODAL_SEARCH_CLASS =
  'mt-[18px] grid gap-[7px] rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] p-[10px_12px]'

export const OPTIONS_MODAL_SEARCH_LABEL_CLASS =
  'text-xs font-semibold leading-normal text-[var(--ui-text-secondary)]'

export const OPTIONS_MODAL_SEARCH_INPUT_CLASS =
  'min-h-[46px] !rounded-[var(--ui-radius-control)] !border-[var(--ui-divider)] !bg-[var(--ui-surface-raised)] !text-[var(--ui-text-primary)] placeholder:text-[var(--ui-text-disabled)] focus:!border-[var(--ui-focus-ring)] focus:!bg-[var(--ui-surface-hover)] focus:!shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus:ring-0 focus-visible:!border-[var(--ui-focus-ring)] focus-visible:!bg-[var(--ui-surface-hover)] focus-visible:!shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus-visible:ring-0'

export const OPTIONS_MODAL_RESULTS_CLASS =
  'm-0 max-h-[360px] list-none overflow-auto rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] p-2'

export const FOLDER_PICKER_EMPTY_CLASS =
  'rounded-[var(--ui-radius-control)] border border-[rgba(255,255,255,0.055)] bg-[rgba(255,255,255,0.035)] p-4 text-sm leading-[1.65] text-[var(--ui-text-tertiary)]'

export const FOLDER_PICKER_CARD_CLASS =
  'grid min-h-14 w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)] items-start justify-stretch gap-[3px] rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-3 py-[9px] text-left font-[inherit] leading-normal text-[var(--ui-text-primary)] outline-none transition-[background,border-color,transform] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:ring-2 focus-visible:ring-white/12 active:scale-[0.988] disabled:cursor-default disabled:opacity-55 data-disabled:cursor-default data-disabled:opacity-55 aria-[current=true]:border-[rgba(245,245,247,0.22)] aria-[current=true]:bg-[#232327]'

export const FOLDER_PICKER_HEAD_CLASS =
  'grid min-w-0 grid-cols-[22px_minmax(0,1fr)] items-center gap-2 text-left'

export const FOLDER_PICKER_ICON_CLASS =
  'size-[22px] rounded-[7px] border border-[rgba(245,245,247,0.08)] bg-[linear-gradient(135deg,rgba(245,245,247,0.18),rgba(245,245,247,0.04))]'

export const FOLDER_PICKER_TITLE_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-[1.4] text-[var(--ui-text-primary)]'

export const FOLDER_PICKER_DESCRIPTION_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[1.55] text-[var(--ui-text-secondary)]'

export const FOLDER_PICKER_SCOPE_DESCRIPTION_CLASS =
  `${FOLDER_PICKER_DESCRIPTION_CLASS} pl-[30px]`
