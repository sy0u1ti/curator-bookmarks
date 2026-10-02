import ipaddr from 'ipaddr.js'

export type SensitiveExternalUrlReason =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'local-network'
  | 'capability-action'
  | 'account-login-page'
  | 'email-page'
  | 'financial-page'
  | 'medical-page'
  | 'document-collaboration-page'

export interface SensitiveExternalUrlDecision {
  sensitive: boolean
  reason: SensitiveExternalUrlReason | ''
  warning: string
}

const ACCOUNT_PATH_RE = /(?:^|\/)(?:login|log-in|signin|sign-in|signup|sign-up|account|accounts|auth|oauth|sso|session|sessions)(?:\/|$)/i
const FINANCIAL_PATH_RE = /(?:^|\/)(?:checkout|billing|bill|payment|payments|pay|bank|wallet|invoice|invoices|subscription|subscriptions)(?:\/|$)/i
const MEDICAL_PATH_RE = /(?:^|\/)(?:medical|health|patient|patients|clinic|hospital|mychart)(?:\/|$)/i
const DOCUMENT_PATH_RE = /(?:^|\/)(?:document|documents|doc|docs|workspace|workspaces|share|shared)(?:\/|$)/i
const CAPABILITY_ACTION_PATH_RE = /(?:^|\/)(?:logout|log[-_]?out|signout|sign[-_]?out|unsubscribe|reset|password[-_]?reset|reset[-_]?password|verify|verification|confirm|confirmation|delete|remove|activate|magic[-_]?(?:link|login)|accept[-_]?invite|(?:verify|confirm|activate)[-_]?(?:email|account|invite))(?:\/|$)/i
const CAPABILITY_QUERY_KEY_RE = /^(?:(?:access|refresh|id|auth|session)[_-]?token|token|code|oob[_-]?code|jwt|ticket|credential|credentials|key|api[_-]?key|secret|signature|sig|auth|authorization|password|passwd|reset[_-]?password[_-]?token|confirmation[_-]?token|verification[_-]?token|invitation[_-]?token|x-amz-.+|x-goog-.+)$/i
const CAPABILITY_ACTION_QUERY_KEY_RE = /^(?:action|operation|op|cmd|command|do)$/i
const CAPABILITY_ACTION_QUERY_VALUE_RE = /^(?:accept[-_]?(?:invite|invitation)|activate(?:[-_]?(?:account|email))?|cancel|confirm(?:[-_]?(?:account|email|invite))?|delete|disable|logout|log[-_]?out|remove|reset(?:[-_]?password)?|revoke|signout|sign[-_]?out|unsubscribe|verify(?:[-_]?(?:account|email|invite))?)$/i
const PRIVATE_DNS_ALIAS_HOSTS = [
  'home.arpa',
  'local.gd',
  'localtest.me',
  'localhost.direct',
  'lvh.me',
  'nip.io',
  'sslip.io',
  'traefik.me',
  'vcap.me',
  'vcaps.me',
  'xip.io'
]

const HOST_NETWORK_CACHE_LIMIT = 512
const hostNetworkCache = new Map<string, boolean>()
// Every IPv4 notation ipaddr.js accepts is made of these parts, and IPv6 needs
// a colon. Other hostnames cannot be IP literals, so they skip ipaddr's
// exception-driven validation, which dominated large catalog scans.
const IPV4_LITERAL_CANDIDATE_RE = /^(?:0?\d+|0x[a-f0-9]+)(?:\.(?:0?\d+|0x[a-f0-9]+)){0,3}$/i

// A decision depends only on the URL text. Options assesses one catalog for
// several scopes and permission checks, so each URL is classified once.
const URL_REASON_CACHE_LIMIT = 50000
const urlReasonCache = new Map<string, SensitiveExternalUrlReason | ''>()

const EMAIL_HOSTS = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'mail.yahoo.com',
  'proton.me',
  'protonmail.com',
  'icloud.com'
]

const DOCUMENT_COLLAB_HOSTS = [
  'docs.google.com',
  'drive.google.com',
  'onedrive.live.com',
  'sharepoint.com',
  'notion.so',
  'notion.site',
  'coda.io',
  'airtable.com',
  'figma.com'
]

