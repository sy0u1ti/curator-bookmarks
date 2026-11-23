import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../ui/base/Button'
import { ErrorState } from '../../ui/base/ErrorState'
import { OptionActionsMenu, type OptionMenuAction } from '../../ui/base/OptionActionsMenu'
import { StatusButton } from '../../ui/actions/StatusButton'
import { COPY_ACTION_LABELS } from '../../ui/actions/ActionFeedback'
import { IDLE_ACTION_FEEDBACK } from '../../shared/action-feedback'
import { Input } from '../../ui/base/Input'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { cx } from '../../ui/base/utils'
import { getMotionDurationMs, prefersReducedMotion } from '../../shared/motion'
import { HighlightedText } from '../../ui/base/HighlightedText'
import { PopupEmptyState } from './PopupEmptyState'
import { PopupScrollToTop } from './PopupScrollToTop'
import { getPopupVirtualRange, getPopupHeldRange, includePopupVirtualSelection, POPUP_VIRTUAL_OVERSCAN } from '../popup-virtual-window'
import {
  subscribeNoPopupNavigation,
  usePopupNavigationStore,
  usePopupRowNavigation
} from '../popup-navigation-view-store'
import { getPopupBookmarkReorderTargetIndex } from '../popup-bookmark-reorder'
import {
  getPopupBookmarkDomain,
  getPopupFolderLabel,
  POPUP_BOOKMARK_ROW_HEIGHT
} from '../popup-row-presentation'
import { POPUP_FOLDER_FILTER_INPUT_ID } from '../popup-folder-filter'
import {
  POPUP_FOLDER_SORT_OPTIONS,
  type PopupFolderSortMode
} from '../popup-folder-management'
import { isPopupContentNavigationKey } from '../popup-keyboard-navigation'
import { getPopupSearchGridAria, getPopupSearchResultId } from '../popup-workspace-state'
import { usePopupChromeView } from '../popup-controller-store'
import { isOptionsSurface, isSidePanelSurface } from '../../shared/extension-surfaces'
import {
  folderBranchClass,
  folderCardActiveClass,
  folderCardClass,
  folderCountActiveClass,
  folderCountClass,
  folderMainClass,
  folderRowClass,
  folderTitleClass,
  getFolderDepthStyle
} from './popup-folder-tree-styles'
import type {
  PopupActionMenuViewModel,
  PopupContentBookmarkRowViewModel,
  PopupContentFolderRowViewModel,
  PopupContentMainRowViewModel,
  PopupContentSearchResultViewModel,
  PopupContentViewModel,
  PopupFolderManagementViewModel,
  PopupSelectionViewModel
} from './PopupViewModels'

export interface PopupContentActionHandlers {
  onBookmarkLocateFolder?: (bookmarkId: string) => void
  onBookmarkOpen?: (bookmarkId: string) => void
  onBookmarkSelectFromContext?: (bookmarkId: string) => void
  onBookmarkSwipeSelect?: (
    startBookmarkId: string,
    endBookmarkId: string,
    targetSelected: boolean,
    baseSelectedIds: string[]
  ) => void
  onBookmarkToggleSelect?: (bookmarkId: string, shiftKey?: boolean) => void
  onBatchDeleteSelected?: () => void
  onBatchMoveSelected?: (returnFocusElement?: HTMLElement | null) => void
  onClearSelection?: () => void
  onEmptyAction?: (action: string) => void
  onFolderCreate?: (folderId: string, returnFocusElement?: HTMLElement | null) => void
  onFolderDelete?: (folderId: string, returnFocusElement?: HTMLElement | null) => void
  onFolderFilterApply?: () => void
  onFolderFilterChange?: (value: string) => void
  onFolderFilterClear?: () => void
  onFolderFilterEscape?: () => void
  onFolderFilterMove?: (delta: number, exitOnEmpty?: boolean, repeat?: boolean) => void
  onFolderFilter?: (folderId: string) => void
  onFolderFocus?: (index: number) => void
  onFolderMove?: (folderId: string, returnFocusElement?: HTMLElement | null) => void
  onFolderRename?: (folderId: string, returnFocusElement?: HTMLElement | null) => void
  onFolderSort?: (folderId: string, sortMode: PopupFolderSortMode) => void
  onKeyboardNavigate?: (key: string, repeat?: boolean) => boolean
  onMenuAction?: (bookmarkId: string, action: string, returnFocusElement?: HTMLElement | null) => void
  onBookmarkReorder?: (bookmarkId: string, index: number) => void
  onReorderModeChange?: (active: boolean) => void
  onRowFocus?: (index: number) => void
  onResultHover?: (index: number) => void
  onSelectionModeChange?: (active: boolean) => void
  onToggleSelectAll?: () => void
}

const POPUP_CONTENT_SKELETON_FOLDER_ROWS = [
  { depth: 0, width: 0.44, count: 0.24 },
  { depth: 1, width: 0.52, count: 0.22 },
  { depth: 2, width: 0.62, count: 0.2 },
  { depth: 2, width: 0.48, count: 0.18 },
  { depth: 2, width: 0.56, count: 0.16 },
  { depth: 2, width: 0.42, count: 0.2 },
  { depth: 2, width: 0.66, count: 0.16 },
  { depth: 2, width: 0.46, count: 0.18 },
  { depth: 2, width: 0.54, count: 0.22 },
  { depth: 1, width: 0.64, count: 0.2 },
  { depth: 1, width: 0.48, count: 0.18 }
] as const

const POPUP_CONTENT_SKELETON_BOOKMARK_ROWS = [
  { title: '116px', url: '176px' },
  { title: '154px', url: '208px' },
  { title: '98px', url: '156px' },
  { title: '168px', url: '196px' },
  { title: '128px', url: '164px' },
  { title: '146px', url: '188px' },
  { title: '112px', url: '152px' }
] as const
const POPUP_CONTENT_SKELETON_ACTION_COUNT = 5

const workspaceShellClass =
  't-skel popup-t-skel popup-workspace-reveal relative h-full min-h-0'
const workspaceLayerClass = 'absolute inset-0 min-h-0'
const workspaceBackdropLayerClass = cx(
  workspaceLayerClass,
  'popup-workspace-backdrop pointer-events-none z-0 [contain:layout_paint]'
)
const workspaceSkeletonLayerClass = cx(
  workspaceLayerClass,
  't-skel-skeleton pointer-events-none z-[1] [contain:layout_paint]'
)
const workspaceContentLayerClass = cx(
  workspaceLayerClass,
  't-skel-content z-[2] [contain:layout_paint]'
)
const workspaceContentLoadingClass = 'pointer-events-none'
const workspaceClass =
  'popup-workspace relative grid h-full min-h-0 grid-cols-[221px_minmax(0,1fr)] gap-2 @max-[620px]/popup:grid-cols-[minmax(0,1fr)] @max-[620px]/popup:grid-rows-[minmax(108px,36%)_minmax(0,1fr)]'
const workspacePlaceholderClass = 'pointer-events-none'
const paneClass =
  'popup-surface flex min-h-0 min-w-0 flex-col overflow-hidden border-0 bg-ds-surface-1'
const mainPaneClass = cx(paneClass, 'popup-main-pane relative bg-ds-surface-1')
const paneHeaderClass =
  'flex h-[42px] min-h-[42px] flex-none items-center justify-between gap-2 border-b border-ds-border px-[11px] text-xs font-semibold text-ds-text-primary'
const paneHeaderTitleClass = 'min-w-0 truncate'
const paneTitleMetaClass = 'font-medium text-ds-text-muted'
const paneCaptionClass = 'ml-auto min-w-0 truncate text-right font-medium text-ds-text-secondary'
const paneHeaderActionsClass = 'popup-pane-header-actions inline-flex flex-none items-center'
const paneHeaderActionClass = [
  'inline-flex h-7 flex-none items-center gap-1.5 rounded-ds-sm border border-transparent bg-transparent px-2 text-xs font-semibold text-ds-text-secondary outline-none',
  'transition-[border-color,background-color,color,scale,opacity] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:scale-[var(--ds-press-scale)] disabled:cursor-default disabled:opacity-40'
].join(' ')
const paneHeaderActionActiveClass =
  'border-ds-accent/45 bg-ds-accent-soft text-ds-accent-text hover:border-ds-accent/65 hover:bg-ds-accent-soft hover:text-ds-accent-text'
const paneHeaderIconActionClass = [
  'inline-flex h-7 w-7 flex-none items-center justify-center rounded-ds-sm border border-transparent bg-transparent p-0 text-ds-text-secondary outline-none',
  'transition-[border-color,background-color,color,scale,opacity] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:scale-[var(--ds-press-scale)] disabled:cursor-default disabled:opacity-40'
].join(' ')
const folderPaneHeaderClass = cx(paneHeaderClass, 'gap-1.5 px-[10px]')
const folderTreeClass =
  'popup-folder-tree ds-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2 [scrollbar-gutter:stable]'
const mainListClass =
  'popup-main-list ds-scrollbar relative m-0 min-h-0 flex-1 list-none overflow-x-hidden overflow-y-auto p-2 [scrollbar-gutter:stable]'
// The filter lives in the existing 42px pane header, so it adds no height and
// no new pane. Geometry matches the folder rows' 34px rhythm, not the 40px
// main search shell, which would make the header grow.
const folderFilterShellClass = [
  'popup-folder-filter group/filter relative flex h-7 min-h-7 w-full min-w-0 items-center gap-1 rounded-ds-sm border border-transparent bg-ds-text-primary/[0.055] ds-inset-menu pl-1.5 pr-1.5 data-[has-value=true]:pr-6 text-ds-text-primary',
  'shadow-[0_0_0_3px_transparent] transition-[background-color,border-color] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border hover:bg-ds-text-primary/[0.085]',
  'focus-within:border-ds-border-hover focus-within:bg-ds-text-primary/[0.085] focus-within:shadow-[0_0_0_3px_var(--ds-accent-soft)]'
].join(' ')
const folderFilterIconClass =
  'pointer-events-none flex-none text-ds-text-muted transition-colors duration-ds-fast ease-ds-standard group-focus-within/filter:text-ds-text-secondary'
const folderFilterInputClass =
  'min-w-0 flex-auto self-stretch border-0 bg-transparent px-0 py-0 text-xs font-medium leading-[1.3] text-ds-text-primary outline-none placeholder:font-normal placeholder:text-ds-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden [&::-webkit-search-decoration]:appearance-none'
const folderFilterClearClass = [
  'absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 flex-none items-center justify-center rounded-ds-xs border-0 bg-transparent p-0 text-ds-text-muted outline-none',
  'transition-[background-color,color,opacity,scale,visibility] [transition-behavior:allow-discrete] duration-ds-fast ease-ds-standard',
  'hover:bg-ds-active hover:text-ds-text-primary focus-visible:bg-ds-active focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:scale-[var(--ds-press-scale)]',
  'data-[visible=false]:invisible data-[visible=false]:pointer-events-none data-[visible=false]:opacity-0 data-[visible=false]:scale-95 motion-reduce:data-[visible=false]:scale-100'
].join(' ')
const folderFilterEmptyClass =
  'grid place-items-center rounded-ds-sm px-3 py-6 text-center text-xs leading-[1.55] text-ds-text-muted'
const mainRowClass =
  'popup-main-row relative z-[1] grid min-h-[var(--popup-bookmark-row-height)] grid-cols-[minmax(0,1fr)] items-center border-t border-ds-border-subtle py-1'
const virtualSpacerClass = 'pointer-events-none block w-full'
const POPUP_FOLDER_ROW_HEIGHT = 34
const POPUP_VIRTUALIZATION_THRESHOLD = 24
const activeResultIndicatorClass = 'popup-active-result-indicator'
const folderCardDimmedClass = 'opacity-55 hover:opacity-100 focus-visible:opacity-100'
const rootFolderBranchClass =
  'relative inline-grid h-2 w-2 flex-none place-items-center justify-self-center rounded-full border border-white/35 bg-transparent'
const listButtonClass = [
  'popup-list-button flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-ds-sm border border-transparent bg-transparent text-left text-ds-text-primary outline-none',
  'transition-[border-color,background-color,color,scale] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1 active:scale-[0.993]'
].join(' ')
const listButtonBaseStyle: CSSProperties = {
  padding: '6px var(--popup-row-copy-rest-inset) 6px calc(var(--popup-row-label-inset) - var(--ds-stroke-width))'
}
const rowMainClass = 'popup-row-copy grid w-full min-w-0 gap-0.5'
const rowTitleClass =
  'min-w-0 truncate text-left text-[13px] font-semibold leading-tight text-ds-text-primary'
const rowSubtitleClass =
  'min-w-0 truncate text-left text-xs font-medium leading-tight text-ds-text-muted'
const rowMetadataClass = 'flex min-w-0 items-center gap-1.5 text-xs font-medium leading-tight text-ds-text-muted'
const rowDomainClass = 'min-w-0 truncate'
const rowFolderClass = 'min-w-0 max-w-[50%] truncate'
const resultCopyClass = 'popup-row-copy grid w-full min-w-0 gap-0.5'
const resultMatchReasonsClass = 'min-w-0 truncate text-xs font-medium leading-[14px] text-ds-text-secondary'
const rowActionsClass = 'popup-row-actions'
const rowActionRailClass = 'popup-row-actions-menu'
const rowActionButtonClass = [
  'inline-flex h-7 w-7 flex-none items-center justify-center rounded-ds-sm border-0 bg-ds-surface-3 text-ds-text-primary outline-none',
  'transition-[background-color,color,scale,opacity] duration-ds-fast ease-ds-standard',
  'hover:bg-ds-active hover:text-ds-accent-hover focus-visible:bg-ds-active focus-visible:text-ds-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:scale-[var(--ds-press-scale)] disabled:cursor-default disabled:opacity-45'
].join(' ')
const rowActionTriggerClass = cx(rowActionButtonClass, 'popup-row-actions-trigger')
const rowActionDangerClass =
  'hover:bg-ds-danger-soft hover:text-ds-danger-text focus-visible:bg-ds-danger-soft focus-visible:text-ds-danger-text'
const rowReorderHandleClass = [
  'popup-bookmark-reorder-handle absolute right-[7px] top-1/2 z-[3] inline-flex h-10 w-10 -translate-y-1/2 touch-none select-none items-center justify-center rounded-ds-sm border border-transparent bg-transparent text-ds-text-muted outline-none',
  'transition-[border-color,background-color,color,opacity] duration-ds-fast ease-ds-standard',
  'cursor-grab hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-1',
  'active:cursor-grabbing disabled:cursor-default disabled:opacity-40'
].join(' ')
const compactStateClass =
  'grid min-h-[90px] place-items-center px-4 py-3 text-center text-xs leading-[1.55] text-ds-text-muted'
