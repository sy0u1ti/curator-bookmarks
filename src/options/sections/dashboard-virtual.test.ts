import {
  DASHBOARD_CARD_HEIGHT,
  DASHBOARD_CARD_MIN_WIDTH,
  DASHBOARD_GRID_GAP,
  computeDashboardVirtualFullRenderRange,
  computeDashboardVirtualWindow,
  getDashboardVirtualRenderedCount
} from './dashboard-virtual.js'

const TEN_COLUMN_WIDTH = DASHBOARD_CARD_MIN_WIDTH * 10 + DASHBOARD_GRID_GAP * 9
const VIEWPORT_HEIGHT = 800
const ITEM_COUNT = 2000

function run(): void {
  testTenColumnFastScrollKeepsRenderedRowsAhead()
  testTenColumnFastScrollPreloadsFullCardsAhead()
  testTenColumnIdleViewportStillPreloadsFullCards()
}

function testTenColumnFastScrollKeepsRenderedRowsAhead(): void {
  const rowStride = DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP
  const scrollTop = rowStride * 24
  const viewportWindow = computeDashboardVirtualWindow({
    itemCount: ITEM_COUNT,
    contentWidth: TEN_COLUMN_WIDTH,
    containerHeight: VIEWPORT_HEIGHT,
    scrollTop,
    overscanRows: 0
  })
  const fastWindow = computeDashboardVirtualWindow({
    itemCount: ITEM_COUNT,
    contentWidth: TEN_COLUMN_WIDTH,
    containerHeight: VIEWPORT_HEIGHT,
    scrollTop,
    fastScrolling: true,
    scrollDirection: 1
  })

  assert(fastWindow.columnCount === 10, `expected 10 columns, got ${fastWindow.columnCount}`)
  assert(
    viewportWindow.startRow - fastWindow.startRow >= 2,
    `fast scroll window should keep at least 2 rows mounted before the viewport; got ${viewportWindow.startRow - fastWindow.startRow}`
  )
  assert(
    fastWindow.endRow - viewportWindow.endRow >= 4,
    `fast scroll window should keep at least 4 rows mounted after the viewport; got ${fastWindow.endRow - viewportWindow.endRow}`
  )
  assert(
    getDashboardVirtualRenderedCount(fastWindow) <= 180,
    `fast scroll should stay inside the 10-column render budget; got ${getDashboardVirtualRenderedCount(fastWindow)} cards`
  )
}

function testTenColumnFastScrollPreloadsFullCardsAhead(): void {
  const viewportWindow = computeDashboardVirtualWindow({
    itemCount: ITEM_COUNT,
    contentWidth: TEN_COLUMN_WIDTH,
    containerHeight: VIEWPORT_HEIGHT,
    scrollTop: (DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP) * 24,
    overscanRows: 0
  })
  const fullRange = computeDashboardVirtualFullRenderRange({
    itemCount: ITEM_COUNT,
    viewportWindow,
    fastScrolling: true,
    scrollDirection: 1
  })

  assert(
    viewportWindow.startIndex - fullRange.startIndex >= 20,
    `fast full-card preload should cover at least 2 rows before the viewport; got ${viewportWindow.startIndex - fullRange.startIndex} cards`
  )
  assert(
    fullRange.endIndex - viewportWindow.endIndex >= 40,
    `fast full-card preload should cover at least 4 rows after the viewport; got ${fullRange.endIndex - viewportWindow.endIndex} cards`
  )
}

function testTenColumnIdleViewportStillPreloadsFullCards(): void {
  const viewportWindow = computeDashboardVirtualWindow({
    itemCount: ITEM_COUNT,
    contentWidth: TEN_COLUMN_WIDTH,
    containerHeight: VIEWPORT_HEIGHT,
    scrollTop: (DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP) * 24,
    overscanRows: 0
  })
  const fullRange = computeDashboardVirtualFullRenderRange({
    itemCount: ITEM_COUNT,
    viewportWindow,
    fastScrolling: false,
    scrollDirection: 0
  })

  assert(
    viewportWindow.startIndex - fullRange.startIndex >= 20,
    `idle full-card preload should cover at least 2 rows before the viewport; got ${viewportWindow.startIndex - fullRange.startIndex} cards`
  )
  assert(
    fullRange.endIndex - viewportWindow.endIndex >= 20,
    `idle full-card preload should cover at least 2 rows after the viewport; got ${fullRange.endIndex - viewportWindow.endIndex} cards`
  )
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Dashboard virtual tests passed.')
