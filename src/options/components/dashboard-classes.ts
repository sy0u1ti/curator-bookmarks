import { OPTION_PANEL_STANDARD_LAYOUT_CLASS } from './option-layout-classes.js'

export const DASHBOARD_PANEL_CLASS = [
  OPTION_PANEL_STANDARD_LAYOUT_CLASS,
  'relative select-none [-webkit-user-select:none]',
  '[--dashboard-card-height:150px] [--dashboard-card-min-width:260px] [--dashboard-grid-pad:clamp(18px,2.2vw,24px)]',
  'font-[var(--font-sans)] text-ds-text-primary',
  'pt-0 px-0 pb-12 border-0 rounded-none bg-transparent shadow-none',
  '[.dashboard-fullscreen-active_&]:grid [.dashboard-fullscreen-active_&]:[grid-template-areas:"dashboard-chrome"_"dashboard-results"]',
  '[.dashboard-fullscreen-active_&]:[grid-template-rows:auto_minmax(0,1fr)] [.dashboard-fullscreen-active_&]:min-h-screen [.dashboard-fullscreen-active_&]:max-h-screen',
  '[.dashboard-fullscreen-active_&]:overflow-hidden [.dashboard-fullscreen-active_&]:border-0 [.dashboard-fullscreen-active_&]:rounded-none',
  '[.dashboard-fullscreen-active_&]:w-full [.dashboard-fullscreen-active_&]:max-w-none [.dashboard-fullscreen-active_&]:mx-0',
  '[.dashboard-fullscreen-active_&]:bg-ds-app [.dashboard-fullscreen-active_&]:p-[8px_clamp(18px,2.6vw,40px)_14px]',
  '[.options-dashboard-embed.dashboard-fullscreen-active_&]:bg-transparent'
].join(' ')

export const DASHBOARD_SELECTION_GROUP_CLASS = [
  'relative z-[2] block w-full max-w-[620px] min-w-0 overflow-visible [grid-column:3] [grid-row:1] justify-self-stretch',
  '[.dashboard-fullscreen-active_&]:relative [.dashboard-fullscreen-active_&]:z-[2] [.dashboard-fullscreen-active_&]:self-start [.dashboard-fullscreen-active_&]:flex-none',
  'max-[980px]:max-w-[680px] max-[980px]:justify-self-center max-[980px]:[grid-column:1] max-[980px]:[grid-row:2]',
  'max-[760px]:max-w-none max-[760px]:justify-self-stretch max-[760px]:[grid-column:1/3]'
].join(' ')

export const DASHBOARD_SELECTION_GROUP_ACTIVE_CLASS = [
  'rounded-ds-md border border-ds-border bg-ds-surface-1 p-[8px_10px] shadow-none',
  'max-[760px]:rounded-ds-sm max-[760px]:p-2'
].join(' ')

export const DASHBOARD_PANEL_NOT_READY_STATE_CLASS =
  'pointer-events-none invisible opacity-0'

export const DASHBOARD_CHROME_SKELETON_CONTENT_CLASS =
  't-skel-content !relative !inset-auto min-w-0 [grid-area:1/1]'

export const DASHBOARD_CHROME_SKELETON_LAYER_CLASS =
  't-skel-skeleton is-pulsing pointer-events-none !relative !inset-auto [grid-area:1/1]'

export const DASHBOARD_TOOLBAR_SKELETON_ROOT_CLASS = [
  't-skel grid w-full overflow-visible',
  '[--pulse-dur:900ms] [--pulse-count:2] [--pulse-min:0.58] [--reveal-dur:360ms]',
  '[.dashboard-fullscreen-active_&]:[grid-area:dashboard-chrome]'
].join(' ')

export const DASHBOARD_SELECTION_BAR_CLASS =
  'grid min-h-8 w-full max-w-full grid-cols-[minmax(84px,1fr)_max-content] items-center justify-between gap-3 border-0 bg-transparent p-0 max-[560px]:flex max-[560px]:flex-col max-[560px]:items-start'

export const DASHBOARD_SELECTION_COUNT_CLASS =
  'block w-24 justify-self-start whitespace-nowrap bg-transparent text-left font-mono text-[11px] font-bold leading-normal tracking-[0] text-ds-text-muted tabular-nums'

export const DASHBOARD_SELECTION_ACTIONS_CLASS =
  'flex min-w-0 flex-none flex-wrap items-center justify-end gap-2 bg-transparent max-[560px]:w-full max-[560px]:justify-start'

export const DASHBOARD_SELECTION_BUTTON_CLASS =
  'min-h-8 whitespace-nowrap rounded-ds-sm px-2.5 text-xs font-medium leading-none tracking-[0] shadow-none transition-colors disabled:cursor-default data-disabled:cursor-default'

export const DASHBOARD_SELECTION_SECONDARY_BUTTON_CLASS = [
  DASHBOARD_SELECTION_BUTTON_CLASS,
  'border-ds-border bg-ds-surface-2 text-ds-text-primary',
  'hover:border-ds-border-hover hover:bg-ds-hover',
  'focus-visible:border-ds-focus focus-visible:bg-ds-hover',
  'disabled:text-ds-text-disabled data-disabled:text-ds-text-disabled'
].join(' ')

export const DASHBOARD_SELECTION_DANGER_BUTTON_CLASS = [
  DASHBOARD_SELECTION_BUTTON_CLASS,
  'border-ds-danger/35 bg-ds-surface-2 text-ds-danger-text',
  'hover:border-ds-danger hover:bg-ds-danger-soft',
  'focus-visible:border-ds-danger focus-visible:bg-ds-danger-soft',
  'disabled:border-ds-border disabled:bg-ds-surface-2 disabled:text-ds-text-disabled',
  'data-disabled:border-ds-border data-disabled:bg-ds-surface-2 data-disabled:text-ds-text-disabled'
].join(' ')

export const DASHBOARD_SELECTION_SKELETON_BUTTON_CLASS =
  'block h-8 rounded-ds-sm border border-ds-border bg-ds-surface-2'

export const DASHBOARD_TOOLBAR_EXIT_SKELETON_CLASS =
  'block h-[38px] w-[60px] rounded-ds-sm border border-ds-border bg-ds-surface-2'

export const DASHBOARD_CARD_ROOT_CLASS = [
  'group/dashboard-card relative z-0 flex h-[150px] min-h-[150px] min-w-0 flex-col gap-[9px] overflow-visible rounded-ds-sm border border-ds-border bg-ds-surface-2 p-3 select-none',
  'before:pointer-events-none before:absolute before:[inset:0_auto_0_0] before:z-0 before:block before:w-0 before:rounded-[var(--ds-radius-full)_0_0_var(--ds-radius-full)] before:bg-transparent before:content-[""]',
  '[box-shadow:none] [contain:layout_paint_style] [contain-intrinsic-size:var(--dashboard-card-height)]',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none] hover:[box-shadow:none]',
  '[-webkit-user-select:none] [touch-action:manipulation]',
  '[transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background-color_var(--ds-motion-standard)_var(--ds-ease-standard),box-shadow_var(--ds-motion-standard)_var(--ds-ease-standard),transform_var(--ds-motion-fast)_var(--ds-ease-standard)]',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:[transform:none]'
].join(' ')