const mainStateClass = cx(compactStateClass, 'min-h-full p-[18px]')
const skeletonBarBaseClass =
  'popup-skeleton-pulse rounded-full bg-[rgba(255,255,255,0.065)]'
const skeletonBarClass = cx(
  skeletonBarBaseClass,
  'block h-[9px] w-[calc(var(--skeleton-width,0.7)*100%)]'
)
const skeletonTextBarClass = cx(skeletonBarBaseClass, 'block max-w-full')
const skeletonDotClass =
  'popup-skeleton-pulse block h-7 w-7 rounded-ds-sm bg-[rgba(255,255,255,0.055)]'
const skeletonFolderTitleClass = cx(skeletonBarClass, 'min-w-[54px]')
const skeletonFolderCountClass =
  cx(skeletonBarClass, 'max-w-[30px] min-w-4 justify-self-end')
const skeletonHeaderMetaClass = cx(skeletonBarBaseClass, 'inline-block h-[8px] w-[64px] align-[0.5px]')
const skeletonBookmarkTitleClass = cx(skeletonTextBarClass, 'h-[10px]')
const skeletonBookmarkUrlClass = cx(skeletonTextBarClass, 'h-[7px] opacity-75')
const skeletonFolderBranchPlaceholderClass = 'inline-block h-2.5 w-2.5 flex-none'
const skeletonBookmarkTitleLineClass = cx(rowTitleClass, 'flex h-4 items-center')
const skeletonBookmarkSubtitleLineClass = cx(rowSubtitleClass, 'flex h-[15px] items-center')
const skeletonActionButtonClass = skeletonDotClass
const searchSkeletonClass = 'grid w-[min(100%,390px)] gap-3 self-stretch'
const searchSkeletonRowClass = 'grid gap-2 rounded-ds-sm bg-ds-text-primary/[0.018] px-[9px] py-2'
const POPUP_REORDER_MOUSE_THRESHOLD_PX = 6
const POPUP_REORDER_TOUCH_CANCEL_THRESHOLD_PX = 10
const POPUP_REORDER_LONG_PRESS_MS = 320
const POPUP_REORDER_AUTO_SCROLL_EDGE_PX = 36
const POPUP_REORDER_AUTO_SCROLL_MAX_PX = 13

function getBookmarkButtonStyle(): CSSProperties {
  return listButtonBaseStyle
}

interface PopupBookmarkReorderRowProps {
  busy: boolean
  dragging: boolean
  pending: boolean
  shiftY: number
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

interface PopupBookmarkDragSession {
  bookmarkId: string
  clientX: number
  clientY: number
  displayUrl: string
  handle: HTMLButtonElement
  height: number
  offsetX: number
  offsetY: number
  path: string
  phase: 'pending' | 'dragging'
  pointerId: number
  pointerType: string
  rowLeft: number
  sourceIndex: number
  startX: number
  startY: number
  targetIndex: number
  title: string
  width: number
}

interface PopupBookmarkDragView {
  bookmarkId: string
  displayUrl: string
  height: number
  left: number
  path: string
  phase: 'pending' | 'dragging' | 'settling'
  sourceIndex: number
  targetIndex: number
  title: string
  width: number
  top: number
}

function usePopupBookmarkReorderDrag({
  active,
  busy,
  mainListRef,
  onCommit,
  rowCount
}: {
  active: boolean
  busy: boolean
  mainListRef?: RefObject<HTMLDivElement | null>
  onCommit?: (bookmarkId: string, index: number) => void
  rowCount: number
}) {
  const sessionRef = useRef<PopupBookmarkDragSession | null>(null)
  const longPressTimerRef = useRef(0)
  const autoScrollFrameRef = useRef(0)
  const settleTimerRef = useRef(0)
  const [view, setView] = useState<PopupBookmarkDragView | null>(null)

  const stopAutoScroll = useCallback(() => {
    window.cancelAnimationFrame(autoScrollFrameRef.current)
    autoScrollFrameRef.current = 0
  }, [])

  const releasePointer = useCallback((session: PopupBookmarkDragSession | null) => {
    if (!session) return
    try {
      if (session.handle.hasPointerCapture(session.pointerId)) {
        session.handle.releasePointerCapture(session.pointerId)
      }
    } catch {
      // The pointer may already be released when the popup loses focus.
    }
  }, [])

  const clearSession = useCallback((clearView = true) => {
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = 0
    window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = 0
    stopAutoScroll()
    releasePointer(sessionRef.current)
    sessionRef.current = null
    if (clearView) {
      setView(null)
    }
  }, [releasePointer, stopAutoScroll])

  const resolveTargetIndex = useCallback((pointerY: number, sourceIndex: number): number => {
    const list = mainListRef?.current
    if (!list) return sourceIndex
    const rect = list.getBoundingClientRect()
    const paddingTop = Number.parseFloat(window.getComputedStyle(list).paddingTop) || 0
    return getPopupBookmarkReorderTargetIndex({
      containerTop: rect.top,
      paddingTop,
      pointerY,
      rowCount,
      rowHeight: POPUP_BOOKMARK_ROW_HEIGHT,
      scrollTop: list.scrollTop,
      sourceIndex
    })
  }, [mainListRef, rowCount])

  const toDragView = useCallback((session: PopupBookmarkDragSession): PopupBookmarkDragView => ({
    bookmarkId: session.bookmarkId,
    displayUrl: session.displayUrl,
    height: session.height,
    left: session.clientX - session.offsetX,
    path: session.path,
    phase: session.phase,
    sourceIndex: session.sourceIndex,
    targetIndex: session.targetIndex,
    title: session.title,
    top: session.clientY - session.offsetY,
    width: session.width
  }), [])

  const scheduleAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current) return

    const tick = () => {
      const session = sessionRef.current
      const list = mainListRef?.current
      if (!session || session.phase !== 'dragging' || !list) {
        autoScrollFrameRef.current = 0
        return
      }

      const rect = list.getBoundingClientRect()
      const distanceFromTop = session.clientY - rect.top
      const distanceFromBottom = rect.bottom - session.clientY
      let velocity = 0
      if (distanceFromTop < POPUP_REORDER_AUTO_SCROLL_EDGE_PX) {
        const intensity = 1 - Math.max(0, distanceFromTop) / POPUP_REORDER_AUTO_SCROLL_EDGE_PX
        velocity = -Math.ceil(POPUP_REORDER_AUTO_SCROLL_MAX_PX * intensity)
      } else if (distanceFromBottom < POPUP_REORDER_AUTO_SCROLL_EDGE_PX) {
        const intensity = 1 - Math.max(0, distanceFromBottom) / POPUP_REORDER_AUTO_SCROLL_EDGE_PX
        velocity = Math.ceil(POPUP_REORDER_AUTO_SCROLL_MAX_PX * intensity)
      }

      if (velocity) {
        const previousScrollTop = list.scrollTop
        list.scrollTop = Math.max(0, Math.min(
          previousScrollTop + velocity,
          Math.max(0, list.scrollHeight - list.clientHeight)
        ))
        if (list.scrollTop !== previousScrollTop) {
          session.targetIndex = resolveTargetIndex(session.clientY, session.sourceIndex)
          setView(toDragView(session))
        }
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(tick)
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(tick)
  }, [mainListRef, resolveTargetIndex, toDragView])

  const beginDrag = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.phase === 'dragging') return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = 0
    session.phase = 'dragging'
    session.targetIndex = resolveTargetIndex(session.clientY, session.sourceIndex)
    try {
      session.handle.setPointerCapture(session.pointerId)
    } catch {
      // Synthetic pointers and released touch contacts may not be capturable.
    }
    setView(toDragView(session))
    scheduleAutoScroll()
  }, [resolveTargetIndex, scheduleAutoScroll, toDragView])

  const cancelDrag = useCallback(() => {
    clearSession(true)
  }, [clearSession])

  const settleDrag = useCallback((session: PopupBookmarkDragSession) => {
    const list = mainListRef?.current
    const listRect = list?.getBoundingClientRect()
    const listStyle = list ? window.getComputedStyle(list) : null
    const paddingTop = Number.parseFloat(listStyle?.paddingTop || '') || 0
    const paddingLeft = Number.parseFloat(listStyle?.paddingLeft || '') || 0
    const targetLeft = listRect ? listRect.left + paddingLeft : session.rowLeft
    const targetTop = listRect && list
      ? listRect.top + paddingTop + session.targetIndex * POPUP_BOOKMARK_ROW_HEIGHT - list.scrollTop
      : session.clientY - session.offsetY

    releasePointer(session)
    stopAutoScroll()
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = 0
    sessionRef.current = null
    setView({
      ...toDragView(session),
      left: targetLeft,
      phase: 'settling',
      top: targetTop
    })

    if (session.targetIndex !== session.sourceIndex) {
      onCommit?.(session.bookmarkId, session.targetIndex)
    }

    const settleDuration = prefersReducedMotion()
      ? 1
      : getMotionDurationMs('--drag-settle-dur', 160)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = 0
      setView(null)
    }, settleDuration)
  }, [mainListRef, onCommit, releasePointer, stopAutoScroll, toDragView])

  const dragListenersActive = view?.phase === 'pending' || view?.phase === 'dragging'

  useLayoutEffect(() => {
    if (!dragListenersActive) return
    const handlePointerMove = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return
      session.clientX = event.clientX
      session.clientY = event.clientY

      if (session.phase === 'pending') {
        const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)
        if (session.pointerType === 'mouse') {
          if (distance < POPUP_REORDER_MOUSE_THRESHOLD_PX) return
          beginDrag()
        } else {
          if (distance >= POPUP_REORDER_TOUCH_CANCEL_THRESHOLD_PX) {
            cancelDrag()
          }
          return
        }
      }

      const activeSession = sessionRef.current
      if (!activeSession || activeSession.phase !== 'dragging') return
      event.preventDefault()
      activeSession.targetIndex = resolveTargetIndex(event.clientY, activeSession.sourceIndex)
      setView(toDragView(activeSession))
    }

    const handlePointerUp = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return
      if (session.phase === 'dragging') {
        event.preventDefault()
        session.clientX = event.clientX
        session.clientY = event.clientY
        session.targetIndex = resolveTargetIndex(event.clientY, session.sourceIndex)
        settleDrag(session)
        return
      }
      cancelDrag()
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (sessionRef.current?.pointerId === event.pointerId) {
        cancelDrag()
      }
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && sessionRef.current) {
        event.preventDefault()
        event.stopPropagation()
        cancelDrag()
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp, { passive: false })
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [beginDrag, cancelDrag, dragListenersActive, resolveTargetIndex, settleDrag, toDragView])

  useEffect(() => {
    if (!active || (busy && sessionRef.current)) {
      cancelDrag()
    }
  }, [active, busy, cancelDrag])

  useEffect(() => {
    return () => {
      window.clearTimeout(longPressTimerRef.current)
      window.clearTimeout(settleTimerRef.current)
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      releasePointer(sessionRef.current)
      sessionRef.current = null
    }
  }, [releasePointer])

  const startDrag = useCallback((
    row: PopupContentBookmarkRowViewModel,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!active || busy || rowCount < 2 || (event.pointerType === 'mouse' && event.button !== 0)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    clearSession(true)

    const rowElement = event.currentTarget.closest<HTMLElement>('.popup-main-row')
    if (!rowElement) return
    const rect = rowElement.getBoundingClientRect()
    event.currentTarget.focus({ preventScroll: true })
    const session: PopupBookmarkDragSession = {
      bookmarkId: row.bookmarkId,
      clientX: event.clientX,
      clientY: event.clientY,
      displayUrl: getPopupBookmarkDomain(row.url, row.displayUrl),
      handle: event.currentTarget,
      height: rect.height || POPUP_BOOKMARK_ROW_HEIGHT,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      path: row.path || '',
      phase: 'pending',
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      rowLeft: rect.left,
      sourceIndex: row.index,
      startX: event.clientX,
      startY: event.clientY,
      targetIndex: row.index,
      title: row.title,
      width: rect.width
    }
    sessionRef.current = session
    setView(toDragView(session))

    if (event.pointerType !== 'mouse') {
      longPressTimerRef.current = window.setTimeout(() => {
        beginDrag()
      }, POPUP_REORDER_LONG_PRESS_MS)
    }
  }, [active, beginDrag, busy, clearSession, rowCount, toDragView])

  const getRowProps = useCallback((row: PopupContentBookmarkRowViewModel): PopupBookmarkReorderRowProps => {
    let shiftY = 0
    if (view?.phase === 'dragging') {
      if (view.targetIndex < view.sourceIndex && row.index >= view.targetIndex && row.index < view.sourceIndex) {
        shiftY = POPUP_BOOKMARK_ROW_HEIGHT
      } else if (view.targetIndex > view.sourceIndex && row.index > view.sourceIndex && row.index <= view.targetIndex) {
        shiftY = -POPUP_BOOKMARK_ROW_HEIGHT
      }
    }

    return {
      busy,
      dragging: view?.phase === 'dragging' && view.bookmarkId === row.bookmarkId,
      pending: view?.phase === 'pending' && view.bookmarkId === row.bookmarkId,
      shiftY,
      onKeyDown: (event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        if (!busy) {
          onCommit?.(row.bookmarkId, row.index + (event.key === 'ArrowUp' ? -1 : 1))
        }
      },
      onPointerDown: (event) => startDrag(row, event)
    }
  }, [busy, onCommit, startDrag, view])

  const ghost = view && view.phase !== 'pending' && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="popup-bookmark-drag-ghost"
          data-settling={view.phase === 'settling' ? 'true' : undefined}
          aria-hidden="true"
          style={{
            height: `${view.height}px`,
            transform: `translate3d(${view.left}px, ${view.top}px, 0)`,
            width: `${view.width}px`
          }}
        >
          <span className={rowMainClass}>
            <span className={rowTitleClass}>{view.title}</span>
            <span className={rowSubtitleClass}>{view.displayUrl}</span>
          </span>
          <Icon name="GripVertical" size={16} aria-hidden="true" />
        </div>,
        document.body
      )
    : null

  return {
    dragging: view?.phase === 'dragging',
    getRowProps,
    ghost
  }
}

