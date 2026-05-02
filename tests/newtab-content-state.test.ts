import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildNewTabPortalOverview,
  getPortalQuickAccessItems,
  getVerticalCenterCollisionOffset
} from '../src/newtab/content-state.js'

test('does not offset vertically centered icons when utility stack has enough clearance', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 120,
    contentTop: 132
  }), 0)
})

test('offsets vertically centered icons only enough to clear the utility stack', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 160,
    contentTop: 140
  }), 32)
})

test('supports custom minimum clearance for compact viewports', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 160,
    contentTop: 140,
    minimumGap: 4
  }), 24)
})

test('builds a compact newtab portal overview from folders and activity', () => {
  const now = new Date('2026-05-02T10:30:00+08:00').getTime()
  const today = new Date('2026-05-02T09:00:00+08:00').getTime()
  const yesterday = new Date('2026-05-01T20:00:00+08:00').getTime()

  const overview = buildNewTabPortalOverview({
    now,
    sections: [
      {
        title: '工作',
        path: '书签栏 / 工作',
        bookmarks: [
          { id: '1', title: 'React', url: 'https://example.com/react', dateAdded: today },
          { id: '2', title: 'Docs', url: 'https://example.com/docs', dateAdded: yesterday }
        ]
      },
      {
        title: '设计',
        path: '书签栏 / 设计',
        bookmarks: [
          { id: '3', title: 'Tokens', url: 'https://example.com/tokens', dateAdded: today }
        ]
      }
    ],
    activityRecords: {
      1: { bookmarkId: '1', openCount: 2, lastOpenedAt: today },
      2: { bookmarkId: '2', openCount: 1, lastOpenedAt: yesterday },
      9: { bookmarkId: '9', openCount: 4, lastOpenedAt: today }
    }
  })

  assert.deepEqual(overview, {
    bookmarkCount: 3,
    folderCount: 2,
    openedTodayCount: 1,
    addedTodayCount: 2
  })
})

test('selects portal quick access items without duplicating frequent and recent entries', () => {
  const now = new Date('2026-05-02T10:30:00+08:00').getTime()
  const oneHourAgo = now - 60 * 60 * 1000
  const twoHoursAgo = now - 2 * 60 * 60 * 1000
  const yesterday = now - 24 * 60 * 60 * 1000

  const quickAccess = getPortalQuickAccessItems({
    now,
    itemLimit: 2,
    showFrequent: true,
    showRecent: true,
    pinnedIds: ['3', 'missing'],
    bookmarks: [
      { id: '1', title: 'React', url: 'https://example.com/react', dateAdded: yesterday },
      { id: '2', title: 'Docs', url: 'https://example.com/docs', dateAdded: twoHoursAgo },
      { id: '3', title: 'Tokens', url: 'https://example.com/tokens', dateAdded: oneHourAgo },
      { id: '4', title: 'Empty', url: '' }
    ],
    records: {
      1: { bookmarkId: '1', openCount: 5, lastOpenedAt: yesterday },
      2: { bookmarkId: '2', openCount: 1, lastOpenedAt: oneHourAgo },
      3: { bookmarkId: '3', openCount: 3, lastOpenedAt: twoHoursAgo },
      4: { bookmarkId: '4', openCount: 8, lastOpenedAt: oneHourAgo }
    }
  })

  assert.deepEqual(
    quickAccess.frequentItems.map((item) => ({
      id: item.id,
      reason: item.reason,
      badge: item.badge,
      detail: item.detail
    })),
    [
      { id: '3', reason: 'pinned', badge: '固', detail: '已固定' },
      { id: '1', reason: 'frequent', badge: '常', detail: '打开 5 次' }
    ]
  )
  assert.deepEqual(
    quickAccess.recentItems.map((item) => ({
      id: item.id,
      reason: item.reason,
      badge: item.badge
    })),
    [
      { id: '2', reason: 'opened', badge: '开' }
    ]
  )
})