export const DASHBOARD_CARD_SELECTED_STATE_CLASS = [
  'border-ds-accent-line bg-ds-selected text-ds-accent-text',
  'hover:border-ds-border-hover hover:bg-ds-hover'
].join(' ')

export const DASHBOARD_CARD_MENU_OPEN_STATE_CLASS =
  'z-[90] [contain:layout_style] [content-visibility:visible]'

export const DASHBOARD_CARD_TAGS_EXPANDED_STATE_CLASS =
  'z-[90] [contain:layout_style] [content-visibility:visible]'

export const DASHBOARD_CARD_STATIC_VISIBILITY_CLASS =
  ''

export const DASHBOARD_CARD_DIMMED_CLASS =
  'opacity-[0.72] [transform:none]'

export const DASHBOARD_TOOLBAR_CLASS = [
  'grid w-full grid-cols-[minmax(0,1fr)_minmax(320px,680px)_minmax(440px,620px)_minmax(72px,1fr)] items-start gap-3',
  'm-0 border-0 bg-transparent p-[10px_0_8px] [box-shadow:none] shadow-none [-webkit-backdrop-filter:none] [backdrop-filter:none]',
  '[.dashboard-fullscreen-active_&]:[grid-area:dashboard-chrome]',
  'max-[980px]:grid-cols-[minmax(0,1fr)_auto] max-[980px]:px-0',
  'max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:items-start max-[760px]:gap-2 max-[760px]:p-[8px_0_6px]'
].join(' ')

export const DASHBOARD_PERFORMANCE_CLASS = [
  '[&_:where(*)]:duration-0 [&_:where(*)]:[animation-duration:0ms]'
].join(' ')

export const DASHBOARD_TITLE_ACTIONS_CLASS =
  'grid min-w-0 justify-self-end grid-cols-[minmax(0,1fr)_auto] items-start justify-end gap-2 pt-0 [--dashboard-status-width:minmax(0,1fr)] [grid-column:4] [grid-row:1] max-[980px]:[grid-column:2] max-[760px]:![grid-column:2] max-[760px]:grid-cols-[auto]'

export const DASHBOARD_TOOLBAR_STATUS_CLASS =
  'relative inline-flex min-h-[38px] w-auto max-w-full min-w-0 items-center justify-end overflow-hidden text-ellipsis whitespace-nowrap pl-0 text-right text-[13px] font-semibold leading-[1.2] text-ds-text-muted empty:invisible before:hidden max-[760px]:hidden'

export const DASHBOARD_SEARCH_BOX_CLASS =
  'relative grid min-w-0 w-full max-w-[680px] grid-cols-[minmax(0,1fr)] gap-[5px] bg-transparent [grid-column:2] [grid-row:1] [box-shadow:none] [margin-inline:0] [.dashboard-fullscreen-active_&]:gap-[5px] max-[980px]:justify-self-center max-[980px]:[grid-column:1] max-[760px]:[grid-column:1]'

export const DASHBOARD_SEARCH_LABEL_CLASS =
  'm-0 flex w-full max-w-[680px] flex-col gap-2.5 bg-transparent [box-shadow:none] [margin-inline:0]'

export const DASHBOARD_SEARCH_LABEL_TEXT_CLASS =
  'sr-only'

export const DASHBOARD_QUERY_ROW_CLASS =
  'relative block min-w-0 bg-transparent p-0 [box-shadow:none]'

export const DASHBOARD_SEARCH_INPUT_FIELD_CLASS = [
  'group/search flex min-h-10 w-full cursor-text items-center gap-1.5 rounded-lg border border-ds-border bg-ds-surface-2 py-0 pl-3 pr-1.5 text-ds-text-primary',
  'transition-[border-color,background,box-shadow] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover',
  'focus-within:border-ds-focus focus-within:bg-ds-hover focus-within:shadow-[0_0_0_3px_var(--ds-accent-soft)]'
].join(' ')

export const DASHBOARD_SEARCH_INPUT_CLASS = [
  'min-w-0 flex-auto self-stretch border-0 bg-transparent px-0.5 py-0 text-sm leading-[1.4] text-ds-text-primary outline-none placeholder:text-ds-text-muted',
  '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden [&::-webkit-search-decoration]:appearance-none'
].join(' ')

export const DASHBOARD_SEARCH_ICON_CLASS =
  'pointer-events-none flex-none text-ds-text-muted transition-colors duration-ds-fast ease-ds-standard group-focus-within/search:text-ds-text-secondary'

export const DASHBOARD_SEARCH_CHIPS_CLASS =
  'flex flex-wrap gap-1.5 bg-transparent [box-shadow:none] empty:hidden'

export const DASHBOARD_SEARCH_CHIP_CLASS =
  'inline-flex min-h-[22px] items-center rounded-full border border-ds-border bg-ds-app px-2 py-0 text-[12px] font-[650] text-ds-text-secondary [box-shadow:none] [.dashboard-fullscreen-active_&]:min-h-5 [.dashboard-fullscreen-active_&]:text-[11px]'

export const DASHBOARD_CLEAR_SEARCH_CLASS =
  'inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border-0 bg-transparent p-0 text-ds-text-muted transition-[background,color] duration-ds-fast ease-ds-standard hover:bg-ds-active hover:text-ds-text-primary focus-visible:bg-ds-active focus-visible:text-ds-text-primary focus-visible:outline-none'

export const DASHBOARD_NATURAL_SEARCH_TOGGLE_CLASS = [
  'relative inline-flex h-7 min-w-14 flex-none items-center justify-center gap-[5px] whitespace-nowrap rounded-lg border border-ds-border bg-transparent px-3.5 text-xs font-medium tracking-[0.01em] text-ds-text-secondary',
  'transition-[background,border-color,color,box-shadow] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-[0_0_0_3px_var(--ds-accent-soft)] focus-visible:outline-none'
].join(' ')

export const DASHBOARD_NATURAL_SEARCH_TOGGLE_ACTIVE_STATE_CLASS =
  'border-ds-accent bg-ds-accent text-ds-accent-contrast hover:border-[var(--ds-accent-hover)] hover:bg-ds-accent-hover hover:text-ds-accent-contrast focus-visible:border-[var(--ds-accent-hover)] focus-visible:bg-ds-accent-hover focus-visible:text-ds-accent-contrast'

export const DASHBOARD_NATURAL_SEARCH_TOGGLE_FALLBACK_STATE_CLASS =
  'border-ds-warning bg-[rgba(248,214,109,0.14)] text-ds-warning hover:border-ds-warning hover:bg-[rgba(248,214,109,0.14)] hover:text-ds-warning focus-visible:border-ds-warning focus-visible:bg-[rgba(248,214,109,0.14)] focus-visible:text-ds-warning'

