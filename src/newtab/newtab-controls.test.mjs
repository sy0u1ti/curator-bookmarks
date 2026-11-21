import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { readSearchGeometry } from './newtab-search-geometry-scenarios.mjs'
await mkdir('.tmp-test', { recursive: true })
const profile = await mkdtemp(path.resolve('.tmp-test/controls-'))
const output = path.resolve('output/playwright/controls-audit')
await mkdir(output, { recursive: true })
const extension = path.resolve('dist')
const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
  viewport: { width: 1440, height: 1000 }, args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`] })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
context.setDefaultTimeout(12000)
const report = {}
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  await worker.evaluate(() => chrome.storage.local.set({
    curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#111111' },
    curatorBookmarkNewTabTimeSettings: { enabled: true, showSeconds: true }
  }))
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/newtab/newtab.html`)
  const toggle = id => page.locator(`[role="switch"][aria-labelledby="${id}-label"]`).click()
  const query = 'GitHub settings regression'
  await page.waitForFunction(() => performance.getEntriesByName('newtab.searchReady', 'mark').length > 0)
  await page.locator('.newtab-search-input').fill(query)
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  assert.equal(await page.locator('.newtab-clock').count(), 0,
    'Legacy stored time settings must not render a clock widget.')
  assert.equal(await page.locator('#settings-time-title, #time-enabled').count(), 0,
    'Time and date settings must not remain in Appearance.')
  report.clockRemoved = true
  await page.getByRole('tab', { name: '搜索', exact: true }).click()
  await page.getByRole('slider', { name: '搜索栏高度', exact: true }).waitFor()
  assert.equal(await page.locator('.newtab-search-engine, [data-search-engine-toggle]').count(), 0,
    'Web search must respect Chrome settings without an extension provider picker.')
  assert.deepEqual((await page.evaluate(readSearchGeometry)).action, {
    query, clearAvailable: true, canSubmit: true
  }, 'Search settings must preserve both the query and its actions.')
  const searchWidth = page.locator('#search-width-root input[type="range"]')
  await searchWidth.press('Home')
  await page.waitForFunction(() => document.querySelector('#search-width-root input')?.value === '23')
  await page.waitForFunction(() => Math.abs(document.querySelector('.newtab-search').getBoundingClientRect().width - innerWidth * 0.23) < 1)
  const minimumWidth = await page.locator('.newtab-search').evaluate(element => element.getBoundingClientRect().width)
  await searchWidth.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('#search-width-root input')?.value === '24')
  await page.waitForFunction(() => Math.abs(document.querySelector('.newtab-search').getBoundingClientRect().width - innerWidth * 0.24) < 1)
  const nextWidth = await page.locator('.newtab-search').evaluate(element => element.getBoundingClientRect().width)
  assert.ok(nextWidth > minimumWidth + 14, 'Every available slider step must visibly change the search width.')
  await page.waitForFunction(async () => (await chrome.storage.local.get('curatorBookmarkNewTabSearchSettings')).curatorBookmarkNewTabSearchSettings.width === 24)
  await page.setViewportSize({ width: 3218, height: 1000 })
  await page.waitForFunction(() => document.querySelector('#search-width-root input')?.max === '38')
  for (const width of [390, 480, 520]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('#search-width-root').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('#search-width-root').count(), 0, 'Narrow layouts must not offer a width slider with no effect.')
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator('#search-width-root').waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const input = document.querySelector('#search-width-root input')
    return input?.value === '24' && input.min === '23' && input.max === '72'
  })
  assert.equal(await page.evaluate(async () => (await chrome.storage.local.get('curatorBookmarkNewTabSearchSettings')).curatorBookmarkNewTabSearchSettings.width), 24, 'Resizing must preserve the saved desktop preference.')
  report.responsiveWidth = true
  await toggle('search-web-enabled')
  await page.getByRole('combobox', { name: '输入关键词搜索本地书签或命令', exact: true }).waitFor()
  assert.equal(await page.locator('[data-search-engine-toggle]').count(), 0, 'Local-only search has no irrelevant engine controls.')
  assert.equal(await page.locator('.newtab-search-engine, .newtab-search-submit').count(), 0, 'Local-only search has no inactive web buttons.')
  assert.deepEqual((await page.evaluate(readSearchGeometry)).action, {
    query, clearAvailable: true, canSubmit: null
  }, 'Local-only mode must retain the query and its clear action.')
  await toggle('search-enabled')
  await page.locator('input[aria-controls="newtab-search-suggestions"]').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('#search-height-root').count(), 0, 'A disabled module shows only its enable switch.')
  await toggle('search-enabled')
  await page.locator('input[aria-controls="newtab-search-suggestions"]').waitFor()
  report.moduleToggles = true
  await page.keyboard.press('Escape')
  await page.screenshot({ path: path.join(output, 'controls.png'), animations: 'disabled' })
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log('Time formats, Chrome-default web search, retained query actions, responsive width and contextual module controls passed.')
} catch (error) {
  await writeFile(path.join(output, 'failure.txt'), await page.locator('body').ariaSnapshot())
  await page.screenshot({ path: path.join(output, 'failure.png'), animations: 'disabled' })
  throw error
} finally { await context.close(); await rm(profile, { recursive: true, force: true }) }
