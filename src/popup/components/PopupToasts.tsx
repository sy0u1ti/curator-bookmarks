import { useEffect, useState } from 'react'
import { ToastList } from '../../ui'
import {
  dispatchPopupToastAction,
  POPUP_TOASTS_CHANGE_EVENT,
  type PopupToastChangeDetail
} from '../popup-events'
import type { PopupToast } from '../state'

export function PopupToasts() {
  const [toasts, setToasts] = useState<PopupToast[]>([])

  useEffect(() => {
    function handleToastsChange(event: Event) {
      setToasts((event as CustomEvent<PopupToastChangeDetail>).detail?.toasts || [])
    }

    window.addEventListener(POPUP_TOASTS_CHANGE_EVENT, handleToastsChange)
    return () => {
      window.removeEventListener(POPUP_TOASTS_CHANGE_EVENT, handleToastsChange)
    }
  }, [])

  return (
    <section
      id="toast-root"
      className="toast-root"
      aria-live="polite"
      aria-atomic="true"
      onClick={handlePopupToastClick}
    >
      <ToastList
        actionClassName="toast-action"
        closeClassName="toast-dismiss"
        closeLabel="关闭"
        contentClassName="toast-copy"
        descriptionClassName="toast-message"
        items={toasts.map((toast) => ({
          action: String(toast.action || ''),
          actionLabel: String(toast.actionLabel || '') || '操作',
          description: String(toast.message || ''),
          id: String(toast.id || ''),
          priority: toast.type === 'error' ? 'high' : 'low',
          type: String(toast.type || 'success')
        }))}
        rootClassName="toast"
        timeout={0}
        unstyled
      />
    </section>
  )
}

function handlePopupToastClick(event: React.MouseEvent<HTMLElement>): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const dismissButton = target.closest('[data-dismiss-toast]')
  if (dismissButton) {
    dispatchPopupToastAction(String(dismissButton.getAttribute('data-dismiss-toast') || ''), '')
    return
  }

  const actionButton = target.closest('[data-toast-action]')
  if (!actionButton) {
    return
  }

  dispatchPopupToastAction(
    String(actionButton.getAttribute('data-toast-id') || ''),
    String(actionButton.getAttribute('data-toast-action') || '')
  )
}
