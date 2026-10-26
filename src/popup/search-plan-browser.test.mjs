import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('output/search-plan-fixes')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(path.join(output, 'profile-'))
const report = []
let context
const records = [
  { id: '10', title: 'Unrelated resource', url: 'https://neutral.invalid/kaw' },
  { id: '11', title: '卡网订阅', url: 'https://cards.invalid/' },
  { id: '12', title: 'Alpha document', url: 'https://alpha.invalid/' },
  { id: '13', title: 'Beta handbook', url: 'https://beta.invalid/' },
  { id: '14', title: 'React 教程', url: 'https://github.com/react/learn' },
  { id: '15', title: 'React tutorial', url: 'https://github.com/react/tutorial' },
  { id: '16', title: 'React 教程 elsewhere', url: 'https://elsewhere.invalid/react' },
  { id: '17', title: 'Tutorial', url: 'https://cooking.invalid/' },
  { id: '18', title: '过滤器', url: 'https://filter.invalid/' },
  { id: '19', title: 'Glyphs', url: 'https://alphabet.invalid/ascii' },
  { id: '20', title: 'Ｇｌｙｐｈｓ', url: 'https://alphabet.invalid/fullwidth' },
  { id: '21', title: 'Code reference', url: 'https://editor.invalid/reference' },
  { id: '22', title: 'Advanced code', url: 'https://editor.invalid/advanced' },
  { id: '23', title: 'Editor', url: 'https://editor.invalid/' }
]

async function openFixture(surface, semantic = false) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ records, semantic }) => {
    const children = records.map((record, index) => ({ ...record, index, parentId: '1', dateAdded: Date.now() - 1000 }))
    const tree = [{ id: '0', title: '', children: [{ id: '1', parentId: '0', title: 'Library', children }, { id: '2', parentId: '0', title: 'Other bookmarks', children: [] }] }]
    chrome.bookmarks.getTree = callback => { callback?.(tree); return Promise.resolve(tree) }
    window.__openedSearchUrls = []
    chrome.tabs.create = (options, callback) => { window.__openedSearchUrls.push(options.url); callback?.({ id: 123, ...options }); return Promise.resolve({ id: 123, ...options }) }
    window.open = url => { window.__openedSearchUrls.push(url); return null }
    window.close = () => {}
    if (!semantic) return
    chrome.permissions.contains = (_query, callback) => { callback?.(true); return Promise.resolve(true) }
    window.__aiCalls = []
    window.__aiMode = 'success'
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (!String(url).startsWith('http://localhost:11434/')) return originalFetch(input, init)
      window.__aiCalls.push(JSON.parse(init.body))
      if (window.__aiMode === 'error') return new Response(JSON.stringify({ error: { message: 'fixture offline' } }), { status: 401, headers: { 'content-type': 'application/json' } })
      if (window.__aiMode === 'deferred') await new Promise(resolve => { window.__releaseAi = resolve })
      const data = {
        queries: ['tutorial'], keywords: ['tutorial'], excluded_terms: ['react'], date_range: null,
        term_groups: [{ term: '教程', alternatives: ['tutorial', 'guide'] }, { term: 'code', alternatives: ['editor'] }], explanation: '同义表达'
      }
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(data) }, finish_reason: 'stop' }] }), { headers: { 'content-type': 'application/json' } })
    }
  }, { records, semantic })
  await page.goto(`chrome-extension://${extensionId}/src/${surface}/${surface}.html`)
  const input = page.locator(surface === 'newtab' ? '.newtab-search-input' : '#search-input')
  await input.waitFor()
  await page.waitForFunction(surface => performance.getEntriesByName(surface === 'newtab' ? 'newtab.searchReady' : 'popup.searchIndexReady.end').length > 0, surface)
  return { page, input, errors, rows: page.locator(surface === 'newtab' ? '.newtab-search-suggestion' : '#popup-search-results [role="row"]') }
}

