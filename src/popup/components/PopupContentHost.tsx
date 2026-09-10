import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  dispatchPopupContentAction,
  dispatchPopupContentResultHover,
  getPopupContentSnapshot,
  subscribePopupContentChange
} from '../popup-controller-store'
import {
  PopupContent,
  type PopupContentActionHandlers
} from './PopupContent'
import {
  getClippedActiveResultIndicatorGeometry,
  getActiveResultContentTop,
  getActiveResultRevealScrollBehavior,
  getActiveResultRevealScrollTop
} from '../popup-active-result-scroll'
import type {
  PopupContentFolderRowViewModel,
  PopupContentMainRowViewModel,
  PopupContentRowViewModel,
  PopupContentViewModel
} from './PopupViewModels'

const contentHostClass = 'relative z-0 block h-full min-h-0 overflow-hidden'

const INITIAL_CONTENT_STATE: PopupContentViewModel = {
  loading: true,
  rows: [],
  title: '书签栏'
}

interface ActiveResultIndicatorGeometry {
  height: number
  left: number
  top: number
  visible: boolean
  width: number
}

const HIDDEN_ACTIVE_RESULT_INDICATOR: ActiveResultIndicatorGeometry = {
  height: 0,
  left: 0,
  top: 0,
  visible: false,
  width: 0
}

