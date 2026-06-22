import { OPTION_PANEL_STANDARD_LAYOUT_CLASS } from './option-layout-classes.js'

export const DASHBOARD_PANEL_CLASS = [
  OPTION_PANEL_STANDARD_LAYOUT_CLASS,
  'relative select-none [-webkit-user-select:none]',
  '[--dashboard-bg:#000000] [--dashboard-surface:#0f0f10] [--dashboard-surface-raised:var(--ui-surface)] [--dashboard-surface-hover:var(--ui-surface-hover)]',
  '[--dashboard-surface-active:rgba(47,124,246,0.18)] [--dashboard-control:#050505] [--dashboard-control-hover:#171718] [--dashboard-grid-pad:clamp(18px,2.2vw,24px)]',
  '[--dashboard-card-height:150px] [--dashboard-card-min-width:260px] [--dashboard-line:var(--ui-divider)] [--dashboard-line-strong:var(--ui-divider-strong)]',
  '[--dashboard-text:var(--ui-text-primary)] [--dashboard-text-soft:var(--ui-text-secondary)] [--dashboard-text-muted:rgba(247,247,247,0.56)] [--dashboard-text-dim:var(--ui-text-tertiary)]',
  '[--dashboard-accent:var(--ui-accent)] [--dashboard-accent-line:var(--ui-accent-line)] [--dashboard-accent-soft:var(--ui-accent-soft)]',
  'font-[var(--font-sans)] text-[var(--dashboard-text)]',
  '!pt-0 !px-0 !pb-12 !border-0 !rounded-none !bg-transparent !shadow-none',
  '[.dashboard-fullscreen-active_&]:!grid [.dashboard-fullscreen-active_&]:[grid-template-areas:"dashboard-toolbar"_"dashboard-selection"_"dashboard-results"]',
  '[.dashboard-fullscreen-active_&]:[grid-template-rows:auto_auto_minmax(0,1fr)] [.dashboard-fullscreen-active_&]:!min-h-screen [.dashboard-fullscreen-active_&]:!max-h-screen',
  '[.dashboard-fullscreen-active_&]:!overflow-hidden [.dashboard-fullscreen-active_&]:!border-0 [.dashboard-fullscreen-active_&]:!rounded-none',
  '[.dashboard-fullscreen-active_&]:!w-full [.dashboard-fullscreen-active_&]:!max-w-none [.dashboard-fullscreen-active_&]:!mx-0',
  '[.dashboard-fullscreen-active_&]:!bg-[var(--dashboard-bg)] [.dashboard-fullscreen-active_&]:!p-[8px_clamp(18px,2.6vw,40px)_14px]',
  '[.options-dashboard-embed.dashboard-fullscreen-active_&]:!bg-transparent'
].join(' ')

export const DASHBOARD_SELECTION_GROUP_CLASS = [
  'mx-auto mt-2 block w-[min(100%,680px)] max-w-[min(100%,1080px)] min-w-0 overflow-visible',
  'rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] p-[8px_10px] shadow-none',
  '[.dashboard-fullscreen-active_&]:[grid-area:dashboard-selection]',
  '[.dashboard-fullscreen-active_&]:relative [.dashboard-fullscreen-active_&]:z-[2] [.dashboard-fullscreen-active_&]:self-start [.dashboard-fullscreen-active_&]:flex-none'
].join(' ')

export const DASHBOARD_PANEL_NOT_READY_STATE_CLASS =
  '!pointer-events-none !invisible !opacity-0'

export const DASHBOARD_SELECTION_BAR_CLASS =
  'grid min-h-8 w-full max-w-full grid-cols-[minmax(0,auto)_max-content] items-center justify-between gap-3 border-0 bg-transparent p-0 max-[900px]:flex max-[900px]:flex-col max-[900px]:items-start'

export const DASHBOARD_SELECTION_COUNT_CLASS =
  'block w-24 justify-self-end whitespace-nowrap bg-transparent text-right font-mono text-[11px] font-bold leading-normal tracking-[0] text-[var(--dashboard-text-dim)] tabular-nums max-[900px]:justify-self-start max-[900px]:text-left'

export const DASHBOARD_SELECTION_ACTIONS_CLASS =
  'flex min-w-0 flex-none flex-wrap items-center justify-start gap-2 bg-transparent max-[900px]:w-full'

export const DASHBOARD_SELECTION_BUTTON_CLASS =
  'min-h-8 whitespace-nowrap rounded-[var(--ui-radius-control)] px-2.5 text-xs font-medium leading-none tracking-[0] shadow-none transition-colors disabled:cursor-default data-disabled:cursor-default'

export const DASHBOARD_SELECTION_SECONDARY_BUTTON_CLASS = [
  DASHBOARD_SELECTION_BUTTON_CLASS,
  '!border-[var(--ui-divider)] !bg-[var(--ui-surface-raised)] !text-[var(--ui-text-primary)]',
  'hover:!border-[var(--ui-divider-strong)] hover:!bg-[var(--ui-surface-hover)]',
  'focus-visible:!border-[var(--ui-focus-ring)] focus-visible:!bg-[var(--ui-surface-hover)]',
  'disabled:!text-[var(--ui-text-disabled)] data-disabled:!text-[var(--ui-text-disabled)]'
].join(' ')

export const DASHBOARD_SELECTION_DANGER_BUTTON_CLASS = [
  DASHBOARD_SELECTION_BUTTON_CLASS,
  '!border-[rgba(255,138,130,0.32)] !bg-[var(--ui-surface-raised)] !text-[#ffb7b0]',
  'hover:!border-[rgba(255,183,176,0.56)] hover:!bg-[rgba(255,138,130,0.1)]',
  'focus-visible:!border-[rgba(255,183,176,0.56)] focus-visible:!bg-[rgba(255,138,130,0.1)]',
  'disabled:!border-[var(--ui-divider)] disabled:!bg-[var(--ui-surface-raised)] disabled:!text-[var(--ui-text-disabled)]',
  'data-disabled:!border-[var(--ui-divider)] data-disabled:!bg-[var(--ui-surface-raised)] data-disabled:!text-[var(--ui-text-disabled)]'
].join(' ')

export const DASHBOARD_SELECTION_EMPTY_ACTION_CLASS =
  '!opacity-[0.42] disabled:!opacity-[0.42] data-disabled:!opacity-[0.42]'

export const DASHBOARD_CARD_ROOT_CLASS = [
  'group/dashboard-card relative z-0 flex h-[150px] min-h-[150px] min-w-0 flex-col gap-[9px] overflow-visible rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-3 select-none',
  'before:pointer-events-none before:absolute before:[inset:0_auto_0_0] before:z-0 before:block before:w-0 before:rounded-[var(--ui-radius-pill)_0_0_var(--ui-radius-pill)] before:bg-transparent before:content-[""]',
  '[--dashboard-card-height:168px] [box-shadow:none] [contain:layout_paint_style] [contain-intrinsic-size:var(--dashboard-card-height)]',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none] hover:[box-shadow:none]',
  '[-webkit-user-select:none] [touch-action:manipulation]',
  '[transition:border-color_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard),box-shadow_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-fast)_var(--ui-ease-standard)]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:[transform:none]'
].join(' ')

