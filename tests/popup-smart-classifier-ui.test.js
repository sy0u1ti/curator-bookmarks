import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('smart classifier result title input does not render a redundant indicator slot', () => {
  const popupSource = readProjectFile('src/popup/popup.ts')
  const start = popupSource.indexOf('function renderSmartResultCard')
  const end = popupSource.indexOf('function renderSmartRecommendation')

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  const resultCardSource = popupSource.slice(start, end)
  assert.match(resultCardSource, /id="smart-title-input"/)
  assert.doesNotMatch(resultCardSource, /smart-edit-indicator/)
})

test('smart classifier active state hides advanced search help controls', () => {
  const popupStyles = readProjectFile('src/popup/popup.css')

  assert.match(
    popupStyles,
    /body\.smart-active \.search-help-toggle\s*\{[^}]*display:\s*none;/s
  )
})

test('smart classifier failure and permission states expose AI settings entry', () => {
  const popupSource = readProjectFile('src/popup/popup.ts')
  const popupStyles = readProjectFile('src/popup/popup.css')
  const errorStart = popupSource.indexOf("if (state.smartStatus === 'error')")
  const permissionStart = popupSource.indexOf('function renderSmartPermissionCard')
  const permissionEnd = popupSource.indexOf('function renderPopupLoadingStack')

  assert.notEqual(errorStart, -1)
  assert.notEqual(permissionStart, -1)
  assert.notEqual(permissionEnd, -1)

  const errorSource = popupSource.slice(errorStart, permissionStart)
  const permissionSource = popupSource.slice(permissionStart, permissionEnd)

  assert.match(errorSource, /data-smart-action="open-ai-settings"[\s\S]*?AI 设置/)
  assert.match(errorSource, /data-smart-action="manual-folder"[\s\S]*?data-smart-action="open-ai-settings"[\s\S]*?data-smart-action="classify"/)
  assert.match(permissionSource, /data-smart-action="manual-folder"[\s\S]*?data-smart-action="open-ai-settings"[\s\S]*?data-smart-action="grant-permission"/)
  assert.match(popupSource, /action === 'open-ai-settings'[\s\S]*?openSettingsPage\('ai-provider'\)/)
  assert.match(popupStyles, /\.smart-settings-action\s*\{/)
})
