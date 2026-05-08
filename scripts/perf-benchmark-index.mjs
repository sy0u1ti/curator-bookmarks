#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const FIXTURE_DIR = '.perf-fixtures'
const RESULT_DIR = '.perf-results'
const COMPILED_ROOT = '.tmp-test/src'
const FIXTURE_LABELS = ['1k', '10k', '50k']
const WARMUP_RUNS = 2
const MEASURED_RUNS = 5

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

async function importBuildLightPopupSearchIndex() {
  const target = path.resolve(COMPILED_ROOT, 'popup/search-index.js')
  const url = new URL(`file://${target}`).href
  const mod = await import(url)
  if (typeof mod.buildLightPopupSearchIndex !== 'function') {
    throw new Error(`buildLightPopupSearchIndex not found in ${target}`)
  }
  return mod.buildLightPopupSearchIndex
}

function runOnce(buildFn, fixture) {
  const start = performance.now()
  const result = buildFn({
    bookmarks: fixture.bookmarks,
    tagIndex: fixture.tagIndex,
    snapshotIndex: fixture.snapshotIndex
  })
  const end = performance.now()
  return { duration: end - start, size: result.length }
}

async function benchmarkLabel(buildFn, label) {
  const fixture = await loadFixture(label)
  for (let i = 0; i < WARMUP_RUNS; i++) {
    runOnce(buildFn, fixture)
  }
  const samples = []
  let lastSize = 0
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const { duration, size } = runOnce(buildFn, fixture)
    samples.push(duration)
    lastSize = size
  }
  samples.sort((a, b) => a - b)
  return {
    label,
    bookmarkCount: fixture.bookmarks.length,
    indexedCount: lastSize,
    runs: MEASURED_RUNS,
    p50Ms: Number(quantile(samples, 0.5).toFixed(2)),
    p95Ms: Number(quantile(samples, 0.95).toFixed(2)),
    maxMs: Number(samples[samples.length - 1].toFixed(2)),
    minMs: Number(samples[0].toFixed(2)),
    samplesMs: samples.map((value) => Number(value.toFixed(2)))
  }
}

function printTable(rows) {
  const header = ['label', 'bookmarks', 'indexed', 'p50ms', 'p95ms', 'maxMs']
  const widths = header.map((title) => title.length)
  const data = rows.map((row) => [
    row.label,
    String(row.bookmarkCount),
    String(row.indexedCount),
    String(row.p50Ms),
    String(row.p95Ms),
    String(row.maxMs)
  ])
  for (const row of data) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i], cell.length)
    })
  }
  const pad = (cells) => cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ')
  console.log(pad(header))
  console.log(widths.map((w) => '-'.repeat(w)).join('  '))
  for (const row of data) {
    console.log(pad(row))
  }
}

async function main() {
  const buildFn = await importBuildLightPopupSearchIndex()
  await fs.mkdir(RESULT_DIR, { recursive: true })
  const rows = []
  for (const label of FIXTURE_LABELS) {
    try {
      rows.push(await benchmarkLabel(buildFn, label))
    } catch (error) {
      if (error?.code === 'ENOENT') {
        console.warn(`skip ${label}: fixture missing — run npm run perf:fixtures first`)
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
  const outPath = path.join(RESULT_DIR, `index-${stamp}.json`)
  await fs.writeFile(outPath, JSON.stringify({
    generatedAt: Date.now(),
    benchmark: 'buildLightPopupSearchIndex',
    rows
  }, null, 2))
  console.log(`results written to ${outPath}`)
}

await main()