export const DASHBOARD_CARD_SELECTED_STATE_CLASS = [
  '!border-[var(--ui-accent-line)] !bg-[var(--ui-surface-selected)] !text-[var(--ui-accent-text)]',
  'hover:!border-[var(--ui-divider-strong)] hover:!bg-[var(--ui-surface-hover)]'
].join(' ')

export const DASHBOARD_CARD_MENU_OPEN_STATE_CLASS =
  '!z-[90] ![contain:layout_style] ![content-visibility:visible]'

export const DASHBOARD_CARD_TAGS_EXPANDED_STATE_CLASS =
  '!z-[90] ![contain:layout_style] ![content-visibility:visible]'

export const DASHBOARD_CARD_STATIC_VISIBILITY_CLASS =
  '[content-visibility:auto]'

export const DASHBOARD_CARD_DIMMED_CLASS =
  'opacity-[0.72] [transform:none]'

export const DASHBOARD_TOOLBAR_CLASS = [
  '!grid !w-full !grid-cols-[minmax(96px,1fr)_minmax(280px,680px)_minmax(96px,1fr)] !items-start !gap-3',
  '!m-0 !border-0 !bg-transparent !p-[10px_clamp(18px,2.6vw,40px)_8px] ![box-shadow:none] shadow-none [-webkit-backdrop-filter:none] [backdrop-filter:none]',
  '[.dashboard-fullscreen-active_&]:[grid-area:dashboard-toolbar]',
  'max-[920px]:!grid-cols-[minmax(0,1fr)] max-[920px]:!px-4'
].join(' ')

export const DASHBOARD_PERFORMANCE_CLASS = [
  '[&_:where(*)]:!duration-0 [&_:where(*)]:![animation-duration:0ms]'
].join(' ')

export const DASHBOARD_LOADING_SCREEN_CLASS = [
  'absolute inset-0 z-[12] grid place-items-center pointer-events-none visible opacity-100',
  '[transition:opacity_var(--ui-motion-fast)_var(--ui-ease-standard),visibility_0s]'
].join(' ')

export const DASHBOARD_LOADING_SCREEN_READY_STATE_CLASS =
  '!invisible !opacity-0 [transition:opacity_var(--ui-motion-fast)_var(--ui-ease-standard),visibility_0s_linear_var(--ui-motion-fast)]'

export const DASHBOARD_LOADING_CARD_CLASS =
  'grid size-[78px] place-items-center rounded-none border border-[var(--dashboard-line)] bg-[#050505] text-[var(--dashboard-text-soft)] shadow-none'

export const DASHBOARD_LOADING_LOADER_CLASS = '!size-11'

export const DASHBOARD_TITLE_ACTIONS_CLASS =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start justify-end gap-2 pt-0 [--dashboard-status-width:minmax(0,1fr)] [grid-column:3] max-[920px]:[grid-column:1]'

export const DASHBOARD_TOOLBAR_STATUS_CLASS =
  'relative inline-flex min-h-[38px] w-auto max-w-full min-w-0 items-center justify-end overflow-hidden text-ellipsis whitespace-nowrap pl-0 text-right text-[13px] font-semibold leading-[1.2] text-[var(--ui-text-tertiary)] empty:invisible before:hidden'

export const DASHBOARD_SEARCH_BOX_CLASS =
  'relative grid min-w-0 w-full max-w-[680px] grid-cols-[minmax(0,1fr)] gap-[7px] bg-transparent [grid-column:2] [box-shadow:none] [margin-inline:0] [.dashboard-fullscreen-active_&]:gap-[5px] max-[920px]:[grid-column:1]'

export const DASHBOARD_SEARCH_LABEL_CLASS =
  'm-0 flex w-full max-w-[680px] flex-col gap-2.5 bg-transparent [box-shadow:none] [margin-inline:0]'

export const DASHBOARD_SEARCH_LABEL_TEXT_CLASS =
  'sr-only'

export const DASHBOARD_QUERY_ROW_CLASS =
  'relative block min-w-0 bg-transparent p-0 [box-shadow:none]'

export const DASHBOARD_SEARCH_INPUT_FIELD_CLASS = [
  'relative grid w-full min-w-0 grid-cols-[18px_minmax(0,1fr)_auto_64px] items-center gap-2 self-center',
  'min-h-[38px] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] py-0 pr-1.5 pl-3',
  'rounded-[var(--ui-radius-control)] [box-shadow:none]',
  'transition-[border-color,background-color,box-shadow,transform] duration-[180ms] ease-[ease]',
  'before:hidden after:hidden',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)]',
  'focus-within:border-[var(--ui-focus-ring)] focus-within:bg-[var(--ui-surface-hover)] focus-within:[box-shadow:0_0_0_3px_var(--ui-accent-soft)] focus-within:outline-none'
].join(' ')

export const DASHBOARD_SEARCH_INPUT_CLASS = [
  'block w-full min-w-0 appearance-none [grid-column:2]',
  '!h-[34px] !min-h-[34px] !max-h-[34px] !rounded-none !border-0 !bg-transparent !p-0 !text-[13px] !leading-[34px]',
  '!font-[inherit] !text-[var(--dashboard-text)] !shadow-none !outline-none',
  'select-text [-webkit-user-select:text]',
  'placeholder:!text-[var(--dashboard-text-dim)]',
  'focus:!border-0 focus:!bg-transparent focus:!shadow-none focus:!outline-none',
  'focus-visible:!border-0 focus-visible:!bg-transparent focus-visible:!shadow-none focus-visible:!outline-none',
  'active:!border-0 active:!bg-transparent active:!shadow-none active:!outline-none',
  '[&::-webkit-search-decoration]:appearance-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none'
].join(' ')

export const DASHBOARD_SEARCH_ICON_CLASS =
  'relative col-start-1 h-3.5 w-3.5 flex-none rounded-full border-solid border-[rgba(245,245,247,0.62)] bg-transparent [border-width:1.5px] [box-shadow:none] after:absolute after:-right-[5px] after:-bottom-[3px] after:block after:h-[1.5px] after:w-1.5 after:rounded-[999px] after:bg-[rgba(245,245,247,0.62)] after:[transform:rotate(45deg)] after:content-[""]'

export const DASHBOARD_SEARCH_CHIPS_CLASS =
  'flex flex-wrap gap-1.5 bg-transparent [box-shadow:none] empty:hidden'

export const DASHBOARD_SEARCH_CHIP_CLASS =
  'inline-flex min-h-[22px] items-center rounded-[var(--ui-radius-pill)] border border-[var(--dashboard-line)] bg-[#050505] px-2 py-0 text-[12px] font-[650] text-[var(--dashboard-text-soft)] [box-shadow:none] [.dashboard-fullscreen-active_&]:min-h-5 [.dashboard-fullscreen-active_&]:text-[11px]'

