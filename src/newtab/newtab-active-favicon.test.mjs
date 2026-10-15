import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

// 主动图标回归：浏览器图标库没有记录的书签（此处用本地站点模拟）必须直接从
// 站点读取 favicon.ico / apple-touch-icon.png，并缓存结果供下次打开复用。
const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-active-favicon-'))
let context
const servers = []

const GREEN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#18a058"/></svg>'
const BLUE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#2f6fed"/></svg>'

function startServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler)
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

try {
  const primaryServer = await startServer((request, response) => {
    if (request.url === '/favicon.ico') {
      response.writeHead(200, { 'Content-Type': 'image/svg+xml' })
      response.end(GREEN_ICON)
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<html><head><title>Primary</title></head><body>primary</body></html>')
  })
  const fallbackServer = await startServer((request, response) => {
    if (request.url === '/apple-touch-icon.png') {
      response.writeHead(200, { 'Content-Type': 'image/svg+xml' })
      response.end(BLUE_ICON)
      return
    }
    response.writeHead(404, { 'Content-Type': 'text/plain' })
    response.end('not found')
  })
  const missingServer = await startServer((_request, response) => {
    response.writeHead(404, { 'Content-Type': 'text/plain' })
    response.end('not found')
  })
  servers.push(primaryServer, fallbackServer, missingServer)

  const primaryOrigin = `http://127.0.0.1:${primaryServer.address().port}`
  const fallbackOrigin = `http://127.0.0.1:${fallbackServer.address().port}`
  const missingOrigin = `http://127.0.0.1:${missingServer.address().port}`
  const primarySource = `${primaryOrigin}/favicon.ico`
  const fallbackSource = `${fallbackOrigin}/apple-touch-icon.png`

  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host

  const seed = await worker.evaluate(async ({ primaryOrigin, fallbackOrigin, missingOrigin }) => {
    const tree = await chrome.bookmarks.getTree()
    const root = tree[0]
    const bookmarksBar = root.children?.find((node) => node.id === '1') || root.children?.[0]
    if (!bookmarksBar?.id) {
      throw new Error('Bookmarks bar is unavailable')
    }
    const folder = await chrome.bookmarks.create({ parentId: bookmarksBar.id, title: '主动图标回归' })
    const primary = await chrome.bookmarks.create({ parentId: folder.id, title: '站点图标主路径', url: `${primaryOrigin}/` })
    const fallback = await chrome.bookmarks.create({ parentId: folder.id, title: '站点图标备用路径', url: `${fallbackOrigin}/` })
    const missing = await chrome.bookmarks.create({ parentId: folder.id, title: '站点没有图标', url: `${missingOrigin}/` })
    await chrome.storage.local.set({
      curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013', maskEnabled: false },
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: [folder.id], browseMode: 'expanded' },
      curatorBookmarkOnboardingState: { completed: true },
      curatorBookmarkNewTabSearchSettings: { enabled: false }
    })
    return { folder, primary, fallback, missing }
  }, { primaryOrigin, fallbackOrigin, missingOrigin })

  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, { waitUntil: 'domcontentloaded' })
  await page.locator(`.bookmark-tile[data-bookmark-id="${seed.primary.id}"]`).waitFor({ state: 'visible', timeout: 20_000 })

  const readFaviconState = (bookmarkId) => page.evaluate((id) => {
    const image = document.querySelector(`.bookmark-tile[data-bookmark-id="${id}"] img.bookmark-favicon`)
    return image
      ? { ready: image.dataset.faviconReady || '', src: image.getAttribute('src') || '', naturalWidth: image.naturalWidth }
      : null
  }, bookmarkId)

  // 主路径：站点自身提供 /favicon.ico。
  await page.waitForFunction(({ id, expected }) => {
    const image = document.querySelector(`.bookmark-tile[data-bookmark-id="${id}"] img.bookmark-favicon`)
    return image?.getAttribute('src') === expected && image.naturalWidth > 0
  }, { id: seed.primary.id, expected: primarySource }, { timeout: 20_000 })
  const primaryState = await readFaviconState(seed.primary.id)
  assert.equal(primaryState.ready, 'true', `The actively fetched favicon should paint: ${JSON.stringify(primaryState)}`)
  assert.equal(primaryState.naturalWidth, 32, `The actively fetched favicon should decode: ${JSON.stringify(primaryState)}`)

  // 备用路径：没有 /favicon.ico 时回退到 apple-touch-icon.png。
  await page.waitForFunction(({ id, expected }) => {
    const image = document.querySelector(`.bookmark-tile[data-bookmark-id="${id}"] img.bookmark-favicon`)
    return image?.getAttribute('src') === expected && image.naturalWidth > 0
  }, { id: seed.fallback.id, expected: fallbackSource }, { timeout: 20_000 })

  // 无图标站点：探测失败后保留浏览器来源，并记录否定结果避免反复请求。
  await worker.evaluate(async ({ primaryOrigin, fallbackOrigin, missingOrigin }) => {
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      const stored = (await chrome.storage.local.get('curatorBookmarkNewTabActiveFavicons')).curatorBookmarkNewTabActiveFavicons
      const entries = stored?.entries || {}
      if (
        entries[primaryOrigin]?.src &&
        entries[fallbackOrigin]?.src &&
        entries[missingOrigin]?.src === '' &&
        Object.prototype.hasOwnProperty.call(entries[missingOrigin], 'src')
      ) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    throw new Error('active favicon results were never persisted')
  }, { primaryOrigin, fallbackOrigin, missingOrigin })

  const stored = await worker.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkNewTabActiveFavicons')).curatorBookmarkNewTabActiveFavicons)
  assert.equal(stored.entries[primaryOrigin].src, primarySource)
  assert.equal(stored.entries[fallbackOrigin].src, fallbackSource)
  assert.equal(stored.entries[missingOrigin].src, '')

  const missingState = await readFaviconState(seed.missing.id)
  assert.ok(
    missingState?.src.startsWith('chrome-extension://'),
    `The tile without any site icon must keep the browser source: ${JSON.stringify(missingState)}`
  )

  // 再次打开新标签页：已解析的站点图标直接作为首选来源，无需重新探测。
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator(`.bookmark-tile[data-bookmark-id="${seed.primary.id}"]`).waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(({ id, expected }) => {
    const image = document.querySelector(`.bookmark-tile[data-bookmark-id="${id}"] img.bookmark-favicon`)
    return image?.getAttribute('src') === expected && image.naturalWidth > 0
  }, { id: seed.primary.id, expected: primarySource }, { timeout: 20_000 })

  assert.deepEqual(errors, [])
  console.log('Newtab active favicon test passed: site icons are fetched from the website and cached per origin.')
} finally {
  await context?.close()
  for (const server of servers) {
    await new Promise((resolve) => server.close(resolve))
  }
  if (path.dirname(profilePath) === path.resolve(tmpdir()) && path.basename(profilePath).startsWith('curator-active-favicon-')) {
    await rm(profilePath, { recursive: true, force: true })
  }
}