const FINANCIAL_HOST_PARTS = [
  'bank',
  'paypal',
  'stripe',
  'wise',
  'revolut',
  'alipay',
  'wechatpay',
  'pay.google',
  'payments.google',
  'checkout'
]

const MEDICAL_HOST_PARTS = [
  'health',
  'medical',
  'clinic',
  'hospital',
  'mychart'
]

const WARNING_BY_REASON: Record<SensitiveExternalUrlReason, string> = {
  'invalid-url': '网页地址无效，已跳过外部请求。',
  'unsupported-scheme': '该链接类型不适合外部检测或远程解析，已跳过外部请求。',
  'local-network': '该链接属于本机、内网或私有网络地址，已按敏感 URL 保护跳过外部请求。',
  'capability-action': '该链接可能包含一次性凭据或触发账号操作，已按敏感 URL 保护跳过外部请求。',
  'account-login-page': '该链接看起来是登录、账号或鉴权入口，已按敏感 URL 保护跳过外部请求。',
  'email-page': '该链接看起来是邮箱页面，已按敏感 URL 保护跳过外部请求。',
  'financial-page': '该链接看起来是银行、支付或账单页面，已按敏感 URL 保护跳过外部请求。',
  'medical-page': '该链接看起来是医疗或健康页面，已按敏感 URL 保护跳过外部请求。',
  'document-collaboration-page': '该链接看起来是文档协作或私有工作区页面，已按敏感 URL 保护跳过外部请求。'
}

export function assessSensitiveExternalUrl(url: unknown): SensitiveExternalUrlDecision {
  const input = String(url || '').trim()
  let reason = urlReasonCache.get(input)
  if (reason === undefined) {
    reason = classifySensitiveExternalUrl(input)
    if (urlReasonCache.size >= URL_REASON_CACHE_LIMIT) {
      urlReasonCache.clear()
    }
    urlReasonCache.set(input, reason)
  }

  if (reason) {
    return buildSensitiveDecision(reason)
  }

  return {
    sensitive: false,
    reason: '',
    warning: ''
  }
}

function classifySensitiveExternalUrl(url: string): SensitiveExternalUrlReason | '' {
  const parsedUrl = parseUrl(url)
  if (!parsedUrl) {
    return 'invalid-url'
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    return 'unsupported-scheme'
  }

  if (parsedUrl.username || parsedUrl.password) {
    return 'capability-action'
  }

  const hostname = normalizeHostname(parsedUrl.hostname)
  const pathname = decodePathname(parsedUrl.pathname)

  if (isLocalOrPrivateHostname(hostname)) {
    return 'local-network'
  }

  if (
    CAPABILITY_ACTION_PATH_RE.test(pathname) ||
    hasCapabilityParameter(parsedUrl)
  ) {
    return 'capability-action'
  }

  if (matchesHost(hostname, EMAIL_HOSTS)) {
    return 'email-page'
  }

  if (matchesHost(hostname, DOCUMENT_COLLAB_HOSTS)) {
    return 'document-collaboration-page'
  }

  if (hostIncludesAny(hostname, FINANCIAL_HOST_PARTS) || FINANCIAL_PATH_RE.test(pathname)) {
    return 'financial-page'
  }

  if (hostIncludesAny(hostname, MEDICAL_HOST_PARTS) || MEDICAL_PATH_RE.test(pathname)) {
    return 'medical-page'
  }

  if (ACCOUNT_PATH_RE.test(pathname)) {
    return 'account-login-page'
  }

  if (DOCUMENT_PATH_RE.test(pathname) && isLikelyPrivateWorkspaceHost(hostname)) {
    return 'document-collaboration-page'
  }

  return ''
}

export function isExternallyCheckableUrl(url: unknown): boolean {
  return !assessSensitiveExternalUrl(url).sensitive
}

function buildSensitiveDecision(reason: SensitiveExternalUrlReason): SensitiveExternalUrlDecision {
  return {
    sensitive: true,
    reason,
    warning: WARNING_BY_REASON[reason]
  }
}

function parseUrl(url: unknown): URL | null {
  try {
    return new URL(String(url || '').trim())
  } catch {
    return null
  }
}

