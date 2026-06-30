import { Toast as BaseToast } from '@base-ui/react/toast'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { cx } from './utils'

export interface ToastItem {
  action?: string
  actionLabel?: ReactNode
  actions?: ReactNode
  description: ReactNode
  id: string
  priority?: 'high' | 'low'
  title?: ReactNode
  type?: string
}

export interface ToastListProps {
  actionClassName?: string
  className?: string
  closeClassName?: string
  closeLabel?: ReactNode
  contentClassName?: string
  descriptionClassName?: string
  items: ToastItem[]
  limit?: number
  rootClassName?: string
  titleClassName?: string
  timeout?: number
  unstyled?: boolean
}

export function ToastList({
  actionClassName,
  className,
  closeClassName,
  closeLabel = 'Close',
  contentClassName,
  descriptionClassName,
  items,
  limit,
  rootClassName,
  titleClassName,
  timeout = 0,
  unstyled = false
}: ToastListProps) {
  return (
    <BaseToast.Provider limit={limit ?? Math.max(1, items.length || 1)} timeout={timeout}>
      <ToastListViewport
        actionClassName={actionClassName}
        className={className}
        closeClassName={closeClassName}
        closeLabel={closeLabel}
        contentClassName={contentClassName}
        descriptionClassName={descriptionClassName}
        items={items}
        rootClassName={rootClassName}
        titleClassName={titleClassName}
        timeout={timeout}
        unstyled={unstyled}
      />
    </BaseToast.Provider>
  )
}

function ToastListViewport({
  actionClassName,
  className,
  closeClassName,
  closeLabel,
  contentClassName,
  descriptionClassName,
  items,
  rootClassName,
  titleClassName,
  timeout,
  unstyled
}: Omit<ToastListProps, 'limit'>) {
  const manager = BaseToast.useToastManager()
  const syncedSignaturesRef = useRef<Map<string, string> | null>(null)
  if (syncedSignaturesRef.current === null) {
    syncedSignaturesRef.current = new Map()
  }
  const syncedSignatures = syncedSignaturesRef.current
  const itemById = useMemo(() => {
    return new Map(items.map((item) => [item.id, item]))
  }, [items])

  useLayoutEffect(() => {
    const nextIds = new Set(items.map((item) => item.id))
    for (const toast of manager.toasts) {
      if (!nextIds.has(toast.id) && toast.transitionStatus !== 'ending') {
        manager.close(toast.id)
        syncedSignatures.delete(toast.id)
      }
    }

    const toastById = new Map(manager.toasts.map((toast) => [toast.id, toast]))
    for (const item of items) {
      const signature = getToastItemSignature(item)
      const existingToast = toastById.get(item.id)
      if (existingToast && syncedSignatures.get(item.id) === signature) {
        continue
      }

      manager.add({
        actionProps: item.action
          ? {
              children: item.actionLabel || 'Action'
            }
          : undefined,
        description: item.description,
        id: item.id,
        priority: item.priority,
        title: item.title,
        timeout,
        type: item.type
      })
      syncedSignatures.set(item.id, signature)
    }
  }, [items, manager, syncedSignatures, timeout])

  return (
    <BaseToast.Viewport className={className}>
      {manager.toasts.map((toast) => {
        const item = itemById.get(toast.id)

        return (
          <BaseToast.Root
            key={toast.id}
            toast={toast}
            className={unstyled ? rootClassName : cx(
              't-toast flex items-center gap-3 rounded-md border border-ds-border bg-ds-surface-2 p-3 text-ds-text-primary shadow-ds-popover',
              rootClassName
            )}
            data-toast-id={toast.id}
            swipeDirection={[]}
          >
            <BaseToast.Content className={contentClassName}>
              <BaseToast.Title className={titleClassName} />
              <BaseToast.Description className={descriptionClassName} />
            </BaseToast.Content>
            {item?.actions ?? (
              <>
                <BaseToast.Action
                  className={unstyled ? actionClassName : cx(
                    'inline-flex h-8 items-center rounded border border-ds-border px-2.5 text-xs',
                    actionClassName
                  )}
                  data-toast-action={item?.action}
                  data-toast-id={toast.id}
                />
                <BaseToast.Close
                  className={unstyled ? closeClassName : cx(
                    'inline-flex h-8 items-center rounded border border-ds-border px-2.5 text-xs',
                    closeClassName
                  )}
                  render={<Button type="button" unstyled />}
                  data-dismiss-toast={toast.id}
                >
                  {closeLabel}
                </BaseToast.Close>
              </>
            )}
          </BaseToast.Root>
        )
      })}
    </BaseToast.Viewport>
  )
}

function getToastItemSignature(item: ToastItem): string {
  return [
    item.id,
    String(item.title ?? ''),
    String(item.description ?? ''),
    item.action ?? '',
    String(item.actionLabel ?? ''),
    item.priority ?? '',
    item.type ?? '',
    item.actions ? 'custom-actions' : ''
  ].join('\u0001')
}
