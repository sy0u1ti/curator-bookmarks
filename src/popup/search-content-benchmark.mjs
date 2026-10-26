import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const outputArgument = process.argv.find(argument => argument.startsWith('--output='))
const outputPath = path.resolve(outputArgument?.slice(9) || 'output/search-plan-fixes/content-benchmark.json')
const source = await readFile(new URL('./search.ts', import.meta.url), 'utf8')
const bundle = await build({
  stdin: {
    contents: `${source}
export function exhaustiveSearch(query, bookmarks) { return searchCandidatesWithLimit(bookmarks, parsePopupSearchQuery(query), 20); }
export function indexSizes(bookmarks) {
  const index = accelerationIndexes.get(bookmarks);
  const postingCount = map => [...map.values()].reduce((sum, ids) => sum + ids.length, 0);
  return { lightGrams: index.gramPostings.size, lightPostings: postingCount(index.gramPostings),
    bodyGrams: index.bodyPostings.size, bodyPostings: postingCount(index.bodyPostings), bodyRecords: index.bodyBookmarkIds.length };
}
export { createSearchBenchmarkRecords } from './search-benchmark-fixture.mjs';
`,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'ts'
  }, bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'ContentBenchmark', logLevel: 'silent'
})
const browser = await chromium.launch({ channel: 'chromium', headless: true })
const report = { browser: browser.version(), node: process.version, cpu: os.cpus()[0]?.model, generatedAt: new Date().toISOString(), datasets: [] }
try {
  // Fresh pages isolate each retained-heap sample and every index's caches.
  for (const [count, bodyCharacters] of [[1000, 16384], [10000, 4096]]) {
    for (const withBody of [false, true]) {
      const page = await browser.newPage()
      await page.addScriptTag({ content: bundle.outputFiles[0].text })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('HeapProfiler.collectGarbage')
      const before = (await cdp.send('Runtime.getHeapUsage')).usedSize
      const dataset = await page.evaluate(({ count, bodyCharacters, withBody }) => {
        const engine = ContentBenchmark
        globalThis.requestIdleCallback = () => 1
        const subjects = ['storage', 'rendering', 'network', 'compiler', 'database', 'keyboard', 'layout', 'pipeline']
        const actions = ['validation', 'scheduling', 'recovery', 'profiling', 'indexing', 'caching', 'navigation', 'testing']
        const paragraph = (record, section) => `Section ${section}: ${subjects[(record + section) % subjects.length]} ${actions[(record * 3 + section) % actions.length]}. This reference explains local state, event ordering, field boundaries and result ranking. Search implementation should preserve the original request and calendar dates. 书签检索保留字段边界，后台任务按时间预算执行，查询变化后丢弃旧结果。 `
        let utf8Bytes = 0
        const encoder = new TextEncoder()
        const projectionStart = performance.now()
        const bookmarks = engine.createSearchBenchmarkRecords(count).map((record, index) => {
          let fullText = ''
          if (withBody) {
            for (let section = 0; fullText.length < bodyCharacters; section++) fullText += paragraph(index, section)
            fullText = fullText.slice(0, bodyCharacters)
            if (index === count - 1) fullText += ' unique body needle 鹦鹉专属'
            if (index % 5 === 0) fullText += ' advertisement'
            utf8Bytes += encoder.encode(fullText).length
          }
          return engine.indexBookmarkForSearch(record, null, {
            url: record.url, title: '', summary: '', contentType: '', headings: [], finalUrl: '', canonicalUrl: '',
            fullTextStorage: 'local', fullText
          }, { includeFullText: withBody })
        })
        globalThis.__contentBenchmarkRecords = bookmarks
        const projectionMs = performance.now() - projectionStart
        const indexStart = performance.now()
        engine.warmSearchAcceleration(bookmarks)
        const indexMs = performance.now() - indexStart
        const queries = []
        const sourceQueries = ['react', '"unique body needle"', '"鹦"', '"鹦鹉"', '"字段边界"', '"local state"', 'react -advertisement', 'site:react.example.org "local state"']
        const rows = results => results.map(({ id, score }) => ({ id, score }))
        for (const query of sourceQueries) {
          const started = performance.now()
          const results = engine.searchBookmarks(query, bookmarks)
          const firstMs = performance.now() - started
          const expected = engine.exhaustiveSearch(query, bookmarks)
          const agreesWithScan = JSON.stringify(rows(results)) === JSON.stringify(rows(expected))
          for (let n = 0; n < 12; n++) engine.searchBookmarks(query, bookmarks)
          const samples = []
          for (let n = 0; n < 80; n++) {
            const start = performance.now()
            engine.searchBookmarks(query, bookmarks)
            samples.push(performance.now() - start)
          }
          samples.sort((a, b) => a - b)
          queries.push({ query, firstMs, p50: samples[39], p95: samples[75], max: samples.at(-1), agreesWithScan, resultCount: results.length, topId: results[0]?.id })
        }
        return { count, withBody, bodyCharacters, bodyUtf8MiB: utf8Bytes / 1024 ** 2, projectionMs, indexMs, index: engine.indexSizes(bookmarks), queries }
      }, { count, bodyCharacters, withBody })
      await cdp.send('HeapProfiler.collectGarbage')
      dataset.retainedHeapMiB = ((await cdp.send('Runtime.getHeapUsage')).usedSize - before) / 1024 ** 2
      assert.ok(dataset.queries.every(query => query.agreesWithScan), 'body candidates must agree with a full scan')
      for (const query of dataset.queries.filter(query => query.query.includes('unique') || query.query.includes('鹦'))) {
        assert.equal(query.resultCount, withBody ? 1 : 0)
        if (withBody) assert.equal(query.topId, String(count - 1))
      }
      report.datasets.push(dataset)
      console.log(JSON.stringify(dataset, null, 2))
      await page.close()
    }
  }
} finally {
  await browser.close()
}
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