const POPUP_SWIPE_SELECT_THRESHOLD_PX = 6
const POPUP_SWIPE_AUTO_SCROLL_TOP_EDGE_PX = 44
const POPUP_SWIPE_AUTO_SCROLL_BOTTOM_EDGE_PX = 76
const POPUP_SWIPE_AUTO_SCROLL_MAX_PX = 16

interface PopupBookmarkSwipeSelectSession {
  activated: boolean
  baseSelectedIds: string[]
  clientY: number
  hasAutoScrolled: boolean
  lastIndex: number
  pointerId: number
  pointerType: string
  startBookmarkId: string
  startIndex: number
  startY: number
  startedInBottomEdge: boolean
  startedInTopEdge: boolean
  targetSelected: boolean
}

function resolveSwipeSelectRowIndex(
  list: HTMLElement,
  rows: readonly PopupContentMainRowViewModel[],
  clientY: number
): number {
  if (!rows.length) {
    return -1
  }
  const rect = list.getBoundingClientRect()
  const paddingTop = Number.parseFloat(window.getComputedStyle(list).paddingTop || '') || 0
  const clampedClientY = Math.max(rect.top + paddingTop, Math.min(rect.bottom - 1, clientY))
  const contentY = Math.max(0, list.scrollTop + (clampedClientY - rect.top) - paddingTop)
  if (rows[0]?.kind === 'bookmark') {
    return Math.max(0, Math.min(rows.length - 1, Math.floor(contentY / POPUP_BOOKMARK_ROW_HEIGHT)))
  }
  let offset = 0
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowHeight = row.kind === 'result' ? row.presentation.rowHeight : POPUP_BOOKMARK_ROW_HEIGHT
    if (contentY < offset + rowHeight) {
      return index
    }
    offset += rowHeight
  }
  return rows.length - 1
}

function usePopupBookmarkSwipeSelect({
  active,
  busy,
  mainListRef,
  onSwipeSelect,
  rows
}: {
  active: boolean
  busy: boolean
  mainListRef?: RefObject<HTMLDivElement | null>
  onSwipeSelect?: PopupContentActionHandlers['onBookmarkSwipeSelect']
  rows: readonly PopupContentMainRowViewModel[]
}) {
  const sessionRef = useRef<PopupBookmarkSwipeSelectSession | null>(null)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const onSwipeSelectRef = useRef(onSwipeSelect)
  onSwipeSelectRef.current = onSwipeSelect
  const autoScrollFrameRef = useRef(0)
  const suppressClickCleanupRef = useRef<(() => void) | null>(null)
  const [listening, setListening] = useState(false)
  const [swiping, setSwiping] = useState(false)

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = 0
    }
  }, [])

  const armSuppressTrailingClick = useCallback(() => {
    suppressClickCleanupRef.current?.()
    let timerId = 0
    const cleanup = () => {
      window.removeEventListener('click', handleClickCapture, true)
      if (timerId) {
        window.clearTimeout(timerId)
        timerId = 0
      }
      if (suppressClickCleanupRef.current === cleanup) {
        suppressClickCleanupRef.current = null
      }
    }
    const handleClickCapture = (clickEvent: MouseEvent) => {
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      cleanup()
    }
    window.addEventListener('click', handleClickCapture, true)
    timerId = window.setTimeout(cleanup, 0)
    suppressClickCleanupRef.current = cleanup
  }, [])

  const applyAtClientY = useCallback((session: PopupBookmarkSwipeSelectSession, clientY: number) => {
    const list = mainListRef?.current
    const currentRows = rowsRef.current
    if (!list || !currentRows.length) {
      return
    }
    const hoveredIndex = resolveSwipeSelectRowIndex(list, currentRows, clientY)
    if (hoveredIndex < 0) {
      return
    }
    const targetRow = currentRows[hoveredIndex]
    if (!targetRow) {
      return
    }
    if (!session.activated) {
      const movedEnough = hoveredIndex !== session.startIndex || Math.abs(clientY - session.startY) >= POPUP_SWIPE_SELECT_THRESHOLD_PX
      if (!movedEnough) {
        return
      }
      session.activated = true
      session.lastIndex = hoveredIndex
      setSwiping(true)
      onSwipeSelectRef.current?.(
        session.startBookmarkId,
        targetRow.bookmarkId,
        session.targetSelected,
        session.baseSelectedIds
      )
      return
    }
    if (hoveredIndex !== session.lastIndex) {
      session.lastIndex = hoveredIndex
      onSwipeSelectRef.current?.(
        session.startBookmarkId,
        targetRow.bookmarkId,
        session.targetSelected,
        session.baseSelectedIds
      )
    }
  }, [mainListRef])

  const scheduleAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current) {
      return
    }
    const tick = () => {
      const session = sessionRef.current
      const list = mainListRef?.current
      if (!session || !session.activated || !list) {
        autoScrollFrameRef.current = 0
        return
      }
      const rect = list.getBoundingClientRect()
      const distanceFromTop = session.clientY - rect.top
      const distanceFromBottom = rect.bottom - session.clientY
      let velocity = 0
      const blockTopScroll = session.startedInTopEdge && session.clientY > session.startY && !session.hasAutoScrolled
      const blockBottomScroll = session.startedInBottomEdge && session.clientY < session.startY && !session.hasAutoScrolled
      if (distanceFromTop < POPUP_SWIPE_AUTO_SCROLL_TOP_EDGE_PX && !blockTopScroll) {
        const intensity = 1 - Math.max(0, distanceFromTop) / POPUP_SWIPE_AUTO_SCROLL_TOP_EDGE_PX
        velocity = -Math.ceil(POPUP_SWIPE_AUTO_SCROLL_MAX_PX * intensity)
      } else if (distanceFromBottom < POPUP_SWIPE_AUTO_SCROLL_BOTTOM_EDGE_PX && !blockBottomScroll) {
        const intensity = 1 - Math.max(0, distanceFromBottom) / POPUP_SWIPE_AUTO_SCROLL_BOTTOM_EDGE_PX
        velocity = Math.ceil(POPUP_SWIPE_AUTO_SCROLL_MAX_PX * intensity)
      }
      if (velocity) {
        const previousScrollTop = list.scrollTop
        const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight)
        list.scrollTop = Math.max(0, Math.min(previousScrollTop + velocity, maxScrollTop))
        if (list.scrollTop !== previousScrollTop) {
          session.hasAutoScrolled = true
          applyAtClientY(session, session.clientY)
        }
      }
      autoScrollFrameRef.current = window.requestAnimationFrame(tick)
    }
    autoScrollFrameRef.current = window.requestAnimationFrame(tick)
  }, [applyAtClientY, mainListRef])

  const endSession = useCallback((suppressClick: boolean) => {
    stopAutoScroll()
    sessionRef.current = null
    setListening(false)
    setSwiping(false)
    if (suppressClick) {
      armSuppressTrailingClick()
    }
  }, [armSuppressTrailingClick, stopAutoScroll])

  useEffect(() => {
    if (!active || busy) {
      if (sessionRef.current) {
        endSession(false)
      }
    }
  }, [active, busy, endSession])

  useEffect(() => () => {
    stopAutoScroll()
    suppressClickCleanupRef.current?.()
  }, [stopAutoScroll])

  useLayoutEffect(() => {
    if (!listening) {
      return
    }
    const handlePointerMove = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) {
        return
      }
      if (session.pointerType === 'mouse' && (event.buttons & 1) === 0) {
        endSession(session.activated)
        return
      }
      session.clientY = event.clientY
      const wasActivated = session.activated
      applyAtClientY(session, event.clientY)
      if (session.activated) {
        event.preventDefault()
        if (!wasActivated) {
          scheduleAutoScroll()
        }
      }
    }
    const handlePointerUp = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) {
        return
      }
      if (session.activated) {
        event.preventDefault()
        applyAtClientY(session, event.clientY)
        endSession(true)
        return
      }
      endSession(false)
    }
    const handlePointerCancel = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) {
        return
      }
      endSession(session.activated)
    }
    const handleWindowBlur = () => {
      const session = sessionRef.current
      if (!session) {
        return
      }
      endSession(session.activated)
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [applyAtClientY, endSession, listening, scheduleAutoScroll])

  const onListPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || busy || event.button !== 0) {
      return
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }
    const target = event.target instanceof HTMLElement ? event.target : null
    if (!target) {
      return
    }
    if (event.pointerType === 'touch' && !target.closest('.popup-row-checkbox')) {
      return
    }
    const rowElement = target.closest<HTMLElement>('[data-bookmark-id][data-popup-row-index]')
    if (!rowElement) {
      return
    }
    const startIndex = Number(rowElement.dataset.popupRowIndex)
    const startBookmarkId = rowElement.dataset.bookmarkId || ''
    const currentRows = rowsRef.current
    if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= currentRows.length) {
      return
    }
    const startRow = currentRows[startIndex]
    if (!startRow || startRow.bookmarkId !== startBookmarkId) {
      return
    }
    const baseSelectedIds = currentRows
      .filter((row) => Boolean(row.selected))
      .map((row) => row.bookmarkId)
    const listRect = mainListRef?.current?.getBoundingClientRect()
    sessionRef.current = {
      activated: false,
      baseSelectedIds,
      clientY: event.clientY,
      hasAutoScrolled: false,
      lastIndex: startIndex,
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'mouse',
      startBookmarkId,
      startIndex,
      startY: event.clientY,
      startedInBottomEdge: Boolean(listRect && listRect.bottom - event.clientY < POPUP_SWIPE_AUTO_SCROLL_BOTTOM_EDGE_PX),
      startedInTopEdge: Boolean(listRect && event.clientY - listRect.top < POPUP_SWIPE_AUTO_SCROLL_TOP_EDGE_PX),
      targetSelected: !startRow.selected
    }
    setListening(true)
  }, [active, busy, mainListRef])

  return {
    onListPointerDown,
    swiping
  }
}

function PopupFolderPane({
  activeIndex,
  filter,
  folderManagement,
  folderTreeRef,
  handlers,
  children
}: {
  activeIndex: number
  filter?: PopupContentViewModel['folderFilter']
  folderManagement?: PopupFolderManagementViewModel
  folderTreeRef?: RefObject<HTMLDivElement | null>
  handlers?: PopupContentActionHandlers
  children: ReactNode
}) {
  const sidePanel = isSidePanelSurface()
  const [collapsed, setCollapsed] = useState(() => sidePanel)
  const navigation = usePopupNavigationStore()
  const getClosedSelection = useCallback(() => collapsed && navigation
    ? (navigation.getSnapshot().state.activeFolderIndex ?? -1) : -1, [collapsed, navigation])
  useSyncExternalStore(navigation?.subscribe || subscribeNoPopupNavigation, getClosedSelection, getClosedSelection)
  const currentIndex = navigation?.getSnapshot().state.activeFolderIndex ?? activeIndex
  const previousActiveIndexRef = useRef(activeIndex)
  const suppressAutoOpenRef = useRef(false)
  const filterQuery = filter?.query || ''
  useLayoutEffect(() => {
    if (suppressAutoOpenRef.current) {
      suppressAutoOpenRef.current = false
      previousActiveIndexRef.current = currentIndex
      return
    }
    // Only navigation into a closed tree opens it. Publishing false on every
    // repeat creates redundant commits even though the tree is already open.
    if (previousActiveIndexRef.current !== currentIndex && currentIndex >= 0 && collapsed) setCollapsed(false)
    previousActiveIndexRef.current = currentIndex
  }, [currentIndex, collapsed])
  useLayoutEffect(() => {
    if (sidePanel && collapsed && filterQuery) {
      setCollapsed(false)
    }
  }, [sidePanel, collapsed, filterQuery])
  return (
    <aside className={paneClass} aria-label="文件夹树" onKeyDownCapture={event => {
      if (collapsed && !event.altKey && !event.ctrlKey && !event.metaKey &&
        (event.key === 'ArrowDown' || event.key === 'ArrowUp')) setCollapsed(false)
    }}>
      <header className={folderPaneHeaderClass}>
        {sidePanel ? (
          <Button
            className={cx(
              '-ml-1 inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-ds-sm px-2 text-left font-[inherit] outline-none transition-[background-color,color] duration-ds-fast ease-ds-standard focus-visible:shadow-ds-focus',
              collapsed
                ? 'bg-transparent text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary'
                : 'bg-ds-active text-ds-text-primary'
            )}
            aria-label={collapsed ? '展开文件夹列表' : '收起文件夹列表'}
            aria-expanded={!collapsed}
            aria-controls="sidepanel-folder-tree"
            onClick={() => {
              previousActiveIndexRef.current = navigation?.getSnapshot().state.activeFolderIndex ?? activeIndex
              setCollapsed(value => !value)
            }}
            unstyled
          >
            <Icon name={collapsed ? 'Folder' : 'FolderOpen'} size={14} className="shrink-0" aria-hidden="true" />
            <span>文件夹</span>
          </Button>
        ) : <span className="shrink-0">全部文件夹</span>}
        <PopupFolderFilterField filter={filter} handlers={handlers} />
        <Button
          id="popup-create-folder-button"
          className={paneHeaderIconActionClass}
          type="button"
          aria-label="新建文件夹"
          title="在当前目录新建文件夹"
          disabled={!folderManagement?.canCreate}
          onClick={(event) => handlers?.onFolderCreate?.(folderManagement?.folderId || '', event.currentTarget)}
          unstyled
        >
          <Icon name="FolderPlus" size={14} aria-hidden="true" />
        </Button>
        {/* The tree may only contain treeitems, so the result count is
            announced from the header instead of from inside the list. */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {filter?.query ? `${filter.resultCount} 个匹配文件夹` : ''}
        </span>
      </header>
      <div className={folderTreeClass} role="tree" ref={folderTreeRef}
        id={sidePanel ? 'sidepanel-folder-tree' : undefined} hidden={sidePanel && collapsed}
        inert={sidePanel && collapsed}
        onClickCapture={(event) => {
          if (!sidePanel || collapsed || event.detail === 0) return
          const target = event.target instanceof HTMLElement ? event.target : null
          if (target?.closest('button[role="treeitem"]')) {
            suppressAutoOpenRef.current = true
            setCollapsed(true)
          }
        }}>
        {children}
      </div>
    </aside>
  )
}

function PopupFolderFilterField({
  filter,
  handlers
}: {
  filter?: PopupContentViewModel['folderFilter']
  handlers?: PopupContentActionHandlers
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const query = filter?.query || ''
  const focusRequestId = filter?.focusRequestId || 0

  useEffect(() => {
    if (!focusRequestId) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) {
        return
      }
      input.focus({ preventScroll: true })
      if (filter?.focusSelect) {
        input.select()
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [filter?.focusSelect, focusRequestId])

  if (!filter) {
    return null
  }

  return (
    <label
      className={folderFilterShellClass}
      data-has-value={filter.clearVisible ? 'true' : 'false'}
      htmlFor={POPUP_FOLDER_FILTER_INPUT_ID}
    >
      <Icon name="Search" className={folderFilterIconClass} size={13} aria-hidden="true" />
      <Input
        ref={inputRef}
        id={POPUP_FOLDER_FILTER_INPUT_ID}
        className={folderFilterInputClass}
        type="text"
        role="searchbox"
        spellCheck={false}
        autoComplete="off"
        placeholder={filter.placeholder}
        aria-label={filter.ariaLabel}
        aria-keyshortcuts="Control+F Meta+F"
        value={query}
        onValueChange={(nextValue) => handlers?.onFolderFilterChange?.(nextValue)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            handlers?.onFolderFilterEscape?.()
            return
          }
          // The field keeps focus while the tree highlight moves, so a query can
          // be corrected without leaving the input. Enter applies the highlight.
          // With no query, the field hands the key back to the tree so focus can
          // leave an empty search box immediately.
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            event.stopPropagation()
            handlers?.onFolderFilterMove?.(event.key === 'ArrowDown' ? 1 : -1, !query, event.repeat)
            return
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            handlers?.onFolderFilterApply?.()
          }
        }}
        unstyled
      />
      <Button
        className={folderFilterClearClass}
        data-visible={filter.clearVisible ? 'true' : 'false'}
        type="button"
        aria-label="清除文件夹筛选"
        aria-hidden={!filter.clearVisible}
        tabIndex={filter.clearVisible ? undefined : -1}
        onClick={() => handlers?.onFolderFilterClear?.()}
        unstyled
      >
        <Icon name="X" size={12} aria-hidden="true" />
      </Button>
    </label>
  )
}

