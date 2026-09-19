import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const outputDir = path.resolve('output/playwright/workspace-features')
const temporary = await mkdtemp(path.join(tmpdir(), 'curator-workspace-features-'))
const extensionPath = path.join(temporary, 'extension')
await mkdir(outputDir, { recursive: true })
await cp(path.resolve('dist'), extensionPath, { recursive: true })
const manifestPath = path.join(extensionPath, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
assert.ok(manifest.optional_permissions.includes('pageCapture'))
assert.ok(!manifest.permissions.includes('pageCapture'))
assert.equal(manifest.side_panel.default_path, 'src/sidepanel/sidepanel.html')
// Native permission prompts have no headless UI. Pregrant capture and only our
// fixture host in this disposable copy; the built product keeps capture optional.
manifest.permissions.push('pageCapture')
manifest.optional_permissions = manifest.optional_permissions.filter(permission => permission !== 'pageCapture')
manifest.host_permissions.push('http://workspace-features.example.net/*')
await writeFile(manifestPath, JSON.stringify(manifest))

const server = createServer((request, response) => {
  if (request.url === '/style.css') {
    response.writeHead(200, { 'content-type': 'text/css' })
    response.end('body{font-family:sans-serif;background:#eef4fa;padding:32px}h1{color:rgb(23,81,143)}img{width:120px;height:64px}')
  } else if (request.url === '/image.svg') {
    response.writeHead(200, { 'content-type': 'image/svg+xml' })
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="64"><rect width="120" height="64" fill="#17518f"/><circle cx="60" cy="32" r="20" fill="#ffd166"/></svg>')
  } else {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    const title = request.url === '/source-beta' ? '来源网页 Beta' : '来源网页 Alpha'
    response.end(`<!doctype html><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="/style.css"><h1>Curator offline fixture</h1><img src="/image.svg" alt="离线图片"><p>已加载的正文内容。</p><script>const p=document.createElement('p');p.id='dynamic';p.textContent='动态加载后保存的内容';document.body.append(p)</script>`)
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://workspace-features.example.net:${server.address().port}`
let context, optionsPage, native
const pageErrors = []
const results = {}

async function poll(check, label, timeout = 12000) {
  const until = Date.now() + timeout
  do {
    const value = await check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 40))
  } while (Date.now() < until)
  throw new Error(`Timed out: ${label}`)
}

// Chrome exposes a real SIDE_PANEL target outside Playwright's normal page list.
// Attach via CDP and send actual input to that target, without mocking tab queries.
class NativePanel {
  constructor(root, sessionId) {
    this.root = root
    this.sessionId = sessionId
    this.nextId = 0
    this.pending = new Map()
    root.on('Target.receivedMessageFromTarget', event => {
      if (event.sessionId !== sessionId) return
      const message = JSON.parse(event.message)
      if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
    })
  }
  call(method, params = {}) {
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 12000)
      this.pending.set(id, { resolve, reject, timer })
      void this.root.send('Target.sendMessageToTarget', { sessionId: this.sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => {
        clearTimeout(timer); this.pending.delete(id); reject(error)
      })
    })
  }
  async evaluate(fn, arg = null) {
    const result = await this.call('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  wait(fn, arg = null) { return poll(() => this.evaluate(fn, arg), fn.toString().slice(0, 120)) }
  async click(selector) {
    const point = await this.wait(selector => {
      const element = document.querySelector(selector)
      if (!element || element.disabled || !element.checkVisibility()) return null
      element.scrollIntoView({ block: 'nearest' })
      const rect = element.getBoundingClientRect()
      const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      const hit = document.elementFromPoint(point.x, point.y)
      return hit === element || element.contains(hit) ? point : null
    }, selector)
    await this.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await this.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  }
  async key(key, modifiers = 0, code = key) {
    const windowsVirtualKeyCode = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, F2: 113, a: 65, k: 75, '/': 191 }[key]
    await this.call('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers, windowsVirtualKeyCode })
    await this.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode })
  }
  async fill(selector, text) {
    await this.click(selector)
    await this.key('a', 2, 'KeyA')
    await this.call('Input.insertText', { text })
  }
  async screenshot(name) {
    await this.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})))
    })
    const result = await this.call('Page.captureScreenshot')
    await writeFile(path.join(outputDir, name), Buffer.from(result.data, 'base64'))
  }
}

