import { build } from 'esbuild'
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const moduleArgument = process.argv.find(argument => argument.startsWith('--module='))
const modulePath = moduleArgument ? path.resolve(moduleArgument.slice(9)).replaceAll('\\', '/') : './search.ts'
const label = moduleArgument ? 'baseline' : 'current'
const bundle = await build({
  stdin: {
    contents: `export * from ${JSON.stringify(modulePath)}; export * from './search-benchmark-fixture.mjs'; export { enrichPinyinTokensCooperatively } from '../shared/search/pinyin.ts';`,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'ts'
  },
  bundle: true, write: false, format: 'iife', globalName: 'SearchBenchmark', platform: 'browser', logLevel: 'silent'
})
const browser = await chromium.launch({ channel: 'chromium', headless: true })
const report = { label, browser: browser.version(), node: process.version, cpu: os.cpus()[0]?.model, generatedAt: new Date().toISOString(), datasets: [] }
try {
  const page = await browser.newPage()
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const cdp = await page.context().newCDPSession(page)
  for (const count of [1000, 10000, 50000]) {
    await page.evaluate(() => { delete globalThis.__benchmarkBookmarks })
    await cdp.send('HeapProfiler.collectGarbage')
    const heapBefore = (await cdp.send('Runtime.getHeapUsage')).usedSize
    const dataset = await page.evaluate(async count => {
      const { createSearchBenchmarkRecords, SEARCH_BENCHMARK_QUERIES, indexBookmarkForSearch, warmSearchAcceleration, searchBookmarks, enrichPinyinTokensCooperatively } = SearchBenchmark
      const started = performance.now()
      const bookmarks = createSearchBenchmarkRecords(count).map(record => indexBookmarkForSearch(record))
      globalThis.__benchmarkBookmarks = bookmarks
      const projectionMs = performance.now() - started
      const pinyinStarted = performance.now()
      await enrichPinyinTokensCooperatively(bookmarks, { yieldWork: () => Promise.resolve() })
      const pinyinMs = performance.now() - pinyinStarted
      const indexStarted = performance.now()
      warmSearchAcceleration(bookmarks)
      const indexMs = performance.now() - indexStarted
      const queries = []
      const percentile = (times, fraction) => times.slice().sort((a, b) => a - b)[Math.ceil(times.length * fraction) - 1]
      for (const query of SEARCH_BENCHMARK_QUERIES) {
        const firstStart = performance.now()
        const firstResults = searchBookmarks(query, bookmarks)
        const firstMs = performance.now() - firstStart
        for (let run = 0; run < 12; run++) searchBookmarks(query, bookmarks)
        const times = []
        for (let run = 0; run < 80; run++) {
          const start = performance.now()
          searchBookmarks(query, bookmarks)
          times.push(performance.now() - start)
        }
        queries.push({ query, firstMs, p50: percentile(times, 0.5), p95: percentile(times, 0.95), max: Math.max(...times), resultCount: firstResults.length, top: firstResults[0]?.title })
      }
      // Different queries avoid measuring only repeated posting-cache lookups.
      const fresh = []
      let found = 0
      for (let run = 0; run < 200; run++) {
        const position = (run * 7919 + 37) % count
        const query = bookmarks[position].title
        const start = performance.now()
        const results = searchBookmarks(query, bookmarks)
        fresh.push(performance.now() - start)
        if (results[0]?.id === bookmarks[position].id) found++
      }
      return { count, projectionMs, pinyinMs, indexMs, queries, fresh: { count: fresh.length, top1Correct: found, p50: percentile(fresh, 0.5), p95: percentile(fresh, 0.95), max: Math.max(...fresh) } }
    }, count)
    await cdp.send('HeapProfiler.collectGarbage')
    dataset.retainedHeapMiB = ((await cdp.send('Runtime.getHeapUsage')).usedSize - heapBefore) / 1024 ** 2
    report.datasets.push(dataset)
    console.log(JSON.stringify(dataset, null, 2))
  }
} finally {
  await browser.close()
}
await mkdir('output/search-benchmark', { recursive: true })
await writeFile(`output/search-benchmark/${label}.json`, `${JSON.stringify(report, null, 2)}\n`)
