import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  normalizeAiNamingCustomModels,
  normalizeAiNamingSettings,
  serializeAiNamingSettings
} from '../src/options/sections/ai-settings.js'
import {
  getAiProviderBaseUrlIssue,
  isAllowedAiProviderBaseUrl
} from '../src/shared/ai-provider-url.js'
import {
  getAiUsageRemaining,
  normalizeAiDailyLimit,
  normalizeAiUsageLedger,
  reserveAiUsage
} from '../src/shared/ai-usage.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'

test('normalizes AI naming settings with defaults and bounded numeric values', () => {
  const settings = normalizeAiNamingSettings({
    baseUrl: '  https://api.example.com/v1/ ',
    apiKey: ' key ',
    model: ' model-a ',
    apiStyle: 'unknown',
    timeoutMs: 100,
    batchSize: 999,
    dailyLimit: 5000,
    autoSelectHighConfidence: false,
    systemPrompt: ' prompt '
  })

  assert.equal(settings.baseUrl, 'https://api.example.com/v1/')
  assert.equal(settings.apiKey, 'key')
  assert.equal(settings.model, 'model-a')
  assert.equal(settings.apiStyle, 'responses')
  assert.equal(settings.timeoutMs, 5000)
  assert.equal(settings.batchSize, 20)
  assert.equal(settings.dailyLimit, 1000)
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
  assert.equal(serialized.dailyLimit, settings.dailyLimit)
})

test('uses gpt-5.5 as the default AI model', () => {
  const settings = normalizeAiNamingSettings({})

  assert.equal(settings.model, 'gpt-5.5')
})

test('AI provider Base URL requires https except localhost development endpoints', () => {
  assert.equal(isAllowedAiProviderBaseUrl('https://api.example.com/v1'), true)
  assert.equal(isAllowedAiProviderBaseUrl('http://localhost:11434/v1'), true)
  assert.equal(isAllowedAiProviderBaseUrl('http://127.0.0.1:11434/v1'), true)
  assert.equal(isAllowedAiProviderBaseUrl('http://api.example.com/v1'), false)
  assert.match(getAiProviderBaseUrlIssue('http://api.example.com/v1'), /必须使用 https/)
  assert.match(getAiProviderBaseUrlIssue('file:///tmp/model'), /仅支持 https/)
})

test('AI usage ledger resets daily and enforces configured request limits', async () => {
  const now = new Date(2026, 4, 8, 10).getTime()
  const yesterday = new Date(2026, 4, 7, 10).getTime()
  assert.equal(normalizeAiDailyLimit(5000), 1000)
  assert.equal(normalizeAiDailyLimit('bad'), 120)
  assert.equal(
    normalizeAiUsageLedger({ dayKey: '2026-05-07', used: 80, updatedAt: yesterday }, now).used,
    0
  )
  assert.equal(
    getAiUsageRemaining({ dayKey: '2026-05-08', used: 9, updatedAt: now }, 12, now),
    3
  )

  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeStorageMock(store)
  try {
    await reserveAiUsage({
      feature: 'ai-naming',
      itemCount: 3,
      dailyLimit: 4,
      now
    })
    assert.equal((store[STORAGE_KEYS.aiUsageLedger] as any).used, 3)
    await assert.rejects(
      reserveAiUsage({
        feature: 'popup-natural-search',
        itemCount: 2,
        dailyLimit: 4,
        now
      }),
      /今日 AI 请求上限已达到/
    )
  } finally {
    delete (globalThis as any).chrome
  }
})

function createChromeStorageMock(store: Record<string, unknown>) {
  let lastError: { message: string } | undefined

  return {
    runtime: {
      get lastError() {
        return lastError
      }
    },
    storage: {
      local: {
        get(keys: string[] | string | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void) {
          lastError = undefined
          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((key) => [key, store[key]])))
            return
          }
          if (typeof keys === 'string') {
            callback({ [keys]: store[keys] })
            return
          }
          callback({ ...store })
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          lastError = undefined
          Object.assign(store, payload)
          callback()
        }
      }
    }
  }
}
