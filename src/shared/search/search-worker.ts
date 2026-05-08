import {
  searchBookmarksFirstBatch,
  searchBookmarksTopK,
  type PopupSearchBookmark
} from '../../popup/search.js'
import type {
  DashboardSearchWorkerRequest,
  DashboardSearchWorkerResponse,
  DashboardSearchWorkerStructuralFilters
} from './search-worker-contract.js'

let searchIndex: PopupSearchBookmark[] = []
let latestQueryRequestId = 0

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<DashboardSearchWorkerRequest>) => void) | null
  postMessage: (message: DashboardSearchWorkerResponse) => void
}

workerScope.onmessage = (event: MessageEvent<DashboardSearchWorkerRequest>) => {
  const request = event.data
  if (!request || typeof request !== 'object') {
    return
  }

  try {
    if (request.type === 'init') {
      searchIndex = Array.isArray(request.bookmarks) ? request.bookmarks : []
      postWorkerMessage({
        type: 'ready',
        requestId: request.requestId,
        indexSize: searchIndex.length
      })
      return
    }

    if (request.type === 'cancel') {
      latestQueryRequestId = Math.max(latestQueryRequestId, request.requestId)
      postWorkerMessage({
        type: 'cancelled',
        requestId: request.requestId,
        searchKey: request.searchKey
      })
      return
    }

    if (request.type === 'query') {
      latestQueryRequestId = request.requestId
      const offset = Math.max(0, Math.floor(Number(request.offset) || 0))
      const limit = Math.max(0, Math.floor(Number(request.limit) || 0))
      const bookmarks = filterWorkerSearchIndex(searchIndex, request.filters)
      if (offset === 0 && limit > 0) {
        const firstBatch = searchBookmarksFirstBatch(request.query, bookmarks, Math.min(limit, 20))
        if (firstBatch.results.length) {
          postWorkerMessage({
            type: 'partial',
            requestId: request.requestId,
            searchKey: request.searchKey,
            limit,
            offset,
            ids: firstBatch.results.map((result) => String(result.id)),
            scanned: firstBatch.scanned,
            complete: firstBatch.complete
          })
        }
      }
      if (request.requestId !== latestQueryRequestId) {
        postWorkerMessage({
          type: 'cancelled',
          requestId: request.requestId,
          searchKey: request.searchKey
        })
        return
      }
      const results = searchBookmarksTopK(request.query, bookmarks, limit, offset)
      postWorkerMessage({
        type: 'final',
        requestId: request.requestId,
        searchKey: request.searchKey,
        limit,
        offset,
        ids: results.map((result) => String(result.id))
      })
    }
  } catch (error) {
    postWorkerMessage({
      type: 'error',
      requestId: Number((request as { requestId?: unknown }).requestId) || 0,
      message: error instanceof Error ? error.message : 'Dashboard search worker failed.'
    })
  }
}

function postWorkerMessage(message: DashboardSearchWorkerResponse): void {
  workerScope.postMessage(message)
}

function filterWorkerSearchIndex(
  bookmarks: PopupSearchBookmark[],
  filters: DashboardSearchWorkerStructuralFilters = {}
): PopupSearchBookmark[] {
  const folderId = String(filters.folderId || '').trim()
  const domain = String(filters.domain || '').trim()
  const month = String(filters.month || '').trim()

  if (!folderId && !domain && !month) {
    return bookmarks
  }

  return bookmarks.filter((bookmark) => {
    if (
      folderId &&
      String(bookmark.parentId || '') !== folderId &&
      !normalizeWorkerIdList(bookmark.ancestorIds).includes(folderId)
    ) {
      return false
    }

    if (domain && String(bookmark.domain || '') !== domain) {
      return false
    }

    if (month && getWorkerMonthKey(bookmark.dateAdded) !== month) {
      return false
    }

    return true
  })
}

function normalizeWorkerIdList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function getWorkerMonthKey(value: unknown): string {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'unknown'
  }

  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return 'unknown'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
