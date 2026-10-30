import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const output = path.resolve('output/playwright/interface-refinements')
const tempRoot = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir()
await mkdir(tempRoot, { recursive: true })
const profile = await mkdtemp(path.join(tempRoot, 'curator-refinements-'))
// Use the smoke suite's bundled Chromium unless the caller selects a browser.
const executablePath = process.env.CURATOR_BROWSER_EXECUTABLE_PATH
const reports = {}
const errors = []
const previewTitle = 'React · useTransition 与并发更新'
const darkIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M8 5h6v16h10v6H8z" fill="#111113"/></svg>'
const iconServers = []
let context

async function serveIcon(body) {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' })
    response.end(body)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  iconServers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}

async function settle(page) {
  await page.evaluate(() => Promise.allSettled(
    document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished)
  ))
}

async function capture(page, name) {
  await settle(page)
  await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' })
}

function readDrawerLayout() {
  const panel = document.querySelector('.settings-drawer-panel')
  const tabs = document.querySelector('[aria-label="新标签页设置分组"]')
  const scroll = document.querySelector('.settings-drawer-scroll')
  const preset = document.querySelector('#icon-preset-row')
  const background = document.querySelector('#background-type-control')?.closest('.base-select')?.parentElement
  return {
    panelWidth: panel.getBoundingClientRect().width,
    tabsTop: tabs.getBoundingClientRect().top,
    tabsBottom: tabs.getBoundingClientRect().bottom,
    contentTop: scroll.getBoundingClientRect().top,
    scrollTop: scroll.scrollTop,
    overflow: scroll.scrollWidth - scroll.clientWidth,
    presets: preset ? getComputedStyle(preset).gridTemplateColumns.split(' ').length : 0,
    backgroundColumns: background ? getComputedStyle(background).gridTemplateColumns : ''
  }
}

function readPreviewComparison() {
  const preview = document.querySelector('#icon-live-preview .bookmark-tile-preview')
  const live = [...document.querySelectorAll('.bookmark-tile[data-bookmark-id]')].find(tile =>
    tile.querySelector('.bookmark-title')?.textContent === preview?.querySelector('.bookmark-title')?.textContent
  )
  const measure = tile => {
    if (!tile) return null
    const title = tile.querySelector('.bookmark-title')
    return {
      width: tile.getBoundingClientRect().width,
      titleWidth: title?.getBoundingClientRect().width,
      titleHeight: title?.getBoundingClientRect().height,
      titleLines: title && getComputedStyle(title).webkitLineClamp,
      shellWidth: tile.querySelector('.bookmark-icon-shell').getBoundingClientRect().width
    }
  }
  return { preview: measure(preview), live: measure(live) }
}

async function assertPreviewMatches(page, label) {
  await page.waitForFunction(() => {
    const preview = document.querySelector('#icon-live-preview .bookmark-tile-preview')
    const live = document.querySelector('.bookmark-tile[data-bookmark-id]')
    return preview && live && Math.abs(preview.getBoundingClientRect().width - live.getBoundingClientRect().width) < 0.5
  })
  const comparison = await page.evaluate(readPreviewComparison)
  for (const key of ['width', 'titleWidth', 'titleHeight', 'shellWidth']) {
    assert.ok(Math.abs(comparison.preview[key] - comparison.live[key]) <= 0.5,
      `${label}: preview and live ${key} differ: ${JSON.stringify(comparison)}`)
  }
  assert.equal(comparison.preview.titleLines, comparison.live.titleLines)
  return comparison
}

function readSearchPresentation() {
  return [...document.querySelectorAll('#popup-search-results [role="row"]')].map(row => ({
    text: row.querySelector('.popup-row-copy').innerText,
    height: row.getBoundingClientRect().height,
    lines: row.querySelector('.popup-row-copy').children.length,
    highlights: [...row.querySelectorAll('mark')].map(mark => mark.textContent),
    reasons: row.querySelector('[aria-label^="命中原因"]')?.textContent || ''
  }))
}

