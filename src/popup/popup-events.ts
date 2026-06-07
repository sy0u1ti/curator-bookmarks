import type { PopupToast } from './state'

export interface PopupToastChangeDetail {
  toasts: PopupToast[]
}

export interface PopupToastActionDetail {
  action: string
  toastId: string
}

export const POPUP_TOASTS_CHANGE_EVENT = 'popup:toasts-change'
export const POPUP_TOAST_ACTION_EVENT = 'popup:toast-action'

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
