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
  const runStartedAt = new Date()
  const runStamp = formatTimestampForFile(runStartedAt)
  const [packageJson, distManifest] = await Promise.all([
    readJson('package.json').catch(() => ({})),
    readJson(path.join(DIST_DIR, 'manifest.json')).catch(() => ({}))
  ])
  const version = String(distManifest.version || packageJson.version || 'unknown')
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
      {
        id: 'popup-search',
        url: `${extensionBaseUrl}/src/popup/popup.html`,
        waitFor: '#search-input',
        prepare: async (page) => {
          await page.locator('#search-input').fill('Curator E2E Search')
          await page.locator('.result-card').first().waitFor({ state: 'visible', timeout: 8000 })
        }
      },
      {
        id: 'options-onboarding',
        url: `${extensionBaseUrl}/src/options/options.html#onboarding`,
        waitFor: '[data-section-panel="onboarding"]'
      },
      {
        id: 'options-privacy',
        url: `${extensionBaseUrl}/src/options/options.html#privacy`,
        waitFor: '#privacy-permission-list'
      },
      {
        id: 'options-dashboard',
        url: `${extensionBaseUrl}/src/options/options.html#dashboard`,
        waitFor: '#dashboard'
      },
      {
        id: 'options-health',
        url: `${extensionBaseUrl}/src/options/options.html#health`,
        waitFor: '#health-title'
      },
      {
        id: 'options-backup',
        url: `${extensionBaseUrl}/src/options/options.html#backup`,
        waitFor: '#backup-export'
      },
      {
        id: 'options-recycle',
        url: `${extensionBaseUrl}/src/options/options.html#recycle`,
        waitFor: '#recycle-title'
      },
      {
        id: 'options-ai-preview',
        url: `${extensionBaseUrl}/src/options/options.html#general:ai-provider`,
        waitFor: '#ai-provider-settings'
      },
      {
        id: 'newtab-portal',
        url: `${extensionBaseUrl}/src/newtab/newtab.html`,
        waitFor: '.newtab-search-input'
      }
    ]
    const rows = []

    for (const pageSpec of pages) {
      const page = await context.newPage()
      attachPageErrorCapture(page, errors)
      await page.goto(pageSpec.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      if (pageSpec.waitFor) {
        await page.locator(pageSpec.waitFor).first().waitFor({ state: 'visible', timeout: 10000 }).catch((error) => {
          errors.push(`${pageSpec.id}: wait for ${pageSpec.waitFor} failed: ${error.message}`)
        })
      }
      if (typeof pageSpec.prepare === 'function') {
        await pageSpec.prepare(page).catch((error) => {
          errors.push(`${pageSpec.id}: prepare failed: ${error.message}`)
        })
      }
      const title = await page.title()
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      if (!bodyText.trim()) {
        errors.push(`${pageSpec.id}: body text is empty`)
      }
      const capturedAt = new Date().toISOString()
      const viewport = page.viewportSize()
      const screenshotPath = path.join(SCREENSHOT_DIR, `${pageSpec.id}-${formatTimestampForFile(capturedAt)}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch((error) => {
        errors.push(`${pageSpec.id}: screenshot failed: ${error.message}`)
      })
      const screenshotExists = await fs.access(screenshotPath).then(() => true, () => false)
      rows.push({
        id: pageSpec.id,
        url: pageSpec.url,
        title,
        bodyTextLength: bodyText.length,
        screenshotPath,
        screenshotExists,
        capturedAt,
        viewport,
        version,
        desensitizedFixture: true
      })
      await page.close()
    }

    const flows = []
    flows.push(await smokePopupSearch(extensionBaseUrl, context, errors))
    flows.push(await smokeOptionsSections(extensionBaseUrl, context, errors))
    flows.push(await smokeNewTabCommands(extensionBaseUrl, context, errors))
    flows.push(await smokeRecycleRestore(extensionBaseUrl, context, errors))
    flows.push(await smokeServiceWorkerRecovery(context, errors))

    const screenshotManifestPath = path.join(RESULT_DIR, `screenshot-manifest-${runStamp}.json`)
    const screenshotManifest = buildScreenshotManifest({
      generatedAt: new Date().toISOString(),
      version,
      screenshotDirectory: SCREENSHOT_DIR,
      rows
    })
    await fs.writeFile(screenshotManifestPath, JSON.stringify(screenshotManifest, null, 2))

    const result = {
      generatedAt: runStartedAt.getTime(),
      generatedAtIso: runStartedAt.toISOString(),
      version,
      extensionId,
      serviceWorkerUrl: serviceWorker.url(),
      pages: rows,
      screenshotCount: rows.filter((row) => row.screenshotExists).length,
      screenshotDirectory: SCREENSHOT_DIR,
      screenshotManifestPath,
      flows,
      errors,
      ok: errors.length === 0 && flows.every((flow) => flow.ok === true)
    }
    const outPath = path.join(RESULT_DIR, `extension-smoke-${runStamp}.json`)
    await fs.writeFile(outPath, JSON.stringify(result, null, 2))
    console.log(`extension smoke results written to ${outPath}`)

    if (!result.ok) {
      for (const error of errors) {
        console.error(`- ${error}`)
      }
      for (const flow of flows.filter((item) => item.ok !== true)) {
        console.error(`- ${flow.name || 'flow'}: flow.ok is not true`)
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
  const expectedNoise = { until: 0 }
  page.on('response', (response) => {
    const status = response.status()
    if (status >= 400) {
      if (isExpectedFixtureNetworkNoise(response.url())) {
        markExpectedNetworkNoise(expectedNoise)
        return
      }
      errors.push(`${page.url()}: response ${status}: ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    if (isExpectedFixtureNetworkNoise(request.url())) {
      markExpectedNetworkNoise(expectedNoise)
      return
    }
    errors.push(`${page.url()}: request failed: ${request.url()} (${request.failure()?.errorText || 'unknown error'})`)
  })
  page.on('console', (message) => {
    if (CONSOLE_ERROR_TYPES.has(message.type())) {
      if (isBrowserResourceNoise(message, expectedNoise)) {
        return
      }
      errors.push(`${page.url()}: console ${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    errors.push(`${page.url()}: pageerror: ${error.message}`)
  })
}

function isBrowserResourceNoise(message, expectedNoise) {
  const text = message.text()
  if (/^Failed to load resource: the server responded with a status of 404 \(\)$/.test(text)) {
    return true
  }
  if (
    text.includes('has been blocked by CORS policy') &&
    EXPECTED_FIXTURE_NETWORK_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    markExpectedNetworkNoise(expectedNoise)
    return true
  }
  return /^Failed to load resource: net::ERR_FAILED$/.test(text) && Date.now() <= expectedNoise.until
}

const EXPECTED_FIXTURE_NETWORK_PATTERNS = [
  /https:\/\/example\.com\/favicon\.ico/,
  /https:\/\/example\.com\/\?curator-e2e=/
]

function isExpectedFixtureNetworkNoise(url) {
  return EXPECTED_FIXTURE_NETWORK_PATTERNS.some((pattern) => pattern.test(String(url || '')))
}

function markExpectedNetworkNoise(state) {
  state.until = Date.now() + 2000
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

function formatTimestampForFile(value) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().replace(/[:.]/g, '-')
}

function buildScreenshotManifest({ generatedAt, version, screenshotDirectory, rows }) {
  const screenshots = rows.map((row) => ({
    id: row.id,
    path: row.screenshotPath,
    exists: row.screenshotExists,
    capturedAt: row.capturedAt,
    version: row.version,
    viewport: row.viewport,
    pageTitle: row.title,
    bodyTextLength: row.bodyTextLength,
    desensitizedFixture: row.desensitizedFixture === true
  }))
  return {
    artifactType: 'automated-e2e-smoke-screenshot-manifest',
    ok: screenshots.length >= 6 && screenshots.every((screenshot) => screenshot.exists),
    generatedAt,
    version,
    screenshotDirectory,
    screenshotCount: screenshots.filter((screenshot) => screenshot.exists).length,
    boundary: 'Automated smoke screenshots verify extension page rendering only. They are not Chrome Web Store screenshot approval, visual regression sign-off, manual accessibility review or manual release evidence.',
    fixture: {
      source: 'seedBookmarkFixture',
      desensitized: true,
      privateUserData: false
    },
    screenshots
  }
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
    const permissionText = await expectAllText(page, '#privacy-permission-list', [
      'optional http/https host permissions',
      'webNavigation / webRequest',
      '安装时不授予全站点访问',
      '网页搜索和远程背景不是主机权限理由'
    ])
    const remoteRequestText = await expectAllText(page, '#privacy-remote-matrix', [
      'Newtab 网页搜索',
      '精选远程背景',
      '用户自定义远程背景',
      'AI 命名/分类',
      'Popup AI 自然语言改写',
      'Jina Reader 远程解析',
      '死链/重定向检测',
      'Curator 不记录网页搜索 query',
      'Authorization'
    ])
    await expectAllText(page, '#privacy', [
      '最近 20 条或 7 天',
      '不保存 API Key',
      'URL query',
      '普通备份不会包含'
    ])
    await expectText(page, '#health-title', '书签健康中心')
    await expectText(page, '#backup-export', '导出完整备份')
    await expectText(page, '#duplicate-groups', '重复')
    await expectText(page, '#availability-action', '检测')
    await expectText(page, '#recycle-title', '回收站')
    await expectText(page, '#ai-config-status', '')
    flow.permissionDisclosureLength = permissionText.length
    flow.remoteRequestDisclosureLength = remoteRequestText.length
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

async function expectAllText(page, selector, expectedItems) {
  await page.waitForFunction(
    ({ selector, expectedItems }) => {
      const text = document.querySelector(selector)?.innerText || ''
      return expectedItems.every((item) => text.includes(item))
    },
    { selector, expectedItems },
    { timeout: 8000 }
  )
  const text = await page.locator(selector).first().innerText({ timeout: 8000 })
  const missing = expectedItems.filter((item) => !text.includes(item))
  if (missing.length) {
    throw new Error(`${selector} missing expected text: ${missing.join(', ')}`)
  }
  return text
}

await main()
