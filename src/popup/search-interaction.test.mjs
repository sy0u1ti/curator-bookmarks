import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { createSearchBenchmarkRecords } from './search-benchmark-fixture.mjs'

const profile = await mkdtemp(path.join(tmpdir(), 'curator-search-interaction-'))
const records = createSearchBenchmarkRecords(10000)
const report = { count: records.length, surfaces: [], coldActivation: [] }
let context
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
    args: [`--load-extension=${path.resolve('dist')}`, `--disable-extensions-except=${path.resolve('dist')}`]
  })
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  await worker.evaluate(async () => chrome.storage.local.set({
    curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
    curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013', maskEnabled: false },
    curatorBookmarkNewTabFolderSettings: { selectedFolderIds: ['1'], browseMode: 'navigation' },
    curatorBookmarkOnboardingState: { completed: true }
  }))
  for (const surface of ['popup', 'newtab']) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ records, surface }) => {
      const children = records.map((record, index) => ({ id: String(index + 10), parentId: '1', index, title: record.title, url: record.url, dateAdded: record.dateAdded }))
      const tree = [{ id: '0', title: '', children: [
        { id: '1', parentId: '0', title: 'Bookmarks bar', children },
        { id: '2', parentId: '0', title: 'Other bookmarks', children: [] }
      ] }]
      chrome.bookmarks.getTree = callback => { callback?.(tree); return Promise.resolve(tree) }
      const inputSelector = surface === 'popup' ? '#search-input' : '.newtab-search-input'
      const resultSelector = surface === 'popup' ? '#popup-search-results [role="row"]' : '.newtab-search-suggestion'
      window.__searchSamples = []
      document.addEventListener('input', event => {
        if (!event.target.matches(inputSelector)) return
        window.__searchSample = { query: event.target.value, started: performance.now() }
      }, true)
      new MutationObserver(() => {
        const sample = window.__searchSample
        if (!sample || sample.domMs !== undefined || !sample.query) return
        const first = document.querySelector(resultSelector)
        if (!first?.textContent?.toLowerCase().includes(sample.query.toLowerCase())) return
        sample.domMs = performance.now() - sample.started
        requestAnimationFrame(() => {
          sample.nextFrameMs = performance.now() - sample.started
          window.__searchSamples.push(sample)
        })
      }).observe(document, { childList: true, subtree: true, characterData: true })
    }, { records, surface })
    await page.goto(`chrome-extension://${extensionId}/src/${surface}/${surface}.html`)
    const input = page.locator(surface === 'popup' ? '#search-input' : '.newtab-search-input')
    await input.waitFor()
    await page.waitForFunction(surface => performance.getEntriesByName(surface === 'popup' ? 'popup.searchIndexReady.end' : 'newtab.searchReady').length > 0, surface)
    const queryAt = position => records[position].title
    await input.fill(queryAt(56))
    await page.waitForFunction(() => window.__searchSamples.length === 1).catch(async error => {
      console.log(surface, await page.evaluate(() => ({ sample: window.__searchSample, results: document.querySelector('#popup-search-results')?.textContent, suggestions: document.querySelector('.newtab-search-suggestion')?.textContent })))
      throw error
    })
    // Keep cold startup separate from a settled page with its idle indexes.
    await page.waitForTimeout(2500)
    for (let run = 0; run < 30; run++) {
      await input.fill(queryAt(73 + run * 113))
      await page.waitForFunction(length => window.__searchSamples.length === length, run + 2)
    }
    const samples = await page.evaluate(() => window.__searchSamples)
    const sorted = key => samples.slice(1).map(sample => sample[key]).sort((a, b) => a - b)
    report.surfaces.push({
      surface, cold: samples[0],
      warm: { domP50: sorted('domMs')[14], domP95: sorted('domMs')[28], nextFrameP50: sorted('nextFrameMs')[14], nextFrameP95: sorted('nextFrameMs')[28] },
      samples
    })
    // A burst must leave only the latest result; focus and navigation survive.
    await input.fill(queryAt(73))
    await input.fill(queryAt(186))
    await input.fill(queryAt(299))
    const results = page.locator(surface === 'popup' ? '#popup-search-results [role="row"]' : '.newtab-search-suggestion')
    await results.first().filter({ hasText: queryAt(299) }).waitFor()
    await input.press('ArrowDown')
    assert.equal(await input.evaluate(element => document.activeElement === element), true, `${surface}: search keeps keyboard focus`)
    assert.deepEqual(errors, [])
    await page.close()
  }
  const coldCases = [
    { kind: 'exact-title', query: 'reference manual', title: 'Reference Manual', url: 'https://example.invalid/late-exact' },
    { kind: 'title-host', query: 'any', title: 'Any Router', url: 'https://anyrouter.top/' }
  ]
  for (const { surface, ...activation } of coldCases.flatMap(scenario =>
    ['popup', 'sidepanel'].map(surface => ({ surface, ...scenario })))) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ title, url }) => {
      // Keep the acceleration index cold so Enter arrives during the first
      // batch, rather than accidentally testing an already warmed fast path.
      window.requestIdleCallback = () => 1
      window.cancelIdleCallback = () => {}
      const children = Array.from({ length: 9000 }, (_, index) => ({
        id: String(index + 10), parentId: '1', index, dateAdded: 2 + index,
        title: `${title} supplemental ${index}`, url: `https://example.invalid/early-${index}`
      }))
      children.push({
        id: '9010', parentId: '1', index: 9000, dateAdded: 1,
        title, url
      })
      const tree = [{ id: '0', title: '', children: [
        { id: '1', parentId: '0', title: 'Bookmarks bar', children },
        { id: '2', parentId: '0', title: 'Other bookmarks', children: [] }
      ] }]
      chrome.bookmarks.getTree = callback => { callback?.(tree); return Promise.resolve(tree) }
      window.__openedSearchUrls = []
      chrome.tabs.create = (options, callback) => {
        window.__openedSearchUrls.push(options.url)
        const tab = { id: 123, ...options }
        callback?.(tab)
        return Promise.resolve(tab)
      }
      window.close = () => {}
    }, activation)
    await page.goto(`chrome-extension://${extensionId}/src/${surface}/${surface}.html`)
    const input = page.locator('#search-input')
    await input.waitFor()
    await page.waitForFunction(() => performance.getEntriesByName('popup.searchIndexReady.end').length > 0)
    await input.evaluate((element, query) => {
      element.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, query)
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    }, activation.query)
    await page.waitForFunction(() => window.__openedSearchUrls.length > 0)
    const opened = await page.evaluate(() => window.__openedSearchUrls)
    assert.deepEqual(opened, [activation.url], `${surface}: fast Enter waits for the tail's ${activation.kind} evidence`)
    assert.deepEqual(errors, [], `${surface}: cold activation has no runtime errors`)
    report.coldActivation.push({ surface, kind: activation.kind, count: 9001, opened })
    await page.close()
  }
  await mkdir('output/search-benchmark', { recursive: true })
  await writeFile('output/search-benchmark/interaction.json', `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report.surfaces.map(({ surface, cold, warm }) => ({ surface, cold, warm })), null, 2))
  console.log('Cold first-batch Enter opens the final exact title or corroborated hostname in Popup and Side Panel.')
} finally {
  await context?.close()
  const resolved = path.resolve(profile)
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('curator-search-interaction-')) throw new Error('Unexpected test profile path')
  await rm(resolved, { recursive: true, force: true })
}