try {
  await mkdir(output, { recursive: true })
  const darkOrigin = await serveIcon(darkIcon)
  const lightOrigin = await serveIcon(darkIcon.replace('#111113', '#f5f5f7'))
  context = await chromium.launchPersistentContext(profile, {
    ...(executablePath ? { executablePath } : { channel: process.env.CURATOR_BROWSER_CHANNEL || 'chromium' }),
    headless: true,
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'no-preference',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  await context.route('https://refinements.example/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Interface test</title><p>Local test data</p>'
  }))
  const isWorker = worker => worker.url().endsWith('/service-worker-loader.js')
  const worker = context.serviceWorkers().find(isWorker) ||
    await context.waitForEvent('serviceworker', { predicate: isWorker, timeout: 15000 })
  const extensionId = new URL(worker.url()).host
  const seed = await worker.evaluate(async ({ previewTitle, darkOrigin, lightOrigin }) => {
    const bar = (await chrome.bookmarks.getTree())[0].children.find(node => node.id === '1')
    const folder = await chrome.bookmarks.create({ parentId: bar.id, title: '开发与设计' })
    const bookmarks = []
    for (let index = 0; index < 90; index++) {
      bookmarks.push(await chrome.bookmarks.create({
        parentId: folder.id,
        title: index === 0 ? 'React 并发渲染与设计系统参考' : `资料 ${String(index).padStart(2, '0')} · 交互实现与可访问性`,
        url: `https://refinements.example/document/${index}`
      }))
    }
    const duplicate = await chrome.bookmarks.create({
      parentId: folder.id,
      title: 'React 并发渲染与设计系统参考（完整学习笔记）',
      url: bookmarks[0].url
    })
    const nested = await chrome.bookmarks.create({ parentId: folder.id, title: '长标题资料' })
    await chrome.bookmarks.create({
      parentId: nested.id,
      title: 'A practical guide to designing accessible interfaces with long document titles',
      url: 'https://refinements.example/accessibility'
    })
    const docs = await chrome.bookmarks.create({ parentId: bar.id, title: '文档' })
    const docItems = []
    for (const [index, title] of [previewTitle, 'React · useDeferredValue 与搜索性能', 'MDN Web Docs — CSS container queries', '设计系统：颜色、对比度与可访问性'].entries()) {
      docItems.push(await chrome.bookmarks.create({ parentId: docs.id, title, url: `${index === 1 ? lightOrigin : darkOrigin}/document/${index}` }))
    }
    const market = await chrome.bookmarks.create({ parentId: bar.id, title: '市场' })
    const cardFolder = await chrome.bookmarks.create({ parentId: market.id, title: '卡网' })
    const cardItems = []
    for (const [index, title] of ['卡网订阅比价 | PriceAI', '购物 - FT发卡网', '鹰鹰小铺', '小易的小店'].entries()) {
      cardItems.push(await chrome.bookmarks.create({ parentId: cardFolder.id, title, url: `https://shop-${index}.example/deep/path` }))
    }
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false },
      curatorBookmarkInboxSettings: { enabled: false, autoAnalyzeEnabled: false },
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [docs.id], hideFolderNames: false },
      curatorBookmarkNewTabActiveFavicons: {
        version: 1,
        entries: Object.fromEntries([darkOrigin, lightOrigin].map(origin => [origin, { src: `${origin}/favicon.ico`, at: Date.now() }]))
      },
      curatorBookmarkNewTabIconSettings: {
        pageWidth: 78, columnGap: 10, rowGap: 10, folderGap: 20,
        tileWidth: 210, iconShellSize: 34, layoutMode: 'auto', columns: 4,
        showTitles: true, titleLines: 2, verticalCenter: false
      }
    })
    return { folderId: folder.id, firstId: bookmarks[0].id, duplicateId: duplicate.id, lastId: bookmarks.at(-1).id, docItems, cardItems, cardFolderId: cardFolder.id }
  }, { previewTitle, darkOrigin, lightOrigin })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))

  await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`)
  await page.waitForFunction(ids => ids.every(id => {
    const image = document.querySelector(`.bookmark-tile[data-bookmark-id="${id}"] img`)
    return image?.complete && image.naturalWidth === 32 && image.src.startsWith('http://127.0.0.1:')
  }), seed.docItems.slice(0, 2).map(item => item.id))
  await settle(page)
  reports.remoteIcons = await page.locator('.bookmark-tile[data-bookmark-id] .bookmark-icon-shell').evaluateAll(shells => shells.slice(0, 2).map(shell => {
    const image = shell.querySelector('img')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 20
    let readable = true
    try {
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, 20, 20)
      context.getImageData(0, 0, 20, 20)
    } catch { readable = false }
    return { readable, contrast: shell.dataset.iconContrast, background: getComputedStyle(shell).backgroundColor, filter: getComputedStyle(image).filter }
  }))
  assert.ok(reports.remoteIcons.every(icon => !icon.readable && icon.contrast === 'neutral-backdrop' && icon.background === 'rgb(128, 128, 131)' && icon.filter === 'none'), 'unreadable dark and light icons retain their pixels on a contrast-safe neutral plate')
  await capture(page, 'remote-icons')
  await page.waitForFunction(() => localStorage.getItem('curatorNewTabBookmarkPreboot'))
  await page.addInitScript(() => {
    window.__prebootContrast = []
    const observer = new MutationObserver(() => {
      for (const shell of document.querySelectorAll('.newtab-bookmark-preboot-icon-shell[data-icon-contrast]')) {
        window.__prebootContrast.push(shell.dataset.iconContrast)
      }
    })
    observer.observe(document, { childList: true, attributes: true, subtree: true, attributeFilter: ['data-icon-contrast'] })
    setTimeout(() => observer.disconnect(), 4000)
  })
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.bookmark-tile[data-bookmark-id] .bookmark-icon-shell')?.dataset.iconContrast === 'neutral-backdrop')
  assert.ok((await page.evaluate(() => window.__prebootContrast)).includes('neutral-backdrop'), 'preboot and React use the same unknown-source plate')
  const onboarding = page.getByRole('button', { name: '我知道了', exact: true })
  if (await onboarding.isVisible()) await onboarding.click()
  await page.locator('#newtab-settings-trigger').click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  await settle(page)
  const desktop = await page.evaluate(readDrawerLayout)
  assert.equal(desktop.presets, 3)
  assert.ok(desktop.tabsBottom <= desktop.contentTop, 'settings tabs occupy a separate fixed row')
  await page.locator('.settings-drawer-scroll').evaluate(element => { element.scrollTop = element.scrollHeight })
  const scrolled = await page.evaluate(readDrawerLayout)
  assert.ok(scrolled.scrollTop > 400)
  assert.equal(scrolled.tabsTop, desktop.tabsTop, 'scrolling long settings must not move the tabs')
  await page.getByRole('tab', { name: '来源', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.settings-drawer-scroll').scrollTop === 0)
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  await page.setViewportSize({ width: 660, height: 850 })
  await settle(page)
  const middle = await page.evaluate(readDrawerLayout)
  assert.equal(middle.panelWidth, desktop.panelWidth, 'both desktop windows have the same drawer width')
  assert.equal(middle.presets, desktop.presets, 'same container width must keep the same preset arrangement')
  assert.equal(middle.backgroundColumns, desktop.backgroundColumns, 'form rows also depend on the drawer width')
  assert.ok(middle.overflow <= 1, 'wide previews scroll internally, not the whole drawer')
  await capture(page, 'settings-660')

  await page.setViewportSize({ width: 390, height: 850 })
  await page.getByRole('tab', { name: '来源', exact: true }).click()
  await settle(page)
  const narrow = await page.evaluate(readDrawerLayout)
  assert.equal(Math.round(narrow.panelWidth), 390)
  assert.ok(narrow.overflow <= 1)
  const switchLayout = await page.locator('.settings-switch-row').first().evaluate(element => {
    const title = element.firstElementChild.getBoundingClientRect()
    const control = element.lastElementChild.getBoundingClientRect()
    return { titleRight: title.right, controlLeft: control.left, rowHeight: element.getBoundingClientRect().height }
  })
  assert.ok(switchLayout.controlLeft >= switchLayout.titleRight, 'a narrow switch row still places its switch beside the label')
  assert.equal(await page.locator('#newtab-root').evaluate(element => element.inert), true)
  await capture(page, 'settings-390')
  await page.locator('#newtab-settings-close').click()
  await page.locator('.settings-drawer-panel').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('#newtab-root').evaluate(element => element.inert), false)

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.locator('#newtab-settings-trigger').click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  await page.locator('#icon-advanced-toggle').click()
  const preview = page.locator('#icon-live-preview')
  await preview.scrollIntoViewIfNeeded()
  await preview.locator('.bookmark-tile-preview').first().waitFor()
  await page.waitForFunction(() => {
    const shell = document.querySelector('#icon-live-preview .bookmark-icon-shell')
    return shell?.dataset.iconContrast === 'light-backdrop'
  })
  const contrast = await preview.locator('.bookmark-icon-shell').evaluateAll(elements =>
    elements.slice(0, 2).map(element => ({
      contrast: element.dataset.iconContrast,
      background: getComputedStyle(element).backgroundColor,
      filter: getComputedStyle(element.querySelector('img')).filter
    }))
  )
  assert.equal(contrast[0].contrast, 'light-backdrop')
  assert.equal(contrast[1].contrast, 'original')
  assert.ok(contrast.every(item => item.filter === 'none'), 'original favicon pixels are never inverted')
  const previewBefore = await preview.locator('.bookmark-tile-preview').first().evaluate(element => ({
    width: element.getBoundingClientRect().width,
    shellWidth: element.querySelector('.bookmark-icon-shell').getBoundingClientRect().width,
    titleLines: getComputedStyle(element.querySelector('.bookmark-title')).webkitLineClamp
  }))
  assert.equal(Math.round(previewBefore.shellWidth), 34)
  assert.equal(previewBefore.titleLines, '2', 'existing custom settings survive the new preview')
  reports.previewWidths = []
  for (const width of [1440, 768, 660, 390, 360]) {
    await page.setViewportSize({ width, height: 960 })
    await preview.scrollIntoViewIfNeeded()
    reports.previewWidths.push({ width, ...await assertPreviewMatches(page, `auto-${width}`) })
    assert.ok((await page.evaluate(readDrawerLayout)).overflow <= 1, 'preview must not stretch the drawer')
    await capture(page, `preview-auto-${width}`)
  }
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: '固定列数', exact: true }).click()
  for (const width of [1440, 660, 390]) {
    await page.setViewportSize({ width, height: 960 })
    reports.previewWidths.push({ width, mode: 'fixed', ...await assertPreviewMatches(page, `fixed-${width}`) })
  }
  await page.getByRole('button', { name: '自动适配', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 960 })
  await assertPreviewMatches(page, 'auto-restored')
  await capture(page, 'settings-preview')
  await page.getByRole('button', { name: '1 行', exact: true }).click()
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#icon-live-preview .bookmark-title')).webkitLineClamp === '1')
  await page.getByRole('button', { name: '2 行', exact: true }).click()
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#icon-live-preview .bookmark-title')).webkitLineClamp === '2')
  await page.locator('[data-preset="spacious"]').click()
  await assertPreviewMatches(page, 'spacious-preset')
  assert.equal(await page.locator('[data-icon-title-lines="2"]').getAttribute('aria-pressed'), 'true', 'Changing density preserves the title preference.')
  await page.locator('[data-preset="comfortable"]').click()
  await assertPreviewMatches(page, 'comfortable-preset')
  await page.getByRole('switch', { name: '显示标题', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('#icon-live-preview .bookmark-title'))
  const iconOnlyWidths = await page.evaluate(() => ({
    live: document.querySelector('.bookmark-tile[data-bookmark-id]').getBoundingClientRect().width,
    preview: document.querySelector('#icon-live-preview .bookmark-tile-preview').getBoundingClientRect().width
  }))
  assert.ok(Math.abs(iconOnlyWidths.live - iconOnlyWidths.preview) < 0.5, 'icon-only preview follows the actual grid')
  await page.getByRole('switch', { name: '显示标题', exact: true }).click()
  await assertPreviewMatches(page, 'restored-titles')
  await page.locator('.settings-drawer-scroll').evaluate(element => { element.scrollTop = element.scrollHeight })
  await capture(page, 'settings-time')
  await page.getByRole('tab', { name: '搜索', exact: true }).click()
  await capture(page, 'settings-search')
  reports.drawer = { desktop, scrolled, middle, narrow, switchLayout }
  reports.preview = { ...previewBefore, contrast }

  await page.keyboard.press('Escape')
  await page.locator('.settings-drawer-panel').waitFor({ state: 'hidden' })
  reports.bookmarkMenuContours = []
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.locator('.bookmark-tile[data-bookmark-id]').first().click({ button: 'right' })
    const menu = page.locator('.bookmark-edit-menu')
    await menu.waitFor({ state: 'visible' })
    const input = menu.locator('.base-input').first()
    await input.focus()
    await settle(page)
    const contours = await menu.locator('.base-input:visible, .base-select-trigger:visible').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element)
        return {
          border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
          clipPath: style.clipPath,
          boxShadow: style.boxShadow,
          filter: style.filter
        }
      })
    )
    assert.equal(contours.length, 3, 'title, URL and icon controls are visible; the file picker remains hidden')
    for (const contour of contours) {
      assert.deepEqual(contour.border, ['1px', '1px', '1px', '1px'])
      assert.equal(contour.clipPath, 'none', 'native control borders are not clipped')
      assert.equal(contour.boxShadow, 'none', 'input contours are not doubled by an inset highlight')
      assert.equal(contour.filter, 'none', 'inputs do not add a second drop shadow')
    }
    assert.equal(await input.evaluate(element => {
      const style = getComputedStyle(element)
      return element === document.activeElement && parseFloat(style.outlineWidth) >= 1
    }), true, 'the unclipped input keeps a visible keyboard focus indicator')
    reports.bookmarkMenuContours.push({ width, contours })
    await capture(page, 'newtab-edit-contours-' + width)
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
  }

  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`)
  const main = page.locator('.t-skel-content .popup-main-list')
  await main.locator('.popup-main-row').first().waitFor()
  const heights = await main.locator('.popup-main-row').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  assert.ok(heights.length < 90, 'large folders stay virtualized')
  assert.ok(heights.every(height => Math.abs(height - 60) <= 1))
  await main.evaluate(element => { element.scrollTop = element.scrollHeight })
  await main.getByText('小易的小店', { exact: true }).waitFor()
  await page.locator(`.t-skel-content [data-folder-row-id="${seed.folderId}"] button`).click()
  await main.evaluate(element => { element.scrollTop = 0 })
  await main.locator(`.popup-main-row[data-bookmark-id="${seed.firstId}"]`).waitFor()
  const firstRow = main.locator(`.popup-main-row[data-bookmark-id="${seed.firstId}"]`)
  assert.ok(!(await firstRow.innerText()).includes('开发与设计'), 'direct children should not repeat the selected folder')
  assert.match(await firstRow.locator('.popup-row-copy > span').last().getAttribute('title'), /开发与设计/)
  const search = page.locator('#search-input')
  await search.fill('React')
  await page.waitForFunction(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 2)
  const result = page.locator('#popup-search-results [role="row"]').first()
  assert.ok(!(await result.innerText()).includes('标题命中'))
  assert.match(await result.getAttribute('aria-description'), /命中：标题/)
  assert.ok(await result.locator('mark').count() > 0)
  assert.ok(!(await result.innerText()).includes('开发与设计'), 'search preserves the selected folder context')
  assert.ok(Math.abs((await result.boundingBox()).height - 60) <= 1)
  await capture(page, 'popup-search')
  await search.fill('')
  await firstRow.waitFor()
  await capture(page, 'popup-compact')
  await firstRow.hover()
  await firstRow.locator('button[title="编辑"]').click()
  await page.getByRole('heading', { name: '编辑书签', exact: true }).waitFor()
  assert.equal(await page.locator('#save-edit').innerText(), '保存')
  assert.equal(await page.locator('#save-edit').isDisabled(), true)
  assert.ok(!(await page.locator('#edit-modal').innerText()).includes('修改标题与网址'))
  await capture(page, 'popup-edit')
  await page.locator('#cancel-edit').click()
  await page.getByRole('button', { name: '调整顺序', exact: true }).click()
  const handle = main.locator('.popup-bookmark-reorder-handle').first()
  await handle.focus()
  await handle.press('Alt+ArrowDown')
  await page.waitForFunction(async ({ folderId, firstId }) => (await chrome.bookmarks.getChildren(folderId))[1].id === firstId, seed)
  await page.getByRole('button', { name: '完成排序', exact: true }).click()
  reports.popup = { rowHeight: heights[0], renderedRows: heights.length, keyboardReorder: true }

  await page.locator('.t-skel-content [data-folder-row-id="1"] button').click()
  reports.popup.reviewQueries = []
  for (const query of ['kaw', '卡网']) {
    await search.fill(query)
    await page.waitForFunction(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 4)
    const rows = await page.evaluate(readSearchPresentation)
    for (const row of rows) {
      assert.equal(row.lines, 2, `${query}: no duplicate third line`)
      assert.ok(Math.abs(row.height - 60) <= 1)
      assert.ok(row.highlights.includes('卡网'))
      assert.equal(row.reasons, '')
    }
    reports.popup.reviewQueries.push({ query, rows })
    await capture(page, query === 'kaw' ? 'popup-kaw' : 'popup-folder-highlight')
  }
  for (const [query, explanation] of [['市场', '上级目录命中'], ['deep', '网址命中']]) {
    await search.fill(query)
    await page.waitForFunction(text => document.querySelector('#popup-search-results [aria-label^="命中原因"]')?.textContent === text, explanation)
    const rows = await page.evaluate(readSearchPresentation)
    assert.ok(rows.every(row => Math.abs(row.height - 68) <= 1 && row.reasons === explanation), 'hidden fields retain a concise explanation within 68px')
    reports.popup.reviewQueries.push({ query, rows })
  }
  await search.fill('')
  await page.locator(`.t-skel-content [data-folder-row-id="${seed.cardFolderId}"] button`).click()
  await search.fill('PriceAI')
  await page.waitForFunction(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 1)
  const scoped = await page.evaluate(readSearchPresentation)
  assert.ok(!scoped[0].text.includes(' · 卡网'), 'current leaf folder is hidden during search')
  assert.ok(scoped[0].text.includes('shop-0.example'))
  await capture(page, 'popup-scoped-search')

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#general`)
  await page.getByRole('switch', { name: '自动分析', exact: true }).waitFor()
  assert.ok(!(await page.locator('#general').innerText()).includes('未开启'))
  assert.ok(!(await page.locator('#general').innerText()).includes('本地内容记忆'))
  assert.ok((await page.locator('#general').innerText()).includes('第三方服务会收到目标网址'))
  await capture(page, 'options-general')
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#duplicates`)
  const group = page.locator('.duplicate-group').first()
  await group.waitFor()
  assert.equal(await group.locator('.duplicate-item').first().getAttribute('data-recommended'), 'true')
  assert.equal(await group.getByText('推荐保留', { exact: true }).count(), 1)
  assert.ok(!(await group.innerText()).includes('高风险'))
  assert.ok((await group.innerText()).includes('标题不同'))
  assert.ok(!(await group.innerText()).includes('同一 URL 存在不同标题'), 'recommendation must not repeat the group review note')
  await capture(page, 'duplicates-desktop')
  await page.setViewportSize({ width: 390, height: 850 })
  await capture(page, 'duplicates-390')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.setViewportSize({ width: 1440, height: 960 })
  for (const rule of ['保留最新', '保留最早', '保留路径最短', '保留有标签', '保留新标签页来源', '保留最近访问', '按推荐保留']) {
    await page.getByRole('combobox', { name: /保留规则/ }).click()
    await page.getByRole('option', { name: rule, exact: true }).click()
    await page.getByRole('button', { name: /^(按推荐|按保留规则)选择重复书签当前结果$/ }).click()
    assert.equal(await group.getByRole('checkbox', { checked: true }).count(), 1)
  }
  for (const checkbox of await group.getByRole('checkbox').all()) await checkbox.check()
  const deleteButton = page.getByRole('button', { name: '移入回收站', exact: true })
  assert.equal(await deleteButton.isDisabled(), true, 'selecting every duplicate must still block deletion')
  await group.getByRole('button', { name: /^按推荐选择/ }).click()
  assert.equal(await deleteButton.isDisabled(), false)
  reports.duplicates = { strategies: 7, recommendedFirst: true, allSelectedGuard: true }
  const selectionBeforeHydration = await group.getByRole('checkbox', { checked: true }).count()
  await worker.evaluate(async bookmarkId => {
    const bookmark = (await chrome.bookmarks.get(bookmarkId))[0]
    const now = Date.now()
    await chrome.storage.local.set({ curatorBookmarkTagIndex: {
      version: 1, updatedAt: now,
      records: { [bookmark.id]: { schemaVersion: 1, bookmarkId: bookmark.id, url: bookmark.url, title: bookmark.title,
        tags: [], manualTags: ['参考'], source: 'manual', generatedAt: now, updatedAt: now } }
    } })
  }, seed.firstId)
  await group.getByText('带有手动标签，保留人工整理信息。', { exact: true }).waitFor()
  assert.equal(await group.getByRole('checkbox', { checked: true }).count(), selectionBeforeHydration, 'reranking must preserve the user selection')
  assert.equal(await group.locator('.duplicate-item').first().getAttribute('data-bookmark-id'), seed.firstId, 'late tags update the recommendation without a bookmark mutation')
  assert.equal(await group.getByText('有手动标签', { exact: true }).count(), 0, 'the recommendation already explains this fact')
  await capture(page, 'duplicates-tagged')
  await page.reload()
  await group.getByText('带有手动标签，保留人工整理信息。', { exact: true }).waitFor()
  assert.equal(await group.locator('.duplicate-item').first().getAttribute('data-bookmark-id'), seed.firstId)
  await capture(page, 'duplicates-tagged-reloaded')
  reports.duplicates.lateRepositoryRecommendation = true
  const sourceId = await worker.evaluate(async folderId => {
    const source = await chrome.bookmarks.create({ parentId: folderId, title: '标签页' })
    await chrome.bookmarks.create({ parentId: folderId, title: '书签来源样例', url: 'https://source-copy.example/guide' })
    return (await chrome.bookmarks.create({ parentId: source.id, title: '书签来源样例', url: 'https://source-copy.example/guide' })).id
  }, seed.folderId)
  const sourceGroup = page.locator('.duplicate-group').filter({ hasText: 'source-copy.example/guide' })
  await sourceGroup.getByText('用于新标签页，保留可维持现有入口。', { exact: true }).waitFor()
  assert.equal(await sourceGroup.getByText('新标签页来源', { exact: true }).count(), 0)
  await sourceGroup.locator(`[data-bookmark-id="${sourceId}"]`).getByRole('checkbox').check()
  await sourceGroup.getByText('此副本用于新标签页，清理后该入口也会移除。', { exact: true }).waitFor()
  assert.equal(await sourceGroup.getByText('用于新标签页，保留可维持现有入口。', { exact: true }).count(), 0,
    'the deletion consequence replaces the repeated source recommendation')
  reports.duplicates.sourceWarning = true
  assert.deepEqual(errors, [], 'all reviewed surfaces must run without page errors')
  await writeFile(path.join(output, 'report.json'), JSON.stringify(reports, null, 2))
  console.log(JSON.stringify(reports, null, 2))
} catch (error) {
  if (context) {
    const page = context.pages().at(-1)
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  }
  throw error
} finally {
  await context?.close()
  await Promise.all(iconServers.map(server => new Promise(resolve => server.close(resolve))))
  const resolvedProfile = await realpath(profile)
  const resolvedTemp = await realpath(tempRoot)
  if (path.dirname(resolvedProfile) !== resolvedTemp || !path.basename(resolvedProfile).startsWith('curator-refinements-')) {
    throw new Error('Unexpected test profile path; refusing recursive cleanup')
  }
  await rm(resolvedProfile, { recursive: true, force: true })
}
