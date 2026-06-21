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
    subtitle: '开启“自动分析”后，新增普通网页书签完成 AI 分类时会在这里记录保存位置。',
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
