export const OPTION_PANEL_ENTER_CLASS = [
  '[&:not([hidden])]:transition-[opacity,translate]',
  '[&:not([hidden])]:duration-[var(--ui-motion-standard)]',
  '[&:not([hidden])]:ease-[var(--ui-ease-standard)]',
  '[&:not([hidden])]:starting:opacity-0',
  '[&:not([hidden])]:starting:translate-y-1.5',
  'motion-reduce:[&:not([hidden])]:transition-none'
].join(' ')

export const OPTION_REVEAL_ENTER_CLASS = [
  'transition-[opacity,translate]',
  'duration-[var(--ui-motion-standard)]',
  'ease-[var(--ui-ease-standard)]',
  'starting:opacity-0',
  'starting:-translate-y-1',
  'motion-reduce:transition-none'
].join(' ')

export const OPTION_PANEL_BASE_CLASS =
  `!mx-auto !min-w-0 ${OPTION_PANEL_ENTER_CLASS} max-[920px]:!mx-0 max-[920px]:!w-full max-[760px]:!max-w-full`

const OPTION_PANEL_SURFACE_RESET_CLASS =
  '!pt-6 !px-0 !pb-12 !border-0 !rounded-none !bg-transparent !shadow-none'

export const OPTION_PANEL_STANDARD_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} !w-[min(100%,1120px)]`

export const OPTION_PANEL_WIDE_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} !w-[min(100%,1880px)]`

export const OPTION_PANEL_CLASS =
  `${OPTION_PANEL_STANDARD_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_WIDE_PANEL_CLASS =
  `${OPTION_PANEL_WIDE_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_GROUP_CLASS =
  'mt-7 rounded-[var(--ui-radius-group)] border border-[rgba(255,255,255,0.055)] bg-[rgba(28,28,30,0.86)] py-2 max-[760px]:mt-5'

export const OPTION_ROW_CLASS = [
  'grid min-h-[66px] grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px] p-[14px_16px]',
  'border-[var(--ui-divider-subtle)] bg-transparent',
  'max-[1180px]:grid-cols-1 max-[1180px]:items-start',
  'max-[760px]:gap-3 max-[760px]:p-4'
].join(' ')

export const OPTION_COPY_CLASS = 'min-w-0 font-[var(--font-sans)]'

export const OPTION_COPY_TITLE_CLASS =
  'm-0 block text-[15px] font-[650] leading-normal tracking-[0] text-[var(--ui-text-primary)]'

export const OPTION_COPY_TEXT_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.65] text-[var(--ui-text-tertiary)]'

export const OPTION_SECTION_LABEL_CLASS =
  'm-0 font-[var(--font-sans)] text-[11px] font-semibold uppercase leading-normal tracking-[0] text-[var(--ui-accent-strong)] opacity-100'

export const OPTION_PANEL_TITLE_CLASS =
  'mt-[9px] mb-0 max-w-[780px] text-[clamp(27px,2.2vw,34px)] font-[720] leading-[1.15] tracking-[0] text-[var(--ui-text-primary)]'

export const OPTION_PANEL_DESCRIPTION_CLASS =
  'mt-[10px] mb-0 max-w-[760px] text-[13px] leading-[1.7] tracking-[0] text-[var(--ui-text-secondary)]'

export const OPTION_VALUE_CLASS = [
  'inline-flex min-h-6 min-w-0 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap',
  'rounded-[var(--ui-radius-pill)] border border-[var(--ui-surface-hover)] bg-[rgba(255,255,255,0.055)] px-3.5',
  'font-[var(--font-sans)] text-xs font-semibold leading-normal tracking-[0] text-[var(--ui-text-secondary)]',
  'max-[760px]:w-fit max-[760px]:whitespace-normal'
].join(' ')

export const OPTION_PAGINATION_CLASS =
  'mt-3.5 flex flex-wrap items-center justify-end gap-2.5 text-[13px] text-[var(--ui-text-secondary)]'

export const OPTION_PAGINATION_LABEL_CLASS =
  'font-[var(--font-sans)] text-[13px] font-semibold leading-normal text-[var(--ui-text-tertiary)]'

export const OPTION_RESULT_CHECKBOX_CLASS =
  'inline-grid size-[15px] cursor-pointer place-items-center rounded-[3px] border border-[rgba(245,245,247,0.7)] bg-[rgba(245,245,247,0.05)] text-[#050506] outline-none data-[checked]:border-[#f5f5f7] data-[checked]:bg-[#f5f5f7] data-[disabled]:cursor-default data-[disabled]:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(59,130,246,0.7)]'

export const SCOPE_PICKER_TRIGGER_CLASS = [
  'relative inline-flex min-h-9 min-w-[220px] max-w-full items-center justify-start gap-2 overflow-visible',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-[0_12px_0_32px]',
  'font-[var(--font-sans)] text-[13px] font-semibold leading-[1.25] text-[var(--ui-text-primary)] text-left',
  'transition-[background,border-color,color,transform,opacity] duration-200 ease-[var(--ui-ease-standard)]',
  'before:absolute before:left-3 before:content-[">"] before:font-mono before:text-[var(--ui-accent-strong)] before:font-bold',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)]',
  'focus-visible:border-[var(--ui-focus-ring)] focus-visible:bg-[var(--ui-surface-raised)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus-ring)] focus-visible:shadow-none',
  'active:scale-[0.985] disabled:cursor-default disabled:opacity-55 data-disabled:cursor-default data-disabled:opacity-55',
  'max-[1180px]:w-full max-[1180px]:min-w-0'
].join(' ')

export const SCOPE_PICKER_LABEL_CLASS =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.25]'
