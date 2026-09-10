import { extractAvailabilityHttpStatus } from '../../shared/availability-evidence.js'

/** A concise explanation for scanning. Full detection evidence remains available separately. */
export function getAvailabilityResultSummary(result: { status?: unknown; errorCode?: unknown; detail?: unknown; badgeText?: unknown }): string {
  if (result.status === 'recovered' || result.status === 'available') return '本轮已确认可以访问。'
  if (result.status === 'redirected') return '链接已跳转到新地址，确认后可更新书签。'
  if (result.status === 'ignored') return '命中忽略规则，本轮已跳过。'
  const code = String(result.errorCode || '')
  const detail = String(result.detail || '').replace(/\s+/g, ' ').trim()
  const status = extractAvailabilityHttpStatus(code) || extractAvailabilityHttpStatus(detail)
  if (code === 'site-cooldown') return '站点正在限流，本条已暂缓，可稍后重新检测。'
  if (code === 'detection-budget-exhausted' || /timeout|TIMED_OUT/.test(code)) return '本次未能在时限内完成验证，可稍后重新检测。'
  if (code === 'redirect-loop' || code === 'too-many-redirects') return '跳转未能到达稳定页面，建议打开链接确认。'
  if (/permission|ungranted/.test(code)) return '目标地址尚未授权，授权后可重新检测。'
  if (/private-network|sensitive/.test(code)) return '该地址已按保护规则跳过，可手动打开确认。'
  if (/unsupported|unverified-network/.test(code)) return '未能完成独立验证，建议打开网页确认。'
  if (/ERR_(?:CERT_|SSL_)/.test(code)) return '证书或安全连接异常，请检查网络后重试。'
  if (/ERR_(?:INTERNET_DISCONNECTED|NETWORK_CHANGED|PROXY_|TUNNEL_|MANDATORY_PROXY_)/.test(code)) return '当前网络或代理影响了检测，恢复连接后可重试。'
  if (status === 404 || status === 410) return '网页返回 ' + status + '，可能已移除或需要登录。'
  if (status === 401 || status === 403 || status === 407) return '访问受限，可能需要登录或通过站点验证。'
  if (status === 429) return '站点请求过多，请稍后重新检测。'
  if (status === 451) return '站点限制了此内容的访问，需要人工确认。'
  if (status >= 500) return '站点暂时出错（HTTP ' + status + '），建议稍后重试。'
  if (result.status === 'failed') return result.badgeText === '手动移入异常'
    ? '已手动归入异常，建议打开链接确认。'
    : '多次验证均未能访问，请确认后再处理。'
  if (/超时|timeout/i.test(detail)) return '页面响应较慢，本次未能确认是否可用。'
  return '目前证据不足，建议打开网页确认。'
}
