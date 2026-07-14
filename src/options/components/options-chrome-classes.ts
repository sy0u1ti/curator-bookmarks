import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

export const optionsHeaderClass =
  'sticky top-0 z-20 col-[1] row-[1] flex h-[86px] min-h-[86px] w-[244px] min-w-0 items-start justify-start m-0 bg-ds-page bg-none p-[14px_16px_0] shadow-none pointer-events-auto max-[1180px]:w-[220px] max-[920px]:static max-[920px]:mx-auto max-[920px]:h-auto max-[920px]:w-[min(100%,760px)] max-[920px]:p-[14px_0_0] max-[760px]:w-full max-[760px]:max-w-full max-[760px]:min-w-0'

export const optionsSidebarClass =
  'sticky top-0 max-[920px]:static z-[9] self-stretch h-auto w-full max-w-[244px] max-[1180px]:max-w-[220px] max-[920px]:max-w-none min-h-screen max-[920px]:min-h-0 max-h-screen max-[920px]:max-h-none mt-0 pt-[120px] pr-[16px] pb-[18px] pl-[16px] max-[920px]:pt-[18px] max-[920px]:pr-0 max-[920px]:pb-0 max-[920px]:pl-0 overflow-auto max-[920px]:overflow-visible max-[920px]:col-[1] max-[920px]:row-[1] bg-ds-page border-0 pointer-events-auto rounded-none shadow-none'

export const optionsBrandClassBase =
  'curator-motion-chip inline-flex min-h-[58px] min-w-0 items-center gap-3 p-[6px_0]'

export const optionsBrandMarkClass =
  'h-[46px] w-[46px] flex-none overflow-hidden rounded-ds-sm border border-ds-border bg-ds-surface-1 shadow-none max-[760px]:h-[54px] max-[760px]:w-[54px]'

export const optionsBrandMarkImageClass =
  'block h-full w-full object-cover [filter:grayscale(1)_contrast(1.08)_brightness(0.9)]'

export const optionsBrandCopyClass =
  'min-w-0 flex flex-col gap-[5px] [font-family:var(--font-sans)]'

export const optionsSidebarLabelClass =
  'm-0 [font-family:var(--font-sans)] text-xs font-medium leading-4 text-ds-text-muted max-[920px]:[overflow-wrap:anywhere]'

export const navGroupClass = 'grid min-w-0 gap-2'

export const navClass =
  'grid grid-cols-[minmax(0,1fr)] justify-stretch gap-1 max-[920px]:grid-cols-[repeat(auto-fit,minmax(148px,1fr))] max-[760px]:grid-cols-[minmax(0,1fr)]'

export const navCollapsibleClass = 'grid min-w-0 gap-[3px] max-[920px]:w-full'

export const navLinkClass = [
  'curator-motion-row relative flex min-h-[34px] w-full items-center justify-start overflow-hidden rounded-ds-sm border border-transparent bg-transparent px-2.5 py-0',
  '[font-family:var(--font-sans)] text-[13px] font-semibold text-left text-ds-text-secondary',
  '[transition:background_var(--ds-motion-standard)_var(--ds-ease-standard),color_var(--ds-motion-standard)_var(--ds-ease-standard),transform_var(--ds-motion-fast)_var(--ds-ease-standard)]',
  'hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:bg-ds-hover focus-visible:text-ds-text-primary',
  'active:scale-[0.985]',
  '[&[aria-current=page]]:border-ds-accent-line [&[aria-current=page]]:bg-ds-selected [&[aria-current=page]]:text-ds-accent-text [&[aria-current=page]]:shadow-none [&[aria-current=page]]:transform-none',
  'max-[920px]:min-h-[38px] max-[920px]:border-ds-border max-[920px]:bg-ds-surface-1 max-[920px]:[overflow-wrap:anywhere] max-[920px]:transform-none',
  'max-[920px]:hover:transform-none max-[920px]:focus-visible:transform-none max-[920px]:active:transform-none max-[920px]:[&[aria-current=page]]:transform-none',
  'max-[760px]:bg-ds-surface-1'
].join(' ')

