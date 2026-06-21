import { Menu as BaseMenu, type MenuRoot } from '@base-ui/react/menu'
import { useRef, type ComponentPropsWithRef, type ReactElement, type ReactNode, type Ref } from 'react'
import { MotionPanel } from '../motion/MotionPanel'
import { getInlineMenuActionLabel } from './menu-labels.js'

export interface InlineMenuAction {
  id: string
  label: ReactNode
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
  const menuTrigger = <BaseMenu.Trigger {...triggerProps}>{trigger}</BaseMenu.Trigger>

  return (
    <BaseMenu.Root
      open={open}
      modal={false}
      onOpenChange={(nextOpen, eventDetails) => {
        onOpenChange?.(nextOpen, eventDetails)
      }}
    >
      {triggerWrapper ? triggerWrapper(menuTrigger) : menuTrigger}
      <span ref={portalContainerRef} />
      {open ? (
        <BaseMenu.Portal container={portalContainerRef}>
          <BaseMenu.Positioner sideOffset={6} positionMethod="absolute">
            <BaseMenu.Popup
              id={id}
              aria-label={label}
              render={<MotionPanel variant="menu" className={className} />}
            >
              {actions.map((action) => (
                <BaseMenu.Item
                  key={action.id}
                  disabled={action.disabled}
                  closeOnClick={action.closeOnSelect ?? true}
                  nativeButton
                  render={<button type="button" aria-label={getInlineMenuActionLabel(action)} />}
                  className={action.className || (action.destructive ? 'danger' : '')}
                  ref={action.itemRef}
                  onClick={() => {
                    void action.onSelect?.()
                  }}
                  {...action.attributes}
                >
                  {action.label}
                </BaseMenu.Item>
              ))}
            </BaseMenu.Popup>
          </BaseMenu.Positioner>
        </BaseMenu.Portal>
      ) : null}
    </BaseMenu.Root>
  )
}
