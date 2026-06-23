import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import {
  createElement,
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref
} from 'react'
import { Presence } from '../motion/Presence'
import { MotionPanel } from '../motion/MotionPanel'
import { Button } from './Button'
import { cx } from './utils'

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer
}: DialogProps) {
  return (
    <BaseDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <BaseDialog.Trigger render={<span />}>{trigger}</BaseDialog.Trigger> : null}
      <BaseDialog.Portal>
        <Presence>
          <BaseDialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-ds-overlay supports-[-webkit-touch-callout:none]:absolute" />
          <BaseDialog.Popup
            render={
              <MotionPanel
                variant="dialog"
                className="fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-ds-lg border border-ds-border bg-ds-surface-2 p-4 text-ds-text-primary shadow-ds-dialog outline-none"
              />
            }
          >
            <header className="grid gap-1">
              <BaseDialog.Title className="text-base font-semibold">{title}</BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="text-sm text-ds-text-secondary">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </header>
            {children}
            {footer ? <footer className="flex justify-end gap-2">{footer}</footer> : null}
          </BaseDialog.Popup>
        </Presence>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

export function DialogCloseButton({ children = 'Close' }: { children?: ReactNode }) {
  return (
    <BaseDialog.Close render={<Button variant="secondary" />}>
      {children}
    </BaseDialog.Close>
  )
}

type BaseDialogRootProps = ComponentPropsWithoutRef<typeof BaseDialog.Root>
type BaseDialogPortalProps = ComponentPropsWithoutRef<typeof BaseDialog.Portal>
type BaseDialogPopupProps = ComponentPropsWithoutRef<typeof BaseDialog.Popup>
type BaseDialogTitleProps = ComponentPropsWithoutRef<typeof BaseDialog.Title>
type BaseDialogDescriptionProps = ComponentPropsWithoutRef<typeof BaseDialog.Description>
type BaseDialogBackdropProps = ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
type BaseDialogCloseProps = ComponentPropsWithoutRef<typeof BaseDialog.Close>

type DialogTitleElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export interface DialogOverlayProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  open: boolean
  onOpenChange?: (open: boolean, event?: Event) => void
  triggerId?: string | null
  modal?: BaseDialogRootProps['modal']
  disablePointerDismissal?: BaseDialogRootProps['disablePointerDismissal']
  keepMounted?: BaseDialogPortalProps['keepMounted']
  portalContainer?: BaseDialogPortalProps['container']
  ref?: Ref<HTMLDivElement>
}

export function DialogOverlay({
  open,
  onOpenChange,
  triggerId,
  modal,
  disablePointerDismissal,
  keepMounted = true,
  portalContainer,
  children,
  ref,
  ...overlayProps
}: DialogOverlayProps) {
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        onOpenChange?.(nextOpen, eventDetails.event)
      }}
      triggerId={triggerId}
      modal={modal}
      disablePointerDismissal={disablePointerDismissal}
    >
      <BaseDialog.Portal keepMounted={keepMounted} container={portalContainer}>
        <div ref={ref} {...overlayProps}>{children}</div>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

export interface DialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
  motionVariant?: ComponentPropsWithoutRef<typeof MotionPanel>['variant']
  motionClassName?: string
  ref?: Ref<HTMLDivElement>
  unanimated?: boolean
}

export function DialogPanel({
  className,
  motionClassName,
  motionVariant = 'dialog',
  ref,
  unanimated = false,
  ...props
}: DialogPanelProps) {
  if (unanimated) {
    return <BaseDialog.Popup ref={ref} className={className} {...props} />
  }

  return (
    <BaseDialog.Popup
      ref={ref}
      render={<MotionPanel variant={motionVariant} className={cx(className, motionClassName)} />}
      {...props}
    />
  )
}

export interface InlineDialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
}

export function InlineDialogPanel({ className, ...props }: InlineDialogPanelProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  const setInlinePortalContainer = useCallback((element: HTMLDivElement | null) => {
    setPortalContainer(element)
  }, [])

  return (
    <BaseDialog.Root open modal={false}>
      {portalContainer ? (
        <BaseDialog.Portal keepMounted container={portalContainer}>
          <BaseDialog.Popup className={className} {...props} />
        </BaseDialog.Portal>
      ) : null}
      <div ref={setInlinePortalContainer} />
    </BaseDialog.Root>
  )
}

export interface DialogTitleProps extends BaseDialogTitleProps {
  as?: DialogTitleElement
}

export function DialogTitle({ as, render, ...props }: DialogTitleProps) {
  return (
    <BaseDialog.Title
      render={render ?? (as ? createElement(as) : undefined)}
      {...props}
    />
  )
}

export function DialogDescription(props: BaseDialogDescriptionProps) {
  return <BaseDialog.Description {...props} />
}

export function DialogBackdrop(props: BaseDialogBackdropProps) {
  return <BaseDialog.Backdrop {...props} />
}

export function DialogClose(props: BaseDialogCloseProps) {
  return <BaseDialog.Close {...props} />
}
