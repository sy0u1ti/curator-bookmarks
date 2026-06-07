import { useSyncExternalStore } from 'react'
import type { PopupToast } from './state'
import type {
  PopupContentViewModel,
  PopupFolderPickerState,
  PopupSmartClassifierViewModel
} from './components/PopupViewModels'

export interface PopupAutoAnalyzeStatusView {
  collapsed: boolean
  detail: string
  showHistory: boolean
  status: string | null
  title: string
}

export interface PopupAutoAnalyzeStatusActionDetail {
  action: string
}

export interface PopupSearchChipView {
  kind: string
  label: string
}

export interface PopupSavedSearchItemView {
  active: boolean
  id: string
  label: string
  query: string
}

export interface PopupSavedSearchesView {
  canSaveCurrent: boolean
  error: string
  expanded: boolean
  hasCurrentSaved: boolean
  items: PopupSavedSearchItemView[]
  show: boolean
}

export interface PopupSavedSearchActionDetail {
  action: string
  searchId: string
}

export interface PopupContentChangeDetail {
  preserveScroll: boolean
  state: PopupContentViewModel
}

export interface PopupContentActionDetail {
  action: string
  bookmarkId?: string
  emptyAction?: string
  folderId?: string
  menuAction?: string
}

export interface PopupContentResultHoverDetail {
  index: number
}

export interface PopupSmartClassifierActionDetail {
  action: string
  currentPageAction?: string
  recommendationId?: string
}

export interface PopupSmartClassifierTitleChangeDetail {
  title: string
}

export interface PopupFolderPickerActionDetail {
  action: 'select' | 'toggle'
  folderId: string
  mode: PopupFolderPickerState['mode']
}

export interface PopupChromeView {
  loadError: string
  search: {
    ariaLabel: string
    clearVisible: boolean
    fallback: boolean
    label: string
    notConfigured: boolean
    pending: boolean
    placeholder: string
    pressed: boolean
    query: string
    title: string
  }
  viewCaption: string
}

export interface PopupChromeActionDetail {
  action: string
  value?: string
}

export interface PopupSearchFocusRequestDetail {
  select: boolean
}

export interface PopupModalsView {
  active: 'move' | 'smart-folder' | 'ai-provider' | 'edit' | 'delete' | null
  aiProvider: {
    open: boolean
  }
  delete: {
    cancelDisabled: boolean
    confirmDisabled: boolean
    confirmLabel: string
    open: boolean
    path: string
    title: string
  }
  edit: {
    cancelDisabled: boolean
    closeDisabled: boolean
    dirty: boolean
    folderPickerOpen: boolean
    folderQuery: string
    folderSearchDisabled: boolean
    open: boolean
    path: string
    pathChanged: boolean
    saveDisabled: boolean
    saveLabel: string
    title: string
    titleDisabled: boolean
    url: string
    urlDisabled: boolean
  }
  move: {
    open: boolean
    path: string
    query: string
    title: string
  }
  open: boolean
  smartFolder: {
    open: boolean
    query: string
    title: string
    urlLabel: string
  }
}

export interface PopupModalActionDetail {
  action: string
  value?: string
}

export interface PopupToastActionDetail {
  action: string
  toastId: string
}

export const EMPTY_POPUP_AUTO_ANALYZE_STATUS: PopupAutoAnalyzeStatusView = {
  collapsed: true,
  detail: '',
  showHistory: false,
  status: null,
  title: ''
}

export const EMPTY_POPUP_CHROME_VIEW: PopupChromeView = {
  loadError: '',
  search: {
    ariaLabel: '关键词搜索书签标题、网址、标签或高级语法',
    clearVisible: false,
    fallback: false,
    label: '语义',
    notConfigured: true,
    pending: false,
    placeholder: '关键词搜索',
    pressed: false,
    query: '',
    title: 'AI 语义搜索：需要先配置 AI 渠道'
  },
  viewCaption: '书签栏'
}

export const EMPTY_POPUP_CONTENT_CHANGE_DETAIL: PopupContentChangeDetail = {
  preserveScroll: false,
  state: {
    loading: true,
    rows: [],
    title: '书签栏'
  }
}

export const EMPTY_POPUP_MODALS_VIEW: PopupModalsView = {
  active: null,
  aiProvider: { open: false },
  delete: {
    cancelDisabled: false,
    confirmDisabled: false,
    confirmLabel: '删除',
    open: false,
    path: '',
    title: ''
  },
  edit: {
    cancelDisabled: false,
    closeDisabled: false,
    dirty: false,
    folderPickerOpen: false,
    folderQuery: '',
    folderSearchDisabled: false,
    open: false,
    path: '',
    pathChanged: false,
    saveDisabled: true,
    saveLabel: '未修改',
    title: '',
    titleDisabled: false,
    url: '',
    urlDisabled: false
  },
  move: {
    open: false,
    path: '',
    query: '',
    title: ''
  },
  open: false,
  smartFolder: {
    open: false,
    query: '',
    title: '',
    urlLabel: ''
  }
}

