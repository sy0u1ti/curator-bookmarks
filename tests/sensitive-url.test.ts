import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assessSensitiveExternalUrl,
  isExternallyCheckableUrl
} from '../src/shared/sensitive-url.js'
import {
  collectRequestOrigins,
  getOriginPermissionPattern,
  isCheckableUrl
} from '../src/options/shared-options/permissions.js'

test('sensitive external URL policy skips private and account-like destinations', () => {
  const cases = [
    ['http://localhost:3000/dashboard', 'local-network'],
    ['https://192.168.1.10/admin', 'local-network'],
    ['https://mail.google.com/mail/u/0/#inbox', 'email-page'],
    ['https://example.com/login?next=/billing', 'account-login-page'],
    ['https://bank.example.com/account', 'financial-page'],
    ['https://clinic.example.com/patient/123', 'medical-page'],
    ['https://docs.google.com/document/d/private-id/edit', 'document-collaboration-page']
  ] as const

  for (const [url, reason] of cases) {
    const decision = assessSensitiveExternalUrl(url)

    assert.equal(decision.sensitive, true, url)
    assert.equal(decision.reason, reason, url)
    assert.match(decision.warning, /敏感 URL 保护|内网|外部请求/)
    assert.equal(isExternallyCheckableUrl(url), false)
  }
})

test('sensitive external URL policy allows ordinary public http and https pages', () => {
  for (const url of [
    'https://developer.mozilla.org/en-US/docs/Web/API',
    'https://github.com/sy0u1ti/curator-bookmarks',
    'http://example.com/articles/bookmarks'
  ]) {
    assert.deepEqual(assessSensitiveExternalUrl(url), {
      sensitive: false,
      reason: '',
      warning: ''
    })
    assert.equal(isExternallyCheckableUrl(url), true)
  }
})

test('availability and AI permission helpers exclude sensitive external URL origins', () => {
  const bookmarks = [
    { url: 'https://developer.mozilla.org/en-US/docs/Web/API' },
    { url: 'https://mail.google.com/mail/u/0/#inbox' },
    { url: 'https://docs.google.com/document/d/private-id/edit' },
    { url: 'http://localhost:5173/' }
  ]

  assert.equal(isCheckableUrl(bookmarks[0].url), true)
  assert.equal(isCheckableUrl(bookmarks[1].url), false)
  assert.equal(getOriginPermissionPattern(bookmarks[0].url), 'https://developer.mozilla.org/*')
  assert.equal(getOriginPermissionPattern(bookmarks[1].url), 'https://mail.google.com/*')
  assert.deepEqual(collectRequestOrigins(bookmarks), ['https://developer.mozilla.org/*'])
})