export const DASHBOARD_SEARCH_HELP_BUTTON_CLASS = [
  'relative z-[2] inline-flex size-7 min-h-7 min-w-7 flex-none cursor-help items-center justify-center whitespace-nowrap',
  'rounded-ds-sm border border-ds-border bg-ds-surface-2 p-0 text-[10px] font-[650] leading-none text-ds-text-secondary [font-family:inherit] [box-shadow:none]',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/[0.72]',
  'active:scale-[0.96] [&[aria-expanded=true]]:border-ds-accent-line [&[aria-expanded=true]]:bg-ds-selected [&[aria-expanded=true]]:text-ds-accent-text'
].join(' ')

export const DASHBOARD_SEARCH_HELP_SKELETON_CLASS =
  'block size-7 flex-none rounded-ds-sm border border-ds-border bg-ds-surface-2'

export const DASHBOARD_SEARCH_HELP_POPOVER_CLASS = [
  '[z-index:150] grid w-[min(332px,calc(100vw-32px))] max-w-[min(332px,calc(100vw-32px))] gap-[7px]',
  'rounded-ds-md border border-ds-border bg-ds-surface-2 p-[10px_12px]',
  'text-left text-[12px] font-medium leading-[1.45] text-ds-text-primary shadow-none',
  'whitespace-normal outline-none [-webkit-backdrop-filter:none] [backdrop-filter:none]'
].join(' ')

export const DASHBOARD_SEARCH_HELP_TITLE_CLASS =
  'text-[12px] font-bold text-ds-text-primary'

export const DASHBOARD_SEARCH_HELP_EXAMPLE_CLASS =
  'grid min-w-0 grid-cols-[minmax(0,118px)_minmax(0,1fr)] items-baseline gap-2 rounded-ds-sm border border-ds-border-subtle bg-ds-app px-2 py-1 text-[11px] leading-[1.35] text-ds-text-muted [&_code]:min-w-0 [&_code]:overflow-hidden [&_code]:text-ellipsis [&_code]:whitespace-nowrap [&_code]:font-mono [&_code]:text-ds-text-primary'

export const DASHBOARD_SEARCH_SKELETON_ACTION_CLASS =
  'block h-7 w-14 flex-none rounded-lg border border-ds-border bg-ds-surface-2 max-[520px]:h-8'

export const DASHBOARD_SEARCH_SKELETON_ICON_CLASS =
  'block size-4 flex-none rounded-ds-sm border border-ds-border-subtle bg-white/[0.045]'

export const DASHBOARD_NATURAL_SEARCH_MARKER_CLASS =
  'h-1.5 w-1.5 rounded-full bg-current animate-[cb-search-pulse_1s_var(--ds-ease-standard)_infinite] motion-reduce:animate-none'

export const DASHBOARD_FOLDER_BREADCRUMBS_CLASS =
  'min-h-[22px] min-w-0 overflow-hidden bg-transparent text-ds-text-secondary [box-shadow:none] empty:hidden'

export const DASHBOARD_FOLDER_BREADCRUMB_LIST_CLASS =
  'm-0 flex min-w-0 list-none flex-nowrap items-center gap-[5px] overflow-hidden p-0'

export const DASHBOARD_FOLDER_BREADCRUMB_ITEM_CLASS =
  'inline-flex min-w-0 flex-[0_1_auto]'

export const DASHBOARD_FOLDER_BREADCRUMB_CURRENT_ITEM_CLASS =
  'flex-[1_1_auto]'

export const DASHBOARD_FOLDER_BREADCRUMB_LINK_CLASS =
  'inline-flex min-h-[22px] min-w-0 max-w-[220px] flex-[0_1_auto] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-ds-sm border border-ds-border bg-ds-surface-2 px-1.5 py-0 text-[12px] font-[650] leading-[1.2] text-ds-text-secondary [box-shadow:none] hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary max-[760px]:max-w-[154px] [.dashboard-fullscreen-active_&]:min-h-5 [.dashboard-fullscreen-active_&]:text-[11px]'

export const DASHBOARD_FOLDER_BREADCRUMB_CURRENT_CLASS =
  'inline-flex min-h-[22px] min-w-0 max-w-[220px] flex-[0_1_auto] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-ds-sm border border-ds-border bg-ds-surface-2 px-1.5 py-0 text-[12px] font-[650] leading-[1.2] text-ds-text-secondary [box-shadow:none] max-[760px]:max-w-[154px] [.dashboard-fullscreen-active_&]:min-h-5 [.dashboard-fullscreen-active_&]:text-[11px]'

export const DASHBOARD_RESULTS_GROUP_CLASS = [
  'mt-3 flex min-h-0 select-none flex-col overflow-hidden rounded-ds-md',
  'border border-ds-border bg-ds-surface-1 p-3 [box-shadow:none]',
  '[-webkit-user-select:none] [-webkit-backdrop-filter:none] [backdrop-filter:none]',
  '[.dashboard-fullscreen-active_&]:relative [.dashboard-fullscreen-active_&]:z-[1] [.dashboard-fullscreen-active_&]:[grid-area:dashboard-results]',
  '[.dashboard-fullscreen-active_&]:mt-2.5 [.dashboard-fullscreen-active_&]:flex-[1_1_auto]',
  'max-[760px]:mt-2 max-[760px]:p-2'
].join(' ')

export const DASHBOARD_RESULTS_TITLE_CLASS = 'sr-only'

export const DASHBOARD_RESULTS_SKELETON_ROOT_CLASS = [
  't-skel min-h-0 flex-[1_1_auto] overflow-hidden',
  '[--pulse-dur:900ms] [--pulse-count:2] [--pulse-min:0.58] [--reveal-dur:360ms]'
].join(' ')

export const DASHBOARD_RESULTS_SKELETON_LAYER_CLASS =
  't-skel-skeleton is-pulsing h-full min-h-0 overflow-hidden pointer-events-none'

export const DASHBOARD_RESULTS_CONTENT_LAYER_CLASS =
  't-skel-content h-full min-h-0'

export const DASHBOARD_CONTENT_LAYOUT_CLASS =
  'grid min-h-0 flex-[1_1_auto] grid-cols-[minmax(190px,204px)_minmax(0,1fr)] items-stretch gap-3.5 bg-transparent p-0 max-[900px]:grid-cols-[minmax(170px,190px)_minmax(0,1fr)] max-[760px]:grid-cols-[minmax(0,1fr)] max-[760px]:gap-2'

export const DASHBOARD_FOLDER_SIDEBAR_CLASS =
  'mt-0 flex min-h-0 min-w-0 select-none flex-col overflow-hidden rounded-ds-md border border-ds-border bg-ds-surface-1 [box-shadow:none] [backdrop-filter:none] [-webkit-backdrop-filter:none] max-[760px]:max-h-10 max-[760px]:rounded-none max-[760px]:border-0 max-[760px]:bg-transparent'