// Transient notices and in-flight search state share the pane header with the
// title instead of reserving a separate row that is empty most of the time.
function PaneCaption() {
  const { viewCaption } = usePopupChromeView()
  return (
    <span id="view-caption" className={paneCaptionClass} role="status" aria-live="polite" title={viewCaption || undefined}>
      {viewCaption}
    </span>
  )
}

export function PopupContent({
  activeResultIndicatorRef,
  activeResultRef,
  activeFolderRef,
  folderTreeRef,
  workspaceRef,
  handlers,
  mainListRef,
  onRowsLayout,
  revealActiveRow = true,
  heldDirection = 0,
  state
}: {
  activeResultIndicatorRef?: RefObject<HTMLDivElement | null>
  activeResultRef?: RefObject<HTMLLIElement | null>
  activeFolderRef?: RefObject<HTMLDivElement | null>
  folderTreeRef?: RefObject<HTMLDivElement | null>
  workspaceRef?: RefObject<HTMLDivElement | null>
  handlers?: PopupContentActionHandlers
  mainListRef?: RefObject<HTMLDivElement | null>
  onRowsLayout?: () => void
  revealActiveRow?: boolean
  heldDirection?: -1 | 0 | 1
  state: PopupContentViewModel
}) {
  const navigation = usePopupNavigationStore()
  const selection = navigation?.getSnapshot().state
  const sidebarRows = state.sidebarRows || state.rows.filter((row): row is PopupContentFolderRowViewModel => row.kind === 'folder')
  const mainRows = state.mainRows || state.rows.filter((row): row is PopupContentMainRowViewModel => row.kind !== 'folder')
  const mode = state.mode || (mainRows.some((row) => row.kind === 'result') ? 'search' : 'tree')
  const title = state.title || (mode === 'search' ? '搜索结果' : '全部书签')
  const meta = state.meta || `${mainRows.length} 条`
  const isLoading = Boolean(state.loading)
  const workspaceReveal = useDecoupledWorkspaceReveal(isLoading)
  const scrollLayerRef = usePopupScrollLayer(isLoading)
  const reorderActive = Boolean(state.reorder?.active && mode === 'tree')
  const multiSelect = state.selection
  const multiSelectActive = Boolean(multiSelect?.active && !reorderActive)
  const folderManagement = state.folderManagement
  const [folderContextMenu, setFolderContextMenu] = useState<PopupFolderContextMenuState | null>(null)
  const [bookmarkContextMenu, setBookmarkContextMenu] = useState<PopupBookmarkContextMenuState | null>(null)
  const openFolderContextMenu = useCallback((
    row: PopupContentFolderRowViewModel,
    clientX: number,
    clientY: number,
    triggerElement: HTMLElement | null
  ) => {
    setBookmarkContextMenu(null)
    setFolderContextMenu({
      canManage: Boolean(row.canManage),
      folderId: row.folderId,
      isRootAll: Boolean(row.root),
      title: row.title,
      triggerElement,
      x: clientX,
      y: clientY
    })
  }, [])
  const closeFolderContextMenu = useCallback((restoreFocus = false) => {
    setFolderContextMenu((current) => {
      if (restoreFocus && current?.triggerElement?.isConnected) {
        window.requestAnimationFrame(() => current.triggerElement?.focus({ preventScroll: true }))
      }
      return null
    })
  }, [])
  const openBookmarkContextMenu = useCallback((
    row: PopupContentMainRowViewModel,
    clientX: number,
    clientY: number,
    triggerElement: HTMLElement | null
  ) => {
    setFolderContextMenu(null)
    setBookmarkContextMenu({
      bookmarkId: row.bookmarkId,
      isSearch: row.kind === 'result',
      parentId: String(row.parentId || ''),
      selected: Boolean(row.selected),
      title: row.title,
      triggerElement,
      x: clientX,
      y: clientY
    })
  }, [])
  const closeBookmarkContextMenu = useCallback((restoreFocus = false) => {
    setBookmarkContextMenu((current) => {
      if (restoreFocus && current?.triggerElement?.isConnected) {
        window.requestAnimationFrame(() => current.triggerElement?.focus({ preventScroll: true }))
      }
      return null
    })
  }, [])
  const folderSortMenuActions = useMemo<OptionMenuAction[]>(() => {
    if (!folderManagement) return []
    return POPUP_FOLDER_SORT_OPTIONS.map((option) => ({
      id: `sort-${option.mode}`,
      label: option.label,
      disabled: folderManagement.sortBusy || !folderManagement.canSort,
      onSelect: () => handlers?.onFolderSort?.(folderManagement.folderId, option.mode)
    }))
  }, [folderManagement, handlers])
  const folderManageMenuActions = useMemo<OptionMenuAction[]>(() => {
    if (!folderManagement) return []
    const resolveTrigger = () => document.getElementById('popup-folder-actions-menu')
    const actions: OptionMenuAction[] = [
      {
        id: 'folder-create',
        label: '新建子文件夹',
        icon: 'FolderPlus',
        disabled: !folderManagement.canCreate,
        onSelect: () => handlers?.onFolderCreate?.(folderManagement.folderId, resolveTrigger())
      }
    ]
    if (folderManagement.canManage) {
      actions.push(
        {
          id: 'folder-rename',
          label: '重命名文件夹',
          icon: 'Pencil',
          onSelect: () => handlers?.onFolderRename?.(folderManagement.folderId, resolveTrigger())
        },
        {
          id: 'folder-move',
          label: '移动文件夹…',
          icon: 'Move',
          onSelect: () => handlers?.onFolderMove?.(folderManagement.folderId, resolveTrigger())
        },
        {
          id: 'folder-delete',
          label: '删除文件夹',
          icon: 'Trash2',
          danger: true,
          separatorBefore: true,
          onSelect: () => handlers?.onFolderDelete?.(folderManagement.folderId, resolveTrigger())
        }
      )
    }
    return actions
  }, [folderManagement, handlers])
  const reorderDrag = usePopupBookmarkReorderDrag({
    active: reorderActive,
    busy: Boolean(state.reorder?.busy),
    mainListRef,
    onCommit: handlers?.onBookmarkReorder,
    rowCount: mainRows.length
  })
  const swipeSelect = usePopupBookmarkSwipeSelect({
    active: multiSelectActive && !reorderActive && !state.mainState,
    busy: Boolean(multiSelect?.busy),
    mainListRef,
    onSwipeSelect: handlers?.onBookmarkSwipeSelect,
    rows: mainRows
  })
  const activeMainIndex = selection?.activeResultIndex ?? state.activeResultIndex ?? mainRows.findIndex((row) => row.active)
  const activeFolderIndex = selection?.activeFolderIndex ?? state.activeFolderIndex ?? sidebarRows.findIndex((row) => row.keyboardActive)
  const mainWindowed = mode === 'tree' && !state.mainState && mainRows.length > POPUP_VIRTUALIZATION_THRESHOLD
  const foldersWindowed = sidebarRows.length > POPUP_VIRTUALIZATION_THRESHOLD
  const mainWindow = useFixedRowWindow({
    pane: 'bookmarks',
    activeIndex: activeMainIndex,
    revealVersion: state,
    revealActiveRow,
    heldDirection: state.keyboardPane === 'folders' ? 0 : heldDirection,
    containerRef: mainListRef,
    enabled: mainWindowed,
    rowCount: mainRows.length,
    rowHeight: POPUP_BOOKMARK_ROW_HEIGHT
  })
  const folderWindow = useFixedRowWindow({
    pane: 'folders',
    activeIndex: activeFolderIndex,
    revealVersion: state,
    revealActiveRow,
    heldDirection: state.keyboardPane === 'folders' ? heldDirection : 0,
    containerRef: folderTreeRef,
    enabled: foldersWindowed,
    rowCount: sidebarRows.length,
    rowHeight: POPUP_FOLDER_ROW_HEIGHT
  })
  const visibleSidebarRows = useMemo(() => sidebarRows.slice(folderWindow.start, folderWindow.end).map(row =>
    navigation || Boolean(row.keyboardActive) === (row.index === activeFolderIndex) ? row : { ...row, keyboardActive: row.index === activeFolderIndex }),
  [activeFolderIndex, folderWindow.end, folderWindow.start, navigation, sidebarRows])
  const visibleMainRows = useMemo(() => mainRows.slice(mainWindow.start, mainWindow.end).map(row =>
    navigation || Boolean(row.active) === (row.index === activeMainIndex) ? row : { ...row, active: row.index === activeMainIndex }),
  [activeMainIndex, mainRows, mainWindow.end, mainWindow.start, navigation])

  useLayoutEffect(() => {
    // Scroll listeners run before a virtual window commits. Reconnect the
    // indicator to a selected row that has just returned to the mounted window.
    onRowsLayout?.()
  }, [folderWindow.end, folderWindow.start, mainWindow.end, mainWindow.start, onRowsLayout])

  return (
    <div
      className={cx(workspaceShellClass, workspaceReveal.revealed ? 'is-revealed' : '')}
      data-state={isLoading ? 'loading' : 'ready'}
      style={{ '--popup-bookmark-row-height': `${POPUP_BOOKMARK_ROW_HEIGHT}px` } as CSSProperties}
      ref={scrollLayerRef}
      aria-busy={isLoading ? 'true' : 'false'}
      data-squircle-subtree="off"
    >
      <div className={workspaceSkeletonLayerClass} aria-hidden="true">
        <MemoPopupContentSkeleton mode={mode} title={title} />
      </div>
      <div className={cx(workspaceContentLayerClass, isLoading ? workspaceContentLoadingClass : '')}>
        <div className={workspaceClass} ref={workspaceRef}
          style={{ '--sidepanel-folder-height': `${58 + sidebarRows.length * POPUP_FOLDER_ROW_HEIGHT}px` } as CSSProperties}>
          <PopupFolderPane
            activeIndex={activeFolderIndex}
            filter={state.folderFilter}
            folderManagement={folderManagement}
            folderTreeRef={folderTreeRef}
            handlers={handlers}
          >
              {folderWindow.before > 0 ? (
                <div
                  className={virtualSpacerClass}
                  style={{ height: `${folderWindow.before}px` }}
                  role="presentation"
                  aria-hidden="true"
                />
              ) : null}
              <div className="popup-row-layer" role="presentation">
              {visibleSidebarRows.map((row) => (
                <MemoPopupFolderRow
                  activeFolderRef={activeFolderRef}
                  handlers={handlers}
                  onContextMenu={openFolderContextMenu}
                  onFolderFilter={handlers?.onFolderFilter}
                  row={row}
                  key={`folder:${row.folderId}`}
                />
              ))}
              </div>
              {folderWindow.after > 0 ? (
                <div
                  className={virtualSpacerClass}
                  style={{ height: `${folderWindow.after}px` }}
                  role="presentation"
                  aria-hidden="true"
                />
              ) : null}
              {/* role=tree may only contain treeitems, so the visual empty
                  message is hidden from the accessibility tree; the header's
                  live region announces the same result to screen readers. */}
              {state.folderFilter?.query && state.folderFilter.resultCount === 0 ? (
                <div className={folderFilterEmptyClass} data-folder-filter-empty="" role="presentation" aria-hidden="true">未找到文件夹</div>
              ) : null}
          </PopupFolderPane>
          <section
            className={mainPaneClass}
            aria-label={title}
            data-reorder-mode={reorderActive ? 'true' : undefined}
            data-reorder-dragging={reorderDrag.dragging ? 'true' : undefined}
            data-selection-mode={multiSelectActive ? 'true' : undefined}
            data-swipe-selecting={swipeSelect.swiping ? 'true' : undefined}
          >
            <header className={paneHeaderClass}>
              <span className={paneHeaderTitleClass} title={`${title} · ${meta}`}>
                {title} <span className={paneTitleMetaClass}>· <span className="t-number-value">{meta}</span></span>
              </span>
              <PaneCaption />
              <div className={paneHeaderActionsClass}>
                <PopupScrollToTop
                  listRef={mainListRef}
                  suppressed={isLoading || reorderActive || reorderDrag.dragging || Boolean(state.mainState)}
                  syncKey={`${mode}:${title}:${mainRows.length}`}
                />
                <div className="inline-flex flex-none items-center gap-1">
                {multiSelect && !reorderActive ? (
                  <Button
                    id="popup-selection-mode-toggle"
                    className={cx(
                      paneHeaderActionClass,
                      multiSelectActive ? paneHeaderActionActiveClass : '',
                      '@max-[520px]/popup:w-7 @max-[520px]/popup:justify-center @max-[520px]/popup:px-0'
                    )}
                    type="button"
                    aria-label={multiSelectActive ? '退出多选' : '多选书签'}
                    aria-pressed={multiSelectActive}
                    disabled={multiSelect.busy || (!multiSelectActive && !multiSelect.canEnter)}
                    title={multiSelectActive
                      ? '退出多选模式 (Esc)'
                      : multiSelect.canEnter
                        ? '多选书签进行批量移动或删除'
                        : '当前列表没有可选择的书签'}
                    onClick={() => handlers?.onSelectionModeChange?.(!multiSelectActive)}
                    unstyled
                  >
                    <Icon name="ListChecks" size={14} aria-hidden="true" />
                    <span className="@max-[520px]/popup:hidden">{multiSelectActive ? '退出多选' : '多选'}</span>
                  </Button>
                ) : null}
                {mode === 'tree' && state.reorder && !multiSelectActive ? (
                  <Button
                    className={paneHeaderActionClass}
                    type="button"
                    aria-pressed={state.reorder.active}
                    disabled={state.reorder.busy || (!state.reorder.active && !state.reorder.canEnter)}
                    title={state.reorder.active
                      ? '完成书签排序'
                      : state.reorder.canEnter
                        ? `调整「${state.reorder.folderTitle}」中的直属书签顺序`
                        : '当前文件夹至少需要 2 个直属书签'}
                    onClick={() => handlers?.onReorderModeChange?.(!state.reorder?.active)}
                    unstyled
                  >
                    <Icon name={state.reorder.active ? 'Check' : 'GripVertical'} size={14} aria-hidden="true" />
                    <span>{state.reorder.active ? '完成排序' : '调整顺序'}</span>
                  </Button>
                ) : null}
                {mode === 'tree' && folderManagement && !folderManagement.isAllBookmarksScope && !reorderActive && !multiSelectActive ? (
                  <>
                    <OptionActionsMenu
                      triggerId="popup-folder-sort-menu"
                      label="一键排序当前文件夹"
                      triggerTitle={folderManagement.canSort
                        ? `一键排序「${folderManagement.folderTitle}」中的直属书签`
                        : '当前文件夹至少需要 2 个直属书签'}
                      icon="ArrowUpDown"
                      iconSize={14}
                      iconOnly
                      disabled={folderManagement.sortBusy || !folderManagement.canSort}
                      triggerClassName={paneHeaderIconActionClass}
                      popupWidthClass="w-[236px] max-w-[calc(100vw_-_24px)]"
                      actions={folderSortMenuActions}
                    />
                    <OptionActionsMenu
                      triggerId="popup-folder-actions-menu"
                      label="当前文件夹操作"
                      triggerTitle="当前文件夹操作"
                      icon="MoreHorizontal"
                      iconSize={14}
                      iconOnly
                      triggerClassName={paneHeaderIconActionClass}
                      popupWidthClass="w-[196px] max-w-[calc(100vw_-_24px)]"
                      actions={folderManageMenuActions}
                    />
                  </>
                ) : null}
                </div>
              </div>
            </header>
            <div
              id="popup-search-results"
              role="list"
              {...getPopupSearchGridAria(mode, mainRows.length, Boolean(state.mainState))}
              className={mainListClass}
              data-swipe-selecting={swipeSelect.swiping ? 'true' : undefined}
              ref={mainListRef}
              onPointerDown={swipeSelect.onListPointerDown}
              aria-label={mode === 'search' ? '书签搜索结果' : reorderActive ? `${state.reorder?.folderTitle || '当前文件夹'}直属书签排序` : undefined}
            >
              {state.mainState ? (
                <ul className="m-0 h-full list-none p-0" role="presentation">
                  <PopupMainStatePanel onEmptyAction={handlers?.onEmptyAction} state={state.mainState} />
                </ul>
              ) : mainRows.length ? (
                <>
                  {mainWindow.before > 0 ? (
                    <div
                      className={virtualSpacerClass}
                      style={{ height: `${mainWindow.before}px` }}
                      role="presentation"
                      aria-hidden="true"
                    />
                  ) : null}
                  <ul className="popup-row-layer m-0 list-none p-0" role="presentation">
                  {visibleMainRows.map((row) => {
                    if (row.kind === 'bookmark') {
                      return (
                        <MemoPopupBookmarkRow
                          activeResultRef={activeResultRef}
                          handlers={handlers}
                          onContextMenu={openBookmarkContextMenu}
                          reorder={reorderActive ? reorderDrag.getRowProps(row) : undefined}
                          scopeFolderId={state.reorder?.folderId}
                          selectionMode={multiSelectActive}
                          deferActions={Boolean(heldDirection && row.active)}
                          row={row}
                          key={`bookmark:${row.bookmarkId}`}
                        />
                      )
                    }
                    return (
                      <MemoPopupSearchResultRow
                        activeResultRef={activeResultRef}
                        handlers={handlers}
                        onContextMenu={openBookmarkContextMenu}
                        selectionMode={multiSelectActive}
                        deferActions={Boolean(heldDirection && row.active)}
                        row={row}
                        key={`result:${row.bookmarkId}:${row.index}`}
                      />
                    )
                  })}
                  </ul>
                  {mainWindow.after > 0 ? (
                    <div
                      className={virtualSpacerClass}
                      style={{ height: `${mainWindow.after}px` }}
                      role="presentation"
                      aria-hidden="true"
                    />
                  ) : null}
                </>
              ) : (
                <ul className="m-0 list-none p-0" role="presentation">
                  <li className={compactStateClass}>{state.emptyLabel || '暂无可展示书签'}</li>
                </ul>
              )}
            </div>
            {reorderActive ? (
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {state.reorder?.announcement}
              </p>
            ) : null}
            {multiSelectActive && multiSelect ? (
              <PopupSelectionDock handlers={handlers} selection={multiSelect} />
            ) : null}
          </section>
          {/* Workspace-level indicator — slides freely across both panes */}
          <div
            className={activeResultIndicatorClass}
            data-motion-keyboard="preserve"
            aria-hidden="true"
            ref={activeResultIndicatorRef}
            role="presentation"
          ></div>
          {reorderDrag.ghost}
          {folderContextMenu ? (
            <PopupFolderContextMenu
              handlers={handlers}
              menu={folderContextMenu}
              onClose={closeFolderContextMenu}
            />
          ) : null}
          {bookmarkContextMenu ? (
            <PopupBookmarkContextMenu
              handlers={handlers}
              menu={bookmarkContextMenu}
              multiSelectActive={multiSelectActive}
              onClose={closeBookmarkContextMenu}
              scopeFolderId={state.reorder?.folderId}
            />
          ) : null}
        </div>
      </div>
      {workspaceReveal.settled ? null : (
        <div className={workspaceBackdropLayerClass} aria-hidden="true">
          <MemoPopupWorkspaceBackdrop mode={mode} title={title} />
        </div>
      )}
    </div>
  )
}

