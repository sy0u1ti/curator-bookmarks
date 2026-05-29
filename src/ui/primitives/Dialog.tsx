import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { createElement, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
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
          <BaseDialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-black/60 supports-[-webkit-touch-callout:none]:absolute" />
          <BaseDialog.Popup
            render={
              <MotionPanel
                variant="dialog"
                className="fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-curator-border bg-curator-bg-elevated p-4 text-curator-text shadow-[var(--shadow-popover)] outline-none"
              />
            }
          >
            <header className="grid gap-1">
              <BaseDialog.Title className="text-base font-semibold">{title}</BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="text-sm text-curator-text-muted">
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
        <div {...overlayProps}>{children}</div>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

export interface DialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
  motionVariant?: ComponentPropsWithoutRef<typeof MotionPanel>['variant']
  motionClassName?: string
  unanimated?: boolean
}

export function DialogPanel({
  className,
  motionClassName,
  motionVariant = 'dialog',
  unanimated = false,
  ...props
}: DialogPanelProps) {
  if (unanimated) {
    return <BaseDialog.Popup className={className} {...props} />
  }

  return (
    <BaseDialog.Popup
      render={<MotionPanel variant={motionVariant} className={cx(className, motionClassName)} />}
      {...props}
    />
  )
}

export interface InlineDialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
}

export function InlineDialogPanel({ className, ...props }: InlineDialogPanelProps) {
  const inlinePortalRef = useRef<HTMLDivElement>(null)

  return (
    <BaseDialog.Root open modal={false}>
      <BaseDialog.Portal keepMounted container={inlinePortalRef}>
        <BaseDialog.Popup className={className} {...props} />
      </BaseDialog.Portal>
      <div ref={inlinePortalRef} />
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

export function DialogClose(props: BaseDialogCloseProps) {
  return <BaseDialog.Close {...props} />
}
