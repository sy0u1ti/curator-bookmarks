import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getHistoricalAbnormalStreak,
  getHistoryRunsForScope,
  hydrateDetectionHistory
} from '../src/options/sections/history.js'
import { managerState } from '../src/options/shared-options/state.js'

const callbacks = {
  getCurrentAvailabilityScopeMeta() {
    return {
      key: 'all',
      type: 'all',
      folderId: '',
      label: '全部书签'
    }
  },
  renderAvailabilitySection() {}
}

test('hydrates detection history for the active scope', () => {
  hydrateDetectionHistory(
    {
      runs: [
        {
          runId: 'run-2',
          completedAt: 200,
          scope: { key: 'all', type: 'all', label: '全部书签' },
          results: [
            { id: 'a', title: 'A', url: 'https://a.example', status: 'failed', streak: 2 }
          ],
          newResults: [],
          recoveredResults: [
            { id: 'b', title: 'B', url: 'https://b.example', status: 'review', streak: 1 }
          ],
          summary: {
            totalAbnormal: 1,
            newCount: 0,
            persistentCount: 1,
            recoveredCount: 1,
            reviewCount: 0,
            failedCount: 1
          }
        },
        {
          runId: 'run-1',
          completedAt: 100,
          scope: { key: 'all', type: 'all', label: '全部书签' },
          results: [
            { id: 'a', title: 'A', url: 'https://a.example', status: 'review', streak: 1 }
          ],
          newResults: [
            { id: 'a', title: 'A', url: 'https://a.example', status: 'review', streak: 1 }
          ],
          recoveredResults: [],
          summary: {
            totalAbnormal: 1,
            newCount: 1,
            persistentCount: 0,
            recoveredCount: 0,
            reviewCount: 1,
            failedCount: 0
          }
        }
      ]
    },
    callbacks
  )

  assert.equal(managerState.historyLastRunAt, 200)
  assert.equal(managerState.historyRecoveredResults.length, 1)
  assert.equal(managerState.previousHistoryMap.get('a').status, 'failed')
  assert.equal(getHistoryRunsForScope(callbacks).length, 2)
  assert.equal(getHistoricalAbnormalStreak('a', callbacks), 2)
})