export const MemoPopupContent = memo(PopupContent)

function useDecoupledWorkspaceReveal(loading: boolean): { revealed: boolean; settled: boolean } {
  const [revealed, setRevealed] = useState(!loading)
  const [settled, setSettled] = useState(!loading)

  useLayoutEffect(() => {
    if (loading) {
      setRevealed(false)
      setSettled(false)
      return
    }
    if (prefersReducedMotion() || document.documentElement.dataset.motionInput === 'keyboard') {
      setRevealed(true)
      setSettled(true)
    }
  }, [loading])

  useEffect(() => {
    if (loading || revealed) {
      return
    }
    let firstFrame = 0
    let secondFrame = 0
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setRevealed(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [loading, revealed])

  useEffect(() => {
    if (loading || !revealed || settled) {
      return
    }
    const durationMs = getMotionDurationMs('--reveal-dur', 240)
    if (durationMs <= 1) {
      setSettled(true)
      return
    }
    const timer = window.setTimeout(() => {
      setSettled(true)
    }, durationMs + 60)
    return () => window.clearTimeout(timer)
  }, [loading, revealed, settled])

  return { revealed: !loading && revealed, settled: !loading && settled }
}

function usePopupScrollLayer(loading: boolean): RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const promotedRef = useRef(false)
  useEffect(() => {
    if (loading || promotedRef.current) return
    // Allocate scrolling surfaces once the initial dissolve and input settle.
    // This GPU work must yield to the first wheel/keystroke, even when JS is idle.
    const quietDelay = getMotionDurationMs('--reveal-dur', 240)
    const warmupUntil = performance.now() + 1000
    let timer = 0
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll'] as const
    const cleanup = () => {
      window.clearTimeout(timer)
      for (const event of events) window.removeEventListener(event, schedule, { capture: true })
    }
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const root = rootRef.current
        if (root) {
          root.dataset.scrollReady = 'true'
          promotedRef.current = true
        }
        cleanup()
      }, Math.max(quietDelay, warmupUntil - performance.now()))
    }
    for (const event of events) window.addEventListener(event, schedule, { capture: true, passive: true })
    schedule()
    return cleanup
  }, [loading])
  return rootRef
}

interface FixedRowWindow {
  after: number
  before: number
  end: number
  start: number
}

function useFixedRowWindow({
  pane,
  activeIndex,
  revealVersion,
  revealActiveRow,
  heldDirection,
  containerRef,
  enabled,
  rowCount,
  rowHeight
}: {
  pane: 'bookmarks' | 'folders'
  activeIndex: number
  revealVersion: PopupContentViewModel
  revealActiveRow: boolean
  heldDirection: -1 | 0 | 1
  containerRef?: RefObject<HTMLElement | null>
  enabled: boolean
  rowCount: number
  rowHeight: number
}): FixedRowWindow {
  const navigation = usePopupNavigationStore()
  const initialVisibleCount = pane === 'folders' ? 12 : 7
  const initialOverscan = Math.max(POPUP_VIRTUAL_OVERSCAN, initialVisibleCount)
  // Scroll pixels are not render state. Only publish a new window when rows
  // enter or leave the overscan; both panes share this component.
  const [rowWindow, setRowWindow] = useState({ start: 0, count: initialVisibleCount + initialOverscan * 2 })
  const windowRef = useRef(rowWindow)
  const heldDirectionRef = useRef(heldDirection)
  const revealedVersionRef = useRef<PopupContentViewModel | null>(null)
  const viewportRef = useRef({ height: rowHeight * initialVisibleCount, paddingTop: 0 })
  // Rows are adjacent (no gap), so the first painted row's height is the true
  // pitch. Measuring it keeps the spacers exact when a larger browser font
  // size or a wrapped title makes rows taller than the design constant.
  const [measuredPitch, setMeasuredPitch] = useState(0)
  const measuredPitchRef = useRef(0)
  const pitch = measuredPitch > 0 ? measuredPitch : rowHeight
  const consumedNavigationRef = useRef<ReturnType<NonNullable<typeof navigation>['getSnapshot']> | null>(null)
  const getNavigationRange = useCallback(() => {
    if (!navigation || !enabled) return null
    const snapshot = navigation.getSnapshot()
    if (consumedNavigationRef.current !== snapshot) {
      consumedNavigationRef.current = snapshot
      const selectedIndex = pane === 'folders' ? snapshot.state.activeFolderIndex : snapshot.state.activeResultIndex
      const direction = snapshot.navigation === 'repeat' && (snapshot.state.keyboardPane || 'bookmarks') === pane
        ? snapshot.direction || 0 : 0
      heldDirectionRef.current = direction
      const current = windowRef.current
      const next = direction && selectedIndex !== undefined && selectedIndex >= 0
        ? getPopupHeldRange({
            activeIndex: selectedIndex, direction, rowCount, pitch, previous: current,
            viewportHeight: viewportRef.current.height, paddingTop: viewportRef.current.paddingTop
          })
        : !snapshot.preserveScroll && selectedIndex !== undefined
          ? includePopupVirtualSelection(current, selectedIndex, rowCount) : current
      if (current.start !== next.start || current.count !== next.count) windowRef.current = next
    }
    // A stable range snapshot lets React skip the entire list on most repeats.
    const start = Math.min(windowRef.current.start, Math.max(0, rowCount - windowRef.current.count))
    if (start !== windowRef.current.start) windowRef.current = { ...windowRef.current, start }
    return windowRef.current
  }, [enabled, navigation, pane, pitch, rowCount])
  const navigationRange = useSyncExternalStore(
    navigation?.subscribe || subscribeNoPopupNavigation, getNavigationRange, getNavigationRange
  )
  useLayoutEffect(() => { heldDirectionRef.current = heldDirection }, [heldDirection])
  const measureRowPitch = useCallback(() => {
    const container = containerRef?.current
    if (!container) return null
    const row = container.querySelector<HTMLElement>('[data-popup-row-index]')
    if (!row) return null
    const height = Math.round(row.getBoundingClientRect().height)
    if (height > 0 && height !== measuredPitchRef.current) {
      measuredPitchRef.current = height
      setMeasuredPitch(height)
    }
    return row
  }, [containerRef])
  const measureViewport = useCallback(() => {
    const container = containerRef?.current
    if (!container) return
    if (heldDirectionRef.current) return
    const current = windowRef.current
    const next = getPopupVirtualRange({
      previous: current,
      rowCount,
      pitch,
      scrollTop: container.scrollTop,
      viewportHeight: viewportRef.current.height,
      paddingTop: viewportRef.current.paddingTop
    })
    if (current.start === next.start && current.count === next.count) return
    windowRef.current = next
    setRowWindow(next)
  }, [containerRef, pitch, rowCount])

  useLayoutEffect(() => {
    if (!enabled) return
    const container = containerRef?.current
    if (!container) return

    const resize = () => {
      viewportRef.current = {
        height: container.clientHeight || pitch * 8,
        paddingTop: Number.parseFloat(getComputedStyle(container).paddingTop) || 0
      }
      measureRowPitch()
      measureViewport()
    }
    resize()
    container.addEventListener('scroll', measureViewport, { passive: true })
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resize)
    observer?.observe(container)
    return () => {
      container.removeEventListener('scroll', measureViewport)
      observer?.disconnect()
    }
  }, [containerRef, enabled, measureRowPitch, measureViewport, pitch, rowCount])

  useLayoutEffect(() => {
    if (enabled && !heldDirection) measureViewport()
  }, [enabled, heldDirection, measureViewport])

  const clampedRange = {
    start: Math.min(windowRef.current.start, Math.max(0, rowCount - windowRef.current.count)),
    count: windowRef.current.count
  }
  const range = navigationRange || (heldDirection && activeIndex >= 0
    ? getPopupHeldRange({ activeIndex, direction: heldDirection, rowCount, pitch,
        viewportHeight: viewportRef.current.height, paddingTop: viewportRef.current.paddingTop, previous: clampedRange })
    : revealActiveRow && revealedVersionRef.current !== revealVersion
      ? includePopupVirtualSelection(clampedRange, activeIndex, rowCount)
      : clampedRange)

  useLayoutEffect(() => {
    const container = containerRef?.current
    if (!enabled || heldDirection || !container || typeof ResizeObserver === 'undefined') return
    const row = container.querySelector<HTMLElement>('[data-popup-row-index]')
    if (!row) return
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry.borderBoxSize[0]?.blockSize || 0)
      if (height > 0 && height !== measuredPitchRef.current) {
        measuredPitchRef.current = height
        setMeasuredPitch(height)
      }
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [containerRef, enabled, heldDirection, range.start])

  // Mount a distant target before the host measures it. This hook owns only
  // the render window; the content host is the sole scroll-reveal writer.
  useLayoutEffect(() => {
    revealedVersionRef.current = revealVersion
    if (enabled && (range.start !== windowRef.current.start || range.count !== windowRef.current.count)) {
      windowRef.current = range
    }
  }, [enabled, range.start, range.count, revealVersion])

  if (!enabled) {
    return { after: 0, before: 0, end: rowCount, start: 0 }
  }

  // Data may shrink before the resize/scroll event arrives. Clamp immediately
  // so removing a folder's tail never leaves an empty, oversized spacer.
  const start = range.start
  const end = Math.min(rowCount, start + range.count)
  return {
    after: Math.max(0, (rowCount - end) * pitch),
    before: start * pitch,
    end,
    start
  }
}

