import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('options folder listbox options expose role and aria-selected state', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(optionsHtml, /id="scope-folder-results"[^>]+role="listbox"[^>]+aria-label="筛选文件夹"/)
  assert.match(optionsSource, /class="scope-folder-card \$\{allSelected \? 'current' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{allSelected \? 'true' : 'false'\}"/)
  assert.match(optionsSource, /class="scope-folder-card \$\{isCurrent \? 'current' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{isCurrent \? 'true' : 'false'\}"/)
})

test('dashboard tag editor and tag popover have dialog semantics and keyboard path', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(optionsHtml, /id="dashboard-tag-editor"[^>]+role="dialog"[^>]+aria-modal="false"/)
  assert.match(dashboardSource, /dashboard-tag-popover[^`]+role="dialog"[^`]+aria-modal="false"/)
  assert.match(dashboardSource, /export function handleDashboardKeydown/)
  assert.match(dashboardSource, /event\.key === 'Escape'[\s\S]*?closeDashboardTagEditor\(\)/)
  assert.match(dashboardSource, /event\.key === 'Enter'[\s\S]*?saveDashboardTagEditor\(\)/)
  assert.match(dashboardSource, /restoreDashboardTagEditorFocus/)
  assert.match(optionsSource, /addEventListener\('keydown', handleDashboardKeydown\)/)
})

test('availability, redirect and AI result lists render paginated controls', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const redirectsSource = readProjectFile('src/options/sections/redirects.ts')

  for (const id of [
    'availability-review-pagination',
    'availability-failed-pagination',
    'ai-results-pagination',
    'redirect-pagination'
  ]) {
    assert.match(optionsHtml, new RegExp(`id="${id}"`))
  }

  assert.match(optionsSource, /const RESULTS_PAGE_SIZE = 25/)
  assert.match(optionsSource, /getPaginatedResults\('availability-review', availabilityState\.reviewResults\)/)
  assert.match(optionsSource, /getPaginatedResults\('availability-failed', availabilityState\.failedResults\)/)
  assert.match(optionsSource, /getPaginatedResults\('ai-results', visibleResults\)/)
  assert.match(redirectsSource, /const REDIRECT_RESULTS_PAGE_SIZE = 25/)
  assert.match(redirectsSource, /getRedirectPageResults\(redirectResults\)/)
})

test('duplicate decisions expose explicit keep strategies and recycle wording', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const duplicateSource = readProjectFile('src/options/sections/duplicates.ts')

  assert.match(optionsHtml, /data-duplicate-strategy="recommended"/)
  assert.match(optionsHtml, /data-duplicate-strategy="newest"/)
  assert.match(optionsHtml, /data-duplicate-strategy="oldest"/)
  assert.match(optionsHtml, /data-duplicate-strategy="shorter-path"/)
  assert.match(optionsHtml, /data-duplicate-strategy="tagged"/)
  assert.match(optionsHtml, /data-duplicate-strategy="newtab-source"/)
  assert.match(optionsHtml, /data-duplicate-strategy="recent"/)
  assert.match(duplicateSource, /duplicate-recommendation-signals/)
  assert.match(duplicateSource, /有手动标签/)
  assert.match(duplicateSource, /新标签页来源/)
  assert.match(duplicateSource, /最近访问/)
  assert.doesNotMatch(duplicateSource, />\\s*删除所选\\s*</)
})

test('broken-link guidance explains confidence levels and redirect handling', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const redirectsSource = readProjectFile('src/options/sections/redirects.ts')

  assert.match(optionsHtml, /坏链检测结果处理顺序/)
  assert.match(optionsHtml, /高置信[\s\S]*?先重测，再移动或删除/)
  assert.match(optionsHtml, /低置信[\s\S]*?优先人工确认/)
  assert.match(optionsHtml, /重定向[\s\S]*?确认当前地址后更新/)
  assert.match(optionsSource, /getAvailabilityResultRecommendation/)
  assert.match(redirectsSource, /更新前会重新读取书签/)
})

test('redirect update rereads current bookmarks and skips stale source URLs', () => {
  const redirectsSource = readProjectFile('src/options/sections/redirects.ts')

  assert.match(redirectsSource, /getBookmarkTree/)
  assert.match(redirectsSource, /extractBookmarkData\(rootNode\)\.bookmarks/)
  assert.match(redirectsSource, /latestBookmarkMap\.get\(String\(result\.id\)\)/)
  assert.match(redirectsSource, /String\(latestBookmark\.url\) !== String\(result\.url \|\| ''\)/)
  assert.match(redirectsSource, /await updateBookmark\(result\.id, \{ url: finalUrl \}\)/)
})