export const DASHBOARD_CLEAR_SEARCH_CLASS =
  'inline-flex h-[26px] min-h-[26px] min-w-[38px] flex-none items-center justify-center whitespace-nowrap rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-2 py-0 text-[11px] font-[750] leading-none text-[var(--ui-text-secondary)] [grid-column:3] [box-shadow:none] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)]'

export const DASHBOARD_NATURAL_SEARCH_TOGGLE_CLASS = [
  'group/natural grid h-[26px] min-h-[26px] w-16 min-w-16 max-w-16 flex-none cursor-pointer grid-cols-[8px_minmax(0,1fr)] items-center justify-items-center gap-1.5',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-[9px] py-0',
  'text-[11px] font-[750] leading-none text-[var(--ui-text-secondary)] [font-family:inherit] [grid-column:4] [box-shadow:0_0_0_1px_rgba(245,245,240,0.035)]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] hover:[box-shadow:0_0_0_1px_rgba(245,245,240,0.06)]',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:[box-shadow:0_0_0_1px_rgba(245,245,240,0.06)] focus-visible:outline-none'
].join(' ')

export const DASHBOARD_NATURAL_SEARCH_TOGGLE_ACTIVE_STATE_CLASS =
  '!border-[var(--ui-accent-line)] !bg-[var(--ui-surface-selected)] !text-[var(--ui-accent-text)] ![box-shadow:none]'

export const DASHBOARD_NATURAL_SEARCH_TOGGLE_FALLBACK_STATE_CLASS =
  '!border-[rgba(253,224,71,0.34)] !bg-[rgba(161,98,7,0.24)] !text-[#fef08a] ![box-shadow:none]'

export const DASHBOARD_NATURAL_SEARCH_TOGGLE_PENDING_STATE_CLASS =
  `${DASHBOARD_NATURAL_SEARCH_TOGGLE_ACTIVE_STATE_CLASS} animate-pulse motion-reduce:animate-none`

export const DASHBOARD_SEARCH_HELP_BUTTON_CLASS = [
  'absolute top-1/2 left-[-40px] z-[2] inline-flex size-7 min-h-7 min-w-7 flex-none -translate-y-1/2 cursor-help items-center justify-center whitespace-nowrap max-[920px]:left-2',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-0 text-[10px] font-[650] leading-none text-[var(--ui-text-secondary)] [font-family:inherit] [box-shadow:none]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)]',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/[0.72]',
  'active:scale-[0.96] [&[aria-expanded=true]]:border-[var(--ui-accent-line)] [&[aria-expanded=true]]:bg-[var(--ui-surface-selected)] [&[aria-expanded=true]]:text-[var(--ui-accent-text)]',
  'max-[760px]:left-0'
].join(' ')

export const DASHBOARD_SEARCH_HELP_POPOVER_CLASS = [
  '!z-50 !grid !w-[min(300px,calc(100vw-48px))] !max-w-[min(300px,calc(100vw-48px))] !gap-[5px]',
  '!rounded-[var(--ui-radius-group)] !border !border-[var(--ui-divider)] !bg-[var(--ui-surface-raised)] !p-[10px_12px]',
  '!text-left !text-[12px] !font-medium !leading-[1.6] !text-[var(--ui-text-primary)] !shadow-none',
  '!whitespace-normal !outline-none [-webkit-backdrop-filter:none] [backdrop-filter:none]'
].join(' ')

export const DASHBOARD_SEARCH_HELP_TITLE_CLASS =
  'text-[12px] font-bold text-[var(--ui-text-primary)]'

export const DASHBOARD_NATURAL_SEARCH_MARKER_CLASS = [
  'block size-[7px] min-h-[7px] max-h-[7px] min-w-[7px] max-w-[7px] flex-none justify-self-center [grid-column:1]',
  'aspect-square box-border rounded-none border border-[rgba(220,220,214,0.62)] bg-[rgba(180,180,174,0.72)]',
  '[box-shadow:0_0_0_2px_rgba(220,220,214,0.12)]',
  'group-hover/natural:border-[rgba(245,245,240,0.38)] group-hover/natural:[box-shadow:0_0_0_2px_rgba(245,245,240,0.065)]',
  'group-focus-visible/natural:border-[rgba(245,245,240,0.38)] group-focus-visible/natural:[box-shadow:0_0_0_2px_rgba(245,245,240,0.065)]'
].join(' ')

export const DASHBOARD_NATURAL_SEARCH_MARKER_ACTIVE_STATE_CLASS =
  '!border-[rgba(59,130,246,0.64)] !bg-[var(--ui-accent-strong)] ![box-shadow:0_0_0_2px_rgba(59,130,246,0.18)]'

export const DASHBOARD_NATURAL_SEARCH_MARKER_FALLBACK_STATE_CLASS =
  '!border-[rgba(247,247,247,0.82)] !bg-[rgba(247,247,247,0.66)] ![box-shadow:none]'

export const DASHBOARD_NATURAL_SEARCH_MARKER_PENDING_STATE_CLASS =
  `${DASHBOARD_NATURAL_SEARCH_MARKER_ACTIVE_STATE_CLASS} animate-pulse motion-reduce:animate-none`

export const DASHBOARD_FOLDER_BREADCRUMBS_CLASS =
  'min-h-[22px] min-w-0 overflow-hidden bg-transparent text-[var(--ui-text-secondary)] [box-shadow:none] empty:hidden'

export const DASHBOARD_FOLDER_BREADCRUMB_LIST_CLASS =
  'm-0 flex min-w-0 list-none flex-nowrap items-center gap-[5px] overflow-hidden p-0'

export const DASHBOARD_FOLDER_BREADCRUMB_ITEM_CLASS =
  'inline-flex min-w-0 flex-[0_1_auto]'

export const DASHBOARD_FOLDER_BREADCRUMB_CURRENT_ITEM_CLASS =
  'flex-[1_1_auto]'

export const DASHBOARD_FOLDER_BREADCRUMB_LINK_CLASS =
  'inline-flex min-h-[22px] min-w-0 max-w-[220px] flex-[0_1_auto] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-1.5 py-0 text-[12px] font-[650] leading-[1.2] text-[var(--ui-text-secondary)] [box-shadow:none] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] max-[760px]:max-w-[154px] [.dashboard-fullscreen-active_&]:min-h-5 [.dashboard-fullscreen-active_&]:text-[11px]'

export const DASHBOARD_FOLDER_BREADCRUMB_CURRENT_CLASS =
  'inline-flex min-h-[22px] min-w-0 max-w-[220px] flex-[0_1_auto] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-1.5 py-0 text-[12px] font-[650] leading-[1.2] text-[var(--ui-text-secondary)] [box-shadow:none] max-[760px]:max-w-[154px] [.dashboard-fullscreen-active_&]:min-h-5 [.dashboard-fullscreen-active_&]:text-[11px]'

