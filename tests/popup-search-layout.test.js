import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('popup search block does not render saved search controls', () => {
  const popupHtml = readProjectFile('src/popup/popup.html')
  const popupDom = readProjectFile('src/popup/dom.ts')
  const popupSource = readProjectFile('src/popup/popup.ts')

  assert.doesNotMatch(popupHtml, /saved-search-row|saved-search-select|save-search|delete-saved-search/)
  assert.doesNotMatch(popupHtml, /选择保存搜索|保存的搜索/)
  assert.doesNotMatch(popupDom, /savedSearchSelect|saveSearch|deleteSavedSearch/)
  assert.doesNotMatch(popupSource, /hydrateSavedSearches|applySelectedSavedSearch|saveCurrentSearch|deleteCurrentSavedSearch/)
})

test('popup auto analyze status renders at the bottom of the main layout', () => {
  const popupHtml = readProjectFile('src/popup/popup.html')
  const contentIndex = popupHtml.indexOf('<section class="content-shell">')
  const statusIndex = popupHtml.indexOf('id="auto-analyze-status"')
  const footerIndex = popupHtml.indexOf('<footer id="smart-footer"')

  assert.ok(contentIndex > -1)
  assert.ok(statusIndex > contentIndex)
  assert.ok(footerIndex > statusIndex)
})

test('auto analyze completion does not create popup toast notices', () => {
  const popupSource = readProjectFile('src/popup/popup.ts')
  const serviceWorkerSource = readProjectFile('src/service-worker/service-worker.ts')

  assert.match(popupSource, /async function hydrateAutoAnalyzeStatus/)
  assert.doesNotMatch(popupSource, /showPendingAutoAnalyzeNotice|pendingNoticeChange|已添加到 \$\{folderPath\}/)
  assert.doesNotMatch(serviceWorkerSource, /persistPendingAutoAnalyzeNotice/)
})
