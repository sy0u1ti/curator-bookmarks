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

export interface PopupAutoAnalyzeStatusChangeDetail {
  state: PopupAutoAnalyzeStatusView
}

export interface PopupAutoAnalyzeStatusActionDetail {
  action: string
}

export interface PopupSearchChipView {
  kind: string
  label: string
}

export interface PopupSearchChipsChangeDetail {
  chips: PopupSearchChipView[]
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

export interface PopupSavedSearchesChangeDetail {
  state: PopupSavedSearchesView
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

export interface PopupSmartClassifierChangeDetail {
  state: PopupSmartClassifierViewModel
}

export interface PopupSmartClassifierActionDetail {
  action: string
  currentPageAction?: string
  recommendationId?: string
}

export interface PopupSmartClassifierTitleChangeDetail {
  title: string
}

export interface PopupFolderPickerChangeDetail {
  mode: PopupFolderPickerState['mode']
  state: PopupFolderPickerState
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

export interface PopupChromeChangeDetail {
  state: PopupChromeView
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

export interface PopupModalsChangeDetail {
  state: PopupModalsView
}

export interface PopupModalActionDetail {
  action: string
  value?: string
}

export interface PopupToastChangeDetail {
  toasts: PopupToast[]
}

export interface PopupToastActionDetail {
  action: string
  toastId: string
}

export const POPUP_TOASTS_CHANGE_EVENT = 'popup:toasts-change'
export const POPUP_TOAST_ACTION_EVENT = 'popup:toast-action'
export const POPUP_AUTO_ANALYZE_STATUS_CHANGE_EVENT = 'popup:auto-analyze-status-change'
export const POPUP_AUTO_ANALYZE_STATUS_ACTION_EVENT = 'popup:auto-analyze-status-action'
export const POPUP_SEARCH_CHIPS_CHANGE_EVENT = 'popup:search-chips-change'
export const POPUP_SAVED_SEARCHES_CHANGE_EVENT = 'popup:saved-searches-change'
export const POPUP_SAVED_SEARCH_ACTION_EVENT = 'popup:saved-search-action'
export const POPUP_CONTENT_CHANGE_EVENT = 'popup:content-change'
export const POPUP_CONTENT_ACTION_EVENT = 'popup:content-action'
export const POPUP_CONTENT_RESULT_HOVER_EVENT = 'popup:content-result-hover'
export const POPUP_SMART_CLASSIFIER_CHANGE_EVENT = 'popup:smart-classifier-change'
export const POPUP_SMART_CLASSIFIER_ACTION_EVENT = 'popup:smart-classifier-action'
export const POPUP_SMART_CLASSIFIER_TITLE_CHANGE_EVENT = 'popup:smart-classifier-title-change'
export const POPUP_FOLDER_PICKER_CHANGE_EVENT = 'popup:folder-picker-change'
export const POPUP_FOLDER_PICKER_ACTION_EVENT = 'popup:folder-picker-action'
export const POPUP_CHROME_CHANGE_EVENT = 'popup:chrome-change'
export const POPUP_CHROME_ACTION_EVENT = 'popup:chrome-action'
export const POPUP_SEARCH_FOCUS_REQUEST_EVENT = 'popup:search-focus-request'
export const POPUP_MODALS_CHANGE_EVENT = 'popup:modals-change'
export const POPUP_MODAL_ACTION_EVENT = 'popup:modal-action'

export function dispatchPopupAutoAnalyzeStatusChange(state: PopupAutoAnalyzeStatusView): void {
  window.dispatchEvent(
    new CustomEvent<PopupAutoAnalyzeStatusChangeDetail>(POPUP_AUTO_ANALYZE_STATUS_CHANGE_EVENT, {
      detail: { state: { ...state } }
    })
  )
}

export function dispatchPopupAutoAnalyzeStatusAction(action: string): void {
  window.dispatchEvent(
    new CustomEvent<PopupAutoAnalyzeStatusActionDetail>(POPUP_AUTO_ANALYZE_STATUS_ACTION_EVENT, {
      detail: { action }
    })
  )
}

export function dispatchPopupSearchChipsChange(chips: PopupSearchChipView[]): void {
  window.dispatchEvent(
    new CustomEvent<PopupSearchChipsChangeDetail>(POPUP_SEARCH_CHIPS_CHANGE_EVENT, {
      detail: {
        chips: chips.map((chip) => ({ ...chip }))
      }
    })
  )
}

export function dispatchPopupSavedSearchesChange(state: PopupSavedSearchesView): void {
  window.dispatchEvent(
    new CustomEvent<PopupSavedSearchesChangeDetail>(POPUP_SAVED_SEARCHES_CHANGE_EVENT, {
      detail: {
        state: {
          ...state,
          items: state.items.map((item) => ({ ...item }))
        }
      }
    })
  )
}

export function dispatchPopupSavedSearchAction(action: string, searchId = ''): void {
  window.dispatchEvent(
    new CustomEvent<PopupSavedSearchActionDetail>(POPUP_SAVED_SEARCH_ACTION_EVENT, {
      detail: { action, searchId }
    })
  )
}

export function dispatchPopupContentChange(
  state: PopupContentViewModel,
  options: { preserveScroll?: boolean } = {}
): void {
  window.dispatchEvent(
    new CustomEvent<PopupContentChangeDetail>(POPUP_CONTENT_CHANGE_EVENT, {
      detail: {
        preserveScroll: Boolean(options.preserveScroll),
        state: { ...state }
      }
    })
  )
}

export function dispatchPopupContentAction(detail: PopupContentActionDetail): void {
  window.dispatchEvent(
    new CustomEvent<PopupContentActionDetail>(POPUP_CONTENT_ACTION_EVENT, {
      detail: { ...detail }
    })
  )
}

export function dispatchPopupContentResultHover(index: number): void {
  window.dispatchEvent(
    new CustomEvent<PopupContentResultHoverDetail>(POPUP_CONTENT_RESULT_HOVER_EVENT, {
      detail: { index }
    })
  )
}

export function dispatchPopupSmartClassifierChange(state: PopupSmartClassifierViewModel): void {
  window.dispatchEvent(
    new CustomEvent<PopupSmartClassifierChangeDetail>(POPUP_SMART_CLASSIFIER_CHANGE_EVENT, {
      detail: { state: { ...state } }
    })
  )
}

export function dispatchPopupSmartClassifierAction(detail: PopupSmartClassifierActionDetail): void {
  window.dispatchEvent(
    new CustomEvent<PopupSmartClassifierActionDetail>(POPUP_SMART_CLASSIFIER_ACTION_EVENT, {
      detail: { ...detail }
    })
  )
}

export function dispatchPopupSmartClassifierTitleChange(title: string): void {
  window.dispatchEvent(
    new CustomEvent<PopupSmartClassifierTitleChangeDetail>(POPUP_SMART_CLASSIFIER_TITLE_CHANGE_EVENT, {
      detail: { title }
    })
  )
}

export function dispatchPopupFolderPickerChange(
  mode: PopupFolderPickerState['mode'],
  state: PopupFolderPickerState
): void {
  window.dispatchEvent(
    new CustomEvent<PopupFolderPickerChangeDetail>(POPUP_FOLDER_PICKER_CHANGE_EVENT, {
      detail: {
        mode,
        state: { ...state }
      }
    })
  )
}

export function dispatchPopupFolderPickerAction(detail: PopupFolderPickerActionDetail): void {
  window.dispatchEvent(
    new CustomEvent<PopupFolderPickerActionDetail>(POPUP_FOLDER_PICKER_ACTION_EVENT, {
      detail: { ...detail }
    })
  )
}

export function dispatchPopupChromeChange(state: PopupChromeView): void {
  window.dispatchEvent(
    new CustomEvent<PopupChromeChangeDetail>(POPUP_CHROME_CHANGE_EVENT, {
      detail: { state: { ...state, search: { ...state.search } } }
    })
  )
}

export function dispatchPopupChromeAction(action: string, value?: string): void {
  window.dispatchEvent(
    new CustomEvent<PopupChromeActionDetail>(POPUP_CHROME_ACTION_EVENT, {
      detail: { action, value }
    })
  )
}

export function dispatchPopupSearchFocusRequest(select = false): void {
  window.dispatchEvent(
    new CustomEvent<PopupSearchFocusRequestDetail>(POPUP_SEARCH_FOCUS_REQUEST_EVENT, {
      detail: { select }
    })
  )
}

export function dispatchPopupModalsChange(state: PopupModalsView): void {
  window.dispatchEvent(
    new CustomEvent<PopupModalsChangeDetail>(POPUP_MODALS_CHANGE_EVENT, {
      detail: { state: { ...state } }
    })
  )
}

export function dispatchPopupModalAction(action: string, value?: string): void {
  window.dispatchEvent(
    new CustomEvent<PopupModalActionDetail>(POPUP_MODAL_ACTION_EVENT, {
      detail: { action, value }
    })
  )
}

export function dispatchPopupToastsChange(toasts: PopupToast[]): void {
  window.dispatchEvent(new CustomEvent<PopupToastChangeDetail>(POPUP_TOASTS_CHANGE_EVENT, {
    detail: {
      toasts: toasts.map((toast) => ({ ...toast }))
    }
  }))
}

export function dispatchPopupToastAction(toastId: string, action: string): void {
  window.dispatchEvent(new CustomEvent<PopupToastActionDetail>(POPUP_TOAST_ACTION_EVENT, {
    detail: { action, toastId }
  }))
}
