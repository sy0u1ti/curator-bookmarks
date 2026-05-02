import { buildDuplicateKey } from './text.js'

export function normalizeBookmarkSaveUrl(url: unknown): string {
  const rawUrl = String(url || '').trim()
  if (!rawUrl) {
    return ''
  }

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl) && /^[^\s/]+\.[^\s/]+/.test(rawUrl)) {
    return buildDuplicateKey(`https://${rawUrl}`)
  }

  return buildDuplicateKey(rawUrl)
}
