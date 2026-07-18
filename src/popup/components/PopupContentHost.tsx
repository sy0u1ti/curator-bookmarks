import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  dispatchPopupContentAction,
  dispatchPopupContentResultHover,
  subscribePopupContentChange
} from '../popup-controller-store'
import {
  PopupContent,
  type PopupActiveResultIndicatorState,
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
  const revealPendingRef = useRef(false)
  const activeResultIndicatorRef = useRef<ActiveResultIndicatorGeometry>(HIDDEN_ACTIVE_RESULT_INDICATOR)
  const [state, setState] = useState<PopupContentViewModel>(INITIAL_CONTENT_STATE)
  const [activeResultIndicator, setActiveResultIndicator] = useState<ActiveResultIndicatorGeometry>(
    HIDDEN_ACTIVE_RESULT_INDICATOR
  )
  const activeResultIndicatorView = useMemo<PopupActiveResultIndicatorState>(() => {
    const height = Math.round(activeResultIndicator.height)
    const left = Math.round(activeResultIndicator.left)
    const top = Math.round(activeResultIndicator.top)
    const width = Math.round(activeResultIndicator.width)

    return {
      style: {
        height: `${height}px`,
        transform: `translate3d(${left}px, ${top}px, 0)`,
        width: `${width}px`
      },
      visible: activeResultIndicator.visible
    }
  }, [
    activeResultIndicator.height,
    activeResultIndicator.left,
    activeResultIndicator.top,
    activeResultIndicator.visible,
    activeResultIndicator.width
  ])
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
    const current = activeResultIndicatorRef.current
    if (areActiveResultIndicatorsEqual(current, next)) return

    // Stage a newly visible indicator at its destination while hidden. The next
    // layout frame reveals it, so cross-pane moves never fly in diagonally.
    const stageReveal = next.visible && !current.visible
    const committed = stageReveal ? { ...next, visible: false } : next
    if (stageReveal) {
      revealPendingRef.current = true
    }
    activeResultIndicatorRef.current = committed
    setActiveResultIndicator(committed)
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

  // Phase 2 of the two-phase reveal: after the browser paints the indicator at
  // its correct position but still invisible, set visible=true so only opacity
  // fades in.
  useLayoutEffect(() => {
    if (!revealPendingRef.current) return
    revealPendingRef.current = false
    const frameId = requestAnimationFrame(() => {
      const current = activeResultIndicatorRef.current
      if (current.visible || !current.width || !current.height) return
      const next = { ...current, visible: true }
      activeResultIndicatorRef.current = next
      setActiveResultIndicator(next)
    })
    return () => cancelAnimationFrame(frameId)
  })

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

  // Remeasure when either scroll container scrolls
  useEffect(() => {
    const list = mainListRef.current
    const tree = folderTreeRef.current
    const handler = () => remeasureIndicator()
    list?.addEventListener('scroll', handler, { passive: true })
    tree?.addEventListener('scroll', handler, { passive: true })
    return () => {
      list?.removeEventListener('scroll', handler)
      tree?.removeEventListener('scroll', handler)
    }
  }, [remeasureIndicator])

  return (
    <div
      id="content"
      className={contentHostClass}
      ref={contentRef}
    >
      <PopupContent
        activeResultIndicator={activeResultIndicatorView}
        activeResultRef={activeResultRef}
        activeFolderRef={activeFolderRef}
        folderTreeRef={folderTreeRef}
        workspaceRef={workspaceRef}
        handlers={handlers}
        mainListRef={mainListRef}
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
