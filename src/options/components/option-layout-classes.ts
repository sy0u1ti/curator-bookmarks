export const OPTION_PANEL_ENTER_CLASS = [
  // Navigation marks the movement; the settings themselves stay in place.
  '[.options-motion-ready_&:not([hidden])]:transition-opacity',
  '[.options-motion-ready_&:not([hidden])]:duration-[var(--page-fade-dur)]',
  '[.options-motion-ready_&:not([hidden])]:ease-[var(--page-fade-ease)]',
  '[.options-motion-ready_&:not([hidden])]:starting:opacity-0',
  'motion-reduce:[.options-motion-ready_&:not([hidden])]:transition-opacity',
  'motion-reduce:[.options-motion-ready_&:not([hidden])]:duration-[80ms]'
].join(' ')

export const OPTION_PANEL_BASE_CLASS =
  `mx-auto min-w-0 ${OPTION_PANEL_ENTER_CLASS} max-[920px]:mx-0 max-[920px]:w-full max-[760px]:max-w-full`

const OPTION_PANEL_SURFACE_RESET_CLASS =
  'pt-6 px-0 pb-12 border-0 rounded-none bg-transparent shadow-none'

export const OPTION_PANEL_STANDARD_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} w-[min(100%,1120px)]`

export const OPTION_PANEL_SETTINGS_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} w-[min(100%,840px)]`

