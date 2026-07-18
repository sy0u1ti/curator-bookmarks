export const ACTIVE_RESULT_REVEAL_HIDDEN_RATIO = 0
export const ACTIVE_RESULT_REVEAL_MARGIN = 8

export interface ActiveResultRectLike {
  bottom: number
  left: number
  right: number
  top: number
}

export interface ClippedActiveResultIndicatorGeometry {
  height: number
  left: number
  top: number
  width: number
}

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
  const requestedRevealMargin = Math.max(0, metrics.revealMargin ?? ACTIVE_RESULT_REVEAL_MARGIN)
  const revealMargin = Math.min(requestedRevealMargin, Math.max(0, (viewportHeight - itemHeight) / 2))
  const hiddenTop = Math.max(0, viewportTop + revealMargin - itemTop)
  const hiddenBottom = Math.max(0, itemBottom - (viewportBottom - revealMargin))
  const hiddenAmount = Math.max(hiddenTop, hiddenBottom)
  const hiddenThreshold = itemHeight * (metrics.hiddenRatio ?? ACTIVE_RESULT_REVEAL_HIDDEN_RATIO)

  if (hiddenAmount <= 0 || hiddenAmount < hiddenThreshold) {
    return null
  }

  const nextScrollTop = hiddenTop >= hiddenBottom
    ? itemTop - revealMargin
    : itemBottom - viewportHeight + revealMargin

  return Math.round(clamp(nextScrollTop, 0, maxScrollTop))
}

export function getActiveResultRevealScrollBehavior(
  reducedMotion: boolean,
  keyboardNavigationActive = false
): ScrollBehavior {
  return reducedMotion || keyboardNavigationActive ? 'auto' : 'smooth'
}

export function getClippedActiveResultIndicatorGeometry(
  workspaceRect: ActiveResultRectLike,
  targetRect: ActiveResultRectLike,
  viewportRect: ActiveResultRectLike
): ClippedActiveResultIndicatorGeometry | null {
  const clipLeft = Math.max(workspaceRect.left, viewportRect.left)
  const clipTop = Math.max(workspaceRect.top, viewportRect.top)
  const clipRight = Math.min(workspaceRect.right, viewportRect.right)
  const clipBottom = Math.min(workspaceRect.bottom, viewportRect.bottom)
  const visibleLeft = Math.max(targetRect.left, clipLeft)
  const visibleTop = Math.max(targetRect.top, clipTop)
  const visibleRight = Math.min(targetRect.right, clipRight)
  const visibleBottom = Math.min(targetRect.bottom, clipBottom)
  const width = Math.max(0, visibleRight - visibleLeft)
  const height = Math.max(0, visibleBottom - visibleTop)

  if (!width || !height) {
    return null
  }

  return {
    height,
    left: visibleLeft - workspaceRect.left,
    top: visibleTop - workspaceRect.top,
    width
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
