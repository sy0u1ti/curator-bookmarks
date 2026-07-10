import { cx } from '../../ui/base/utils'

const BOOKMARK_TILE_REDUCED_MOTION_CLASS =
  'motion-reduce:![animation-duration:1ms] motion-reduce:![transition-duration:1ms] motion-reduce:![transform:none]'
const BOOKMARK_TILE_BASE_CLASS = `bookmark-tile group/bookmark-tile [--bookmark-card-rgb:245_245_247] [--bookmark-card-bg-alpha:0.3] [--bookmark-card-border-alpha:0] [--bookmark-card-hover-alpha:0.4] grid w-full items-center justify-self-stretch rounded-[var(--ui-radius-control)] border border-transparent bg-[rgba(21,21,22,0.54)] text-left leading-normal text-[var(--ui-text-primary)] no-underline shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] outline-none cursor-pointer touch-none select-none [transform:none] [transition:var(--bookmark-tile-transition,border-color_160ms_var(--ui-ease-standard),background-color_160ms_var(--ui-ease-standard),box-shadow_160ms_var(--ui-ease-standard),transform_160ms_var(--ui-ease-standard),opacity_var(--ui-motion-standard)_var(--ui-ease-standard))] [-webkit-backdrop-filter:blur(12px)_saturate(1.12)] [backdrop-filter:blur(12px)_saturate(1.12)] focus-visible:outline-none active:bg-[var(--bookmark-tile-active-bg,rgba(36,37,41,0.66))] active:shadow-[0_14px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.075)] active:duration-[60ms] active:[-webkit-backdrop-filter:blur(12px)_saturate(1.12)] active:[backdrop-filter:blur(12px)_saturate(1.12)] ${BOOKMARK_TILE_REDUCED_MOTION_CLASS}`
const BOOKMARK_TILE_WITH_TITLE_CLASS = 'min-h-[calc(var(--icon-shell-size)+18px)] grid-cols-[var(--icon-shell-size)_minmax(0,1fr)] justify-start gap-2.5 px-2.5 py-2'
const BOOKMARK_TILE_ICON_ONLY_CLASS = 'min-h-[calc(var(--icon-shell-size)+16px)] grid-cols-[var(--icon-shell-size)] justify-center gap-0 p-2'
const BOOKMARK_TILE_DRAG_RESTING_CLASS = 'curator-motion-disabled [--bookmark-icon-active-bg:rgba(0,0,0,0.34)] [--bookmark-icon-active-border:rgb(var(--bookmark-card-rgb)/0.12)] [--bookmark-icon-transition:none] [--bookmark-tile-active-bg:rgba(21,21,22,0.54)] opacity-100'
const BOOKMARK_TILE_DRAG_RESTING_MOTION_CLASS = '[--bookmark-tile-transition:transform_150ms_cubic-bezier(0.22,0.72,0.18,1),opacity_var(--ui-motion-standard)_var(--ui-ease-standard)]'
const BOOKMARK_TILE_PREVIEW_INITIALIZING_CLASS = '[--bookmark-tile-transition:none]'
const BOOKMARK_TILE_DRAGGING_CLASS = 'dragging cursor-default border-[var(--ui-accent-line)] opacity-100 shadow-[var(--ui-shadow-menu)]'
const BOOKMARK_TILE_GHOST_CLASS = 'bookmark-drag-ghost fixed top-0 left-0 z-[120] pointer-events-none opacity-100 [filter:drop-shadow(0_18px_28px_rgba(0,0,0,0.42))] [transform-origin:0_0] [--bookmark-tile-transition:none] will-change-transform'

const BOOKMARK_TITLE_CLASS = 'bookmark-title w-full overflow-hidden text-[12px] font-[620] leading-[1.25] text-[rgba(245,245,247,0.78)] [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:var(--icon-title-lines)]'

export function getBookmarkTileClass({
  dragActive = false,
  dragging = false,
  ghost = false,
  previewInitializing = false,
  showTitles
}: {
  dragActive?: boolean
  dragging?: boolean
  ghost?: boolean
  previewInitializing?: boolean
  showTitles: boolean
}): string {
  const dragResting = dragActive && !dragging && !ghost

  return cx(
    BOOKMARK_TILE_BASE_CLASS,
    showTitles ? BOOKMARK_TILE_WITH_TITLE_CLASS : BOOKMARK_TILE_ICON_ONLY_CLASS,
    dragResting && BOOKMARK_TILE_DRAG_RESTING_CLASS,
    previewInitializing
      ? BOOKMARK_TILE_PREVIEW_INITIALIZING_CLASS
      : dragResting && BOOKMARK_TILE_DRAG_RESTING_MOTION_CLASS,
    dragging && BOOKMARK_TILE_DRAGGING_CLASS,
    ghost && BOOKMARK_TILE_GHOST_CLASS
  )
}

export function getBookmarkTitleClass(): string {
  return BOOKMARK_TITLE_CLASS
}
