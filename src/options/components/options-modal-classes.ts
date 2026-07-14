import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

export const OPTIONS_MODAL_BACKDROP_CLASS =
  `options-modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-[14px] ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const OPTIONS_MODAL_PANEL_CLASS =
  `options-modal-panel pointer-events-auto relative z-10 w-full max-w-[420px] max-h-[calc(100vh-40px)] min-w-0 overflow-auto rounded-ds-lg border border-ds-border-subtle bg-ds-app p-[24px_24px_22px] text-ds-text-primary shadow-none outline-none max-[640px]:p-5 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const OPTIONS_MODAL_WIDE_PANEL_CLASS = `${OPTIONS_MODAL_PANEL_CLASS} max-w-[620px]`

export const OPTIONS_MODAL_EYEBROW_CLASS =
  'm-0 text-xs font-medium leading-4 text-ds-text-secondary'

export const OPTIONS_MODAL_EYEBROW_TONE_CLASS: Record<string, string> = {
  danger: 'text-ds-danger-text',
  warning: 'text-ds-warning'
}

export const OPTIONS_MODAL_TITLE_CLASS =
  'm-0 mt-2 text-[26px] font-[650] leading-[1.1] tracking-[-0.025em] text-ds-text-primary [overflow-wrap:anywhere] max-[640px]:text-[23px]'

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
  'max-h-[360px] overflow-auto rounded-ds-sm border border-ds-border bg-ds-surface-1 p-2'

export const FOLDER_PICKER_EMPTY_CLASS =
  'grid min-h-[92px] place-items-center rounded-ds-sm px-5 py-5 text-center text-sm leading-[1.6] text-ds-text-muted'

export const FOLDER_PICKER_TREE_ROW_CLASS =
  'relative grid min-h-[34px] grid-cols-[20px_minmax(0,1fr)] items-center gap-1'

export const FOLDER_PICKER_TOGGLE_CLASS =
  'folder-picker-toggle inline-flex h-7 min-h-7 w-5 min-w-5 items-center justify-center rounded-md border border-transparent bg-transparent text-ds-text-muted outline-none transition-[border-color,background-color,color,transform,opacity] duration-ds-fast ease-ds-standard hover:border-ds-border hover:bg-ds-text-primary/[0.055] hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-text-primary/[0.055] focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.36)] focus-visible:outline-offset-1 active:scale-95 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-20'

export const FOLDER_PICKER_TOGGLE_ICON_CLASS =
  'folder-picker-toggle-icon transition-transform duration-ds-fast ease-ds-standard'

export const FOLDER_PICKER_CARD_CLASS =
  'folder-picker-card grid min-h-[34px] w-full min-w-0 cursor-pointer grid-cols-[12px_minmax(0,1fr)] items-center gap-[7px] rounded-md border border-transparent bg-transparent px-2 py-1 text-left font-[inherit] leading-normal text-ds-text-primary shadow-none outline-none transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard hover:border-ds-text-primary/10 hover:bg-ds-text-primary/[0.055] focus-visible:border-ds-text-primary/10 focus-visible:bg-ds-text-primary/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.34)] focus-visible:outline-offset-1 active:scale-[0.993] disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'

export const FOLDER_PICKER_CARD_CURRENT_CLASS =
  'border-ds-border bg-ds-text-primary/[0.11]'

export const FOLDER_PICKER_BRANCH_CLASS =
  'h-2.5 w-2.5 justify-self-center rounded-full border border-white/18 bg-transparent'

export const FOLDER_PICKER_MAIN_CLASS =
  'grid min-w-0 max-w-full gap-px text-left leading-normal'

export const FOLDER_PICKER_TITLE_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold leading-[1.3] text-ds-text-primary'

export const FOLDER_PICKER_DESCRIPTION_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight text-ds-text-muted'

export const FOLDER_PICKER_BADGE_CLASS =
  'inline-flex min-h-[18px] w-fit items-center justify-self-start rounded-full bg-ds-text-primary/[0.07] px-[7px] py-0.5 text-[10px] font-bold leading-tight text-ds-text-primary'

export const FOLDER_PICKER_BADGE_MUTED_CLASS =
  'text-ds-text-disabled'