export function PopupContentHost() {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const mainListRef = useRef<HTMLUListElement | null>(null)
  const activeResultRef = useRef<HTMLLIElement | null>(null)
  const folderTreeRef = useRef<HTMLDivElement | null>(null)
  const activeFolderRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollTopRef = useRef<number | null>(null)
  const shouldRevealActiveResultRef = useRef(false)
  const indicatorElementRef = useRef<HTMLDivElement | null>(null)
  const indicatorRevealFrameRef = useRef(0)
  const indicatorScrollFrameRef = useRef(0)
  const activeResultIndicatorRef = useRef<ActiveResultIndicatorGeometry>(HIDDEN_ACTIVE_RESULT_INDICATOR)
  const [state, setState] = useState<PopupContentViewModel>(() => getPopupContentSnapshot().state)
  const handlers = useMemo<PopupContentActionHandlers>(() => ({
    onBookmarkOpen: (bookmarkId) => {
      dispatchPopupContentAction({ action: 'open-bookmark', bookmarkId })
    },
    onEmptyAction: (emptyAction) => {
      dispatchPopupContentAction({ action: 'empty-action', emptyAction })
    },
    onFolderFilter: (folderId) => {
      dispatchPopupContentAction({ action: 'filter-folder', folderId })
    },
    onFolderFocus: (index) => {
      dispatchPopupContentAction({ action: 'set-active-folder', index })
    },
    onKeyboardNavigate: (key) => {
      dispatchPopupContentAction({ action: 'keyboard-navigate', menuAction: key })
      return true
    },
    onMenuAction: (bookmarkId, menuAction, returnFocusElement) => {
      dispatchPopupContentAction({ action: 'menu-action', bookmarkId, menuAction, returnFocusElement })
    },
    onBookmarkReorder: (bookmarkId, index) => {
      dispatchPopupContentAction({ action: 'reorder-bookmark', bookmarkId, index })
    },
    onReorderModeChange: (active) => {
      dispatchPopupContentAction({ action: active ? 'enter-bookmark-reorder' : 'exit-bookmark-reorder' })
    },
    onRowFocus: (index) => {
      dispatchPopupContentAction({ action: 'set-active-result', index })
    },
    onResultHover: (index) => {
      dispatchPopupContentResultHover(index)
    }
  }), [])
  const activeResultObserverKey = getActiveResultObserverKey(state)
  const activeFolderObserverKey = getActiveFolderObserverKey(state)
  const commitActiveResultIndicator = useCallback((next: ActiveResultIndicatorGeometry) => {
    const indicator = indicatorElementRef.current
    if (!indicator) return
    const current = activeResultIndicatorRef.current
    if (areActiveResultIndicatorsEqual(current, next)) return

    // Stage a newly visible indicator at its destination while hidden. The next
    // layout frame reveals it, so cross-pane moves never fly in diagonally.
    const stageReveal = next.visible && !current.visible
    const committed = stageReveal ? { ...next, visible: false } : next
    activeResultIndicatorRef.current = committed

    // This is scroll geometry, not content state. Keep the existing CSS motion
    // while updating only the indicator, without reconciling either list.
    indicator.style.height = `${Math.round(committed.height)}px`
    indicator.style.width = `${Math.round(committed.width)}px`
    indicator.style.transform = `translate3d(${Math.round(committed.left)}px, ${Math.round(committed.top)}px, 0)`
    if (committed.visible) indicator.dataset.visible = 'true'
    else delete indicator.dataset.visible

    if (!next.visible) {
      cancelAnimationFrame(indicatorRevealFrameRef.current)
      indicatorRevealFrameRef.current = 0
    } else if (stageReveal && !indicatorRevealFrameRef.current) {
      // Commit the hidden destination before enabling its CSS transition.
      // This read happens only on reveal, never while an indicator is moving.
      void indicator.getBoundingClientRect()
      indicatorRevealFrameRef.current = requestAnimationFrame(() => {
        indicatorRevealFrameRef.current = 0
        const latest = activeResultIndicatorRef.current
        const element = indicatorElementRef.current
        if (!element || latest.visible || !latest.width || !latest.height) return
        activeResultIndicatorRef.current = { ...latest, visible: true }
        element.dataset.visible = 'true'
      })
    }
  }, [])

  const remeasureIndicator = useCallback(() => {
    const workspace = workspaceRef.current
    const inFolderPane = state.keyboardPane === 'folders'
    const target = inFolderPane
      ? (activeFolderRef.current?.querySelector<HTMLElement>('button') ?? activeFolderRef.current ?? null)
      : (activeResultRef.current?.querySelector<HTMLElement>('.popup-list-button') ?? activeResultRef.current ?? null)
    const viewport = inFolderPane ? folderTreeRef.current : mainListRef.current
    const next = measureWorkspaceIndicator(workspace, target, viewport)
    commitActiveResultIndicator(next)
  }, [commitActiveResultIndicator, state.keyboardPane])

  useEffect(() => () => {
    cancelAnimationFrame(indicatorRevealFrameRef.current)
    cancelAnimationFrame(indicatorScrollFrameRef.current)
  }, [])

  useEffect(() => {
    return subscribePopupContentChange((detail) => {
      const scrollContainer = mainListRef.current || contentRef.current

      pendingScrollTopRef.current = detail.preserveScroll && scrollContainer
        ? scrollContainer.scrollTop
        : null
      shouldRevealActiveResultRef.current = !detail.preserveScroll
      setState(detail.state ?? INITIAL_CONTENT_STATE)
    })
  }, [])

  useLayoutEffect(() => {
    const scrollContainer = mainListRef.current || contentRef.current
    if (!scrollContainer) {
      commitActiveResultIndicator(HIDDEN_ACTIVE_RESULT_INDICATOR)
      return
    }

    const pendingScrollTop = pendingScrollTopRef.current
    if (pendingScrollTop !== null) {
      scrollContainer.scrollTop = pendingScrollTop
      pendingScrollTopRef.current = null
      shouldRevealActiveResultRef.current = false
      remeasureIndicator()
      return
    }

    if (!shouldRevealActiveResultRef.current) {
      remeasureIndicator()
      return
    }

    shouldRevealActiveResultRef.current = false
    const revealScrollBehavior = getActiveResultRevealScrollBehavior(
      prefersReducedMotion(),
      isKeyboardNavigationActive()
    )

    // Scroll-reveal only applies to the bookmark pane
    const activeResult = activeResultRef.current
    if (activeResult) {
      const resultRect = activeResult.getBoundingClientRect()
      const scrollRect = scrollContainer.getBoundingClientRect()
      const resultTop = getActiveResultContentTop({
        activeResultTop: resultRect.top,
        scrollContainerTop: scrollRect.top,
        scrollTop: scrollContainer.scrollTop
      })
      const nextScrollTop = getActiveResultRevealScrollTop({
        itemHeight: resultRect.height || activeResult.offsetHeight,
        itemTop: resultTop,
        maxScrollTop: Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight),
        viewportHeight: scrollContainer.clientHeight,
        viewportTop: scrollContainer.scrollTop
      })
      if (nextScrollTop !== null) {
        scrollContainer.scrollTo({
          behavior: revealScrollBehavior,
          top: nextScrollTop
        })
      }
    }

    // Scroll-reveal for folder pane
    const activeFolder = activeFolderRef.current
    if (activeFolder && folderTreeRef.current) {
      const tree = folderTreeRef.current
      const folderRect = activeFolder.getBoundingClientRect()
      const treeRect = tree.getBoundingClientRect()
      const folderTop = folderRect.top - treeRect.top + tree.scrollTop
      const nextFolderScrollTop = getActiveResultRevealScrollTop({
        itemHeight: folderRect.height || activeFolder.offsetHeight,
        itemTop: folderTop,
        maxScrollTop: Math.max(0, tree.scrollHeight - tree.clientHeight),
        viewportHeight: tree.clientHeight,
        viewportTop: tree.scrollTop
      })
      if (nextFolderScrollTop !== null) {
        tree.scrollTo({
          behavior: revealScrollBehavior,
          top: nextFolderScrollTop
        })
      }
    }

    remeasureIndicator()
  }, [commitActiveResultIndicator, remeasureIndicator, state])

  useEffect(() => {
    const list = mainListRef.current
    const activeResult = activeResultRef.current
    const folder = activeFolderRef.current
    const workspace = workspaceRef.current
    if (!workspace || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      remeasureIndicator()
    })
    const target = state.keyboardPane === 'folders'
      ? (folder?.querySelector<HTMLElement>('button') ?? folder ?? null)
      : (activeResult?.querySelector<HTMLElement>('.popup-list-button') ?? activeResult ?? null)
    const activeRow = state.keyboardPane === 'folders' ? folder : activeResult
    const rowActions = state.keyboardPane === 'folders'
      ? null
      : (activeResult?.querySelector<HTMLElement>('.popup-row-actions') ?? null)
    const observedTargets = new Set<Element>([
      workspace,
      ...(list ? [list] : []),
      ...(activeRow ? [activeRow] : []),
      ...(target ? [target] : []),
      ...(rowActions ? [rowActions] : [])
    ])
    observedTargets.forEach((observedTarget) => observer.observe(observedTarget))

    return () => observer.disconnect()
  }, [activeFolderObserverKey, activeResultObserverKey, remeasureIndicator, state.keyboardPane])

  // Only scrolling the selected pane can move the indicator. Reading the other
  // pane's geometry here would unnecessarily flush its hover styles as well.
  useEffect(() => {
    const viewport = state.keyboardPane === 'folders' ? folderTreeRef.current : mainListRef.current
    if (!viewport) return undefined

    // Do not synchronously read layout from the native scroll event. The main
    // pane can contain a large virtualized catalog, and forcing geometry reads
    // here delays the compositor's first scroll response. The indicator is
    // purely decorative, so one rAF-latched measurement is sufficient.
    const scheduleRemeasure = () => {
      if (indicatorScrollFrameRef.current) return
      indicatorScrollFrameRef.current = requestAnimationFrame(() => {
        indicatorScrollFrameRef.current = 0
        remeasureIndicator()
      })
    }
    viewport.addEventListener('scroll', scheduleRemeasure, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', scheduleRemeasure)
      cancelAnimationFrame(indicatorScrollFrameRef.current)
      indicatorScrollFrameRef.current = 0
    }
  }, [remeasureIndicator, state.keyboardPane])

  return (
    <div
      id="content"
      className={contentHostClass}
      ref={contentRef}
    >
      <PopupContent
        activeResultIndicatorRef={indicatorElementRef}
        activeResultRef={activeResultRef}
        activeFolderRef={activeFolderRef}
        folderTreeRef={folderTreeRef}
        workspaceRef={workspaceRef}
        handlers={handlers}
        mainListRef={mainListRef}
        onRowsLayout={remeasureIndicator}
        state={state}
      />
    </div>
  )
}

