const DEFAULT_MODAL_CLOSE_MS = 220
const REDUCED_MOTION_DURATION_MS = 1

export function prefersReducedMotion(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      'matchMedia' in window &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function getModalCloseDurationMs(fallbackMs = DEFAULT_MODAL_CLOSE_MS): number {
  if (prefersReducedMotion()) {
    return REDUCED_MOTION_DURATION_MS
  }

  if (typeof document === 'undefined') {
    return fallbackMs
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur').trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) {
    return fallbackMs
  }

  return raw.endsWith('s') && !raw.endsWith('ms') ? value * 1000 : value
}
