import assert from 'node:assert/strict'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

// Run the real React component and its incremental renderer. Title getters
// count tile work without production instrumentation or timing thresholds.
const fixture = `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { NewtabBookmarkContent } from './newtab/components/NewtabBookmarkContent'
import { dispatchNewtabBookmarkContentView, getNewtabBookmarkContentNodes } from './newtab/newtab-bookmark-content-store'
import { dispatchNewtabDragUiView } from './newtab/newtab-drag-ui-store'

const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
let titleReads = 0
let lastAction = ''
let view
const root = createRoot(document.getElementById('root'))

function createItem(id, title = 'Bookmark ' + id, url = 'https://example.com/' + id, changed = false) {
  return {
    id,
    folderId: 'folder',
    get title() { titleReads += 1; return title },
    url,
    customIcon: changed,
    dragging: changed,
    style: changed ? { transform: 'translate3d(12px, 0px, 0px)', zIndex: 2 } : undefined,
    fallbackLabel: id[0],
    favicon: { fetchpriority: 'low', loading: 'eager', src: pixel + (changed ? '#updated' : '') },
    onContextMenu: (event) => { event.preventDefault(); lastAction = 'context:' + title },
    onDragPointerDown: () => { lastAction = 'drag:' + title },
    onReorderKeyDown: () => { lastAction = 'key:' + title },
    onNavigate: (event) => { event.preventDefault(); lastAction = 'navigate:' + title }
  }
}

window.startRender = () => {
  titleReads = 0
  view = {
    content: { columnGap: 16, columns: 12, fixedGridWidth: 960, folderGap: 16, iconShellSize: 48, layoutMode: 'fixed', pageWidth: 960, reordering: false, rowGap: 16, showTitles: true, tileWidth: 64, titleLines: 2, verticalCenter: false },
    browseMode: 'navigation',
    navigation: { ariaLabel: 'Bookmarks', breadcrumb: [], chunkSize: 48, folderCards: [], initialVisibleCount: 72, items: Array.from({ length: 960 }, (_, index) => createItem('b' + index)) },
    portal: null,
    reorderStatus: null,
    sections: [],
    sourceNavigation: null,
    speedDial: false
  }
  dispatchNewtabBookmarkContentView(view)
  root.render(React.createElement(NewtabBookmarkContent))
}
window.readRenderMetrics = () => ({ titleReads, registrySize: getNewtabBookmarkContentNodes().tiles.size, lastAction })
window.resetTitleReads = () => { titleReads = 0 }
window.changeDrag = (patch) => dispatchNewtabDragUiView(patch)
window.changeOneBookmark = () => {
  view = {
    ...view,
    navigation: {
      ...view.navigation,
      items: view.navigation.items.map((item, index) => index === 1 ? createItem(item.id, 'Updated bookmark', 'https://updated.example/path', true) : item)
    }
  }
  dispatchNewtabBookmarkContentView(view)
}
window.changeTitleVisibility = (showTitles) => {
  view = { ...view, content: { ...view.content, showTitles } }
  dispatchNewtabBookmarkContentView(view)
}
window.reorderBookmarks = () => {
  const items = [...view.navigation.items]
  ;[items[0], items[1]] = [items[1], items[0]]
  view = { ...view, navigation: { ...view.navigation, items } }
  dispatchNewtabBookmarkContentView(view)
}
window.removeBookmark = () => {
  view = { ...view, navigation: { ...view.navigation, items: view.navigation.items.filter((item) => item.id !== 'b1') } }
  dispatchNewtabBookmarkContentView(view)
}
window.bookmarkRefMatches = (id) => getNewtabBookmarkContentNodes().tiles.get(id) === document.querySelector('[data-bookmark-id="' + id + '"]')
`

const compiled = await build({
  stdin: { contents: fixture, resolveDir: path.resolve('src'), loader: 'tsx' },
  bundle: true,
  write: false,
  jsx: 'automatic',
  format: 'iife',
  platform: 'browser',
  target: 'chrome140',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'silent'
})

