import {
  OPTIONS_REDUCED_MOTION_SHELL_TRANSFORM_CLASS,
  OPTIONS_REDUCED_MOTION_SURFACE_CLASS
} from './options-motion-classes.js'

export const optionsHeaderClass =
  'sticky top-0 z-20 col-[1] row-[1] flex h-[86px] min-h-[86px] w-[244px] min-w-0 items-start justify-start m-0 bg-[#000000] bg-none p-[14px_16px_0] shadow-none pointer-events-auto max-[1180px]:w-[220px] max-[920px]:static max-[920px]:mx-auto max-[920px]:h-auto max-[920px]:w-[min(100%,760px)] max-[920px]:p-[14px_0_0] max-[760px]:w-full max-[760px]:max-w-full max-[760px]:min-w-0'

export const optionsSidebarClass =
  'sticky top-0 max-[920px]:static z-[9] self-stretch h-auto w-full max-w-[244px] max-[1180px]:max-w-[220px] max-[920px]:max-w-none min-h-screen max-[920px]:min-h-0 max-h-screen max-[920px]:max-h-none mt-0 pt-[120px] pr-[16px] pb-[18px] pl-[16px] max-[920px]:pt-[18px] max-[920px]:pr-0 max-[920px]:pb-0 max-[920px]:pl-0 overflow-auto max-[920px]:overflow-visible max-[920px]:col-[1] max-[920px]:row-[1] !bg-[#000000] !border-0 ![border:0] !pointer-events-auto !rounded-none !shadow-none ![box-shadow:none]'

export const optionsBrandClassBase =
  'inline-flex min-h-[58px] min-w-0 items-center gap-3 p-[6px_0]'

export const optionsBrandMarkClass =
  'h-[46px] w-[46px] flex-none overflow-hidden rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] shadow-none max-[760px]:h-[54px] max-[760px]:w-[54px]'

export const optionsBrandMarkImageClass =
  'block h-full w-full object-cover [filter:grayscale(1)_contrast(1.08)_brightness(0.9)]'

export const optionsBrandCopyClass =
  'min-w-0 flex flex-col gap-[5px] [font-family:var(--font-sans)]'

export const optionsSidebarLabelClass =
  'm-0 [font-family:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0] text-[rgba(248,248,242,0.42)] max-[920px]:[overflow-wrap:anywhere]'

export const navGroupClass = 'grid min-w-0 gap-2'

export const navClass =
  'grid grid-cols-[minmax(0,1fr)] justify-stretch gap-1 max-[920px]:grid-cols-[repeat(auto-fit,minmax(148px,1fr))] max-[760px]:grid-cols-[minmax(0,1fr)]'

export const navCollapsibleClass = 'grid min-w-0 gap-[3px] max-[920px]:w-full'

export const navLinkClass = [
  'relative flex min-h-[34px] w-full items-center justify-start overflow-hidden rounded-[var(--ui-radius-control)] border border-transparent bg-transparent px-2.5 py-0 pl-6',
  '[font-family:var(--font-sans)] text-[13px] font-[650] text-left text-[rgba(248,248,242,0.68)]',
  '[transition:background_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-fast)_var(--ui-ease-standard)]',
  'before:absolute before:left-[9px] before:font-mono before:text-[var(--ui-text-disabled)] before:font-bold before:content-["-"]',
  'hover:bg-[var(--ui-surface-hover)] hover:!text-white',
  'focus-visible:bg-[var(--ui-surface-hover)] focus-visible:!text-white',
  'active:scale-[0.985]',
  '[&[aria-current=page]]:border-[var(--ui-accent-line)] [&[aria-current=page]]:bg-[var(--ui-surface-selected)] [&[aria-current=page]]:text-[var(--ui-accent-text)] [&[aria-current=page]]:shadow-none [&[aria-current=page]]:transform-none',
  '[&[aria-current=page]]:before:text-[var(--ui-accent-strong)]',
  'max-[920px]:min-h-[38px] max-[920px]:border-[var(--ui-divider)] max-[920px]:bg-[var(--ui-surface)] max-[920px]:[overflow-wrap:anywhere] max-[920px]:transform-none',
  'max-[920px]:hover:transform-none max-[920px]:focus-visible:transform-none max-[920px]:active:transform-none max-[920px]:[&[aria-current=page]]:transform-none',
  'max-[760px]:bg-[var(--ui-surface)]'
].join(' ')

