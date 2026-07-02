import { readFileSync } from 'node:fs'
import {
  ACTIVE_RESULT_REVEAL_MARGIN,
  getActiveResultContentTop,
  getActiveResultRevealScrollBehavior,
  getActiveResultRevealScrollTop
} from './popup-active-result-scroll.js'

function run(): void {
  testContentTopUsesViewportRects()
  testBottomEdgeWaitsUntilHalfHidden()
  testTopEdgeWaitsUntilHalfHidden()
  testTopRevealClampsToStart()
  testScrollBehaviorRespectsReducedMotion()
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

function testBottomEdgeWaitsUntilHalfHidden(): void {
  const visibleEnough = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 259,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 100
  })
  assert(visibleEnough === null, `bottom reveal should wait while less than half is hidden, got ${visibleEnough}`)

  const halfHidden = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 260,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 100
  })
  assert(
    halfHidden === 148,
    `bottom reveal should align the active row with ${ACTIVE_RESULT_REVEAL_MARGIN}px breathing room, got ${halfHidden}`
  )
}

function testTopEdgeWaitsUntilHalfHidden(): void {
  const visibleEnough = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 161,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 200
  })
  assert(visibleEnough === null, `top reveal should wait while less than half is hidden, got ${visibleEnough}`)

  const halfHidden = getActiveResultRevealScrollTop({
    itemHeight: 80,
    itemTop: 160,
    maxScrollTop: 1000,
    viewportHeight: 200,
    viewportTop: 200
  })
  assert(
    halfHidden === 152,
    `top reveal should align the active row with ${ACTIVE_RESULT_REVEAL_MARGIN}px breathing room, got ${halfHidden}`
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
  assert(getActiveResultRevealScrollBehavior(false) === 'smooth', 'active result reveal should use smooth scrolling by default')
  assert(getActiveResultRevealScrollBehavior(true) === 'auto', 'active result reveal should avoid smooth scrolling for reduced motion')
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
    source.includes('scrollTo({') && source.includes('behavior: getActiveResultRevealScrollBehavior'),
    'PopupContentHost should animate active-row reveal instead of assigning scrollTop instantly.'
  )
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup active result scroll tests passed.')
