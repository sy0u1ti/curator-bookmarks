import { cx } from '../../ui'

const NEWTAB_PAGE_BASE_CLASS = 'newtab-page relative flex h-full w-full max-w-[1280px] flex-col items-center [--primary-collision-offset-y:0px]'
const NEWTAB_UTILITY_STACK_BASE_CLASS = 'newtab-utility-stack grid w-[min(100%,1229px)] justify-items-center gap-[var(--newtab-utility-gap)]'
const NEWTAB_PRIMARY_SLOT_BASE_CLASS = 'newtab-primary-slot grid min-h-0 w-full grow justify-items-center self-center'
const NEWTAB_PRIMARY_SLOT_START_CLASS = 'items-start'
const NEWTAB_PRIMARY_SLOT_CENTERED_CLASS = 'absolute inset-0 pointer-events-none items-center [align-items:safe_center] [transform:translateY(var(--primary-collision-offset-y))] [&>*]:pointer-events-auto'
const NEWTAB_PRIMARY_SLOT_EMPTY_CLASS = 'items-center [align-items:safe_center] pb-[clamp(28px,9vh,96px)]'
const NEWTAB_CONTENT_VARIABLE_CLASS = '[--icon-page-width:1229px] [--icon-column-gap:24px] [--icon-row-gap:12px] [--icon-folder-gap:20px] [--icon-tile-width:184px] [--icon-shell-size:32px] [--icon-fixed-grid-width:832px] [--icon-columns:4] [--icon-title-lines:1]'
const NEWTAB_CONTENT_BASE_CLASS = `newtab-content grid content-start justify-items-stretch ${NEWTAB_CONTENT_VARIABLE_CLASS}`
const NEWTAB_CONTENT_FLUID_WIDTH_CLASS = 'w-[min(var(--icon-page-width),100%)]'
const NEWTAB_CONTENT_FIXED_WIDTH_CLASS = 'w-[min(max(var(--icon-page-width),var(--icon-fixed-grid-width)),100%)]'
const BOOKMARK_GRID_BASE_CLASS = 'bookmark-grid grid justify-items-stretch gap-x-[var(--icon-column-gap)] gap-y-[var(--icon-row-gap)]'
const BOOKMARK_GRID_FLUID_CLASS = 'w-full grid-cols-[repeat(auto-fill,minmax(min(var(--icon-tile-width),100%),1fr))]'
const BOOKMARK_GRID_FIXED_CLASS = 'w-[min(var(--icon-fixed-grid-width),100%)] justify-self-center grid-cols-[repeat(var(--icon-columns),minmax(0,min(var(--icon-tile-width),100%)))] justify-center'

export const BOOKMARK_FOLDER_SECTIONS_CLASS = 'bookmark-folder-sections grid w-full content-start gap-[var(--icon-folder-gap)]'

export function getNewtabPageClass({
  hasClock,
  hasSearch
}: {
  hasClock: boolean
  hasSearch: boolean
}): string {
  return cx(
    NEWTAB_PAGE_BASE_CLASS,
    hasSearch && 'has-search',
    hasClock && 'has-clock'
  )
}

export function getNewtabUtilityStackClass(hasSearch: boolean): string {
  return cx(
    NEWTAB_UTILITY_STACK_BASE_CLASS,
    hasSearch ? '[--newtab-utility-gap:12px]' : '[--newtab-utility-gap:14px]'
  )
}

export function getNewtabPrimarySlotClass({
  contentState,
  iconVerticalCenter
}: {
  contentState: 'bookmarks' | 'empty'
  iconVerticalCenter: boolean
}): string {
  return cx(
    NEWTAB_PRIMARY_SLOT_BASE_CLASS,
    !iconVerticalCenter && contentState !== 'empty' && NEWTAB_PRIMARY_SLOT_START_CLASS,
    iconVerticalCenter && NEWTAB_PRIMARY_SLOT_CENTERED_CLASS,
    contentState === 'empty' && NEWTAB_PRIMARY_SLOT_EMPTY_CLASS
  )
}

export function getNewtabContentClass({
  hasSearch,
  layoutMode
}: {
  hasSearch: boolean
  layoutMode: string
}): string {
  return cx(
    NEWTAB_CONTENT_BASE_CLASS,
    layoutMode === 'fixed' ? NEWTAB_CONTENT_FIXED_WIDTH_CLASS : NEWTAB_CONTENT_FLUID_WIDTH_CLASS,
    hasSearch && 'mt-2.5'
  )
}

export function getBookmarkGridClass({
  fixedLayout
}: {
  fixedLayout: boolean
}): string {
  return cx(
    BOOKMARK_GRID_BASE_CLASS,
    fixedLayout ? BOOKMARK_GRID_FIXED_CLASS : BOOKMARK_GRID_FLUID_CLASS
  )
}
