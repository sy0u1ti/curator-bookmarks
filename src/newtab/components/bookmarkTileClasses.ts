import { cx } from '../../ui/base/utils'

const BOOKMARK_TILE_REDUCED_MOTION_CLASS =
  'motion-reduce:![animation-duration:1ms] motion-reduce:![transition-duration:1ms] motion-reduce:![transform:none]'
const BOOKMARK_TILE_BASE_CLASS = `bookmark-tile group/bookmark-tile relative grid w-full items-center justify-self-stretch rounded-[var(--ui-radius-group)] border border-transparent bg-[rgba(21,21,22,0.64)] text-left leading-normal text-[var(--ui-text-primary)] no-underline shadow-[0_1px_2px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.075)] outline-none cursor-pointer touch-pan-y select-none [transform:none] [transition:var(--bookmark-tile-transition,border-color_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard),box-shadow_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard),opacity_var(--ui-motion-standard)_var(--ui-ease-standard))] focus-visible:outline-none active:bg-[var(--bookmark-tile-active-bg,rgba(36,37,41,0.72))] active:shadow-[0_1px_2px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.075)] active:duration-[var(--ds-motion-feedback)] ${BOOKMARK_TILE_REDUCED_MOTION_CLASS}`
const BOOKMARK_TILE_WITH_TITLE_CLASS = 'min-h-[calc(var(--icon-shell-size)+18px)] grid-cols-[var(--icon-shell-size)_minmax(0,1fr)] justify-start gap-2 px-2.5 py-2'
const BOOKMARK_TILE_ICON_ONLY_CLASS = 'min-h-[calc(var(--icon-shell-size)+16px)] grid-cols-[var(--icon-shell-size)] justify-center gap-0 p-2'
const BOOKMARK_TILE_DRAG_RESTING_CLASS = 'curator-motion-disabled [--bookmark-icon-active-bg:rgba(0,0,0,0.34)] [--bookmark-icon-active-border:rgba(245,245,247,0.14)] [--bookmark-icon-transition:none] [--bookmark-tile-active-bg:rgba(21,21,22,0.54)] opacity-100'
const BOOKMARK_TILE_DRAG_RESTING_MOTION_CLASS = '[--bookmark-tile-transition:transform_var(--drag-settle-dur)_var(--ease-smooth-out),opacity_var(--ui-motion-standard)_var(--ui-ease-standard)]'
const BOOKMARK_TILE_PREVIEW_INITIALIZING_CLASS = '[--bookmark-tile-transition:none]'
const BOOKMARK_TILE_DRAGGING_CLASS = 'dragging cursor-default border-[var(--ui-accent-line)] opacity-100 shadow-[var(--ui-shadow-menu)]'
const BOOKMARK_TILE_GHOST_CLASS = 'bookmark-drag-ghost fixed top-0 left-0 z-[120] pointer-events-none opacity-100 [filter:drop-shadow(0_18px_28px_rgba(0,0,0,0.42))] [transform-origin:0_0] [--bookmark-tile-transition:none] will-change-transform'

const BOOKMARK_TITLE_CLASS = 'bookmark-title w-full overflow-hidden text-[13px] font-[520] leading-[1.3] text-[rgba(245,245,247,0.8)] [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:var(--icon-title-lines)]'
export const BOOKMARK_DRAG_HANDLE_CLASS = 'bookmark-drag-handle absolute top-1/2 right-0.5 z-[2] hidden h-10 w-10 -translate-y-1/2 touch-none items-center justify-center rounded-[var(--ui-radius-control)] text-[rgba(245,245,247,0.5)] transition-colors duration-[var(--ds-motion-feedback)] [@media(pointer:coarse)]:inline-flex active:bg-[rgba(245,245,247,0.1)] active:text-[var(--ui-text-primary)] data-[drag-pending=true]:bg-[rgba(245,245,247,0.12)] data-[drag-pending=true]:text-[var(--ui-text-primary)]'

// 导航模式的文件夹卡片 = 书签卡片同款玻璃底 + 文件夹图标外壳 + 计数徽标。
// 展开模式的文件夹拖拽 ghost 也复用这两个类，让两种模式的文件夹拖拽观感统一。
// 卡片有三个子元素（图标/标题/计数），在 tile 的双列模板上覆盖为三列。
export const BOOKMARK_FOLDER_CARD_GRID_CLASS = '!grid-cols-[var(--icon-shell-size)_minmax(0,1fr)_auto]'
export const BOOKMARK_FOLDER_CARD_ICON_CLASS = 'bookmark-folder-card-icon relative grid h-[var(--icon-shell-size)] w-[var(--icon-shell-size)] place-items-center rounded-[var(--ui-radius-control)] border border-[rgba(245,245,247,0.14)] bg-[rgba(0,0,0,0.28)] text-[rgba(245,245,247,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]'
export const BOOKMARK_FOLDER_CARD_COUNT_CLASS = 'bookmark-folder-card-count ml-auto inline-grid h-[17px] min-w-5 place-items-center rounded-[var(--ui-radius-pill)] bg-[var(--ui-surface-selected)] px-1 text-[10px] font-bold leading-none text-[var(--ui-accent-text)]'

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
