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
  revealMarginTop?: number
  revealMarginBottom?: number
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
  const marginLimit = Math.max(0, (viewportHeight - itemHeight) / 2)
  const requestedRevealMargin = metrics.revealMargin ?? ACTIVE_RESULT_REVEAL_MARGIN
  const topMargin = Math.min(Math.max(0, metrics.revealMarginTop ?? requestedRevealMargin), marginLimit)
  const bottomMargin = Math.min(Math.max(0, metrics.revealMarginBottom ?? requestedRevealMargin), marginLimit)
  const hiddenTop = Math.max(0, viewportTop + topMargin - itemTop)
  const hiddenBottom = Math.max(0, itemBottom - (viewportBottom - bottomMargin))
  const hiddenAmount = Math.max(hiddenTop, hiddenBottom)
  const hiddenThreshold = itemHeight * (metrics.hiddenRatio ?? ACTIVE_RESULT_REVEAL_HIDDEN_RATIO)

  if (hiddenAmount <= 0 || hiddenAmount < hiddenThreshold) {
    return null
  }

  const nextScrollTop = hiddenTop >= hiddenBottom
    ? itemTop - topMargin
    : itemBottom - viewportHeight + bottomMargin

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

// Selection moves in content coordinates. Scrolling is a separate translation,
// so a scroll frame never restarts the user's 100 ms selection transition.
export function getActiveResultTrackingGeometry(
  workspaceRect: ActiveResultRectLike,
  targetRect: ActiveResultRectLike,
  viewportRect: ActiveResultRectLike,
  scrollOffset: number
) {
  const clipped = getClippedActiveResultIndicatorGeometry(workspaceRect, targetRect, viewportRect)
  if (!clipped) return null
  const top = targetRect.top - workspaceRect.top
  const left = targetRect.left - workspaceRect.left
  const width = targetRect.right - targetRect.left
  const height = targetRect.bottom - targetRect.top
  const insets = [
    clipped.top - top,
    left + width - clipped.left - clipped.width,
    top + height - clipped.top - clipped.height,
    clipped.left - left
  ].map(value => Math.max(0, value))
  return {
    left, top: top + scrollOffset, width, height,
    clipPath: insets.some(value => value > 0.5) ? `inset(${insets.map(value => `${value}px`).join(' ')})` : 'none'
  }
}

export interface PopupRowLayout {
  count: number
  pitch: number
  offsets: Float64Array | null
}

export function createPopupRowLayout(count: number, pitch: number, heights?: readonly number[]): PopupRowLayout {
  if (!heights || heights.every(height => height === pitch)) return { count, pitch, offsets: null }
  const offsets = new Float64Array(count + 1)
  for (let index = 0; index < count; index++) offsets[index + 1] = offsets[index] + heights[index]
  return { count, pitch, offsets }
}

export function getPopupRowOffset(layout: PopupRowLayout, index: number): number {
  return layout.offsets ? layout.offsets[index] : layout.pitch * index
}

export function getPopupRowHeight(layout: PopupRowLayout, index: number): number {
  return layout.offsets ? layout.offsets[index + 1] - layout.offsets[index] : layout.pitch
}

export function getPopupEdgeReveal({
  top, height, viewportTop, viewportHeight, maxScrollTop, direction, margin = ACTIVE_RESULT_REVEAL_MARGIN
}: {
  top: number; height: number; viewportTop: number; viewportHeight: number
  maxScrollTop: number; direction: -1 | 1; margin?: number
}) {
  const requested = direction > 0 ? top + height + margin - viewportHeight : top - margin
  // Pin only once the row reaches the edge it travels toward. Until then the
  // highlight glides through the visible rows like a single key press.
  const reachedEdge = direction > 0 ? requested > viewportTop + 0.5 : requested < viewportTop - 0.5
  return {
    top: Math.round(clamp(requested, 0, maxScrollTop)),
    pinned: reachedEdge && requested >= 0 && requested <= maxScrollTop
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
