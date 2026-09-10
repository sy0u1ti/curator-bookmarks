import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAvailabilityResultSummary } from './availability-presentation.js'
import { buildFailureClassification } from './classifier.js'
import type { BookmarkRecord, NavigationAttempt } from '../../shared/types.js'

const bookmark: BookmarkRecord = {
  id: 'summary-fixture', title: 'Example', url: 'https://example.net/page',
  displayUrl: 'example.net/page', normalizedTitle: 'example', normalizedUrl: 'https://example.net/page',
  duplicateKey: 'https://example.net/page', domain: 'example.net', path: 'Bookmarks',
  parentId: '1', ancestorIds: ['1'], index: 0, dateAdded: 1
}
const httpFailure = (statusCode: number): NavigationAttempt => ({
  status: 'failed', finalUrl: bookmark.url, errorCode: 'http-' + statusCode,
  detail: '主请求返回 HTTP ' + statusCode,
  networkEvidence: { requestSent: true, requestedUrl: bookmark.url, statusCode, finalResponseObserved: true, redirects: [], timing: {} }
})

test('missing pages retain the login caveat from real classifier results', () => {
  for (const status of [404, 410]) {
    const result = buildFailureClassification(bookmark, [httpFailure(status)], null, false)
    const summary = getAvailabilityResultSummary(result)
    assert.equal(result.status, 'review')
    assert.ok(summary.includes(String(status)))
    assert.match(summary, /可能.*登录/)
    assert.doesNotMatch(summary, /已失效|已删除|直接删除/)
    assert.ok(summary.length < 65, 'scannable summary, with evidence retained in details')
  }
})

test('restrictions and transient HTTP errors recommend confirmation or retry', () => {
  for (const [status, expected] of [[401, /登录/], [403, /验证/], [429, /稍后/], [451, /人工确认/], [500, /稍后重试/], [503, /稍后重试/], [599, /稍后重试/]] as const) {
    const result = buildFailureClassification(bookmark, [httpFailure(status)], null, false)
    const summary = getAvailabilityResultSummary(result)
    assert.match(summary, expected)
    assert.doesNotMatch(summary, /已失效|直接删除/)
  }
})

test('browser limitations and network problems do not imply a dead bookmark', () => {
  for (const [code, expected] of [
    ['unsupported-dns-boundary', /验证.*确认/],
    ['net::ERR_PROXY_CONNECTION_FAILED', /代理.*重试/],
    ['net::ERR_INTERNET_DISCONNECTED', /网络.*重试/],
    ['net::ERR_CERT_AUTHORITY_INVALID', /证书/],
    ['ungranted-redirect', /授权/],
    ['detection-budget-exhausted', /时限/],
    ['site-cooldown', /暂缓/],
    ['sensitive-url', /保护规则/]
  ] as const) {
    const summary = getAvailabilityResultSummary({ status: 'review', errorCode: code })
    assert.match(summary, expected)
    assert.doesNotMatch(summary, /已失效|已删除|直接删除/)
  }
})

test('numbers in a URL, title, and timing are never treated as HTTP evidence', () => {
  for (const detail of ['地址 https://example.net/404', '检测耗时 503 ms', '书签：HTTP错误目录503', '本轮共 429 条书签']) {
    const summary = getAvailabilityResultSummary({ status: 'review', detail })
    assert.match(summary, /证据不足/)
    assert.doesNotMatch(summary, /移除|登录|请求过多|站点暂时/)
  }
})

test('current recovered and redirected states supersede old failure evidence', () => {
  assert.match(getAvailabilityResultSummary({ status: 'recovered', errorCode: 'http-404', detail: '上轮 HTTP 404' }), /确认可以访问/)
  assert.match(getAvailabilityResultSummary({ status: 'redirected', errorCode: 'http-404' }), /新地址/)
  assert.match(getAvailabilityResultSummary({ status: 'ignored', errorCode: 'http-503' }), /跳过/)
})

test('manual classification never invents repeated verification', () => {
  const summary = getAvailabilityResultSummary({ status: 'failed', badgeText: '手动移入异常' })
  assert.match(summary, /手动.*确认/)
  assert.doesNotMatch(summary, /多次验证|已确认失效/)
})