export const OPTION_PANEL_WIDE_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} w-[min(100%,1880px)]`

export const OPTION_PANEL_CLASS =
  `${OPTION_PANEL_STANDARD_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_PANEL_SETTINGS_CLASS =
  `${OPTION_PANEL_SETTINGS_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_SURFACE_CLASS =
  'rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 shadow-none'

export const OPTION_INSET_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-bg-page/70 shadow-none'

export const OPTION_GROUP_CLASS =
  `options-interactive-surface curator-motion-surface mt-6 ${OPTION_SURFACE_CLASS} py-0.5 max-[760px]:mt-4`

export const OPTION_TOOL_PANEL_CLASS =
  `options-interactive-surface curator-motion-surface mt-5 ${OPTION_SURFACE_CLASS} p-5 max-[760px]:mt-4 max-[760px]:p-4`

export const OPTION_LIST_SECTION_CLASS =
  'options-interactive-surface curator-motion-surface mt-5 overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 shadow-none max-[760px]:mt-4'

export const OPTION_LIST_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-ds-border-subtle bg-ds-bg-page/45 px-5 py-3.5 max-[760px]:flex-col max-[760px]:items-start max-[760px]:px-4'

export const OPTION_LIST_ROW_CLASS =
  'min-w-0 bg-transparent px-5 py-3.5 transition-colors duration-ds-fast ease-ds-standard hover:bg-ds-hover/40 max-[760px]:px-4'

export const OPTION_RUN_HEADER_CLASS = [
  'options-interactive-surface curator-motion-surface mt-5 grid grid-cols-[minmax(220px,0.82fr)_minmax(260px,1fr)_auto] items-stretch overflow-hidden',
  'rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 divide-x divide-ds-border-subtle',
  'max-[1180px]:grid-cols-[minmax(0,1fr)_auto]',
  'max-[860px]:grid-cols-1 max-[860px]:divide-x-0 max-[860px]:divide-y'
].join(' ')

export const OPTION_RUN_CELL_CLASS =
  'min-w-0 bg-transparent px-5 py-4 max-[760px]:p-4'

export const OPTION_RUN_CELL_TITLE_CLASS =
  'block text-xs font-medium leading-4 tracking-[0.01em] text-ds-text-secondary'

export const OPTION_RUN_CELL_TEXT_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'

export const OPTION_RUN_ACTIONS_CLASS =
  'grid min-w-0 grid-cols-1 content-center gap-2 bg-ds-surface-2/40 px-5 py-4 max-[760px]:p-4'

export const OPTION_RUN_ACTION_BUTTON_CLASS =
  'max-[860px]:w-full'

export const OPTION_ROW_CLASS = [
  'grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4',
  'border-ds-border-subtle bg-transparent transition-colors duration-ds-fast ease-ds-standard hover:bg-ds-hover/50',
  'max-[1180px]:grid-cols-1 max-[1180px]:items-start',
  'max-[760px]:gap-3 max-[760px]:p-4'
].join(' ')

export const OPTION_COPY_CLASS = 'min-w-0 font-[var(--font-sans)]'

export const OPTION_COPY_TITLE_CLASS =
  'm-0 block text-sm font-semibold leading-[1.4] tracking-[-0.01em] text-ds-text-primary'

export const OPTION_COPY_TEXT_CLASS =
  'mt-1.5 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'

export const OPTION_EMPTY_STATE_CLASS =
  'options-interactive-surface curator-motion-surface rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 px-6 py-7 text-left shadow-none'

export const OPTION_EMPTY_STATE_TITLE_CLASS =
  'm-0 text-sm font-semibold leading-[1.4] text-ds-text-primary'

export const OPTION_EMPTY_STATE_TEXT_CLASS =
  'm-0 mt-2 max-w-[620px] text-[13px] leading-[1.65] text-ds-text-secondary'

export const OPTION_EMPTY_STATE_ACTIONS_CLASS =
  'mt-4 flex flex-wrap items-center gap-2.5'

export const OPTION_PANEL_TITLE_CLASS =
  'm-0 max-w-[780px] text-[22px] font-semibold leading-[1.2] tracking-[-0.025em] text-ds-text-primary'

export const OPTION_PANEL_DESCRIPTION_CLASS =
  'mt-2 mb-0 max-w-[720px] text-[13px] leading-[1.6] tracking-[0] text-ds-text-secondary'

export const OPTION_PANEL_HEADER_CLASS =
  'mb-5 border-b border-ds-border-subtle pb-3.5'

export const OPTION_VALUE_CLASS = [
  'inline-flex min-h-5 min-w-0 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap',
  'font-[var(--font-sans)] text-xs font-medium leading-normal text-ds-text-secondary tabular-nums',
  'max-[760px]:w-fit max-[760px]:whitespace-normal'
].join(' ')

export const OPTION_PAGINATION_CLASS =
  'mt-3.5 flex min-h-8 flex-wrap items-center justify-end gap-2.5 text-[13px] text-ds-text-secondary transition-opacity duration-ds-fast ease-ds-standard motion-reduce:duration-[80ms]'

export const OPTION_PAGINATION_LABEL_CLASS =
  'font-[var(--font-sans)] text-[13px] font-semibold leading-normal text-ds-text-muted'

export const OPTION_PAGINATION_RANGE_VALUE_CLASS =
  'options-stable-number inline-block min-w-[13ch] text-right'

export const OPTION_PAGINATION_PAGE_VALUE_CLASS =
  'options-stable-number inline-block min-w-[7ch] text-center'

export const OPTION_RESULT_CHECKBOX_CLASS =
  'inline-grid size-[15px] cursor-pointer place-items-center rounded-ds-xs border border-ds-border-hover bg-ds-surface-2 text-ds-text-inverse outline-none data-[checked]:border-ds-text-primary data-[checked]:bg-ds-text-primary data-[disabled]:cursor-default data-[disabled]:opacity-55 focus-visible:shadow-ds-focus'

export const SCOPE_PICKER_TRIGGER_CLASS = [
  'curator-motion-chip relative inline-flex min-h-9 min-w-[220px] max-w-full items-center justify-start gap-2 overflow-visible',
  'rounded-ds-sm border border-ds-border bg-ds-bg-page px-3',
  'font-[var(--font-sans)] text-[13px] font-medium leading-[1.25] text-ds-text-primary text-left',
  'transition-[background-color,border-color,color,transform,opacity] duration-ds-standard ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-surface-2 hover:text-ds-text-primary',
  'focus-visible:border-ds-focus focus-visible:bg-ds-surface-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ds-focus focus-visible:shadow-none',
  'active:scale-[var(--ds-press-scale)] motion-reduce:active:scale-100 disabled:cursor-default disabled:opacity-55 data-disabled:cursor-default data-disabled:opacity-55',
  'max-[1180px]:w-full max-[1180px]:min-w-0'
].join(' ')

export const SCOPE_PICKER_LABEL_CLASS =
  'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.25]'
