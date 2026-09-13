import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

// Reproduce new popup assets being read by an extension with the old manifest
// still loaded. Do not edit the user's Chrome profile or the production build.
const temporary = await mkdtemp(path.join(tmpdir(), 'curator-sidebar-entry-'))
const extensionPath = path.join(temporary, 'extension')
const output = path.resolve('output/playwright/sidebar-entry')
await mkdir(output, { recursive: true })
await cp(path.resolve('dist'), extensionPath, { recursive: true })
const manifestPath = path.join(extensionPath, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.permissions = manifest.permissions.filter(permission => permission !== 'sidePanel')
delete manifest.side_panel
await writeFile(manifestPath, JSON.stringify(manifest))
let context
try {
  context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
    channel: 'chromium', headless: true, viewport: { width: 800, height: 600 },
    args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
  })
  context.setDefaultTimeout(10000)
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const id = new URL(worker.url()).host
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`chrome-extension://${id}/src/popup/popup.html`)
  assert.equal(await page.evaluate(() => typeof chrome.sidePanel?.open), 'undefined', 'reproduce the actual unavailable API')
  const trigger = page.getByRole('button', { name: '打开常驻书签侧栏', exact: true })
  await trigger.waitFor()
  assert.equal(await trigger.isEnabled(), true, 'a missing permission must not create a silent disabled button')
  await trigger.click()
  const alert = page.getByRole('alert').filter({ hasText: '侧栏的新配置尚未生效' })
  await alert.waitFor()
  assert.match(await alert.innerText(), /重新加载/)
  assert.equal(await trigger.isEnabled(), true, 'failure must leave the action retryable')
  await page.screenshot({ path: path.join(output, 'reload-required.png') })
  await alert.getByRole('button', { name: '关闭', exact: true }).click()
  await trigger.click()
  await alert.waitFor()
  const opened = context.waitForEvent('page')
  await alert.getByRole('button', { name: '打开扩展管理', exact: true }).click()
  const manager = await opened
  await manager.waitForURL(`chrome://extensions/?id=${id}`)
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ legacyManifestReproduced: true, actionableError: true, retryable: true, opensOwnExtensionManagement: true }, null, 2))
  console.log('Sidebar entry: stale manifest gives reload guidance and remains clickable; extension management opens correctly.')
} finally {
  await context?.close()
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()))
  await rm(temporary, { recursive: true, force: true })
}
