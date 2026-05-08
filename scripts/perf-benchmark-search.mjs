#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const FIXTURE_DIR = '.perf-fixtures'
const RESULT_DIR = '.perf-results'
const COMPILED_ROOT = '.tmp-test/src'
const FIXTURE_LABELS = ['1k', '10k', '50k']
const QUERIES = [
  { kind: 'en-short', query: 'react' },
  { kind: 'en-short', query: 'docker' },
  { kind: 'zh-short', query: '前端' },
  { kind: 'zh-short', query: '机器学习' },
  { kind: 'url-frag', query: 'example1' },
  { kind: 'url-frag', query: 'article/100' }
]
const WARMUP_RUNS = 2
const MEASURED_RUNS = 8
const BUDGETS = {
  syncP95MsByFixture: {
    '1k': 80,
    '10k': 150
  },
  firstBatchP95MsByFixture: {
    '50k': 150
  },
  firstBatchMinHits: 1
}

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

async function loadModules() {
  const indexUrl = new URL(`file://${path.resolve(COMPILED_ROOT, 'popup/search-index.js')}`).href
  const searchUrl = new URL(`file://${path.resolve(COMPILED_ROOT, 'popup/search.js')}`).href
  const indexMod = await import(indexUrl)
  const searchMod = await import(searchUrl)
  if (typeof indexMod.buildLightPopupSearchIndex !== 'function') {
    throw new Error('buildLightPopupSearchIndex not found')
  }
  if (typeof searchMod.searchBookmarks !== 'function') {
    throw new Error('searchBookmarks not found')
  }
  if (typeof searchMod.searchBookmarksFirstBatch !== 'function') {
    throw new Error('searchBookmarksFirstBatch not found')
  }
  return {
    buildLightPopupSearchIndex: indexMod.buildLightPopupSearchIndex,
    searchBookmarks: searchMod.searchBookmarks,
    searchBookmarksFirstBatch: searchMod.searchBookmarksFirstBatch
  }
}

function runOnce(searchBookmarks, query, indexed) {
  const start = performance.now()
  const results = searchBookmarks(query, indexed)
  const end = performance.now()
  return { duration: end - start, hits: results.length }
}

function runFirstBatchOnce(searchBookmarksFirstBatch, query, indexed) {
  const start = performance.now()
  const batch = searchBookmarksFirstBatch(query, indexed, 20)
  const end = performance.now()
  return {
    duration: end - start,
    hits: batch.results.length,
    scanned: batch.scanned,
    complete: batch.complete
  }
}

