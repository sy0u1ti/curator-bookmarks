export const ACTIVE_RESULT_REVEAL_HIDDEN_RATIO = 0.5
export const ACTIVE_RESULT_REVEAL_MARGIN = 8

export interface ActiveResultContentTopMetrics {
  activeResultTop: number
  scrollContainerTop: number
  scrollTop: number
}

export interface ActiveResultRevealScrollMetrics {
  hiddenRatio?: number
  itemHeight: number
  itemTop: number
  maxScrollTop: number
  revealMargin?: number
  viewportHeight: number
  viewportTop: number
}

export function getActiveResultContentTop({
  activeResultTop,
  scrollContainerTop,
  scrollTop
}: ActiveResultContentTopMetrics): number {
  return activeResultTop - scrollContainerTop + scrollTop
}

export function getActiveResultRevealScrollTop(metrics: ActiveResultRevealScrollMetrics): number | null {
  const itemHeight = Math.max(0, metrics.itemHeight)
  const viewportHeight = Math.max(0, metrics.viewportHeight)
  if (!itemHeight || !viewportHeight) {
    return null
  }

  const maxScrollTop = Math.max(0, metrics.maxScrollTop)
  const viewportTop = clamp(metrics.viewportTop, 0, maxScrollTop)
  const viewportBottom = viewportTop + viewportHeight
  const itemTop = metrics.itemTop
  const itemBottom = itemTop + itemHeight
  const hiddenTop = Math.max(0, viewportTop - itemTop)
  const hiddenBottom = Math.max(0, itemBottom - viewportBottom)
  const hiddenAmount = Math.max(hiddenTop, hiddenBottom)
  const hiddenThreshold = itemHeight * (metrics.hiddenRatio ?? ACTIVE_RESULT_REVEAL_HIDDEN_RATIO)

  if (hiddenAmount < hiddenThreshold) {
    return null
  }

  const revealMargin = Math.max(0, metrics.revealMargin ?? ACTIVE_RESULT_REVEAL_MARGIN)
  const nextScrollTop = hiddenTop >= hiddenBottom
    ? itemTop - revealMargin
    : itemBottom - viewportHeight + revealMargin

  return Math.round(clamp(nextScrollTop, 0, maxScrollTop))
}

export function getActiveResultRevealScrollBehavior(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? 'auto' : 'smooth'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