export const navSublistClass = [
  'grid gap-1 ml-2.5 pl-2.5 border-l border-[rgba(255,255,255,0.08)]',
  '[transition:max-height_240ms_cubic-bezier(0.55,0,0.25,1),opacity_160ms_cubic-bezier(0.55,0,0.25,1)]',
  '[&[hidden]]:hidden data-[nav-animating=true]:overflow-hidden data-[nav-animating=true]:will-change-[max-height,opacity]',
  'motion-reduce:transition-none max-[920px]:ml-0 max-[920px]:mt-1.5 max-[920px]:border-l-0'
].join(' ')

export const navGroupTriggerClass =
  '!relative !flex !items-center !gap-2 !min-h-[34px] max-[920px]:!min-h-[38px] !w-full !cursor-pointer !justify-between !font-[650] rounded-[var(--ui-radius-control)] border-0 bg-transparent !p-[0_10px_0_30px] !text-left !text-[13px] text-[rgba(248,248,242,0.68)] before:absolute before:left-[10px] before:font-mono before:[font-weight:750] before:text-[var(--ui-text-disabled)] before:content-[">"] [&[aria-expanded=true]::before]:text-[var(--ui-accent-strong)] hover:bg-[var(--ui-surface-hover)] hover:!text-white focus-visible:bg-[var(--ui-surface-hover)] focus-visible:!text-white [font:inherit] [transition:background_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard)] max-[920px]:border max-[920px]:border-[var(--ui-divider)] max-[920px]:bg-[var(--ui-surface)] max-[920px]:hover:bg-[var(--ui-surface-hover)] max-[920px]:focus-visible:bg-[var(--ui-surface-hover)] max-[920px]:[overflow-wrap:anywhere] max-[920px]:[writing-mode:horizontal-tb] max-[920px]:transform-none'

export const navSubitemClass = [
  'flex !min-h-8 w-full items-center justify-start !pl-6 text-left font-[650] text-[rgba(248,248,242,0.68)]',
  'hover:!text-white focus-visible:!text-white',
  '[&[aria-current=page]]:!font-[680] [&[aria-current=page]]:!text-white',
  'max-[920px]:w-full max-[920px]:!pl-6 max-[920px]:[overflow-wrap:anywhere] max-[920px]:[writing-mode:horizontal-tb]'
].join(' ')

export const optionsDashboardEntryClass = [
  'flex min-h-[58px] flex-col justify-center gap-1 mt-4 px-3.5 py-3',
  'border border-transparent rounded-[var(--ui-radius-control)] bg-transparent text-[rgba(248,248,242,0.68)] shadow-none',
  '[font-family:var(--font-sans)] transition-[border-color,background,color] duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--ui-accent-line)] hover:bg-[var(--ui-surface-selected)] hover:text-[var(--ui-accent-text)]',
  'focus-visible:border-[var(--ui-accent-line)] focus-visible:bg-[var(--ui-surface-selected)] focus-visible:text-[var(--ui-accent-text)]',
  '[&[aria-current=page]]:border-[var(--ui-accent-line)] [&[aria-current=page]]:bg-[var(--ui-surface-selected)] [&[aria-current=page]]:text-[var(--ui-accent-text)]',
  'hover:[&_span]:text-white focus-visible:[&_span]:text-white [&[aria-current=page]_span]:text-white',
  'hover:[&_strong]:text-white focus-visible:[&_strong]:text-white [&[aria-current=page]_strong]:text-white',
  'max-[920px]:mt-2.5 max-[920px]:min-h-[42px] max-[920px]:w-full max-[920px]:flex-row max-[920px]:items-center max-[920px]:justify-between max-[920px]:px-3.5 max-[920px]:py-0 max-[920px]:[overflow-wrap:anywhere] max-[920px]:[writing-mode:horizontal-tb]'
].join(' ')

export const optionsDashboardEntryEyebrowClass =
  'font-mono text-[11px] font-bold uppercase tracking-[0] text-[rgba(248,248,242,0.42)]'

export const optionsDashboardEntryTitleClass =
  'font-mono text-sm font-[720] text-[rgba(248,248,242,0.68)]'

