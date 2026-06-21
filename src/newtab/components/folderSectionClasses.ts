import { cx } from '../../ui/base/utils'

const FOLDER_SECTION_HEADER_ROW_BASE_CLASS = 'folder-section-header-row inline-flex max-w-[min(560px,100%)] items-center self-start justify-self-start gap-1'
const FOLDER_SECTION_HEADER_ROW_HIDDEN_CLASS = 'opacity-0 [transform:translate3d(0,-4px,0)] group-hover/bookmark-folder-section:opacity-100 group-hover/bookmark-folder-section:[transform:translate3d(0,0,0)] focus-within:opacity-100 focus-within:[transform:translate3d(0,0,0)]'

const FOLDER_SECTION_HEADER_BASE_CLASS = 'folder-section-header inline-flex min-h-6 w-max max-w-[min(520px,100%)] touch-none select-none items-center justify-start justify-self-start gap-2 rounded-[var(--ui-radius-control)] border border-transparent bg-transparent px-[9px] py-[3px] text-left leading-normal text-[rgba(245,245,247,0.64)] cursor-default [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard)] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(245,245,247,0.26)]'
const FOLDER_SECTION_HEADER_DRAGGING_CLASS = 'dragging border-[rgba(245,245,247,0.12)] bg-[rgba(245,245,247,0.055)] text-[var(--ui-text-primary)]'
const FOLDER_SECTION_HEADER_GHOST_CLASS = 'folder-drag-ghost fixed top-0 left-0 z-[120] pointer-events-none opacity-[0.96] [filter:drop-shadow(0_14px_24px_rgba(0,0,0,0.4))] [transform-origin:0_0] [transition:none] will-change-transform'

export const FOLDER_SECTION_TITLE_CLASS = 'folder-section-title min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-[650] leading-[1.2]'
export const FOLDER_SECTION_COUNT_CLASS = 'folder-section-count inline-grid h-[17px] min-w-5 place-items-center rounded-[var(--ui-radius-pill)] bg-[var(--ui-surface-selected)] text-[10px] font-bold leading-none text-[var(--ui-accent-text)]'

export function getFolderSectionHeaderRowClass({
  forceVisible = false,
  hideNames = false
}: {
  forceVisible?: boolean
  hideNames?: boolean
} = {}): string {
  return cx(
    FOLDER_SECTION_HEADER_ROW_BASE_CLASS,
    hideNames && !forceVisible && FOLDER_SECTION_HEADER_ROW_HIDDEN_CLASS
  )
}

export function getFolderSectionHeaderClass({
  dragging = false,
  ghost = false
}: {
  dragging?: boolean
  ghost?: boolean
} = {}): string {
  return cx(
    FOLDER_SECTION_HEADER_BASE_CLASS,
    dragging && FOLDER_SECTION_HEADER_DRAGGING_CLASS,
    ghost && FOLDER_SECTION_HEADER_GHOST_CLASS
  )
}
