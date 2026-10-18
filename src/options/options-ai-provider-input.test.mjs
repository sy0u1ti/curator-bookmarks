import assert from 'node:assert/strict'



import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const browserChannel = process.env.CURATOR_BROWSER_CHANNEL || 'msedge'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-ai-provider-input-'))
let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    channel: browserChannel,
    headless: process.env.CURATOR_HEADLESS === '1',
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', {
    timeout: 15_000
  })
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#ai-settings`, {
    waitUntil: 'domcontentloaded'
  })

  const apiKeyInput = page.locator('#ai-api-key')
  await apiKeyInput.waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(() => {
    const input = document.querySelector('#ai-api-key')
    return input instanceof HTMLInputElement && !input.disabled
  })

  await apiKeyInput.fill('')
  await apiKeyInput.pressSequentially('sk-live-edit')
  assert.equal(
    await apiKeyInput.inputValue(),
    'sk-live-edit',
    'typing an API Key must not be overwritten by the previous controller state'
  )

  await apiKeyInput.press('End')
  await apiKeyInput.pressSequentially('-updated')
  assert.equal(
    await apiKeyInput.inputValue(),
    'sk-live-edit-updated',
    'editing an existing API Key must preserve the complete new value'
  )

  await apiKeyInput.fill('sk-replaced')
  assert.equal(
    await apiKeyInput.inputValue(),
    'sk-replaced',
    'replacing an API Key must update the controlled input immediately'
  )

  await page.getByRole('button', { name: 'Base URL 与接口选项', exact: true }).click()
  const baseUrlInput = page.locator('#ai-base-url')
  await baseUrlInput.fill('https://openrouter.ai/api/v1')
  assert.equal(
    await apiKeyInput.inputValue(),
    'sk-replaced',
    'editing the provider URL must not clear an API Key entered first'
  )

  console.log('Options AI provider API Key input test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}

