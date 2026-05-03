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

function getCssRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))
  return match?.[1] || ''
}

function getCssRuleBodies(css: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1] || '')
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

test('newtab search settings use Google as the default engine without duplicate default entry', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const source = readProjectFile('src/newtab/newtab.ts')

  assert.doesNotMatch(html, /value="default"/)
  assert.doesNotMatch(html, /data-search-engine-toggle="default"/)
  assert.match(source, /engine:\s*'google'\s+as SearchEngineId/)
})

test('newtab exposes a lazy options dashboard iframe route', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')
  const dashboardTrigger = html.match(/<a[\s\S]*?id="newtab-dashboard-trigger"[\s\S]*?<\/a>/)?.[0] || ''
  const dashboardOverlay = html.match(/<[a-z]+[\s\S]*?id="newtab-dashboard-overlay"[\s\S]*?>/)?.[0] || ''
  const dashboardFrame = html.match(/<iframe[\s\S]*?id="newtab-dashboard-frame"[\s\S]*?>/)?.[0] || ''

  assert.match(dashboardTrigger, /href="#dashboard"/)
  assert.match(dashboardTrigger, /aria-controls="newtab-dashboard-overlay"/)
  assert.match(dashboardTrigger, />\s*书签仪表盘\s*<\/span>/)
  assert.match(dashboardOverlay, /\bhidden\b/)
  assert.match(dashboardOverlay, /aria-hidden="true"/)
  assert.match(dashboardFrame, /loading="lazy"/)
  assert.match(dashboardFrame, /title="书签仪表盘"/)
  assert.doesNotMatch(html, /data-newtab-dashboard-root/)

  assert.ok(
    /NEWTAB_DASHBOARD_EMBED_PATH/.test(script) ||
      /options\.html\?embed=newtab-dashboard#dashboard/.test(script),
    'newtab should point the iframe at the embedded options dashboard route'
  )
  assert.match(script, /chrome\.runtime\.getURL\(/)
  assert.match(script, /window\.location\.hash === '#dashboard'/)
  assert.match(script, /addEventListener\(['"]message['"][\s\S]*curator:newtab-dashboard-close/)

  for (const pattern of [
    /buildDashboardPanel/,
    /createDashboardBookmarkCard/,
    /renderDashboardFolderSidebar/,
    /applyDashboardFolderFilter/,
    /renderDashboardCardWindow/,
    /dashboard-performance/,
    /createDashboardFaviconWarmupQueue/,
    /getDashboardVirtualWindow/,
    /buildDashboardModel/,
    /filterDashboardItems/,
    /sortDashboardItems/
  ]) {
    assert.doesNotMatch(script, pattern)
  }
})

test('newtab does not duplicate options dashboard markup or card semantics', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.doesNotMatch(html, /class="options-panel dashboard-panel"/)
  assert.doesNotMatch(html, /id="newtab-dashboard"[\s\S]*data-newtab-dashboard-root/)

  for (const className of [
    'options-section-label',
    'options-group dashboard-toolbar',
    'options-search dashboard-search',
    'options-search-input',
    'options-button secondary small',
    'dashboard-panel',
    'dashboard-title-row',
    'dashboard-toolbar',
    'dashboard-content-layout',
    'dashboard-folder-sidebar',
    'dashboard-folder-tree',
    'dashboard-search',
    'dashboard-card-grid',
    'dashboard-bookmark-card'
  ]) {
    assert.doesNotMatch(script, new RegExp(className))
  }

  assert.doesNotMatch(script, /Visual Bookmark Management/)
  assert.doesNotMatch(script, /全部书签/)
  assert.doesNotMatch(script, /detect-result-open/)
  assert.doesNotMatch(script, /detect-result-action/)
})

test('newtab boots with a wallpaper loading guard before app content is shown', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const css = readProjectFile('src/newtab/newtab.css')
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(html, /<html lang="zh-CN" class="loading-wallpaper newtab-booting">/)
  assert.match(css, /--wallpaper-placeholder-bg: #000000/)
  assert.match(css, /html\.loading-wallpaper \.newtab-shell/)
  assert.match(css, /visibility: hidden/)
  assert.match(script, /const backgroundPreloadPromise = preloadBackgroundSettings\(\)/)
  assert.match(script, /function markWallpaperReady\(\): void/)
  assert.match(script, /classList\.remove\('loading-wallpaper', 'newtab-booting'\)/)
})

test('newtab waits for local wallpaper media readiness before revealing the startup view', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /waitForBackgroundImageReady\(objectUrl, applyToken\)/)
  assert.match(script, /waitForBackgroundVideoReady\(video, applyToken\)/)
  assert.match(script, /loadedmetadata/)
  assert.match(script, /canplay/)
  assert.match(script, /markWallpaperPending\(\)/)
  assert.match(script, /markWallpaperReady\(\)/)
})