export const navSublistClass = [
  'grid gap-1 ml-2.5 pl-2.5 border-l border-ds-border-subtle',
  'origin-top [transform:translateY(0)] transition-[opacity,transform] duration-ds-fast ease-ds-standard',
  '[&[hidden]]:hidden data-[starting-style]:overflow-hidden data-[starting-style]:opacity-0 data-[starting-style]:[transform:translateY(-4px)] data-[starting-style]:will-change-[opacity,transform] data-[ending-style]:overflow-hidden data-[ending-style]:opacity-0 data-[ending-style]:[transform:translateY(-4px)] data-[ending-style]:will-change-[opacity,transform]',
  'motion-reduce:transition-none max-[920px]:ml-0 max-[920px]:mt-1.5 max-[920px]:border-l-0'
].join(' ')

export const navGroupTriggerClass =
  'curator-motion-row relative flex items-center gap-2 min-h-[34px] max-[920px]:min-h-[38px] w-full cursor-pointer justify-between font-semibold rounded-ds-sm border-0 bg-transparent p-[0_10px] text-left text-[13px] text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary focus-visible:bg-ds-hover focus-visible:text-ds-text-primary [font:inherit] max-[920px]:border max-[920px]:border-ds-border max-[920px]:bg-ds-surface-1 max-[920px]:hover:bg-ds-hover max-[920px]:focus-visible:bg-ds-hover max-[920px]:[overflow-wrap:anywhere] max-[920px]:[writing-mode:horizontal-tb] max-[920px]:transform-none'

export const navSubitemClass = [
  'flex min-h-8 w-full items-center justify-start pl-6 text-left font-semibold text-ds-text-secondary',
  'hover:text-ds-text-primary focus-visible:text-ds-text-primary',
  '[&[aria-current=page]]:font-semibold [&[aria-current=page]]:text-ds-text-primary',
  'max-[920px]:w-full max-[920px]:pl-6 max-[920px]:[overflow-wrap:anywhere] max-[920px]:[writing-mode:horizontal-tb]'
].join(' ')

export const optionsDashboardEntryClass = [
  'curator-motion-card flex min-h-[58px] flex-col justify-center gap-1 mt-4 px-3.5 py-3',
  'border border-transparent rounded-ds-sm bg-transparent text-ds-text-secondary shadow-none',
  '[font-family:var(--font-sans)] transition-[border-color,background,color] duration-ds-standard ease-ds-standard',
  'hover:border-ds-accent-line hover:bg-ds-selected hover:text-ds-accent-text',
  'focus-visible:border-ds-accent-line focus-visible:bg-ds-selected focus-visible:text-ds-accent-text',
  '[&[aria-current=page]]:border-ds-accent-line [&[aria-current=page]]:bg-ds-selected [&[aria-current=page]]:text-ds-accent-text',
  'hover:[&_span]:text-ds-text-primary focus-visible:[&_span]:text-ds-text-primary [&[aria-current=page]_span]:text-ds-text-primary',
  'hover:[&_strong]:text-ds-text-primary focus-visible:[&_strong]:text-ds-text-primary [&[aria-current=page]_strong]:text-ds-text-primary',
  'max-[920px]:mt-2.5 max-[920px]:min-h-[42px] max-[920px]:w-full max-[920px]:flex-row max-[920px]:items-center max-[920px]:justify-between max-[920px]:px-3.5 max-[920px]:py-0 max-[920px]:[overflow-wrap:anywhere] max-[920px]:[writing-mode:horizontal-tb]'
].join(' ')

export const optionsDashboardEntryEyebrowClass =
  'font-[var(--font-sans)] text-xs font-medium text-ds-text-muted'

export const optionsDashboardEntryTitleClass =
  'font-[var(--font-sans)] text-sm font-semibold text-ds-text-secondary'

