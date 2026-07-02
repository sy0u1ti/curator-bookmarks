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
      updateActiveResultIndicator(setActiveResultIndicator, mainListRef.current, activeResultRef.current)
      return
    }

    if (!shouldRevealActiveResultRef.current) {
      updateActiveResultIndicator(setActiveResultIndicator, mainListRef.current, activeResultRef.current)
      return
    }

    shouldRevealActiveResultRef.current = false
    const activeResult = activeResultRef.current
    if (!activeResult) {
      updateActiveResultIndicator(setActiveResultIndicator, mainListRef.current, null)
      return
    }

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
    updateActiveResultIndicator(setActiveResultIndicator, mainListRef.current, activeResult)
  }, [state])

  useEffect(() => {
    const list = mainListRef.current
    const activeResult = activeResultRef.current
    if (!list || !activeResult || typeof ResizeObserver === 'undefined') {
      return
    }

    const target = getActiveResultIndicatorTarget(activeResult)
    const observer = new ResizeObserver(() => {
      updateActiveResultIndicator(setActiveResultIndicator, list, activeResult)
    })

    observer.observe(list)
    observer.observe(activeResult)
    if (target !== activeResult) {
      observer.observe(target)
    }

    return () => observer.disconnect()
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
        handlers={handlers}
        mainListRef={mainListRef}
        state={state}
      />
    </div>
  )
}

function updateActiveResultIndicator(
  setActiveResultIndicator: (updater: (current: ActiveResultIndicatorGeometry) => ActiveResultIndicatorGeometry) => void,
  list: HTMLUListElement | null,
  activeResult: HTMLLIElement | null
): void {
  const next = measureActiveResultIndicator(list, activeResult)
  setActiveResultIndicator((current) => {
    return areActiveResultIndicatorsEqual(current, next) ? current : next
  })
}

function measureActiveResultIndicator(
  list: HTMLUListElement | null,
  activeResult: HTMLLIElement | null
): ActiveResultIndicatorGeometry {
  if (!list || !activeResult) {
    return HIDDEN_ACTIVE_RESULT_INDICATOR
  }

  const target = getActiveResultIndicatorTarget(activeResult)
  const listRect = list.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const width = Math.max(0, targetRect.width)
  const height = Math.max(0, targetRect.height)
  if (!width || !height) {
    return HIDDEN_ACTIVE_RESULT_INDICATOR
  }

  return {
    height,
    left: targetRect.left - listRect.left + list.scrollLeft,
    top: targetRect.top - listRect.top + list.scrollTop,
    visible: true,
    width
  }
}

function getActiveResultIndicatorTarget(activeResult: HTMLLIElement): HTMLElement {
  return activeResult.querySelector<HTMLElement>('.popup-list-button') || activeResult
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
