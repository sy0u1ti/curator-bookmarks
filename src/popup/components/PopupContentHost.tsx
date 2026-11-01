import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import {
  dispatchPopupContentAction,
  dispatchPopupContentResultHover,
  getPopupContentSnapshot,
  subscribePopupContentChange
} from '../popup-controller-store'
import {
  MemoPopupContent as PopupContent,
  type PopupContentActionHandlers
} from './PopupContent'
import {
  getActiveResultTrackingGeometry,
  getActiveResultRevealScrollBehavior,
  getActiveResultRevealScrollTop,
  createPopupRowLayout,
  getPopupRowOffset,
  getPopupRowHeight,
  getPopupEdgeReveal,
  type PopupRowLayout,
  type ActiveResultRectLike
} from '../popup-active-result-scroll'
import { createPopupScrollFollow, POPUP_SELECTION_EASING } from '../popup-scroll-follow'
import { createPopupNavigationViewStore, PopupNavigationContext } from '../popup-navigation-view-store'
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
  clipPath: string
  height: number
  left: number
  top: number
  visible: boolean
  width: number
}

const HIDDEN_ACTIVE_RESULT_INDICATOR: ActiveResultIndicatorGeometry = {
  clipPath: 'none',
  height: 0,
  left: 0,
  top: 0,
  visible: false,
  width: 0
}

