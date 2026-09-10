import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve(process.env.CURATOR_TEST_EXTENSION_PATH || 'dist')
const profileParent = path.resolve(tmpdir())
const profilePath = await mkdtemp(path.join(profileParent, 'curator-panel-loading-'))
let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    channel: 'chromium',
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#history`)
  await page.locator('section#history').waitFor({ state: 'visible' })
  await page.evaluate(() => {
    window.__taskPanelLoadingCount = 0
    window.__taskPanelObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.matches('output') && node.textContent.includes('正在载入')) {
            window.__taskPanelLoadingCount++
          }
        }
      }
    })
    window.__taskPanelObserver.observe(document.querySelector('#options-main'), { childList: true })
  })
  for (const section of ['backup', 'redirects', 'duplicates', 'folder-cleanup', 'ignore', 'recycle', 'history']) {
    await page.locator(`a[data-options-section="${section}"]`).first().evaluate((link) => link.click())
    await page.locator(`section#${section}`).waitFor({ state: 'visible' })
    assert.equal(await page.locator('#options-main > section:visible').count(), 1)
    assert.equal(await page.evaluate(() => window.location.hash), `#${section}`)
  }
  const loadingCount = await page.evaluate(() => {
    window.__taskPanelObserver.disconnect()
    return window.__taskPanelLoadingCount
  })
  assert.equal(loadingCount, 0, 'Panels whose shared module has loaded must not show the loading fallback again')
  assert.deepEqual(errors, [])
  console.log('Options shared panel loading regression passed.')
} finally {
  await context?.close()
  assert.ok(profilePath.startsWith(profileParent + path.sep))
  await rm(profilePath, { recursive: true, force: true })
}