try {
  context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
    channel: 'chromium', headless: true, acceptDownloads: true, viewport: { width: 1200, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`,
      '--host-resolver-rules=MAP workspace-features.example.net 127.0.0.1', '--no-proxy-server']
  })
  context.setDefaultTimeout(12000)
  context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  const extensionBase = `chrome-extension://${extensionId}`
  const seed = await worker.evaluate(async origin => {
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false },
      curatorBookmarkNewTabGeneralSettings: { density: 'compact' },
      curatorBookmarkIgnoreRules: { bookmarks: [], domains: [{ domain: 'kept.example', createdAt: 1 }], folders: [] }
    })
    const bar = (await chrome.bookmarks.getTree())[0].children[0]
    const folder = await chrome.bookmarks.create({ parentId: bar.id, title: '开发资料' })
    const alpha = await chrome.bookmarks.create({ parentId: folder.id, title: 'Reference Alpha', url: `${origin}/reference-alpha` })
    const beta = await chrome.bookmarks.create({ parentId: folder.id, title: 'Reference Beta', url: `${origin}/reference-beta` })
    for (let index = 0; index < 14; index++) await chrome.bookmarks.create({ parentId: folder.id, title: `资料 ${index}`, url: `${origin}/guide-${index}` })
    const tree = await chrome.bookmarks.getTree()
    tree[0].children[0].children.find(node => node.id === folder.id).children.push({ id: 'saved-lost', title: '整理前的指南', url: `${origin}/lost`, parentId: folder.id })
    const now = Date.now() - 60000
    const backup = {
      app: 'curator-bookmarks', kind: 'full-backup', schemaVersion: 1, exportedAt: new Date(now).toISOString(), extensionVersion: '1.5.3', manifestVersion: 3, source: 'auto',
      redaction: { aiProviderSettings: 'apiKey-omitted', omittedFields: [] }, chromeBookmarks: { exportedAt: new Date(now).toISOString(), tree },
      storage: {
        bookmarkTagIndex: { version: 1, updatedAt: now, records: { 'saved-lost': { bookmarkId: 'saved-lost', url: `${origin}/lost`, title: '整理前的指南', path: `${bar.title} / 开发资料`, tags: ['开发指南'], updatedAt: now } } },
        recycleBin: [], ignoreRules: { bookmarks: [], domains: [], folders: [] }, redirectCache: null,
        newTab: { generalSettings: { density: 'comfortable' } }, aiProviderSettings: { apiKeyRedacted: true }
      }
    }
    const point = { backupId: `auto-${now}-fixture`, createdAt: now, kind: 'batch-delete', source: 'options', operationReason: '清理重复书签之前', skipped: false, sizeBytes: JSON.stringify(backup).length }
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('curatorBookmarkHeavyUserData', 2)
      request.onupgradeneeded = () => { for (const [name, keyPath] of [['autoBackups', 'backupId'], ['contentFullText', 'snapshotId']]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath }) }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('autoBackups', 'readwrite')
      transaction.objectStore('autoBackups').put({ ...point, payload: backup })
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    await chrome.storage.local.set({ curatorBookmarkAutoBackupIndex: [point] })
    return { folder, alpha, beta, point }
  }, origin)

  optionsPage = await context.newPage()
  await optionsPage.goto(`${extensionBase}/src/options/options.html#backup`)
  await optionsPage.getByRole('button', { name: '预览恢复点：清理重复书签之前', exact: true }).click()
  const preview = optionsPage.locator('#backup-restore-preview')
  await preview.getByRole('textbox', { name: '搜索备份中的书签', exact: true }).fill('整理前的指南')
  await preview.getByText('当前缺失', { exact: true }).waitFor()
  assert.equal(await preview.getByRole('list', { name: '备份书签预览列表' }).getByRole('listitem').count(), 1)
  const preserved = await worker.evaluate(() => chrome.storage.local.get(['curatorBookmarkNewTabGeneralSettings', 'curatorBookmarkIgnoreRules']))
  await optionsPage.screenshot({ path: path.join(outputDir, 'recovery-preview.png'), fullPage: true })
  await preview.getByRole('button', { name: '从备份预览恢复书签与标签，保留当前设置', exact: true }).click()
  const confirmation = optionsPage.getByRole('dialog')
  await confirmation.getByRole('button', { name: '确认当前操作', exact: true }).click()
  await optionsPage.getByRole('status').filter({ hasText: '恢复完成：标签 1 条' }).waitFor()
  assert.deepEqual(await worker.evaluate(() => chrome.storage.local.get(['curatorBookmarkNewTabGeneralSettings', 'curatorBookmarkIgnoreRules'])), preserved)
  assert.equal((await worker.evaluate(url => chrome.bookmarks.search({ url }), `${origin}/lost`)).length, 1)
  assert.ok((await worker.evaluate(() => chrome.storage.local.get('curatorBookmarkAutoBackupIndex'))).curatorBookmarkAutoBackupIndex.length >= 2)
  results.recovery = { previewOriginalBookmarks: true, partialRestore: true, preservedSettings: true, preRestoreBackup: true }
  console.log('Recovery point browsing, preview and scoped restore passed.')

  const source = await context.newPage()
  await source.goto(`${origin}/source-alpha`)
  const sourceTab = await worker.evaluate(url => chrome.tabs.query({ url }), `${origin}/source-alpha`).then(tabs => tabs[0])
  const popup = await context.newPage()
  await popup.setViewportSize({ width: 800, height: 600 })
  await popup.goto(`${extensionBase}/src/popup/popup.html`)
  await popup.locator('#open-side-panel').click()
  await poll(() => worker.evaluate(() => chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'] }).then(contexts => contexts.length)), 'native side panel opened')
  await source.bringToFront()
  const root = await context.newCDPSession(source)
  const target = await poll(async () => (await root.send('Target.getTargets')).targetInfos.find(target => target.url === `${extensionBase}/src/sidepanel/sidepanel.html` && !target.attached), 'native side panel target')
  const { sessionId } = await root.send('Target.attachToTarget', { targetId: target.targetId, flatten: false })
  native = new NativePanel(root, sessionId)
  await native.call('Runtime.enable')
  await native.wait(() => document.querySelector('#search-input') && document.querySelector('.popup-workspace-reveal')?.getAttribute('data-state') === 'ready')
  await native.wait(() => document.querySelector('#smart-classifier')?.textContent.includes('来源网页 Alpha'))
  const saveButtonVisible = await native.evaluate(() => {
    const button = document.querySelector('[data-current-page-action="save"]')
    const rect = button.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return button === hit || button.contains(hit)
  })
  assert.equal(saveButtonVisible, true, 'current-page actions must fit inside the stacked card')
  await native.click('[data-current-page-action="save"]')
  await native.wait(() => document.querySelector('#smart-folder-title-input')?.value.includes('来源网页 Alpha'))
  await native.fill('#smart-folder-title-input', '切页前的未保存草稿')
  await source.goto(`${origin}/source-beta`)
  await native.wait(() => !document.querySelector('#smart-folder-modal')?.checkVisibility())
  await source.goto(`${origin}/source-alpha`)
  await native.wait(() => document.querySelector('#smart-classifier')?.textContent.includes('来源网页 Alpha'))
  await native.click('[data-current-page-action="save"]')
  await native.wait(() => document.querySelector('#smart-folder-title-input')?.value === '来源网页 Alpha')
  await native.fill('#smart-folder-title-input', '自定义来源网页名称')
  // Hold only this test's save RPC so a real page switch races its completion.
  await native.evaluate(() => {
    const send = chrome.runtime.sendMessage.bind(chrome.runtime)
    globalThis.__restoreSaveRPC = () => { chrome.runtime.sendMessage = send }
    chrome.runtime.sendMessage = (message, callback) => {
      if (message?.type !== 'bookmark:save') return send(message, callback)
      globalThis.__releaseSaveRPC = () => send(message, response => { callback(response); globalThis.__saveResponseObserved = true })
    }
  })
  await native.click(`[data-smart-select-folder="${seed.folder.id}"]`)
  assert.equal(await native.evaluate(() => Boolean(globalThis.__releaseSaveRPC)), false, 'folder choice alone must not submit')
  await native.screenshot('save-bookmark.png')
  await native.click('#save-smart-folder-button')
  await native.wait(() => Boolean(globalThis.__releaseSaveRPC))
  await source.goto(`${origin}/source-beta`)
  await native.wait(() => document.querySelector('#smart-classifier')?.textContent.includes('来源网页 Beta'))
  await native.evaluate(() => { globalThis.__releaseSaveRPC(); globalThis.__restoreSaveRPC() })
  await native.wait(() => globalThis.__saveResponseObserved)
  await poll(async () => (await worker.evaluate(url => chrome.bookmarks.search({ url }), `${origin}/source-alpha`)).length === 1, 'original source saved via worker')
  assert.equal((await worker.evaluate(url => chrome.bookmarks.search({ url }), `${origin}/source-alpha`))[0].title, '自定义来源网页名称')
  await native.wait(() => document.querySelector('#smart-classifier')?.textContent.includes('来源网页 Beta') && document.querySelector('#smart-classifier')?.textContent.includes('未收藏'))
  await source.goto(`${origin}/source-alpha`)
  await native.wait(() => document.querySelector('#smart-classifier')?.textContent.includes('来源网页 Alpha'))
  await native.fill('#search-input', 'Reference')
  await native.wait(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 2)
  await native.key('ArrowDown')
  await native.wait(() => {
    const input = document.querySelector('#search-input')
    const row = document.getElementById(input.getAttribute('aria-activedescendant'))
    return document.activeElement === input && input.getAttribute('aria-expanded') === 'true' && row?.getAttribute('aria-selected') === 'true'
  })
  await native.key('/', 2, 'Slash')
  await native.wait(() => Boolean(document.querySelector('#popup-keyboard-help-dialog')))
  await native.wait(() => document.querySelector('#popup-keyboard-help-dialog').scrollTop === 0)
  await native.screenshot('keyboard-help.png')
  await native.key('Escape')
  await native.wait(() => !document.querySelector('#popup-keyboard-help-dialog') && document.activeElement?.id === 'search-input')
  assert.equal(await native.evaluate(() => document.querySelector('#search-input').value), 'Reference')
  await native.key('k', 2, 'KeyK')
  await native.fill('#search-input', 'Reference Beta')
  await native.wait(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 1)
  await native.key('F2')
  await native.wait(() => document.querySelector('#edit-title-input')?.value === 'Reference Beta')
  await native.screenshot('sidebar-edit.png')
  await native.key('Escape')
  await native.wait(() => !document.querySelector('#modal-backdrop [role="dialog"]')?.checkVisibility())
  await native.click(`#popup-search-result-${seed.beta.id} .sidepanel-bookmark-menu`)
  await native.wait(() => document.querySelector('[data-popup-row-menu]')?.checkVisibility())
  await native.screenshot('sidebar-bookmark-menu.png')
  await native.click('[data-bookmark-menu-action="edit"]')
  await native.wait(() => document.querySelector('#edit-title-input')?.value === 'Reference Beta')
  await native.key('Escape')
  await native.wait(() => !document.querySelector('#modal-backdrop [role="dialog"]')?.checkVisibility())
  await native.click('#search-input')
  await native.key('Enter', 2)
  await poll(async () => (await worker.evaluate(url => chrome.tabs.query({ url }), `${origin}/reference-beta`)).some(tab => !tab.active), 'background opening')
  assert.equal(await native.evaluate(() => document.querySelector('#search-input').value), 'Reference Beta')
  await native.key('Enter', 1)
  await source.waitForURL(`${origin}/reference-beta`)
  assert.equal((await worker.evaluate(id => chrome.tabs.get(id), sourceTab.id)).url, `${origin}/reference-beta`)
  results.keyboard = { activeDescendant: true, retainsInputFocus: true, helpRestoresFocus: true, editSelected: true, backgroundAndCurrentTab: true }
  console.log('Native sidebar keyboard, help, focus and opening dispositions passed.')

  await native.fill('#search-input', 'External live')
  const external = await worker.evaluate(async ({ folderId, origin }) => chrome.bookmarks.create({ parentId: folderId, title: 'External live bookmark', url: `${origin}/external` }), { folderId: seed.folder.id, origin })
  await native.wait(id => Boolean(document.getElementById(`popup-search-result-${encodeURIComponent(id)}`)), external.id)
  await worker.evaluate(id => chrome.bookmarks.update(id, { title: 'External live renamed' }), external.id)
  await native.wait(() => document.querySelector('#popup-search-results')?.textContent.includes('External live renamed'))
  await worker.evaluate(id => chrome.bookmarks.remove(id), external.id)
  await native.wait(id => !document.getElementById(`popup-search-result-${encodeURIComponent(id)}`), external.id)
  assert.equal(await native.evaluate(() => document.querySelector('#search-input').value), 'External live')
  await native.fill('#search-input', 'Reference')
  for (const [width, height] of [[320, 600], [390, 844], [520, 480]]) {
    await native.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await native.wait(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 2)
    const metrics = await native.evaluate(() => {
      const list = document.querySelector('#popup-search-results').getBoundingClientRect()
      const semantic = document.querySelector('#natural-search-toggle').getBoundingClientRect()
      const search = document.querySelector('.popup-search-shell').getBoundingClientRect()
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, listHeight: list.height, listBottom: list.bottom, searchContainsToggle: semantic.top >= search.top && semantic.bottom <= search.bottom && semantic.right <= search.right }
    })
    assert.ok(metrics.scrollWidth <= width + 1 && metrics.listHeight > 80 && metrics.listBottom <= height, JSON.stringify(metrics))
    assert.equal(metrics.searchContainsToggle, true, 'search tools must remain visible in narrow side panels')
    await native.screenshot(`sidebar-${width}.png`)
  }
  await native.call('Emulation.clearDeviceMetricsOverride')
  await source.goto(`${origin}/source-beta`)
  await native.wait(() => document.querySelector('#smart-classifier')?.textContent.includes('来源网页 Beta'))
  await source.evaluate(() => { document.title = '来源网页 Beta 更新标题' })
  await native.wait(() => document.querySelector('#smart-classifier')?.textContent.includes('来源网页 Beta 更新标题'))
  assert.equal(await native.evaluate(() => document.querySelector('#search-input').value), 'Reference')
  const settingsOpened = context.waitForEvent('page')
  await native.click('#open-settings')
  const openedSettings = await settingsOpened
  await openedSettings.waitForURL('**/src/options/options.html#general')
  assert.equal(await native.evaluate(() => document.querySelector('#search-input').value), 'Reference')
  await openedSettings.close()
  await source.bringToFront()
  results.sidebar = { nativeSurface: true, widths: [320, 390, 520], liveBookmarkChanges: true, tracksSourceTab: true, persistsAcrossNavigation: true, workerSave: true, switchedPageSaveSafety: true }
  console.log('Sidebar sizing, live bookmarks and navigation persistence passed.')

  const archiveOpened = context.waitForEvent('page')
  await native.click('#open-page-archive')
  const archive = await archiveOpened
  await archive.waitForURL(`**/src/archive/archive.html?tabId=${sourceTab.id}`)
  await archive.getByRole('heading', { name: '来源网页 Beta 更新标题', exact: true }).waitFor()
  const downloadPending = archive.waitForEvent('download')
  await archive.getByRole('button', { name: '保存离线文件', exact: true }).click()
  const download = await downloadPending
  assert.ok(download.suggestedFilename().endsWith('.mhtml'))
  const archivePath = path.join(outputDir, 'captured-page.mhtml')
  await download.saveAs(archivePath)
  const mhtml = await readFile(archivePath, 'utf8')
  assert.match(mhtml, /Content-Type: multipart\/related/i)
  assert.match(mhtml, /Content-Location: .*\/style\.css/i)
  assert.match(mhtml, /Content-Location: .*\/image\.svg/i)
  await archive.screenshot({ path: path.join(outputDir, 'archive-saved.png'), fullPage: true })
  await context.setOffline(true)
  const offline = await context.newPage()
  await offline.goto(pathToFileURL(archivePath).href)
  assert.equal(await offline.locator('h1').textContent(), 'Curator offline fixture')
  assert.equal(await offline.locator('#dynamic').textContent(), '动态加载后保存的内容')
  assert.equal(await offline.locator('h1').evaluate(element => getComputedStyle(element).color), 'rgb(23, 81, 143)')
  assert.equal(await offline.locator('img').evaluate(image => image.complete && image.naturalWidth === 120), true)
  await offline.screenshot({ path: path.join(outputDir, 'archive-offline.png'), fullPage: true })
  await context.setOffline(false)

  const denied = await context.newPage()
  await denied.addInitScript(() => {
    chrome.permissions.request = (_permissions, callback) => callback(false)
    chrome.pageCapture.saveAsMHTML = () => { throw new Error('Capture must not run after denied consent') }
  })
  await denied.goto(archive.url())
  await denied.getByRole('button', { name: '保存离线文件', exact: true }).click()
  await denied.getByRole('alert').filter({ hasText: '未授予页面存档权限' }).waitFor()
  const closedSource = await context.newPage()
  await closedSource.goto(`${origin}/closed-source`)
  const closedId = (await worker.evaluate(url => chrome.tabs.query({ url }), `${origin}/closed-source`))[0].id
  const closedArchive = await context.newPage()
  await closedArchive.goto(`${extensionBase}/src/archive/archive.html?tabId=${closedId}`)
  await closedArchive.getByRole('heading', { name: '来源网页 Alpha', exact: true }).waitFor()
  await closedSource.close()
  await closedArchive.getByRole('button', { name: '保存离线文件', exact: true }).click()
  await closedArchive.getByRole('alert').filter({ hasText: '来源标签页已关闭' }).waitFor()
  results.archive = { nativeMHTML: true, offlineText: true, offlineStyles: true, offlineImages: true, dynamicContent: true, permissionDenial: true, closedSource: true, headlessConsent: 'pregranted only in disposable test copy' }
  assert.deepEqual(pageErrors, [])
  await writeFile(path.join(outputDir, 'browser-results.json'), JSON.stringify(results, null, 2))
  console.log('Native MHTML download and offline rendering, permission denial and closed-source handling passed.')
} catch (error) {
  await native?.screenshot('failure-native.png').catch(() => {})
  await optionsPage?.screenshot({ path: path.join(outputDir, 'failure-options.png'), fullPage: true }).catch(() => {})
  console.error('Page errors:', pageErrors)
  throw error
} finally {
  await context?.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()))
  await rm(temporary, { recursive: true, force: true })
}