export const DASHBOARD_FOLDER_SIDEBAR_HEAD_CLASS =
  'flex flex-[0_0_auto] items-center justify-between gap-2.5 border-b border-ds-border-subtle bg-transparent p-[12px_12px_10px] max-[760px]:hidden'

export const DASHBOARD_FOLDER_SIDEBAR_TITLE_CLASS =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[760] text-ds-text-primary'

export const DASHBOARD_META_PILL_CLASS = [
  'inline-flex min-h-6 min-w-0 max-w-full flex-none items-center overflow-hidden text-ellipsis whitespace-nowrap px-3.5',
  'rounded-full border border-ds-border bg-ds-app',
  'font-[var(--font-sans)] text-[11px] font-semibold leading-normal tracking-[0] text-ds-text-muted',
  'max-[760px]:w-fit max-[760px]:whitespace-normal'
].join(' ')

export const DASHBOARD_FOLDER_TREE_CLASS =
  'flex min-h-0 flex-[1_1_auto] flex-col gap-0.5 overflow-auto p-2 max-[760px]:flex-row max-[760px]:gap-1.5 max-[760px]:overflow-x-auto max-[760px]:overflow-y-hidden max-[760px]:p-[0_0_4px] max-[760px]:[scrollbar-gutter:auto] max-[760px]:[scrollbar-width:none] max-[760px]:[&::-webkit-scrollbar]:hidden'

export const DASHBOARD_FOLDER_TREE_ITEM_CLASS = [
  'grid min-h-[30px] w-full cursor-pointer grid-cols-[12px_minmax(0,1fr)_max-content] items-center justify-stretch gap-[7px]',
  'rounded-ds-sm border-0 border-transparent bg-transparent py-0 pr-2 pl-[calc(8px+var(--folder-depth-offset))]',
  'text-left text-xs leading-normal text-ds-text-secondary [--folder-depth-offset:0px]',
  'transition-colors duration-ds-standard ease-ds-standard',
  'hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:bg-ds-hover focus-visible:text-ds-text-primary',
  '[&[aria-selected=true]]:bg-ds-selected [&[aria-selected=true]]:text-ds-accent-text',
  '[&[aria-selected=true]:hover]:bg-ds-selected [&[aria-selected=true]:hover]:text-ds-accent-text',
  '[&[aria-selected=true]:focus-visible]:bg-ds-selected [&[aria-selected=true]:focus-visible]:text-ds-accent-text',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/35',
  'max-[760px]:inline-flex max-[760px]:min-h-8 max-[760px]:w-auto max-[760px]:max-w-[180px] max-[760px]:flex-none max-[760px]:grid-cols-none max-[760px]:gap-1.5 max-[760px]:border max-[760px]:border-ds-border-subtle max-[760px]:bg-ds-app max-[760px]:px-2.5 max-[760px]:pl-2.5'
].join(' ')

export const DASHBOARD_FOLDER_TREE_BRANCH_CLASS =
  'relative h-2.5 w-2.5 rounded-bl-[4px] border-b border-l border-b-white/[0.22] border-l-white/20 max-[760px]:hidden'

export const DASHBOARD_FOLDER_TREE_ROOT_BRANCH_CLASS =
  'relative h-2.5 w-2.5 rounded-full border border-white/[0.28] max-[760px]:hidden'

export const DASHBOARD_FOLDER_TREE_LABEL_CLASS =
  'min-w-0 overflow-hidden text-left text-ellipsis whitespace-nowrap text-xs font-[680]'

export const DASHBOARD_FOLDER_TREE_COUNT_CLASS =
  'min-w-0 justify-self-end rounded-full border-0 border-transparent bg-transparent p-0 text-right text-[11px] font-[720] leading-[1.25] text-ds-text-secondary tabular-nums [[aria-selected=true]_&]:text-ds-accent-text max-[760px]:text-[10px]'

export const DASHBOARD_NATURAL_SEARCH_LABEL_CLASS =
  'block min-w-0 overflow-hidden text-center [text-overflow:clip] whitespace-nowrap leading-none'

export const DASHBOARD_FOLDER_BREADCRUMB_SEPARATOR_CLASS =
  'inline-flex min-w-0 flex-none text-[11px] text-ds-text-disabled'

export const DASHBOARD_CARD_GRID_CLASS = [
  'relative min-h-0 min-w-0 flex-[1_1_auto] items-stretch gap-2.5 overflow-auto bg-transparent [box-shadow:none]',
  'm-0 [padding:0_18px_0_0] [contain:layout_paint] [scrollbar-gutter:stable]',
  'select-none [-webkit-user-select:none]'
].join(' ')

export const DASHBOARD_SKELETON_BAR_CLASS =
  'block h-2.5 rounded-full bg-white/[0.055] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018)]'

export const DASHBOARD_SKELETON_DOT_CLASS =
  'block size-2.5 rounded-full border border-white/[0.14] bg-white/[0.035]'

export const DASHBOARD_SKELETON_FOLDER_ITEM_CLASS =
  'grid min-h-[30px] grid-cols-[12px_minmax(0,1fr)_38px] items-center gap-[7px] rounded-ds-sm py-0 pr-2 pl-[calc(8px+var(--folder-depth-offset))] [--folder-depth-offset:0px] max-[760px]:min-h-8'

export const DASHBOARD_SKELETON_CARD_GRID_CLASS =
  'pointer-events-none overflow-hidden'

export const DASHBOARD_SKELETON_CARD_CLASS =
  'flex h-full min-h-0 flex-col gap-3 rounded-ds-sm border border-ds-border bg-ds-surface-2 p-3'

export const DASHBOARD_SKELETON_CARD_HEADER_CLASS =
  'flex min-w-0 items-start justify-between gap-3'

export const DASHBOARD_SKELETON_CARD_ICON_CLASS =
  'block size-9 flex-none rounded-ds-sm border border-ds-border-subtle bg-white/[0.045]'

export const DASHBOARD_SKELETON_CARD_COPY_CLASS =
  'grid min-w-0 flex-1 gap-2 pt-0.5'

export const DASHBOARD_SKELETON_CARD_META_CLASS =
  'mt-auto flex flex-wrap items-center gap-1.5'

export const DASHBOARD_RESULTS_GRID_STATE_CLASS =
  'grid [grid-template-columns:repeat(auto-fill,minmax(min(var(--dashboard-card-min-width),100%),1fr))] [grid-auto-rows:var(--dashboard-card-height)]'

export const DASHBOARD_RESULTS_TRANSITION_STATE_CLASS =
  'min-h-[max(var(--dashboard-card-height),var(--dashboard-results-stable-height,var(--dashboard-card-height)))] overflow-x-hidden overflow-y-auto pointer-events-none before:content-none'

