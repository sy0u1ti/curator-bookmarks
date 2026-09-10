import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, cp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
const baseline = process.argv.includes('--baseline')
const temporary = await mkdtemp(path.join(tmpdir(), 'curator-availability-probe-'))
const extensionPath = path.join(temporary, 'extension')
const output = path.resolve('output/playwright/availability')
await mkdir(output, { recursive: true })
await cp(path.resolve('dist'), extensionPath, { recursive: true })
const calls = []
let rateLimitEnabled = true
let missingEnabled = true
const downloads = []
const server = createServer((request, response) => {
  calls.push(request.url)
  if (request.url === '/missing-stream' && missingEnabled) { response.writeHead(404, { 'content-type': 'text/html' }); response.write('<html><body>not found'); return }
  if (request.url === '/slow-html' || request.url.startsWith('/pause/')) { response.writeHead(200, { 'content-type': 'text/html' }); response.write('<html><body>still loading'); return }
  if (request.url === '/rate' && rateLimitEnabled) { response.writeHead(429, { 'retry-after': '120', 'content-type': 'text/html' }); response.write('<html>limited'); return }
  if (request.url === '/empty') { response.writeHead(204); response.end(); return }
  if (request.url === '/redirect') { response.writeHead(302, { location: '/ok' }); response.end(); return }
  if (request.url === '/download-ready') { response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="fixture.bin"', 'content-length': '16777216' }); response.write(Buffer.alloc(2048, 65)); return }
  if (request.url === '/download') { response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="fixture.bin"' }); response.write('fixture'); return }
  response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><title>Fixture</title><p>Available</p>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://availability-fixture.example.net:' + server.address().port
const manifestPath = path.join(extensionPath, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.host_permissions = [...manifest.host_permissions, 'http://availability-fixture.example.net/*']
await writeFile(manifestPath, JSON.stringify(manifest))
let context
try {
  context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
    channel: 'chromium', headless: true, acceptDownloads: false,
    args: ['--disable-extensions-except=' + extensionPath, '--load-extension=' + extensionPath,
      '--host-resolver-rules=MAP availability-fixture.example.net 127.0.0.1', '--no-proxy-server']
  })
  context.on('page', tab => tab.on('download', download => downloads.push(download.suggestedFilename())))
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 })
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  await page.goto('chrome-extension://' + extensionId + '/src/options/options.html#availability')
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  let ui = null
  const results = []
  for (const endpoint of ['/ok', '/missing-stream', '/empty', '/download', '/download-ready', '/rate', '/slow-html', '/redirect']) {
    const start = performance.now()
    const response = await page.evaluate(({ url, checkId }) => new Promise(resolve => chrome.runtime.sendMessage({
      type: 'availability:navigate', url, timeoutMs: 1500, checkId
    }, resolve)), { url: origin + endpoint, checkId: 'fixture-' + results.length })
    results.push({ endpoint, elapsedMs: Math.round(performance.now() - start), response })
    assert.equal(response?.ok, true, endpoint + ' should reach the worker')
  }
  const dnsSupported = await worker.evaluate(() => typeof chrome.dns?.resolve === 'function')
  await page.waitForFunction(async () => (await chrome.declarativeNetRequest.getSessionRules()).length === 0, null, { timeout: 5000 })
  const tabs = await worker.evaluate(() => chrome.tabs.query({}))
  assert.equal(tabs.filter(tab => tab.url?.includes('availability-fixture.example.net')).length, 0)
  await writeFile(path.join(output, baseline ? 'baseline-network.json' : 'verified-network.json'), JSON.stringify({ dnsSupported, results, calls, downloads, ui, pendingFixtureTabs: 0, pendingRules: 0 }, null, 2))
  if (!baseline) {
    for (const endpoint of ['/ok', '/empty', '/download-ready']) assert.equal(results.find(item => item.endpoint === endpoint).response.result.status, 'available', endpoint)
    for (const endpoint of ['/missing-stream', '/rate']) {
      const result = results.find(item => item.endpoint === endpoint)
      assert.ok(result.elapsedMs < 1000, endpoint + ' should not wait for the streaming body timeout')
      assert.equal(result.response.result.status, 'failed')
    }
    assert.equal(results.find(item => item.endpoint === '/rate').response.result.networkEvidence.retryAfterMs, 120000)
    assert.equal(results.find(item => item.endpoint === '/download').response.result.status, 'failed', 'a response without observable headers must remain unverified')
    assert.equal(results.find(item => item.endpoint === '/slow-html').response.result.status, 'failed', 'unfinished HTML must not be accepted from headers alone')
    assert.equal(results.find(item => item.endpoint === '/redirect').response.result.errorCode, 'ungranted-redirect')
  }
  if (!baseline) {
    const folderId = await worker.evaluate(async origin => {
      await chrome.storage.local.set({
        curatorBookmarkAvailabilitySettings: { concurrency: 2, navigationTimeoutMs: 5000 },
        curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false },
        curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false }
      })
      const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Availability regression fixtures' })
      for (let index = 0; index < 200; index++) await chrome.bookmarks.create({ parentId: folder.id, title: 'Duplicate ' + index, url: origin + '/ok' })
      for (const endpoint of ['/missing-stream', '/redirect', '/empty', '/download-ready', '/rate', '/after-rate-1', '/after-rate-2']) {
        await chrome.bookmarks.create({ parentId: folder.id, title: 'Fixture ' + endpoint, url: origin + endpoint })
      }
      return folder.id
    }, origin)
    await page.reload({ waitUntil: 'domcontentloaded' })
    const startButton = page.getByRole('button', { name: /^(?:开始|重新)检测全部书签$/ })
    await startButton.waitFor({ state: 'visible', timeout: 15000 })
    calls.length = 0
    const runStarted = performance.now()
    await startButton.click()
    await page.getByRole('button', { name: '重新检测全部书签', exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    const runMs = Math.round(performance.now() - runStarted)
    const fullRunCalls = calls.slice()
    const completedCopy = await page.locator('body').innerText()
    await writeFile(path.join(output, 'completed-ui.txt'), await page.locator('body').ariaSnapshot())
    await page.screenshot({ path: path.join(output, 'completed-ui.png'), fullPage: true })
    assert.equal(fullRunCalls.filter(url => url === '/ok').length, 2, '200 duplicates use one request; the redirect target is checked independently')
    assert.ok(!fullRunCalls.some(url => url.startsWith('/after-rate')), 'long Retry-After must defer the rest of the same site')
    assert.equal(fullRunCalls.length, 7)
    assert.ok(completedCopy.includes('207'), 'progress must count bookmark entries even when evidence is reused')
    assert.ok(completedCopy.includes('站点限流·暂缓'))

    missingEnabled = false
    rateLimitEnabled = false
    await page.getByRole('button', { name: '全选低置信异常书签', exact: true }).click()
    await page.getByRole('button', { name: '重新测试可用性检测已选书签', exact: true }).click()
    await page.getByText('已重新测试 4 条已选书签。', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await page.screenshot({ path: path.join(output, 'retested-ui.png'), fullPage: true })
    const historyKeys = ['curatorBookmarkDetectionHistory', 'curatorBookmarkRedirectCache']
    const savedHistory = await worker.evaluate(keys => chrome.storage.local.get(keys), historyKeys)
    await worker.evaluate(async ({ origin, folderId }) => {
      for (let index = 0; index < 6; index++) await chrome.bookmarks.create({ parentId: folderId, title: 'Pause fixture ' + index, url: origin + '/pause/' + index })
    }, { origin, folderId })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^(?:开始|重新)检测全部书签$/ }).click()
    const waitDeadline = Date.now() + 10000
    while (!calls.some(url => url.startsWith('/pause/'))) {
      assert.ok(Date.now() < waitDeadline, 'the slow test request should start')
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    await page.getByRole('button', { name: '暂停检测', exact: true }).click()
    await page.getByRole('button', { name: '继续检测', exact: true }).waitFor({ state: 'visible' })
    const stopStarted = performance.now()
    await page.getByRole('button', { name: '停止本次检测', exact: true }).click()
    await page.getByRole('button', { name: /^(?:开始|重新)检测全部书签$/ }).waitFor({ state: 'visible', timeout: 5000 })
    const stopMs = Math.round(performance.now() - stopStarted)
    assert.ok(stopMs < 3000, 'stopping while paused must drain promptly')
    await page.waitForFunction(async () => (await chrome.declarativeNetRequest.getSessionRules()).length === 0, null, { timeout: 5000 })
    const remainingTabs = await worker.evaluate(() => chrome.tabs.query({}))
    assert.equal(remainingTabs.filter(tab => tab.url?.includes('availability-fixture.example.net')).length, 0)
    const afterStopHistory = await worker.evaluate(keys => chrome.storage.local.get(keys), historyKeys)
    assert.deepEqual(afterStopHistory, savedHistory, 'a stopped partial run must preserve completed history and redirect evidence')
    await page.screenshot({ path: path.join(output, 'stopped-ui.png'), fullPage: true })
    assert.deepEqual(pageErrors, [])
    ui = { bookmarks: 207, fullRunRequests: fullRunCalls.length, fullRunCalls, runMs, retestedBookmarks: 4, stopMs, pageErrors, historyPreservedOnStop: true }
  }
  await writeFile(path.join(output, baseline ? 'baseline-network.json' : 'verified-network.json'), JSON.stringify({ dnsSupported, results, calls, downloads, ui, pendingFixtureTabs: 0, pendingRules: 0 }, null, 2))
  console.log(JSON.stringify({ baseline, dnsSupported, ui, downloads, results: results.map(item => ({ endpoint: item.endpoint, elapsedMs: item.elapsedMs, status: item.response?.result?.status, errorCode: item.response?.result?.errorCode })) }))
 } catch (error) {
  const visible = context?.pages().find(tab => tab.url().includes('/src/options/options.html'))
  if (visible) {
    await visible.screenshot({ path: path.join(output, 'failure-ui.png'), fullPage: true }).catch(() => {})
    await writeFile(path.join(output, 'failure-ui.txt'), await visible.locator('body').ariaSnapshot()).catch(() => {})
  }
  throw error
} finally {
  await context?.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  const resolved = path.resolve(temporary)
  assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('curator-availability-probe-'))
  await rm(resolved, { recursive: true, force: true })
}
