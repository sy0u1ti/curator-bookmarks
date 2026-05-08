import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isDashboardVirtualMetricsReady,
  shouldRevealDashboardPanelAfterRender,
  shouldResetDashboardPanelRevealForSectionEntry,
  shouldResetDashboardPanelRevealForRender,
  shouldResetDashboardVirtualScrollForFilterChange
} from '../src/options/sections/dashboard.js'

test('dashboard section entry resets reveal before showing cached cards', () => {
  assert.equal(
    shouldResetDashboardPanelRevealForSectionEntry({
      previousSectionKey: 'general',
      nextSectionKey: 'dashboard'
    }),
    true
  )
  assert.equal(
    shouldResetDashboardPanelRevealForSectionEntry({
      previousSectionKey: 'dashboard',
      nextSectionKey: 'dashboard'
    }),
    false
  )
  assert.equal(
    shouldResetDashboardPanelRevealForSectionEntry({
      previousSectionKey: 'dashboard',
      nextSectionKey: 'general'
    }),
    false
  )
})

test('dashboard folder switches do not reset the ready panel reveal', () => {
  assert.equal(
    shouldResetDashboardPanelRevealForRender({ catalogLoading: false, viewReady: true }),
    false
  )
  assert.equal(
    shouldResetDashboardPanelRevealForRender({ catalogLoading: false, viewReady: false }),
    false
  )
  assert.equal(
    shouldResetDashboardPanelRevealForRender({ catalogLoading: true, viewReady: true }),
    true
  )
})

test('dashboard initial reveal waits for the latest committed card render', () => {
  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: true,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 1,
      revealRenderVersion: 1,
      committedRenderVersion: 1
    }),
    false
  )

  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: false,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 2,
      revealRenderVersion: 2,
      committedRenderVersion: 1
    }),
    false
  )

  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: false,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 3,
      revealRenderVersion: 2,
      committedRenderVersion: 2
    }),
    false
  )

  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: false,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 3,
      revealRenderVersion: 3,
      committedRenderVersion: 3
    }),
    true
  )
})

test('dashboard folder filter changes preserve virtual scroll reset state', () => {
  assert.equal(
    shouldResetDashboardVirtualScrollForFilterChange({
      previousKey: 'query\u0001domain\u0001month\u0001date-desc',
      nextKey: 'query\u0001domain\u0001month\u0001date-desc',
      reason: 'folder'
    }),
    false
  )
  assert.equal(
    shouldResetDashboardVirtualScrollForFilterChange({
      previousKey: 'query\u0001domain\u0001month\u0001date-desc',
      nextKey: 'query\u0001folder-2\u0001domain\u0001month\u0001date-desc',
      reason: 'folder'
    }),
    false
  )
  assert.equal(
    shouldResetDashboardVirtualScrollForFilterChange({
      previousKey: '',
      nextKey: 'new-query\u0001folder-2\u0001domain\u0001month\u0001date-desc',
      reason: 'query'
    }),
    true
  )
})

test('dashboard virtual metrics require usable layout dimensions', () => {
  assert.equal(isDashboardVirtualMetricsReady({
    contentWidth: 1,
    containerHeight: 560,
    columnCount: 1
  }), false)
  assert.equal(isDashboardVirtualMetricsReady({
    contentWidth: 640,
    containerHeight: 1,
    columnCount: 2
  }), false)
  assert.equal(isDashboardVirtualMetricsReady({
    contentWidth: 48,
    containerHeight: 48,
    columnCount: 1
  }), true)
})