export const DASHBOARD_RESULTS_GROUP_CLASS = [
  'mt-3 flex min-h-0 select-none flex-col overflow-hidden rounded-[var(--ui-radius-group)]',
  'border border-[var(--ui-divider)] bg-[var(--ui-surface)] p-3 [box-shadow:none]',
  '[-webkit-user-select:none] [-webkit-backdrop-filter:none] [backdrop-filter:none]',
  '[.dashboard-fullscreen-active_&]:relative [.dashboard-fullscreen-active_&]:z-[1] [.dashboard-fullscreen-active_&]:[grid-area:dashboard-results]',
  '[.dashboard-fullscreen-active_&]:mt-2.5 [.dashboard-fullscreen-active_&]:flex-[1_1_auto]'
].join(' ')

export const DASHBOARD_RESULTS_TITLE_CLASS = 'sr-only'

export const DASHBOARD_CONTENT_LAYOUT_CLASS =
  'grid min-h-0 flex-[1_1_auto] grid-cols-[minmax(190px,204px)_minmax(0,1fr)] items-stretch gap-3.5 bg-transparent p-0 max-[900px]:grid-cols-[minmax(170px,190px)_minmax(0,1fr)] max-[760px]:grid-cols-[minmax(0,1fr)]'

export const DASHBOARD_FOLDER_SIDEBAR_CLASS =
  'mt-0 flex min-h-0 min-w-0 select-none flex-col overflow-hidden rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] [box-shadow:none] [backdrop-filter:none] [-webkit-backdrop-filter:none] max-[760px]:max-h-[220px]'

export const DASHBOARD_FOLDER_SIDEBAR_HEAD_CLASS =
  'flex flex-[0_0_auto] items-center justify-between gap-2.5 border-b border-[var(--ui-divider-subtle)] bg-transparent p-[12px_12px_10px]'

export const DASHBOARD_FOLDER_SIDEBAR_TITLE_CLASS =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[760] text-[var(--dashboard-text)]'

export const DASHBOARD_META_PILL_CLASS = [
  'inline-flex min-h-6 min-w-0 max-w-full flex-none items-center overflow-hidden text-ellipsis whitespace-nowrap px-3.5',
  'rounded-[var(--ui-radius-pill)] border border-[var(--dashboard-line)] bg-[#050505]',
  'font-[var(--font-sans)] text-[11px] font-semibold leading-normal tracking-[0] text-[var(--dashboard-text-muted)]',
  'max-[760px]:w-fit max-[760px]:whitespace-normal'
].join(' ')

export const DASHBOARD_FOLDER_TREE_CLASS =
  'flex min-h-0 flex-[1_1_auto] flex-col gap-0.5 overflow-auto p-2'

export const DASHBOARD_FOLDER_TREE_ITEM_CLASS = [
  'grid min-h-[30px] w-full cursor-pointer grid-cols-[12px_minmax(0,1fr)_max-content] items-center justify-stretch gap-[7px]',
  'rounded-[var(--ui-radius-control)] border-0 border-transparent bg-transparent py-0 pr-2 pl-[calc(8px+var(--folder-depth-offset))]',
  'text-left text-xs leading-normal text-[var(--dashboard-text-soft)] [--folder-depth-offset:0px]',
  'transition-colors duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)]',
  'hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)]',
  'focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)]',
  '[&[aria-selected=true]]:bg-[var(--ui-surface-selected)] [&[aria-selected=true]]:text-[var(--ui-accent-text)]',
  '[&[aria-selected=true]:hover]:bg-[var(--ui-surface-selected)] [&[aria-selected=true]:hover]:text-[var(--ui-accent-text)]',
  '[&[aria-selected=true]:focus-visible]:bg-[var(--ui-surface-selected)] [&[aria-selected=true]:focus-visible]:text-[var(--ui-accent-text)]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/35'
].join(' ')

export const DASHBOARD_FOLDER_TREE_BRANCH_CLASS =
  'relative h-2.5 w-2.5 rounded-bl-[4px] border-b border-l border-b-white/[0.22] border-l-white/20'

export const DASHBOARD_FOLDER_TREE_ROOT_BRANCH_CLASS =
  'relative h-2.5 w-2.5 rounded-full border border-white/[0.28]'

export const DASHBOARD_FOLDER_TREE_LABEL_CLASS =
  'min-w-0 overflow-hidden text-left text-ellipsis whitespace-nowrap text-xs font-[680]'

export const DASHBOARD_FOLDER_TREE_COUNT_CLASS =
  'min-w-0 justify-self-end rounded-[var(--ui-radius-pill)] border-0 border-transparent bg-transparent p-0 text-right text-[11px] font-[720] leading-[1.25] text-[var(--ui-text-secondary)] tabular-nums [[aria-selected=true]_&]:text-[var(--ui-accent-text)]'

export const DASHBOARD_NATURAL_SEARCH_LABEL_CLASS =
  'col-start-2 block min-w-0 justify-self-center overflow-hidden text-center [text-overflow:clip] whitespace-nowrap leading-none'

export const DASHBOARD_FOLDER_BREADCRUMB_SEPARATOR_CLASS =
  'inline-flex min-w-0 !flex-none text-[11px] text-[var(--ui-text-disabled)]'

export const DASHBOARD_CARD_GRID_CLASS = [
  'relative grid min-h-0 min-w-0 flex-[1_1_auto] items-stretch gap-2.5 overflow-auto bg-transparent [box-shadow:none]',
  '[grid-template-columns:repeat(auto-fill,minmax(min(var(--dashboard-card-min-width),100%),1fr))] [grid-auto-rows:var(--dashboard-card-height)]',
  'm-0 [padding:0_2px_0_0] [contain:layout_paint] [scrollbar-gutter:stable]',
  'select-none [-webkit-user-select:none]'
].join(' ')

export const DASHBOARD_RESULTS_TRANSITION_STATE_CLASS =
  '!min-h-[max(var(--dashboard-card-height),var(--dashboard-results-stable-height,var(--dashboard-card-height)))] !overflow-x-hidden !overflow-y-auto !pointer-events-none before:!content-none'

export const DASHBOARD_RESULTS_WINDOWED_STATE_CLASS =
  'relative !block [overflow-anchor:none] scroll-auto [contain:layout_paint]'

export const DASHBOARD_FLOATING_SURFACE_CONTAINMENT_CLASS =
  '![contain:layout_style]'

export const DASHBOARD_VIRTUAL_SPACER_CLASS =
  'relative min-h-full w-full'

export const DASHBOARD_VIRTUAL_WINDOW_CLASS = [
  'absolute left-0 right-0 top-0 grid min-w-0 items-stretch gap-2.5 bg-transparent mt-0',
  '[grid-auto-rows:var(--dashboard-card-height)] [transform:translate3d(0,0,0)] [will-change:transform] [contain:layout_paint]',
  DASHBOARD_FLOATING_SURFACE_CONTAINMENT_CLASS
].join(' ')

