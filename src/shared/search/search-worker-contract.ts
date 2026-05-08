import type { PopupSearchBookmark } from '../../popup/search.js'

export interface SearchWorkerStructuralFilters {
  folderId?: string
  domain?: string
  month?: string
}

export type SearchWorkerRequest =
  | {
    type: 'init'
    requestId: number
    bookmarks: PopupSearchBookmark[]
  }
  | {
    type: 'query'
    requestId: number
    searchKey: string
    query: string
    limit: number
    offset?: number
    filters?: SearchWorkerStructuralFilters
  }
  | {
    type: 'cancel'
    requestId: number
    searchKey?: string
  }

export type SearchWorkerResponse =
  | {
    type: 'ready'
    requestId: number
    indexSize: number
  }
  | {
    type: 'partial'
    requestId: number
    searchKey: string
    limit: number
    offset: number
    ids: string[]
    scanned: number
    complete: boolean
  }
  | {
    type: 'final'
    requestId: number
    searchKey: string
    limit: number
    offset: number
    ids: string[]
  }
  | {
    type: 'cancelled'
    requestId: number
    searchKey?: string
  }
  | {
    type: 'error'
    requestId: number
    message: string
  }

export type DashboardSearchWorkerStructuralFilters = SearchWorkerStructuralFilters
export type DashboardSearchWorkerRequest = SearchWorkerRequest
export type DashboardSearchWorkerResponse = SearchWorkerResponse
