import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  normalizeAiNamingCustomModels,
  normalizeAiNamingSettings,
  serializeAiNamingSettings
} from '../src/options/sections/ai-settings.js'

test('normalizes AI naming settings with defaults and bounded numeric values', () => {
  const settings = normalizeAiNamingSettings({
    baseUrl: '  https://api.example.com/v1/ ',
    apiKey: ' key ',
    model: ' model-a ',
    apiStyle: 'unknown',
    timeoutMs: 100,
    batchSize: 999,
    autoSelectHighConfidence: false,
    systemPrompt: ' prompt '
  })

  assert.equal(settings.baseUrl, 'https://api.example.com/v1/')
  assert.equal(settings.apiKey, 'key')
  assert.equal(settings.model, 'model-a')
  assert.equal(settings.apiStyle, 'responses')
  assert.equal(settings.timeoutMs, 5000)
  assert.equal(settings.batchSize, 20)
  assert.equal(settings.autoSelectHighConfidence, false)
  assert.equal(settings.allowRemoteParsing, false)
  assert.equal(settings.autoAnalyzeBookmarks, false)
  assert.equal(settings.systemPrompt, 'prompt')
})

test('normalizes custom model lists from text and removes duplicates case-insensitively', () => {
  assert.deepEqual(
    normalizeAiNamingCustomModels('gpt-test\nGPT-TEST, provider/model ; other-model'),
    ['gpt-test', 'provider/model', 'other-model']
  )
})

test('serializes normalized AI naming settings without sharing mutable arrays', () => {
  const settings = normalizeAiNamingSettings({
    customModels: ['model-a'],
    fetchedModels: ['model-b'],
    allowRemoteParsing: true,
    autoAnalyzeBookmarks: true
  })
  const serialized = serializeAiNamingSettings(settings)

  serialized.customModels.push('mutated')
  serialized.fetchedModels.push('mutated')

  assert.deepEqual(settings.customModels, ['model-a'])
  assert.deepEqual(settings.fetchedModels, ['model-b'])
  assert.equal(serialized.allowRemoteParsing, true)
  assert.equal(serialized.autoAnalyzeBookmarks, true)
})

test('uses gpt-5.5 as the default AI model', () => {
  const settings = normalizeAiNamingSettings({})

  assert.equal(settings.model, 'gpt-5.5')
})
