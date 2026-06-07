import { Button } from '../../ui/primitives/Button'
import { ToastList } from '../../ui/primitives/Toast'
import {
  dispatchPopupToastAction,
  usePopupToasts
} from '../popup-controller-store'

export function PopupToasts() {
  const toasts = usePopupToasts()

  return (
    <section
      id="toast-root"
      className="toast-root"
      aria-live="polite"
      aria-atomic="true"
    >
      <ToastList
        contentClassName="toast-copy"
        descriptionClassName="toast-message"
        items={toasts.map((toast) => ({
          actions: (
            <>
              {toast.action ? (
                <Button
                  className="toast-action"
                  type="button"
                  onClick={() => dispatchPopupToastAction(String(toast.id || ''), String(toast.action || ''))}
                  unstyled
                >
                  {String(toast.actionLabel || '') || '操作'}
                </Button>
              ) : null}
              <Button
                className="toast-dismiss"
                type="button"
                onClick={() => dispatchPopupToastAction(String(toast.id || ''), '')}
                unstyled
              >
                关闭
              </Button>
            </>
          ),
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