export const DASHBOARD_RESULTS_WINDOWED_STATE_CLASS =
  'relative block [overflow-anchor:none] scroll-auto [contain:layout_paint]'

export const DASHBOARD_FLOATING_SURFACE_CONTAINMENT_CLASS =
  '[contain:layout_style]'

export const DASHBOARD_VIRTUAL_SPACER_CLASS =
  'relative col-span-full min-h-full w-full'

export const DASHBOARD_VIRTUAL_WINDOW_CLASS = [
  'absolute left-0 right-0 top-0 grid min-w-0 items-stretch gap-2.5 bg-transparent mt-0',
  '[grid-auto-rows:var(--dashboard-card-height)] [transform:translate3d(0,0,0)] [will-change:transform] [contain:layout_paint]',
  DASHBOARD_FLOATING_SURFACE_CONTAINMENT_CLASS
].join(' ')

export const DASHBOARD_TAG_EDITOR_BUTTON_CLASS =
  'h-[34px] min-h-[34px] flex-none whitespace-nowrap rounded-[9px] px-3 text-[13px] font-bold leading-none tracking-[0] shadow-none [word-break:keep-all] active:scale-[0.985]'

export const DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS = [
  DASHBOARD_TAG_EDITOR_BUTTON_CLASS,
  'border-ds-border bg-ds-surface-2 text-ds-text-primary',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary'
].join(' ')

export const DASHBOARD_TAG_EDITOR_DANGER_BUTTON_CLASS = [
  DASHBOARD_TAG_EDITOR_BUTTON_CLASS,
  'border-ds-danger bg-ds-danger-soft text-ds-danger-text',
  'hover:border-ds-danger hover:bg-ds-danger-soft hover:text-ds-danger-text',
  'focus-visible:border-ds-danger focus-visible:bg-ds-danger-soft focus-visible:text-ds-danger-text',
  'disabled:border-ds-danger/30 disabled:bg-ds-danger-soft disabled:text-ds-text-disabled',
  'data-disabled:border-ds-danger/30 data-disabled:bg-ds-danger-soft data-disabled:text-ds-text-disabled'
].join(' ')

export const DASHBOARD_TAG_EDITOR_PRIMARY_BUTTON_CLASS = [
  DASHBOARD_TAG_EDITOR_BUTTON_CLASS,
  'border-ds-accent bg-ds-accent text-ds-accent-contrast',
  'hover:border-ds-accent-hover hover:bg-ds-accent-hover hover:text-ds-accent-contrast',
  'focus-visible:border-ds-accent-hover focus-visible:bg-ds-accent-hover focus-visible:text-ds-accent-contrast'
].join(' ')

export const DASHBOARD_TOOLBAR_EXIT_BUTTON_CLASS =
  DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS

export const DASHBOARD_TAG_EDITOR_HEAD_CLASS =
  'mb-3.5 flex items-start justify-between gap-3.5'

export const DASHBOARD_TAG_EDITOR_TITLE_CLASS =
  'block text-[15px] font-[760] leading-[1.35] tracking-[0] text-ds-text-primary [overflow-wrap:anywhere]'

export const DASHBOARD_TAG_EDITOR_META_CLASS =
  'mt-[5px] block text-[12px] font-[620] leading-[1.45] tracking-[0] text-ds-text-disabled [overflow-wrap:anywhere]'

export const DASHBOARD_TAG_EDITOR_FIELD_CLASS =
  'flex flex-col gap-[7px]'

export const DASHBOARD_TAG_EDITOR_FIELD_LABEL_CLASS =
  'text-[12px] font-bold leading-normal tracking-[0] text-ds-text-muted'

export const DASHBOARD_TAG_EDITOR_TEXTAREA_CLASS = [
  'min-h-[116px] w-full resize-y rounded-ds-sm border border-ds-border',
  'bg-ds-surface-2 p-[10px_11px] text-[13px] leading-[1.55] text-ds-text-primary [font-family:var(--font-sans)] placeholder:text-ds-text-muted',
  'select-text [-webkit-user-select:text]',
  'focus:ring-0 focus-visible:border-ds-focus focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus'
].join(' ')

export const DASHBOARD_TAG_EDITOR_HELP_CLASS =
  'm-[8px_0_0] font-[var(--font-sans)] text-[12px] font-[620] leading-[1.5] tracking-[0] text-ds-text-muted'

export const DASHBOARD_TAG_EDITOR_ACTIONS_CLASS =
  'mt-[13px] flex flex-wrap items-end justify-between gap-2.5'

export const DASHBOARD_TAG_EDITOR_AI_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center gap-1.5 rounded-ds-sm border border-ds-border-subtle bg-ds-app p-1 max-[520px]:w-full'

export const DASHBOARD_TAG_EDITOR_PRIMARY_ACTIONS_CLASS =
  'ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-[520px]:w-full'

export const DASHBOARD_TAG_EDITOR_POSITIONER_CLASS = 'contents'

export const DASHBOARD_TAG_EDITOR_ROOT_CLASS =
  'fixed left-0 top-0 z-[132] w-[min(430px,calc(100vw_-_36px))] max-[760px]:left-3.5 max-[760px]:right-3.5 max-[760px]:top-[18px] max-[760px]:w-auto'

export const DASHBOARD_TAG_EDITOR_ROOT_CLOSING_STATE_CLASS =
  'pointer-events-none'

export const DASHBOARD_TAG_EDITOR_PANEL_CLASS = [
  'dashboard-tag-editor-panel rounded-ds-md border border-ds-border bg-ds-surface-2 p-4 text-ds-text-primary shadow-none',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none] [transform-origin:top_center]',
  '[opacity:var(--dashboard-tag-editor-opacity,1)] [transform:var(--dashboard-tag-editor-transform,translateY(0)_scale(1))] [transition:opacity_var(--dashboard-tag-editor-dur,var(--dropdown-open-dur))_var(--dashboard-tag-editor-ease,var(--dropdown-ease)),transform_var(--dashboard-tag-editor-dur,var(--dropdown-open-dur))_var(--dashboard-tag-editor-ease,var(--dropdown-ease))]',
  'starting:[--dashboard-tag-editor-opacity:0] starting:[--dashboard-tag-editor-transform:translateY(6px)_scale(0.985)] motion-reduce:[transition:none]'
].join(' ')

export const DASHBOARD_TAG_EDITOR_PANEL_CLOSING_STATE_CLASS =
  '[--dashboard-tag-editor-dur:var(--dropdown-close-dur)] [--dashboard-tag-editor-ease:var(--dropdown-ease)] [--dashboard-tag-editor-opacity:0] [--dashboard-tag-editor-transform:translateY(4px)_scale(0.985)]'

export const DASHBOARD_EMPTY_STATE_CLASS =
  't-stagger is-shown col-span-full grid gap-3 rounded-ds-sm border border-ds-border bg-ds-surface-1 p-[18px_16px] text-[13px] leading-[1.7] text-ds-text-muted'

