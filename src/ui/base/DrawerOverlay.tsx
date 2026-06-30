import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import type { ComponentPropsWithoutRef, Ref } from 'react'

type BaseDrawerRootProps = ComponentPropsWithoutRef<typeof BaseDrawer.Root>
type BaseDrawerPortalProps = ComponentPropsWithoutRef<typeof BaseDrawer.Portal>

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
