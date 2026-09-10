import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

// Exercise the actual content host, virtual windows, and rows. Work counters
// make the scroll regression independent of the machine's frame rate.
const fixture = `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { PopupContentHost } from './popup/components/PopupContentHost'
import { dispatchPopupContentChange, registerPopupActionHandlers } from './popup/popup-controller-store'
import { initSquircleEngine } from './shared/squircle-engine'

let folderReads = 0
let bookmarkReads = 0
let lastAction = null
let state
registerPopupActionHandlers({ content: action => { lastAction = action } })
initSquircleEngine()
createRoot(document.getElementById('popup-app-shell')).render(<PopupContentHost />)
const menu = id => ({ items: ['edit', 'copy-url', 'open-current-tab', 'move', 'delete'].map(action => ({ action, ariaLabel: action + ' ' + id, bookmarkId: id, danger: action === 'delete', disabled: false, label: action })) })
const bookmark = (index, active = false, title = 'Bookmark ' + index) => ({
  kind: 'bookmark', bookmarkId: 'b' + index, index, active, depth: 0,
  get title() { bookmarkReads++; return title },
  displayUrl: 'example.com/' + index, url: 'https://example.com/' + index,
  path: 'Bookmarks', parentId: 'root', menuLabel: 'Actions ' + index, menu: menu('b' + index)
})
const folder = (index, keyboardActive = false, title = 'Folder ' + index) => ({
  kind: 'folder', folderId: 'f' + index, index, active: index === 0, keyboardActive,
  countLabel: '13', depth: 1, expanded: true, root: false,
  subtitle: title, toggleLabel: title,
  get title() { folderReads++; return title }
})
const publish = (preserveScroll = true) => {
  state = { ...state, rows: [...state.sidebarRows, ...state.mainRows] }
  dispatchPopupContentChange(state, { preserveScroll })
}
window.mountScenario = (count = 80, selected = -1) => {
  state = {
    title: 'Bookmarks', meta: count + ' bookmarks', mode: 'tree', loading: false,
    keyboardPane: 'bookmarks',
    mainRows: Array.from({ length: count }, (_, index) => bookmark(index, index === selected)),
    sidebarRows: Array.from({ length: 80 }, (_, index) => folder(index))
  }
  publish(false)
}
window.resetProbe = () => { folderReads = 0; bookmarkReads = 0; window.__commits = 0 }
window.readProbe = () => ({ folderReads, bookmarkReads, commits: window.__commits, lastAction })
window.selectBookmark = index => {
  document.getElementById('popup-app-shell').dataset.keyboardNav = 'true'
  state = { ...state, keyboardPane: 'bookmarks', mainRows: state.mainRows.map(row => row.active === (row.index === index) ? row : bookmark(row.index, row.index === index)) }
  publish(false)
}
window.selectFolder = index => {
  document.getElementById('popup-app-shell').dataset.keyboardNav = 'true'
  state = { ...state, keyboardPane: 'folders', mainRows: state.mainRows.map(row => row.active ? bookmark(row.index) : row), sidebarRows: state.sidebarRows.map(row => row.keyboardActive === (row.index === index) ? row : folder(row.index, row.index === index)) }
  publish(false)
}
window.renameFolder = index => {
  state = { ...state, sidebarRows: state.sidebarRows.map(row => row.index === index ? folder(index, row.keyboardActive, 'Renamed folder') : row) }
  publish()
}
window.shrinkRows = () => { state = { ...state, mainRows: state.mainRows.slice(0, 30), sidebarRows: state.sidebarRows.slice(0, 30) }; publish() }
`