function PopupWorkspaceBackdrop({
  mode,
  title
}: {
  mode: 'search' | 'tree'
  title: string
}) {
  return (
    <div className={cx(workspaceClass, workspacePlaceholderClass)}>
      <div className={paneClass}>
        <header className={folderPaneHeaderClass}>
          <span className="shrink-0">全部文件夹</span>
          <div className={cx(folderFilterShellClass, 'pointer-events-none')}>
            <Icon name="Search" className={folderFilterIconClass} size={13} aria-hidden="true" />
            <span className="min-w-0 flex-auto truncate text-xs font-normal leading-[1.3] text-ds-text-muted">
              筛选文件夹
            </span>
          </div>
          <span className="inline-flex h-7 w-7 flex-none" aria-hidden="true" />
        </header>
      </div>
      <div className={mainPaneClass}>
        <header className={paneHeaderClass}>
          <span className={paneHeaderTitleClass}>
            {title} <span className={paneTitleMetaClass}>·</span>
          </span>
          {mode === 'tree' ? (
            <span className={cx(paneHeaderActionClass, 'pointer-events-none opacity-40')}>
              <Icon name="GripVertical" size={14} aria-hidden="true" />
              <span>调整顺序</span>
            </span>
          ) : null}
        </header>
      </div>
    </div>
  )
}

const MemoPopupWorkspaceBackdrop = memo(PopupWorkspaceBackdrop)

function PopupContentSkeleton({
  mode,
  title
}: {
  mode: 'search' | 'tree'
  title: string
}) {
  return (
    <div className={cx(workspaceClass, workspacePlaceholderClass)}>
      <aside className={paneClass} aria-label="文件夹树加载占位">
        <header className={paneHeaderClass}>
          <span className="invisible shrink-0">全部文件夹</span>
        </header>
        <div className={folderTreeClass} role="presentation">
          {POPUP_CONTENT_SKELETON_FOLDER_ROWS.map((row, index) => (
            <div
              className={folderRowClass}
              style={{ '--depth': row.depth } as CSSProperties}
              key={`folder-skeleton:${index}`}
            >
              <div className={cx(folderCardClass, 'cursor-default')} style={getFolderDepthStyle(row.depth)}>
                {row.depth === 0 ? (
                  <span className={cx(rootFolderBranchClass, 'popup-skeleton-pulse')} data-origin="center" aria-hidden="true"></span>
                ) : (
                  <span className={skeletonFolderBranchPlaceholderClass} aria-hidden="true"></span>
                )}
                <span className={folderMainClass}>
                  <span className={skeletonFolderTitleClass} style={{ '--skeleton-width': row.width } as CSSProperties}></span>
                  <span className={skeletonFolderCountClass} data-origin="right" style={{ '--skeleton-width': row.count } as CSSProperties}></span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className={mainPaneClass} aria-label={`${title}加载占位`}>
        <header className={paneHeaderClass}>
          <span className={paneHeaderTitleClass}>
            <span className="invisible">{title} · </span>
            <span className={skeletonHeaderMetaClass}></span>
          </span>
        </header>
        <ul className={mainListClass} role="presentation">
          {POPUP_CONTENT_SKELETON_BOOKMARK_ROWS.map((row, index) => (
            <li
              className={cx(mainRowClass, index === 0 && 'border-t-0')}
              key={`bookmark-skeleton:${index}:${row.title}:${row.url}`}
              style={{ height: POPUP_BOOKMARK_ROW_HEIGHT }}
            >
              <div className={cx(listButtonClass, 'cursor-default')} style={getBookmarkButtonStyle()}>
                <span className={rowMainClass}>
                  <span className={skeletonBookmarkTitleLineClass}>
                    <span className={skeletonBookmarkTitleClass} style={{ width: row.title }}></span>
                  </span>
                  <span className={skeletonBookmarkSubtitleLineClass}>
                    <span className={skeletonBookmarkUrlClass} style={{ width: row.url }}></span>
                  </span>
                </span>
              </div>
              <PopupSkeletonRowActions expanded={false} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function PopupSkeletonRowActions({ expanded }: { expanded: boolean }) {
  return (
    <div
      className={cx(rowActionsClass, 'opacity-80')}
      data-active={expanded ? 'true' : undefined}
      data-open={expanded ? 'true' : 'false'}
    >
      {expanded ? (
        <div className={rowActionRailClass}>
          {Array.from({ length: POPUP_CONTENT_SKELETON_ACTION_COUNT }, (_, index) => (
            <span className={skeletonActionButtonClass} key={`bookmark-skeleton-action:${index}`}></span>
          ))}
        </div>
      ) : null}
      <span className={cx(skeletonActionButtonClass, 'popup-row-actions-trigger')} data-origin="center"></span>
    </div>
  )
}

function PopupMainStatePanel({
  onEmptyAction,
  state
}: {
  onEmptyAction?: (action: string) => void
  state: NonNullable<PopupContentViewModel['mainState']>
}) {
  if (state.kind === 'loading') {
    return (
      <li className={mainStateClass} aria-live="polite">
        <PopupMainLoadingSkeleton label={state.label || '正在搜索书签…'} />
      </li>
    )
  }

  if (state.kind === 'error') {
    return (
      <li className={mainStateClass}>
        <ErrorState
          size="compact"
          title={state.title || '读取失败'}
          detail={state.label}
          actions={state.actions?.length ? (
            <>
              {state.actions.map((action) => (
                <Button
                  key={action.action}
                  size="sm"
                  type="button"
                  variant={action.primary ? 'primary' : 'secondary'}
                  onClick={() => onEmptyAction?.(action.action)}
                >
                  {action.label}
                </Button>
              ))}
            </>
          ) : undefined}
        />
      </li>
    )
  }

  if (state.kind === 'natural-setup' || state.kind === 'search-empty') {
    return (
      <li className={mainStateClass}>
        <PopupEmptyState onAction={onEmptyAction} state={state.state || { kind: 'none' }} />
      </li>
    )
  }

  return (
    <li className={mainStateClass}>
      {state.label || '暂无可展示书签'}
    </li>
  )
}

function PopupMainLoadingSkeleton({ label }: { label: string }) {
  return (
    <div className={searchSkeletonClass} aria-label="搜索中">
      {[0.82, 0.66, 0.74].map((width, index) => (
        <div className={searchSkeletonRowClass} key={`search-skeleton:${index}`}>
          <span className={skeletonBookmarkTitleClass} style={{ '--skeleton-width': width } as CSSProperties}></span>
          <span className={skeletonBookmarkUrlClass} style={{ '--skeleton-width': 0.46 + index * 0.08 } as CSSProperties}></span>
        </div>
      ))}
    </div>
  )
}

function PopupFolderRow({
  activeFolderRef,
  handlers,
  onContextMenu,
  onFolderFilter,
  row
}: {
  activeFolderRef?: RefObject<HTMLDivElement | null>
  handlers?: PopupContentActionHandlers
  onContextMenu?: (
    row: PopupContentFolderRowViewModel,
    clientX: number,
    clientY: number,
    triggerElement: HTMLElement | null
  ) => void
  onFolderFilter?: (folderId: string) => void
  row: PopupContentFolderRowViewModel
}) {
  const { active: keyboardActive } = usePopupRowNavigation('folders', row.index, Boolean(row.keyboardActive))
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className={folderRowClass} data-folder-row-id={row.folderId} data-popup-row-index={row.index} style={style} ref={keyboardActive ? activeFolderRef : undefined}>
      <Button
        className={cx(
          folderCardClass,
          row.active ? folderCardActiveClass : '',
          // Ancestors of a match stay clickable but recede, so the tree keeps
          // its shape without competing with the actual hits.
          row.dimmed ? folderCardDimmedClass : ''
        )}
        type="button"
        role="treeitem"
        aria-expanded={row.expanded}
        aria-level={row.depth + 1}
        aria-selected={keyboardActive ? 'true' : 'false'}
        style={getFolderDepthStyle(row.depth)}
        aria-current={row.active ? 'page' : undefined}
        title={row.subtitle}
        onFocus={() => handlers?.onFolderFocus?.(row.index)}
        onKeyDown={(event) => {
          handleContentNavigationKeyDown(event, handlers)
        }}
        onContextMenu={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault()
          event.stopPropagation()
          onContextMenu?.(row, event.clientX, event.clientY, event.currentTarget)
        }}
        onClick={() => onFolderFilter?.(row.root ? 'all' : row.folderId)}
        unstyled
      >
        <span className={row.depth === 0 ? rootFolderBranchClass : folderBranchClass} aria-hidden="true"></span>
        <span className={folderMainClass}>
          <span className={folderTitleClass}>{row.title}</span>
          <span className={cx(folderCountClass, row.active ? folderCountActiveClass : '')} title={`${row.countLabel} 个书签`}>
            {row.countLabel}
          </span>
        </span>
      </Button>
    </div>
  )
}

function useRowFlag(id: string) {
  const [flag, setFlag] = useState({ id, value: false })
  const setValue = useCallback((value: boolean) => setFlag(current =>
    current.id === id && current.value === value ? current : { id, value }
  ), [id])
  // A recycled DOM slot must not inherit another bookmark's menu or hover.
  return [flag.id === id && flag.value, setValue] as const
}

function hasPointerIntent(event: ReactPointerEvent<HTMLElement>): boolean {
  return Boolean(event.movementX || event.movementY) || document.documentElement.dataset.motionInput !== 'keyboard'
}

function getOptionsBookmarkFaviconSrc(url: string): string {
  if (!url || !/^https?:\/\//i.test(url)) {
    return ''
  }
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.getURL !== 'function') {
    return ''
  }
  try {
    const endpoint = chrome.runtime.getURL('/_favicon/')
    const parsed = new URL(endpoint)
    parsed.searchParams.set('pageUrl', url)
    parsed.searchParams.set('size', '32')
    return parsed.toString()
  } catch {
    return ''
  }
}

function PopupBookmarkFavicon({ url }: { url: string }) {
  const src = getOptionsBookmarkFaviconSrc(url)
  const [failedSrc, setFailedSrc] = useState('')
  const showImage = Boolean(src && failedSrc !== src)
  return (
    <span className="popup-bookmark-favicon" aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          width={16}
          height={16}
          loading="lazy"
          decoding="async"
          className="block size-4 rounded-ds-xs object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Icon name="Globe" size={14} className="text-ds-text-muted" aria-hidden="true" />
      )}
    </span>
  )
}

function PopupBookmarkRow({
  activeResultRef,
  handlers,
  onContextMenu,
  reorder,
  scopeFolderId,
  selectionMode = false,
  deferActions: fallbackDeferActions = false,
  row
}: {
  activeResultRef?: RefObject<HTMLLIElement | null>
  handlers?: PopupContentActionHandlers
  onContextMenu?: (
    row: PopupContentMainRowViewModel,
    clientX: number,
    clientY: number,
    triggerElement: HTMLElement | null
  ) => void
  reorder?: PopupBookmarkReorderRowProps
  scopeFolderId?: string
  selectionMode?: boolean
  deferActions?: boolean
  row: PopupContentBookmarkRowViewModel
}) {
  const { active, deferActions } = usePopupRowNavigation('bookmarks', row.index, Boolean(row.active), fallbackDeferActions)
  const selected = Boolean(selectionMode && row.selected)
  const optionsSurface = isOptionsSurface()
  const style = {
    '--depth': row.depth,
    height: `${POPUP_BOOKMARK_ROW_HEIGHT}px`,
    transform: reorder?.shiftY ? `translate3d(0, ${reorder.shiftY}px, 0)` : undefined
  } as CSSProperties
  const [actionsMounted, setActionsMounted] = useRowFlag(row.bookmarkId)

  return (
    <li
      className={cx(mainRowClass, row.index === 0 && 'border-t-0')}
      data-active={active ? 'true' : undefined}
      data-bookmark-id={row.bookmarkId}
      data-popup-row-index={row.index}
      data-reorder-source={reorder?.dragging ? 'true' : undefined}
      data-reorder-shift={reorder?.shiftY ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      onFocusCapture={() => setActionsMounted(true)}
      onPointerEnter={event => { if (hasPointerIntent(event)) setActionsMounted(true) }}
      onPointerMove={event => { if (!actionsMounted && (event.movementX || event.movementY)) setActionsMounted(true) }}
      ref={active ? activeResultRef : undefined}
      style={style}
    >
      <Button
        className={cx(
          listButtonClass,
          reorder ? 'popup-reorder-row-content' : '',
          selectionMode ? 'popup-select-row-button' : ''
        )}
        type="button"
        data-active={active ? 'true' : undefined}
        data-selected={selected ? 'true' : undefined}
        aria-pressed={selectionMode ? selected : undefined}
        disabled={Boolean(reorder)}
        style={getBookmarkButtonStyle()}
        onFocus={() => {
          if (!reorder) handlers?.onRowFocus?.(row.index)
        }}
        onKeyDown={(event) => {
          if (selectionMode && !event.altKey && !event.ctrlKey && !event.metaKey && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault()
            event.stopPropagation()
            handlers?.onBookmarkToggleSelect?.(row.bookmarkId, event.shiftKey)
            return
          }
          if (activateModifiedBookmark(event, row.bookmarkId, handlers)) return
          if (!reorder) handleContentNavigationKeyDown(event, handlers)
        }}
        onClick={(event) => {
          if (selectionMode) {
            handlers?.onBookmarkToggleSelect?.(row.bookmarkId, event.shiftKey)
            return
          }
          if (!reorder) handlers?.onBookmarkOpen?.(row.bookmarkId)
        }}
        onContextMenu={(event: ReactMouseEvent<HTMLButtonElement>) => {
          if (reorder) return
          event.preventDefault()
          event.stopPropagation()
          onContextMenu?.(row, event.clientX, event.clientY, event.currentTarget)
        }}
        unstyled
      >
        {selectionMode ? (
          <span className="popup-row-checkbox" data-checked={selected ? 'true' : undefined} aria-hidden="true">
            <Icon name="Check" size={12} aria-hidden="true" />
          </span>
        ) : optionsSurface ? (
          <PopupBookmarkFavicon url={row.url} />
        ) : null}
        <span className={rowMainClass}>
          <span className={rowTitleClass} title={row.title}>{row.title}</span>
          <PopupRowMetadata
            domain={getPopupBookmarkDomain(row.url, row.displayUrl)}
            folder={row.parentId === scopeFolderId ? '' : getPopupFolderLabel(row.path)}
            path={row.path}
            url={row.url}
          />
        </span>
      </Button>
      {reorder ? (
        <Button
          className={rowReorderHandleClass}
          type="button"
          aria-label={`调整 ${row.title} 的顺序，当前第 ${row.index + 1} 位`}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          data-drag-pending={reorder.pending ? 'true' : undefined}
          data-dragging={reorder.dragging ? 'true' : undefined}
          disabled={reorder.busy}
          title="按住拖动；也可按 Alt 加上下方向键调整"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onKeyDown={reorder.onKeyDown}
          onPointerDown={reorder.onPointerDown}
          unstyled
        >
          <Icon name="GripVertical" size={16} aria-hidden="true" />
        </Button>
      ) : !selectionMode ? (
        <PopupRowActions
          active={active}
          bookmarkId={row.bookmarkId}
          label={row.menuLabel}
          mountQuickActions={actionsMounted || (active && !deferActions)}
          menu={row.menu}
          onMenuAction={handlers?.onMenuAction}
        />
      ) : null}
    </li>
  )
}

function PopupSearchResultRow({
  activeResultRef,
  handlers,
  onContextMenu,
  selectionMode = false,
  deferActions: fallbackDeferActions = false,
  row
}: {
  activeResultRef?: RefObject<HTMLLIElement | null>
  handlers?: PopupContentActionHandlers
  onContextMenu?: (
    row: PopupContentMainRowViewModel,
    clientX: number,
    clientY: number,
    triggerElement: HTMLElement | null
  ) => void
  selectionMode?: boolean
  deferActions?: boolean
  row: PopupContentSearchResultViewModel
}) {
  const { active, deferActions } = usePopupRowNavigation('bookmarks', row.index, Boolean(row.active), fallbackDeferActions)
  const selected = Boolean(selectionMode && row.selected)
  const optionsSurface = isOptionsSurface()
  const [actionsMounted, setActionsMounted] = useRowFlag(row.bookmarkId)
  const { presentation } = row
  const reasons = presentation.reasonTokens

  return (
    <li
      className={cx(mainRowClass, row.index === 0 && 'border-t-0')}
      style={{ height: presentation.rowHeight }}
      id={getPopupSearchResultId(row.bookmarkId)}
      role="row"
      aria-rowindex={row.index + 1}
      aria-selected={selectionMode ? selected : active}
      aria-label={`${row.title}，${row.displayUrl}，${row.path || ''}`}
      aria-description={row.reasonTitle || undefined}
      data-active={active ? 'true' : undefined}
      data-bookmark-id={row.bookmarkId}
      data-popup-row-index={row.index}
      data-selected={selected ? 'true' : undefined}
      onFocusCapture={() => setActionsMounted(true)}
      onPointerEnter={event => { if (hasPointerIntent(event)) setActionsMounted(true) }}
      onPointerMove={event => { if (!actionsMounted && (event.movementX || event.movementY)) setActionsMounted(true) }}
      ref={active ? activeResultRef : undefined}
    >
      <div role="gridcell" className="min-w-0">
      <Button
        className={cx(listButtonClass, selectionMode ? 'popup-select-row-button' : '')}
        type="button"
        data-active={active ? 'true' : undefined}
        data-selected={selected ? 'true' : undefined}
        aria-pressed={selectionMode ? selected : undefined}
        style={{ ...getBookmarkButtonStyle(), ...(reasons.length ? { paddingBlock: 4 } : {}) }}
        onFocus={() => handlers?.onRowFocus?.(row.index)}
        onKeyDown={(event) => {
          if (selectionMode && !event.altKey && !event.ctrlKey && !event.metaKey && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault()
            event.stopPropagation()
            handlers?.onBookmarkToggleSelect?.(row.bookmarkId, event.shiftKey)
            return
          }
          if (activateModifiedBookmark(event, row.bookmarkId, handlers)) return
          handleContentNavigationKeyDown(event, handlers)
        }}
        onClick={(event) => {
          if (selectionMode) {
            handlers?.onBookmarkToggleSelect?.(row.bookmarkId, event.shiftKey)
            return
          }
          handlers?.onBookmarkOpen?.(row.bookmarkId)
        }}
        onContextMenu={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.preventDefault()
          event.stopPropagation()
          onContextMenu?.(row, event.clientX, event.clientY, event.currentTarget)
        }}
        onPointerOver={event => { if (hasPointerIntent(event)) handlers?.onResultHover?.(row.index) }}
        onPointerMove={event => {
          if (!active && (event.movementX || event.movementY)) handlers?.onResultHover?.(row.index)
        }}
        unstyled
      >
        {selectionMode ? (
          <span className="popup-row-checkbox" data-checked={selected ? 'true' : undefined} aria-hidden="true">
            <Icon name="Check" size={12} aria-hidden="true" />
          </span>
        ) : optionsSurface ? (
          <PopupBookmarkFavicon url={row.url} />
        ) : null}
        <span className={resultCopyClass}>
          <span className={rowTitleClass} title={row.title}>
            <HighlightedText terms={presentation.titleTerms} text={row.title} />
          </span>
          <PopupRowMetadata
            domain={<HighlightedText terms={presentation.domainTerms} text={presentation.domain} />}
            folder={presentation.folder ? <HighlightedText terms={presentation.folderTerms} text={presentation.folder} /> : null}
            path={row.path}
            url={row.url}
          />
          {reasons.length ? (
            <span className={resultMatchReasonsClass} title={row.reasonTitle} aria-label={row.reasonLabel}>
              {reasons.join('；')}
            </span>
          ) : null}
        </span>
      </Button>
      </div>
      <div role="gridcell" className="popup-result-actions-cell">
      {!selectionMode ? (
        <PopupRowActions
          active={active}
          bookmarkId={row.bookmarkId}
          label={row.menuLabel}
          mountQuickActions={actionsMounted || (active && !deferActions)}
          menu={row.menu}
          onMenuAction={handlers?.onMenuAction}
          title="操作菜单"
        />
      ) : null}
      </div>
    </li>
  )
}

function PopupRowMetadata({
  domain,
  folder,
  path,
  url
}: {
  domain: ReactNode
  folder: ReactNode
  path?: string
  url: string
}) {
  return (
    <span className={rowMetadataClass} title={[url, path].filter(Boolean).join('\n')}>
      <span className={rowDomainClass} title={url}>{domain}</span>
      {folder ? (
        <>
          <span className="shrink-0" aria-hidden="true">·</span>
          <span className={rowFolderClass} title={path}>{folder}</span>
        </>
      ) : null}
    </span>
  )
}

const MemoPopupContentSkeleton = memo(PopupContentSkeleton)
const MemoPopupFolderRow = memo(PopupFolderRow)
const MemoPopupBookmarkRow = memo(PopupBookmarkRow, arePopupBookmarkRowPropsEqual)
const MemoPopupSearchResultRow = memo(PopupSearchResultRow, arePopupSearchResultRowPropsEqual)

function arePopupBookmarkRowPropsEqual(
  previous: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    onContextMenu?: (
      row: PopupContentMainRowViewModel,
      clientX: number,
      clientY: number,
      triggerElement: HTMLElement | null
    ) => void
    reorder?: PopupBookmarkReorderRowProps
    scopeFolderId?: string
    selectionMode?: boolean
    deferActions?: boolean
    row: PopupContentBookmarkRowViewModel
  },
  next: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    onContextMenu?: (
      row: PopupContentMainRowViewModel,
      clientX: number,
      clientY: number,
      triggerElement: HTMLElement | null
    ) => void
    reorder?: PopupBookmarkReorderRowProps
    scopeFolderId?: string
    selectionMode?: boolean
    deferActions?: boolean
    row: PopupContentBookmarkRowViewModel
  }
) {
  return previous.activeResultRef === next.activeResultRef &&
    previous.deferActions === next.deferActions &&
    previous.handlers === next.handlers &&
    previous.onContextMenu === next.onContextMenu &&
    previous.reorder === next.reorder &&
    previous.scopeFolderId === next.scopeFolderId &&
    previous.selectionMode === next.selectionMode &&
    areBookmarkRowsEqual(previous.row, next.row)
}

function arePopupSearchResultRowPropsEqual(
  previous: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    onContextMenu?: (
      row: PopupContentMainRowViewModel,
      clientX: number,
      clientY: number,
      triggerElement: HTMLElement | null
    ) => void
    selectionMode?: boolean
    deferActions?: boolean
    row: PopupContentSearchResultViewModel
  },
  next: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    onContextMenu?: (
      row: PopupContentMainRowViewModel,
      clientX: number,
      clientY: number,
      triggerElement: HTMLElement | null
    ) => void
    selectionMode?: boolean
    deferActions?: boolean
    row: PopupContentSearchResultViewModel
  }
) {
  return previous.activeResultRef === next.activeResultRef &&
    previous.deferActions === next.deferActions &&
    previous.handlers === next.handlers &&
    previous.onContextMenu === next.onContextMenu &&
    previous.selectionMode === next.selectionMode &&
    areSearchResultRowsEqual(previous.row, next.row)
}

