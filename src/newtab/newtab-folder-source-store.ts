import { useSyncExternalStore } from 'react'

export interface NewtabSelectedFolderSourceItemView {
  affectedCount: number
  folderId: string
  path: string
  stats: string
  title: string
}

export type NewtabSelectedFolderSourceState =
  | { type: 'empty'; message: string }
  | { type: 'items'; items: NewtabSelectedFolderSourceItemView[] }

export interface NewtabFolderCandidateItemView {
  active: boolean
  badge: string
  folderId: string
  path: string
  selected: boolean
  stats: string
  title: string
}

export type NewtabFolderCandidateState =
  | { type: 'empty'; message: string }
  | { type: 'items'; items: NewtabFolderCandidateItemView[] }

export interface NewtabFolderSourceView {
  candidateQuery: string
  candidates: NewtabFolderCandidateState
  candidatesExpanded: boolean
  general: {
    hideSettingsTrigger: boolean
    openBookmarksInNewTab: boolean
    showQuickAccess: boolean
    showSourceNavigation: boolean
  }
  hideFolderNames: boolean
  selected: NewtabSelectedFolderSourceState
  selectedCount: number
}

export interface NewtabFolderCandidateFocusRequest {
  folderId: string
  preventScroll: boolean
  requestId: number
  target: 'candidate' | 'search'
}

export interface NewtabFolderSourceActions {
  onCandidateFocus: (folderId: string) => void
  onCandidateKeyDown: (key: string, folderId: string) => boolean
  onCandidateSearchKeyDown: (key: string) => boolean
  onCandidateSelect: (folderId: string) => void
  onCandidateQueryChange: (query: string) => void
  onFolderHideNamesToggle: (enabled: boolean) => void
  onGeneralToggle: (key: NewtabGeneralSettingToggleKey, enabled: boolean) => void
  onRemoveSelected: (folderId: string) => void
  onToggleCandidates: () => void
}

export type NewtabGeneralSettingToggleKey =
  | 'hideSettingsTrigger'
  | 'openBookmarksInNewTab'
  | 'showQuickAccess'
  | 'showSourceNavigation'

const EMPTY_VIEW: NewtabFolderSourceView = {
  candidateQuery: '',
  candidates: { type: 'empty', message: '没有匹配的文件夹。请清空搜索词，或选择其他来源文件夹。' },
  candidatesExpanded: false,
  general: {
    hideSettingsTrigger: false,
    openBookmarksInNewTab: false,
    showQuickAccess: true,
    showSourceNavigation: true
  },
  hideFolderNames: false,
  selected: {
    type: 'empty',
    message: '未选择来源文件夹。选择来源只会决定新标签页显示哪些书签，不会移动、删除或重排原有书签。'
  },
  selectedCount: 0
}

const EMPTY_ACTIONS: NewtabFolderSourceActions = {
  onCandidateFocus: () => {},
  onCandidateKeyDown: () => false,
  onCandidateSearchKeyDown: () => false,
  onCandidateSelect: () => {},
  onCandidateQueryChange: () => {},
  onFolderHideNamesToggle: () => {},
  onGeneralToggle: () => {},
  onRemoveSelected: () => {},
  onToggleCandidates: () => {}
}

let folderSourceView: NewtabFolderSourceView = EMPTY_VIEW
let folderSourceActions: NewtabFolderSourceActions = EMPTY_ACTIONS
let folderCandidateFocusRequest: NewtabFolderCandidateFocusRequest = {
  folderId: '',
  preventScroll: true,
  requestId: 0,
  target: 'candidate'
}

const listeners = new Set<() => void>()
const focusRequestListeners = new Set<() => void>()

function subscribeFolderSource(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitFolderSourceChange(): void {
  listeners.forEach((listener) => listener())
}

function subscribeFolderCandidateFocusRequest(listener: () => void): () => void {
  focusRequestListeners.add(listener)
  return () => {
    focusRequestListeners.delete(listener)
  }
}

function emitFolderCandidateFocusRequestChange(): void {
  focusRequestListeners.forEach((listener) => listener())
}

export function registerNewtabFolderSourceActions(
  actions: NewtabFolderSourceActions
): () => void {
  folderSourceActions = actions
  return () => {
    if (folderSourceActions === actions) {
      folderSourceActions = EMPTY_ACTIONS
    }
  }
}

export function dispatchNewtabFolderSourceView(view: NewtabFolderSourceView): void {
  folderSourceView = view
  emitFolderSourceChange()
}

export function dispatchNewtabFolderCandidateFocusRequest(
  request: Omit<NewtabFolderCandidateFocusRequest, 'requestId'>
): void {
  folderCandidateFocusRequest = {
    ...request,
    requestId: folderCandidateFocusRequest.requestId + 1
  }
  emitFolderCandidateFocusRequestChange()
}

export function useNewtabFolderSourceView(): NewtabFolderSourceView {
  return useSyncExternalStore(
    subscribeFolderSource,
    () => folderSourceView,
    () => EMPTY_VIEW
  )
}

export function useNewtabFolderCandidateFocusRequest(): NewtabFolderCandidateFocusRequest {
  return useSyncExternalStore(
    subscribeFolderCandidateFocusRequest,
    () => folderCandidateFocusRequest,
    () => ({
      folderId: '',
      preventScroll: true,
      requestId: 0,
      target: 'candidate'
    })
  )
}

export function dispatchNewtabFolderCandidatesToggle(): void {
  folderSourceActions.onToggleCandidates()
}

export function dispatchNewtabFolderCandidateQueryChange(query: string): void {
  folderSourceActions.onCandidateQueryChange(query)
}

export function dispatchNewtabFolderCandidateSearchKeyDown(key: string): boolean {
  return folderSourceActions.onCandidateSearchKeyDown(key)
}

export function dispatchNewtabFolderCandidateKeyDown(key: string, folderId: string): boolean {
  return folderSourceActions.onCandidateKeyDown(key, folderId)
}

export function dispatchNewtabFolderCandidateSelect(folderId: string): void {
  folderSourceActions.onCandidateSelect(folderId)
}

export function dispatchNewtabFolderCandidateFocus(folderId: string): void {
  folderSourceActions.onCandidateFocus(folderId)
}

export function dispatchNewtabFolderHideNamesToggle(enabled: boolean): void {
  folderSourceActions.onFolderHideNamesToggle(enabled)
}

export function dispatchNewtabGeneralSettingToggle(
  key: NewtabGeneralSettingToggleKey,
  enabled: boolean
): void {
  folderSourceActions.onGeneralToggle(key, enabled)
}

export function dispatchNewtabSelectedFolderRemove(folderId: string): void {
  folderSourceActions.onRemoveSelected(folderId)
}