function measureWorkspaceIndicator(
  workspace: HTMLElement | null,
  target: HTMLElement | null,
  viewport: HTMLElement | null
): ActiveResultIndicatorGeometry {
  if (!workspace || !target || !viewport) {
    return HIDDEN_ACTIVE_RESULT_INDICATOR
  }

  const workspaceRect = workspace.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const clippedGeometry = getClippedActiveResultIndicatorGeometry(workspaceRect, targetRect, viewportRect)
  if (!clippedGeometry) {
    return HIDDEN_ACTIVE_RESULT_INDICATOR
  }

  return {
    ...clippedGeometry,
    visible: true,
  }
}

function areActiveResultIndicatorsEqual(
  current: ActiveResultIndicatorGeometry,
  next: ActiveResultIndicatorGeometry
): boolean {
  return current.visible === next.visible &&
    Math.round(current.height) === Math.round(next.height) &&
    Math.round(current.left) === Math.round(next.left) &&
    Math.round(current.top) === Math.round(next.top) &&
    Math.round(current.width) === Math.round(next.width)
}

function getActiveResultObserverKey(state: PopupContentViewModel): string {
  const rows = state.mainRows || state.rows.filter(isMainContentRow)
  const activeRow = rows.find((row) => row.active)
  return activeRow ? `${activeRow.kind}:${activeRow.bookmarkId}:${activeRow.index}` : ''
}

function getActiveFolderObserverKey(state: PopupContentViewModel): string {
  const rows = state.sidebarRows || state.rows.filter(isFolderContentRow)
  const activeRow = rows.find((row) => row.keyboardActive)
  return activeRow ? `${activeRow.folderId}:${activeRow.index}` : ''
}

function isMainContentRow(row: PopupContentRowViewModel): row is PopupContentMainRowViewModel {
  return row.kind !== 'folder'
}

function isFolderContentRow(row: PopupContentRowViewModel): row is PopupContentFolderRowViewModel {
  return row.kind === 'folder'
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isKeyboardNavigationActive(): boolean {
  return document.getElementById('popup-app-shell')?.getAttribute('data-keyboard-nav') === 'true'
}
