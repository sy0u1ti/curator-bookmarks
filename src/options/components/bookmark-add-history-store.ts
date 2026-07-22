import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { BookmarkAddHistoryEntry } from '../sections/bookmark-add-history.js'
import type {
  BookmarkAddHistoryHeaderState,
  BookmarkAddHistorySummaryState
} from './BookmarkAddHistoryTypes.js'

export interface BookmarkAddHistoryState {
  entries: BookmarkAddHistoryEntry[]
  header: BookmarkAddHistoryHeaderState
  summary: BookmarkAddHistorySummaryState
}

const defaultBookmarkAddHistoryState: BookmarkAddHistoryState = {
  entries: [],
  header: {
    clearDisabled: true,
    subtitle: 'AI 自动整理完成后，这里记录新增书签的保存位置。',
    timestamp: '尚无历史'
  },
  summary: {
    existing: 0,
    moved: 0,
    newFolder: 0,
    total: 0
  }
}

const bookmarkAddHistoryStore = createUiViewStoreSlice(
  'options',
  'bookmark-add-history',
  defaultBookmarkAddHistoryState
)

export function publishBookmarkAddHistory(state: BookmarkAddHistoryState): void {
  bookmarkAddHistoryStore.setState(state)
}

export function useBookmarkAddHistoryState(): BookmarkAddHistoryState {
  return useUiViewStoreSlice(bookmarkAddHistoryStore)
}