export const EMPTY_POPUP_SAVED_SEARCHES_VIEW: PopupSavedSearchesView = {
  canSaveCurrent: false,
  error: '',
  expanded: false,
  hasCurrentSaved: false,
  items: [],
  show: false
}

export const EMPTY_POPUP_SMART_CLASSIFIER: PopupSmartClassifierViewModel = {
  error: '',
  loadingLabel: '',
  loadingProgress: 0,
  loadingStartProgress: 0,
  loadingStep: 1,
  loadingStepCount: 3,
  page: null,
  permissionOrigins: [],
  recommendations: [],
  saved: false,
  saving: false,
  status: 'hidden',
  suggestedTitle: ''
}

export const EMPTY_POPUP_TOASTS: PopupToast[] = []

export function getEmptyPopupFolderPickerState(mode: PopupFolderPickerState['mode']): PopupFolderPickerState {
  return {
    empty: null,
    mode,
    query: '',
    treeOptions: []
  }
}

interface PopupSearchFocusRequestState extends PopupSearchFocusRequestDetail {
  id: number
}

interface PopupViewStoreSnapshot {
  autoAnalyzeStatus: PopupAutoAnalyzeStatusView
  chrome: PopupChromeView
  content: PopupContentChangeDetail
  folderPickers: Record<PopupFolderPickerState['mode'], PopupFolderPickerState>
  modals: PopupModalsView
  savedSearches: PopupSavedSearchesView
  searchChips: PopupSearchChipView[]
  searchFocusRequest: PopupSearchFocusRequestState
  smartClassifier: PopupSmartClassifierViewModel
  toasts: PopupToast[]
}

interface PopupActionHandlers {
  autoAnalyzeStatus?: (detail: PopupAutoAnalyzeStatusActionDetail) => void
  chrome?: (detail: PopupChromeActionDetail) => void
  content?: (detail: PopupContentActionDetail) => void
  contentResultHover?: (detail: PopupContentResultHoverDetail) => void
  folderPicker?: (detail: PopupFolderPickerActionDetail) => void
  modal?: (detail: PopupModalActionDetail) => void
  savedSearch?: (detail: PopupSavedSearchActionDetail) => void
  smartClassifier?: (detail: PopupSmartClassifierActionDetail) => void
  smartClassifierTitleChange?: (detail: PopupSmartClassifierTitleChangeDetail) => void
  toast?: (detail: PopupToastActionDetail) => void
}

const popupViewStoreListeners = new Set<() => void>()
const popupContentChangeListeners = new Set<(detail: PopupContentChangeDetail) => void>()
let popupActionHandlers: PopupActionHandlers = {}

let popupViewStoreSnapshot: PopupViewStoreSnapshot = {
  autoAnalyzeStatus: EMPTY_POPUP_AUTO_ANALYZE_STATUS,
  chrome: EMPTY_POPUP_CHROME_VIEW,
  content: EMPTY_POPUP_CONTENT_CHANGE_DETAIL,
  folderPickers: {
    edit: getEmptyPopupFolderPickerState('edit'),
    move: getEmptyPopupFolderPickerState('move'),
    smart: getEmptyPopupFolderPickerState('smart')
  },
  modals: EMPTY_POPUP_MODALS_VIEW,
  savedSearches: EMPTY_POPUP_SAVED_SEARCHES_VIEW,
  searchChips: [],
  searchFocusRequest: { id: 0, select: false },
  smartClassifier: EMPTY_POPUP_SMART_CLASSIFIER,
  toasts: EMPTY_POPUP_TOASTS
}

function subscribePopupViewStore(listener: () => void): () => void {
  popupViewStoreListeners.add(listener)
  return () => popupViewStoreListeners.delete(listener)
}

function emitPopupViewStoreChange(): void {
  popupViewStoreListeners.forEach((listener) => listener())
}

function updatePopupViewStore(nextSnapshot: Partial<PopupViewStoreSnapshot>): void {
  popupViewStoreSnapshot = {
    ...popupViewStoreSnapshot,
    ...nextSnapshot
  }
  emitPopupViewStoreChange()
}

export function subscribePopupContentChange(listener: (detail: PopupContentChangeDetail) => void): () => void {
  popupContentChangeListeners.add(listener)
  listener(popupViewStoreSnapshot.content)
  return () => popupContentChangeListeners.delete(listener)
}

export function registerPopupActionHandlers(handlers: PopupActionHandlers): () => void {
  popupActionHandlers = { ...popupActionHandlers, ...handlers }
  return () => {
    for (const key of Object.keys(handlers) as Array<keyof PopupActionHandlers>) {
      if (popupActionHandlers[key] === handlers[key]) {
        delete popupActionHandlers[key]
      }
    }
  }
}

export function usePopupAutoAnalyzeStatusView(): PopupAutoAnalyzeStatusView {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.autoAnalyzeStatus,
    () => EMPTY_POPUP_AUTO_ANALYZE_STATUS
  )
}

