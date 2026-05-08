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
const PROFILES = {
  smoke: {
    runs: 1,
    gate: 'single-run',
    description: 'single-run smoke gate'
  },
  release: {
    runs: 20,
    gate: 'p95',
    description: '20-run release p95 gate with max observation'
  }
}
const BUDGETS = {
  skeletonMs: 80,
  firstBookmarksMs: 600
}

async function main() {
  const profile = getProfile()
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
    const rows = []
    for (let run = 0; run < profile.runs; run += 1) {
      rows.push(await measureNewtabStartupRun(context, extensionId, run + 1))
    }
    const summary = summarizeRows(rows)
    const ok = isNewtabStartupWithinBudget(summary, rows, profile)
    const outPath = path.join(RESULT_DIR, `newtab-startup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    await fs.writeFile(outPath, JSON.stringify({
      generatedAt: Date.now(),
      benchmark: 'newtab-startup',
      profile: profile.id,
      gate: profile.gate,
      gateDescription: profile.description,
      budgets: BUDGETS,
      runs: profile.runs,
      rows,
      summary,
      ok
    }, null, 2))
    console.log(`results written to ${outPath}`)
    printRows(rows, summary, profile)
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

function getProfile() {
  const rawProfile = process.argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] || 'smoke'
  const profile = PROFILES[rawProfile] || PROFILES.smoke
  return {
    id: rawProfile in PROFILES ? rawProfile : 'smoke',
    ...profile
  }
}

async function measureNewtabStartupRun(context, extensionId, run) {
  const page = await context.newPage()
  try {
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
    const skeletonMs = measures['newtab.skeletonMs'] ?? null
    const firstBookmarksMs = measures['newtab.firstBookmarksMs'] ?? null
    const backgroundReadyMs = measures['newtab.backgroundReadyMs'] ?? null
    return {
      page: 'newtab',
      run,
      skeletonMs,
      firstBookmarksMs,
      backgroundReadyMs,
      complete: isFiniteNumber(skeletonMs) && isFiniteNumber(firstBookmarksMs)
    }
  } finally {
    await page.close().catch(() => {})
  }
}

function summarizeRows(rows) {
  const skeletonSamples = rows.map((row) => row.skeletonMs).filter(isFiniteNumber).sort((a, b) => a - b)
  const firstBookmarkSamples = rows.map((row) => row.firstBookmarksMs).filter(isFiniteNumber).sort((a, b) => a - b)
  const backgroundSamples = rows.map((row) => row.backgroundReadyMs).filter(isFiniteNumber).sort((a, b) => a - b)
  return {
    skeletonMedianMs: median(skeletonSamples),
    skeletonP95Ms: quantile(skeletonSamples, 0.95),
    skeletonMaxMs: skeletonSamples[skeletonSamples.length - 1] ?? null,
    firstBookmarksMedianMs: median(firstBookmarkSamples),
    firstBookmarksP95Ms: quantile(firstBookmarkSamples, 0.95),
    firstBookmarksMaxMs: firstBookmarkSamples[firstBookmarkSamples.length - 1] ?? null,
    backgroundReadyMedianMs: median(backgroundSamples),
    backgroundReadyP95Ms: quantile(backgroundSamples, 0.95),
    backgroundReadyMaxMs: backgroundSamples[backgroundSamples.length - 1] ?? null
  }
}

function median(samples) {
  if (!samples.length) {
    return null
  }
  return quantile(samples, 0.5)
}

function quantile(samples, p) {
  if (!samples.length) {
    return null
  }
  const index = Math.min(samples.length - 1, Math.max(0, Math.ceil(samples.length * p) - 1))
  return Number(samples[index].toFixed(2))
}

function isWithinBudget(value, budget) {
  return isFiniteNumber(value) && value <= budget
}

function isNewtabStartupWithinBudget(summary, rows, profile) {
  const complete = rows.every((row) => row.complete)
  if (profile.gate === 'p95') {
    return complete &&
      isWithinBudget(summary.skeletonP95Ms, BUDGETS.skeletonMs) &&
      isWithinBudget(summary.firstBookmarksP95Ms, BUDGETS.firstBookmarksMs)
  }
  return complete &&
    rows.every((row) => isWithinBudget(row.skeletonMs, BUDGETS.skeletonMs)) &&
    rows.every((row) => isWithinBudget(row.firstBookmarksMs, BUDGETS.firstBookmarksMs))
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function printRows(rows, summary, profile) {
  for (const row of rows) {
    console.log(`${row.page}#${row.run}: skeleton=${row.skeletonMs ?? 'missing'}ms firstBookmarks=${row.firstBookmarksMs ?? 'missing'}ms background=${row.backgroundReadyMs ?? 'missing'}ms`)
  }
  console.log(`newtab profile: ${profile.id} (${profile.description})`)
  console.log(`newtab median: skeleton=${summary.skeletonMedianMs ?? 'missing'}ms firstBookmarks=${summary.firstBookmarksMedianMs ?? 'missing'}ms background=${summary.backgroundReadyMedianMs ?? 'missing'}ms`)
  console.log(`newtab p95: skeleton=${summary.skeletonP95Ms ?? 'missing'}ms firstBookmarks=${summary.firstBookmarksP95Ms ?? 'missing'}ms background=${summary.backgroundReadyP95Ms ?? 'missing'}ms`)
  console.log(`newtab max: skeleton=${summary.skeletonMaxMs ?? 'missing'}ms firstBookmarks=${summary.firstBookmarksMaxMs ?? 'missing'}ms background=${summary.backgroundReadyMaxMs ?? 'missing'}ms`)
}

await main()
