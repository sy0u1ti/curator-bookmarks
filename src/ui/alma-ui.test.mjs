import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

async function load(entry) {
  const { outputFiles } = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
}
const { searchSettings, resolveSettingsSearchTarget, SETTINGS_SEARCH_ITEMS } = await load('src/options/settings-search.ts')
const { synchronizeAmbientAnimations } = await load('src/shared/ambient-motion.ts')

test('settings lookup ranks public labels, accepts normalized aliases and requires every query term', () => {
  assert.equal(searchSettings('光标')[0].id, 'general:input-caret')
  assert.equal(searchSettings('ＣＡＲＥＴ')[0].id, 'general:input-caret')
  assert.equal(searchSettings('api key')[0].id, 'ai-settings:api-key')
  assert.equal(searchSettings('网页 索引')[0].id, 'general:content-index')
  assert.equal(searchSettings('自动 恢复')[0].id, 'backup:recovery')
  assert.deepEqual(searchSettings(''), [])
  assert.deepEqual(searchSettings('!?'), [])
  assert.deepEqual(searchSettings('不存在的设置'), [])
  assert.equal(searchSettings('AI 服务配置').filter(item => item.label === 'AI 服务配置').length, 1)
})

test('every settings destination has a unique stable id and unknown anchors cannot select arbitrary elements', () => {
  assert.equal(new Set(SETTINGS_SEARCH_ITEMS.map(item => item.id)).size, SETTINGS_SEARCH_ITEMS.length)
  for (const item of SETTINGS_SEARCH_ITEMS) {
    assert.equal(resolveSettingsSearchTarget(item.section, item.anchor), item)
  }
  assert.equal(resolveSettingsSearchTarget('general', 'constructor'), undefined)
  assert.equal(resolveSettingsSearchTarget('general', '#ai-api-key'), undefined)
})

test('new ambient loops join the timeline while paused loops stay paused and exits retain their timing', () => {
  const loop = { animationName: 't-shimmer', playState: 'running', startTime: 300, currentTime: 20 }
  const paused = { animationName: 'sheen-progress-sweep', playState: 'paused', startTime: null, currentTime: 10 }
  const exit = { animationName: 'curator-list-exit', playState: 'running', startTime: 200, currentTime: 50 }
  const staggered = { animationName: 'dot-matrix-bar', playState: 'running', startTime: 500, currentTime: 10 }
  synchronizeAmbientAnimations([loop, paused, exit, staggered], 4500)
  assert.equal(loop.startTime, 0)
  assert.deepEqual(paused, { animationName: 'sheen-progress-sweep', playState: 'paused', startTime: null, currentTime: 4500 })
  assert.equal(exit.startTime, 200)
  assert.equal(staggered.startTime, 500)
  const cancelled = { animationName: 't-shimmer', playState: 'idle', startTime: null, currentTime: null }
  synchronizeAmbientAnimations([cancelled], 4500)
  assert.equal(cancelled.startTime, null)
  loop.startTime = 200
  synchronizeAmbientAnimations([loop], null)
  assert.equal(loop.startTime, 200)
})
