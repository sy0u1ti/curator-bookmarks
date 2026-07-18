import { readFileSync } from 'node:fs'
import {
  ACTIVE_RESULT_REVEAL_MARGIN,
  getClippedActiveResultIndicatorGeometry,
  getActiveResultContentTop,
  getActiveResultRevealScrollBehavior,
  getActiveResultRevealScrollTop
} from './popup-active-result-scroll.js'

function run(): void {
  testContentTopUsesViewportRects()
  testBottomEdgeMaintainsRevealMargin()
  testTopEdgeMaintainsRevealMargin()
  testTopRevealClampsToStart()
  testScrollBehaviorRespectsReducedMotion()
  testIndicatorGeometryClipsToScrollViewport()
  testIndicatorGeometryHidesOutsideScrollViewport()
  testContentHostUsesSmoothThresholdReveal()
}

function testContentTopUsesViewportRects(): void {
  const top = getActiveResultContentTop({
    activeResultTop: 260,
    scrollContainerTop: 188,
    scrollTop: 120
  })

  assert(top === 192, `content top should be measured from viewport rects plus scrollTop, got ${top}`)
}

function testBottomEdgeMaintainsRevealMargin(): void {
  const visibleEnough = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 212,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 100
  })
  assert(visibleEnough === null, `bottom reveal should keep a settled row with ${ACTIVE_RESULT_REVEAL_MARGIN}px margin, got ${visibleEnough}`)

  const edgeClipped = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 213,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 100
  })
  assert(
    edgeClipped === 101,
    `bottom reveal should restore ${ACTIVE_RESULT_REVEAL_MARGIN}px breathing room as soon as the safe edge is crossed, got ${edgeClipped}`
  )
}

function testTopEdgeMaintainsRevealMargin(): void {
  const visibleEnough = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 108,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 100
  })
  assert(visibleEnough === null, `top reveal should keep a settled row with ${ACTIVE_RESULT_REVEAL_MARGIN}px margin, got ${visibleEnough}`)

  const edgeClipped = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 107,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 100
  })
  assert(
    edgeClipped === 99,
    `top reveal should restore ${ACTIVE_RESULT_REVEAL_MARGIN}px breathing room as soon as the safe edge is crossed, got ${edgeClipped}`
  )
}

function testTopRevealClampsToStart(): void {
  const scrollTop = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 0,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 60
  })

  assert(scrollTop === 0, `top reveal should clamp first row to scroll start, got ${scrollTop}`)
}

function testScrollBehaviorRespectsReducedMotion(): void {
  assert(getActiveResultRevealScrollBehavior(false, false) === 'smooth', 'non-keyboard active result reveals should use smooth scrolling by default')
  assert(getActiveResultRevealScrollBehavior(true, false) === 'auto', 'active result reveal should avoid smooth scrolling for reduced motion')
  assert(getActiveResultRevealScrollBehavior(false, true) === 'auto', 'held keyboard navigation should scroll immediately so the highlight cannot outrun the viewport')
}

function testIndicatorGeometryClipsToScrollViewport(): void {
  const geometry = getClippedActiveResultIndicatorGeometry(
    { left: 10, top: 20, right: 810, bottom: 620 },
    { left: 260, top: 550, right: 790, bottom: 610 },
    { left: 250, top: 200, right: 800, bottom: 600 }
  )

  assert(geometry !== null, 'partially visible active rows should keep a clipped indicator')
  assert(geometry?.left === 250, `indicator left should stay workspace-relative, got ${geometry?.left}`)
  assert(geometry?.top === 530, `indicator top should stay workspace-relative, got ${geometry?.top}`)
  assert(geometry?.width === 530, `indicator width should match the visible target width, got ${geometry?.width}`)
  assert(geometry?.height === 50, `indicator height should stop at the scroll viewport bottom, got ${geometry?.height}`)
}

function testIndicatorGeometryHidesOutsideScrollViewport(): void {
  const geometry = getClippedActiveResultIndicatorGeometry(
    { left: 0, top: 0, right: 800, bottom: 600 },
    { left: 260, top: 610, right: 790, bottom: 680 },
    { left: 250, top: 200, right: 800, bottom: 600 }
  )

  assert(geometry === null, 'fully offscreen active rows should not paint a workspace-level indicator')
}

function testContentHostUsesSmoothThresholdReveal(): void {
  const source = readFileSync('src/popup/components/PopupContentHost.tsx', 'utf8')

  assert(
    !source.includes('activeResult.offsetTop - scrollContainer.offsetTop'),
    'PopupContentHost should not use offsetTop minus container offset after the list became a positioned scroll container.'
  )
  assert(
    source.includes('getActiveResultRevealScrollTop') && source.includes('getActiveResultContentTop'),
    'PopupContentHost should route active-row reveal through the tested threshold helper.'
  )
  assert(
    source.includes('scrollTo({') && source.includes('const revealScrollBehavior = getActiveResultRevealScrollBehavior('),
    'PopupContentHost should choose active-row reveal behavior from the current input mode.'
  )
  assert(
    source.includes('isKeyboardNavigationActive()') && source.includes('behavior: revealScrollBehavior'),
    'PopupContentHost should keep repeated keyboard navigation synchronized with immediate scrolling.'
  )
  assert(
    source.includes('getClippedActiveResultIndicatorGeometry(workspaceRect, targetRect, viewportRect)'),
    'PopupContentHost should clip the workspace indicator to the active pane scroll viewport.'
  )
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup active result scroll tests passed.')
