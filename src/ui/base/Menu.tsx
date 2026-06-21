import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Icon } from '../icons/Icon'
import { MotionPanel } from '../motion/MotionPanel'

export interface MenuAction {
  id: string
  label: ReactNode
  disabled?: boolean
  destructive?: boolean
  onSelect?: () => void
}

export interface MenuProps {
  trigger: ReactNode
  actions: MenuAction[]
  triggerProps?: ComponentPropsWithRef<'button'> & {
    [key: `data-${string}`]: string | undefined
  }
}

export function Menu({ trigger, actions, triggerProps }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger {...triggerProps}>{trigger}</BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={6}>
          <BaseMenu.Popup
            render={
              <MotionPanel
                variant="menu"
                className="z-50 min-w-40 rounded-[var(--ui-radius-panel)] border border-curator-border bg-curator-bg-elevated p-1 text-sm text-curator-text shadow-[var(--shadow-popover)] outline-none"
              />
            }
          >
            {actions.map((action) => (
              <BaseMenu.Item
                key={action.id}
                disabled={action.disabled}
                onClick={action.onSelect}
                className="flex cursor-default items-center justify-between gap-3 rounded-[var(--ui-radius-control)] px-2.5 py-2 outline-none data-[highlighted]:bg-curator-muted data-[disabled]:opacity-45"
              >
                <span className={action.destructive ? 'text-red-200' : ''}>{action.label}</span>
                {action.destructive ? <Icon name="Trash2" size={14} aria-hidden="true" /> : null}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}

export {
  InlineMenu
} from './InlineMenu.js'
export type {
  InlineMenuAction,
  InlineMenuProps
} from './InlineMenu.js'
export {
  InlineMenuList
} from './InlineMenuList.js'
export type {
  InlineMenuListProps
} from './InlineMenuList.js'
