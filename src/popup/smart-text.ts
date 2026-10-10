import { splitBookmarkPath } from '../shared/bookmark-path.js'
import { normalizeText } from '../shared/text.js'

/* Smart-classifier text helpers shared by the popup controller (status view,
 * suggestion application) and the lazily loaded classifier itself. Keeping one
 * copy is what stops the two paths from drifting apart — they already had two
 * different AbortError checks. */

export function cleanSmartText(value: unknown, limit = 180): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

export function cleanSmartTitle(value: unknown, fallbackTitle: string): string {
  const title = cleanSmartText(value, 90)
  return title || fallbackTitle
}

export function normalizeSmartConfidence(value: unknown): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(numeric, 1))
  }
  return 0
}

export function normalizeSmartTextList(value: unknown, limit: number, itemLimit: number): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set<string>()
  const output: string[] = []

  for (const item of values) {
    const text = cleanSmartText(item, itemLimit)
    const key = normalizeText(text)
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= limit) {
      break
    }
  }

  return output
}

/** Accepts any error-like value with `name === 'AbortError'` (fetch aborts are
 * not always DOMExceptions), so a timeout reads the same on every path. */
export function normalizeSmartError(error: unknown): string {
  if (error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError') {
    return '请求超时，请稍后重试或调大通用设置中的请求超时。'
  }
  return error instanceof Error ? error.message : '智能分类失败，请稍后重试。'
}

/** The AI may return a deep path; only its first five segments are kept. */
export function splitSmartFolderPath(value: unknown): string[] {
  return splitBookmarkPath(value).slice(0, 5)
}

export function normalizeSmartFolderPath(value: unknown): string {
  return splitSmartFolderPath(value).join(' / ')
}

export function getLastPathSegment(value: unknown): string {
  const segments = splitSmartFolderPath(value)
  return segments.at(-1) || cleanSmartText(value, 60) || '推荐文件夹'
}
