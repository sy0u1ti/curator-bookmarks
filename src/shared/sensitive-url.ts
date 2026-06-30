export type SensitiveExternalUrlReason =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'local-network'
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
  'account-login-page': '该链接看起来是登录、账号或鉴权入口，已按敏感 URL 保护跳过外部请求。',
  'email-page': '该链接看起来是邮箱页面，已按敏感 URL 保护跳过外部请求。',
  'financial-page': '该链接看起来是银行、支付或账单页面，已按敏感 URL 保护跳过外部请求。',
  'medical-page': '该链接看起来是医疗或健康页面，已按敏感 URL 保护跳过外部请求。',
  'document-collaboration-page': '该链接看起来是文档协作或私有工作区页面，已按敏感 URL 保护跳过外部请求。'
}

export function assessSensitiveExternalUrl(url: unknown): SensitiveExternalUrlDecision {
  const parsedUrl = parseUrl(url)
  if (!parsedUrl) {
    return buildSensitiveDecision('invalid-url')
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    return buildSensitiveDecision('unsupported-scheme')
  }

  const hostname = normalizeHostname(parsedUrl.hostname)
  const pathname = decodePathname(parsedUrl.pathname)

  if (isLocalOrPrivateHostname(hostname)) {
    return buildSensitiveDecision('local-network')
  }

  if (matchesHost(hostname, EMAIL_HOSTS)) {
    return buildSensitiveDecision('email-page')
  }

  if (matchesHost(hostname, DOCUMENT_COLLAB_HOSTS)) {
    return buildSensitiveDecision('document-collaboration-page')
  }

  if (hostIncludesAny(hostname, FINANCIAL_HOST_PARTS) || FINANCIAL_PATH_RE.test(pathname)) {
    return buildSensitiveDecision('financial-page')
  }

  if (hostIncludesAny(hostname, MEDICAL_HOST_PARTS) || MEDICAL_PATH_RE.test(pathname)) {
    return buildSensitiveDecision('medical-page')
  }

  if (ACCOUNT_PATH_RE.test(pathname)) {
    return buildSensitiveDecision('account-login-page')
  }

  if (DOCUMENT_PATH_RE.test(pathname) && isLikelyPrivateWorkspaceHost(hostname)) {
    return buildSensitiveDecision('document-collaboration-page')
  }

  return {
    sensitive: false,
    reason: '',
    warning: ''
  }
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
  try {
    return decodeURIComponent(String(pathname || ''))
  } catch {
    return String(pathname || '')
  }
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

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === '::1'
  ) {
    return true
  }

  if (/^\[[^\]]+\]$/.test(hostname)) {
    return isPrivateIpv6(hostname.slice(1, -1))
  }

  if (hostname.includes(':')) {
    return isPrivateIpv6(hostname)
  }

  return isPrivateIpv4(hostname)
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) {
    return false
  }

  const octets = parts.map((part) => Number(part))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  const [a, b] = octets
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isPrivateIpv6(hostname: string): boolean {
  const value = String(hostname || '').toLowerCase()
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80')
}
