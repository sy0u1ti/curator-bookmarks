import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import {
  appendPrivacyAuditLogEntry,
  clearPrivacyAuditLog,
  loadPrivacyAuditLog,
  normalizePrivacyAuditLog,
  PRIVACY_AUDIT_LOG_RETENTION_LIMIT
} from '../src/shared/privacy-audit.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'

afterEach(() => {
  delete (globalThis as any).chrome
})

test('normalizes privacy audit logs by recency, limit and safe fields', () => {
  const now = Date.now()
  const rawEntries = Array.from({ length: PRIVACY_AUDIT_LOG_RETENTION_LIMIT + 5 }, (_value, index) => ({
    id: `raw-${index}`,
    createdAt: now - index,
    feature: index === 0 ? 'unknown-feature' : 'ai-naming',
    target: index % 2 ? 'https://api.example.test' : '',
    itemCount: index,
    fields: ['Title', 'title', 'URL', '', '正文片段'],
    includesBody: index % 3 === 0,
    status: index % 4 === 0 ? 'error' : 'success',
    reason: 'x'.repeat(300)
  }))

  const log = normalizePrivacyAuditLog({
    updatedAt: 500,
    entries: rawEntries
  })

  assert.equal(log.version, 1)
  assert.equal(log.entries.length, PRIVACY_AUDIT_LOG_RETENTION_LIMIT)
  assert.equal(log.entries[0].id, 'raw-0')
  assert.equal(log.entries.at(-1)?.id, `raw-${PRIVACY_AUDIT_LOG_RETENTION_LIMIT - 1}`)
  assert.deepEqual(log.entries[0].fields, ['Title', 'URL', '正文片段'])
  assert.equal(log.entries[0].reason.length, 220)
})

test('privacy audit logs redact URL query and expire old entries', () => {
  const now = Date.now()
  const log = normalizePrivacyAuditLog({
    entries: [
      {
        id: 'fresh',
        createdAt: now,
        feature: 'ai-connectivity-test',
        target: 'https://api.example.test/v1/models?api_key=secret&query=bookmark',
        fields: ['Authorization: Bearer fixture-secret', 'API Key=fixture-secret', 'URL query'],
        reason: 'Authorization: Bearer fixture-secret apiKey=fixture-secret',
        status: 'success'
      },
      {
        id: 'expired',
        createdAt: now - 8 * 24 * 60 * 60 * 1000,
        feature: 'jina-reader',
        target: 'https://r.jina.ai/http://example.test/?token=secret',
        fields: ['URL'],
        reason: 'old',
        status: 'success'
      }
    ]
  })

  assert.equal(log.entries.length, 1)
  assert.equal(log.entries[0].id, 'fresh')
  assert.equal(log.entries[0].target, 'https://api.example.test')
  assert.equal(log.entries[0].targetDomain, 'api.example.test')
  assert.doesNotMatch(JSON.stringify(log), /fixture-secret|bookmark|token=secret/)
})

test('appends and clears privacy audit entries in local extension storage', async () => {
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeStorageMock(store)

  const log = await appendPrivacyAuditLogEntry({
    feature: 'jina-reader',
    target: 'https://r.jina.ai/http://example.test',
    itemCount: 2,
    fields: 'URL, title, URL',
    includesBody: true,
    status: 'success',
    reason: '用户主动远程解析',
    now: Date.now()
  })

  assert.equal(log.entries.length, 1)
  assert.equal(log.entries[0].label, 'Jina Reader 远程解析')
  assert.deepEqual(log.entries[0].fields, ['URL', 'title'])
  assert.equal(log.entries[0].includesBody, true)

  const loaded = await loadPrivacyAuditLog()
  assert.equal(loaded.entries[0].target, 'https://r.jina.ai')
  assert.equal(loaded.entries[0].targetDomain, 'r.jina.ai')
  assert.equal(
    normalizePrivacyAuditLog(store[STORAGE_KEYS.privacyAuditLog]).entries[0].itemCount,
    2
  )

  await clearPrivacyAuditLog()
  assert.deepEqual(normalizePrivacyAuditLog(store[STORAGE_KEYS.privacyAuditLog]).entries, [])
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
