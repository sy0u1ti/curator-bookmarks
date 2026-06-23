import { Button } from '../../ui'
import { ToastList } from '../../ui'
import {
  dispatchPopupToastAction,
  usePopupToasts
} from '../popup-controller-store'

const TOAST_BUTTON_CLASS = [
  'inline-flex min-h-8 items-center justify-center rounded-ds-sm border px-2.5 text-xs font-semibold',
  'border-ds-border bg-ds-surface-2 text-ds-text-primary shadow-none',
  'transition-[background,border-color,color,transform] duration-150 ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary',
  'active:scale-[0.97]'
].join(' ')

const TOAST_ROOT_CLASS = [
  'pointer-events-auto relative flex min-w-60 max-w-80 items-center gap-3',
  'rounded-ds-sm border border-ds-border bg-ds-surface-1 px-3.5 py-3 text-ds-text-primary shadow-none',
  'data-[type=success]:border-[rgba(245,245,247,0.48)] data-[type=error]:border-[rgba(255,138,130,0.48)]',
  'opacity-100 [transform:translateY(0)_scale(1)] transition-[opacity,transform] duration-ds-standard ease-ds-spring will-change-transform motion-reduce:transition-none motion-reduce:transform-none',
  'data-[starting-style]:opacity-0 data-[starting-style]:[transform:translateY(8px)_scale(0.985)]',
  'data-[ending-style]:pointer-events-none data-[ending-style]:opacity-0 data-[ending-style]:duration-ds-fast data-[ending-style]:ease-ds-standard data-[ending-style]:[transform:translateY(8px)_scale(0.985)]'
].join(' ')

export function PopupToasts() {
  const toasts = usePopupToasts()

  return (
    <section
      id="toast-root"
      className="pointer-events-none fixed bottom-[18px] right-[18px] z-30"
      aria-live="polite"
      aria-atomic="true"
    >
      <ToastList
        className="flex flex-col items-end gap-2.5"
        contentClassName="min-w-0 flex-1"
        descriptionClassName="m-0 text-[13px] leading-[1.45] tracking-[0.01em] text-ds-text-primary"
        items={toasts.map((toast) => ({
          actions: (
            <>
              {toast.action ? (
                <Button
                  className={TOAST_BUTTON_CLASS}
                  type="button"
                  onClick={() => dispatchPopupToastAction(String(toast.id || ''), String(toast.action || ''))}
                  unstyled
                >
                  {String(toast.actionLabel || '') || '操作'}
                </Button>
              ) : null}
              <Button
                className={TOAST_BUTTON_CLASS}
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
        rootClassName={TOAST_ROOT_CLASS}
        timeout={0}
        unstyled
      />
    </section>
  )
}
