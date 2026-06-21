import { cx } from '../../ui/base/utils'

export const SPEED_DIAL_PANEL_CLASS = 'newtab-speed-dial mb-3.5 grid w-full min-w-0 gap-2.5 rounded-lg border border-[var(--ui-divider)] bg-[rgba(15,15,15,0.56)] p-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] [-webkit-backdrop-filter:blur(12px)_saturate(1.12)] [backdrop-filter:blur(12px)_saturate(1.12)]'
export const SPEED_DIAL_HEADING_CLASS = 'newtab-module-heading grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5'
export const SPEED_DIAL_TITLE_CLASS = 'm-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[780] leading-[1.2] text-[rgba(245,245,247,0.9)]'
export const SPEED_DIAL_META_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[580] leading-[1.2] text-[rgba(245,245,247,0.44)] data-[tone=error]:text-[#ffb7b0]'
export const SPEED_DIAL_GRID_CLASS = 'newtab-speed-dial-grid grid min-w-0 grid-cols-[repeat(auto-fill,minmax(180px,1fr))] auto-rows-[minmax(58px,1fr)] gap-[7px]'

const SPEED_DIAL_CARD_REDUCED_MOTION_CLASS =
  'motion-reduce:![animation-duration:1ms] motion-reduce:![transition-duration:1ms] motion-reduce:![transform:none]'
const SPEED_DIAL_CARD_BASE_CLASS = `newtab-speed-dial-card [--bookmark-card-rgb:245_245_247] [--icon-shell-size:34px] [--icon-title-lines:1] grid min-h-[58px] min-w-0 grid-cols-[34px_minmax(0,1fr)] items-center gap-[9px] rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[rgba(21,21,22,0.54)] p-2 text-[rgba(245,245,247,0.86)] no-underline shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] cursor-pointer touch-none select-none [transform:none] [transition:var(--speed-dial-card-transition,border-color_160ms_var(--ui-ease-standard),background-color_160ms_var(--ui-ease-standard),box-shadow_160ms_var(--ui-ease-standard),transform_160ms_var(--ui-ease-standard),opacity_var(--ui-motion-standard)_var(--ui-ease-standard))] [-webkit-backdrop-filter:var(--speed-dial-card-filter,blur(8px)_saturate(1.06))] [backdrop-filter:var(--speed-dial-card-filter,blur(8px)_saturate(1.06))] hover:border-[var(--speed-dial-card-hover-border,rgba(245,245,247,0.16))] hover:bg-[var(--speed-dial-card-hover-bg,rgba(31,32,35,0.62))] hover:shadow-[var(--speed-dial-card-hover-shadow,0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075))] hover:[transform:none] focus-visible:border-[var(--speed-dial-card-hover-border,rgba(245,245,247,0.16))] focus-visible:bg-[var(--speed-dial-card-hover-bg,rgba(31,32,35,0.62))] focus-visible:shadow-[var(--speed-dial-card-hover-shadow,0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075))] focus-visible:outline-none focus-visible:[transform:none] active:[transform:var(--speed-dial-card-active-transform,scale(var(--ui-press-scale)))] ${SPEED_DIAL_CARD_REDUCED_MOTION_CLASS}`
const SPEED_DIAL_CARD_DRAG_RESTING_CLASS = '[--speed-dial-card-active-transform:none] [--speed-dial-card-filter:blur(12px)_saturate(1.12)] [--speed-dial-card-hover-bg:rgba(21,21,22,0.54)] [--speed-dial-card-hover-border:var(--ui-divider)] [--speed-dial-card-hover-shadow:0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] opacity-100 active:border-[var(--ui-divider)] active:bg-[rgba(21,21,22,0.54)] active:shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)]'
const SPEED_DIAL_CARD_DRAG_RESTING_MOTION_CLASS = '[--speed-dial-card-transition:transform_150ms_cubic-bezier(0.22,0.72,0.18,1),opacity_var(--ui-motion-standard)_var(--ui-ease-standard)]'
const SPEED_DIAL_CARD_PREVIEW_INITIALIZING_CLASS = '[--speed-dial-card-transition:none]'
const SPEED_DIAL_CARD_DRAGGING_CLASS = 'dragging cursor-default border-[var(--ui-accent-line)] opacity-100 shadow-[var(--ui-shadow-menu)]'
const SPEED_DIAL_CARD_GHOST_CLASS = 'speed-dial-drag-ghost fixed top-0 left-0 z-[120] pointer-events-none opacity-[0.96] [filter:drop-shadow(0_18px_28px_rgba(0,0,0,0.42))] [transform-origin:0_0] [--speed-dial-card-transition:none] will-change-transform'

export const SPEED_DIAL_MARK_CLASS = 'newtab-speed-dial-mark h-[34px] w-[34px] rounded-lg bg-[rgba(0,0,0,0.34)] text-[14px] font-[840] leading-none text-[rgba(245,245,247,0.9)] [&_.bookmark-fallback]:h-[26px] [&_.bookmark-fallback]:w-[26px] [&_.bookmark-favicon.custom-icon]:h-[26px] [&_.bookmark-favicon.custom-icon]:w-[26px] [&_.bookmark-favicon]:h-[22px] [&_.bookmark-favicon]:w-[22px]'
export const SPEED_DIAL_COPY_CLASS = 'newtab-speed-dial-copy grid min-w-0 gap-[3px]'
export const SPEED_DIAL_COPY_TITLE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-[720] leading-[1.2]'
export const SPEED_DIAL_COPY_DETAIL_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-[560] leading-[1.2] text-[rgba(245,245,247,0.44)]'

export const SPEED_DIAL_EMPTY_CLASS = 'newtab-speed-dial-empty grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--ui-radius-control)] border border-[rgba(245,245,247,0.12)] bg-[rgba(21,21,22,0.54)] p-2 shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] [-webkit-backdrop-filter:blur(8px)_saturate(1.06)] [backdrop-filter:blur(8px)_saturate(1.06)]'
export const SPEED_DIAL_EMPTY_COPY_CLASS = 'newtab-speed-dial-empty-copy grid min-w-0 gap-1'
export const SPEED_DIAL_EMPTY_TITLE_CLASS = 'text-[12px] leading-[1.25] text-[rgba(245,245,247,0.84)]'
export const SPEED_DIAL_EMPTY_DETAIL_CLASS = 'text-[11px] leading-[1.45] text-[rgba(245,245,247,0.44)]'

export function getSpeedDialCardClass({
  dragActive = false,
  dragging = false,
  ghost = false,
  previewInitializing = false
}: {
  dragActive?: boolean
  dragging?: boolean
  ghost?: boolean
  previewInitializing?: boolean
} = {}): string {
  const dragResting = dragActive && !dragging && !ghost

  return cx(
    SPEED_DIAL_CARD_BASE_CLASS,
    dragResting && SPEED_DIAL_CARD_DRAG_RESTING_CLASS,
    previewInitializing
      ? SPEED_DIAL_CARD_PREVIEW_INITIALIZING_CLASS
      : dragResting && SPEED_DIAL_CARD_DRAG_RESTING_MOTION_CLASS,
    dragging && SPEED_DIAL_CARD_DRAGGING_CLASS,
    ghost && SPEED_DIAL_CARD_GHOST_CLASS
  )
}
