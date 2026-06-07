import type { PopupToast } from './state'

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
