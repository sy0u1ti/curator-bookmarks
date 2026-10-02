import assert from 'node:assert/strict'
import ipaddr from 'ipaddr.js'
import {
  assessSensitiveExternalUrl,
  isPublicNetworkAddress,
  isVerifiedHttpsLoopbackProxyResponse
} from './sensitive-url.js'

for (const url of [
  'http://[::ffff:127.0.0.1]/',
  'http://[::ffff:7f00:1]/',
  'http://[fe81::1]/',
  'http://[febf::1]/',
  'http://100.64.0.1/',
  'http://printer.home.arpa/',
  'http://127.0.0.1.nip.io/admin',
  'http://127.0.0.1.sslip.io/admin',
  'http://anything.localtest.me/admin',
  'http://service.lvh.me/admin',
  'http://localhost.direct/admin',
  'http://service.local.gd/admin'
]) {
  assert.equal(
    assessSensitiveExternalUrl(url).reason,
    'local-network',
    `${url} must not bypass private-network protection`
  )
}

for (const url of [
  'https://example.com/unsubscribe?user=1',
  'https://example.com/reset-password?user=1',
  'https://example.com/password_reset/SECRET',
  'https://example.com/magic-login/SECRET',
  'https://example.com/verify-email/SECRET',
  'https://example.com/confirm-email/SECRET',
  'https://example.com/activate-account/SECRET',
  'https://example.com/download?token=secret',
  'https://example.com/download?jwt=secret',
  'https://example.com/callback?refresh_token=secret',
  'https://example.com/callback?id_token=secret',
  'https://example.com/callback?auth-token=secret',
  'https://example.com/callback?session_token=secret',
  'https://example.com/verify?oobCode=secret',
  'https://example.com/#access_token=secret',
  'https://example.com/#refresh-token=secret',
  'https://example.com/path?action=delete&id=1',
  'https://example.com/path?operation=unsubscribe&id=1',
  'https://example.com/#cmd=activate-account&id=1',
  'https://example.com/file?X-Amz-Signature=secret',
  'https://user:password@example.com/'
]) {
  assert.equal(
    assessSensitiveExternalUrl(url).reason,
    'capability-action',
    `${url} must not be requested as an availability probe`
  )
}

assert.equal(
  assessSensitiveExternalUrl('https://example.com/articles?topic=typescript').sensitive,
  false
)
assert.equal(isPublicNetworkAddress('8.8.8.8'), true)
assert.equal(isPublicNetworkAddress('127.0.0.1'), false)
assert.equal(isPublicNetworkAddress('::ffff:10.0.0.1'), false)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '127.0.0.1',
    statusCode: 200
  }),
  true,
  'an authenticated HTTPS response may arrive through a loopback proxy'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'http://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '127.0.0.1',
    statusCode: 200
  }),
  false,
  'an unauthenticated HTTP response must not relax the private endpoint boundary'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '127.0.0.1',
    statusCode: 0
  }),
  false,
  'a loopback connection without response headers must remain unverified'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '127.0.0.1',
    connectedAddress: '127.0.0.1',
    statusCode: 200
  }),
  false,
  'a hostname that resolves directly to loopback must remain protected'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '192.168.1.10',
    statusCode: 200
  }),
  false,
  'non-loopback private endpoints must not be inferred to be local proxies'
)

const originalIsValid = ipaddr.isValid
let hostParseCount = 0
try {
  ipaddr.isValid = (address: string) => {
    hostParseCount += 1
    return originalIsValid(address)
  }
  for (let index = 0; index < 2000; index++) {
    assert.equal(assessSensitiveExternalUrl(`https://performance-fixture.example.test/article/${index}`).sensitive, false)
  }
  assert.equal(hostParseCount, 0, 'Hostnames that cannot be IP literals must skip address parsing')
  assert.equal(assessSensitiveExternalUrl('https://93.184.216.34/article/0').sensitive, false)
  const afterFirstAddress = hostParseCount
  for (let index = 1; index < 2000; index++) {
    assert.equal(assessSensitiveExternalUrl(`https://93.184.216.34/article/${index}`).sensitive, false)
  }
  assert.equal(hostParseCount, afterFirstAddress, 'Repeated bookmarks on one address should reuse its static network classification')
  assert.equal(assessSensitiveExternalUrl('https://performance-fixture.example.test/login').reason, 'account-login-page')
  assert.equal(assessSensitiveExternalUrl('https://performance-fixture.example.test/articles?token=secret').reason, 'capability-action')
  assert.equal(assessSensitiveExternalUrl('https://performance-fixture.example.test/#action=delete').reason, 'capability-action')
  assert.equal(assessSensitiveExternalUrl('https://user:password@performance-fixture.example.test/articles').reason, 'capability-action')
  assert.equal(assessSensitiveExternalUrl('https://performance-fixture.example.test/payment').reason, 'financial-page')
  assert.equal(assessSensitiveExternalUrl('https://performance-fixture.example.test/articles').sensitive, false)

  for (let index = 0; index < 2000; index++) {
    assert.equal(assessSensitiveExternalUrl(`https://cache-churn-${index}.example.test/articles`).sensitive, false)
  }
  const beforeReload = hostParseCount
  assert.equal(assessSensitiveExternalUrl('https://93.184.216.34/other-article').sensitive, false)
  assert.ok(hostParseCount > beforeReload, 'The hostname cache must evict old entries instead of growing with the entire catalog')
  assert.equal(assessSensitiveExternalUrl('http://127.0.0.1/articles').reason, 'local-network')
  assert.equal(assessSensitiveExternalUrl('https://8.8.8.8/articles').sensitive, false)
  assert.equal(assessSensitiveExternalUrl('https://8.8.8.8/logout').reason, 'capability-action')
} finally {
  ipaddr.isValid = originalIsValid
}

// Numeric host notations reach this check in their canonical dotted form;
// look-alike hostnames that are not addresses must stay public.
for (const url of ['http://0x7f.0.0.1/', 'http://2130706433/', 'http://0177.0.0.1/', 'http://10.1/', 'http://[::1]/']) {
  assert.equal(assessSensitiveExternalUrl(url).reason, 'local-network', `${url} is a private address`)
}
for (const url of ['https://1password.com/', 'https://123.example.com/', 'https://0xdead.example/', 'https://1e100.net/']) {
  assert.equal(assessSensitiveExternalUrl(url).sensitive, false, `${url} is not an address literal`)
}

// Cached decisions are returned as fresh objects, and query or fragment rules
// still apply to URLs that share a host with public pages.
const cachedDecision = assessSensitiveExternalUrl('https://example.com/cached')
cachedDecision.sensitive = true
assert.equal(assessSensitiveExternalUrl('https://example.com/cached').sensitive, false)
assert.equal(assessSensitiveExternalUrl('https://example.com/cached?').sensitive, false)
assert.equal(assessSensitiveExternalUrl('https://example.com/cached#').sensitive, false)
assert.equal(assessSensitiveExternalUrl('https://example.com/%E7%99%BB%E5%BD%95/login').reason, 'account-login-page')
assert.equal(assessSensitiveExternalUrl('https://example.com/%E0%A4%A').sensitive, false)
assert.equal(assessSensitiveExternalUrl('https://example.com/cached#section?token=secret').reason, 'capability-action')
assert.equal(assessSensitiveExternalUrl('  https://example.com/cached?token=secret  ').reason, 'capability-action')

console.log('Sensitive URL boundary and repeated-host performance tests passed.')