async function benchmarkLabel({ buildLightPopupSearchIndex, searchBookmarks, searchBookmarksFirstBatch }, label) {
  const fixture = await loadFixture(label)
  const indexed = buildLightPopupSearchIndex({
    bookmarks: fixture.bookmarks,
    tagIndex: fixture.tagIndex,
    snapshotIndex: fixture.snapshotIndex
  })
  const rows = []
  for (const { kind, query } of QUERIES) {
    for (let i = 0; i < WARMUP_RUNS; i++) {
      runOnce(searchBookmarks, query, indexed)
    }
    const samples = []
    let lastHits = 0
    for (let i = 0; i < MEASURED_RUNS; i++) {
      const { duration, hits } = runOnce(searchBookmarks, query, indexed)
      samples.push(duration)
      lastHits = hits
    }
    samples.sort((a, b) => a - b)
    const budgetMs = BUDGETS.syncP95MsByFixture[label] || null
    const p95Ms = Number(quantile(samples, 0.95).toFixed(2))
    rows.push({
      label,
      mode: 'final',
      kind,
      query,
      bookmarkCount: fixture.bookmarks.length,
      hits: lastHits,
      scanned: fixture.bookmarks.length,
      complete: true,
      runs: MEASURED_RUNS,
      p50Ms: Number(quantile(samples, 0.5).toFixed(2)),
      p95Ms,
      maxMs: Number(samples[samples.length - 1].toFixed(2)),
      minMs: Number(samples[0].toFixed(2)),
      budgetMs,
      budgeted: Boolean(budgetMs),
      gate: budgetMs ? 'p95' : 'observe',
      ok: isSearchBudgetOk(label, p95Ms)
    })

    if (label === '50k') {
      for (let i = 0; i < WARMUP_RUNS; i++) {
        runFirstBatchOnce(searchBookmarksFirstBatch, query, indexed)
      }
      const firstBatchSamples = []
      let lastBatch = { hits: 0, scanned: 0, complete: false }
      for (let i = 0; i < MEASURED_RUNS; i++) {
        lastBatch = runFirstBatchOnce(searchBookmarksFirstBatch, query, indexed)
        firstBatchSamples.push(lastBatch.duration)
      }
      firstBatchSamples.sort((a, b) => a - b)
      const p95Ms = Number(quantile(firstBatchSamples, 0.95).toFixed(2))
      rows.push({
        label,
        mode: 'first-batch',
        kind,
        query,
        bookmarkCount: fixture.bookmarks.length,
        hits: lastBatch.hits,
        scanned: lastBatch.scanned,
        complete: lastBatch.complete,
        runs: MEASURED_RUNS,
        p50Ms: Number(quantile(firstBatchSamples, 0.5).toFixed(2)),
        p95Ms,
        maxMs: Number(firstBatchSamples[firstBatchSamples.length - 1].toFixed(2)),
        minMs: Number(firstBatchSamples[0].toFixed(2)),
        budgetMs: BUDGETS.firstBatchP95MsByFixture[label] || null,
        budgeted: Boolean(BUDGETS.firstBatchP95MsByFixture[label]),
        gate: BUDGETS.firstBatchP95MsByFixture[label] ? 'p95-and-min-hits' : 'observe',
        ok: isFirstBatchBudgetOk(label, p95Ms, lastBatch.hits)
      })
    }
  }
  return rows
}

function printTable(rows) {
  const header = ['fixture', 'mode', 'kind', 'query', 'hits', 'p50ms', 'p95ms', 'budget', 'gate', 'status']
  const widths = header.map((title) => title.length)
  const data = rows.map((row) => [
    row.label,
    row.mode,
    row.kind,
    row.query,
    String(row.hits),
    String(row.p50Ms),
    String(row.p95Ms),
    row.budgetMs ? String(row.budgetMs) : '-',
    row.gate,
    row.ok ? 'ok' : 'fail'
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

function isSearchBudgetOk(label, p95Ms) {
  const budget = BUDGETS.syncP95MsByFixture[label]
  return !budget || p95Ms <= budget
}

function isFirstBatchBudgetOk(label, p95Ms, hits) {
  const budget = BUDGETS.firstBatchP95MsByFixture[label]
  return !budget || (p95Ms <= budget && hits >= BUDGETS.firstBatchMinHits)
}

async function main() {
  const modules = await loadModules()
  await fs.mkdir(RESULT_DIR, { recursive: true })
  const rows = []
  for (const label of FIXTURE_LABELS) {
    try {
      rows.push(...(await benchmarkLabel(modules, label)))
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
  const outPath = path.join(RESULT_DIR, `search-${stamp}.json`)
  await fs.writeFile(outPath, JSON.stringify({
    generatedAt: Date.now(),
    benchmark: 'searchBookmarks',
    budgets: BUDGETS,
    rows
  }, null, 2))
  console.log(`results written to ${outPath}`)

  const failures = rows.filter((row) => !row.ok)
  if (failures.length) {
    console.error('search budget failed')
    for (const row of failures) {
      console.error(`- ${row.label} ${row.mode} ${row.kind} "${row.query}": p95=${row.p95Ms}ms budget=${row.budgetMs ?? '-'}ms hits=${row.hits}`)
    }
    process.exit(1)
  }
}

await main()