export const DASHBOARD_TAG_EDITOR_BUTTON_CLASS =
  '!h-[34px] !min-h-[34px] !flex-none !whitespace-nowrap !rounded-[9px] !px-3 !text-[13px] !font-bold !leading-none tracking-[0] !shadow-none [word-break:keep-all] active:scale-[0.985]'

export const DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS = [
  DASHBOARD_TAG_EDITOR_BUTTON_CLASS,
  '!border-[rgba(245,245,247,0.32)] !bg-[#171719] !text-[var(--ui-text-primary)]',
  'hover:!border-[rgba(245,245,247,0.58)] hover:!bg-[#26262a] hover:!text-[var(--ui-text-primary)]',
  'focus-visible:!border-[rgba(245,245,247,0.58)] focus-visible:!bg-[#26262a] focus-visible:!text-[var(--ui-text-primary)]'
].join(' ')

export const DASHBOARD_TAG_EDITOR_DANGER_BUTTON_CLASS = [
  DASHBOARD_TAG_EDITOR_BUTTON_CLASS,
  '!border-[rgba(255,138,130,0.62)] !bg-[#5a2624] !text-[#ffe7e3]',
  'hover:!border-[rgba(255,183,176,0.86)] hover:!bg-[#73302c] hover:!text-[#ffe7e3]',
  'focus-visible:!border-[rgba(255,183,176,0.86)] focus-visible:!bg-[#73302c] focus-visible:!text-[#ffe7e3]',
  'disabled:!border-[rgba(255,138,130,0.28)] disabled:!bg-[#2a1817] disabled:!text-[rgba(255,231,227,0.55)]',
  'data-disabled:!border-[rgba(255,138,130,0.28)] data-disabled:!bg-[#2a1817] data-disabled:!text-[rgba(255,231,227,0.55)]'
].join(' ')

export const DASHBOARD_TAG_EDITOR_PRIMARY_BUTTON_CLASS = [
  DASHBOARD_TAG_EDITOR_BUTTON_CLASS,
  '!border-[rgba(245,245,247,0.92)] !bg-[#f5f5f7] !text-[#111113]',
  'hover:!border-white hover:!bg-white hover:!text-[#111113]',
  'focus-visible:!border-white focus-visible:!bg-white focus-visible:!text-[#111113]'
].join(' ')

export const DASHBOARD_TOOLBAR_EXIT_BUTTON_CLASS =
  DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS

export const DASHBOARD_TAG_EDITOR_HEAD_CLASS =
  'mb-3.5 flex items-start justify-between gap-3.5'

export const DASHBOARD_TAG_EDITOR_TITLE_CLASS =
  'block text-[15px] font-[760] leading-[1.35] tracking-[0] text-[var(--dashboard-text)] [overflow-wrap:anywhere]'

export const DASHBOARD_TAG_EDITOR_META_CLASS =
  'mt-[5px] block text-[12px] font-[620] leading-[1.45] tracking-[0] text-[var(--ui-text-disabled)] [overflow-wrap:anywhere]'

export const DASHBOARD_TAG_EDITOR_FIELD_CLASS =
  'flex flex-col gap-[7px]'

export const DASHBOARD_TAG_EDITOR_FIELD_LABEL_CLASS =
  'text-[12px] font-bold leading-normal tracking-[0] text-[var(--ui-text-tertiary)]'

export const DASHBOARD_TAG_EDITOR_TEXTAREA_CLASS = [
  '!min-h-[116px] !w-full !resize-y !rounded-[8px] !border !border-white/[0.09]',
  '!bg-[#080809] !p-[10px_11px] !text-[13px] !leading-[1.55] !text-[var(--dashboard-text)] ![font-family:var(--font-sans)] placeholder:!text-[var(--dashboard-text-dim)]',
  'select-text [-webkit-user-select:text]',
  'focus:!ring-0 focus-visible:!border-white/[0.22] focus-visible:![outline:2px_solid_rgba(245,245,247,0.76)] focus-visible:![outline-offset:2px]'
].join(' ')

export const DASHBOARD_TAG_EDITOR_HELP_CLASS =
  'm-[8px_0_0] font-[var(--font-sans)] text-[12px] font-[620] leading-[1.5] tracking-[0] text-[var(--dashboard-text-muted)]'

export const DASHBOARD_TAG_EDITOR_ACTIONS_CLASS =
  'mt-[13px] flex flex-wrap justify-end gap-2'

export const DASHBOARD_TAG_EDITOR_POSITIONER_CLASS = 'contents'

export const DASHBOARD_TAG_EDITOR_ROOT_CLASS =
  'fixed left-0 top-0 z-[132] w-[min(430px,calc(100vw_-_36px))] max-[760px]:left-3.5 max-[760px]:right-3.5 max-[760px]:top-[18px] max-[760px]:w-auto'

export const DASHBOARD_TAG_EDITOR_ROOT_CLOSING_STATE_CLASS =
  'pointer-events-none'

export const DASHBOARD_TAG_EDITOR_PANEL_CLASS = [
  'dashboard-tag-editor-panel rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-4 text-[var(--dashboard-text)] shadow-none',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none] [transform-origin:top_center]',
  '![opacity:var(--dashboard-tag-editor-opacity,1)] ![transform:var(--dashboard-tag-editor-transform,translateY(0)_scale(1))] ![transition:opacity_220ms_var(--dashboard-tag-editor-ease,var(--ui-ease-spring)),transform_220ms_var(--dashboard-tag-editor-ease,var(--ui-ease-spring))]',
  'starting:[--dashboard-tag-editor-opacity:0] starting:[--dashboard-tag-editor-transform:translateY(6px)_scale(0.985)] motion-reduce:![transition:none]'
].join(' ')

export const DASHBOARD_TAG_EDITOR_PANEL_CLOSING_STATE_CLASS =
  '[--dashboard-tag-editor-ease:cubic-bezier(0.4,0,1,1)] [--dashboard-tag-editor-opacity:0] [--dashboard-tag-editor-transform:translateY(4px)_scale(0.985)]'

export const DASHBOARD_EMPTY_STATE_CLASS =
  'col-span-full rounded-[var(--ui-radius-control)] border border-[var(--dashboard-line)] bg-[#0f0f10] p-[18px_16px] text-[13px] leading-[1.7] text-[var(--dashboard-text-muted)]'

export const DASHBOARD_LOADING_EMPTY_STATE_CLASS =
  `${DASHBOARD_EMPTY_STATE_CLASS} flex items-center justify-center`

export const DASHBOARD_DROP_EMPTY_STATE_CLASS =
  `${DASHBOARD_EMPTY_STATE_CLASS} text-center`

export const DASHBOARD_DROP_PANEL_CLASS = [
  'fixed left-1/2 top-[calc(50%_+_58px)] z-[2]',
  'w-[min(1440px,calc(100vw_-_56px))] max-h-[min(calc(100vh_-_150px),820px)] overflow-hidden',
  'rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] shadow-none',
  'pointer-events-auto [transform:translate(-50%,-50%)_scale(1)] [transform-origin:center]',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none]',
  'opacity-100 transition-[opacity,transform] duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-spring)] starting:opacity-0 starting:[transform:translate(-50%,-48%)_scale(0.985)] motion-reduce:transition-none',
  'max-[760px]:top-[calc(50%_+_52px)] max-[760px]:w-[calc(100vw_-_28px)] max-[760px]:max-h-[calc(100vh_-_148px)]'
].join(' ')

