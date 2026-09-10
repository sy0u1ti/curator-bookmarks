import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
// Exercises real controls with synthetic bookmarks in an isolated extension profile.
const before = process.argv.includes('--before')
const output = path.resolve('output/playwright/options-ui/' + (before ? 'before' : 'after'))
await mkdir(output, { recursive: true })
const temporary = await mkdtemp(path.join(tmpdir(), 'curator-options-ui-'))
const extensionPath = path.join(temporary, 'extension')
await cp(path.resolve('dist'), extensionPath, { recursive: true })
const requests = []
let guideAvailable = false
const server = createServer((request, response) => {
  requests.push(request.url)
  if (request.url === '/slow') return // Hold a request until the UI stops the task.
  if (request.url.startsWith('/guide') && !guideAvailable) { response.writeHead(404, { 'content-type': 'text/html' }); response.end('<p>Not found</p>'); return }
  if (request.url === '/restricted') { response.writeHead(403, { 'content-type': 'text/html' }); response.end('<p>Login required</p>'); return }
  if (request.url === '/redirect') { response.writeHead(302, { location: '/article' }); response.end(); return }
  response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><title>UI fixture</title><p>Example document</p>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://options-ui.example.net:' + server.address().port
const manifestPath = path.join(extensionPath, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.host_permissions = [...manifest.host_permissions, 'http://options-ui.example.net/*', 'http://127.0.0.1/*']
await writeFile(manifestPath, JSON.stringify(manifest))
let context
let page
try {
  context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
    channel: 'chromium', headless: true, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 },
    args: ['--disable-extensions-except=' + extensionPath, '--load-extension=' + extensionPath,
      '--host-resolver-rules=MAP options-ui.example.net 127.0.0.1', '--no-proxy-server']
  })
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 })
  const extensionId = new URL(worker.url()).host
  const seeded = await worker.evaluate(async origin => {
    const now = Date.now()
    await chrome.storage.local.set({
      curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false },
      curatorBookmarkAiNamingSettings: { baseUrl: origin.replace('options-ui.example.net', '127.0.0.1'), apiKey: '', model: 'demo-text', apiStyle: 'auto', autoAnalyzeBookmarks: false },
      curatorBookmarkAvailabilitySettings: { concurrency: 2, navigationTimeoutMs: 5000 }
    })
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'UI 检查资料' })
    const second = await chrome.bookmarks.create({ parentId: folder.id, title: '开发文档' })
    const empty = await chrome.bookmarks.create({ parentId: folder.id, title: '待清理空目录' })
    const ignoredFolder = await chrome.bookmarks.create({ parentId: folder.id, title: '暂不检测' })
    const guide = await chrome.bookmarks.create({ parentId: folder.id, title: 'iOS 安装指南（自签名）', url: origin + '/guide/%E5%AE%89%E8%A3%85?lang=zh-CN' })
    const restricted = await chrome.bookmarks.create({ parentId: folder.id, title: '项目参考资料', url: origin + '/restricted' })
    const redirect = await chrome.bookmarks.create({ parentId: folder.id, title: '项目文档旧入口', url: origin + '/redirect' })
    const copies = []
    for (let index = 0; index < 3; index++) copies.push(await chrome.bookmarks.create({ parentId: index === 2 ? second.id : folder.id, title: ['开发手册', '开发手册旧收藏', '开发手册备份'][index], url: origin + '/article' }))
    const ignored = await chrome.bookmarks.create({ parentId: folder.id, title: '已忽略的示例', url: origin + '/ignored' })
    await chrome.storage.local.set({
      curatorBookmarkIgnoreRules: { bookmarks: [{ bookmarkId: ignored.id, title: ignored.title, url: ignored.url, createdAt: now }], domains: [{ domain: 'old.example.org', createdAt: now }], folders: [{ folderId: ignoredFolder.id, title: ignoredFolder.title, path: '书签栏 / UI 检查资料 / 暂不检测', createdAt: now }] },
      curatorBookmarkRecycleBin: [{ recycleId: 'recycle-ui-example', bookmarkId: 'removed-ui-example', title: '已删除的设计参考', url: origin + '/design', parentId: folder.id, path: '书签栏 / UI 检查资料', index: 0, source: '手动清理', deletedAt: now - 86400000 }],
      curatorBookmarkAddHistory: { version: 1, entries: [{ id: 'organize-ui-example', bookmarkId: copies[2].id, title: copies[2].title, url: copies[2].url, originalFolderPath: '书签栏 / 收件箱', targetFolderPath: '书签栏 / UI 检查资料 / 开发文档', targetFolderId: second.id, recommendationKind: 'existing', moved: true, confidence: 0.93, reason: '与开发文档主题一致，放在此目录便于查找。', summary: '安装、配置和常见问题的完整参考。'.repeat(5), suggestedTitle: '开发参考手册', createdAt: now }] },
      curatorBookmarkAiAnalysisCheckpoint: { version: 1, scopeFolderId: folder.id, outcome: 'completed', startedAt: now - 20000, updatedAt: now, totalBookmarks: 1, completedBookmarkIds: [guide.id], results: [{ id: guide.id, currentTitle: guide.title, title: guide.title, url: guide.url, parentId: folder.id, path: '书签栏 / UI 检查资料', ancestorIds: ['1', folder.id], status: 'suggested', action: 'rename', suggestedTitle: 'iOS 自签名安装指南', summary: '介绍安装、签名与常见问题。', contentType: '文档', confidence: 'high', confidenceScore: 0.93, reason: '去除重复后缀，让标题更便于检索。', tags: ['iOS', '安装', '签名'], topics: ['移动开发'], aliases: ['安装说明'], suggestedFolder: 'UI 检查资料 / 开发文档', folderDecision: { kind: 'existing', folderId: second.id, folderPath: '书签栏 / UI 检查资料 / 开发文档', confidence: 0.9, reason: '开发文档' } }] }
    })
    return { guide, restricted, folder, second, empty }
  }, origin)
  page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const base = 'chrome-extension://' + extensionId + '/src/options/options.html'
  await page.goto(base + '#availability', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '开始检测全部书签', exact: true }).click()
  await page.getByRole('button', { name: '重新检测全部书签', exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  const guideCard = () => page.locator('#availability article').filter({ hasText: seeded.guide.title }).first()
  const baselineCard = await guideCard().boundingBox()
  const baselineCopy = await guideCard().innerText()
  const sections = ['general','backup','availability','history','redirects','ignore','duplicates','folder-cleanup','recycle','ai','bookmark-history']
  const pages = []
  for (const width of [1440, 1100, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const scrollRoot = page.locator(width <= 920 ? '.options-shell' : '#options-main')
    for (const section of sections) {
      await page.goto(base + '#' + section)
      const panel = page.locator('section#' + section)
      await panel.waitFor({ state: 'visible', timeout: 15000 })
      await scrollRoot.evaluate(node => node.scrollTo(0, 0))
      const metrics = await panel.evaluate(node => ({ title: node.querySelector('h1')?.textContent, width: node.getBoundingClientRect().width, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, controls: node.querySelectorAll('button,input,select,a').length, contentWidth: node.scrollWidth }))
      assert.ok(metrics.documentWidth <= width + 2, section + ' must fit viewport ' + width)
      assert.ok(metrics.contentWidth <= metrics.width + 2, section + ' content must not overflow its panel: ' + JSON.stringify(metrics))
      if (!before && section === 'ai') {
        await panel.getByText('iOS 自签名安装指南', { exact: true }).waitFor({ state: 'visible' })
        assert.equal(await panel.getByText('先配置 AI 渠道', { exact: true }).count(), 0, 'configured local providers do not require an API key')
      }
      if (!before && section === 'general') {
        const setupSteps = panel.getByRole('list', { name: 'AI 渠道配置流程' })
        const setupHelp = panel.getByRole('button', { name: '查看 AI 渠道配置步骤', exact: true })
        assert.equal(await setupSteps.count(), 0, 'setup steps remain collapsed until requested')
        await setupHelp.click()
        await setupSteps.waitFor({ state: 'visible' })
        assert.equal(await setupSteps.getByRole('listitem').count(), 5)
        await setupHelp.click()
        await setupSteps.waitFor({ state: 'hidden' })
        const advancedBorder = await panel.getByRole('button', { name: 'Base URL 与接口选项', exact: true }).evaluate(node => parseFloat(getComputedStyle(node).borderTopWidth))
        assert.ok(advancedBorder >= 1, 'advanced settings need a visible button')
      }
      await page.screenshot({ path: path.join(output, section + '-' + width + '.png'), animations: 'disabled', fullPage: true })
      await writeFile(path.join(output, section + '-' + width + '.txt'), await panel.ariaSnapshot())
      const scroll = await scrollRoot.evaluate(node => ({ height: node.clientHeight, max: node.scrollHeight - node.clientHeight }))
      const scrollStep = Math.max(1, Math.floor(scroll.height * 0.8))
      for (let offset = scrollStep, index = 1; offset < scroll.max + scrollStep; offset += scrollStep, index++) {
        await scrollRoot.evaluate((node, y) => node.scrollTo(0, y), Math.min(offset, scroll.max))
        await page.screenshot({ path: path.join(output, section + '-' + width + '-scroll-' + index + '.png'), animations: 'disabled' })
      }
      pages.push({ section, viewport: width, ...metrics })
      if (!before && section === 'availability') {
        const card = guideCard()
        const more = card.getByRole('button', { name: '更多操作：' + seeded.guide.title, exact: true })
        await card.screenshot({ path: path.join(output, 'availability-card-' + width + '.png'), animations: 'disabled' })
        if (width === 390) {
          const moreBox = await more.boundingBox()
          const detailsBox = await card.getByRole('button', { name: '检测详情：' + seeded.guide.title, exact: true }).boundingBox()
          assert.ok(Math.abs(moreBox.y - detailsBox.y) < 2, 'narrow action bars use two rows rather than three')
        }
        await more.click()
        const menu = page.getByRole('menu', { name: '更多操作：' + seeded.guide.title, exact: true })
        await menu.waitFor({ state: 'visible' })
        const box = await menu.boundingBox()
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, 'action menu must remain in the viewport')
        await page.screenshot({ path: path.join(output, 'availability-menu-' + width + '.png'), animations: 'disabled' })
        await page.keyboard.press('Escape')
        await menu.waitFor({ state: 'hidden' })
      }
    }
  }
  if (!before) {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(base + '#availability')
    const card = guideCard()
    const details = card.getByRole('button', { name: '检测详情：' + seeded.guide.title, exact: true })
    assert.equal(await card.getByText('检测依据', { exact: true }).count(), 0, 'evidence must be unmounted when collapsed')
    const compact = await card.boundingBox()
    assert.ok(compact.height < 210, 'default result must remain compact')
    const buttonStyle = await details.evaluate(node => { const css=getComputedStyle(node); return { height: node.getBoundingClientRect().height, border: Number.parseFloat(css.borderTopWidth) } })
    assert.ok(buttonStyle.height >= 32 && buttonStyle.border >= 1, 'detail actions need an obvious button affordance')
    await details.click()
    await card.getByText('检测依据', { exact: true }).waitFor({ state: 'visible' })
    assert.ok((await card.innerText()).includes('私有资源和登录后内容'), 'full evidence must remain available')
    await page.screenshot({ path: path.join(output, 'availability-details.png'), animations: 'disabled' })
    await details.press('Space')
    await card.getByText('检测依据', { exact: true }).waitFor({ state: 'hidden' })
    const more = card.getByRole('button', { name: '更多操作：' + seeded.guide.title, exact: true })
    await more.focus(); await more.press('ArrowDown')
    const menu = page.getByRole('menu', { name: '更多操作：' + seeded.guide.title, exact: true })
    await menu.waitFor({ state: 'visible' })
    assert.equal(await menu.getByRole('menuitem').count(), 5)
    assert.ok((await menu.innerText()).includes('子文件夹'))
    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' })
    assert.equal(await more.evaluate(node => node === document.activeElement), true, 'Escape restores trigger focus')
    const restrictedSelection = page.locator('#availability article').filter({ hasText: seeded.restricted.title }).getByRole('checkbox')
    await restrictedSelection.check()
    await card.getByRole('checkbox').check()
    guideAvailable = true
    const priorRequests = requests.length
    await card.getByRole('button', { name: '重新检测：' + seeded.guide.title, exact: true }).click()
    await page.getByText('已重新测试 1 条书签。', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    const scopedRequests = requests.slice(priorRequests)
    assert.ok(scopedRequests.length > 0 && scopedRequests.every(url => url.startsWith('/guide')), 'single-item retest must not test other selections')
    assert.equal(await restrictedSelection.isChecked(), true, 'retesting one bookmark preserves other selected bookmarks')
    const restrictedCard = page.locator('#availability article').filter({ hasText: seeded.restricted.title }).first()
    await restrictedCard.getByRole('button', { name: '更多操作：' + seeded.restricted.title, exact: true }).click()
    await page.getByRole('menuitem', { name: /^本次隐藏/ }).click()
    await restrictedCard.waitFor({ state: 'hidden' })
    const stillExists = await worker.evaluate(id => chrome.bookmarks.get(id), seeded.restricted.id)
    assert.equal(stillExists[0].url, seeded.restricted.url, 'hide must not delete the bookmark')

    // Persisting one bookmark ignore rule must not expand into a domain/folder rule.
    guideAvailable = false
    await page.getByRole('button', { name: '重新检测全部书签', exact: true }).click()
    await page.getByRole('button', { name: '重新检测全部书签', exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    const oldRules = await worker.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkIgnoreRules')).curatorBookmarkIgnoreRules)
    await guideCard().getByRole('button', { name: '更多操作：' + seeded.guide.title, exact: true }).click()
    await page.getByRole('menuitem', { name: /^忽略此书签/ }).click()
    const ignoreConfirmation = page.getByRole('dialog', { name: '新增书签忽略规则？', exact: true })
    await ignoreConfirmation.waitFor({ state: 'visible' })
    await ignoreConfirmation.getByRole('button', { name: '确认当前操作', exact: true }).click()
    await ignoreConfirmation.waitFor({ state: 'hidden' })
    await guideCard().waitFor({ state: 'hidden' })
    const newRules = await worker.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkIgnoreRules')).curatorBookmarkIgnoreRules)
    assert.deepEqual(newRules.domains, oldRules.domains)
    assert.deepEqual(newRules.folders, oldRules.folders)
    assert.deepEqual(newRules.bookmarks.map(rule => rule.bookmarkId).sort(), [...oldRules.bookmarks.map(rule => rule.bookmarkId), seeded.guide.id].sort())
    assert.equal((await worker.evaluate(id => chrome.bookmarks.get(id), seeded.guide.id))[0].url, seeded.guide.url)
    await page.goto(base + '#ignore')
    await page.getByRole('button', { name: '取消忽略：' + seeded.guide.title, exact: true }).click()
    await page.getByRole('button', { name: '取消忽略：' + seeded.guide.title, exact: true }).waitFor({ state: 'hidden' })
    assert.deepEqual(await worker.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkIgnoreRules')).curatorBookmarkIgnoreRules), oldRules)

    // Navigate within the same options page while a real network task is active.
    await worker.evaluate(async ({ parentId, origin }) => {
      await chrome.bookmarks.create({ parentId, title: 'Pending UI check', url: origin + '/slow' })
    }, { parentId: seeded.folder.id, origin })
    await page.goto(base + '#availability')
    await page.reload()
    await page.getByRole('button', { name: /^(?:开始|重新)检测全部书签$/ }).click()
    const stop = page.getByRole('button', { name: '停止本次检测', exact: true })
    await stop.waitFor({ state: 'visible' })
    await guideCard().waitFor({ state: 'visible' })
    assert.equal(await guideCard().getByRole('button', { name: '重新检测：' + seeded.guide.title, exact: true }).isDisabled(), true)
    assert.equal(await guideCard().getByRole('button', { name: '更多操作：' + seeded.guide.title, exact: true }).isDisabled(), true, 'More is disabled when every action is locked')
    await page.goto(base + '#ignore')
    const ignoreMutations = page.locator('#ignore').getByRole('button').filter({ hasText: /^(?:取消忽略|清空此类规则)$/ })
    await ignoreMutations.first().waitFor({ state: 'visible' })
    assert.ok(await ignoreMutations.count() > 0)
    for (const button of await ignoreMutations.all()) assert.equal(await button.isDisabled(), true, 'ignore changes are visibly locked while checking')
    await page.goto(base + '#ai')
    const applySuggestion = page.locator('#ai').getByRole('button').filter({ hasText: /^应用建议$/ }).first()
    await applySuggestion.waitFor({ state: 'visible' })
    assert.equal(await applySuggestion.isDisabled(), true, 'AI bookmark changes are visibly locked while checking')
    await page.goto(base + '#availability')
    await stop.click()
    await page.getByRole('button', { name: /^(?:开始|重新)检测全部书签$/ }).waitFor({ state: 'visible', timeout: 5000 })
    await page.goto(base + '#ignore')
    await ignoreMutations.first().waitFor({ state: 'visible' })
    for (const button of await ignoreMutations.all()) assert.equal(await button.isEnabled(), true, 'ignore controls unlock after stopping')
    await page.goto(base + '#ai')
    await applySuggestion.waitFor({ state: 'visible' })
    assert.equal(await applySuggestion.isEnabled(), true, 'AI controls unlock after stopping')

    // Large historical records mount in bounded pages only when requested.
    await worker.evaluate(async origin => {
      const stored = await chrome.storage.local.get('curatorBookmarkDetectionHistory')
      const history = stored.curatorBookmarkDetectionHistory
      const results = Array.from({ length: 61 }, (_, index) => ({
        id: 'ui-history-' + index, title: '历史明细样本 ' + (index + 1),
        url: origin + '/history/' + (index === 60 ? 'long-path'.repeat(40) : index),
        path: '书签栏 / 历史', status: 'review', streak: 1
      }))
      history.runs.push({
        runId: 'ui-long-history', completedAt: Date.now() - 86400000, scope: history.runs[0].scope,
        results, newResults: results, recoveredResults: [],
        summary: { totalAbnormal: 61, newCount: 61, persistentCount: 0, recoveredCount: 0, reviewCount: 61, failedCount: 0 }
      })
      await chrome.storage.local.set({ curatorBookmarkDetectionHistory: history })
    }, origin)
    await page.goto(base + '#history')
    await page.reload()
    const longHistory = page.locator('#history article').filter({ hasText: '异常 61 条' })
    await longHistory.waitFor({ state: 'visible' })
    assert.equal(await longHistory.locator('li').count(), 0, 'closed histories do not render full result lists')
    await longHistory.getByRole('button', { name: /^查看本轮明细/ }).click()
    assert.equal(await longHistory.locator('li').count(), 6)
    await longHistory.getByRole('button', { name: '显示更多（剩余 55 条）', exact: true }).click()
    assert.equal(await longHistory.locator('li').count(), 56)
    await longHistory.getByRole('button', { name: '显示更多（剩余 5 条）', exact: true }).click()
    assert.equal(await longHistory.locator('li').count(), 61)
    assert.equal(await longHistory.getByRole('button', { name: /^显示更多/ }).count(), 0)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.locator('#history').evaluate(node => node.scrollWidth <= node.clientWidth + 2), true, 'long history URLs must wrap on narrow screens')
    await longHistory.locator('li').last().scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(output, 'history-expanded-390.png'), animations: 'disabled' })
    await longHistory.getByRole('button', { name: /^查看本轮明细/ }).click()
    await longHistory.locator('li').first().waitFor({ state: 'hidden' })

    // AI history retains the full explanation without repeating it in each collapsed card.
    await page.goto(base + '#bookmark-history')
    const organizeCard = page.locator('#bookmark-history article').filter({ hasText: '开发手册备份' })
    assert.equal(await organizeCard.getByText('与开发文档主题一致，放在此目录便于查找。', { exact: true }).count(), 0)
    await organizeCard.getByRole('button', { name: /^整理详情/ }).click()
    await organizeCard.getByText('与开发文档主题一致，放在此目录便于查找。', { exact: true }).waitFor({ state: 'visible' })
    await page.screenshot({ path: path.join(output, 'bookmark-history-details-390.png'), animations: 'disabled' })

  }
  assert.deepEqual(errors, [])
  await rm(path.join(output, 'failure.png'), { force: true })
  await rm(path.join(output, 'failure.txt'), { force: true })
  await writeFile(path.join(output, 'audit.json'), JSON.stringify({ before, pages, card: { height: baselineCard.height, visibleCharacters: baselineCopy.length }, errors, tested: before ? [] : ['compact summary', 'lazy details', 'menu scope descriptions', 'responsive menu', 'normal and reduced motion', 'keyboard focus', 'single retest', 'hide without deleting', 'local AI without key', 'bookmark ignore scope', 'cancel ignore', 'task lock and unlock', 'incremental history details', 'AI history disclosure'] }, null, 2))
  console.log(JSON.stringify({ before, pages: pages.length, cardHeight: baselineCard.height, visibleCharacters: baselineCopy.length, errors }))
} catch (error) {
  if (page) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); await writeFile(path.join(output, 'failure.txt'), await page.locator('body').ariaSnapshot()).catch(() => {}) }
  throw error
} finally {
  await context?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
  const resolved = path.resolve(temporary)
  assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('curator-options-ui-'))
  await rm(resolved, { recursive: true, force: true })
}