function areBookmarkRowsEqual(
  previous: PopupContentBookmarkRowViewModel,
  next: PopupContentBookmarkRowViewModel
) {
  if (previous === next) return true
  return Boolean(previous.active) === Boolean(next.active) &&
    Boolean(previous.selected) === Boolean(next.selected) &&
    previous.bookmarkId === next.bookmarkId &&
    previous.depth === next.depth &&
    previous.displayUrl === next.displayUrl &&
    previous.index === next.index &&
    previous.menuLabel === next.menuLabel &&
    previous.parentId === next.parentId &&
    previous.path === next.path &&
    previous.title === next.title &&
    previous.url === next.url &&
    areActionMenusEqual(previous.menu, next.menu)
}

function areSearchResultRowsEqual(
  previous: PopupContentSearchResultViewModel,
  next: PopupContentSearchResultViewModel
) {
  if (previous === next) return true
  return previous.active === next.active &&
    Boolean(previous.selected) === Boolean(next.selected) &&
    previous.bookmarkId === next.bookmarkId &&
    previous.depth === next.depth &&
    previous.displayUrl === next.displayUrl &&
    previous.highlightQuery === next.highlightQuery &&
    previous.index === next.index &&
    previous.menuLabel === next.menuLabel &&
    previous.parentId === next.parentId &&
    previous.path === next.path &&
    previous.reasonLabel === next.reasonLabel &&
    previous.reasonTitle === next.reasonTitle &&
    previous.presentation === next.presentation &&
    previous.title === next.title &&
    previous.url === next.url &&
    areStringArraysEqual(previous.reasonTokens, next.reasonTokens) &&
    areActionMenusEqual(previous.menu, next.menu)
}

function areActionMenusEqual(
  previous: PopupActionMenuViewModel,
  next: PopupActionMenuViewModel
) {
  return previous.items.length === next.items.length && previous.items.every((item, index) => {
    const nextItem = next.items[index]
    return item.action === nextItem.action &&
      item.ariaLabel === nextItem.ariaLabel &&
      item.bookmarkId === nextItem.bookmarkId &&
      item.danger === nextItem.danger &&
      item.disabled === nextItem.disabled &&
      item.feedback === nextItem.feedback &&
      item.label === nextItem.label
  })
}

function areStringArraysEqual(previous: string[], next: string[]) {
  return previous.length === next.length && previous.every((item, index) => item === next[index])
}

function activateModifiedBookmark(event: KeyboardEvent<HTMLButtonElement>, bookmarkId: string, handlers?: PopupContentActionHandlers): boolean {
  if (event.nativeEvent.isComposing || event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey && !event.altKey)) return false
  event.preventDefault()
  event.stopPropagation()
  handlers?.onMenuAction?.(bookmarkId, event.altKey ? 'open-current-tab' : 'open-background', event.currentTarget)
  return true
}

function handleContentNavigationKeyDown(
  event: KeyboardEvent<HTMLElement>,
  handlers?: PopupContentActionHandlers
): void {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  if (!isPopupContentNavigationKey(event.key)) {
    return
  }

  if (handlers?.onKeyboardNavigate?.(event.key, event.repeat)) {
    event.preventDefault()
  }
}

interface PopupRowActionsProps {
  active?: boolean
  bookmarkId: string
  label: string
  mountQuickActions: boolean
  menu: PopupActionMenuViewModel
  onMenuAction?: (bookmarkId: string, action: string, returnFocusElement?: HTMLElement | null) => void
  title?: string
}

