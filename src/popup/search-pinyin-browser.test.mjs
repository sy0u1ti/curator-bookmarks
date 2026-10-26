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
  const anyTargetId = await worker.evaluate(async () => {
    const target = await chrome.bookmarks.create({ parentId: '1', title: 'Any Router', url: 'https://anyrouter.top/' })
    await chrome.bookmarks.create({ parentId: '1', title: 'Any牌路由器使用指南!', url: 'https://linux.do/t/topic/1779614' })
    for (let position = 0; position < 25; position++) {
      await chrome.bookmarks.create({ parentId: '1', title: `Any Router guide ${position}`, url: `https://discussion.invalid/${position}` })
    }
    await chrome.bookmarks.create({ parentId: '1', title: '爱你呀', url: 'https://initials.invalid/' })
    await chrome.bookmarks.create({ parentId: '1', title: 'New York', url: 'https://names.invalid/new-york' })
    await chrome.bookmarks.create({ parentId: '1', title: 'York', url: 'https://names.invalid/york' })
    return target.id
  })
  const syllableSeed = await worker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '素材' })
    const sdk = await chrome.bookmarks.create({ parentId: folder.id, title: 'AI SDK', url: 'https://ai-sdk.dev/' })
    const falsePositive = await chrome.bookmarks.create({ parentId: folder.id, title: '素材下载', url: 'https://assets.invalid/' })
    const love = await chrome.bookmarks.create({ parentId: '1', title: '爱好', url: 'https://hobby.invalid/' })
    const titleFolder = await chrome.bookmarks.create({ parentId: '1', title: 'AI API' })
    const quoted = await chrome.bookmarks.create({ parentId: titleFolder.id, title: 'AI 爱好笔记', url: 'https://notes.invalid/' })
    const hobbyFolder = await chrome.bookmarks.create({ parentId: '1', title: '爱好' })
    const multi = await chrome.bookmarks.create({ parentId: hobbyFolder.id, title: 'AI 示例', url: 'https://examples.invalid/' })
    return { sdk: sdk.id, falsePositive: falsePositive.id, love: love.id, quoted: quoted.id, multi: multi.id }
  })
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
        for (const row of [results.first(), results.nth(1)]) {
          assert.doesNotMatch(await row.textContent(), /标题拼音|文件夹拼音|标题首字母|文件夹首字母/)
          assert.ok(await row.locator('mark').count() > 0, `${surface}: ${query} highlights the matching text`)
          assert.ok(Math.abs((await row.boundingBox()).height - 60) <= 1)
        }
      }
      report.push({ surface, query, first: await results.first().textContent() })
      if (query === 'kawang') {
        await page.screenshot({ path: path.join(output, `${surface}-kawang.png`) })
      }
    }
    // Literal title/domain hits remain, while generated syllable tails must
    // neither create results nor introduce highlights in incidental folders.
    for (const query of ['ai', '"ai"', 'cai', 'ai hao']) {
      await input.fill(query)
      await page.waitForFunction(({ selector, query }) => {
        const rows = [...document.querySelectorAll(selector)]
        return query === 'ai hao'
          ? rows.some(row => row.textContent.includes('AI 示例')) && !rows.some(row => row.textContent.includes('AI SDK'))
          : query === 'cai'
            ? rows.some(row => row.textContent.includes('素材下载'))
            : query === 'ai'
              ? rows.some(row => row.textContent.includes('AI SDK')) && rows.some(row => row.textContent.includes('hobby.invalid'))
              : rows.some(row => row.textContent.includes('AI SDK')) && !rows.some(row => row.textContent.includes('hobby.invalid'))
      }, { selector: resultSelector, query })
      const results = page.locator(resultSelector)
      if (query === 'ai hao') {
        if (popup) assert.deepEqual(await page.locator(`#popup-search-result-${syllableSeed.multi} mark`).allTextContents(), ['AI', '好'], 'highlight each term only in its actual matching field')
      } else if (query !== 'cai') {
        assert.equal(await results.filter({ hasText: '素材下载' }).count(), 0, `${surface}: ${query} cannot match cai's tail`)
        if (popup) {
          const sdk = page.locator(`#popup-search-result-${syllableSeed.sdk}`)
          assert.deepEqual((await sdk.locator('mark').allTextContents()).map(text => text.toLowerCase()), ['ai', 'ai'], 'highlight only the actual title and domain matches')
          assert.ok((await sdk.innerText()).includes('素材'), 'the non-matching folder remains visible as metadata')
          const quoted = page.locator(`#popup-search-result-${syllableSeed.quoted}`)
          assert.ok(!(await quoted.locator('mark').allTextContents()).some(text => text.includes('爱')), 'a literal title hit does not invent pinyin highlights')
          if (query === 'ai') {
            assert.deepEqual(await page.locator(`#popup-search-result-${syllableSeed.love} mark`).allTextContents(), ['爱'])
          }
        }
      } else if (popup) {
        assert.ok((await results.filter({ hasText: '素材下载' }).locator('mark').allTextContents()).includes('材'), 'cai highlights its actual syllable')
      }
      report.push({ surface, query, titles: await results.allTextContents() })
      if (surface === 'popup' && query === 'ai') await page.screenshot({ path: path.join(output, 'popup-ai-syllable-boundary.png') })
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
      if (popup) {
        assert.match(await first.getAttribute('aria-description'), new RegExp(label), `${surface}: retain detailed match evidence`)
        assert.ok(!(await first.textContent()).includes(label), `${surface}: ${query} must not repeat a visible title match`)
        assert.ok(await first.locator('mark').count() > 0, `${surface}: ${query} highlights the recovered title`)
      }
      report.push({ surface, query, first: await first.textContent() })
      if (surface === 'popup' && query === '卡网比价') {
        await page.screenshot({ path: path.join(output, 'popup-title-fragments.png') })
      }
    }
    for (const query of ['any', 'ANY', 'ａｎｙ', 'any router', 'router any', '"any"', 'site:anyrouter.top "any"']) {
      await input.fill(query)
      await page.waitForFunction(({ selector }) => document.querySelector(selector)?.textContent.includes('Any Router'),
        { selector: resultSelector })
      const first = page.locator(resultSelector).first()
      if (popup) {
        assert.equal(await first.getAttribute('id'), `popup-search-result-${anyTargetId}`, `${surface}: ${query} prefers the actual site`)
        assert.match(await first.getAttribute('aria-description'), /命中：标题/, `${surface}: retain title evidence without a duplicate badge`)
        assert.match(await first.getAttribute('aria-description'), /命中：站点/, `${surface}: retain hostname evidence without a duplicate badge`)
        assert.ok(!(await first.textContent()).includes('标题命中'), `${surface}: highlighted title needs no extra badge`)
        assert.ok(!(await first.textContent()).includes('域名命中'), `${surface}: highlighted hostname needs no extra badge`)
        if (query.includes('"')) {
          await first.locator('mark').filter({ hasText: /^any$/i }).first().waitFor()
        }
      } else {
        assert.ok((await first.textContent()).includes('anyrouter.top'), 'New Tab shares the same relevance ranking')
      }
      report.push({ surface, query, first: await first.textContent() })
      if (query === 'any') {
        await page.screenshot({ path: path.join(output, `${surface}-any.png`) })
      }
    }
    await input.fill('new york')
    await page.waitForFunction(({ selector }) => document.querySelector(selector)?.textContent.includes('New York'),
      { selector: resultSelector })
    report.push({ surface, query: 'new york', first: await page.locator(resultSelector).first().textContent() })
    await input.fill('"kawang"')
    await page.waitForFunction(({ selector, popup }) =>
      !document.querySelector(selector) && document.body.textContent.includes(popup ? '未找到相关书签' : '未找到书签'),
    { selector: resultSelector, popup })
    report.push({ surface, query: '"kawang"', count: await page.locator(resultSelector).count() })
    // Rename through the real browser API, then verify the old title pinyin
    // disappears while its unchanged folder remains a lower-priority match.
    if (surface === 'sidepanel') {
      await input.fill('any')
      await page.waitForFunction(id => document.querySelector('#popup-search-results [role="row"]')?.id === `popup-search-result-${id}`, anyTargetId)
      await worker.evaluate(id => chrome.bookmarks.update(id, { url: 'https://neutral.invalid/' }), anyTargetId)
      await page.waitForFunction(id => {
        const first = document.querySelector('#popup-search-results [role="row"]')
        return first && first.id !== `popup-search-result-${id}`
      }, anyTargetId)
      await worker.evaluate(id => chrome.bookmarks.update(id, { url: 'https://anyrouter.top/' }), anyTargetId)
      await page.waitForFunction(id => document.querySelector('#popup-search-results [role="row"]')?.id === `popup-search-result-${id}`, anyTargetId)
      await worker.evaluate(id => chrome.bookmarks.update(id, { title: '星河比价 | PriceAI' }), targetId)
      await input.fill('xinghebijia')
      await page.waitForFunction(() => document.querySelector('#popup-search-results [role="row"]')?.textContent.includes('星河比价'))
      assert.ok((await page.locator(resultSelector).first().locator('mark').allTextContents()).join('').includes('星河比价'))
      await input.fill('kawang')
      await page.waitForFunction(({ id }) => {
        const row = document.getElementById(`popup-search-result-${id}`)
        return !row || !row.getAttribute('aria-description')?.includes('标题拼音')
      }, { id: targetId })
      await worker.evaluate(({ id, title }) => chrome.bookmarks.update(id, { title }), { id: targetId, title: targetTitle })
    }
    assert.deepEqual(errors, [], `${surface}: no runtime errors`)
    await page.close()
  }
  await writeFile(path.join(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log('Title/host relevance, literal highlighting, pinyin, title fragments, abbreviations and typo ranking passed in Popup, Side Panel and New Tab, including a live rename.')
} finally {
  await context?.close()
  const resolved = path.resolve(profile)
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('curator-pinyin-source-')) {
    throw new Error('Unexpected test profile path')
  }
  await rm(resolved, { recursive: true, force: true })
}