export const DASHBOARD_LOADING_EMPTY_STATE_CLASS =
  `${DASHBOARD_EMPTY_STATE_CLASS} flex items-center justify-center`

export const DASHBOARD_EMPTY_STATE_TITLE_CLASS =
  't-stagger-line t-stagger-line--1 block text-[14px] font-[760] leading-[1.35] text-ds-text-primary'

export const DASHBOARD_EMPTY_STATE_TEXT_CLASS =
  't-stagger-line t-stagger-line--2 m-0 max-w-[680px] text-[13px] leading-[1.65] text-ds-text-muted'

export const DASHBOARD_EMPTY_STATE_SUGGESTIONS_CLASS =
  't-stagger-line t-stagger-line--2 m-0 grid max-w-[760px] list-none gap-1.5 p-0 text-[12px] leading-[1.5] text-ds-text-secondary [&_li]:relative [&_li]:pl-4 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.62em] [&_li]:before:size-1 [&_li]:before:rounded-full [&_li]:before:bg-ds-text-disabled'

export const DASHBOARD_EMPTY_STATE_ACTIONS_CLASS =
  't-stagger-line t-stagger-line--3 flex flex-wrap gap-2'

export const DASHBOARD_EMPTY_STATE_PRIMARY_ACTION_CLASS =
  DASHBOARD_TAG_EDITOR_PRIMARY_BUTTON_CLASS

export const DASHBOARD_EMPTY_STATE_SECONDARY_ACTION_CLASS =
  DASHBOARD_TAG_EDITOR_SECONDARY_BUTTON_CLASS

export const DASHBOARD_DROP_EMPTY_STATE_CLASS =
  `${DASHBOARD_EMPTY_STATE_CLASS} text-center`

export const DASHBOARD_DROP_PANEL_CLASS = [
  'fixed left-1/2 top-[calc(50%_+_58px)] z-[2]',
  'w-[min(1440px,calc(100vw_-_56px))] max-h-[min(calc(100vh_-_150px),820px)] overflow-hidden',
  'rounded-ds-md border border-ds-border bg-ds-surface-2 shadow-none',
  'pointer-events-auto [transform:translate(-50%,-50%)_scale(1)] [transform-origin:center]',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none]',
  'opacity-100 transition-[opacity,transform] duration-ds-standard ease-ds-spring starting:opacity-0 starting:[transform:translate(-50%,-48%)_scale(0.985)] motion-reduce:transition-none',
  'max-[760px]:top-[calc(50%_+_52px)] max-[760px]:w-[calc(100vw_-_28px)] max-[760px]:max-h-[calc(100vh_-_148px)]'
].join(' ')

export const DASHBOARD_DROP_PANEL_CLOSING_STATE_CLASS =
  'opacity-0 [transform:translate(-50%,-48%)_scale(0.985)] duration-ds-fast ease-[cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_FOLDER_DROP_GRID_CLASS =
  'grid [grid-template-columns:repeat(auto-fit,minmax(172px,1fr))] gap-2.5 max-h-[calc(min(calc(100vh_-_150px),820px)_-_72px)] overflow-auto p-3.5 max-[900px]:[grid-template-columns:repeat(auto-fit,minmax(156px,1fr))] max-[760px]:grid-cols-2 max-[760px]:gap-2 max-[760px]:max-h-[calc(100vh_-_220px)] max-[760px]:p-2.5'

