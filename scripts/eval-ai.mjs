import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = resolve(rootDir, 'fixtures', 'ai-eval', 'sample-bookmark-ai-fixtures.json')
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))

const candidateIds = new Set(
  fixture.folderCandidates.map((candidate) => String(candidate.folder_id || ''))
)

for (const item of fixture.bookmarkAnalysisOutput.items) {
  assert(item.bookmark_id, 'bookmark analysis item needs bookmark_id')
  assert(Number(item.confidence) >= 0 && Number(item.confidence) <= 1, 'confidence must be 0..1')
  assert(Array.isArray(item.tags) && item.tags.length > 0, 'tags must be present')
  for (const tag of item.tags) {
    const text = String(tag || '').trim()
    assert(text.length > 0 && text.length <= 24, `tag too long: ${text}`)
    assert(!/[，,、/]|与|和|及/.test(text), `tag should stay atomic: ${text}`)
  }

  const decision = item.folder_decision || null
  if (decision?.kind === 'existing') {
    assert(candidateIds.has(String(decision.folder_id || '')), `unknown folder_id: ${decision.folder_id}`)
  }
  if (decision?.kind === 'new') {
    assert(String(decision.folder_path || '').trim(), 'new folder decision needs folder_path')
  }
}

const naturalSearch = fixture.naturalSearchOutput
assert(Array.isArray(naturalSearch.queries) && naturalSearch.queries.length > 0, 'natural search needs queries')
assert(JSON.stringify(naturalSearch).includes('react'), 'natural search should preserve key entity')
assert(naturalSearch.excluded_terms.includes('antd'), 'natural search should preserve exclusion')

console.log('AI eval fixtures passed local checks without external provider credentials.')

function assert(value, message) {
  if (!value) {
    throw new Error(message)
  }
}