function PopupRowActions({
  active = false,
  bookmarkId,
  label,
  mountQuickActions,
  menu,
  onMenuAction,
  title
}: PopupRowActionsProps) {
  const [focusExpanded, setFocusExpanded] = useRowFlag(bookmarkId)
  const [pinnedExpanded, setPinnedExpanded] = useRowFlag(bookmarkId)
  const [forcedCollapsed, setForcedCollapsed] = useRowFlag(bookmarkId)
  const quickActions = mountQuickActions
    ? menu.items.filter((item) => {
        return ['edit', 'copy-url', 'open-current-tab', 'delete'].includes(item.action)
      })
    : []
  const expanded = (active || focusExpanded || pinnedExpanded) && !forcedCollapsed
  const triggerLabel = title || label || '显示书签快捷操作'

  return (
    <div
      className={rowActionsClass}
      aria-label="书签快捷操作"
      data-active={active ? 'true' : undefined}
      data-collapsed={forcedCollapsed ? 'true' : undefined}
      data-open={expanded ? 'true' : 'false'}
      data-pinned={pinnedExpanded && !forcedCollapsed ? 'true' : undefined}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setFocusExpanded(false)
        }
      }}
      onFocus={() => {
        if (!forcedCollapsed) {
          setFocusExpanded(true)
        }
      }}
      onPointerLeave={() => setForcedCollapsed(false)}
    >
      <div className={rowActionRailClass}>
        {quickActions.map((item) => item.action === 'copy-url' ? (
          <StatusButton
            key={`${item.bookmarkId}:${item.action}`}
            className={rowActionButtonClass}
            type="button"
            aria-label={item.ariaLabel}
            data-bookmark-menu-action={item.action}
            feedback={item.feedback || IDLE_ACTION_FEEDBACK}
            icon="Copy"
            labels={COPY_ACTION_LABELS}
            iconOnly
            disabled={item.disabled}
            tabIndex={expanded ? undefined : -1}
            onClick={(event) => {
              onMenuAction?.(item.bookmarkId, item.action, event.currentTarget)
              setFocusExpanded(true)
            }}
            unstyled
          />
        ) : (
          <Button
            className={cx(rowActionButtonClass, item.danger ? rowActionDangerClass : '')}
            type="button"
            aria-label={item.ariaLabel}
            data-bookmark-menu-action={item.action}
            title={item.label}
            disabled={item.disabled}
            tabIndex={expanded ? undefined : -1}
            onClick={(event) => {
              onMenuAction?.(item.bookmarkId, item.action, event.currentTarget)
              setFocusExpanded(false)
            }}
            key={`${item.bookmarkId}:${item.action}`}
            unstyled
          >
            <Icon name={getPopupActionIconName(item.action)} size={14} aria-hidden="true" />
          </Button>
        ))}
      </div>
      <Button
        className={rowActionTriggerClass}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={expanded}
        aria-pressed={pinnedExpanded && !forcedCollapsed}
        title={triggerLabel}
        onClick={(event) => {
          if (pinnedExpanded && !forcedCollapsed) {
            setPinnedExpanded(false)
            setFocusExpanded(false)
            setForcedCollapsed(true)
            event.currentTarget.blur()
            return
          }

          setPinnedExpanded(true)
          setForcedCollapsed(false)
        }}
        unstyled
      >
        <Icon name="MoreHorizontal" size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

function getPopupActionIconName(action: string): IconName {
  if (action === 'edit') {
    return 'Pencil'
  }
  if (action === 'copy-url') {
    return 'Copy'
  }
  if (action === 'delete') {
    return 'Trash2'
  }
  return 'ExternalLink'
}

interface PopupFolderContextMenuState {
  canManage: boolean
  folderId: string
  isRootAll?: boolean
  title: string
  triggerElement: HTMLElement | null
  x: number
  y: number
}

function PopupFolderContextMenu({
  handlers,
  menu,
  onClose
}: {
  handlers?: PopupContentActionHandlers
  menu: PopupFolderContextMenuState
  onClose: (restoreFocus?: boolean) => void
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: menu.x, top: menu.y })

  useLayoutEffect(() => {
    const element = menuRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const padding = 8
    const nextLeft = Math.max(padding, Math.min(menu.x, window.innerWidth - rect.width - padding))
    const nextTop = Math.max(padding, Math.min(menu.y, window.innerHeight - rect.height - padding))
    setPosition({ left: Math.round(nextLeft), top: Math.round(nextTop) })
    const firstItem = element.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
    firstItem?.focus({ preventScroll: true })
  }, [menu.folderId, menu.x, menu.y])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return
      }
      onClose(false)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose(true)
        return
      }
      const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || [])]
      if (!items.length) return
      const currentIndex = items.findIndex((item) => item === document.activeElement)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        items[(currentIndex + 1 + items.length) % items.length]?.focus({ preventScroll: true })
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        items[(currentIndex - 1 + items.length) % items.length]?.focus({ preventScroll: true })
      } else if (event.key === 'Home') {
        event.preventDefault()
        items[0]?.focus({ preventScroll: true })
      } else if (event.key === 'End') {
        event.preventDefault()
        items[items.length - 1]?.focus({ preventScroll: true })
      }
    }
    const handleDismiss = () => onClose(false)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleDismiss, true)
    window.addEventListener('blur', handleDismiss)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleDismiss, true)
      window.removeEventListener('blur', handleDismiss)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  const runAction = (callback: () => void) => {
    onClose(false)
    callback()
  }

  return createPortal(
    <div
      ref={menuRef}
      id="popup-folder-context-menu"
      role="menu"
      aria-label={`文件夹「${menu.title}」操作`}
      className="popup-folder-context-menu fixed z-[10000] w-[192px] max-w-[calc(100vw_-_16px)] rounded-ds-menu border border-ds-border bg-ds-surface-2 ds-inset-menu [filter:var(--ds-filter-popover)] outline-none"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
    >
      <button
        type="button"
        role="menuitem"
        data-folder-context-action="create"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onFolderCreate?.(menu.folderId, menu.triggerElement))}
      >
        <Icon name="FolderPlus" size={14} aria-hidden="true" className="shrink-0" />
        <span>{menu.isRootAll ? '新建文件夹' : '新建子文件夹'}</span>
      </button>
      {menu.canManage ? (
        <>
          <button
            type="button"
            role="menuitem"
            data-folder-context-action="rename"
            className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
            onClick={() => runAction(() => handlers?.onFolderRename?.(menu.folderId, menu.triggerElement))}
          >
            <Icon name="Pencil" size={14} aria-hidden="true" className="shrink-0" />
            <span>重命名</span>
          </button>
          <button
            type="button"
            role="menuitem"
            data-folder-context-action="move"
            className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
            onClick={() => runAction(() => handlers?.onFolderMove?.(menu.folderId, menu.triggerElement))}
          >
            <Icon name="Move" size={14} aria-hidden="true" className="shrink-0" />
            <span>移动到…</span>
          </button>
          <div role="separator" className="my-1 h-px bg-ds-border-subtle" />
          <button
            type="button"
            role="menuitem"
            data-folder-context-action="delete"
            className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-danger-text outline-none hover:bg-ds-danger-soft focus-visible:bg-ds-danger-soft"
            onClick={() => runAction(() => handlers?.onFolderDelete?.(menu.folderId, menu.triggerElement))}
          >
            <Icon name="Trash2" size={14} aria-hidden="true" className="shrink-0" />
            <span>删除文件夹</span>
          </button>
        </>
      ) : null}
    </div>,
    document.body
  )
}

interface PopupBookmarkContextMenuState {
  bookmarkId: string
  isSearch: boolean
  parentId: string
  selected: boolean
  title: string
  triggerElement: HTMLElement | null
  x: number
  y: number
}

function PopupBookmarkContextMenu({
  handlers,
  menu,
  multiSelectActive,
  onClose,
  scopeFolderId
}: {
  handlers?: PopupContentActionHandlers
  menu: PopupBookmarkContextMenuState
  multiSelectActive: boolean
  onClose: (restoreFocus?: boolean) => void
  scopeFolderId?: string
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: menu.x, top: menu.y })

  useLayoutEffect(() => {
    const element = menuRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const padding = 8
    const nextLeft = Math.max(padding, Math.min(menu.x, window.innerWidth - rect.width - padding))
    const nextTop = Math.max(padding, Math.min(menu.y, window.innerHeight - rect.height - padding))
    setPosition({ left: Math.round(nextLeft), top: Math.round(nextTop) })
    const firstItem = element.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
    firstItem?.focus({ preventScroll: true })
  }, [menu.bookmarkId, menu.x, menu.y])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return
      }
      onClose(false)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const element = menuRef.current
      if (!element) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose(true)
        return
      }
      const items = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'))
      if (!items.length) return
      const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        items[(activeIndex + 1 + items.length) % items.length]?.focus({ preventScroll: true })
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        items[(activeIndex - 1 + items.length) % items.length]?.focus({ preventScroll: true })
      } else if (event.key === 'Home') {
        event.preventDefault()
        items[0]?.focus({ preventScroll: true })
      } else if (event.key === 'End') {
        event.preventDefault()
        items[items.length - 1]?.focus({ preventScroll: true })
      }
    }
    const handleDismiss = () => onClose(false)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleDismiss, true)
    window.addEventListener('blur', handleDismiss)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleDismiss, true)
      window.removeEventListener('blur', handleDismiss)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  const canLocate = Boolean(menu.parentId && (menu.isSearch || !scopeFolderId || menu.parentId !== scopeFolderId))
  const runAction = (callback: () => void) => {
    onClose(false)
    callback()
  }

  return createPortal(
    <div
      ref={menuRef}
      id="popup-bookmark-context-menu"
      role="menu"
      aria-label={`书签「${menu.title}」操作`}
      className="popup-folder-context-menu fixed z-[10000] w-[196px] max-w-[calc(100vw_-_16px)] rounded-ds-menu border border-ds-border bg-ds-surface-2 ds-inset-menu [filter:var(--ds-filter-popover)] outline-none"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
    >
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="open"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onBookmarkOpen?.(menu.bookmarkId))}
      >
        <Icon name="ExternalLink" size={14} aria-hidden="true" className="shrink-0" />
        <span>在新标签页打开</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="open-background"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onMenuAction?.(menu.bookmarkId, 'open-background', menu.triggerElement))}
      >
        <Icon name="ExternalLink" size={14} aria-hidden="true" className="shrink-0" />
        <span>在后台打开</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="open-current-tab"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onMenuAction?.(menu.bookmarkId, 'open-current-tab', menu.triggerElement))}
      >
        <Icon name="ExternalLink" size={14} aria-hidden="true" className="shrink-0" />
        <span>在当前页打开</span>
      </button>
      <div role="separator" className="my-1 h-px bg-ds-border-subtle" />
      {canLocate ? (
        <button
          type="button"
          role="menuitem"
          data-bookmark-context-action="locate-folder"
          className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
          onClick={() => runAction(() => handlers?.onBookmarkLocateFolder?.(menu.bookmarkId))}
        >
          <Icon name="FolderOpen" size={14} aria-hidden="true" className="shrink-0" />
          <span>定位所在文件夹</span>
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="move"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onMenuAction?.(menu.bookmarkId, 'move', menu.triggerElement))}
      >
        <Icon name="Move" size={14} aria-hidden="true" className="shrink-0" />
        <span>移动到…</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="edit"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onMenuAction?.(menu.bookmarkId, 'edit', menu.triggerElement))}
      >
        <Icon name="Pencil" size={14} aria-hidden="true" className="shrink-0" />
        <span>编辑</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="copy-url"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onMenuAction?.(menu.bookmarkId, 'copy-url', menu.triggerElement))}
      >
        <Icon name="Copy" size={14} aria-hidden="true" className="shrink-0" />
        <span>复制链接</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="select"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover"
        onClick={() => runAction(() => handlers?.onBookmarkSelectFromContext?.(menu.bookmarkId))}
      >
        <Icon name="ListChecks" size={14} aria-hidden="true" className="shrink-0" />
        <span>{multiSelectActive ? (menu.selected ? '取消选中' : '选中此书签') : '多选此书签'}</span>
      </button>
      <div role="separator" className="my-1 h-px bg-ds-border-subtle" />
      <button
        type="button"
        role="menuitem"
        data-bookmark-context-action="delete"
        className="curator-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-ds-sm px-2.5 py-2 text-left text-[13px] font-medium text-ds-danger-text outline-none hover:bg-ds-danger-soft focus-visible:bg-ds-danger-soft"
        onClick={() => runAction(() => handlers?.onMenuAction?.(menu.bookmarkId, 'delete', menu.triggerElement))}
      >
        <Icon name="Trash2" size={14} aria-hidden="true" className="shrink-0" />
        <span>删除</span>
      </button>
    </div>,
    document.body
  )
}

function PopupSelectionDock({
  handlers,
  selection
}: {
  handlers?: PopupContentActionHandlers
  selection: PopupSelectionViewModel
}) {
  const hasSelected = selection.selectedCount > 0

  return (
    <div
      id="popup-selection-dock"
      className="popup-selection-dock"
      role="region"
      aria-label="书签批量操作"
    >
      <span className="popup-selection-dock-count" aria-live="polite">
        {hasSelected ? (
          <>已选 <strong className="t-number-value font-semibold text-ds-text-primary">{selection.selectedCount}</strong> 项</>
        ) : (
          <span className="@max-[460px]/popup:hidden">点选或拖滑选择</span>
        )}
        {!hasSelected ? <span className="hidden @max-[460px]/popup:inline">未选择</span> : null}
      </span>
      <div className="flex flex-none items-center gap-1.5 @max-[460px]/popup:gap-1">
        <Button
          id="popup-selection-toggle-all"
          className="popup-selection-dock-btn popup-selection-dock-secondary"
          type="button"
          disabled={selection.busy || selection.totalCount === 0}
          onClick={() => handlers?.onToggleSelectAll?.()}
          unstyled
        >
          {selection.allSelected ? '取消全选' : '全选'}
        </Button>
        <Button
          id="popup-selection-move"
          className="popup-selection-dock-btn popup-selection-dock-primary"
          type="button"
          disabled={selection.busy || !hasSelected}
          onClick={(event) => handlers?.onBatchMoveSelected?.(event.currentTarget)}
          unstyled
        >
          <Icon name="Move" size={13} aria-hidden="true" />
          <span>移动到…</span>
        </Button>
        <Button
          id="popup-selection-delete"
          className="popup-selection-dock-btn popup-selection-dock-danger"
          type="button"
          disabled={selection.busy || !hasSelected}
          onClick={() => handlers?.onBatchDeleteSelected?.()}
          unstyled
        >
          <Icon name="Trash2" size={13} aria-hidden="true" />
          <span>删除</span>
        </Button>
        <Button
          id="popup-selection-exit"
          className={paneHeaderIconActionClass}
          type="button"
          aria-label="退出多选"
          title="退出多选 (Esc)"
          disabled={selection.busy}
          onClick={() => handlers?.onSelectionModeChange?.(false)}
          unstyled
        >
          <Icon name="X" size={14} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
