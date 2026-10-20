import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const profile = await mkdtemp(path.join(tmpdir(), 'curator-pinyin-source-'))
const output = path.resolve('output/search-pinyin-source')
const targetTitle = '卡网订阅比价 | PriceAI'
const report = []
let context
try {
  await mkdir(output, { recursive: true })
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 800, height: 640 },
    args: [`--load-extension=${path.resolve('dist')}`, `--disable-extensions-except=${path.resolve('dist')}`]
  })
  context.setDefaultTimeout(15000)
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  const targetId = await worker.evaluate(async title => {
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
      curatorBookmarkContentSnapshotSettings: { enabled: false, autoCaptureOnBookmarkCreate: false },
      curatorBookmarkInboxSettings: { enabled: false, autoAnalyzeEnabled: false },
      curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013', maskEnabled: false },
      curatorBookmarkNewTabFolderSettings: { selectedFolderIds: ['1'], browseMode: 'navigation' },
      curatorBookmarkOnboardingState: { completed: true }
    })
    const market = await chrome.bookmarks.create({ parentId: '1', title: '市场' })
    const folder = await chrome.bookmarks.create({ parentId: market.id, title: '卡网' })
    // The intended bookmark is older than every folder-only match.
    const target = await chrome.bookmarks.create({ parentId: folder.id, title, url: 'https://priceai.cc/channels' })
    for (let position = 0; position < 32; position++) {
      await chrome.bookmarks.create({ parentId: folder.id, title: `小铺 ${position} - 链动小铺`, url: `https://shop.invalid/${position}` })
    }
    for (let position = 0; position < 90; position++) {
      await chrome.bookmarks.create({ parentId: '1', title: `Reference ${position}`, url: `https://reference.invalid/${position}` })
    }
    await chrome.bookmarks.create({ parentId: '1', title: 'Visual Studio Code', url: 'https://code.visualstudio.com/' })
    await chrome.bookmarks.create({ parentId: '1', title: 'React Documentation', url: 'https://react.dev/learn' })
    return target.id
  }, targetTitle)
  for (const surface of ['popup', 'sidepanel', 'newtab']) {
    const page = await context.newPage()
    await page.setViewportSize(surface === 'newtab' ? { width: 1280, height: 900 } : { width: 800, height: 640 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`chrome-extension://${extensionId}/src/${surface}/${surface}.html`)
    const popup = surface !== 'newtab'
    const input = page.locator(popup ? '#search-input' : '.newtab-search-input')
    const resultSelector = popup ? '#popup-search-results [role="row"]' : '.newtab-search-suggestion'
    await input.waitFor()
    // Start with initials before any full-pinyin query has triggered enrichment.
    for (const query of ['kw', 'kawang', 'kaw', 'ka wang']) {
      await input.fill(query)
      await page.waitForFunction(({ selector, title }) => document.querySelector(selector)?.textContent.includes(title),
        { selector: resultSelector, title: targetTitle })
      const results = page.locator(resultSelector)
      if (popup) {
        assert.equal(await results.first().getAttribute('id'), `popup-search-result-${targetId}`)
        assert.ok((await results.first().textContent()).includes(query === 'kw' ? '标题首字母' : '标题拼音'))
        assert.ok((await results.nth(1).textContent()).includes(query === 'kw' ? '文件夹首字母' : '文件夹拼音'))
        assert.ok(!(await results.nth(1).textContent()).includes('标题拼音'))
      }
      report.push({ surface, query, first: await results.first().textContent() })
      if (query === 'kawang') {
        await page.screenshot({ path: path.join(output, `${surface}-kawang.png`) })
      }
    }
    for (const [query, title, label] of [
      ['kw 订阅', targetTitle, '标题首字母'],
      ['卡网比价', targetTitle, '标题片段'],
      ['比价卡网', targetTitle, '标题片段'],
      ['kawagn', targetTitle, '标题近似'],
      ['vscode', 'Visual Studio Code', '标题缩写'],
      ['raect doc', 'React Documentation', '标题近似']
    ]) {
      await input.fill(query)
      await page.waitForFunction(({ selector, title }) => document.querySelector(selector)?.textContent.includes(title),
        { selector: resultSelector, title })
      const first = page.locator(resultSelector).first()
      if (popup) assert.ok((await first.textContent()).includes(label), `${surface}: ${query} explains its match`)
      report.push({ surface, query, first: await first.textContent() })
      if (surface === 'popup' && query === '卡网比价') {
        await page.screenshot({ path: path.join(output, 'popup-title-fragments.png') })
      }
    }
    // Rename through the real browser API, then verify the old title pinyin
    // disappears while its unchanged folder remains a lower-priority match.
    if (surface === 'sidepanel') {
      await worker.evaluate(id => chrome.bookmarks.update(id, { title: '星河比价 | PriceAI' }), targetId)
      await input.fill('xinghebijia')
      await page.waitForFunction(() => document.querySelector('#popup-search-results [role="row"]')?.textContent.includes('星河比价'))
      assert.ok((await page.locator(resultSelector).first().textContent()).includes('标题拼音'))
      await input.fill('kawang')
      await page.waitForFunction(({ id }) => {
        const row = document.getElementById(`popup-search-result-${id}`)
        return !row || !row.textContent.includes('标题拼音')
      }, { id: targetId })
      await worker.evaluate(({ id, title }) => chrome.bookmarks.update(id, { title }), { id: targetId, title: targetTitle })
    }
    assert.deepEqual(errors, [], `${surface}: no runtime errors`)
    await page.close()
  }
  await writeFile(path.join(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log('Pinyin, title fragments, abbreviations and typo ranking passed in Popup, Side Panel and New Tab, including a live rename.')
} finally {
  await context?.close()
  const resolved = path.resolve(profile)
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('curator-pinyin-source-')) {
    throw new Error('Unexpected test profile path')
  }
  await rm(resolved, { recursive: true, force: true })
}
