import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('shortcut settings do not expose the browser action activation command', () => {
  const manifest = JSON.parse(readProjectFile('src/manifest.json'))
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.equal(Object.hasOwn(manifest.commands || {}, '_execute_action'), false)
  assert.doesNotMatch(optionsSource, /_execute_action|打开 Popup/)
})

test('manifest delays host access until user-triggered optional permission requests', () => {
  const manifest = JSON.parse(readProjectFile('src/manifest.json'))

  assert.equal(Object.hasOwn(manifest, 'host_permissions'), false)
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*'])
})

test('manifest description uses the approved local-first positioning', () => {
  const manifest = JSON.parse(readProjectFile('src/manifest.json'))

  assert.equal(manifest.description, '本地优先的 Chrome 书签搜索、整理、清理与新标签页扩展。')
  assert.doesNotMatch(manifest.description, /完全本地|绝不联网|100%|秒搜/)
})
