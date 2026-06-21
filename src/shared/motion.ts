const DEFAULT_MODAL_CLOSE_MS = 150
const REDUCED_MOTION_DURATION_MS = 1

export function prefersReducedMotion(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      'matchMedia' in window &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function getModalCloseDurationMs(fallbackMs = DEFAULT_MODAL_CLOSE_MS): number {
  return prefersReducedMotion() ? REDUCED_MOTION_DURATION_MS : fallbackMs
}