export const optionsLayoutClass = [
  'grid h-screen min-h-0 w-full min-w-0 grid-cols-[244px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch relative z-[1] gap-0 m-0 !bg-[var(--ui-bg-page)] pointer-events-none [grid-column:1/-1] [grid-row:1] max-[1180px]:grid-cols-[220px_minmax(0,1fr)] max-[920px]:h-auto max-[920px]:w-[min(100%,760px)] max-[920px]:grid-cols-[minmax(0,1fr)] max-[920px]:gap-5 max-[920px]:mx-auto max-[920px]:pointer-events-auto max-[760px]:max-w-full',
  '[.dashboard-fullscreen-active_&]:!block [.dashboard-fullscreen-active_&]:!h-screen [.dashboard-fullscreen-active_&]:!min-h-screen',
  '[.dashboard-fullscreen-active_&]:!w-full [.dashboard-fullscreen-active_&]:!m-0 [.dashboard-fullscreen-active_&]:!pointer-events-auto',
  '[.options-dashboard-embed.dashboard-fullscreen-active_&]:!bg-transparent'
].join(' ')

export const optionsMainClass = [
  'relative z-[1] h-screen min-h-screen w-full max-w-none min-w-0 overflow-auto p-[24px_clamp(24px,3vw,56px)_56px] !pt-[clamp(24px,3vw,44px)] pointer-events-auto [grid-column:2] [grid-row:1] [scrollbar-gutter:stable] !bg-[var(--ui-bg-main)] max-[920px]:[grid-column:1] max-[920px]:[grid-row:2] max-[920px]:!h-auto max-[920px]:!min-h-0 max-[920px]:!overflow-visible max-[920px]:!p-[24px_0_0] max-[760px]:max-w-full',
  '[.dashboard-fullscreen-active_&]:!w-full [.dashboard-fullscreen-active_&]:!max-w-none',
  '[.dashboard-fullscreen-active_&]:!h-screen [.dashboard-fullscreen-active_&]:!min-h-screen',
  '[.dashboard-fullscreen-active_&]:!overflow-hidden [.dashboard-fullscreen-active_&]:!p-0',
  '[.options-dashboard-embed.dashboard-fullscreen-active_&]:!bg-transparent'
].join(' ')

export const optionsShellClassBase = [
  'relative isolate grid h-screen min-h-screen grid-cols-[244px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden bg-[var(--ui-bg-page)] [background-image:none] p-0 [font-family:var(--font-sans)] text-[var(--ui-text-primary)] [line-break:strict] [hanging-punctuation:allow-end] [text-spacing-trim:trim-start] [text-autospace:normal] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[line-break:auto] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[hanging-punctuation:none] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[text-spacing-trim:space-all] [&_:where(input,textarea,select,button,code,kbd,pre,samp)]:[text-autospace:no-autospace] max-[1180px]:grid-cols-[220px_minmax(0,1fr)] max-[920px]:block max-[920px]:h-dvh max-[920px]:min-h-dvh max-[920px]:max-h-dvh max-[920px]:overflow-x-hidden max-[920px]:!overflow-y-auto max-[920px]:overscroll-contain max-[920px]:[scrollbar-gutter:stable] max-[920px]:p-[0_24px_36px] max-[760px]:w-full max-[760px]:max-w-full max-[760px]:px-[14px] gap-x-0 justify-stretch',
  '[-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]',
  OPTIONS_REDUCED_MOTION_SURFACE_CLASS,
  OPTIONS_REDUCED_MOTION_SHELL_TRANSFORM_CLASS,
  '[&.dashboard-fullscreen-active]:!block [&.dashboard-fullscreen-active]:!h-screen',
  '[&.dashboard-fullscreen-active]:!min-h-screen [&.dashboard-fullscreen-active]:!overflow-hidden',
  '[&.dashboard-fullscreen-active]:!p-0',
  '[&.options-dashboard-embed]:!bg-transparent'
].join(' ')

export const optionsSidebarDividerClass =
  'pointer-events-none fixed top-0 bottom-0 left-[244px] z-[30] w-px bg-[var(--ui-divider-subtle)] max-[1180px]:left-[220px] max-[920px]:hidden'