export const DASHBOARD_DROP_PANEL_CLOSING_STATE_CLASS =
  '!opacity-0 ![transform:translate(-50%,-48%)_scale(0.985)] !duration-[var(--ui-motion-fast)] !ease-[cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_FOLDER_DROP_GRID_CLASS =
  'grid [grid-template-columns:repeat(auto-fit,minmax(172px,1fr))] gap-2.5 max-h-[calc(min(calc(100vh_-_150px),820px)_-_72px)] overflow-auto p-3.5 max-[900px]:[grid-template-columns:repeat(auto-fit,minmax(156px,1fr))] max-[760px]:grid-cols-2 max-[760px]:gap-2 max-[760px]:max-h-[calc(100vh_-_220px)] max-[760px]:p-2.5'

export const DASHBOARD_FOLDER_DROP_CARD_CLASS = [
  'grid min-h-[72px] [grid-template-columns:28px_minmax(0,1fr)] gap-[9px]',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-[9px_10px]',
  'cursor-pointer select-none text-left font-[inherit] text-[var(--ui-text-secondary)] shadow-none [-webkit-user-drag:none] [-webkit-user-select:none]',
  '[transition:border-color_var(--ui-motion-standard)_var(--ui-ease-standard),background_var(--ui-motion-standard)_var(--ui-ease-standard),box-shadow_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-fast)_var(--ui-ease-standard)]',
  'hover:border-[var(--ui-accent-line)] hover:bg-[var(--ui-surface-selected)] hover:text-[var(--ui-accent-text)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.24)] hover:[transform:translateY(-1px)_scale(1.012)]',
  'focus-visible:border-[var(--ui-accent-line)] focus-visible:bg-[var(--ui-surface-selected)] focus-visible:text-[var(--ui-accent-text)] focus-visible:shadow-[0_10px_26px_rgba(0,0,0,0.24)] focus-visible:[transform:translateY(-1px)_scale(1.012)]',
  '[&[aria-selected=true]]:border-[var(--ui-accent-line)] [&[aria-selected=true]]:bg-[var(--ui-surface-selected)] [&[aria-selected=true]]:text-[var(--ui-accent-text)]',
  '[&[aria-selected=true]]:shadow-[0_10px_26px_rgba(0,0,0,0.24)] [&[aria-selected=true]]:[transform:translateY(-1px)_scale(1.012)]',
  'max-[760px]:min-h-[68px] max-[760px]:[grid-template-columns:24px_minmax(0,1fr)] max-[760px]:gap-2 max-[760px]:p-2'
].join(' ')

export const DASHBOARD_FOLDER_DROP_CARD_MOVING_STATE_CLASS =
  'pointer-events-none opacity-[0.68]'

export const DASHBOARD_FOLDER_DROP_ICON_CLASS =
  'relative mt-[3px] h-5 w-[26px] rounded-[5px] bg-white/[0.18] before:absolute before:left-[3px] before:top-[-5px] before:h-[7px] before:w-3 before:rounded-[4px_4px_0_0] before:bg-white/[0.18] before:content-[""] max-[760px]:h-[18px] max-[760px]:w-[23px]'

export const DASHBOARD_FOLDER_DROP_COPY_CLASS =
  'flex min-w-0 flex-col gap-[3px]'

export const DASHBOARD_FOLDER_DROP_TITLE_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[730] text-[var(--ui-text-primary)]'

export const DASHBOARD_FOLDER_DROP_PATH_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-[var(--ui-text-disabled)]'

export const DASHBOARD_FOLDER_DROP_META_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[650] text-[var(--ui-text-tertiary)]'

export const DASHBOARD_DELETE_DROP_TARGET_CLASS = [
  'fixed left-1/2 top-[clamp(26px,6vh,56px)] z-[4]',
  'grid w-[min(420px,calc(100vw_-_48px))] min-h-[72px] [grid-template-columns:42px_minmax(0,1fr)] items-center gap-3',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-[12px_14px] text-[var(--ui-text-secondary)] shadow-none',
  'pointer-events-auto [transform:translateX(-50%)_translateY(0)_scale(1)] [transform-origin:center]',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none]',
  '[transition:border-color_var(--ui-motion-standard)_var(--ui-ease-standard),background_var(--ui-motion-standard)_var(--ui-ease-standard),box-shadow_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard),opacity_var(--ui-motion-standard)_var(--ui-ease-spring),transform_var(--ui-motion-fast)_var(--ui-ease-standard)]',
  'opacity-100 starting:opacity-0 starting:[transform:translateX(-50%)_translateY(-6px)_scale(0.985)] motion-reduce:transition-none',
  'max-[760px]:top-[18px] max-[760px]:w-[calc(100vw_-_28px)] max-[760px]:min-h-[66px] max-[760px]:[grid-template-columns:38px_minmax(0,1fr)] max-[760px]:p-[10px_12px]'
].join(' ')

export const DASHBOARD_DELETE_DROP_TARGET_ACTIVE_STATE_CLASS =
  '!border-[var(--ui-accent-line)] !bg-[var(--ui-surface-selected)] !text-[var(--ui-accent-text)] !shadow-[0_22px_64px_rgba(255,88,80,0.18),0_18px_52px_rgba(0,0,0,0.36)]'

export const DASHBOARD_DELETE_DROP_TARGET_ACTIVE_TRANSFORM_STATE_CLASS =
  '![transform:translateX(-50%)_translateY(-1px)_scale(1.015)]'

export const DASHBOARD_DELETE_DROP_TARGET_MOVING_STATE_CLASS =
  'pointer-events-none opacity-[0.72]'

export const DASHBOARD_DELETE_DROP_TARGET_CLOSING_STATE_CLASS =
  '!opacity-0 ![transform:translateX(-50%)_translateY(-6px)_scale(0.985)] ![transition:border-color_var(--ui-motion-standard)_var(--ui-ease-standard),background_var(--ui-motion-standard)_var(--ui-ease-standard),box-shadow_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard),opacity_var(--ui-motion-fast)_cubic-bezier(0.4,0,1,1),transform_var(--ui-motion-fast)_cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_DELETE_DROP_ICON_CLASS =
  'relative inline-grid size-10 place-items-center rounded-[13px] border border-[rgba(255,138,130,0.2)] bg-[rgba(255,138,130,0.08)] before:h-[18px] before:w-4 before:rounded-[0_0_4px_4px] before:border-2 before:border-t-0 before:border-current before:opacity-[0.72] before:content-[""] after:absolute after:left-3 after:top-[11px] after:h-0.5 after:w-4 after:rounded-[var(--ui-radius-pill)] after:bg-current after:opacity-[0.72] after:shadow-[4px_-4px_0_-1px_currentColor] after:content-[""]'

