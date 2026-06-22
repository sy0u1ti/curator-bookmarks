import { Button } from '../../ui/base/Button'
import { ToastList } from '../../ui/base/Toast'
import {
  dispatchPopupToastAction,
  usePopupToasts
} from '../popup-controller-store'

const TOAST_BUTTON_CLASS = [
  'inline-flex min-h-8 items-center justify-center rounded-[var(--ui-radius-control)] border px-2.5 text-xs font-semibold',
  'border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-primary)] shadow-none',
  'transition-[background,border-color,color,transform] duration-150 ease-[var(--ui-ease-standard)]',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)]',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)]',
  'active:scale-[0.97]'
].join(' ')

const TOAST_ROOT_CLASS = [
  'pointer-events-auto relative flex min-w-60 max-w-80 items-center gap-3',
  'rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] px-3.5 py-3 text-[var(--ui-text-primary)] shadow-none',
  'data-[type=success]:border-[rgba(245,245,247,0.48)] data-[type=error]:border-[rgba(255,138,130,0.48)]',
  'opacity-100 [transform:translateY(0)_scale(1)] transition-[opacity,transform] duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-spring)] will-change-transform motion-reduce:transition-none motion-reduce:transform-none',
  'data-[starting-style]:opacity-0 data-[starting-style]:[transform:translateY(8px)_scale(0.985)]',
  'data-[ending-style]:pointer-events-none data-[ending-style]:opacity-0 data-[ending-style]:duration-[var(--ui-motion-fast)] data-[ending-style]:ease-[var(--ui-ease-standard)] data-[ending-style]:[transform:translateY(8px)_scale(0.985)]'
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
        descriptionClassName="m-0 text-[13px] leading-[1.45] tracking-[0.01em] text-[var(--ui-text-primary)]"
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
