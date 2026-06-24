import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json')
const USER_DATA_PREFIX = path.join(os.tmpdir(), 'curator-dashboard-perf-')

const STORAGE_KEYS = {
  onboardingState: 'curatorBookmarkOnboardingState'
}

const BOOKMARK_COUNT = getEnvInteger('DASHBOARD_PERF_BOOKMARKS', 1500)
const PERF_TIMEOUT_MS = getEnvInteger('DASHBOARD_PERF_TIMEOUT_MS', 60_000)
const SCROLL_DURATION_MS = getEnvInteger('DASHBOARD_PERF_SCROLL_MS', 2400)
const MAX_RENDERED_CARDS = getEnvInteger('DASHBOARD_PERF_MAX_CARDS', 260)
const MAX_P95_FRAME_MS = getEnvNumber('DASHBOARD_PERF_MAX_P95_MS', 42)
const MAX_LONG_FRAME_RATIO = getEnvNumber('DASHBOARD_PERF_MAX_LONG_FRAME_RATIO', 0.24)

let context
let extensionWorker
let userDataDir = ''
let seedFolderId = ''

try {
  await assertBuiltExtension()
  userDataDir = await fs.mkdtemp(USER_DATA_PREFIX)
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1440, height: 960 },
    args: [
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--disable-default-apps',
      '--disable-features=Translate,OptimizationHints',
      '--no-default-browser-check',
      '--no-first-run'
    ]
  })
  context.setDefaultTimeout(PERF_TIMEOUT_MS)

  extensionWorker = await waitForExtensionServiceWorker(context)
  const extensionId = getExtensionId(extensionWorker)
  seedFolderId = await seedDashboardBookmarks(extensionWorker)
  const summary = await measureDashboardScroll(extensionId)

  console.log(JSON.stringify(summary, null, 2))
  assertDashboardPerf(summary)
  console.log(`Dashboard scroll perf passed for ${BOOKMARK_COUNT} bookmarks.`)
} finally {
  if (context) {
    if (seedFolderId) {
      await removeSeedFolder(seedFolderId).catch(() => {})
    }
    await context.close().catch(() => {})
  }
  if (userDataDir) {
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function assertBuiltExtension() {
  try {
    await fs.access(MANIFEST_PATH)
  } catch {
    throw new Error('dist/manifest.json is missing. Run `npm run build` before `npm run perf:dashboard`.')
  }
}

async function waitForExtensionServiceWorker(browserContext) {
  const existingWorker = browserContext.serviceWorkers()
    .find((worker) => worker.url().startsWith('chrome-extension://'))
  if (existingWorker) {
    return existingWorker
  }

  return await browserContext.waitForEvent('serviceworker', {
    timeout: PERF_TIMEOUT_MS,
    predicate: (worker) => worker.url().startsWith('chrome-extension://')
  })
}

function getExtensionId(worker) {
  const url = new URL(worker.url())
  if (!url.hostname) {
    throw new Error(`Unable to read extension id from service worker URL: ${worker.url()}`)
  }
  return url.hostname
}

async function seedDashboardBookmarks(worker) {
  return await worker.evaluate(async ({ bookmarkCount, storageKeys }) => {
    const callChrome = (target, method, ...args) => new Promise((resolve, reject) => {
      target[method](...args, (result) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(result)
      })
    })

    const now = Date.now()
    const folder = await callChrome(chrome.bookmarks, 'create', {
      parentId: '1',
      title: `Curator Dashboard Perf ${now}`
    })

    await callChrome(chrome.storage.local, 'set', {
      [storageKeys.onboardingState]: {
        version: 1,
        completed: true,
        completedAt: now
      }
    })

    for (let index = 0; index < bookmarkCount; index += 1) {
      await callChrome(chrome.bookmarks, 'create', {
        parentId: folder.id,
        title: `Dashboard Perf Bookmark ${String(index).padStart(5, '0')}`,
        url: `https://example.com/dashboard-perf/${index}?group=${index % 17}`
      })
    }

    return folder.id
  }, {
    bookmarkCount: BOOKMARK_COUNT,
    storageKeys: STORAGE_KEYS
  })
}

async function measureDashboardScroll(extensionId) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#dashboard`, {
    waitUntil: 'domcontentloaded'
  })

  await page.waitForSelector('#dashboard article', { timeout: PERF_TIMEOUT_MS })
  await page.waitForFunction(() => {
    const findDashboardResultsGrid = () => {
      const firstCard = document.querySelector('#dashboard article')
      let element = firstCard?.parentElement || null
      while (element && element.id !== 'dashboard') {
        const style = getComputedStyle(element)
        const scrollable = (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          element.scrollHeight > element.clientHeight + 8
        )
        if (scrollable) {
          return element
        }
        element = element.parentElement
      }
      return [...document.querySelectorAll('#dashboard div')]
        .find((candidate) => {
          const style = getComputedStyle(candidate)
          return (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            candidate.scrollHeight > candidate.clientHeight + 8
          )
        }) || null
    }
    const grid = findDashboardResultsGrid()
    return Boolean(grid && grid.scrollHeight > grid.clientHeight + 100)
  }, null, { timeout: PERF_TIMEOUT_MS })

  return await page.evaluate(async ({ scrollDurationMs }) => {
    const findDashboardResultsGrid = () => {
      const firstCard = document.querySelector('#dashboard article')
      let element = firstCard?.parentElement || null
      while (element && element.id !== 'dashboard') {
        const style = getComputedStyle(element)
        const scrollable = (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          element.scrollHeight > element.clientHeight + 8
        )
        if (scrollable) {
          return element
        }
        element = element.parentElement
      }
      return [...document.querySelectorAll('#dashboard div')]
        .find((candidate) => {
          const style = getComputedStyle(candidate)
          return (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            candidate.scrollHeight > candidate.clientHeight + 8
          )
        }) || null
    }
    const waitForAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
    const easeInOut = (progress) => {
      const clamped = Math.min(1, Math.max(0, Number(progress) || 0))
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2
    }
    const percentile = (values, ratio) => {
      if (!values.length) {
        return 0
      }
      const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))
      return values[index]
    }
    const round = (value) => Math.round(Number(value) * 100) / 100
    const grid = findDashboardResultsGrid()
    if (!grid) {
      throw new Error('Dashboard results grid was not found.')
    }

    const maxScrollTop = Math.max(0, grid.scrollHeight - grid.clientHeight)
    grid.scrollTop = 0
    await waitForAnimationFrame()

    const frames = []
    const renderedCardCounts = []
    const start = performance.now()
    let previous = start
    let sampleCounter = 0

    await new Promise((resolve) => {
      const step = (now) => {
        frames.push(now - previous)
        previous = now
        const progress = Math.min(1, (now - start) / scrollDurationMs)
        grid.scrollTop = Math.round(maxScrollTop * easeInOut(progress))
        sampleCounter += 1
        if (sampleCounter % 4 === 0 || progress === 1) {
          renderedCardCounts.push(document.querySelectorAll('#dashboard article').length)
        }
        if (progress < 1) {
          requestAnimationFrame(step)
          return
        }
        resolve()
      }
      requestAnimationFrame(step)
    })

    await waitForAnimationFrame()
    await new Promise((resolve) => setTimeout(resolve, 180))

    const sortedFrames = frames.slice(2).sort((left, right) => left - right)
    const averageFrameMs = frames.length
      ? frames.reduce((sum, value) => sum + value, 0) / frames.length
      : 0
    const p95FrameMs = percentile(sortedFrames, 0.95)
    const longFrameCount = frames.filter((frame) => frame > 34).length
    const maxRenderedCards = Math.max(
      document.querySelectorAll('#dashboard article').length,
      ...renderedCardCounts
    )

    return {
      averageFrameMs: round(averageFrameMs),
      estimatedFps: averageFrameMs > 0 ? round(1000 / averageFrameMs) : 0,
      frames: frames.length,
      longFrameCount,
      longFrameRatio: frames.length ? round(longFrameCount / frames.length) : 0,
      maxFrameMs: round(Math.max(...frames)),
      maxRenderedCards,
      p95FrameMs: round(p95FrameMs),
      scrollHeight: Math.round(grid.scrollHeight),
      viewportHeight: Math.round(grid.clientHeight)
    }
  }, {
    scrollDurationMs: SCROLL_DURATION_MS
  })
}

function assertDashboardPerf(summary) {
  const failures = []
  if (summary.maxRenderedCards > MAX_RENDERED_CARDS) {
    failures.push(`rendered card count ${summary.maxRenderedCards} exceeds ${MAX_RENDERED_CARDS}`)
  }
  if (summary.p95FrameMs > MAX_P95_FRAME_MS) {
    failures.push(`p95 frame ${summary.p95FrameMs}ms exceeds ${MAX_P95_FRAME_MS}ms`)
  }
  if (summary.longFrameRatio > MAX_LONG_FRAME_RATIO) {
    failures.push(`long-frame ratio ${summary.longFrameRatio} exceeds ${MAX_LONG_FRAME_RATIO}`)
  }
  if (failures.length) {
    throw new Error(`Dashboard scroll perf failed: ${failures.join('; ')}`)
  }
}

async function removeSeedFolder(folderId) {
  if (!extensionWorker) {
    return
  }

  await extensionWorker.evaluate(async (id) => {
    await new Promise((resolve) => {
      chrome.bookmarks.removeTree(id, () => resolve())
    })
  }, folderId)
}

function getEnvInteger(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function getEnvNumber(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}
