import { useSyncExternalStore } from 'react'
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

let currentBookmarkAddHistoryState = defaultBookmarkAddHistoryState
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): BookmarkAddHistoryState {
  return currentBookmarkAddHistoryState
}

export function publishBookmarkAddHistory(state: BookmarkAddHistoryState): void {
  currentBookmarkAddHistoryState = state
  listeners.forEach((listener) => listener())
}

export function useBookmarkAddHistoryState(): BookmarkAddHistoryState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
