import { DEFAULT_SPRING, type SpringConfig } from './motion-spring'

let cachedMatchMedia: typeof window.matchMedia | null = null
let cachedReducedMotionQuery: MediaQueryList | null = null

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  if (cachedMatchMedia !== window.matchMedia || !cachedReducedMotionQuery) {
    cachedMatchMedia = window.matchMedia
    cachedReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  }
  return Boolean(cachedReducedMotionQuery?.matches)
}

export function getMotionAwareScrollBehavior(
  behavior: ScrollBehavior = 'smooth'
): ScrollBehavior {
  return behavior === 'smooth' && shouldSkipMotion() ? 'auto' : behavior
}

export function shouldSkipMotion(): boolean {
  return prefersReducedMotion() ||
    (typeof document !== 'undefined' && document.documentElement.dataset.motionInput === 'keyboard')
}

export function getMotionDurationMs(variableName: string, fallbackMs: number, element?: Element): number {
  if (typeof document === 'undefined') {
    return fallbackMs
  }
  if (document.documentElement.dataset.motionInput === 'keyboard') return 0
  const raw = getComputedStyle(element ?? document.documentElement).getPropertyValue(variableName).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) {
    return fallbackMs
  }
  return raw.endsWith('s') && !raw.endsWith('ms') ? value * 1000 : value
}

export function getMotionEasing(variableName: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback
  }
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback
}

export function getMotionSpring(element?: Element): SpringConfig {
  if (typeof document === 'undefined') return { ...DEFAULT_SPRING }
  const style = getComputedStyle(element ?? document.documentElement)
  const response = style.getPropertyValue('--ds-spring-response').trim()
  const responseValue = Number.parseFloat(response)
  const damping = Number.parseFloat(style.getPropertyValue('--ds-spring-damping'))
  return {
    response: Number.isFinite(responseValue) && responseValue > 0
      ? responseValue / (response.endsWith('ms') ? 1000 : 1)
      : DEFAULT_SPRING.response,
    damping: Number.isFinite(damping) && damping > 0 ? damping : DEFAULT_SPRING.damping
  }
}