const compiled = await build({
  stdin: { contents: fixture, resolveDir: path.resolve('src'), loader: 'tsx' },
  bundle: true, write: false, jsx: 'automatic', format: 'iife', platform: 'browser',
  target: 'chrome140', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent'
})
const cssFiles = (await readdir('dist/assets')).filter(name => /^(?:ThemeProvider|popup)-.*\.css$/.test(name))
assert.equal(cssFiles.length, 2, 'Build the extension before running the popup browser regression.')
const css = (await Promise.all(cssFiles.map(name => readFile(path.join('dist/assets', name), 'utf8')))).join('\n')
const browser = await chromium.launch({ channel: 'chromium', headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.__commits = 0
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, inject: () => 1, checkDCE() {}, onCommitFiberUnmount() {},
      onCommitFiberRoot() { window.__commits++ }
    }
  })
  await page.route('http://popup-scroll.test/', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head></head><body><div id="popup-root" data-popup-ready="true"><div class="curator-react-root dark"><main id="popup-app-shell" style="height:600px;padding:14px"></main></div></div></body></html>'
  }))
  await page.goto('http://popup-scroll.test/')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: compiled.outputFiles[0].text })
  await page.waitForFunction(() => typeof window.mountScenario === 'function')
  const settle = (count = 3) => page.evaluate(count => new Promise(resolve => {
    const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick)
    requestAnimationFrame(tick)
  }), count)
  const main = page.locator('.t-skel-content .popup-main-list')
  const tree = page.locator('.t-skel-content .popup-folder-tree')
  await settle()
  await page.evaluate(() => window.mountScenario())
  await page.locator('.t-skel-content .popup-main-row').first().waitFor()
  await settle()

  // Pixel scrolling inside the existing overscan must not rerender either pane.
  await page.evaluate(() => window.resetProbe())
  for (const position of [1, 2, 3]) {
    await tree.evaluate((element, top) => { element.scrollTop = top }, position)
    await settle()
  }
  const pixelScroll = await page.evaluate(() => window.readProbe())
  console.log('Popup pixel-scroll work:', JSON.stringify(pixelScroll))
  assert.equal(pixelScroll.folderReads, 0, 'Pixel scrolling within the mounted folder window must reuse all folder rows.')
  assert.equal(pixelScroll.bookmarkReads, 0, 'Scrolling folders must not revisit unchanged bookmark content.')
  assert.equal(pixelScroll.commits, 0, 'An unchanged virtual window must not commit a React update on each scroll event.')

  await page.evaluate(() => window.resetProbe())
  await tree.evaluate(element => { element.scrollTop = 340 })
  await settle()
  const advancedWindow = await page.evaluate(() => window.readProbe())
  assert.ok(advancedWindow.folderReads <= 4, `Only new folder rows should render: ${JSON.stringify(advancedWindow)}`)
  assert.equal(advancedWindow.bookmarkReads, 0)
  await page.evaluate(() => window.renameFolder(4))
  await page.getByRole('treeitem', { name: /Renamed folder/ }).waitFor()
  await page.getByRole('treeitem', { name: /Renamed folder/ }).click()
  assert.equal((await page.evaluate(() => window.readProbe())).lastAction.folderId, 'f4')

  // Virtual scrolling retains its complete range, including after a data shrink.
  for (const container of [tree, main]) await container.evaluate(element => { element.scrollTop = element.scrollHeight })
  await settle()
  assert.match(await tree.locator('[role="treeitem"]').last().innerText(), /Folder 79/)
  assert.match(await main.locator('.popup-main-row').last().innerText(), /Bookmark 79/)
  await page.evaluate(() => window.shrinkRows())
  await settle()
  assert.match(await tree.locator('[role="treeitem"]').last().innerText(), /Folder 29/)
  assert.match(await main.locator('.popup-main-row').last().innerText(), /Bookmark 29/)

  await page.evaluate(() => window.mountScenario(80, 1))
  await main.evaluate(element => { element.scrollTop = 0 })
  await settle(8)
  await main.evaluate(element => { element.scrollTop = 1600 })
  await settle(8)
  await main.evaluate(element => { element.scrollTop = 0 })
  await settle(8)
  assert.equal(await page.locator('.t-skel-content .popup-active-result-indicator').getAttribute('data-visible'), 'true', 'Scrolling a virtualized selection back into view must restore its indicator.')

  // A small folder does not use virtualization. The moving selection indicator
  // must still follow native scroll without rerendering the two-pane workspace.
  await page.evaluate(() => window.mountScenario(13, 1))
  await main.evaluate(element => { element.scrollTop = 0 })
  await settle(8)
  const indicator = page.locator('.t-skel-content .popup-active-result-indicator')
  const before = await indicator.boundingBox()
  await page.evaluate(() => window.resetProbe())
  await main.evaluate(element => { element.scrollTop = 16 })
  await settle(18)
  const after = await indicator.boundingBox()
  const indicatorScroll = await page.evaluate(() => window.readProbe())
  console.log('Popup indicator-scroll work:', JSON.stringify(indicatorScroll))
  assert.equal(indicatorScroll.commits, 0, 'Moving the selection indicator during scroll must not rerender the content host.')
  assert.ok(before && after && Math.abs(before.y - after.y - 16) <= 1, 'The indicator must track the selected row while scrolling.')

  await main.evaluate(element => { element.scrollTop = 300 })
  await settle()
  assert.equal(await indicator.getAttribute('data-visible'), null, 'An offscreen selection must hide its indicator.')
  await page.evaluate(() => window.selectBookmark(12))
  await settle(24)
  const selection = await main.locator('.popup-list-button[data-active="true"]').boundingBox()
  const viewport = await main.boundingBox()
  assert.ok(selection && viewport && selection.y >= viewport.y && selection.y + selection.height <= viewport.y + viewport.height + 1, 'Keyboard selection must reveal a bookmark outside the previous viewport.')

  await page.evaluate(() => window.selectFolder(60))
  await settle(24)
  assert.equal(await tree.locator('[aria-selected="true"]').count(), 1)
  assert.match(await tree.locator('[aria-selected="true"]').innerText(), /Folder 60/)
  await page.evaluate(() => window.selectBookmark(1))
  await settle(24)
  const row = main.locator('[data-bookmark-id="b1"]')
  await page.evaluate(() => { delete document.getElementById('popup-app-shell').dataset.keyboardNav })
  await row.hover()
  await settle()
  assert.equal(await row.locator('.popup-row-actions-menu button').count(), 5, 'Hovering must still reveal every quick action.')
  await row.getByRole('button', { name: 'copy-url b1', exact: true }).click()
  assert.equal((await page.evaluate(() => window.readProbe())).lastAction.menuAction, 'copy-url')

  // rAF timings only describe the main thread. Require Chromium to scroll both
  // panes on the compositor, so hover/React work cannot hold up native scrolling.
  const session = await page.context().newCDPSession(page)
  let layers = []
  session.on('LayerTree.layerTreeDidChange', event => { layers = event.layers || [] })
  await session.send('DOM.enable')
  await session.send('LayerTree.enable')
  await page.mouse.move(2, 2)
  await page.waitForTimeout(300)
  const { root } = await session.send('DOM.getDocument')
  for (const selector of ['.t-skel-content .popup-main-list', '.t-skel-content .popup-folder-tree']) {
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector })
    const { node } = await session.send('DOM.describeNode', { nodeId })
    const reasons = await Promise.all(layers.filter(layer => layer.backendNodeId === node.backendNodeId).map(layer =>
      session.send('LayerTree.compositingReasons', { layerId: layer.layerId }).catch(() => ({ compositingReasonIds: [] }))
    ))
    assert.ok(reasons.some(reason => reason.compositingReasonIds.includes('OverflowScrolling')), `${selector} must use compositor scrolling instead of repainting on every wheel event.`)
  }
  await session.detach()
  assert.deepEqual(errors, [])
  console.log('Popup scrolling, selection, virtual-window and quick-action regression tests passed.')
} finally {
  await browser.close()
}
