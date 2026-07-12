const DEFAULT_MODAL_CLOSE_MS = 220
const REDUCED_MOTION_DURATION_MS = 1

export function prefersReducedMotion(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      'matchMedia' in window &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function getMotionAwareScrollBehavior(
  behavior: ScrollBehavior = 'smooth'
): ScrollBehavior {
  return behavior === 'smooth' && prefersReducedMotion() ? 'auto' : behavior
}

export function getMotionDurationMs(variableName: string, fallbackMs: number): number {
  if (typeof document === 'undefined') {
    return fallbackMs
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) {
    return fallbackMs
  }
  return raw.endsWith('s') && !raw.endsWith('ms') ? value * 1000 : value
}

export function getModalCloseDurationMs(fallbackMs = DEFAULT_MODAL_CLOSE_MS): number {
  if (prefersReducedMotion()) {
    return REDUCED_MOTION_DURATION_MS
  }

  return getMotionDurationMs('--modal-close-dur', fallbackMs)
}
