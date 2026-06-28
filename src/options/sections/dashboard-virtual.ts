export const DASHBOARD_CARD_HEIGHT = 150
export const DASHBOARD_GRID_GAP = 10
export const DASHBOARD_CARD_MIN_WIDTH = 260
export const DASHBOARD_VIRTUAL_MAX_COLUMNS = Number.MAX_SAFE_INTEGER
export const DASHBOARD_STATIC_RENDER_LIMIT = 120
export const DASHBOARD_VIRTUAL_MIN_READY_WIDTH = 48
export const DASHBOARD_VIRTUAL_MIN_READY_HEIGHT = 48
export const DASHBOARD_VIRTUAL_DEFAULT_OVERSCAN_ROWS = 3
export const DASHBOARD_VIRTUAL_MIN_OVERSCAN_ROWS = 2
export const DASHBOARD_VIRTUAL_MAX_OVERSCAN_ROWS = 8
export const DASHBOARD_VIRTUAL_MAX_RENDERED_CARDS = 180
export const DASHBOARD_VIRTUAL_FAST_SCROLL_OVERSCAN_ROWS = 3
export const DASHBOARD_VIRTUAL_FAST_SCROLL_DIRECTIONAL_OVERSCAN_ROWS = 4
export const DASHBOARD_VIRTUAL_FAST_SCROLL_PX_PER_MS = 0.9
export const DASHBOARD_VIRTUAL_FULL_PRELOAD_ROWS = 2
export const DASHBOARD_VIRTUAL_FAST_FULL_PRELOAD_ROWS = 3

export interface DashboardVirtualWindow {
  columnCount: number
  totalRows: number
  rowStride: number
  totalHeight: number
  maxScrollTop: number
  scrollTop: number
  startRow: number
  endRow: number
  startIndex: number
  endIndex: number
  offsetY: number
}

export interface DashboardVirtualFullRenderRange {
  startIndex: number
  endIndex: number
}

export function getDashboardVirtualColumnCount(
  contentWidth: number,
  minCardWidth = DASHBOARD_CARD_MIN_WIDTH,
  gap = DASHBOARD_GRID_GAP,
  maxColumns = DASHBOARD_VIRTUAL_MAX_COLUMNS
): number {
  const safeWidth = Math.max(1, Math.floor(Number(contentWidth) || 0))
  const safeGap = Math.max(0, Number(gap) || 0)
  const safeMinWidth = Math.max(1, Number(minCardWidth) || 1)
  const effectiveMinWidth = Math.min(safeMinWidth, safeWidth)
  const uncappedColumns = Math.max(1, Math.floor((safeWidth + safeGap) / (effectiveMinWidth + safeGap)))
  const safeMaxColumns = Math.max(1, Math.floor(Number(maxColumns) || DASHBOARD_VIRTUAL_MAX_COLUMNS))
  return Math.min(uncappedColumns, safeMaxColumns)
}

export function shouldDashboardUseVirtualRendering(
  itemCount: number,
  staticRenderLimit = DASHBOARD_STATIC_RENDER_LIMIT
): boolean {
  const safeItemCount = Math.max(0, Math.floor(Number(itemCount) || 0))
  const safeStaticRenderLimit = Math.max(0, Math.floor(Number(staticRenderLimit) || 0))
  return safeItemCount > safeStaticRenderLimit
}

export function computeDashboardVirtualWindow({
  itemCount,
  contentWidth,
  containerHeight,
  scrollTop,
  cardHeight = DASHBOARD_CARD_HEIGHT,
  gap = DASHBOARD_GRID_GAP,
  minCardWidth = DASHBOARD_CARD_MIN_WIDTH,
  overscanRows,
  fastScrolling = false,
  scrollDirection = 0
}: {
  itemCount: number
  contentWidth: number
  containerHeight: number
  scrollTop: number
  cardHeight?: number
  gap?: number
  minCardWidth?: number
  overscanRows?: number
  fastScrolling?: boolean
  scrollDirection?: -1 | 0 | 1
}): DashboardVirtualWindow {
  const safeItemCount = Math.max(0, Math.floor(Number(itemCount) || 0))
  const safeHeight = Math.max(1, Math.floor(Number(containerHeight) || 0))
  const safeScrollTop = Math.max(0, Number(scrollTop) || 0)
  const safeGap = Math.max(0, Number(gap) || 0)
  const rowStride = Math.max(1, Math.floor((Number(cardHeight) || DASHBOARD_CARD_HEIGHT) + safeGap))
  const columnCount = getDashboardVirtualColumnCount(contentWidth, minCardWidth, safeGap)
  const viewportRows = Math.max(1, Math.ceil(safeHeight / rowStride) + 1)
  const overscan = overscanRows == null
    ? getDashboardVirtualOverscanRows(columnCount, viewportRows, { fastScrolling })
    : Math.max(0, Math.floor(Number(overscanRows) || 0))
  const direction = scrollDirection < 0 ? -1 : scrollDirection > 0 ? 1 : 0
  const directionalOverscan = fastScrolling && direction
    ? Math.max(overscan, DASHBOARD_VIRTUAL_FAST_SCROLL_DIRECTIONAL_OVERSCAN_ROWS)
    : overscan
  const overscanBefore = direction < 0 ? directionalOverscan : overscan
  const overscanAfter = direction > 0 ? directionalOverscan : overscan
  const totalRows = safeItemCount ? Math.ceil(safeItemCount / columnCount) : 0
  const totalHeight = totalRows ? Math.max(0, totalRows * rowStride - safeGap) : 0
  const maxScrollTop = Math.max(0, totalHeight - safeHeight)
  const clampedScrollTop = Math.min(safeScrollTop, maxScrollTop)
  const firstVisibleRow = safeItemCount
    ? Math.max(0, Math.floor(clampedScrollTop / rowStride))
    : 0
  const startRow = safeItemCount
    ? Math.max(0, firstVisibleRow - overscanBefore)
    : 0
  const endRow = safeItemCount
    ? Math.min(
      totalRows,
      Math.max(
        startRow + 1,
        Math.ceil((clampedScrollTop + safeHeight) / rowStride) + overscanAfter
      )
    )
    : 0
  const offsetRow = startRow
  const startIndex = Math.min(safeItemCount, startRow * columnCount)
  const endIndex = Math.min(safeItemCount, Math.max(startIndex, endRow * columnCount))

  return {
    columnCount,
    totalRows,
    rowStride,
    totalHeight,
    maxScrollTop,
    scrollTop: clampedScrollTop,
    startRow,
    endRow,
    startIndex,
    endIndex,
    offsetY: offsetRow * rowStride
  }
}

