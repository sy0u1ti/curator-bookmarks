export interface SpeedDialBookmarkLike {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface SpeedDialItem {
  id: string
  title: string
  url: string
  domain: string
  fallbackLabel: string
  detail: string
  pinnedOrder: number
}

export interface BuildSpeedDialInput {
  pinnedIds: string[]
  bookmarks: SpeedDialBookmarkLike[] | Map<string, SpeedDialBookmarkLike>
  limit?: number
}

export interface SpeedDialEmptyState {
  title: string
  detail: string
}
