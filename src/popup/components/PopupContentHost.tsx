import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  getActiveResultContentTop,
  getActiveResultRevealScrollBehavior,
  getActiveResultRevealScrollTop
} from '../popup-active-result-scroll'
import type { PopupContentViewModel } from './PopupViewModels'

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
    onMenuAction: (bookmarkId, menuAction, returnFocusElement) => {
      dispatchPopupContentAction({ action: 'menu-action', bookmarkId, menuAction, returnFocusElement })
    },
    onResultHover: (index) => {
      dispatchPopupContentResultHover(index)
    }
  }), [])

  function remeasureIndicator() {
    const workspace = workspaceRef.current
    const inFolderPane = state.keyboardPane === 'folders'
    if (inFolderPane) {
      const folderDiv = activeFolderRef.current
      const target = folderDiv?.querySelector<HTMLElement>('button') ?? folderDiv ?? null
      updateActiveResultIndicator(setActiveResultIndicator, workspace, target)
    } else {
      const activeResult = activeResultRef.current
      const target = activeResult
        ? (activeResult.querySelector<HTMLElement>('.popup-list-button') ?? activeResult)
        : null
      updateActiveResultIndicator(setActiveResultIndicator, workspace, target)
    }
  }

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
      updateActiveResultIndicator(setActiveResultIndicator, null, null)
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
          behavior: getActiveResultRevealScrollBehavior(prefersReducedMotion()),
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
          behavior: getActiveResultRevealScrollBehavior(prefersReducedMotion()),
          top: nextFolderScrollTop
        })
      }
    }

    remeasureIndicator()
  }, [state])

  useEffect(() => {
    const list = mainListRef.current
    const activeResult = activeResultRef.current
    const folder = activeFolderRef.current
    const workspace = workspaceRef.current
    if (!workspace || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      remeasureIndicator()
    })

    observer.observe(workspace)
    if (list) observer.observe(list)
    if (activeResult) observer.observe(activeResult)
    if (folder) observer.observe(folder)

    return () => observer.disconnect()
  }, [state])

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
  }, [state])

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

function updateActiveResultIndicator(
  setActiveResultIndicator: (updater: (current: ActiveResultIndicatorGeometry) => ActiveResultIndicatorGeometry) => void,
  workspace: HTMLElement | null,
  target: HTMLElement | null
): void {
  const next = measureWorkspaceIndicator(workspace, target)
  setActiveResultIndicator((current) => {
    return areActiveResultIndicatorsEqual(current, next) ? current : next
  })
}

function measureWorkspaceIndicator(
  workspace: HTMLElement | null,
  target: HTMLElement | null
): ActiveResultIndicatorGeometry {
  if (!workspace || !target) {
    return HIDDEN_ACTIVE_RESULT_INDICATOR
  }

  const workspaceRect = workspace.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const width = Math.max(0, targetRect.width)
  const height = Math.max(0, targetRect.height)
  if (!width || !height) {
    return HIDDEN_ACTIVE_RESULT_INDICATOR
  }

  return {
    height,
    left: targetRect.left - workspaceRect.left,
    top: targetRect.top - workspaceRect.top,
    visible: true,
    width
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

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
