import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_SCROLL_TOP_THRESHOLD,
  ScrollToTopButton,
  useScrollToTop
} from '../../ui/base/ScrollToTopButton'
import type { OptionsSectionKey } from '../options-section-store'
import { useOptionsUndoToastView } from './options-undo-toast-store.js'
import { useSelectionDockMetrics, type SelectionDockMetrics } from './selection-dock-store'

const OPTIONS_SCROLL_TOP_BUTTON_SIZE = 40
const OPTIONS_SCROLL_TOP_COLUMN_GAP = 20
const OPTIONS_SCROLL_TOP_DESKTOP_SCROLLBAR_GUTTER = 14
const OPTIONS_UNDO_TOAST_MAX_WIDTH = 400
const OPTIONS_UNDO_TOAST_CLEARANCE = 104

export interface OptionsScrollTopPlacementInput {
  viewportWidth: number
  mainRight: number | null
  panelRight: number | null
  dock: SelectionDockMetrics | null
  toastOpen: boolean
  buttonSize?: number
}

export interface OptionsScrollTopPlacement {
  left: number
  bottom: number
  lift: number
}

export function computeOptionsScrollTopPlacement({
  viewportWidth,
  mainRight,
  panelRight,
  dock,
  toastOpen,
  buttonSize = OPTIONS_SCROLL_TOP_BUTTON_SIZE
}: OptionsScrollTopPlacementInput): OptionsScrollTopPlacement {
  const compact = viewportWidth <= 760
  const edgeMargin = compact ? 16 : 24
  const bottom = compact ? 16 : 24
  const scrollbarGutter = viewportWidth > 920 ? OPTIONS_SCROLL_TOP_DESKTOP_SCROLLBAR_GUTTER : 0
  const rightBoundary =
    viewportWidth > 920
      ? Math.min(viewportWidth, mainRight ?? viewportWidth)
      : viewportWidth
  const maxLeft = Math.max(edgeMargin, Math.round(rightBoundary - scrollbarGutter - edgeMargin - buttonSize))
  const preferredLeft =
    panelRight !== null && Number.isFinite(panelRight) && panelRight > 0
      ? Math.round(panelRight + OPTIONS_SCROLL_TOP_COLUMN_GAP)
      : maxLeft
  const left = Math.max(edgeMargin, Math.min(preferredLeft, maxLeft))
  const buttonRight = left + buttonSize

  let lift = 0
  if (dock && left < dock.right + 12 && buttonRight > dock.left - 12) {
    lift = Math.max(lift, Math.max(0, Math.ceil(dock.bottom + dock.height + 16 - bottom)))
  }
  if (toastOpen) {
    const toastWidth = Math.min(OPTIONS_UNDO_TOAST_MAX_WIDTH, Math.max(0, viewportWidth - 32))
    const toastRight = viewportWidth - 16
    const toastLeft = toastRight - toastWidth
    if (left < toastRight + 12 && buttonRight > toastLeft - 12) {
      lift = Math.max(lift, Math.max(0, OPTIONS_UNDO_TOAST_CLEARANCE - bottom))
    }
  }

  return { left, bottom, lift }
}

export function OptionsScrollToTop({
  mainRef,
  shellRef,
  sectionKey,
  suppressed = false
}: {
  mainRef: RefObject<HTMLElement | null>
  shellRef: RefObject<HTMLDivElement | null>
  sectionKey: OptionsSectionKey
  suppressed?: boolean
}) {
  const dock = useSelectionDockMetrics()
  const toastView = useOptionsUndoToastView()
  const toastOpen = Boolean(toastView)
  const targets = useMemo(() => [mainRef, shellRef], [mainRef, shellRef])
  const { visible, scrollToTop, syncVisibility } = useScrollToTop({
    targets,
    threshold: DEFAULT_SCROLL_TOP_THRESHOLD,
    suppressed,
    syncKey: sectionKey
  })
  const [placement, setPlacement] = useState<OptionsScrollTopPlacement>(() =>
    computeOptionsScrollTopPlacement({
      viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
      mainRight: null,
      panelRight: null,
      dock: null,
      toastOpen: false
    })
  )

  const measurePlacement = useCallback(() => {
    const main = mainRef.current
    const mainRect = main?.getBoundingClientRect() ?? null
    const activePanel = main?.querySelector<HTMLElement>(`section#${sectionKey}:not([hidden]), section:not([hidden])`) ?? null
    const panelRect = activePanel?.getBoundingClientRect() ?? null
    const next = computeOptionsScrollTopPlacement({
      viewportWidth: window.innerWidth,
      mainRight: mainRect ? mainRect.right : null,
      panelRight: panelRect && panelRect.width > 0 ? panelRect.right : null,
      dock,
      toastOpen
    })
    setPlacement((previous) => (
      previous.left === next.left &&
      previous.bottom === next.bottom &&
      previous.lift === next.lift
        ? previous
        : next
    ))
  }, [dock, mainRef, sectionKey, toastOpen])

  useLayoutEffect(() => {
    measurePlacement()
    const main = mainRef.current
    let resizeObserver: ResizeObserver | null = null
    let mutationObserver: MutationObserver | null = null
    let frameId = 0
    const scheduleMeasure = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        measurePlacement()
        syncVisibility()
      })
    }
    if (typeof ResizeObserver === 'function' && main) {
      resizeObserver = new ResizeObserver(scheduleMeasure)
      resizeObserver.observe(main)
      const panel = main.querySelector<HTMLElement>('section:not([hidden])')
      if (panel) resizeObserver.observe(panel)
    }
    if (typeof MutationObserver === 'function' && main) {
      mutationObserver = new MutationObserver(() => {
        if (resizeObserver) {
          resizeObserver.disconnect()
          resizeObserver.observe(main)
          const panel = main.querySelector<HTMLElement>('section:not([hidden])')
          if (panel) resizeObserver.observe(panel)
        }
        scheduleMeasure()
      })
      mutationObserver.observe(main, { childList: true })
    }
    window.addEventListener('resize', scheduleMeasure, { passive: true })
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [mainRef, measurePlacement, syncVisibility])

  useEffect(() => {
    if (visible) {
      measurePlacement()
    }
  }, [visible, measurePlacement])

  const slotStyle = {
    left: `${placement.left}px`,
    bottom: `${placement.bottom}px`,
    '--scroll-top-lift': `${placement.lift}px`
  } as CSSProperties

  return createPortal(
    <div className="curator-scroll-top-slot options-scroll-top-slot fixed z-[35]" style={slotStyle}>
      <ScrollToTopButton
        id="options-scroll-to-top"
        visible={visible}
        onClick={scrollToTop}
        ariaControls="options-main"
        focusFallbackRef={mainRef}
        className="options-scroll-to-top size-10 rounded-full outline-none"
      />
    </div>,
    document.body
  )
}
