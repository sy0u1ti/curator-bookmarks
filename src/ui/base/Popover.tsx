import { Popover as BasePopover } from '@base-ui/react/popover'
import { useCallback, useState, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react'
import { Icon } from '../icons/Icon'
import { MotionPanel } from '../motion/MotionPanel'
import { cx } from './utils'

type BasePopoverRootProps = ComponentPropsWithoutRef<typeof BasePopover.Root>
type BasePopoverPortalProps = ComponentPropsWithoutRef<typeof BasePopover.Portal>
type BasePopoverPositionerProps = ComponentPropsWithoutRef<typeof BasePopover.Positioner>
type BasePopoverPopupProps = ComponentPropsWithoutRef<typeof BasePopover.Popup>

export interface PopoverProps {
  align?: 'start' | 'center' | 'end'
  className?: string
  id?: string
  modal?: BasePopoverRootProps['modal']
  onOpenChange?: (open: boolean) => void
  open?: boolean
  popupClassName?: string
  portal?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  trigger: ReactElement
  triggerId?: string
  triggerNativeButton?: boolean
  title?: ReactNode
  children: ReactNode
}

export function Popover({
  align = 'center',
  className,
  id,
  modal = false,
  onOpenChange,
  open,
  popupClassName,
  portal = true,
  side = 'bottom',
  sideOffset = 8,
  trigger,
  triggerId,
  triggerNativeButton,
  title,
  children
}: PopoverProps) {
  const popup = (
    <BasePopover.Positioner align={align} side={side} sideOffset={sideOffset}>
      <BasePopover.Popup
        id={id}
        render={
          <MotionPanel
            variant="popover"
            className={cx(
              'z-50 grid max-w-80 gap-2 rounded-ds-lg border border-ds-border bg-ds-surface-2 p-3 text-sm text-ds-text-primary shadow-ds-popover outline-none',
              popupClassName,
              className
            )}
          />
        }
      >
        <BasePopover.Arrow className="text-ds-accent-contrast-elevated" />
        {title ? <BasePopover.Title className="font-semibold">{title}</BasePopover.Title> : null}
        {children}
      </BasePopover.Popup>
    </BasePopover.Positioner>
  )

  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange} triggerId={triggerId} modal={modal}>
      <BasePopover.Trigger id={triggerId} render={trigger} nativeButton={triggerNativeButton} />
      <PopoverPortal container={portal ? undefined : null} keepMounted>
        {popup}
      </PopoverPortal>
    </BasePopover.Root>
  )
}

export interface PopoverRootProps {
  open: boolean
  onOpenChange?: (open: boolean, event?: Event) => void
  triggerId?: string | null
  modal?: BasePopoverRootProps['modal']
  children: ReactNode
}

export function PopoverRoot({
  open,
  onOpenChange,
  triggerId,
  modal = false,
  children
}: PopoverRootProps) {
  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        onOpenChange?.(nextOpen, eventDetails.event)
      }}
      triggerId={triggerId}
      modal={modal}
    >
      {children}
    </BasePopover.Root>
  )
}

export interface PopoverPortalProps extends BasePopoverPortalProps {}

export function PopoverPortal({
  container,
  children,
  ...props
}: PopoverPortalProps) {
  const [inlinePortalContainer, setInlinePortalContainer] = useState<HTMLDivElement | null>(null)
  const handleInlinePortalRef = useCallback((node: HTMLDivElement | null) => {
    setInlinePortalContainer(node)
  }, [])

  if (container === null) {
    return (
      <>
        {inlinePortalContainer ? (
          <BasePopover.Portal {...props} container={inlinePortalContainer}>
            {children}
          </BasePopover.Portal>
        ) : null}
        <div ref={handleInlinePortalRef} />
      </>
    )
  }

  return (
    <BasePopover.Portal {...props} container={container}>
      {children}
    </BasePopover.Portal>
  )
}

export interface PopoverPositionerProps extends BasePopoverPositionerProps {}

export function PopoverPositioner(props: PopoverPositionerProps) {
  return <BasePopover.Positioner {...props} />
}

export interface PopoverPopupProps extends BasePopoverPopupProps {}

export function PopoverPopup(props: PopoverPopupProps) {
  return (
    <BasePopover.Popup
      render={<MotionPanel variant="popover" />}
      {...props}
    />
  )
}

export function HelpTrigger({ label = 'Help' }: { label?: string }) {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-ds-sm border border-ds-border text-ds-text-secondary">
      <Icon name="CircleHelp" size={15} aria-label={label} />
    </span>
  )
}
