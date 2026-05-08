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
const MEASURED_RUNS = 5
const BUDGETS = {
  shellReadyMs: 100,
  totalInteractiveMs: 500
}

async function main() {
  await relaunchWithXvfbIfNeeded(import.meta.url)
  await assertDistReady(DIST_DIR)
  await fs.mkdir(RESULT_DIR, { recursive: true })
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curator-popup-perf-'))
  const context = await chromium.launchPersistentContext(
    userDataDir,
    getExtensionLaunchOptions(DIST_DIR)
  )
  try {
    const serviceWorker = await waitForExtensionServiceWorker(context)
    const extensionId = new URL(serviceWorker.url()).host
    const rows = []
    for (let run = 0; run < MEASURED_RUNS; run += 1) {
      rows.push(await measurePopupStartupRun(context, extensionId, run + 1))
    }
    const summary = summarizeRows(rows)
    const ok = isWithinBudget(summary.shellReadyMedianMs, BUDGETS.shellReadyMs) &&
      isWithinBudget(summary.totalInteractiveMedianMs, BUDGETS.totalInteractiveMs) &&
      rows.every((row) => row.complete)
    await writeResult('popup-startup', { budgets: BUDGETS, runs: MEASURED_RUNS, rows, summary, ok })
    printRows(rows, summary)
    if (!ok) {
      console.error('popup startup budget failed')
      process.exit(1)
    }
    console.log('popup startup budget ok')
  } finally {
    await context.close()
    await fs.rm(userDataDir, { recursive: true, force: true })
  }
}

async function measurePopupStartupRun(context, extensionId, run) {
  const page = await context.newPage()
  const messages = []
  try {
    await page.addInitScript(() => {
      globalThis.__CURATOR_PERF__ = true
      localStorage.setItem('curator_perf', '1')
    })
    page.on('console', (message) => {
      if (message.text().startsWith('[Curator Perf]')) {
        messages.push(message.text())
      }
    })
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(250)
    const measures = await collectMeasures(page, ['popup.shellReady', 'popup.totalInteractive'])
    const shellReadyMs = measures['popup.shellReady'] ?? null
    const totalInteractiveMs = measures['popup.totalInteractive'] ?? null
    return {
      page: 'popup',
      run,
      shellReadyMs,
      totalInteractiveMs,
      complete: isFiniteNumber(shellReadyMs) && isFiniteNumber(totalInteractiveMs),
      perfMessages: messages
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function collectMeasures(page, names) {
  return page.evaluate((measureNames) => {
    const output = {}
    for (const name of measureNames) {
      const entries = performance.getEntriesByName(name, 'measure')
      const latest = entries[entries.length - 1]
      if (latest) {
        output[name] = Number(latest.duration.toFixed(2))
      }
    }
    return output
  }, names)
}

function summarizeRows(rows) {
  const shellSamples = rows.map((row) => row.shellReadyMs).filter(isFiniteNumber).sort((a, b) => a - b)
  const totalSamples = rows.map((row) => row.totalInteractiveMs).filter(isFiniteNumber).sort((a, b) => a - b)
  return {
    shellReadyMedianMs: median(shellSamples),
    shellReadyP95Ms: quantile(shellSamples, 0.95),
    shellReadyMaxMs: shellSamples[shellSamples.length - 1] ?? null,
    totalInteractiveMedianMs: median(totalSamples),
    totalInteractiveP95Ms: quantile(totalSamples, 0.95),
    totalInteractiveMaxMs: totalSamples[totalSamples.length - 1] ?? null
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

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

async function writeResult(name, payload) {
  const outPath = path.join(RESULT_DIR, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await fs.writeFile(outPath, JSON.stringify({ generatedAt: Date.now(), benchmark: name, ...payload }, null, 2))
  console.log(`results written to ${outPath}`)
}

function printRows(rows, summary) {
  for (const row of rows) {
    console.log(`${row.page}#${row.run}: shell=${row.shellReadyMs ?? 'missing'}ms total=${row.totalInteractiveMs ?? 'missing'}ms`)
  }
  console.log(`popup median: shell=${summary.shellReadyMedianMs ?? 'missing'}ms total=${summary.totalInteractiveMedianMs ?? 'missing'}ms`)
  console.log(`popup p95: shell=${summary.shellReadyP95Ms ?? 'missing'}ms total=${summary.totalInteractiveP95Ms ?? 'missing'}ms`)
}

await main()