export function PopupContentHost() {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const mainListRef = useRef<HTMLDivElement | null>(null)
  const activeResultRef = useRef<HTMLLIElement | null>(null)
  const folderTreeRef = useRef<HTMLDivElement | null>(null)
  const activeFolderRef = useRef<HTMLDivElement | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollTopRef = useRef<number | null>(null)
  const shouldRevealActiveResultRef = useRef(!getPopupContentSnapshot().preserveScroll)
  const keyboardRevealIntentRef = useRef(false)
  const repeatNavigationRef = useRef(false)
  const heldDirectionRef = useRef<-1 | 0 | 1>(0)
  const pinnedEdgeRef = useRef<{ viewport: HTMLElement; direction: -1 | 1; metrics: PaneMetrics } | null>(null)
  const paneMetricsRef = useRef(new Map<string, PaneMetrics>())
  const scrollPositionsRef = useRef(new WeakMap<HTMLElement, number>())
  const rebaseSelectionScrollRef = useRef(true)
  const scrollFollowRef = useRef<{
    viewport: HTMLElement
    follow: ReturnType<typeof createPopupScrollFollow>
  } | null>(null)
  const indicatorMeasurementRef = useRef<IndicatorMeasurement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedTargetsRef = useRef(new Set<Element>())
  const observedContentSizesRef = useRef(new WeakMap<Element, { inline: number; block: number }>())
  const remeasureRef = useRef<() => void>(() => {})
  const revealSelectionRef = useRef<() => void>(() => {})
  const indicatorScrollRef = useRef<{ viewport: HTMLElement | null; top: number; offset: number }>({
    viewport: null, top: 0, offset: 0
  })
  const indicatorElementRef = useRef<HTMLDivElement | null>(null)
  const indicatorRevealFrameRef = useRef(0)
  const indicatorScrollFrameRef = useRef(0)
  const activeResultIndicatorRef = useRef<ActiveResultIndicatorGeometry>(HIDDEN_ACTIVE_RESULT_INDICATOR)
  const navigationStore = useMemo(() => createPopupNavigationViewStore(getPopupContentSnapshot()), [])
  const navigation = useSyncExternalStore(navigationStore.subscribe, navigationStore.getSnapshot, navigationStore.getSnapshot)
  const state = navigation.state
  const stateRef = useRef(state)
  stateRef.current = state
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
    onFolderFilterChange: (value) => {
      dispatchPopupContentAction({ action: 'folder-filter-change', value })
    },
    onFolderFilterApply: () => {
      dispatchPopupContentAction({ action: 'folder-filter-apply' })
    },
    onFolderFilterClear: () => {
      dispatchPopupContentAction({ action: 'clear-folder-filter' })
    },
    onFolderFilterEscape: () => {
      dispatchPopupContentAction({ action: 'folder-filter-escape' })
    },
    onFolderFilterMove: (delta, exitOnEmpty, repeat) => {
      dispatchPopupContentAction({ action: 'folder-filter-move', index: delta, exitOnEmpty, repeat })
    },
    onFolderFocus: (index) => {
      dispatchPopupContentAction({ action: 'set-active-folder', index })
    },
    onKeyboardNavigate: (key, repeat) => {
      dispatchPopupContentAction({ action: 'keyboard-navigate', menuAction: key, repeat })
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
  const readScrollTop = useCallback((viewport: HTMLElement) => {
    let top = scrollPositionsRef.current.get(viewport)
    if (top === undefined) {
      top = viewport.scrollTop
      scrollPositionsRef.current.set(viewport, top)
    }
    return top
  }, [])
  const writeScrollTop = useCallback((viewport: HTMLElement, top: number) => {
    scrollPositionsRef.current.set(viewport, top)
    viewport.scrollTo({ top, behavior: 'instant' })
  }, [])
  const releasePinnedEdge = useCallback(() => {
    const pinned = pinnedEdgeRef.current
    if (!pinned) return
    pinned.viewport.removeAttribute('data-keyboard-scroll')
    pinnedEdgeRef.current = null
    // The pre-hold snapshot belongs to a different row/scroll basis. A native
    // scroll event can arrive before React commits the handoff's fresh one.
    indicatorMeasurementRef.current = null
    cancelAnimationFrame(indicatorScrollFrameRef.current)
    indicatorScrollFrameRef.current = 0
    const indicator = indicatorElementRef.current
    if (indicator) {
      delete indicator.dataset.scrollEdge
    }
    indicatorScrollRef.current.viewport = pinned.viewport
    indicatorScrollRef.current.top = readScrollTop(pinned.viewport)
  }, [readScrollTop])
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
    if (current.clipPath !== committed.clipPath) indicator.style.clipPath = committed.clipPath
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

  const paintIndicatorScroll = useCallback(() => {
    if (pinnedEdgeRef.current) return
    const measurement = indicatorMeasurementRef.current
    if (!measurement) return
    const { viewport, workspaceRect, viewportRect, targetRect, scrollTop } = measurement
    const top = readScrollTop(viewport)
    const tracking = indicatorScrollRef.current
    if (tracking.viewport === viewport) tracking.offset += top - tracking.top
    tracking.viewport = viewport
    tracking.top = top
    const indicator = indicatorElementRef.current
    if (indicator) {
      const translate = tracking.offset ? `0px ${-tracking.offset}px` : '0px'
      if (indicator.style.translate !== translate) indicator.style.translate = translate
    }
    const delta = top - scrollTop
    const geometry = getActiveResultTrackingGeometry(workspaceRect, {
      left: targetRect.left, right: targetRect.right,
      top: targetRect.top - delta, bottom: targetRect.bottom - delta
    }, viewportRect, tracking.offset)
    commitActiveResultIndicator(geometry ? { ...geometry, visible: true } : HIDDEN_ACTIVE_RESULT_INDICATOR)
  }, [commitActiveResultIndicator, readScrollTop])

  const getPaneMetrics = useCallback((): PaneMetrics | null => {
    const view = stateRef.current
    const folders = view.keyboardPane === 'folders'
    const pane = folders ? 'folders' : 'bookmarks'
    const workspace = workspaceRef.current
    const viewport = folders ? folderTreeRef.current : mainListRef.current
    const rows = folders ? view.sidebarRows : view.mainRows
    if (!workspace || !viewport || !rows?.length) return null
    const cached = paneMetricsRef.current.get(pane)
    if (cached?.rows === rows && cached.viewport === viewport) return cached
    const row = (folders ? activeFolderRef.current : activeResultRef.current) ||
      viewport.querySelector<HTMLElement>('[data-popup-row-index]')
    const target = row?.querySelector<HTMLElement>(folders ? 'button' : '.popup-list-button')
    if (!row || !target) return null
    const workspaceRect = workspace.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    scrollPositionsRef.current.set(viewport, viewport.scrollTop)
    const sampleIndex = Number(row.dataset.popupRowIndex) || 0
    const heights = !folders && view.mode === 'search'
      ? (rows as PopupContentMainRowViewModel[]).map(item => item.kind === 'result' ? item.presentation.rowHeight : 60)
      : undefined
    const layout = createPopupRowLayout(rows.length, rowRect.height || (folders ? 34 : 60), heights)
    const metrics: PaneMetrics = {
      workspace, viewport, target, workspaceRect, viewportRect, rows, folders, layout,
      height: viewport.clientHeight,
      origin: rowRect.top - viewportRect.top + viewport.scrollTop - getPopupRowOffset(layout, sampleIndex),
      paddingBottom: Number.parseFloat(getComputedStyle(viewport).paddingBottom) || 0,
      buttonLeft: targetRect.left - viewportRect.left,
      buttonWidth: targetRect.width,
      buttonGap: rowRect.height - targetRect.height
    }
    paneMetricsRef.current.set(pane, metrics)
    return metrics
  }, [])

  const remeasureIndicator = useCallback(() => {
    if (pinnedEdgeRef.current) return
    const metrics = getPaneMetrics()
    const view = stateRef.current
    const index = getActiveIndex(view)
    if (!metrics || index < 0 || index >= metrics.layout.count) {
      indicatorMeasurementRef.current = null
      commitActiveResultIndicator(HIDDEN_ACTIVE_RESULT_INDICATOR)
      return
    }
    const { viewport, workspace, workspaceRect, viewportRect } = metrics
    if (viewport && rebaseSelectionScrollRef.current) {
      indicatorScrollRef.current.viewport = viewport
      indicatorScrollRef.current.top = readScrollTop(viewport)
      rebaseSelectionScrollRef.current = false
    }
    const top = readScrollTop(viewport)
    const target = (metrics.folders ? activeFolderRef.current : activeResultRef.current)
      ?.querySelector<HTMLElement>(metrics.folders ? 'button' : '.popup-list-button') || metrics.target
    indicatorMeasurementRef.current = {
      workspace,
      target,
      workspaceRect,
      targetRect: getRowButtonRect(metrics, index, top),
      viewportRect,
      viewport,
      scrollTop: top
    }
    paintIndicatorScroll()
  }, [commitActiveResultIndicator, getPaneMetrics, paintIndicatorScroll, readScrollTop])
  const onRowsLayout = useCallback(() => {
    // A new virtual window commits before the parent's reveal effect. Reading
    // it at the old scroll offset would hide/reveal an already moving cursor.
    if (!shouldRevealActiveResultRef.current) remeasureIndicator()
  }, [remeasureIndicator])

  useEffect(() => () => {
    cancelAnimationFrame(indicatorRevealFrameRef.current)
    cancelAnimationFrame(indicatorScrollFrameRef.current)
    scrollFollowRef.current?.follow.cancel()
    releasePinnedEdge()
    const observer = resizeObserverRef.current
    if (observer) observer.disconnect()
  }, [releasePinnedEdge])

  useEffect(() => {
    const cancel = () => {
      keyboardRevealIntentRef.current = false
      scrollFollowRef.current?.follow.cancel()
      releasePinnedEdge()
    }
    const interrupt = () => {
      cancel()
      dispatchPopupContentAction({ action: 'interrupt-keyboard-navigation' })
    }
    const onKey = (event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) cancel()
    }
    const onVisibility = () => { if (document.hidden) interrupt() }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    document.addEventListener('wheel', interrupt, { capture: true, passive: true })
    document.addEventListener('touchstart', interrupt, { capture: true, passive: true })
    document.addEventListener('pointerdown', interrupt, true)
    document.addEventListener('input', cancel, true)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', interrupt)
    reduced.addEventListener('change', cancel)
    return () => {
      cancel()
      document.removeEventListener('wheel', interrupt, true)
      document.removeEventListener('touchstart', interrupt, true)
      document.removeEventListener('pointerdown', interrupt, true)
      document.removeEventListener('input', cancel, true)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', interrupt)
      reduced.removeEventListener('change', cancel)
    }
  }, [releasePinnedEdge])

  useEffect(() => {
    return subscribePopupContentChange((detail) => {
      const scrollContainer = mainListRef.current || contentRef.current

      shouldRevealActiveResultRef.current = !detail.preserveScroll
      if (!detail.preserveScroll) {
        keyboardRevealIntentRef.current = detail.navigation === 'repeat' || isKeyboardNavigationActive()
      }
      repeatNavigationRef.current = detail.navigation === 'repeat'
      const previous = stateRef.current
      heldDirectionRef.current = repeatNavigationRef.current
        ? (detail.direction || Math.sign(getActiveIndex(detail.state) - getActiveIndex(previous)) as -1 | 0 | 1)
        : 0
      rebaseSelectionScrollRef.current = !repeatNavigationRef.current
      if (!repeatNavigationRef.current || detail.preserveScroll) {
        scrollFollowRef.current?.follow.cancel()
        releasePinnedEdge()
      }
      // Cancellation flushes a batched compositor offset to native scroll.
      // Preserve that visible position, not the older native checkpoint.
      pendingScrollTopRef.current = detail.preserveScroll && scrollContainer
        ? readScrollTop(scrollContainer)
        : null
      navigationStore.publish({ ...detail, state: detail.state ?? INITIAL_CONTENT_STATE, direction: heldDirectionRef.current })
    })
  }, [navigationStore, readScrollTop, releasePinnedEdge])

  const revealSelection = useCallback(() => {
    const scrollContainer = mainListRef.current
    if (!scrollContainer) {
      commitActiveResultIndicator(HIDDEN_ACTIVE_RESULT_INDICATOR)
      return
    }

    const pendingScrollTop = pendingScrollTopRef.current
    if (pendingScrollTop !== null) {
      if (readScrollTop(scrollContainer) !== pendingScrollTop) writeScrollTop(scrollContainer, pendingScrollTop)
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
      keyboardRevealIntentRef.current || isKeyboardNavigationActive()
    )

    const metrics = getPaneMetrics()
    const index = getActiveIndex(stateRef.current)
    if (!metrics || !metrics.height || index < 0 || index >= metrics.layout.count) {
      scrollFollowRef.current?.follow.cancel()
      releasePinnedEdge()
      commitActiveResultIndicator(HIDDEN_ACTIVE_RESULT_INDICATOR)
      return
    }
    const { viewport, layout } = metrics
    const itemTop = metrics.origin + getPopupRowOffset(layout, index)
    const rowHeight = getPopupRowHeight(layout, index)
    const maxScrollTop = Math.max(0, metrics.origin + getPopupRowOffset(layout, layout.count) +
      metrics.paddingBottom - metrics.height)
    const direction = heldDirectionRef.current
    if (repeatNavigationRef.current && direction) {
      const buttonHeight = rowHeight - metrics.buttonGap
      // While docked, rows travel on the compositor ahead of native scrollTop;
      // judge the edge against what is actually on screen.
      const follow = scrollFollowRef.current
      const viewportTop = pinnedEdgeRef.current?.viewport === viewport && follow?.viewport === viewport
        ? follow.follow.visualPosition : readScrollTop(viewport)
      const edge = getPopupEdgeReveal({
        top: itemTop + getButtonInset(metrics, index), height: buttonHeight,
        viewportTop, viewportHeight: metrics.height, maxScrollTop, direction
      })
      if (edge.pinned) {
        const previous = pinnedEdgeRef.current
        const dock = !previous || previous.viewport !== viewport || previous.direction !== direction
        if (!previous || previous.viewport !== viewport) {
          scrollFollowRef.current?.follow.cancel()
          releasePinnedEdge()
          viewport.dataset.keyboardScroll = 'true'
          const layer = viewport.querySelector<HTMLElement>('.popup-row-layer')!
          scrollFollowRef.current = {
            viewport,
            follow: createPopupScrollFollow({
              read: () => readScrollTop(viewport),
              write: top => writeScrollTop(viewport, top),
              place: offset => { layer.style.transform = `translate3d(0, ${offset}px, 0)` },
              // Keep the moving layer bounded and native thumb error below
              // one pixel. Short lists still synchronize on each input.
              rebaseDistance: Math.min(metrics.height / 2, maxScrollTop / metrics.height),
              now: () => Number(document.timeline.currentTime ?? performance.now()),
              animate: (offset, duration, start, phase, base) => {
                const frames = phase === 'dock' ? [
                  { translate: `0px ${offset}px` },
                  { translate: '0px 0px' }
                ] : [
                  { transform: `translate3d(0, ${base + offset}px, 0)` },
                  { transform: `translate3d(0, ${base}px, 0)` }
                ]
                const motion = layer.animate(frames, {
                  duration, easing: phase === 'dock' ? POPUP_SELECTION_EASING : 'linear'
                })
                motion.startTime = start
                return motion
              }
            })
          }
        }
        pinnedEdgeRef.current = { viewport, direction, metrics }
        scrollFollowRef.current!.follow.moveTo(edge.top, !prefersReducedMotion(), dock)
        const indicator = indicatorElementRef.current
        if (indicator) {
          const edgeName = direction > 0 ? 'end' : 'start'
          if (indicator.dataset.scrollEdge !== edgeName) indicator.dataset.scrollEdge = edgeName
        }
        // Keep the scroll coordinate basis. Resetting translate here would
        // teleport a cursor that was already tracking wheel/native scrolling.
        const scrollOffset = indicatorScrollRef.current.offset
        commitActiveResultIndicator({
          visible: true, clipPath: 'none',
          left: metrics.viewportRect.left - metrics.workspaceRect.left + metrics.buttonLeft,
          top: scrollOffset + (direction > 0
            ? metrics.viewportRect.bottom - metrics.workspaceRect.top - 8 - buttonHeight
            : metrics.viewportRect.top - metrics.workspaceRect.top + 8),
          width: metrics.buttonWidth, height: buttonHeight
        })
        return
      }
    }
    scrollFollowRef.current?.follow.cancel()
    releasePinnedEdge()
    const nextScrollTop = getActiveResultRevealScrollTop({
      itemHeight: rowHeight, itemTop, maxScrollTop,
      viewportHeight: metrics.height, viewportTop: readScrollTop(viewport)
    })
    if (nextScrollTop !== null) {
      if (revealScrollBehavior === 'auto') {
        writeScrollTop(viewport, nextScrollTop)
        indicatorScrollRef.current.viewport = viewport
        indicatorScrollRef.current.top = nextScrollTop
      } else viewport.scrollTo({ behavior: revealScrollBehavior, top: nextScrollTop })
    }
    remeasureIndicator()
  }, [commitActiveResultIndicator, getPaneMetrics, readScrollTop, releasePinnedEdge, remeasureIndicator, writeScrollTop])

  useLayoutEffect(() => {
    revealSelectionRef.current = revealSelection
    revealSelection()
  }, [revealSelection, state])

  useLayoutEffect(() => {
    remeasureRef.current = remeasureIndicator
    const viewport = state.keyboardPane === 'folders' ? folderTreeRef.current : mainListRef.current
    const activeResult = activeResultRef.current
    const folder = activeFolderRef.current
    const workspace = workspaceRef.current
    if (!workspace || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = resizeObserverRef.current ||= new ResizeObserver(entries => {
      const measurement = indicatorMeasurementRef.current
      const contentSizes = observedContentSizesRef.current
      const changed = entries.some(entry => {
        // The feedback scroll tail changes padding, not the border box. The
        // cached scroll range must still be rebuilt when it appears or goes.
        const content = entry.contentBoxSize[0]
        const previous = contentSizes.get(entry.target)
        if (content) contentSizes.set(entry.target, { inline: content.inlineSize, block: content.blockSize })
        if (previous && content && (Math.abs(previous.inline - content.inlineSize) > 0.5 ||
          Math.abs(previous.block - content.blockSize) > 0.5)) return true
        const rect = entry.target === measurement?.workspace ? measurement.workspaceRect
          : entry.target === measurement?.viewport ? measurement.viewportRect
            : entry.target === measurement?.target ? measurement.targetRect : null
        const size = entry.borderBoxSize[0]
        return !rect || !size || Math.abs(size.inlineSize - (rect.right - rect.left)) > 0.5 ||
          Math.abs(size.blockSize - (rect.bottom - rect.top)) > 0.5
      })
      if (changed) {
        scrollFollowRef.current?.follow.cancel()
        releasePinnedEdge()
        paneMetricsRef.current.clear()
        // Keyboard input can finish an in-progress panel resize immediately.
        // Repositioning the cursor alone would leave its row outside the new
        // viewport; repeat the same reveal using the now-final geometry.
        if (keyboardRevealIntentRef.current) {
          pendingScrollTopRef.current = null
          shouldRevealActiveResultRef.current = true
          revealSelectionRef.current()
        } else remeasureRef.current()
      }
    })
    const target = state.keyboardPane === 'folders'
      ? (folder?.querySelector<HTMLElement>('button') ?? folder ?? null)
      : (activeResult?.querySelector<HTMLElement>('.popup-list-button') ?? activeResult ?? null)
    const observedTargets = new Set<Element>([
      workspace,
      ...(viewport ? [viewport] : []),
      ...(target && !pinnedEdgeRef.current ? [target] : [])
    ])
    for (const previous of observedTargetsRef.current) {
      if (!observedTargets.has(previous)) observer.unobserve(previous)
    }
    observedTargets.forEach((observedTarget) => {
      if (!observedTargetsRef.current.has(observedTarget)) observer.observe(observedTarget)
    })
    observedTargetsRef.current = observedTargets
  }, [activeFolderObserverKey, activeResultObserverKey, releasePinnedEdge, remeasureIndicator, state.keyboardPane])

  // Native scroll events update both caches after layout. Selection layout
  // effects must not read scrollTop after React writes row/action styles: that
  // otherwise forces synchronous layout before the 100ms glide can even start.
  useEffect(() => {
    const viewports = [folderTreeRef.current, mainListRef.current].filter((item): item is HTMLDivElement => Boolean(item))
    const selectedViewport = state.keyboardPane === 'folders' ? folderTreeRef.current : mainListRef.current

    const scheduleRemeasure = (event: Event) => {
      const viewport = event.currentTarget as HTMLElement
      const top = viewport.scrollTop
      scrollPositionsRef.current.set(viewport, top)
      if (viewport !== selectedViewport) return
      const pinned = pinnedEdgeRef.current
      if (pinned?.viewport === viewport) {
        if (scrollFollowRef.current?.follow.observe(top) === false) {
          releasePinnedEdge()
          dispatchPopupContentAction({ action: 'interrupt-keyboard-navigation' })
        }
        return
      }
      if (indicatorScrollFrameRef.current) return
      indicatorScrollFrameRef.current = requestAnimationFrame(() => {
        indicatorScrollFrameRef.current = 0
        paintIndicatorScroll()
      })
    }
    viewports.forEach(viewport => viewport.addEventListener('scroll', scheduleRemeasure, { passive: true }))
    return () => {
      viewports.forEach(viewport => viewport.removeEventListener('scroll', scheduleRemeasure))
      cancelAnimationFrame(indicatorScrollFrameRef.current)
      indicatorScrollFrameRef.current = 0
    }
  }, [paintIndicatorScroll, releasePinnedEdge, state.keyboardPane])

  return (
    <div
      id="content"
      className={contentHostClass}
      ref={contentRef}
    >
      <PopupNavigationContext.Provider value={navigationStore}>
      <PopupContent
        activeResultIndicatorRef={indicatorElementRef}
        activeResultRef={activeResultRef}
        activeFolderRef={activeFolderRef}
        folderTreeRef={folderTreeRef}
        workspaceRef={workspaceRef}
        handlers={handlers}
        mainListRef={mainListRef}
        onRowsLayout={onRowsLayout}
        revealActiveRow={shouldRevealActiveResultRef.current}
        heldDirection={heldDirectionRef.current}
        state={navigation.presentation}
      />
      </PopupNavigationContext.Provider>
    </div>
  )
}

interface IndicatorMeasurement {
  workspace: HTMLElement
  target: HTMLElement
  viewport: HTMLElement
  workspaceRect: ActiveResultRectLike
  targetRect: ActiveResultRectLike
  viewportRect: ActiveResultRectLike
  scrollTop: number
}

interface PaneMetrics {
  workspace: HTMLElement
  viewport: HTMLElement
  target: HTMLElement
  workspaceRect: ActiveResultRectLike
  viewportRect: ActiveResultRectLike
  rows: PopupContentRowViewModel[]
  folders: boolean
  layout: PopupRowLayout
  height: number
  origin: number
  paddingBottom: number
  buttonLeft: number
  buttonWidth: number
  buttonGap: number
}

function getButtonInset(metrics: PaneMetrics, index: number): number {
  return (metrics.buttonGap + (!metrics.folders && index > 0 ? 1 : 0)) / 2
}

function getRowButtonRect(metrics: PaneMetrics, index: number, scrollTop: number): ActiveResultRectLike {
  const left = metrics.viewportRect.left + metrics.buttonLeft
  const top = metrics.viewportRect.top + metrics.origin + getPopupRowOffset(metrics.layout, index) +
    getButtonInset(metrics, index) - scrollTop
  return {
    left, top, right: left + metrics.buttonWidth,
    bottom: top + getPopupRowHeight(metrics.layout, index) - metrics.buttonGap
  }
}

function getActiveIndex(state: PopupContentViewModel): number {
  if (state.keyboardPane === 'folders') {
    return state.activeFolderIndex ?? (state.sidebarRows || []).findIndex(row => row.keyboardActive)
  }
  return state.activeResultIndex ?? (state.mainRows || state.rows.filter(isMainContentRow)).findIndex(row => row.active)
}
function areActiveResultIndicatorsEqual(
  current: ActiveResultIndicatorGeometry,
  next: ActiveResultIndicatorGeometry
): boolean {
  return current.visible === next.visible && current.clipPath === next.clipPath &&
    Math.round(current.height) === Math.round(next.height) &&
    Math.round(current.left) === Math.round(next.left) &&
    Math.round(current.top) === Math.round(next.top) &&
    Math.round(current.width) === Math.round(next.width)
}

function getActiveResultObserverKey(state: PopupContentViewModel): string {
  const rows = state.mainRows || state.rows.filter(isMainContentRow)
  const activeRow = state.activeResultIndex !== undefined ? rows[state.activeResultIndex] : rows.find((row) => row.active)
  return activeRow ? `${activeRow.kind}:${activeRow.bookmarkId}:${activeRow.index}` : ''
}

function getActiveFolderObserverKey(state: PopupContentViewModel): string {
  const rows = state.sidebarRows || state.rows.filter(isFolderContentRow)
  const activeRow = state.activeFolderIndex !== undefined ? rows[state.activeFolderIndex] : rows.find((row) => row.keyboardActive)
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
