import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
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
const report = { timeZones: [], dates: [], engines: [] }
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  await worker.evaluate(() => chrome.storage.local.set({ curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#111111' } }))
  await page.clock.setFixedTime(new Date('2026-10-06T15:24:35Z'))
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/newtab/newtab.html`)
  const select = async (name, value) => {
    await page.getByRole('combobox', { name, exact: true }).click()
    await page.getByRole('option', { name: value, exact: true }).click()
  }
  const toggle = id => page.locator(`[role="switch"][aria-labelledby="${id}-label"]`).click()
  await page.getByRole('button', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '外观', exact: true }).click()
  for (const [zone, expected] of [['UTC','15:24'],['北京','23:24'],['香港','23:24'],['东京','00:24'],['新加坡','23:24'],['伦敦','16:24'],['巴黎','17:24'],['纽约','11:24'],['洛杉矶','08:24']]) {
    await select('时区', zone)
    await page.waitForFunction(expected => document.querySelector('.newtab-clock [data-clock-time]')?.textContent === expected, expected)
    report.timeZones.push({ zone, expected })
  }
  await select('时区', 'UTC')
  for (const [format, expected] of [['2026.05.01 周五','2026.10.06 周二'],['2026年5月1日 周五','2026年10月6日 周二'],['05.01 周五','10.06 周二'],['周五 05/01','周二 10/06'],['周五 01/05','周二 06/10'],['2026.05.01','2026.10.06']]) {
    await select('日期格式', format)
    await page.waitForFunction(expected => document.querySelector('.newtab-clock [data-clock-date]')?.textContent === expected, expected)
    report.dates.push(expected)
  }
  await toggle('time-show-seconds')
  await page.waitForFunction(() => document.querySelector('.newtab-clock [data-clock-time]')?.textContent === '15:24:35')
  await toggle('time-hour12')
  await page.waitForFunction(() => document.querySelector('.newtab-clock [data-clock-time]')?.textContent === '03:24:35' && document.querySelector('.newtab-clock [data-clock-period]')?.textContent === 'PM')
  await toggle('time-enabled')
  // Hiding the clock is an async React commit; assert on the settled state
  // instead of racing it with a zero-wait visibility check.
  await page.locator('.newtab-clock').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.newtab-clock').isVisible(), false)
  await toggle('time-enabled')
  await page.locator('.newtab-clock').waitFor()
  report.secondsAndPeriod = true
  await page.getByRole('tab', { name: '搜索', exact: true }).click()
  for (const [id, label] of [['google','Google'],['bing','Bing'],['baidu','百度'],['duckduckgo','DuckDuckGo'],['perplexity','Perplexity'],['chatgpt','ChatGPT'],['you','You.com'],['kagi','Kagi'],['brave','Brave']]) {
    await select('默认搜索引擎', label)
    await page.waitForFunction(label => document.querySelector('[aria-label^="选择搜索引擎，当前为"]')?.getAttribute('aria-label') === `选择搜索引擎，当前为 ${label}`, label)
    assert.equal(await page.locator(`[data-search-engine-toggle="${id}"][role="switch"]`).isDisabled(), true)
    report.engines.push(label)
  }
  await toggle('search-web-enabled')
  await page.getByRole('combobox', { name: '输入关键词搜索本地书签或命令', exact: true }).waitFor()
  await toggle('search-enabled')
  await page.locator('input[aria-controls="newtab-search-suggestions"]').waitFor({ state: 'hidden' })
  await toggle('search-enabled')
  await page.locator('input[aria-controls="newtab-search-suggestions"]').waitFor()
  report.moduleToggles = true
  await page.keyboard.press('Escape')
  await page.screenshot({ path: path.join(output, 'controls.png'), animations: 'disabled' })
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log('Time zones, date formats, seconds, AM/PM, nine search engines and module visibility passed.')
} catch (error) {
  await writeFile(path.join(output, 'failure.txt'), await page.locator('body').ariaSnapshot())
  await page.screenshot({ path: path.join(output, 'failure.png'), animations: 'disabled' })
  throw error
} finally { await context.close(); await rm(profile, { recursive: true, force: true }) }