export function usePopupChromeView(): PopupChromeView {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.chrome,
    () => EMPTY_POPUP_CHROME_VIEW
  )
}

export function usePopupFolderPickerState(mode: PopupFolderPickerState['mode']): PopupFolderPickerState {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.folderPickers[mode],
    () => getEmptyPopupFolderPickerState(mode)
  )
}

export function usePopupModalsView(): PopupModalsView {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.modals,
    () => EMPTY_POPUP_MODALS_VIEW
  )
}

export function usePopupSavedSearchesView(): PopupSavedSearchesView {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.savedSearches,
    () => EMPTY_POPUP_SAVED_SEARCHES_VIEW
  )
}

export function usePopupSearchChips(): PopupSearchChipView[] {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.searchChips,
    () => []
  )
}

export function usePopupSearchFocusRequest(): PopupSearchFocusRequestState {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.searchFocusRequest,
    () => ({ id: 0, select: false })
  )
}

export function usePopupSmartClassifierView(): PopupSmartClassifierViewModel {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.smartClassifier,
    () => EMPTY_POPUP_SMART_CLASSIFIER
  )
}

export function usePopupToasts(): PopupToast[] {
  return useSyncExternalStore(
    subscribePopupViewStore,
    () => popupViewStoreSnapshot.toasts,
    () => EMPTY_POPUP_TOASTS
  )
}

export function dispatchPopupAutoAnalyzeStatusChange(state: PopupAutoAnalyzeStatusView): void {
  updatePopupViewStore({ autoAnalyzeStatus: { ...state } })
}

export function dispatchPopupAutoAnalyzeStatusAction(action: string): void {
  popupActionHandlers.autoAnalyzeStatus?.({ action })
}

export function dispatchPopupSearchChipsChange(chips: PopupSearchChipView[]): void {
  updatePopupViewStore({ searchChips: chips.map((chip) => ({ ...chip })) })
}

export function dispatchPopupSavedSearchesChange(state: PopupSavedSearchesView): void {
  updatePopupViewStore({
    savedSearches: {
      ...state,
      items: state.items.map((item) => ({ ...item }))
    }
  })
}

export function dispatchPopupSavedSearchAction(action: string, searchId = ''): void {
  popupActionHandlers.savedSearch?.({ action, searchId })
}

export function dispatchPopupContentChange(
  state: PopupContentViewModel,
  options: { preserveScroll?: boolean } = {}
): void {
  const detail: PopupContentChangeDetail = {
    preserveScroll: Boolean(options.preserveScroll),
    state: { ...state }
  }
  popupViewStoreSnapshot = {
    ...popupViewStoreSnapshot,
    content: detail
  }
  emitPopupViewStoreChange()
  popupContentChangeListeners.forEach((listener) => listener(detail))
}

export function dispatchPopupContentAction(detail: PopupContentActionDetail): void {
  popupActionHandlers.content?.({ ...detail })
}

export function dispatchPopupContentResultHover(index: number): void {
  popupActionHandlers.contentResultHover?.({ index })
}

export function dispatchPopupSmartClassifierChange(state: PopupSmartClassifierViewModel): void {
  updatePopupViewStore({ smartClassifier: { ...state } })
}

export function dispatchPopupSmartClassifierAction(detail: PopupSmartClassifierActionDetail): void {
  popupActionHandlers.smartClassifier?.({ ...detail })
}

export function dispatchPopupSmartClassifierTitleChange(title: string): void {
  popupActionHandlers.smartClassifierTitleChange?.({ title })
}

export function dispatchPopupFolderPickerChange(
  mode: PopupFolderPickerState['mode'],
  state: PopupFolderPickerState
): void {
  updatePopupViewStore({
    folderPickers: {
      ...popupViewStoreSnapshot.folderPickers,
      [mode]: { ...state }
    }
  })
}

export function dispatchPopupFolderPickerAction(detail: PopupFolderPickerActionDetail): void {
  popupActionHandlers.folderPicker?.({ ...detail })
}

export function dispatchPopupChromeChange(state: PopupChromeView): void {
  updatePopupViewStore({ chrome: { ...state, search: { ...state.search } } })
}

export function dispatchPopupChromeAction(action: string, value?: string): void {
  popupActionHandlers.chrome?.({ action, value })
}

export function dispatchPopupSearchFocusRequest(select = false): void {
  updatePopupViewStore({
    searchFocusRequest: {
      id: popupViewStoreSnapshot.searchFocusRequest.id + 1,
      select
    }
  })
}

export function dispatchPopupModalsChange(state: PopupModalsView): void {
  updatePopupViewStore({ modals: { ...state } })
}

export function dispatchPopupModalAction(action: string, value?: string): void {
  popupActionHandlers.modal?.({ action, value })
}

export function dispatchPopupToastsChange(toasts: PopupToast[]): void {
  updatePopupViewStore({ toasts: toasts.map((toast) => ({ ...toast })) })
}

export function dispatchPopupToastAction(toastId: string, action: string): void {
  popupActionHandlers.toast?.({ action, toastId })
}
