export const OPTION_PANEL_ENTER_CLASS = [
  '[&:not([hidden])]:transition-[opacity,translate]',
  '[&:not([hidden])]:duration-ds-standard',
  '[&:not([hidden])]:ease-ds-standard',
  '[&:not([hidden])]:starting:opacity-0',
  '[&:not([hidden])]:starting:translate-y-1.5',
  'motion-reduce:[&:not([hidden])]:transition-none'
].join(' ')

export const OPTION_REVEAL_ENTER_CLASS = [
  'transition-[opacity,translate]',
  'duration-ds-standard',
  'ease-ds-standard',
  'starting:opacity-0',
  'starting:-translate-y-1',
  'motion-reduce:transition-none'
].join(' ')

export const OPTION_PANEL_BASE_CLASS =
  `mx-auto min-w-0 ${OPTION_PANEL_ENTER_CLASS} max-[920px]:mx-0 max-[920px]:w-full max-[760px]:max-w-full`

const OPTION_PANEL_SURFACE_RESET_CLASS =
  'pt-6 px-0 pb-12 border-0 rounded-none bg-transparent shadow-none'

export const OPTION_PANEL_STANDARD_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} w-[min(100%,1120px)]`

export const OPTION_PANEL_WIDE_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} w-[min(100%,1880px)]`

export const OPTION_PANEL_CLASS =
  `${OPTION_PANEL_STANDARD_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_WIDE_PANEL_CLASS =
  `${OPTION_PANEL_WIDE_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_GROUP_CLASS =
  'mt-7 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 py-2 max-[760px]:mt-5'

export const OPTION_ROW_CLASS = [
  'grid min-h-[66px] grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px] p-[14px_16px]',
  'border-ds-border-subtle bg-transparent',
  'max-[1180px]:grid-cols-1 max-[1180px]:items-start',
  'max-[760px]:gap-3 max-[760px]:p-4'
].join(' ')

export const OPTION_COPY_CLASS = 'min-w-0 font-[var(--font-sans)]'

export const OPTION_COPY_TITLE_CLASS =
  'm-0 block text-[15px] font-[650] leading-normal tracking-[0] text-ds-text-primary'

export const OPTION_COPY_TEXT_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.65] text-ds-text-muted'

export const OPTION_SECTION_LABEL_CLASS =
  'm-0 font-[var(--font-sans)] text-[11px] font-semibold uppercase leading-normal tracking-[0] text-ds-accent-hover opacity-100'

export const OPTION_PANEL_TITLE_CLASS =
  'mt-[9px] mb-0 max-w-[780px] text-[clamp(27px,2.2vw,34px)] font-[720] leading-[1.15] tracking-[0] text-ds-text-primary'

export const OPTION_PANEL_DESCRIPTION_CLASS =
  'mt-[10px] mb-0 max-w-[760px] text-[13px] leading-[1.7] tracking-[0] text-ds-text-secondary'

export const OPTION_VALUE_CLASS = [
  'inline-flex min-h-6 min-w-0 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap',
  'rounded-full border border-ds-hover bg-ds-surface-2 px-3.5',
  'font-[var(--font-sans)] text-xs font-semibold leading-normal tracking-[0] text-ds-text-secondary',
  'max-[760px]:w-fit max-[760px]:whitespace-normal'
].join(' ')

export const OPTION_PAGINATION_CLASS =
  'mt-3.5 flex flex-wrap items-center justify-end gap-2.5 text-[13px] text-ds-text-secondary'

export const OPTION_PAGINATION_LABEL_CLASS =
  'font-[var(--font-sans)] text-[13px] font-semibold leading-normal text-ds-text-muted'

export const OPTION_RESULT_CHECKBOX_CLASS =
  'inline-grid size-[15px] cursor-pointer place-items-center rounded-ds-sm border border-ds-border-hover bg-ds-surface-2 text-ds-text-inverse outline-none data-[checked]:border-ds-text-primary data-[checked]:bg-ds-text-primary data-[disabled]:cursor-default data-[disabled]:opacity-55 focus-visible:shadow-ds-focus'

export const SCOPE_PICKER_TRIGGER_CLASS = [
  'relative inline-flex min-h-9 min-w-[220px] max-w-full items-center justify-start gap-2 overflow-visible',
  'rounded-ds-sm border border-ds-border bg-ds-surface-2 p-[0_12px_0_32px]',
  'font-[var(--font-sans)] text-[13px] font-semibold leading-[1.25] text-ds-text-primary text-left',
  'transition-[background,border-color,color,transform,opacity] duration-200 ease-ds-standard',
  'before:absolute before:left-3 before:content-[">"] before:font-mono before:text-ds-accent-hover before:font-bold',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-focus focus-visible:bg-ds-surface-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ds-focus focus-visible:shadow-none',
  'active:scale-[0.985] disabled:cursor-default disabled:opacity-55 data-disabled:cursor-default data-disabled:opacity-55',
  'max-[1180px]:w-full max-[1180px]:min-w-0'
].join(' ')

export const SCOPE_PICKER_LABEL_CLASS =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.25]'