export const DASHBOARD_FOLDER_DROP_CARD_CLASS = [
  'grid min-h-[72px] [grid-template-columns:28px_minmax(0,1fr)] gap-[9px]',
  'rounded-ds-sm border border-ds-border bg-ds-surface-2 p-[9px_10px]',
  'cursor-pointer select-none text-left font-[inherit] text-ds-text-secondary shadow-none [-webkit-user-drag:none] [-webkit-user-select:none]',
  '[transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background_var(--ds-motion-standard)_var(--ds-ease-standard),box-shadow_var(--ds-motion-standard)_var(--ds-ease-standard),transform_var(--ds-motion-fast)_var(--ds-ease-standard)]',
  'hover:border-ds-accent-line hover:bg-ds-selected hover:text-ds-accent-text hover:shadow-[0_10px_26px_rgba(0,0,0,0.24)] hover:[transform:translateY(-1px)_scale(1.012)]',
  'focus-visible:border-ds-accent-line focus-visible:bg-ds-selected focus-visible:text-ds-accent-text focus-visible:shadow-[0_10px_26px_rgba(0,0,0,0.24)] focus-visible:[transform:translateY(-1px)_scale(1.012)]',
  '[&[aria-selected=true]]:border-ds-accent-line [&[aria-selected=true]]:bg-ds-selected [&[aria-selected=true]]:text-ds-accent-text',
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
  'overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[730] text-ds-text-primary'

export const DASHBOARD_FOLDER_DROP_PATH_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-ds-text-disabled'

export const DASHBOARD_FOLDER_DROP_META_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[650] text-ds-text-muted'

export const DASHBOARD_DELETE_DROP_TARGET_CLASS = [
  'fixed left-1/2 top-[clamp(18px,4vh,34px)] z-[4]',
  'grid w-[min(760px,calc(100vw_-_48px))] min-h-[76px] [grid-template-columns:42px_minmax(0,1fr)] items-center gap-3',
  'rounded-ds-sm border border-ds-danger/45 bg-ds-danger-soft p-[12px_16px] text-ds-danger-text shadow-none',
  'pointer-events-auto [transform:translateX(-50%)_translateY(0)_scale(1)] [transform-origin:center]',
  '[-webkit-backdrop-filter:none] [backdrop-filter:none]',
  '[transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background_var(--ds-motion-standard)_var(--ds-ease-standard),box-shadow_var(--ds-motion-standard)_var(--ds-ease-standard),color_var(--ds-motion-standard)_var(--ds-ease-standard),opacity_var(--ds-motion-standard)_var(--ds-ease-spring),transform_var(--ds-motion-fast)_var(--ds-ease-standard)]',
  'opacity-100 starting:opacity-0 starting:[transform:translateX(-50%)_translateY(-6px)_scale(0.985)] motion-reduce:transition-none',
  'max-[760px]:top-[18px] max-[760px]:w-[calc(100vw_-_28px)] max-[760px]:min-h-[66px] max-[760px]:[grid-template-columns:38px_minmax(0,1fr)] max-[760px]:p-[10px_12px]'
].join(' ')

export const DASHBOARD_DELETE_DROP_TARGET_ACTIVE_STATE_CLASS =
  '![border-color:var(--ds-danger)] ![background:rgba(226,22,42,0.24)] ![color:var(--ds-text-primary)] ![box-shadow:0_18px_48px_rgba(226,22,42,0.20),0_18px_52px_rgba(0,0,0,0.34)]'

export const DASHBOARD_DELETE_DROP_TARGET_ACTIVE_TRANSFORM_STATE_CLASS =
  '![transform:translateX(-50%)_translateY(-1px)_scale(1.015)]'

export const DASHBOARD_DELETE_DROP_TARGET_MOVING_STATE_CLASS =
  'pointer-events-none opacity-[0.72]'

export const DASHBOARD_DELETE_DROP_TARGET_CLOSING_STATE_CLASS =
  'opacity-0 [transform:translateX(-50%)_translateY(-6px)_scale(0.985)] [transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background_var(--ds-motion-standard)_var(--ds-ease-standard),box-shadow_var(--ds-motion-standard)_var(--ds-ease-standard),color_var(--ds-motion-standard)_var(--ds-ease-standard),opacity_var(--ds-motion-fast)_cubic-bezier(0.4,0,1,1),transform_var(--ds-motion-fast)_cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_DELETE_DROP_ICON_CLASS =
  'relative inline-grid size-10 place-items-center rounded-ds-sm border border-ds-danger/30 bg-ds-danger-soft before:h-[18px] before:w-4 before:rounded-[0_0_4px_4px] before:border-2 before:border-t-0 before:border-current before:opacity-[0.72] before:content-[""] after:absolute after:left-3 after:top-[11px] after:h-0.5 after:w-4 after:rounded-full after:bg-current after:opacity-[0.72] after:shadow-[4px_-4px_0_-1px_currentColor] after:content-[""]'

export const DASHBOARD_DELETE_DROP_COPY_CLASS =
  'flex min-w-0 flex-col gap-[3px]'

export const DASHBOARD_DELETE_DROP_TITLE_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[760] text-ds-danger-text'

export const DASHBOARD_DELETE_DROP_DESCRIPTION_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[650] text-ds-text-muted'

export const DASHBOARD_DRAG_OVERLAY_CLASS = [
  'fixed inset-0 z-[120] block p-7',
  'bg-black/[0.78] [backdrop-filter:none] [-webkit-backdrop-filter:none]',
  'isolate pointer-events-auto select-none [-webkit-user-select:none]',
  'opacity-100 transition-opacity duration-ds-standard ease-ds-standard starting:opacity-0 motion-reduce:transition-none'
].join(' ')

export const DASHBOARD_DRAG_OVERLAY_CLOSING_STATE_CLASS =
  'pointer-events-none opacity-0 duration-ds-fast ease-[cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_DROP_HEAD_CLASS =
  'flex items-start justify-between gap-4 border-b border-white/[0.07] p-[16px_18px_12px] max-[760px]:flex-col'

export const DASHBOARD_DROP_TITLE_CLASS =
  'text-[15px] font-[760] text-ds-text-primary'

export const DASHBOARD_DROP_HINT_CLASS =
  'm-[5px_0_0] text-[12px] leading-[1.5] text-ds-text-disabled'

export const DASHBOARD_DRAG_PREVIEW_CLASS = [
  'fixed left-0 top-0 z-[6] inline-grid max-w-[260px] grid-cols-[38px_minmax(0,180px)] items-center gap-2.5',
  'rounded-ds-sm border border-ds-border bg-ds-surface-2 p-2.5 text-[12px] font-bold leading-[1.35] text-ds-text-primary shadow-none',
  'pointer-events-none select-none [-webkit-user-select:none] opacity-100 transition-opacity duration-ds-fast ease-ds-standard motion-reduce:transition-none [will-change:transform]',
  'starting:opacity-0',
  '[&_img]:[-webkit-user-drag:none]'
].join(' ')

export const DASHBOARD_DRAG_PREVIEW_CLOSING_STATE_CLASS =
  'opacity-0 ease-[cubic-bezier(0.4,0,1,1)]'

export const DASHBOARD_DRAG_PREVIEW_TITLE_CLASS =
  'overflow-hidden text-ellipsis whitespace-nowrap'

export const DASHBOARD_CARD_FOOTER_CLASS =
  'relative z-[1] mt-auto flex min-h-[26px] w-full min-w-0 flex-[0_0_auto] flex-nowrap items-center justify-between gap-1.5 p-0'

export const DASHBOARD_CARD_MORE_CLASS =
  'relative z-[4] ml-auto flex-[0_0_auto]'

export const DASHBOARD_CARD_MORE_MENU_OPEN_STATE_CLASS =
  'z-[60] pointer-events-auto'

export const DASHBOARD_CARD_ICON_ACTION_CLASS = [
  'relative inline-grid size-[26px] min-h-[26px] min-w-[26px] flex-[0_0_26px] place-items-center',
  'rounded-ds-sm border border-ds-border bg-ds-surface-2 p-0 text-ds-text-secondary opacity-[0.82] no-underline shadow-none outline-none',
  'transition-[background,border-color,color,opacity,transform] duration-150 ease-ds-standard',
  '[-webkit-user-drag:none]',
  '[&_svg]:block [&_svg]:size-[15px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.9]',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary hover:opacity-100 hover:no-underline hover:shadow-none',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:opacity-100 focus-visible:shadow-none focus-visible:outline-none',
  'data-[popup-open]:border-ds-border-hover data-[popup-open]:bg-ds-hover data-[popup-open]:text-ds-text-primary data-[popup-open]:opacity-100 data-[popup-open]:shadow-none',
  'active:scale-[0.92] disabled:pointer-events-none disabled:cursor-default disabled:opacity-45 data-disabled:pointer-events-none data-disabled:cursor-default data-disabled:opacity-45'
].join(' ')

export const DASHBOARD_CARD_TOOLTIP_CLASS =
  'z-[140] max-w-[180px] rounded-ds-sm border border-ds-border bg-ds-surface-2 px-[7px] py-[5px] text-[11px] font-[650] leading-[1.2] text-ds-text-primary shadow-none'

export const DASHBOARD_CARD_OPEN_ACTION_CLASS =
  DASHBOARD_CARD_ICON_ACTION_CLASS

export const DASHBOARD_CARD_COPY_ACTION_CLASS =
  DASHBOARD_CARD_ICON_ACTION_CLASS

export const DASHBOARD_CARD_MORE_TRIGGER_CLASS =
  DASHBOARD_CARD_ICON_ACTION_CLASS

export const DASHBOARD_CARD_CHECK_CLASS =
  'absolute right-2.5 top-2.5 z-[3] inline-grid size-[18px] cursor-pointer place-items-center border-0 bg-transparent shadow-none'

export const DASHBOARD_CARD_FAVICON_SHELL_CLASS = [
  'relative inline-grid size-[34px] flex-[0_0_auto] place-items-center overflow-visible border-0 bg-ds-hover',
  'rounded-ds-sm text-[13px] font-extrabold text-ds-accent shadow-none [contain:layout]',
  'transition-[border-color,background-color] duration-ds-standard ease-ds-standard',
  'group-hover/dashboard-card:border-transparent group-hover/dashboard-card:bg-transparent group-hover/dashboard-card:shadow-none',
  'group-focus-within/dashboard-card:border-transparent group-focus-within/dashboard-card:bg-transparent group-focus-within/dashboard-card:shadow-none'
].join(' ')

export const DASHBOARD_CARD_FAVICON_SHELL_SELECTED_STATE_CLASS =
  'border-transparent bg-transparent shadow-none'

export const DASHBOARD_CARD_FAVICON_IMAGE_CLASS = [
  'absolute z-[1] size-[23px] object-contain opacity-100',
  '[filter:none] transition-none [-webkit-user-drag:none]'
].join(' ')

export const DASHBOARD_CARD_FAVICON_IMAGE_SELECTED_STATE_CLASS =
  '[filter:none]'

export const DASHBOARD_CARD_FAVICON_IMAGE_LOADED_STATE_CLASS =
  'opacity-100'

export const DASHBOARD_CARD_FAVICON_FALLBACK_CLASS =
  'relative z-0'

export const DASHBOARD_CARD_BODY_CLASS =
  'relative z-[1] grid min-h-0 min-w-0 grid-cols-[34px_minmax(0,1fr)] items-start gap-2.5 overflow-hidden pr-[46px]'

export const DASHBOARD_CARD_COPY_CLASS =
  'flex min-h-0 min-w-0 flex-col overflow-hidden'

export const DASHBOARD_CARD_TITLE_CLASS =
  'min-w-0 overflow-hidden text-ellipsis text-[13px] font-[730] leading-[1.35] text-ds-text-primary [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]'

export const DASHBOARD_CARD_URL_CLASS = [
  'mt-1 block w-fit max-w-full min-w-0 overflow-hidden bg-transparent px-[3px] py-px font-mono text-[11px] font-semibold leading-[1.35]',
  'text-ds-text-muted no-underline text-ellipsis whitespace-nowrap outline-0',
  '[-webkit-user-drag:none]',
  'transition-[color,background-color,box-shadow] duration-ds-standard ease-ds-standard',
  'hover:bg-ds-hover hover:text-ds-text-primary hover:shadow-none',
  'focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-none'
].join(' ')

export const DASHBOARD_CARD_META_CLASS =
  'mt-[7px] grid max-h-none min-w-0 grid-rows-[14px_20px] gap-[5px] overflow-hidden'

export const DASHBOARD_CARD_PATH_CHIP_CLASS = [
  'block h-auto w-full min-w-0 overflow-hidden border-0 border-t-0 bg-transparent p-0 pt-0 text-left text-[10px] leading-[1.2]',
  'font-mono [font-weight:680] text-ds-text-muted text-ellipsis whitespace-nowrap outline-none',
  '[direction:ltr] [unicode-bidi:plaintext] [line-break:auto] [hanging-punctuation:none] [text-spacing-trim:space-all] [text-autospace:no-autospace]',
  'hover:bg-transparent hover:text-ds-text-secondary focus-visible:bg-transparent focus-visible:text-ds-text-secondary focus-visible:outline-none'
].join(' ')

export const DASHBOARD_CARD_TAG_ROW_CLASS =
  'flex min-w-0 items-center gap-[5px] overflow-hidden'

export const DASHBOARD_CARD_TAG_CHIP_CLASS = [
  'inline-flex h-5 min-h-5 max-w-[min(100%,132px)] min-w-0 flex-[0_1_auto] items-center overflow-hidden rounded-full border border-ds-border',
  'bg-ds-app px-[7px] text-[10px] font-[650] leading-none text-ds-text-muted shadow-none text-ellipsis whitespace-nowrap'
].join(' ')

export const DASHBOARD_CARD_TAG_TOGGLE_CLASS = [
  'inline-flex h-5 min-h-5 max-w-none min-w-0 flex-none cursor-pointer items-center overflow-hidden rounded-full border border-ds-border',
  'bg-ds-surface-2 px-[7px] text-[10px] font-[750] leading-none text-ds-text-secondary shadow-none text-ellipsis whitespace-nowrap outline-none',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline-none'
].join(' ')

export const DASHBOARD_TAG_POPOVER_POSITIONER_CLASS =
  'z-[100] pointer-events-none'

export const DASHBOARD_TAG_POPOVER_CLASS = [
  'z-[100] w-[min(260px,calc(100vw-32px))] max-h-[156px] overflow-auto rounded-ds-md border border-ds-border',
  'pointer-events-auto bg-ds-surface-2 p-2.5 text-ds-text-primary shadow-none outline-none [-webkit-backdrop-filter:none] [backdrop-filter:none]',
  'motion-reduce:transition-none'
].join(' ')

export const DASHBOARD_TAG_POPOVER_TITLE_CLASS =
  'mb-2 block text-[12px] font-[760] leading-normal text-ds-text-primary'

export const DASHBOARD_TAG_POPOVER_LIST_CLASS =
  'flex flex-wrap gap-1.5'

export const DASHBOARD_CARD_MENU_CLASS = [
  'absolute right-0 top-[calc(100%+8px)] bottom-auto z-[100] grid w-[168px] gap-1',
  'rounded-ds-md border border-ds-border bg-ds-surface-2 p-1.5 text-ds-text-primary shadow-none',
  'pointer-events-auto [-webkit-backdrop-filter:none] [backdrop-filter:none]'
].join(' ')

export const DASHBOARD_CARD_MENU_ITEM_CLASS = [
  'grid min-h-[30px] w-full cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-center justify-stretch justify-items-start gap-2',
  'rounded-ds-sm border-0 bg-transparent px-2 py-0 text-left text-xs font-[680] leading-normal text-ds-text-secondary outline-none',
  'transition-colors duration-ds-standard ease-ds-standard',
  '[&_span]:min-w-0 [&_span]:justify-self-start [&_span]:text-left',
  '[&_svg]:block [&_svg]:size-[15px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.9] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]',
  'hover:bg-ds-hover hover:text-ds-text-primary focus-visible:bg-ds-hover focus-visible:text-ds-text-primary data-[highlighted]:bg-ds-hover data-[highlighted]:text-ds-text-primary',
  'disabled:cursor-default disabled:opacity-50 data-disabled:cursor-default data-disabled:opacity-50'
].join(' ')

export const DASHBOARD_CARD_MENU_ITEM_DANGER_CLASS = [
  DASHBOARD_CARD_MENU_ITEM_CLASS,
  'text-ds-danger-text hover:bg-ds-danger-soft hover:text-ds-danger-text focus-visible:bg-ds-danger-soft focus-visible:text-ds-danger-text data-[highlighted]:bg-ds-danger-soft data-[highlighted]:text-ds-danger-text'
].join(' ')

export const DASHBOARD_TAG_EDITOR_STATUS_CLASS =
  'm-[8px_0_0] min-h-[18px] font-[var(--font-sans)] text-[12px] leading-[1.5] tracking-[0] text-ds-text-muted'
