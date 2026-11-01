export interface PopupVirtualRange {
  start: number
  count: number
}

export const POPUP_VIRTUAL_OVERSCAN = 8

export function getPopupHeldRange({
  activeIndex, direction, rowCount, pitch, viewportHeight, paddingTop = 0,
  previous = { start: 0, count: 0 }
}: {
  activeIndex: number
  direction: -1 | 1
  rowCount: number
  pitch: number
  viewportHeight: number
  paddingTop?: number
  previous?: PopupVirtualRange
}): PopupVirtualRange {
  const destination = direction > 0
    ? paddingTop + (activeIndex + 1) * pitch - viewportHeight + 8
    : paddingTop + activeIndex * pitch - 8
  return getPopupVirtualRange({
    previous, rowCount, pitch, viewportHeight, scrollTop: Math.max(0, destination), paddingTop
  })
}

export function getPopupVirtualRange({
  previous, rowCount, pitch, viewportHeight, scrollTop, paddingTop = 0
}: {
  previous: PopupVirtualRange
  rowCount: number
  pitch: number
  viewportHeight: number
  scrollTop: number
  paddingTop?: number
}): PopupVirtualRange {
  // One viewport of overscan keeps both ends of an edge-docking/reversal
  // transition painted, including the shorter folder rows.
  const visibleCount = Math.ceil(viewportHeight / pitch)
  const overscan = Math.max(POPUP_VIRTUAL_OVERSCAN, visibleCount)
  const count = visibleCount + overscan * 2
  const first = Math.max(0, Math.floor((scrollTop - paddingTop) / pitch))
  const last = Math.min(rowCount, Math.ceil((scrollTop - paddingTop + viewportHeight) / pitch))
  const end = Math.min(rowCount, previous.start + previous.count)
  const guard = overscan / 2
  if (
    previous.count === count &&
    (previous.start === 0 || first >= previous.start + guard) &&
    (end === rowCount || last <= end - guard) &&
    first >= previous.start && last <= end
  ) return previous

  return {
    start: Math.min(Math.max(0, rowCount - count), Math.max(0, first - overscan)),
    count
  }
}

export function includePopupVirtualSelection(
  range: PopupVirtualRange, activeIndex: number, rowCount: number
): PopupVirtualRange {
  if (activeIndex < 0 || activeIndex >= rowCount ||
    (activeIndex >= range.start && activeIndex < range.start + range.count)) return range
  return {
    start: Math.min(Math.max(0, rowCount - range.count), Math.max(0, activeIndex - POPUP_VIRTUAL_OVERSCAN)),
    count: range.count
  }
}
