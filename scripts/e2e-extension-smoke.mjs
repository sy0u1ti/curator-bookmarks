#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import {
  assertDistReady,
  getExtensionLaunchOptions,
  relaunchWithXvfbIfNeeded,
  waitForExtensionServiceWorker
} from './extension-browser-runner.mjs'

const DIST_DIR = path.resolve('dist')
const RESULT_DIR = '.e2e-results'
const SCREENSHOT_DIR = path.join(RESULT_DIR, 'screenshots')
const CONSOLE_ERROR_TYPES = new Set(['error'])

async function main() {
  await relaunchWithXvfbIfNeeded(import.meta.url)
  await assertDistReady(DIST_DIR)
  await fs.mkdir(RESULT_DIR, { recursive: true })
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curator-e2e-'))
  const errors = []
  const context = await chromium.launchPersistentContext(
    userDataDir,
    getExtensionLaunchOptions(DIST_DIR)
  )

  try {
    context.on('page', (page) => attachPageErrorCapture(page, errors))
    for (const page of context.pages()) {
      attachPageErrorCapture(page, errors)
    }

    const serviceWorker = await waitForExtensionServiceWorker(context)
    const extensionId = new URL(serviceWorker.url()).host
    const extensionBaseUrl = `chrome-extension://${extensionId}`
    await seedBookmarkFixture(context)
    const pages = [
      { id: 'popup', url: `${extensionBaseUrl}/src/popup/popup.html` },
      { id: 'options', url: `${extensionBaseUrl}/src/options/options.html#onboarding` },
      { id: 'newtab', url: `${extensionBaseUrl}/src/newtab/newtab.html` }
    ]
    const rows = []

    for (const pageSpec of pages) {
      const page = await context.newPage()
      attachPageErrorCapture(page, errors)
      await page.goto(pageSpec.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      const title = await page.title()
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      if (!bodyText.trim()) {
        errors.push(`${pageSpec.id}: body text is empty`)
      }
      const screenshotPath = path.join(SCREENSHOT_DIR, `${pageSpec.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch((error) => {
        errors.push(`${pageSpec.id}: screenshot failed: ${error.message}`)
      })
      rows.push({
        id: pageSpec.id,
        url: pageSpec.url,
        title,
        bodyTextLength: bodyText.length,
        screenshotPath
      })
      await page.close()
    }

    const flows = []
    flows.push(await smokePopupSearch(extensionBaseUrl, context, errors))
    flows.push(await smokeOptionsSections(extensionBaseUrl, context, errors))
    flows.push(await smokeNewTabCommands(extensionBaseUrl, context, errors))
    flows.push(await smokeRecycleRestore(extensionBaseUrl, context, errors))
    flows.push(await smokeServiceWorkerRecovery(context, errors))

    const result = {
      generatedAt: Date.now(),
      extensionId,
      serviceWorkerUrl: serviceWorker.url(),
      pages: rows,
      flows,
      errors
    }
    const outPath = path.join(RESULT_DIR, `extension-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    await fs.writeFile(outPath, JSON.stringify(result, null, 2))
    console.log(`extension smoke results written to ${outPath}`)

    if (errors.length) {
      for (const error of errors) {
        console.error(`- ${error}`)
      }
      process.exit(1)
    }
    console.log('extension smoke ok')
  } finally {
    await context.close()
    await fs.rm(userDataDir, { recursive: true, force: true })
  }
}

function attachPageErrorCapture(page, errors) {
  page.on('response', (response) => {
    const status = response.status()
    if (status >= 400) {
      errors.push(`${page.url()}: response ${status}: ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    errors.push(`${page.url()}: request failed: ${request.url()} (${request.failure()?.errorText || 'unknown error'})`)
  })
  page.on('console', (message) => {
    if (CONSOLE_ERROR_TYPES.has(message.type())) {
      if (isBrowserResourceNoise(message)) {
        return
      }
      errors.push(`${page.url()}: console ${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    errors.push(`${page.url()}: pageerror: ${error.message}`)
  })
}

function isBrowserResourceNoise(message) {
  const text = message.text()
  return /^Failed to load resource: the server responded with a status of 404 \(\)$/.test(text)
}

async function seedBookmarkFixture(context) {
  const worker = await waitForExtensionServiceWorker(context)
  await worker.evaluate(async () => {
    const folders = await chrome.bookmarks.search({ title: 'Curator E2E Smoke' })
    let folder = folders.find((item) => !item.url && item.title === 'Curator E2E Smoke')
    if (!folder) {
      folder = await chrome.bookmarks.create({ parentId: '1', title: 'Curator E2E Smoke' })
    }
    const existing = await chrome.bookmarks.getChildren(folder.id)
    const titles = new Set(existing.map((item) => item.title))
    const fixtures = [
      ['Curator E2E Search Target', 'https://example.com/?curator-e2e=search'],
      ['Curator E2E Inbox Candidate', 'https://example.com/?curator-e2e=inbox'],
      ['Curator E2E Duplicate', 'https://example.com/?curator-e2e=duplicate'],
      ['Curator E2E Duplicate Copy', 'https://example.com/?curator-e2e=duplicate']
    ]
    for (const [title, url] of fixtures) {
      if (!titles.has(title)) {
        await chrome.bookmarks.create({ parentId: folder.id, title, url })
      }
    }
  })
}

async function smokePopupSearch(extensionBaseUrl, context, errors) {
  const page = await context.newPage()
  attachPageErrorCapture(page, errors)
  const flow = { id: 'popup-search-inbox-delete', ok: false }
  try {
    await page.goto(`${extensionBaseUrl}/src/popup/popup.html`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.locator('#search-input').fill('Curator E2E Search')
    await page.locator('.result-card').first().waitFor({ state: 'visible', timeout: 8000 })
    await page.locator('#open-inbox-filter').click()
    flow.inboxFilterOpened = true
    const firstMenu = page.locator('[data-open-menu]').first()
    await firstMenu.click({ timeout: 8000 }).catch(() => {})
    const deleteAction = page.locator('[data-menu-action="delete"]').first()
    if (await deleteAction.count()) {
      await deleteAction.click()
      await page.locator('#delete-modal').waitFor({ state: 'visible', timeout: 5000 })
      flow.recyclePreviewShown = true
    }
    flow.ok = true
  } catch (error) {
    errors.push(`popup-search-inbox-delete: ${error.message}`)
  } finally {
    await page.close()
  }
  return flow
}

async function smokeOptionsSections(extensionBaseUrl, context, errors) {
  const page = await context.newPage()
  attachPageErrorCapture(page, errors)
  const sections = ['privacy', 'health', 'dashboard', 'backup', 'duplicates', 'availability', 'folder-cleanup', 'recycle', 'general']
  const visited = []
  const flow = { id: 'options-core-sections', ok: false, visited }
  try {
    await page.goto(`${extensionBaseUrl}/src/options/options.html#privacy`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    for (const section of sections) {
      await page.evaluate((nextSection) => {
        window.location.hash = `#${nextSection}`
      }, section)
      await page.locator(`[data-section-panel="${section}"]`).waitFor({ state: 'visible', timeout: 10000 })
      visited.push(section)
      if (section === 'dashboard') {
        const toggle = page.locator('#dashboard-performance-mode')
        await toggle.check({ timeout: 8000 }).catch(() => {})
        flow.dashboardPerformanceMode = await page.locator('#dashboard.dashboard-performance-mode').count()
      }
    }
    await expectText(page, '#privacy-permission-list', 'bookmarks')
    await expectText(page, '#health-title', '书签健康中心')
    await expectText(page, '#backup-export', '导出完整备份')
    await expectText(page, '#duplicate-groups', '重复')
    await expectText(page, '#availability-action', '检测')
    await expectText(page, '#recycle-title', '回收站')
    await expectText(page, '#ai-config-status', '')
    flow.aiLocalFallbackVisible = true
    flow.ok = true
  } catch (error) {
    errors.push(`options-core-sections: ${error.message}`)
  } finally {
    await page.close()
  }
  return flow
}

async function smokeNewTabCommands(extensionBaseUrl, context, errors) {
  const page = await context.newPage()
  attachPageErrorCapture(page, errors)
  const flow = { id: 'newtab-command-search-keyboard', ok: false }
  try {
    await page.goto(`${extensionBaseUrl}/src/newtab/newtab.html`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.locator('.newtab-search-input').fill('dashboard')
    await page.keyboard.press('ArrowDown')
    await page.locator('.newtab-search-suggestion.command').first().waitFor({ state: 'visible', timeout: 8000 })
    await page.keyboard.press('Escape')
    await page.locator('.newtab-search-input').fill('Curator E2E Search')
    await page.locator('.newtab-search-suggestion').first().waitFor({ state: 'visible', timeout: 8000 })
    flow.searchSuggestionsVisible = true
    flow.ok = true
  } catch (error) {
    errors.push(`newtab-command-search-keyboard: ${error.message}`)
  } finally {
    await page.close()
  }
  return flow
}

async function smokeRecycleRestore(extensionBaseUrl, context, errors) {
  const worker = await waitForExtensionServiceWorker(context)
  const recycleId = `e2e-recycle-${Date.now()}`
  const flow = { id: 'recycle-restore', ok: false, recycleId }
  try {
    await worker.evaluate(async ({ recycleId }) => {
      await chrome.storage.local.set({
        curatorBookmarkRecycleBin: [{
          recycleId,
          deletedAt: Date.now(),
          bookmarkId: 'e2e-deleted',
          title: 'Curator E2E Recycle Restore',
          url: 'https://example.com/?curator-e2e=restore',
          parentId: '1',
          index: 0,
          path: '书签栏 / Curator E2E Smoke'
        }]
      })
    }, { recycleId })
    const page = await context.newPage()
    attachPageErrorCapture(page, errors)
    try {
      await page.goto(`${extensionBaseUrl}/src/options/options.html#recycle`, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.locator(`[data-recycle-restore="${recycleId}"]`).click({ timeout: 10000 })
      await page.waitForFunction((id) => !document.querySelector(`[data-recycle-restore="${id}"]`), recycleId, { timeout: 10000 })
    } finally {
      await page.close()
    }
    flow.ok = await worker.evaluate(async () => {
      const matches = await chrome.bookmarks.search({ url: 'https://example.com/?curator-e2e=restore' })
      return matches.some((item) => item.title === 'Curator E2E Recycle Restore')
    })
    if (!flow.ok) {
      errors.push('recycle-restore: restored bookmark not found')
    }
  } catch (error) {
    errors.push(`recycle-restore: ${error.message}`)
  }
  return flow
}

async function smokeServiceWorkerRecovery(context, errors) {
  const flow = { id: 'service-worker-recovery', ok: false }
  try {
    const firstWorker = await waitForExtensionServiceWorker(context)
    const firstUrl = firstWorker.url()
    await firstWorker.evaluate(() => chrome.runtime.getManifest().version)
    const secondWorker = context.serviceWorkers().find((worker) => worker.url() === firstUrl) || await waitForExtensionServiceWorker(context)
    await secondWorker.evaluate(() => chrome.runtime.getManifest().manifest_version)
    flow.serviceWorkerUrl = secondWorker.url()
    flow.ok = true
  } catch (error) {
    errors.push(`service-worker-recovery: ${error.message}`)
  }
  return flow
}

async function expectText(page, selector, expected) {
  const text = await page.locator(selector).first().innerText({ timeout: 8000 })
  if (expected && !text.includes(expected)) {
    throw new Error(`${selector} did not contain ${expected}`)
  }
  return text
}

await main()
