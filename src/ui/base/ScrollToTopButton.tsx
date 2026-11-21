import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
} from 'react'
import { getMotionAwareScrollBehavior } from '../../shared/motion'
import { Icon } from '../icons/Icon'
import { cx } from './utils'

export const DEFAULT_SCROLL_TOP_THRESHOLD = 320

export interface ScrollToTopVisibilityInput {
  scrollTop: number
  currentVisible: boolean
  threshold: number
  suppressed?: boolean
}

export function computeNextScrollToTopVisible({
  scrollTop,
  currentVisible,
  threshold,
  suppressed = false
}: ScrollToTopVisibilityInput): boolean {
  if (suppressed || !Number.isFinite(scrollTop) || scrollTop <= 0) {
    return false
  }
  const showAt = Math.max(1, threshold)
  const hideAt = Math.max(0, Math.min(showAt - 60, Math.floor(showAt * 0.65)))
  return currentVisible ? scrollTop >= hideAt : scrollTop >= showAt
}

export function readMaxScrollTop(
  targets: ReadonlyArray<RefObject<HTMLElement | null> | undefined>
): number {
  let maxScrollTop = 0
  for (const ref of targets) {
    const scrollTop = ref?.current?.scrollTop ?? 0
    if (scrollTop > maxScrollTop) {
      maxScrollTop = scrollTop
    }
  }
  return maxScrollTop
}

export interface UseScrollToTopOptions {
  targets: ReadonlyArray<RefObject<HTMLElement | null> | undefined>
  threshold?: number
  suppressed?: boolean
  syncKey?: string | number | boolean | null
}

export function useScrollToTop({
  targets,
  threshold = DEFAULT_SCROLL_TOP_THRESHOLD,
  suppressed = false,
  syncKey
}: UseScrollToTopOptions): {
  visible: boolean
  scrollToTop: () => void
  syncVisibility: () => void
} {
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const suppressedRef = useRef(suppressed)
  suppressedRef.current = suppressed

  const syncVisibility = useCallback(() => {
    const next = computeNextScrollToTopVisible({
      scrollTop: readMaxScrollTop(targetsRef.current),
      currentVisible: visibleRef.current,
      threshold,
      suppressed: suppressedRef.current
    })
    if (next !== visibleRef.current) {
      visibleRef.current = next
      setVisible(next)
    }
  }, [threshold])

  useEffect(() => {
    const elements = targetsRef.current
      .map((ref) => ref?.current)
      .filter((element): element is HTMLElement => element instanceof HTMLElement)

    let frameId = 0
    const scheduleSync = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        syncVisibility()
      })
    }

    syncVisibility()
    const settleFrameId = window.requestAnimationFrame(syncVisibility)

    for (const element of elements) {
      element.addEventListener('scroll', scheduleSync, { passive: true })
    }

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver === 'function' && elements.length > 0) {
      resizeObserver = new ResizeObserver(scheduleSync)
      for (const element of elements) {
        resizeObserver.observe(element)
      }
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(settleFrameId)
      for (const element of elements) {
        element.removeEventListener('scroll', scheduleSync)
      }
      resizeObserver?.disconnect()
    }
  }, [syncVisibility, suppressed, syncKey])

  const scrollToTop = useCallback(() => {
    const behavior = getMotionAwareScrollBehavior('smooth')
    for (const ref of targetsRef.current) {
      const element = ref?.current
      if (!element || element.scrollTop <= 0) continue
      if (typeof element.scrollTo === 'function') {
        element.scrollTo({ top: 0, behavior })
      } else {
        element.scrollTop = 0
      }
    }
  }, [])

  return { visible, scrollToTop, syncVisibility }
}

export function useScrollToTopFocusGuard(
  visible: boolean,
  buttonRef: RefObject<HTMLButtonElement | null>,
  focusFallbackRef?: RefObject<HTMLElement | null>
): void {
  const previousVisibleRef = useRef(visible)

  useLayoutEffect(() => {
    const wasVisible = previousVisibleRef.current
    previousVisibleRef.current = visible
    if (!wasVisible || visible) return
    const button = buttonRef.current
    if (!button || document.activeElement !== button) return
    const fallback = focusFallbackRef?.current
    if (fallback && fallback.isConnected) {
      fallback.focus({ preventScroll: true })
    } else {
      button.blur()
    }
  }, [visible, buttonRef, focusFallbackRef])
}

export interface ScrollToTopButtonProps {
  id?: string
  visible: boolean
  onClick: () => void
  label?: string
  iconSize?: number
  className?: string
  style?: CSSProperties
  focusFallbackRef?: RefObject<HTMLElement | null>
  ariaControls?: string
}

export function ScrollToTopButton({
  id,
  visible,
  onClick,
  label = '回到顶部',
  iconSize = 16,
  className,
  style,
  focusFallbackRef,
  ariaControls
}: ScrollToTopButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  useScrollToTopFocusGuard(visible, buttonRef, focusFallbackRef)

  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      className={cx('curator-scroll-top-button', className)}
      style={style}
      aria-label={label}
      aria-controls={ariaControls}
      aria-hidden={!visible || undefined}
      title={label}
      tabIndex={visible ? 0 : -1}
      inert={!visible || undefined}
      data-visible={visible ? 'true' : 'false'}
      onClick={onClick}
    >
      <Icon name="ArrowUp" size={iconSize} className="curator-scroll-top-icon" aria-hidden="true" />
    </button>
  )
}
