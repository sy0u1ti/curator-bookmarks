#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const FIXTURE_DIR = '.perf-fixtures'
const RESULT_DIR = '.perf-results'
const COMPILED_ROOT = '.tmp-test/src'
const FIXTURE_LABELS = ['1k', '10k', '50k']
const SCENARIOS = [
  { id: 'desktop-1440', contentWidth: 1200, containerHeight: 720, stepPx: 420, fastScrolling: false },
  { id: 'wide-2560', contentWidth: 2200, containerHeight: 900, stepPx: 720, fastScrolling: false },
  { id: 'wide-3840', contentWidth: 3480, containerHeight: 960, stepPx: 960, fastScrolling: false },
  { id: 'wide-3840-fast', contentWidth: 3480, containerHeight: 960, stepPx: 1280, fastScrolling: true }
]
const MEASURED_STEPS = 160
const MAX_RENDERED_CARDS = 220
const ESTIMATED_NODES_PER_CARD = 28
const MAX_ESTIMATED_DOM_NODES = 6500

function quantile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[idx]
}

async function loadFixture(label) {
  const file = path.join(FIXTURE_DIR, `bookmarks-${label}.json`)
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw)
}

async function loadDashboardModule() {
  const target = path.resolve(COMPILED_ROOT, 'options/sections/dashboard.js')
  const mod = await import(new URL(`file://${target}`).href)
  if (typeof mod.computeDashboardVirtualWindow !== 'function') {
    throw new Error(`computeDashboardVirtualWindow not found in ${target}`)
  }
  if (typeof mod.getDashboardVirtualRenderedCount !== 'function') {
    throw new Error(`getDashboardVirtualRenderedCount not found in ${target}`)
  }
  return mod
}

function runScenario(moduleApi, fixture, scenario) {
  const samples = []
  const renderedCounts = []
  let maxTotalHeight = 0
  let maxOffsetY = 0
  let scrollTop = 0
  for (let i = 0; i < MEASURED_STEPS; i++) {
    const start = performance.now()
    const windowState = moduleApi.computeDashboardVirtualWindow({
      itemCount: fixture.bookmarks.length,
      contentWidth: scenario.contentWidth,
      containerHeight: scenario.containerHeight,
      scrollTop,
      fastScrolling: scenario.fastScrolling
    })
    const duration = performance.now() - start
    samples.push(duration)
    renderedCounts.push(moduleApi.getDashboardVirtualRenderedCount(windowState))
    maxTotalHeight = Math.max(maxTotalHeight, windowState.totalHeight)
    maxOffsetY = Math.max(maxOffsetY, windowState.offsetY)
    scrollTop = windowState.maxScrollTop
      ? (scrollTop + scenario.stepPx) % windowState.maxScrollTop
      : 0
  }

  samples.sort((a, b) => a - b)
  renderedCounts.sort((a, b) => a - b)
  const maxRenderedCards = renderedCounts[renderedCounts.length - 1] || 0
  const estimatedDomNodes = maxRenderedCards * ESTIMATED_NODES_PER_CARD
  return {
    fixture: fixture.label,
    scenario: scenario.id,
    bookmarkCount: fixture.bookmarks.length,
    maxRenderedCards,
    p95RenderedCards: quantile(renderedCounts, 0.95),
    estimatedDomNodes,
    p50FrameMs: Number(quantile(samples, 0.5).toFixed(3)),
    p95FrameMs: Number(quantile(samples, 0.95).toFixed(3)),
    maxFrameMs: Number((samples[samples.length - 1] || 0).toFixed(3)),
    maxTotalHeight: Math.round(maxTotalHeight),
    maxOffsetY: Math.round(maxOffsetY),
    ok: maxRenderedCards <= MAX_RENDERED_CARDS && estimatedDomNodes <= MAX_ESTIMATED_DOM_NODES
  }
}

function printTable(rows) {
  const header = ['fixture', 'scenario', 'bookmarks', 'maxCards', 'p95Cards', 'estNodes', 'p95ms', 'status']
  const widths = header.map((title) => title.length)
  const data = rows.map((row) => [
    row.fixture,
    row.scenario,
    String(row.bookmarkCount),
    String(row.maxRenderedCards),
    String(row.p95RenderedCards),
    String(row.estimatedDomNodes),
    String(row.p95FrameMs),
    row.ok ? 'ok' : 'fail'
  ])
  for (const row of data) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index], cell.length)
    })
  }
  const pad = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ')
  console.log(pad(header))
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of data) {
    console.log(pad(row))
  }
}

async function main() {
  const moduleApi = await loadDashboardModule()
  await fs.mkdir(RESULT_DIR, { recursive: true })
  const rows = []
  for (const label of FIXTURE_LABELS) {
    try {
      const fixture = await loadFixture(label)
      for (const scenario of SCENARIOS) {
        rows.push(runScenario(moduleApi, fixture, scenario))
      }
    } catch (error) {
      if (error?.code === 'ENOENT') {
        console.warn(`skip ${label}: fixture missing - run npm run perf:fixtures first`)
      } else {
        throw error
      }
    }
  }

  if (!rows.length) {
    console.warn('no fixtures benchmarked')
    process.exit(1)
  }

  printTable(rows)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = path.join(RESULT_DIR, `dashboard-scroll-${stamp}.json`)
  await fs.writeFile(outPath, JSON.stringify({
    generatedAt: Date.now(),
    benchmark: 'dashboard-scroll-window-budget',
    thresholds: {
      maxRenderedCards: MAX_RENDERED_CARDS,
      maxEstimatedDomNodes: MAX_ESTIMATED_DOM_NODES,
      estimatedNodesPerCard: ESTIMATED_NODES_PER_CARD
    },
    rows
  }, null, 2))
  console.log(`results written to ${outPath}`)

  const failures = rows.filter((row) => !row.ok)
  if (failures.length) {
    console.error('dashboard scroll budget failed')
    process.exit(1)
  }
}

await main()