export const optionsLayoutClass = [
  'grid h-screen min-h-0 w-full min-w-0 grid-cols-[244px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch relative z-[1] gap-0 m-0 bg-ds-page pointer-events-none [grid-column:1/-1] [grid-row:1] max-[1180px]:grid-cols-[220px_minmax(0,1fr)] max-[920px]:h-auto max-[920px]:w-[min(100%,760px)] max-[920px]:grid-cols-[minmax(0,1fr)] max-[920px]:gap-5 max-[920px]:mx-auto max-[920px]:pointer-events-auto max-[760px]:max-w-full',
  '[.dashboard-fullscreen-active_&]:block [.dashboard-fullscreen-active_&]:h-screen [.dashboard-fullscreen-active_&]:min-h-screen',
  '[.dashboard-fullscreen-active_&]:w-full [.dashboard-fullscreen-active_&]:m-0 [.dashboard-fullscreen-active_&]:pointer-events-auto',
  '[.options-dashboard-embed.dashboard-fullscreen-active_&]:bg-transparent'
].join(' ')

export const optionsMainClass = [
  'relative z-[1] h-screen min-h-screen w-full max-w-none min-w-0 overflow-auto p-[24px_clamp(24px,3vw,56px)_56px] pt-[clamp(24px,3vw,44px)] pointer-events-auto [grid-column:2] [grid-row:1] [scrollbar-gutter:stable] bg-ds-app max-[920px]:[grid-column:1] max-[920px]:[grid-row:2] max-[920px]:h-auto max-[920px]:min-h-0 max-[920px]:overflow-visible max-[920px]:p-[24px_0_0] max-[760px]:max-w-full',
  '[.dashboard-fullscreen-active_&]:w-full [.dashboard-fullscreen-active_&]:max-w-none',
  '[.dashboard-fullscreen-active_&]:h-screen [.dashboard-fullscreen-active_&]:min-h-screen',
  '[.dashboard-fullscreen-active_&]:overflow-hidden [.dashboard-fullscreen-active_&]:p-0',
  '[.options-dashboard-embed.dashboard-fullscreen-active_&]:bg-transparent'
].join(' ')

export const optionsShellClassBase = [
  'options-shell relative isolate grid h-screen min-h-screen grid-cols-[244px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden bg-ds-page [background-image:none] p-0 [font-family:var(--font-sans)] text-ds-text-primary [line-break:strict] [hanging-punctuation:allow-end] [text-spacing-trim:trim-start] [text-autospace:normal] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[line-break:auto] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[hanging-punctuation:none] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[text-spacing-trim:space-all] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[text-autospace:no-autospace] max-[1180px]:grid-cols-[220px_minmax(0,1fr)] max-[920px]:block max-[920px]:h-dvh max-[920px]:min-h-dvh max-[920px]:max-h-dvh max-[920px]:overflow-x-hidden max-[920px]:overflow-y-auto max-[920px]:overscroll-contain max-[920px]:[scrollbar-gutter:stable] max-[920px]:p-[0_24px_36px] max-[760px]:w-full max-[760px]:max-w-full max-[760px]:px-[14px] gap-x-0 justify-stretch',
  '[-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]',
  OPTIONS_REDUCED_MOTION_SURFACE_CLASS,
  '[&.dashboard-fullscreen-active]:block [&.dashboard-fullscreen-active]:h-screen',
  '[&.dashboard-fullscreen-active]:min-h-screen [&.dashboard-fullscreen-active]:overflow-hidden',
  '[&.dashboard-fullscreen-active]:p-0',
  '[&.options-dashboard-embed]:bg-transparent'
].join(' ')

export const optionsSidebarDividerClass =
  'pointer-events-none fixed top-0 bottom-0 left-[244px] z-[30] w-px bg-[var(--ds-border-subtle)] max-[1180px]:left-[220px] max-[920px]:hidden'
