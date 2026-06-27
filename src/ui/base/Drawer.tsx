import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react'
import { Presence } from '../motion/Presence'
import { MotionPanel } from '../motion/MotionPanel'
import { cx } from './utils'

export interface DrawerProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}

export function Drawer({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children
}: DrawerProps) {
  return (
    <BaseDrawer.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      swipeDirection="right"
    >
      {trigger ? <BaseDrawer.Trigger render={<span />}>{trigger}</BaseDrawer.Trigger> : null}
      <BaseDrawer.Portal>
        <Presence>
          <BaseDrawer.Backdrop className="t-modal-backdrop fixed inset-0 z-40 bg-ds-overlay" />
          <BaseDrawer.Viewport>
            <BaseDrawer.Popup
              render={
                <MotionPanel
                  variant="drawer"
                  className="fixed right-0 top-0 z-50 grid h-dvh w-[min(92vw,28rem)] content-start gap-4 border-l border-ds-border bg-ds-surface-2 p-4 text-ds-text-primary shadow-ds-dialog outline-none"
                />
              }
            >
              <BaseDrawer.Content className="contents">
                <header className="grid gap-1">
                  <BaseDrawer.Title className="text-base font-semibold">{title}</BaseDrawer.Title>
                  {description ? (
                    <BaseDrawer.Description className="text-sm text-ds-text-secondary">
                      {description}
                    </BaseDrawer.Description>
                  ) : null}
                </header>
                {children}
              </BaseDrawer.Content>
            </BaseDrawer.Popup>
          </BaseDrawer.Viewport>
        </Presence>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  )
}

type BaseDrawerRootProps = ComponentPropsWithoutRef<typeof BaseDrawer.Root>
type BaseDrawerPortalProps = ComponentPropsWithoutRef<typeof BaseDrawer.Portal>
type BaseDrawerPopupProps = ComponentPropsWithoutRef<typeof BaseDrawer.Popup>
type BaseDrawerCloseProps = ComponentPropsWithoutRef<typeof BaseDrawer.Close>

export interface DrawerOverlayProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  open: boolean
  onOpenChange?: (open: boolean, event?: Event) => void
  triggerId?: string | null
  modal?: BaseDrawerRootProps['modal']
  disablePointerDismissal?: BaseDrawerRootProps['disablePointerDismissal']
  keepMounted?: BaseDrawerPortalProps['keepMounted']
  overlayRef?: Ref<HTMLDivElement>
  portalContainer?: BaseDrawerPortalProps['container']
  swipeDirection?: BaseDrawerRootProps['swipeDirection']
}

export function DrawerOverlay({
  open,
  onOpenChange,
  triggerId,
  modal,
  disablePointerDismissal,
  keepMounted = true,
  overlayRef,
  portalContainer,
  swipeDirection = 'right',
  children,
  ...overlayProps
}: DrawerOverlayProps) {
  return (
    <BaseDrawer.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        onOpenChange?.(nextOpen, eventDetails.event)
      }}
      triggerId={triggerId}
      modal={modal}
      disablePointerDismissal={disablePointerDismissal}
      swipeDirection={swipeDirection}
    >
      <BaseDrawer.Portal keepMounted={keepMounted} container={portalContainer}>
        <div {...overlayProps} ref={overlayRef}>
          <BaseDrawer.Viewport>{children}</BaseDrawer.Viewport>
        </div>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  )
}

export interface DrawerPanelProps extends Omit<BaseDrawerPopupProps, 'className' | 'render'> {
  className?: string
  motionClassName?: string
  motionVariant?: ComponentPropsWithoutRef<typeof MotionPanel>['variant']
  ref?: Ref<HTMLDivElement>
  unanimated?: boolean
}

export function DrawerPanel({
  className,
  motionClassName,
  motionVariant = 'drawer',
  ref,
  unanimated = false,
  children,
  ...popupProps
}: DrawerPanelProps) {
  const content = <BaseDrawer.Content className="contents">{children}</BaseDrawer.Content>

  if (unanimated) {
    return (
      <BaseDrawer.Popup ref={ref} className={className} {...popupProps}>
        {content}
      </BaseDrawer.Popup>
    )
  }

  return (
    <BaseDrawer.Popup
      ref={ref}
      render={<MotionPanel variant={motionVariant} className={cx(className, motionClassName)} />}
      {...popupProps}
    >
      {content}
    </BaseDrawer.Popup>
  )
}

export function DrawerClose(props: BaseDrawerCloseProps) {
  return <BaseDrawer.Close {...props} />
}
