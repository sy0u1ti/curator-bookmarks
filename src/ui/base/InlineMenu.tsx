import { Menu as BaseMenu, type MenuRoot } from '@base-ui/react/menu'
import { useCallback, useRef, type ComponentPropsWithRef, type ReactElement, type ReactNode, type Ref } from 'react'
import type { IconName } from '../icons/Icon'
import { MotionPanel } from '../motion/MotionPanel'
import { InlineMenuItems, useMenuCascade } from './InlineMenuItems'
import { cx } from './utils'

export interface InlineMenuAction {
  id: string
  label: ReactNode
  icon?: IconName
  children?: InlineMenuAction[] | (() => InlineMenuAction[])
  attributes?: Record<string, string>
  className?: string
  closeOnSelect?: boolean
  disabled?: boolean
  destructive?: boolean
  itemRef?: Ref<HTMLElement>
  onSelect?: () => void | Promise<void>
}

export interface InlineMenuProps {
  actions: InlineMenuAction[]
  className?: string
  id?: string
  label: string
  onOpenChange?: (open: boolean, eventDetails: MenuRoot.ChangeEventDetails) => void
  open: boolean
  trigger: ReactNode
  triggerProps?: ComponentPropsWithRef<'button'> & {
    [key: `data-${string}`]: string | undefined
  }
  triggerWrapper?: (trigger: ReactElement) => ReactElement
}

export function InlineMenu({
  actions,
  className,
  id,
  label,
  onOpenChange,
  open,
  trigger,
  triggerProps,
  triggerWrapper
}: InlineMenuProps) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const actionsRef = useRef<BaseMenu.Root.Actions | null>(null)
  const cascade = useMenuCascade({ actions, open, anchor: anchorRef, onClose: () => actionsRef.current?.close() })
  const triggerRef = triggerProps?.ref
  const registerAnchor = useCallback((node: HTMLButtonElement | null) => {
    anchorRef.current = node
    if (typeof triggerRef === 'function') {
      const cleanup = triggerRef(node)
      if (typeof cleanup === 'function') return () => { anchorRef.current = null; cleanup() }
    } else if (triggerRef) {
      triggerRef.current = node
    }
  }, [triggerRef])
  const menuTrigger = <BaseMenu.Trigger {...triggerProps} className={cx('curator-control', triggerProps?.className)} ref={registerAnchor}>{trigger}</BaseMenu.Trigger>

  return (
    <BaseMenu.Root
      open={open}
      modal={false}
      actionsRef={actionsRef}
      highlightItemOnHover={!cascade.enabled}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen) cascade.intent.reset()
        onOpenChange?.(nextOpen, eventDetails)
      }}
    >
      {triggerWrapper ? triggerWrapper(menuTrigger) : menuTrigger}
      <span ref={portalContainerRef} />
      <BaseMenu.Portal keepMounted container={portalContainerRef}>
        <BaseMenu.Positioner sideOffset={6} positionMethod="absolute">
          <BaseMenu.Popup
            id={id}
            aria-label={label}
            render={<MotionPanel variant="menu" className={className} />}
          >
            <InlineMenuItems actions={actions} cascade={cascade} closeOnSelect />
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
