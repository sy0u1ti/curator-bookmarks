import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/ui/motion/list-exit-state.ts'], bundle: true, write: false, format: 'esm', platform: 'node'
})
const { reconcileListExit } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const read = path => readFileSync(path, 'utf8')
const rows = keys => keys.split('').map(key => ({ key, item: { id: key }, exiting: false }))
const keys = rows => rows.map(row => row.key).join('')

test('removed rows remain at their old anchors, including a batch and the last row', () => {
  const previous = rows('abcd')
  const retained = reconcileListExit(previous, [previous[0], previous[3]], true)
  assert.equal(keys(retained), 'abcd')
  assert.deepEqual(retained.map(row => row.exiting), [false, true, true, false])
  assert.equal(retained[1].item, previous[1].item)
  assert.equal(keys(reconcileListExit(previous, [], true)), 'abcd')
  assert.equal(keys(reconcileListExit(previous, [], false)), '')
})

test('revival replaces an exit record without duplicating or losing the row data', () => {
  const original = rows('abc')
  const exiting = reconcileListExit(original, [original[0], original[2]], true)
  assert.equal(reconcileListExit(exiting, [original[0], original[2]], true)[1], exiting[1])
  const revived = { ...original[1], item: { id: 'b', edited: true } }
  const restored = reconcileListExit(exiting, [original[0], revived, original[2]], true)
  assert.equal(restored[1], revived)
  assert.equal(restored[1].exiting, false)
  assert.equal(restored.includes(exiting[1]), false, 'An old completion cannot match the revived record')
})

test('filter scope changes drop exits while inserted and reordered live data retains its order', () => {
  const previous = rows('abcd')
  const current = rows('xda')
  assert.equal(keys(reconcileListExit(previous, current, false)), 'xda')
  const result = reconcileListExit(previous, current, true)
  assert.equal(keys(result.filter(row => !row.exiting)), 'xda')
  assert.equal(keys(result.filter(row => row.exiting)), 'bc')
  assert.equal(keys(reconcileListExit(rows('ab'), rows('ac'), true)), 'abc',
    'A retiring tail must not jump below a newly arrived row')
  assert.equal(keys(reconcileListExit(rows('ab'), rows('cd'), true)), 'abcd')
})

test('large removals preserve every key without quadratic scans', () => {
  const previous = Array.from({ length: 10000 }, (_, index) => ({ key: String(index), item: index, exiting: false }))
  const result = reconcileListExit(previous, [previous[9999]], true)
  assert.equal(result.length, previous.length)
  assert.deepEqual(result.map(row => row.key), previous.map(row => row.key))
})

test('exit ownership begins before commit and ends at animation completion, not a timer', () => {
  const hook = read('src/ui/motion/useListExit.ts')
  assert.ok(hook.indexOf('setState({ input:') < hook.indexOf('useLayoutEffect(() =>'))
  assert.ok(hook.includes('animation.finished') && hook.includes('state.entries.includes(entry)'))
  assert.ok(!hook.includes('setTimeout') && !hook.includes('getMotionDurationMs'))
  for (const path of ['IgnoreRules', 'InboxReview', 'RecycleBin']) {
    const source = read(`src/options/components/${path}.tsx`)
    assert.match(source, /ref=\{(?:row|entry)\.ref\}/)
    assert.match(source, /inert=\{(?:row|entry)\.exiting/)
  }
})

test('search workspaces have a fixed control edge and a single scrolling body, not a padded empty panel', () => {
  const css = read('src/ui/base/dialog-layout.css')
  assert.ok(css.includes('translate: -50% 0') && css.includes('.curator-dialog-body'))
  assert.ok(css.includes('min-height: 0') && css.includes('scrollbar-gutter: stable'))
  assert.doesNotMatch(css, /(?:^|[;{])\s*(?:min-)?(?:height|block-size):\s*\d+px\s*;/m)
  assert.ok(!css.includes('transition:'))
  assert.ok(read('src/ui/ai/ModelSelector.tsx').includes('layout="workspace"'))
  assert.ok(read('src/options/components/OptionsModals.tsx').includes("modal === 'move' || modal === 'scope'"))
})

test('drafts and scroll positions belong to interaction sessions rather than server data versions', () => {
  const provider = read('src/options/components/AiProviderSettings.tsx')
  assert.ok(provider.includes('function AiCustomModelsForm') && provider.includes('useState(initialValue)'))
  assert.ok(!provider.includes("key={state.customModels.join"))
  assert.ok(provider.includes('finalFocus={finalFocusRef}'))
  const options = read('src/options/OptionsApp.tsx')
  assert.ok(options.includes('useOptionsReadingPosition(sectionKey, sectionAnchor, optionsMainRef, optionsShellRef)'))
  assert.ok(read('src/options/useOptionsReadingPosition.ts').includes('data-reading-restored'))
  assert.ok(!options.includes('setTimeout(scrollTop') && !options.includes('requestAnimationFrame(scrollTop'))
  const modals = read('src/options/components/OptionsModals.tsx')
  assert.ok(!modals.includes('requestAnimationFrame') && !modals.includes('target.focus()'))
  const picker = read('src/options/components/FolderPickerResults.tsx')
  assert.ok(picker.includes('preventScroll: true') && picker.includes('tree.scrollBy'))
  assert.ok(!picker.includes('setTimeout'))
})
