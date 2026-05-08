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
const FIXTURE_PATH = path.resolve('.perf-fixtures/bookmarks-50k.json')
const RESULT_DIR = '.perf-results'
const DASHBOARD_READY_TIMEOUT_MS = 30_000
const BUDGETS = {
  minRenderedCards: 1,
  maxRenderedCards: 220,
  frameP95Ms: 34,
  maxLongTaskMs: 100,
  maxTotalLongTaskMs: 150
}

async function main() {
  await relaunchWithXvfbIfNeeded(import.meta.url)
  await assertDistReady(DIST_DIR)
  await fs.mkdir(RESULT_DIR, { recursive: true })
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curator-dashboard-trace-'))
  const context = await chromium.launchPersistentContext(userDataDir, getExtensionLaunchOptions(DIST_DIR, {
    viewport: { width: 1440, height: 900 },
  }))
  try {
    const serviceWorker = await waitForExtensionServiceWorker(context)
    const extensionId = new URL(serviceWorker.url()).host
    const fixture = await loadFixture()
    const bookmarkTree = buildChromeBookmarkTree(fixture)
    const page = await context.newPage()
    await page.addInitScript((tree) => {
      const callbacks = new Set()
      globalThis.chrome = globalThis.chrome || {}
      globalThis.chrome.runtime = globalThis.chrome.runtime || { lastError: null }
      globalThis.chrome.bookmarks = {
        ...(globalThis.chrome.bookmarks || {}),
        getTree(callback) {
          globalThis.chrome.runtime.lastError = null
          callback(JSON.parse(JSON.stringify(tree)))
        },
        onCreated: { addListener(callback) { callbacks.add(callback) }, removeListener(callback) { callbacks.delete(callback) } },
        onRemoved: { addListener(callback) { callbacks.add(callback) }, removeListener(callback) { callbacks.delete(callback) } },
        onChanged: { addListener(callback) { callbacks.add(callback) }, removeListener(callback) { callbacks.delete(callback) } },
        onMoved: { addListener(callback) { callbacks.add(callback) }, removeListener(callback) { callbacks.delete(callback) } }
      }
    }, bookmarkTree)
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html#dashboard`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await waitForDashboardCards(page)
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      globalThis.__curatorLongTasks = []
      globalThis.__curatorFrameIntervals = []
      globalThis.__curatorFrameSampling = true
      try {
        const observer = new PerformanceObserver((list) => {
          globalThis.__curatorLongTasks.push(...list.getEntries().map((entry) => ({
            name: entry.name,
            duration: Number(entry.duration.toFixed(2)),
            startTime: Number(entry.startTime.toFixed(2))
          })))
        })
        observer.observe({ entryTypes: ['longtask'] })
        globalThis.__curatorLongTaskObserver = observer
      } catch {
        globalThis.__curatorLongTasks = []
      }

      let lastFrameTime = 0
      const sampleFrame = (timestamp) => {
        if (!globalThis.__curatorFrameSampling) {
          return
        }
        if (lastFrameTime > 0) {
          globalThis.__curatorFrameIntervals.push(Number((timestamp - lastFrameTime).toFixed(2)))
        }
        lastFrameTime = timestamp
        requestAnimationFrame(sampleFrame)
      }
      requestAnimationFrame(sampleFrame)
    })
    const scroller = page.locator('#dashboard-card-region')
    await scroller.evaluate((element) => {
      element.scrollTop = 0
    }).catch(() => {})
    for (let i = 0; i < 12; i += 1) {
      await page.mouse.wheel(0, 900)
      await page.waitForTimeout(40)
    }
    await page.waitForTimeout(250)
    await page.evaluate(() => {
      globalThis.__curatorFrameSampling = false
    })
    const metrics = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-dashboard-card]').length
      const totalText = document.body.innerText.match(/50,000|50000/)?.[0] || ''
      const longTasks = Array.isArray(globalThis.__curatorLongTasks) ? globalThis.__curatorLongTasks : []
      const frameIntervals = Array.isArray(globalThis.__curatorFrameIntervals)
        ? globalThis.__curatorFrameIntervals.filter((value) => Number.isFinite(Number(value)))
        : []
      const sortedFrameIntervals = frameIntervals.slice().sort((left, right) => left - right)
      const longTaskDurations = longTasks.map((task) => Number(task.duration) || 0)
      return {
        renderedCards: cards,
        fixtureTotalVisible: totalText,
        longTasks,
        frameIntervals,
        frameP95Ms: quantile(sortedFrameIntervals, 0.95),
        maxFrameMs: sortedFrameIntervals[sortedFrameIntervals.length - 1] || 0,
        maxLongTaskMs: Math.max(0, ...longTaskDurations),
        totalLongTaskMs: Number(longTaskDurations.reduce((sum, duration) => sum + duration, 0).toFixed(2)),
        heapBytes: performance.memory?.usedJSHeapSize || 0
      }

      function quantile(samples, p) {
        if (!samples.length) {
          return 0
        }
        const index = Math.min(samples.length - 1, Math.max(0, Math.ceil(samples.length * p) - 1))
        return Number(samples[index].toFixed(2))
      }
    })
    const ok = metrics.renderedCards >= BUDGETS.minRenderedCards &&
      metrics.renderedCards <= BUDGETS.maxRenderedCards &&
      metrics.frameP95Ms > 0 &&
      metrics.frameP95Ms <= BUDGETS.frameP95Ms &&
      metrics.maxLongTaskMs <= BUDGETS.maxLongTaskMs &&
      metrics.totalLongTaskMs <= BUDGETS.maxTotalLongTaskMs
    const outPath = path.join(RESULT_DIR, `dashboard-trace-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    await fs.writeFile(outPath, JSON.stringify({
      generatedAt: Date.now(),
      benchmark: 'dashboard-trace',
      budgets: BUDGETS,
      metrics,
      ok
    }, null, 2))
    console.log(`results written to ${outPath}`)
    console.log(`dashboard trace: cards=${metrics.renderedCards} frameP95=${metrics.frameP95Ms}ms longTasks=${metrics.longTasks.length} maxLongTask=${metrics.maxLongTaskMs}ms`)
    if (!ok) {
      console.error('dashboard trace budget failed')
      process.exit(1)
    }
    console.log('dashboard trace budget ok')
  } finally {
    await context.close()
    await fs.rm(userDataDir, { recursive: true, force: true })
  }
}

await main()

async function waitForDashboardCards(page) {
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('[data-dashboard-card]').length > 0,
      { timeout: DASHBOARD_READY_TIMEOUT_MS }
    )
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      activeSection: location.hash,
      cardCount: document.querySelectorAll('[data-dashboard-card]').length,
      dashboardReady: document.querySelector('[data-section-panel="dashboard"]')?.getAttribute('data-dashboard-ready') || '',
      dashboardText: document.querySelector('[data-section-panel="dashboard"]')?.textContent?.slice(0, 500) || '',
      bodyText: document.body?.innerText?.slice(0, 500) || ''
    })).catch(() => null)
    throw new Error(`dashboard cards did not render within ${DASHBOARD_READY_TIMEOUT_MS}ms: ${JSON.stringify(diagnostics)}; ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function loadFixture() {
  try {
    return JSON.parse(await fs.readFile(FIXTURE_PATH, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('50k fixture missing - run npm run perf:fixtures first')
    }
    throw error
  }
}

function buildChromeBookmarkTree(fixture) {
  const root = createFolderNode('0', '', [])
  const bookmarkBar = createFolderNode('1', 'Bookmarks Bar', [])
  const other = createFolderNode('2', 'Other Bookmarks', [])
  root.children.push(bookmarkBar, other)

  const foldersByPath = new Map([['', bookmarkBar]])
  const folderIdsByPath = new Map([['', bookmarkBar.id]])
  let folderCounter = 100

  for (const bookmark of fixture.bookmarks || []) {
    const segments = String(bookmark.path || 'Fixture').split('/').map((segment) => segment.trim()).filter(Boolean)
    let currentPath = ''
    let parent = bookmarkBar
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath} / ${segment}` : segment
      let folder = foldersByPath.get(currentPath)
      if (!folder) {
        folder = createFolderNode(String(folderCounter++), segment, [])
        folder.parentId = folderIdsByPath.get(currentPath.split(' / ').slice(0, -1).join(' / ')) || bookmarkBar.id
        folder.index = parent.children.length
        parent.children.push(folder)
        foldersByPath.set(currentPath, folder)
        folderIdsByPath.set(currentPath, folder.id)
      }
      parent = folder
    }

    parent.children.push({
      id: String(bookmark.id),
      parentId: parent.id,
      index: parent.children.length,
      title: String(bookmark.title || 'Fixture Bookmark'),
      url: String(bookmark.url || ''),
      dateAdded: Number(bookmark.dateAdded) || Date.now()
    })
  }

  normalizeChildIndexes(root)
  return [root]
}

function createFolderNode(id, title, children) {
  return {
    id,
    title,
    children,
    dateAdded: 1_700_000_000_000
  }
}

function normalizeChildIndexes(node) {
  const children = node.children || []
  for (let index = 0; index < children.length; index += 1) {
    children[index].parentId = node.id
    children[index].index = index
    if (children[index].children) {
      normalizeChildIndexes(children[index])
    }
  }
}
