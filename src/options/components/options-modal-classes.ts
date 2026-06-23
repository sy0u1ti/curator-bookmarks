import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

export const OPTIONS_MODAL_BACKDROP_CLASS =
  `fixed inset-0 z-30 grid place-items-center bg-black/70 p-5 backdrop-blur-[14px] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const OPTIONS_MODAL_PANEL_CLASS =
  `w-full max-w-[420px] max-h-[calc(100vh-40px)] min-w-0 overflow-auto rounded-ds-lg border border-ds-border-subtle bg-ds-app p-[24px_24px_22px] text-ds-text-primary shadow-none outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 max-[640px]:p-5 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const OPTIONS_MODAL_WIDE_PANEL_CLASS = `${OPTIONS_MODAL_PANEL_CLASS} max-w-[620px]`

export const OPTIONS_MODAL_EYEBROW_CLASS =
  'm-0 text-[11px] font-bold uppercase leading-none tracking-[0.18em] text-ds-text-disabled'

export const OPTIONS_MODAL_EYEBROW_TONE_CLASS: Record<string, string> = {
  danger: 'text-ds-danger-text',
  warning: 'text-ds-warning'
}

export const OPTIONS_MODAL_TITLE_CLASS =
  'm-0 mt-2.5 text-[26px] font-[650] leading-[1.1] tracking-[0] text-ds-text-primary [overflow-wrap:anywhere] max-[640px]:text-[23px]'

export const OPTIONS_MODAL_COPY_CLASS =
  'm-0 mt-3.5 text-sm leading-[1.75] text-ds-text-secondary [overflow-wrap:anywhere]'

export const OPTIONS_MODAL_ACTIONS_CLASS =
  'mt-[22px] flex flex-wrap items-center justify-end gap-3 max-[640px]:flex-col-reverse max-[640px]:items-stretch'

export const OPTIONS_MODAL_BUTTON_CLASS = 'min-h-9 px-3'

export const OPTIONS_MODAL_PRIMARY_BUTTON_CLASS =
  ''

export const OPTIONS_MODAL_DANGER_BUTTON_CLASS =
  ''

export const OPTIONS_MODAL_SEARCH_CLASS =
  'mt-[18px] grid gap-[7px] rounded-ds-sm border border-ds-border bg-ds-surface-1 p-[10px_12px]'

export const OPTIONS_MODAL_SEARCH_LABEL_CLASS =
  'text-xs font-semibold leading-normal text-ds-text-secondary'

export const OPTIONS_MODAL_SEARCH_INPUT_CLASS =
  'min-h-[46px] bg-ds-surface-2 placeholder:text-ds-text-disabled focus:bg-ds-hover focus-visible:bg-ds-hover'

export const OPTIONS_MODAL_RESULTS_CLASS =
  'm-0 max-h-[360px] list-none overflow-auto rounded-ds-sm border border-ds-border bg-ds-surface-1 p-2'

export const FOLDER_PICKER_EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-2 p-4 text-sm leading-[1.65] text-ds-text-muted'

export const FOLDER_PICKER_CARD_CLASS =
  'grid min-h-14 w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)] items-start justify-stretch gap-[3px] rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3 py-[9px] text-left font-[inherit] leading-normal text-ds-text-primary outline-none transition-[background,border-color,transform] hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:ring-2 focus-visible:ring-ds-focus/35 active:scale-[0.988] disabled:cursor-default disabled:opacity-55 data-disabled:cursor-default data-disabled:opacity-55 aria-[current=true]:border-ds-border-hover aria-[current=true]:bg-ds-selected'

export const FOLDER_PICKER_HEAD_CLASS =
  'grid min-w-0 grid-cols-[22px_minmax(0,1fr)] items-center gap-2 text-left'

export const FOLDER_PICKER_ICON_CLASS =
  'size-[22px] rounded-ds-sm border border-ds-border bg-ds-surface-3'

export const FOLDER_PICKER_TITLE_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold leading-[1.4] text-ds-text-primary'

export const FOLDER_PICKER_DESCRIPTION_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[1.55] text-ds-text-secondary'

export const FOLDER_PICKER_SCOPE_DESCRIPTION_CLASS =
  `${FOLDER_PICKER_DESCRIPTION_CLASS} pl-[30px]`