export const DASHBOARD_DELETE_DROP_COPY_CLASS =
  'flex min-w-0 flex-col gap-[3px]'

export const DASHBOARD_DELETE_DROP_TITLE_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[760] text-[var(--ui-text-primary)]'

export const DASHBOARD_DELETE_DROP_DESCRIPTION_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[650] text-[var(--ui-text-tertiary)]'

export const DASHBOARD_DRAG_OVERLAY_CLASS = [
  'fixed inset-0 z-[120] block p-7',
  'bg-black/[0.72] [backdrop-filter:blur(10px)_saturate(1.04)] [-webkit-backdrop-filter:blur(10px)_saturate(1.04)]',
  'isolate pointer-events-auto select-none [-webkit-user-select:none]',
  'opacity-100 transition-opacity duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)] starting:opacity-0 motion-reduce:transition-none'
].join(' ')

export const DASHBOARD_DRAG_OVERLAY_CLOSING_STATE_CLASS =
  'pointer-events-none !opacity-0 !duration-[var(--ui-motion-fast)] !ease-[cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_DROP_HEAD_CLASS =
  'flex items-start justify-between gap-4 border-b border-white/[0.07] p-[16px_18px_12px] max-[760px]:flex-col'

export const DASHBOARD_DROP_TITLE_CLASS =
  'text-[15px] font-[760] text-[var(--ui-text-primary)]'

export const DASHBOARD_DROP_HINT_CLASS =
  'm-[5px_0_0] text-[12px] leading-[1.5] text-[var(--ui-text-disabled)]'

export const DASHBOARD_DRAG_PREVIEW_CLASS = [
  'fixed left-0 top-0 z-[3] inline-grid max-w-[260px] grid-cols-[38px_minmax(0,180px)] items-center gap-2.5',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-2.5 text-[12px] font-bold leading-[1.35] text-[var(--ui-text-primary)] shadow-none',
  'pointer-events-none select-none [-webkit-user-select:none] opacity-100 transition-opacity duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] motion-reduce:transition-none [will-change:transform]',
  'starting:opacity-0',
  '[&_img]:[-webkit-user-drag:none]'
].join(' ')

export const DASHBOARD_DRAG_PREVIEW_CLOSING_STATE_CLASS =
  '!opacity-0 !ease-[cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_DRAG_PREVIEW_TITLE_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap'

export const DASHBOARD_CARD_FOOTER_CLASS =
  'relative z-[1] mt-auto flex min-h-[26px] w-full min-w-0 flex-[0_0_auto] flex-nowrap items-center justify-between gap-1.5 p-0'

export const DASHBOARD_CARD_MORE_CLASS =
  'relative z-[4] ml-auto flex-[0_0_auto]'

export const DASHBOARD_CARD_MORE_MENU_OPEN_STATE_CLASS =
  '!z-[60] !pointer-events-auto'

export const DASHBOARD_CARD_ICON_ACTION_CLASS = [
  'relative inline-grid size-[26px] min-h-[26px] min-w-[26px] flex-[0_0_26px] place-items-center',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-0 text-[var(--ui-text-secondary)] opacity-[0.82] no-underline shadow-none outline-none',
  'transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ui-ease-standard)]',
  '[-webkit-user-drag:none]',
  '[&_svg]:block [&_svg]:size-[15px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.9]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] hover:opacity-100 hover:no-underline hover:shadow-none',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:opacity-100 focus-visible:shadow-none focus-visible:outline-none',
  'data-[popup-open]:border-[var(--ui-divider-strong)] data-[popup-open]:bg-[var(--ui-surface-hover)] data-[popup-open]:text-[var(--ui-text-primary)] data-[popup-open]:opacity-100 data-[popup-open]:shadow-none',
  'active:scale-[0.92] disabled:pointer-events-none disabled:cursor-default disabled:opacity-45 data-disabled:pointer-events-none data-disabled:cursor-default data-disabled:opacity-45'
].join(' ')

export const DASHBOARD_CARD_TOOLTIP_CLASS =
  'z-[140] max-w-[180px] rounded-[var(--ui-radius-small)] border border-[var(--ui-divider)] bg-[#0f1115] px-[7px] py-[5px] text-[11px] font-[650] leading-[1.2] text-[var(--ui-text-primary)] shadow-none'

export const DASHBOARD_CARD_OPEN_ACTION_CLASS =
  DASHBOARD_CARD_ICON_ACTION_CLASS

export const DASHBOARD_CARD_COPY_ACTION_CLASS =
  DASHBOARD_CARD_ICON_ACTION_CLASS

export const DASHBOARD_CARD_MORE_TRIGGER_CLASS =
  DASHBOARD_CARD_ICON_ACTION_CLASS

export const DASHBOARD_CARD_CHECK_CLASS =
  'absolute right-2.5 top-2.5 z-[3] inline-grid size-[18px] cursor-pointer place-items-center border-0 bg-transparent shadow-none'

export const DASHBOARD_CARD_FAVICON_SHELL_CLASS = [
  'relative inline-grid size-[34px] flex-[0_0_auto] place-items-center overflow-visible border-0 bg-[rgba(243,245,247,0.06)]',
  'rounded-[var(--ui-radius-small)] text-[13px] font-extrabold text-[var(--dashboard-accent)] shadow-none [contain:layout]',
  'transition-[border-color,background-color] duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)]',
  'group-hover/dashboard-card:border-transparent group-hover/dashboard-card:bg-transparent group-hover/dashboard-card:shadow-none',
  'group-focus-within/dashboard-card:border-transparent group-focus-within/dashboard-card:bg-transparent group-focus-within/dashboard-card:shadow-none'
].join(' ')

export const DASHBOARD_CARD_FAVICON_SHELL_SELECTED_STATE_CLASS =
  '!border-transparent !bg-transparent !shadow-none'

export const DASHBOARD_CARD_FAVICON_IMAGE_CLASS = [
  'absolute z-[1] size-[23px] object-contain opacity-0',
  '[filter:drop-shadow(0_0_1px_rgba(245,245,240,0.92))_drop-shadow(0_0_5px_rgba(245,245,240,0.34))]',
  'transition-[filter,opacity] duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)]',
  '[-webkit-user-drag:none]',
  'group-hover/dashboard-card:[filter:drop-shadow(0_0_1px_rgba(245,245,240,0.96))_drop-shadow(0_0_7px_rgba(245,245,240,0.44))]',
  'group-focus-within/dashboard-card:[filter:drop-shadow(0_0_1px_rgba(245,245,240,0.96))_drop-shadow(0_0_7px_rgba(245,245,240,0.44))]'
].join(' ')

export const DASHBOARD_CARD_FAVICON_IMAGE_SELECTED_STATE_CLASS =
  '![filter:drop-shadow(0_0_1px_rgba(59,130,246,0.9))_drop-shadow(0_0_7px_rgba(59,130,246,0.38))]'

