import { memo, useCallback, useEffect, useRef, type RefObject } from 'react'
import { getMotionAwareScrollBehavior } from '../../shared/motion'
import { computeNextScrollToTopVisible } from '../../ui/base/ScrollToTopButton'
import { Icon } from '../../ui/icons/Icon'

const POPUP_SCROLL_TOP_THRESHOLD = 260

function applyScrollTopButtonVisibility(
  slot: HTMLDivElement | null,
  button: HTMLButtonElement | null,
  visible: boolean,
  focusFallbackRef?: RefObject<HTMLElement | null>
): void {
  const visibleValue = visible ? 'true' : 'false'
  if (slot) {
    slot.dataset.visible = visibleValue
  }
  if (!button) return
  button.dataset.visible = visibleValue
  button.tabIndex = visible ? 0 : -1
  button.inert = !visible
  if (visible) {
    button.removeAttribute('aria-hidden')
    return
  }
  button.setAttribute('aria-hidden', 'true')
  if (document.activeElement === button) {
    const fallback = focusFallbackRef?.current
    if (fallback && fallback.isConnected) {
      fallback.focus({ preventScroll: true })
    }
    if (document.activeElement === button) {
      button.blur()
    }
  }
}

export const PopupScrollToTop = memo(function PopupScrollToTop({
  listRef,
  suppressed = false,
  syncKey
}: {
  listRef?: RefObject<HTMLDivElement | null>
  suppressed?: boolean
  syncKey?: string | number
}) {
  const slotRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const visibleRef = useRef(false)
  const suppressedRef = useRef(suppressed)
  suppressedRef.current = suppressed

  const syncVisibility = useCallback(() => {
    const list = listRef?.current
    const next = computeNextScrollToTopVisible({
      scrollTop: list?.scrollTop ?? 0,
      currentVisible: visibleRef.current,
      threshold: POPUP_SCROLL_TOP_THRESHOLD,
      suppressed: suppressedRef.current
    })
    const expected = next ? 'true' : 'false'
    if (
      next === visibleRef.current &&
      slotRef.current?.dataset.visible === expected &&
      buttonRef.current?.dataset.visible === expected
    ) {
      return
    }
    visibleRef.current = next
    applyScrollTopButtonVisibility(slotRef.current, buttonRef.current, next, listRef)
  }, [listRef])

  useEffect(() => {
    const list = listRef?.current
    if (!list) {
      visibleRef.current = false
      applyScrollTopButtonVisibility(slotRef.current, buttonRef.current, false, listRef)
      return
    }

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
    list.addEventListener('scroll', scheduleSync, { passive: true })

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(scheduleSync)
      resizeObserver.observe(list)
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(settleFrameId)
      list.removeEventListener('scroll', scheduleSync)
      resizeObserver?.disconnect()
    }
  }, [listRef, syncVisibility, suppressed, syncKey])

  const handleClick = useCallback(() => {
    const list = listRef?.current
    if (!list || list.scrollTop <= 0) return
    const behavior = getMotionAwareScrollBehavior('smooth')
    if (typeof list.scrollTo === 'function') {
      list.scrollTo({ top: 0, behavior })
    } else {
      list.scrollTop = 0
    }
  }, [listRef])

  return (
    <div
      ref={slotRef}
      className="curator-scroll-top-slot popup-scroll-top-slot"
      data-visible="false"
    >
      <button
        ref={buttonRef}
        id="popup-scroll-to-top"
        type="button"
        className="curator-scroll-top-button popup-scroll-to-top size-7 rounded-ds-sm outline-none"
        aria-label="回到顶部"
        aria-controls="popup-search-results"
        aria-hidden="true"
        title="回到顶部"
        tabIndex={-1}
        inert
        data-visible="false"
        onClick={handleClick}
      >
        <Icon name="ArrowUp" size={14} className="curator-scroll-top-icon" aria-hidden="true" />
      </button>
    </div>
  )
})