const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('http://newtab-perf.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><style>.bookmark-navigation nav {display:grid;grid-template-columns:repeat(12,64px)} .bookmark-icon-shell {display:block;width:48px;height:48px} .bookmark-icon-shell img {width:32px;height:32px}</style></head><body><div id="root"></div></body></html>'
  }))
  await page.addInitScript(() => {
    // The initial placeholder intersects in this fixture. Keep that condition
    // deterministic while exercising the component's real animation frames.
    window.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback
        this.disconnected = false
      }
      observe(target) {
        queueMicrotask(() => {
          if (!this.disconnected) this.callback([{ target, isIntersecting: true }])
        })
      }
      disconnect() { this.disconnected = true }
      unobserve() {}
    }
  })
  await page.goto('http://newtab-perf.test/')
  await page.addScriptTag({ content: compiled.outputFiles[0].text })
  const settle = () => page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ))

  await page.evaluate(() => window.startRender())
  await page.waitForFunction(() => document.querySelectorAll('.bookmark-tile').length === 960 && !document.querySelector('[data-incremental-render]'))
  await settle()
  const mount = await page.evaluate(() => window.readRenderMetrics())
  assert.equal(mount.registrySize, 960)
  assert.equal(await page.evaluate(() => window.bookmarkRefMatches('b0')), true)
  assert.ok(mount.titleReads <= 960 * 6, `Appending chunks must use linear tile rendering; observed ${mount.titleReads} title reads.`)

  await page.evaluate(() => { window.resetTitleReads(); window.changeDrag({ folderPendingId: 'unrelated' }) })
  await settle()
  assert.equal((await page.evaluate(() => window.readRenderMetrics())).titleReads, 0, 'Folder drag state must not rerender bookmark tiles.')

  await page.evaluate(() => { window.resetTitleReads(); window.changeDrag({ bookmarkPendingId: 'b0' }) })
  await page.waitForFunction(() => document.querySelector('[data-bookmark-id="b0"] [data-drag-pending="true"]'))
  assert.ok((await page.evaluate(() => window.readRenderMetrics())).titleReads <= 6, 'Only the pending bookmark needs its drag handle refreshed.')

  await page.evaluate(() => window.changeDrag({ bookmarkDragging: true, previewInitializing: true }))
  await page.waitForFunction(() => [...document.querySelectorAll('.bookmark-tile')].every((tile) =>
    tile.classList.contains('curator-motion-disabled') && tile.classList.contains('[--bookmark-tile-transition:none]')
  ))
  await page.evaluate(() => window.changeDrag({ bookmarkDragging: false, previewInitializing: false }))
  await page.waitForFunction(() => [...document.querySelectorAll('.bookmark-tile')].every((tile) =>
    !tile.classList.contains('curator-motion-disabled') && !tile.classList.contains('[--bookmark-tile-transition:none]')
  ))

  await page.evaluate(() => { window.resetTitleReads(); window.changeOneBookmark() })
  await page.waitForFunction(() => document.querySelector('[data-bookmark-id="b1"]').title === 'Updated bookmark')
  assert.ok((await page.evaluate(() => window.readRenderMetrics())).titleReads <= 6, 'Changing one bookmark must not rerender its unchanged siblings.')
  const updatedTile = page.locator('[data-bookmark-id="b1"]')
  assert.equal(await updatedTile.getAttribute('href'), 'https://updated.example/path')
  assert.equal(await updatedTile.locator('img').evaluate((image) => image.src.endsWith('#updated') && image.classList.contains('custom-icon')), true)
  assert.equal(await updatedTile.evaluate((tile) => tile.classList.contains('dragging') && tile.style.transform === 'translate3d(12px, 0px, 0px)'), true)
  await updatedTile.click()
  assert.equal((await page.evaluate(() => window.readRenderMetrics())).lastAction, 'navigate:Updated bookmark')
  await updatedTile.press('Alt+ArrowRight')
  assert.equal((await page.evaluate(() => window.readRenderMetrics())).lastAction, 'key:Updated bookmark')

  await page.evaluate(() => window.changeTitleVisibility(false))
  await page.waitForFunction(() => [...document.querySelectorAll('.bookmark-title')].every((title) => title.hidden))
  await page.evaluate(() => window.changeTitleVisibility(true))
  await page.waitForFunction(() => [...document.querySelectorAll('.bookmark-title')].every((title) => !title.hidden))

  await page.evaluate(() => { window.resetTitleReads(); window.reorderBookmarks() })
  await page.waitForFunction(() => document.querySelector('.bookmark-tile').dataset.bookmarkId === 'b1')
  assert.equal((await page.evaluate(() => window.readRenderMetrics())).titleReads, 0, 'Keyed reordering must retain tile render output.')
  assert.equal(await page.evaluate(() => window.bookmarkRefMatches('b1')), true)
  await page.evaluate(() => window.removeBookmark())
  await page.waitForFunction(() => document.querySelectorAll('.bookmark-tile').length === 959)
  assert.equal((await page.evaluate(() => window.readRenderMetrics())).registrySize, 959, 'Deleted tiles must release their DOM refs.')
  assert.deepEqual(errors, [])
  console.log('Newtab incremental rendering and live bookmark-prop regression tests passed.')
} finally {
  await browser.close()
}
