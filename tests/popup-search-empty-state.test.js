import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const popupSource = readProjectFile('src/popup/popup.ts')
const popupHtml = readProjectFile('src/popup/popup.html')

test('popup natural search entry is understandable without relying on AI-only text', () => {
  assert.doesNotMatch(popupHtml, new RegExp('>\\s*AI\\s*</button>'))
  assert.match(popupHtml, new RegExp('>\\s*语义\\s*</button>'))
  assert.match(popupSource, /return '本地语义'/)
  assert.match(popupSource, /return 'AI 语义'/)
})

test('popup empty search state offers actionable recovery controls', () => {
  assert.match(popupSource, /function renderEmptySearchState/)
  assert.match(popupSource, /data-empty-action="clear-query"/)
  assert.match(popupSource, /data-empty-action="clear-filter"/)
  assert.match(popupSource, /data-empty-action="show-all"/)
  assert.match(popupSource, /data-empty-action="toggle-natural"/)
  assert.match(popupSource, /handleEmptySearchAction/)
})

test('popup folder pickers expose option and treeitem semantics', () => {
  assert.match(popupSource, /class="filter-option \$\{isSelected \? 'selected' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{isSelected \? 'true' : 'false'\}"/)
  assert.match(popupSource, /data-toggle-move-folder="\$\{escapeAttr\(node\.id\)\}"[\s\S]*?role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-expanded="\$\{childFolders\.length \? String\(isExpanded\) : 'false'\}"/)
  assert.match(popupSource, /role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-selected="\$\{isCurrentFolder \? 'true' : 'false'\}"[\s\S]*?data-select-folder="\$\{escapeAttr\(node\.id\)\}"/)
  assert.match(popupSource, /role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-selected="false"[\s\S]*?data-smart-select-folder="\$\{escapeAttr\(node\.id\)\}"/)
})
