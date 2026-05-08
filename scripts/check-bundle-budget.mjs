#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ASSETS_DIR = path.join('dist', 'assets')

const BUDGET_RULES = [
  { id: 'popup', match: /^popup\.html-.*\.js$/, maxKb: 105, warnKb: 100, required: true },
  { id: 'newtab', match: /^newtab\.html-.*\.js$/, maxKb: 200, warnKb: 190, required: true },
  { id: 'options', match: /^options\.html-.*\.js$/, maxKb: 385, warnKb: 370, required: true },
  { id: 'search', match: /^search-(?!query).*\.js$/, maxKb: 30, warnPct: 95, required: true },
  { id: 'search-query', match: /^search-query-.*\.js$/, maxKb: 12, warnPct: 95, required: false },
  { id: 'vendor-pinyin', match: /^vendor-pinyin-.*\.js$/, maxKb: 320, warnPct: 95, required: true },
  { id: 'service-worker', match: /^service-worker\.ts-.*\.js$/, maxKb: 60, warnPct: 95, required: true }
]

const REPORT_DIR = '.perf-results'
const REPORT_PATH = `${REPORT_DIR}/bundle-budget-report.json`

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2)
}

async function listAssets() {
  try {
    const entries = await fs.readdir(ASSETS_DIR)
    const stats = await Promise.all(entries.map(async (entry) => {
      const file = path.join(ASSETS_DIR, entry)
      const stat = await fs.stat(file)
      return { entry, file, size: stat.size }
    }))
    return stats.filter(({ entry }) => entry.endsWith('.js'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`${ASSETS_DIR} not found — run npm run build first`)
    }
    throw error
  }
}

function evaluateRule(rule, assets) {
  const matched = assets.filter((asset) => rule.match.test(asset.entry))
  if (!matched.length) {
    return {
      rule,
      matched: [],
      totalBytes: 0,
      maxBytes: rule.maxKb * 1024,
      warnBytes: getWarnBytes(rule),
      ok: !rule.required,
      reason: rule.required ? 'missing' : 'optional-missing'
    }
  }
  const totalBytes = matched.reduce((sum, asset) => sum + asset.size, 0)
  const maxBytes = rule.maxKb * 1024
  const warnBytes = getWarnBytes(rule)
  return {
    rule,
    matched,
    totalBytes,
    maxBytes,
    warnBytes,
    ok: totalBytes <= maxBytes,
    reason: totalBytes <= maxBytes ? warnBytes && totalBytes > warnBytes ? 'warning' : 'ok' : 'over-budget'
  }
}

function getWarnBytes(rule) {
  if (Number(rule.warnKb) > 0) {
    return Number(rule.warnKb) * 1024
  }
  if (Number(rule.warnPct) > 0) {
    return rule.maxKb * 1024 * (Number(rule.warnPct) / 100)
  }
  return 0
}

function printReport(results) {
  const header = ['rule', 'files', 'sizeKb', 'limitKb', 'usedPct', 'status']
  const widths = header.map((title) => title.length)
  const data = results.map((result) => {
    const usedPct = result.maxBytes
      ? `${((result.totalBytes / result.maxBytes) * 100).toFixed(1)}%`
      : '-'
    return [
      result.rule.id,
      String(result.matched.length),
      formatKb(result.totalBytes),
      formatKb(result.maxBytes),
      usedPct,
      result.reason
    ]
  })
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
  const assets = await listAssets()
  const results = BUDGET_RULES.map((rule) => evaluateRule(rule, assets))
  printReport(results)
  await writeReport(results)

  const failures = results.filter((result) => !result.ok)
  if (failures.length) {
    console.error('\nbundle budget check failed:')
    for (const failure of failures) {
      if (failure.reason === 'missing') {
        console.error(`- ${failure.rule.id}: required chunk missing (pattern ${failure.rule.match})`)
      } else if (failure.reason === 'over-budget') {
        console.error(`- ${failure.rule.id}: ${formatKb(failure.totalBytes)} kB > limit ${formatKb(failure.maxBytes)} kB`)
        for (const asset of failure.matched) {
          console.error(`    ${asset.entry} (${formatKb(asset.size)} kB)`)
        }
      }
    }
    process.exit(1)
  }

  console.log('\nbundle budget ok')
}

async function writeReport(results) {
  await fs.mkdir(REPORT_DIR, { recursive: true })
  const report = {
    generatedAt: new Date().toISOString(),
    rules: results.map((result) => ({
      id: result.rule.id,
      required: Boolean(result.rule.required),
      files: result.matched.map((asset) => ({
        path: path.join(ASSETS_DIR, asset.entry),
        sizeBytes: asset.size,
        sizeKb: Number(formatKb(asset.size))
      })),
      totalBytes: result.totalBytes,
      sizeKb: Number(formatKb(result.totalBytes)),
      maxKb: Number(formatKb(result.maxBytes)),
      warnKb: result.warnBytes ? Number(formatKb(result.warnBytes)) : null,
      usedPct: result.maxBytes ? Number(((result.totalBytes / result.maxBytes) * 100).toFixed(1)) : null,
      status: result.reason,
      gate: result.ok ? 'pass' : 'fail',
      budgeted: true
    }))
  }
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`bundle budget report written to ${REPORT_PATH}`)
}

await main()