function normalizeHostname(hostname: string): string {
  return String(hostname || '')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .replace(/^www\./i, '')
    .toLowerCase()
}

function decodePathname(pathname: string): string {
  const value = String(pathname || '')
  // Without an escape sequence decodeURIComponent returns its input unchanged.
  if (!value.includes('%')) {
    return value
  }
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function hasCapabilityParameter(url: URL): boolean {
  // An empty search or hash has no parameters; skip building their parsers.
  if (url.search && hasCapabilityQueryEntry(url.searchParams)) {
    return true
  }

  if (!url.hash) {
    return false
  }

  const rawHash = decodePathname(url.hash.replace(/^#/, ''))
  const fragmentQuery = rawHash.includes('?')
    ? rawHash.slice(rawHash.indexOf('?') + 1)
    : rawHash
  return hasCapabilityQueryEntry(new URLSearchParams(fragmentQuery))
}

function hasCapabilityQueryEntry(params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (
      CAPABILITY_QUERY_KEY_RE.test(key) ||
      (
        CAPABILITY_ACTION_QUERY_KEY_RE.test(key) &&
        CAPABILITY_ACTION_QUERY_VALUE_RE.test(String(value || '').trim())
      )
    ) {
      return true
    }
  }
  return false
}

function matchesHost(hostname: string, hosts: string[]): boolean {
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

function hostIncludesAny(hostname: string, fragments: string[]): boolean {
  return fragments.some((fragment) => hostname.includes(fragment))
}

function isLikelyPrivateWorkspaceHost(hostname: string): boolean {
  return matchesHost(hostname, [
    'google.com',
    'microsoft.com',
    'office.com',
    'live.com',
    'notion.so',
    'notion.site',
    'coda.io',
    'airtable.com',
    'figma.com'
  ])
}

function isLocalOrPrivateHostname(hostname: string): boolean {
  if (!hostname) {
    return false
  }

  const cached = hostNetworkCache.get(hostname)
  if (cached !== undefined) {
    return cached
  }

  // This classification only uses static hostname/IP rules, never DNS or URL
  // paths. Keep per-URL capability and sensitive-page checks outside the cache.
  const result = classifyLocalOrPrivateHostname(hostname)
  if (hostNetworkCache.size >= HOST_NETWORK_CACHE_LIMIT) {
    hostNetworkCache.delete(hostNetworkCache.keys().next().value!)
  }
  hostNetworkCache.set(hostname, result)
  return result
}

function classifyLocalOrPrivateHostname(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    matchesHost(hostname, PRIVATE_DNS_ALIAS_HOSTS)
  ) {
    return true
  }

  const address = hostname.replace(/^\[|\]$/g, '')
  if (!isIpLiteralCandidate(address) || !ipaddr.isValid(address)) {
    return false
  }

  return !isPublicNetworkAddress(address)
}

function isIpLiteralCandidate(address: string): boolean {
  return address.includes(':') || IPV4_LITERAL_CANDIDATE_RE.test(address)
}

export function isPublicNetworkAddress(value: unknown): boolean {
  const address = String(value || '').trim().replace(/^\[|\]$/g, '')
  if (!ipaddr.isValid(address)) {
    return false
  }
  return ipaddr.process(address).range() === 'unicast'
}

export function isVerifiedHttpsLoopbackProxyResponse({
  url,
  resolvedAddress,
  connectedAddress,
  statusCode
}: {
  url: unknown
  resolvedAddress: unknown
  connectedAddress: unknown
  statusCode: unknown
}): boolean {
  const normalizedConnectedAddress = String(connectedAddress || '')
    .trim()
    .replace(/^\[|\]$/g, '')
  const normalizedStatusCode = Number(statusCode)

  if (
    !isPublicNetworkAddress(resolvedAddress) ||
    !ipaddr.isValid(normalizedConnectedAddress) ||
    ipaddr.process(normalizedConnectedAddress).range() !== 'loopback' ||
    !Number.isInteger(normalizedStatusCode) ||
    normalizedStatusCode < 100 ||
    normalizedStatusCode > 599
  ) {
    return false
  }

  try {
    return new URL(String(url || '').trim()).protocol === 'https:'
  } catch {
    return false
  }
}
