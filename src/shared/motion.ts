const MOTION_CLOSE_TOKEN = 'motionCloseToken'
const DEFAULT_MODAL_CLOSE_MS = 150

type MotionCleanup = () => void | Promise<void>

export function prefersReducedMotion(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      'matchMedia' in window &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function waitForMotionEnd(element: Element, timeoutMs = 260): Promise<void> {
  if (prefersReducedMotion()) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let resolved = false
    let timeoutId = 0

    let finishFromEvent: (event: Event) => void
    const finish = () => {
      if (resolved) {
        return
      }
      resolved = true
      window.clearTimeout(timeoutId)
      element.removeEventListener('animationend', finishFromEvent)
      element.removeEventListener('transitionend', finishFromEvent)
      resolve()
    }
    finishFromEvent = (event: Event) => {
      if (event.target === element) {
        finish()
      }
    }

    element.addEventListener('animationend', finishFromEvent)
    element.addEventListener('transitionend', finishFromEvent)
    timeoutId = window.setTimeout(finish, timeoutMs)
  })
}

export function parseCssTimeToMs(value: string, fallbackMs: number): number {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return fallbackMs
  }

  const firstValue = trimmedValue.split(',')[0]?.trim() ?? ''
  if (firstValue.endsWith('ms')) {
    return parseFloat(firstValue) || fallbackMs
  }

  if (firstValue.endsWith('s')) {
    return (parseFloat(firstValue) || fallbackMs / 1000) * 1000
  }

  return parseFloat(firstValue) || fallbackMs
}

export function getRootMotionDurationMs(customProperty: string, fallbackMs: number): number {
  if (
    prefersReducedMotion() ||
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    !document.documentElement
  ) {
    return prefersReducedMotion() ? 1 : fallbackMs
  }

  return parseCssTimeToMs(
    getComputedStyle(document.documentElement).getPropertyValue(customProperty),
    fallbackMs
  )
}

export function getModalCloseDurationMs(fallbackMs = DEFAULT_MODAL_CLOSE_MS): number {
  return getRootMotionDurationMs('--modal-close-dur', fallbackMs)
}

export function cancelExitMotion(element: Element, closingClass = 'is-closing'): void {
  if (element instanceof HTMLElement) {
    delete element.dataset[MOTION_CLOSE_TOKEN]
  }
  element.classList.remove(closingClass)
}

export async function closeWithExitMotion(
  element: Element,
  closingClass: string,
  removeOrHide: MotionCleanup,
  timeoutMs = 260
): Promise<void> {
  if (prefersReducedMotion()) {
    cancelExitMotion(element, closingClass)
    await removeOrHide()
    return
  }

  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  if (element instanceof HTMLElement) {
    element.dataset[MOTION_CLOSE_TOKEN] = token
  }
  element.classList.add(closingClass)

  await waitForMotionEnd(element, timeoutMs)

  if (
    element instanceof HTMLElement &&
    element.dataset[MOTION_CLOSE_TOKEN] !== token
  ) {
    return
  }

  cancelExitMotion(element, closingClass)
  await removeOrHide()
}