export const DASHBOARD_CARD_FAVICON_IMAGE_LOADED_STATE_CLASS =
  'opacity-100'

export const DASHBOARD_CARD_FAVICON_FALLBACK_CLASS =
  'relative z-0'

export const DASHBOARD_CARD_BODY_CLASS =
  'relative z-[1] grid min-h-0 min-w-0 grid-cols-[34px_minmax(0,1fr)] items-start gap-2.5 overflow-hidden pr-[46px]'

export const DASHBOARD_CARD_COPY_CLASS =
  'flex min-h-0 min-w-0 flex-col overflow-hidden'

export const DASHBOARD_CARD_TITLE_CLASS =
  'min-w-0 overflow-hidden text-ellipsis text-[13px] font-[730] leading-[1.35] text-[var(--dashboard-text)] [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]'

export const DASHBOARD_CARD_URL_CLASS = [
  'mt-1 block w-fit max-w-full min-w-0 overflow-hidden bg-transparent px-[3px] py-px font-mono text-[11px] font-semibold leading-[1.35]',
  'text-[rgba(247,247,247,0.48)] no-underline text-ellipsis whitespace-nowrap outline-0',
  '[-webkit-user-drag:none]',
  'transition-[color,background-color,box-shadow] duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)]',
  'hover:bg-[rgba(245,245,240,0.08)] hover:text-[rgba(247,247,247,0.9)] hover:shadow-[0_0_0_1px_rgba(245,245,240,0.08)]',
  'focus-visible:bg-[rgba(245,245,240,0.08)] focus-visible:text-[rgba(247,247,247,0.9)] focus-visible:shadow-[0_0_0_1px_rgba(245,245,240,0.08)]'
].join(' ')

export const DASHBOARD_CARD_META_CLASS =
  'mt-[7px] grid max-h-none min-w-0 grid-rows-[14px_20px] gap-[5px] overflow-hidden'

export const DASHBOARD_CARD_PATH_CHIP_CLASS = [
  'block h-auto w-full min-w-0 overflow-hidden border-0 border-t-0 bg-transparent p-0 pt-0 text-left text-[10px] leading-[1.2]',
  'font-mono [font-weight:680] text-[rgba(247,247,247,0.42)] text-ellipsis whitespace-nowrap outline-none',
  '[direction:ltr] [unicode-bidi:plaintext] [line-break:auto] [hanging-punctuation:none] [text-spacing-trim:space-all] [text-autospace:no-autospace]',
  'hover:bg-transparent hover:text-[rgba(247,247,247,0.62)] focus-visible:bg-transparent focus-visible:text-[rgba(247,247,247,0.62)] focus-visible:outline-none'
].join(' ')

export const DASHBOARD_CARD_TAG_ROW_CLASS =
  'flex min-w-0 items-center gap-[5px] overflow-hidden'

export const DASHBOARD_CARD_TAG_CHIP_CLASS = [
  'inline-flex h-5 min-h-5 max-w-[min(100%,132px)] min-w-0 flex-[0_1_auto] items-center overflow-hidden rounded-[var(--ui-radius-pill)] border border-[rgba(245,245,240,0.08)]',
  'bg-[#050505] px-[7px] text-[10px] font-[650] leading-none text-[rgba(247,247,247,0.52)] shadow-none text-ellipsis whitespace-nowrap'
].join(' ')

export const DASHBOARD_CARD_TAG_TOGGLE_CLASS = [
  'inline-flex h-5 min-h-5 max-w-none min-w-0 flex-none cursor-pointer items-center overflow-hidden rounded-[var(--ui-radius-pill)] border border-[var(--ui-divider)]',
  'bg-[var(--ui-surface-raised)] px-[7px] text-[10px] font-[750] leading-none text-[var(--ui-text-secondary)] shadow-none text-ellipsis whitespace-nowrap outline-none',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline-none'
].join(' ')

export const DASHBOARD_TAG_POPOVER_POSITIONER_CLASS =
  'contents'

export const DASHBOARD_TAG_POPOVER_CLASS = [
  'absolute right-3 bottom-[38px] left-[46px] z-[90] max-h-[148px] overflow-auto rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)]',
  'pointer-events-auto bg-[var(--ui-surface-raised)] p-2.5 text-[var(--dashboard-text)] shadow-none outline-none [-webkit-backdrop-filter:none] [backdrop-filter:none]',
  '[transform-origin:80%_100%]'
].join(' ')

export const DASHBOARD_TAG_POPOVER_TITLE_CLASS =
  'mb-2 block text-[12px] font-[760] leading-normal text-[var(--ui-text-primary)]'

export const DASHBOARD_TAG_POPOVER_LIST_CLASS =
  'flex flex-wrap gap-1.5'

export const DASHBOARD_CARD_MENU_CLASS = [
  'absolute right-0 top-[calc(100%+8px)] bottom-auto z-[100] grid w-[168px] gap-1',
  'rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-1.5 text-[var(--dashboard-text)] shadow-none',
  'pointer-events-auto [-webkit-backdrop-filter:none] [backdrop-filter:none]'
].join(' ')

export const DASHBOARD_CARD_MENU_ITEM_CLASS = [
  'grid min-h-[30px] w-full cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-center justify-stretch justify-items-start gap-2',
  'rounded-[var(--ui-radius-control)] border-0 bg-transparent px-2 py-0 text-left text-xs font-[680] leading-normal text-[var(--dashboard-text-soft)] outline-none',
  'transition-colors duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)]',
  '[&_span]:min-w-0 [&_span]:justify-self-start [&_span]:text-left',
  '[&_svg]:block [&_svg]:size-[15px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.9] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]',
  'hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] data-[highlighted]:bg-[var(--ui-surface-hover)] data-[highlighted]:text-[var(--ui-text-primary)]',
  'disabled:cursor-default disabled:opacity-50 data-disabled:cursor-default data-disabled:opacity-50'
].join(' ')

export const DASHBOARD_CARD_MENU_ITEM_DANGER_CLASS = [
  DASHBOARD_CARD_MENU_ITEM_CLASS,
  'text-[#ffb7b0] hover:bg-[rgba(255,138,130,0.1)] hover:text-[#ffe7e3] focus-visible:bg-[rgba(255,138,130,0.1)] focus-visible:text-[#ffe7e3] data-[highlighted]:bg-[rgba(255,138,130,0.1)] data-[highlighted]:text-[#ffe7e3]'
].join(' ')

export const DASHBOARD_CARD_STATUS_DOT_CLASS =
  'absolute right-[38px] top-[17px] block size-2 rounded-[var(--ui-radius-pill)] border-0 bg-white/20 shadow-none'

export const DASHBOARD_CARD_STATUS_DOT_TAGGED_STATE_CLASS =
  '!bg-[var(--dashboard-accent)]'

export const DASHBOARD_TAG_EDITOR_STATUS_CLASS =
  'm-[8px_0_0] min-h-[18px] font-[var(--font-sans)] text-[12px] leading-[1.5] tracking-[0] text-[var(--dashboard-text-muted)]'
