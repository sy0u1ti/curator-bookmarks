import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import {
  buildNewTabPortalOverview,
  buildNewTabSourceNavigationItems,
  collectPortalBookmarkSourceItems,
  getNewTabSourceAnchorId,
  getPortalQuickAccessItems,
  resolvePortalPanelLayout,
  getVerticalCenterCollisionOffset
} from '../src/newtab/content-state.js'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

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

test('builds portal quick access from the full bookmark tree, not only visible sections', () => {
  const now = new Date('2026-05-02T10:30:00+08:00').getTime()
  const visibleTime = now - 3 * 60 * 60 * 1000
  const hiddenTime = now - 60 * 60 * 1000
  const bookmarks = collectPortalBookmarkSourceItems({
    id: '0',
    title: '',
    children: [
      {
        id: '10',
        title: '标签页',
        children: [
          { id: '11', title: 'Visible', url: 'https://example.com/visible', dateAdded: visibleTime }
        ]
      },
      {
        id: '20',
        title: '其他书签',
        children: [
          { id: '21', title: 'Hidden', url: 'https://example.com/hidden', dateAdded: hiddenTime }
        ]
      }
    ]
  })

  const quickAccess = getPortalQuickAccessItems({
    now,
    itemLimit: 2,
    showFrequent: false,
    showRecent: true,
    pinnedIds: [],
    bookmarks,
    records: {}
  })

  assert.deepEqual(
    quickAccess.recentItems.map((item) => item.id),
    ['21', '11']
  )
})

test('resolves portal layout from overview and quick access visibility', () => {
  assert.equal(resolvePortalPanelLayout({
    showOverview: true,
    hasOverviewSignal: true,
    hasQuickAccess: true
  }), 'full')
  assert.equal(resolvePortalPanelLayout({
    showOverview: true,
    hasOverviewSignal: true,
    hasQuickAccess: false
  }), 'overview-only')
  assert.equal(resolvePortalPanelLayout({
    showOverview: false,
    hasOverviewSignal: true,
    hasQuickAccess: true
  }), 'quick-only')
  assert.equal(resolvePortalPanelLayout({
    showOverview: false,
    hasOverviewSignal: true,
    hasQuickAccess: false
  }), 'hidden')
})

test('newtab settings expose one combined quick access switch', () => {
  const html = readProjectFile('src/newtab/newtab.html')

  assert.match(html, /显示常用和最近/)
  assert.match(html, /id="general-show-quick-access"/)
  assert.doesNotMatch(html, /id="general-show-frequent"/)
  assert.doesNotMatch(html, /id="general-show-recent"/)
})

test('newtab folder headers expose scoped quick-add controls', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.match(script, /addFolderId: ''/)
  assert.match(script, /data-add-bookmark-folder-id/)
  assert.match(script, /function openAddBookmarkMenuForElement/)
  assert.match(script, /const folderId = state\.addFolderId \|\| await ensureNewTabFolder\(\)/)
  assert.match(script, /headerRow\.append\(header, createFolderAddButton\(section\)\)/)
  assert.match(css, /\.folder-section-header-row/)
  assert.match(css, /\.folder-section-add/)
})

test('builds compact source navigation data with stable anchors and bookmark counts', () => {
  assert.deepEqual(
    buildNewTabSourceNavigationItems([
      {
        id: '10',
        title: '工作',
        path: '书签栏 / 工作',
        bookmarks: [
          { id: '11', title: 'Docs', url: 'https://example.com/docs' },
          { id: '12', title: 'Folder' }
        ]
      },
      {
        id: 'folder:design',
        title: '',
        path: '',
        bookmarks: [
          { id: '21', title: 'Tokens', url: 'https://example.com/tokens' }
        ]
      },
      {
        id: ' ',
        title: '无效',
        path: '无效',
        bookmarks: []
      }
    ]),
    [
      {
        id: '10',
        anchorId: 'newtab-source-10',
        title: '工作',
        path: '书签栏 / 工作',
        bookmarkCount: 1
      },
      {
        id: 'folder:design',
        anchorId: 'newtab-source-folder-design',
        title: '未命名文件夹',
        path: '未命名文件夹',
        bookmarkCount: 1
      }
    ]
  )
})

test('newtab exposes source navigation anchors and a folder source setting switch', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.equal(getNewTabSourceAnchorId('folder:design'), 'newtab-source-folder-design')
  assert.match(html, /id="folder-show-source-navigation"/)
  assert.match(script, /buildNewTabSourceNavigationItems/)
  assert.match(script, /sectionNode\.id = getNewTabSourceAnchorId\(section\.id\)/)
  assert.match(script, /dataset\.sourceNavigationTarget/)
  assert.match(css, /\.source-navigation/)
})
