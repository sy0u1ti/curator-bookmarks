import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * from './src/options/sections/run-presentation';
      export * from './src/options/sections/feature-settings-view';
      export * from './src/newtab/folder-source-presentation';
      export { getSpeedDialStatus } from './src/newtab/speed-dial';`,
    loader: 'ts', resolveDir: process.cwd()
  },
  bundle: true, write: false, platform: 'node', format: 'esm'
})
const { getRunPresentation, getFolderSourceSecondaryPath, getSpeedDialStatus, buildFeatureSettingsView } =
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const read = file => readFile(`src/${file}`, 'utf8')
const idle = { active: false, startedAt: 0, completedAt: 0, resultCount: 0, hasError: false }

test('idle screens do not expose future-run progress, results or filters', () => {
  assert.deepEqual(getRunPresentation(idle), { progress: false, results: false, filters: false })
  assert.deepEqual(getRunPresentation({ ...idle, active: true }), { progress: true, results: false, filters: false },
    'Permission and preparation show progress, not speculative result placeholders')
  assert.deepEqual(getRunPresentation({ ...idle, active: true, startedAt: 1 }), { progress: true, results: false, filters: false })
})

test('zero-result completion, pauses, partial runs and errors remain observable', () => {
  for (const input of [{ completedAt: 2 }, { startedAt: 1 }, { active: true, resultCount: 1 }, { resultCount: 1 }]) {
    const result = getRunPresentation({ ...idle, ...input })
    assert.equal(result.progress, true)
    assert.equal(result.results, true)
    assert.equal(result.filters, Boolean(input.resultCount))
  }
  assert.deepEqual(getRunPresentation({ ...idle, hasError: true }), { progress: true, results: false, filters: false })
  assert.deepEqual(getRunPresentation({ ...idle, hasFilter: true }), { progress: false, results: true, filters: true },
    'An active filter must keep its own recovery path even when no rows match')
})

test('folder context removes only a duplicate name, never an ancestor or an ambiguous path', () => {
  assert.equal(getFolderSourceSecondaryPath('Bookmarks bar', 'Bookmarks bar'), '')
  assert.equal(getFolderSourceSecondaryPath(' Work ', 'Work '), '')
  assert.equal(getFolderSourceSecondaryPath('Work', 'Bookmarks bar / Work'), 'Bookmarks bar / Work')
  assert.equal(getFolderSourceSecondaryPath('Work', 'work'), 'work')
  assert.equal(getFolderSourceSecondaryPath('Research > Notes', 'Bookmarks bar > Research > Notes'), 'Bookmarks bar > Research > Notes')
})

test('pinned-entry status is quiet at rest but preserves saving and failure feedback', () => {
  assert.equal(getSpeedDialStatus(false, ''), '')
  assert.equal(getSpeedDialStatus(true, ''), '', 'no status text during busy - disabled per Razor principle')
  assert.equal(getSpeedDialStatus(false, 'Save failed'), 'Save failed')
  assert.equal(getSpeedDialStatus(true, 'Save failed'), 'Save failed')
})

test('inline settings disclosure retains automation consequences and third-party privacy', () => {
  const state = buildFeatureSettingsView({
    settings: { autoAnalyzeBookmarks: true, allowRemoteParsing: true },
    inboxSettings: {}, inboxStatus: '', inboxSaving: false, loading: false, permissionsLoading: false, remoteParserGranted: false,
    locked: false, pending: '', testingConnection: false
  })
  assert.match(state.switches[0].description, /会改名、移动/)
  assert.match(state.switches[1].description, /Jina Reader.*第三方服务会收到目标网址/)
  assert.equal(state.switches[1].status, '待授权')
  assert.match(state.inboxWorkflow.status, /独立.*未能成功分析时保留/)
})

test('primary provider fields replace the walkthrough, while low-level settings stay optional', async () => {
  const source = await read('options/components/AiProviderSettings.tsx')
  const advanced = source.indexOf('<CollapsibleRoot id="ai-advanced-settings"')
  assert.ok(source.indexOf('id="ai-base-url"') < advanced)
  assert.ok(source.indexOf('id="ai-api-key"') < advanced)
  assert.ok(source.indexOf('id="ai-batch-size"') > advanced)
  assert.doesNotMatch(source, /aiProviderSteps|AI_PROVIDER_FLOW|id="ai-timeout-ms"/)
  assert.match(source, /API Key 仅保存在本地；本机服务可留空/)
  assert.match(source, /aria-label="测试自定义 AI 渠道连接"/)
  assert.match(source, /aria-label="保存自定义 AI 渠道设置"/)
})

test('selection and pagination do not reserve empty controls, but recovery stays available', async () => {
  for (const file of ['ResultsPagination', 'AiAnalysisResultsPagination']) {
    assert.match(await read(`options/components/${file}.tsx`), /if \(!state\.visible\) return null/)
  }
  const filters = await read('options/components/AiAnalysisResultsFilter.tsx')
  assert.match(filters, /if \(!state\.visible\) return null/)
  assert.ok(filters.indexOf('inputRef.current?.focus()') < filters.indexOf("handleAiResultsFilterChange({ action: 'clear' })"))
  const controller = await read('options/options-controller.ts')
  assert.match(controller, /hidden: selectedResults\.length === 0/)
  assert.match(controller, /countLabel:.*eligibleBookmarks.*条可检测/)
  assert.match(controller, /countLabel:.*eligibleBookmarks.*条可处理/)
  const header = await read('options/components/AiAnalysisResultsHeader.tsx')
  assert.match(header, /handleAiAnalysisAction\('select-all'\)/)
  assert.match(header, /handleAiAnalysisAction\('select-high-confidence'\)/)
})

test('popup success uses one channel without removing deletion undo or errors', async () => {
  const controller = await read('popup/popup-controller.ts')
  const section = (start, end) => controller.slice(controller.indexOf(start), controller.indexOf(end))
  const move = section('async function moveBookmarkToFolder(', 'async function saveEditedBookmark(')
  const edit = section('async function saveEditedBookmark(', 'async function confirmDeleteBookmark(')
  for (const code of [move, edit]) {
    assert.doesNotMatch(code, /type: 'success'/)
    assert.match(code, /showMutationNotice/)
    assert.match(code, /type: 'error'/)
  }
  const deletion = section('async function confirmDeleteBookmark(', 'async function undoDelete(')
  assert.match(deletion, /action: 'undo-delete'/)
  assert.match(deletion, /actionLabel: '撤销'/)
  assert.match(controller, /actionLabel: '重试'/)
  assert.match(await read('popup/popup.css'), /#view-caption:not\(:empty\)\s*\{[^}]*min-width: 6em;[^}]*flex-shrink: 0;/s,
    'Single-channel feedback must keep readable space in a narrow pane')
  const functionBody = code => code.slice(code.indexOf('{') + 1, code.lastIndexOf('}'))
  const notice = new Function('message', 'isSmartOverlayActive', 'hasOpenModal', 'showToast', 'showViewNotice',
    functionBody(section('function showMutationNotice(', 'function clearViewNotice(')))
  for (const [smart, modal] of [[false, false], [true, false], [false, true], [true, true]]) {
    const channels = []
    notice('Saved', () => smart, () => modal, () => channels.push('toast'), () => channels.push('inline'))
    assert.deepEqual(channels, [smart || modal ? 'toast' : 'inline'])
  }
  const caption = new Function('state', functionBody(section('function getViewCaptionText(', 'function getNaturalSearchPendingCaption(')))
  assert.equal(caption({ viewNoticeMessage: 'Saved', isLoading: true, searchPending: true, naturalSearchPending: true }), 'Saved',
    'A background search must not swallow the only acknowledgement before its timer expires')
})
