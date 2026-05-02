import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { shouldReuseBookmarkForSave } from '../src/service-worker/save-guards.js'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('popup smart save only reuses a bookmark id when urls still match', () => {
  assert.equal(
    shouldReuseBookmarkForSave('https://example.com/docs#intro', 'https://example.com/docs'),
    true
  )
  assert.equal(
    shouldReuseBookmarkForSave('https://example.com/old', 'https://example.com/current'),
    false
  )
  assert.equal(shouldReuseBookmarkForSave('', 'https://example.com/current'), false)
})

test('auto analyze queue reuses a tree snapshot within one processing pass', () => {
  const source = readProjectFile('src/service-worker/service-worker.ts')

  assert.match(source, /interface AutoAnalyzeTreeContext/)
  assert.match(source, /let autoAnalyzeTreeContext: AutoAnalyzeTreeContext \| null = null/)
  assert.match(source, /await runAutoAnalysisForBookmark\(entry, await getAutoAnalyzeTreeContext\(\)\)/)
  assert.match(source, /function invalidateAutoAnalyzeTreeContext\(\)/)
  assert.match(source, /if \(moved\) \{[\s\S]*?invalidateAutoAnalyzeTreeContext\(\)/)
})