let extensionId
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
    args: [`--load-extension=${path.resolve('dist')}`, `--disable-extensions-except=${path.resolve('dist')}`]
  })
  context.setDefaultTimeout(12000)
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  extensionId = new URL(worker.url()).host
  await worker.evaluate(async () => chrome.storage.local.set({
    curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
    curatorBookmarkPopupPreferences: { naturalSearchEnabled: false },
    curatorBookmarkContentSnapshotSettings: { enabled: false, fullTextSearchEnabled: false },
    curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013', maskEnabled: false },
    curatorBookmarkNewTabFolderSettings: { selectedFolderIds: ['1'], browseMode: 'navigation' },
    curatorBookmarkNewTabSearchSettings: { enabled: true, naturalSearchEnabled: false, webSearchEnabled: false, autoVerticalCenter: false, openInNewTab: true },
    curatorBookmarkOnboardingState: { completed: true }
  }))
  for (const surface of ['popup', 'sidepanel']) {
    const { page, input, rows, errors } = await openFixture(surface)
    await input.evaluate(element => {
      element.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, 'kaw')
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    })
    await page.waitForFunction(() => window.__openedSearchUrls.length > 0)
    assert.deepEqual(await page.evaluate(() => window.__openedSearchUrls), ['https://cards.invalid/'])
    await input.fill('过滤器')
    await rows.first().filter({ hasText: '过滤器' }).waitFor()
    assert.equal(await rows.count(), 1)
    assert.deepEqual(errors, [])
    report.push({ surface, coldPinyinEnter: 'correct target', ordinaryName: '过滤器' })
    await page.close()
  }

  const { page, input, rows, errors } = await openFixture('newtab')
  await input.fill('Alpha document')
  await rows.first().filter({ hasText: 'Alpha document' }).waitFor()
  await input.press('ArrowDown')
  await input.evaluate(element => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, 'Beta handbook')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  })
  await rows.first().filter({ hasText: 'Beta handbook' }).waitFor()
  assert.deepEqual(await page.evaluate(() => window.__openedSearchUrls), [])
  await input.press('ArrowDown')
  await input.press('Enter')
  assert.deepEqual(await page.evaluate(() => window.__openedSearchUrls), ['https://beta.invalid/'])

  await input.fill('Alpha document')
  await rows.first().filter({ hasText: 'Alpha document' }).waitFor()
  await input.evaluate(element => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, 'Beta handbook')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(250)
  assert.equal(await input.getAttribute('aria-expanded'), 'false', 'Esc keeps late suggestions closed')
  assert.equal(await page.locator('.newtab-search-shell').getAttribute('data-panel-open'), 'false')
  assert.equal(await page.evaluate(() => {
    const panel = document.querySelector('#newtab-search-suggestions-panel')
    return !panel || panel.inert
  }), true, 'closed suggestions are unmounted or inert during their exit')
  for (const [query, title] of [['"glyphs"', 'Glyphs'], ['"ｇｌｙｐｈｓ"', 'Ｇｌｙｐｈｓ'], ['"glyphs"', 'Glyphs']]) {
    await input.fill(query)
    await rows.first().filter({ hasText: title }).waitFor()
    assert.equal(await rows.count(), 1, 'literal queries must not share compatibility-normalized cached results')
  }
  assert.deepEqual(errors, [])
  report.push({ surface: 'newtab', staleSelection: 'cleared', escape: 'pending results discarded', literalCache: 'fullwidth and ASCII stay distinct' })
  await page.close()

  await worker.evaluate(async () => chrome.storage.local.set({
    curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false, baseUrl: 'http://localhost:11434/v1', model: 'fixture', apiKey: '', apiStyle: 'chat_completions', timeoutMs: 5000 },
    curatorBookmarkPopupPreferences: { naturalSearchEnabled: true },
    curatorBookmarkNewTabSearchSettings: { enabled: true, naturalSearchEnabled: true, webSearchEnabled: false, autoVerticalCenter: false, openInNewTab: true }
  }))
  const semanticResults = []
  for (const surface of ['popup', 'newtab']) {
    const { page, input, rows, errors } = await openFixture(surface, true)
    await input.fill('site:github.com react 教程')
    await page.waitForFunction(() => window.__aiCalls.length > 0)
    await rows.filter({ hasText: 'React tutorial' }).first().waitFor()
    const values = await rows.allTextContents()
    assert.equal(values.length, 2)
    assert.ok(values.every(value => value.includes('github.com')))
    if (surface === 'popup') assert.ok(values.every(value => !value.includes('网址命中')))
    else assert.ok(!(await page.locator('.newtab-search-hint').innerText()).includes('Ctrl+Enter'), 'disabled web search has no web shortcut hint')
    semanticResults.push(values.map(value => value.includes('React tutorial') ? 'tutorial' : 'original'))
    await page.screenshot({ path: path.join(output, `${surface}-semantic.png`) })
    for (const [query, title, cached] of [['"glyphs"', 'Glyphs', false], ['"ｇｌｙｐｈｓ"', 'Ｇｌｙｐｈｓ', false], ['"glyphs"', 'Glyphs', true]]) {
      const calls = await page.evaluate(() => window.__aiCalls.length)
      await input.fill(query)
      if (!cached) await page.waitForFunction(calls => window.__aiCalls.length > calls, calls)
      await rows.first().filter({ hasText: title }).waitFor()
      assert.equal(await rows.count(), 1, `${surface}: semantic literal plans retain distinct character forms`)
    }
    if (surface === 'newtab') {
      await page.evaluate(() => { window.__aiMode = 'deferred' })
      await input.fill('code')
      await rows.first().filter({ hasText: 'Code reference' }).waitFor()
      await page.waitForFunction(() => typeof window.__releaseAi === 'function')
      await input.press('ArrowDown')
      await input.press('ArrowDown')
      await page.evaluate(() => { window.__aiMode = 'success'; window.__releaseAi(); delete window.__releaseAi })
      await rows.first().filter({ hasText: 'Editor' }).waitFor()
      assert.ok((await page.evaluate(() => {
        const id = document.querySelector('.newtab-search-input').getAttribute('aria-activedescendant')
        return document.getElementById(id)?.textContent || ''
      })).includes('Advanced code'), 'AI reordering preserves the selected bookmark ID')
      await input.press('Enter')
      assert.deepEqual(await page.evaluate(() => window.__openedSearchUrls), ['https://editor.invalid/advanced'])

      await page.evaluate(() => { window.__aiMode = 'deferred' })
      await input.fill('Alpha')
      await page.waitForFunction(() => typeof window.__releaseAi === 'function')
      await input.press('Escape')
      await page.evaluate(() => { window.__aiMode = 'success'; window.__releaseAi(); delete window.__releaseAi })
      await page.waitForTimeout(250)
      assert.equal(await input.getAttribute('aria-expanded'), 'false', 'Esc also discards an in-flight AI response')
    }
    await page.evaluate(() => { window.__aiMode = 'error' })
    await input.fill('"react"')
    await page.waitForFunction(() => [...document.querySelectorAll('[title]')].some(element => element.getAttribute('title')?.includes('fixture offline')))
    assert.ok(await rows.count(), 'AI errors retain local matches')
    assert.ok((await rows.allTextContents()).every(value => value.includes('React')))
    assert.deepEqual(errors, [])
    report.push({ surface, hardFilters: 'preserved', failureFallback: 'local results' })
    await page.close()
  }
  assert.deepEqual(semanticResults[0], semanticResults[1], 'surfaces share final ranking')

  await worker.evaluate(async () => chrome.storage.local.set({ curatorBookmarkPopupPreferences: { naturalSearchEnabled: false }, curatorBookmarkNewTabSearchSettings: { enabled: true, naturalSearchEnabled: false, webSearchEnabled: false, autoVerticalCenter: false } }))
  const bookmark = await worker.evaluate(async () => {
    const bookmark = await chrome.bookmarks.create({ parentId: '1', title: 'Development', url: 'https://old.invalid/' })
    const now = Date.now()
    await chrome.storage.local.set({
      curatorBookmarkTagIndex: { version: 1, updatedAt: now, records: { [bookmark.id]: { bookmarkId: bookmark.id, url: bookmark.url, aliases: ['oldframework'], updatedAt: now } } },
      curatorBookmarkContentSnapshotIndex: { version: 1, updatedAt: now, records: { [bookmark.id]: { bookmarkId: bookmark.id, snapshotId: 'old-body', url: bookmark.url, summary: 'oldpagecontext', fullTextStorage: 'none' } } }
    })
    return bookmark
  })
  for (const surface of ['sidepanel', 'newtab']) {
    await worker.evaluate(id => chrome.bookmarks.update(id, { title: 'Development', url: 'https://old.invalid/' }), bookmark.id)
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/src/${surface}/${surface}.html`)
    const input = page.locator(surface === 'newtab' ? '.newtab-search-input' : '#search-input')
    const rows = page.locator(surface === 'newtab' ? '.newtab-search-suggestion' : '#popup-search-results [role="row"]')
    await input.fill('oldframework')
    await rows.first().waitFor()
    await worker.evaluate(id => chrome.bookmarks.update(id, { title: 'Cooking', url: 'https://recipes.invalid/' }), bookmark.id)
    await input.fill('Cooking')
    await rows.first().filter({ hasText: 'Cooking' }).waitFor()
    for (const query of ['oldframework', 'oldpagecontext']) {
      await input.fill(query)
      await page.waitForFunction(surface => document.body.innerText.includes(surface === 'newtab' ? '未找到本地书签' : '未找到'), surface)
      assert.equal(await rows.count(), 0)
    }
    report.push({ surface, changedUrl: 'old content excluded' })
    await page.close()
  }
  await writeFile(path.join(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
} finally {
  await context?.close()
  assert.equal(path.dirname(profile), output)
  await rm(profile, { recursive: true, force: true })
}
