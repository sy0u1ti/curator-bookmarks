import type { AvailabilityResult, BookmarkRecord } from '../../shared/types.js'
import { collectRequestOrigins } from '../shared-options/permissions.js'
import { getSafeAvailabilityRedirectUrl } from './classifier.js'

type DeletionResult = Pick<AvailabilityResult, 'id' | 'title' | 'url' | 'status'>

/** Deletion owns this exact URL snapshot, not whatever happens to be selected later. */
export function buildAvailabilityDeletionRequest(results: DeletionResult[]) {
  const unique = new Map(results.filter(result => result.id && result.url &&
    (result.status === 'review' || result.status === 'failed')).map(result => [String(result.id), result]))
  const entries = [...unique.values()]
  if (!entries.length) return null
  const uncertain = entries.filter(result => result.status === 'review').length
  return {
    candidates: entries.map(result => ({ id: String(result.id), expectedUrl: result.url })),
    notice: uncertain ? `其中 ${uncertain} 条仍待确认，不一定已失效。` : ''
  }
}

export function getAvailabilityRetestLabel(results: Array<{ errorCode?: string }>, busy = false): string {
  if (busy) return '重新检测中…'
  return results.some(result => result.errorCode === 'ungranted-redirect' || result.errorCode === 'permission-missing')
    ? '授权并重测' : '重新检测'
}

export function collectAvailabilityPermissionOrigins(
  bookmarks: Array<Pick<BookmarkRecord, 'id' | 'url'>>,
  results: Array<Pick<AvailabilityResult, 'id' | 'url' | 'finalUrl' | 'errorCode'>> = []
): string[] {
  const urls: Array<{ url: string }> = [...bookmarks]
  const currentUrls = new Map(bookmarks.map(bookmark => [String(bookmark.id), bookmark.url]))
  for (const bookmark of bookmarks) {
    try {
      const upgraded = new URL(bookmark.url)
      if (upgraded.protocol !== 'http:') continue
      upgraded.protocol = 'https:'
      urls.push({ url: upgraded.href })
    } catch {}
  }
  for (const result of results) {
    // Never request a stale target's permission for an edited or out-of-scope bookmark.
    if (currentUrls.get(String(result.id)) !== result.url || result.errorCode !== 'ungranted-redirect') continue
    const target = getSafeAvailabilityRedirectUrl(result.url, {
      status: 'failed', finalUrl: result.finalUrl, errorCode: result.errorCode, detail: ''
    })
    if (target) urls.push({ url: target })
  }
  return collectRequestOrigins(urls)
}
