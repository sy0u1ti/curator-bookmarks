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
const RESULT_DIR = '.perf-results'
const BUDGETS = {
  skeletonMs: 80,
  firstBookmarksMs: 600
}

async function main() {
  await relaunchWithXvfbIfNeeded(import.meta.url)
  await assertDistReady(DIST_DIR)
  await fs.mkdir(RESULT_DIR, { recursive: true })
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curator-newtab-perf-'))
  const context = await chromium.launchPersistentContext(
    userDataDir,
    getExtensionLaunchOptions(DIST_DIR)
  )
  try {
    const serviceWorker = await waitForExtensionServiceWorker(context)
    const extensionId = new URL(serviceWorker.url()).host
    const page = await context.newPage()
    await page.addInitScript(() => {
      globalThis.__CURATOR_PERF__ = true
      localStorage.setItem('curator_perf', '1')
    })
    await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(300)
    const measures = await page.evaluate(() => {
      const output = {}
      for (const name of ['newtab.skeletonMs', 'newtab.firstBookmarksMs', 'newtab.backgroundReadyMs']) {
        const entries = performance.getEntriesByName(name, 'measure')
        const latest = entries[entries.length - 1]
        if (latest) {
          output[name] = Number(latest.duration.toFixed(2))
        }
      }
      return output
    })
    const row = {
      page: 'newtab',
      skeletonMs: measures['newtab.skeletonMs'] ?? null,
      firstBookmarksMs: measures['newtab.firstBookmarksMs'] ?? null,
      backgroundReadyMs: measures['newtab.backgroundReadyMs'] ?? null
    }
    const ok = isWithinBudget(row.skeletonMs, BUDGETS.skeletonMs) &&
      isWithinBudget(row.firstBookmarksMs, BUDGETS.firstBookmarksMs)
    const outPath = path.join(RESULT_DIR, `newtab-startup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    await fs.writeFile(outPath, JSON.stringify({
      generatedAt: Date.now(),
      benchmark: 'newtab-startup',
      budgets: BUDGETS,
      rows: [row],
      ok
    }, null, 2))
    console.log(`results written to ${outPath}`)
    console.log(`newtab: skeleton=${row.skeletonMs ?? 'missing'}ms firstBookmarks=${row.firstBookmarksMs ?? 'missing'}ms background=${row.backgroundReadyMs ?? 'missing'}ms`)
    if (!ok) {
      console.error('newtab startup budget failed')
      process.exit(1)
    }
    console.log('newtab startup budget ok')
  } finally {
    await context.close()
    await fs.rm(userDataDir, { recursive: true, force: true })
  }
}

function isWithinBudget(value, budget) {
  return typeof value === 'number' && Number.isFinite(value) && value <= budget
}

await main()