test('newtab url wallpaper loading does not block the main view', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(
    script,
    /if \(settings\.type === 'urls'\) \{[\s\S]*?markWallpaperReady\(\)[\s\S]*?void applyUrlBackgroundImage\(imageUrl, applyToken, mediaSignature\)/
  )
  assert.doesNotMatch(
    script,
    /if \(settings\.type === 'urls'\) \{[\s\S]*?await applyUrlBackgroundImage\(imageUrl, applyToken, mediaSignature\)/
  )
  assert.match(script, /preserveCurrentUntilReady: true/)
  assert.match(script, /waitForBackgroundImageReady\(imageUrl, applyToken\)/)
})

test('newtab wallpaper startup fallback stays silent in extension errors', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.doesNotMatch(script, /console\.(?:warn|error)\([^)]*启动等待窗口/)
  assert.doesNotMatch(script, /console\.error\(error\)/)
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

test('newtab settings drawer layout responds to drawer width', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(css, /container:\s*settings-drawer\s*\/\s*inline-size/)
  assert.match(css, /@container settings-drawer \(max-width: 380px\)/)
  assert.match(css, /\.search-engine-setting-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(css, /\.search-engine-toggle-grid\s*\{[\s\S]*width:\s*100%/)
  assert.doesNotMatch(css, /width:\s*min\(360px,\s*42vw\)/)
  assert.match(css, /--preview-grid-max-width/)
  assert.match(script, /--preview-grid-max-width/)
  assert.match(script, /grid\.style\.gridTemplateColumns = `repeat\(\$\{previewColumns\}, minmax\(0, 1fr\)\)`/)
  assert.doesNotMatch(script, /grid\.style\.gridTemplateColumns = `repeat\(\$\{previewColumns\}, minmax\(0, var\(--preview-tile-width\)\)\)`/)
})

test('newtab settings rows avoid per-option divider lines', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const sectionDividerRule = getCssRuleBody(css, '.settings-section + .settings-section')

  assert.match(sectionDividerRule, /border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.1\)/)
  assert.match(sectionDividerRule, /padding-top:\s*24px/)
  assert.doesNotMatch(getCssRuleBody(css, '.setting-row'), /border-bottom:/)
  assert.equal(getCssRuleBody(css, '.setting-row:last-child'), '')
  assert.doesNotMatch(getCssRuleBody(css, '.icon-live-preview-panel'), /border-bottom:/)
  assert.doesNotMatch(getCssRuleBody(css, '.icon-preset-row'), /border-bottom:/)
})

test('newtab settings switch rows stay aligned with their labels', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const switchRowRules = getCssRuleBodies(css, '.setting-row:has(.setting-switch)')
  const switchRules = getCssRuleBodies(css, '.setting-row:has(.setting-switch) .setting-switch')

  assert.equal(switchRowRules.length, 3)
  assert.equal(switchRules.length, 3)
  for (const rule of switchRowRules) {
    assert.match(rule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/)
    assert.match(rule, /align-items:\s*center/)
  }
  for (const rule of switchRules) {
    assert.match(rule, /align-self:\s*center/)
    assert.match(rule, /justify-self:\s*end/)
  }
})

test('newtab settings section titles are visually prominent', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const sectionTitleRule = getCssRuleBody(css, '.settings-section h2')

  assert.match(sectionTitleRule, /font-size:\s*13px/)
  assert.match(sectionTitleRule, /font-weight:\s*760/)
  assert.match(sectionTitleRule, /color:\s*rgba\(245,\s*245,\s*247,\s*0\.78\)/)
})

test('newtab dashboard glass layer only styles the iframe shell', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?position:\s*fixed/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?inset:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?align-items:\s*stretch/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?justify-items:\s*stretch/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?padding:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[hidden\]\s*\{[\s\S]*?display:\s*none/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?width:\s*100dvw/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?height:\s*100dvh/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?border-radius:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?backdrop-filter:\s*blur\(/)
  assert.match(newtabCss, /\.newtab-dashboard-frame\s*\{/)
  assert.match(newtabCss, /\.dashboard-trigger\s*\{[\s\S]*?min-width:\s*124px/)
  assert.match(newtabCss, /\.dashboard-trigger span\s*\{[\s\S]*?white-space:\s*nowrap/)
  assert.match(newtabCss, /@media \(prefers-reduced-motion: reduce\)/)

  assert.doesNotMatch(
    newtabCss,
    /\.newtab-dashboard-surface\s+\.(?:dashboard-|options-|detect-)/
  )
  assert.doesNotMatch(
    newtabCss,
    /@media [^{]+\{[\s\S]*?\.newtab-dashboard-surface\s+\.dashboard-(?:title-row|toolbar|card-grid|bookmark-card)/
  )
  assert.doesNotMatch(
    newtabCss,
    /\.newtab-dashboard-surface\s+\.dashboard-(?:content-layout|folder-sidebar|folder-tree)/
  )
  assert.doesNotMatch(optionsCss, /newtab-dashboard-(?:overlay|surface|frame)/)
})

test('newtab bookmark tiles match the frosted overview card surface', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')
  const tileRule = getCssRuleBody(newtabCss, '.bookmark-tile')
  const hoverRule = getCssRuleBody(newtabCss, '.bookmark-tile:hover,\n.bookmark-tile:focus-visible')

  assert.match(tileRule, /border-radius:\s*8px/)
  assert.match(tileRule, /background:\s*rgba\(8,\s*8,\s*9,\s*var\(--bookmark-card-bg-alpha\)\)/)
  assert.match(tileRule, /box-shadow:\s*inset\s+0\s+1px\s+0\s+rgba\(255,\s*255,\s*255,\s*0\.035\)/)
  assert.match(tileRule, /backdrop-filter:\s*blur\(16px\)/)
  assert.doesNotMatch(tileRule, /linear-gradient/)
  assert.match(hoverRule, /background:\s*rgba\(8,\s*8,\s*9,\s*var\(--bookmark-card-hover-alpha\)\)/)
  assert.doesNotMatch(hoverRule, /box-shadow:\s*0\s+10px/)
})
