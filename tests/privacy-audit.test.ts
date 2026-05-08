import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import {
  appendPrivacyAuditLogEntry,
  clearPrivacyAuditLog,
  loadPrivacyAuditLog,
  normalizePrivacyAuditLog,
  PRIVACY_AUDIT_LOG_LIMIT
} from '../src/shared/privacy-audit.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'

afterEach(() => {
  delete (globalThis as any).chrome
})

test('normalizes privacy audit logs by recency, limit and safe fields', () => {
  const rawEntries = Array.from({ length: PRIVACY_AUDIT_LOG_LIMIT + 5 }, (_value, index) => ({
    id: `raw-${index}`,
    createdAt: 1000 + index,
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
  assert.equal(log.entries.length, PRIVACY_AUDIT_LOG_LIMIT)
  assert.equal(log.entries[0].id, `raw-${PRIVACY_AUDIT_LOG_LIMIT + 4}`)
  assert.equal(log.entries.at(-1)?.id, 'raw-5')
  assert.deepEqual(log.entries[0].fields, ['Title', 'URL', '正文片段'])
  assert.equal(log.entries[0].reason.length, 220)
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
    now: 2000
  })

  assert.equal(log.entries.length, 1)
  assert.equal(log.entries[0].label, 'Jina Reader 远程解析')
  assert.deepEqual(log.entries[0].fields, ['URL', 'title'])
  assert.equal(log.entries[0].includesBody, true)

  const loaded = await loadPrivacyAuditLog()
  assert.equal(loaded.entries[0].target, 'https://r.jina.ai/http://example.test')
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