export function getDashboardVirtualOverscanRows(
  columnCount: number,
  viewportRows: number,
  {
    maxRenderedCards = DASHBOARD_VIRTUAL_MAX_RENDERED_CARDS,
    minOverscanRows = DASHBOARD_VIRTUAL_MIN_OVERSCAN_ROWS,
    maxOverscanRows = DASHBOARD_VIRTUAL_MAX_OVERSCAN_ROWS,
    fastScrolling = false
  }: {
    maxRenderedCards?: number
    minOverscanRows?: number
    maxOverscanRows?: number
    fastScrolling?: boolean
  } = {}
): number {
  const safeColumns = Math.max(1, Math.floor(Number(columnCount) || 1))
  const safeViewportRows = Math.max(1, Math.ceil(Number(viewportRows) || 1))
  const safeMinRows = Math.max(0, Math.floor(Number(minOverscanRows) || 0))
  const safeMaxRows = Math.max(safeMinRows, Math.floor(Number(maxOverscanRows) || safeMinRows))
  const adaptiveMinRows = safeColumns >= 8
    ? Math.min(safeMinRows, 1)
    : safeColumns >= 5
      ? Math.min(safeMinRows, 2)
      : safeMinRows
  const visibleCards = safeViewportRows * safeColumns
  const safeBudget = Math.max(visibleCards, Math.floor(Number(maxRenderedCards) || DASHBOARD_VIRTUAL_MAX_RENDERED_CARDS))
  const budgetRowsPerSide = Math.floor(Math.max(0, safeBudget - visibleCards) / safeColumns / 2)
  const budgetedRows = Math.min(safeMaxRows, Math.max(adaptiveMinRows, budgetRowsPerSide))
  if (!fastScrolling) {
    return budgetedRows
  }

  return Math.max(0, Math.min(budgetedRows, DASHBOARD_VIRTUAL_FAST_SCROLL_OVERSCAN_ROWS))
}

export function getDashboardVirtualRenderedCount(window: DashboardVirtualWindow): number {
  return Math.max(0, window.endIndex - window.startIndex)
}

export function computeDashboardVirtualFullRenderRange({
  fastScrolling = false,
  itemCount,
  scrollDirection = 0,
  viewportWindow
}: {
  fastScrolling?: boolean
  itemCount: number
  scrollDirection?: -1 | 0 | 1
  viewportWindow: DashboardVirtualWindow
}): DashboardVirtualFullRenderRange {
  const totalItems = Math.max(0, Math.floor(Number(itemCount) || 0))
  if (!totalItems) {
    return { startIndex: 0, endIndex: 0 }
  }

  const direction = scrollDirection < 0 ? -1 : scrollDirection > 0 ? 1 : 0
  const basePreloadRows = fastScrolling
    ? DASHBOARD_VIRTUAL_FAST_FULL_PRELOAD_ROWS
    : DASHBOARD_VIRTUAL_FULL_PRELOAD_ROWS
  const rowsBefore = direction < 0
    ? basePreloadRows + 1
    : basePreloadRows
  const rowsAfter = direction > 0
    ? basePreloadRows + 1
    : basePreloadRows
  const columnCount = Math.max(1, viewportWindow.columnCount)
  const startRow = Math.max(0, viewportWindow.startRow - rowsBefore)
  const endRow = Math.min(
    viewportWindow.totalRows,
    Math.max(viewportWindow.endRow, viewportWindow.startRow + 1) + rowsAfter
  )
  const startIndex = Math.min(totalItems, startRow * columnCount)

  return {
    startIndex,
    endIndex: Math.min(totalItems, Math.max(startIndex, endRow * columnCount))
  }
}
