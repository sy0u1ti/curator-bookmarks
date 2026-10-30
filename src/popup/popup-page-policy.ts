import { assessSensitiveExternalUrl } from '../shared/sensitive-url.js'

export interface PopupCurrentPagePolicy {
  isWebPage: boolean
  canClassify: boolean
  classificationMessage: string
}

export function getPopupCurrentPagePolicy(url: unknown): PopupCurrentPagePolicy {
  const normalizedUrl = String(url || '').trim()
  if (!isPopupWebPageUrl(normalizedUrl)) {
    return {
      isWebPage: false,
      canClassify: false,
      classificationMessage: ''
    }
  }

  const decision = assessSensitiveExternalUrl(normalizedUrl)
  return {
    isWebPage: true,
    canClassify: !decision.sensitive,
    classificationMessage: decision.sensitive
      ? '为保护隐私，此页面不发送给 AI，仍可手动保存书签。'
      : ''
  }
}

// Reading tab metadata and saving a bookmark are local operations, not permission
// to fetch the page or send its URL/content to an external service.
export function isPopupWebPageUrl(url: unknown): boolean {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    return /^https?:$/i.test(parsedUrl.protocol)
  } catch {
    return false
  }
}

export function isPopupSmartClassifiableUrl(url: unknown): boolean {
  return getPopupCurrentPagePolicy(url).canClassify
}
