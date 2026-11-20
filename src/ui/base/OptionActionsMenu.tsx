import { Menu } from '@base-ui/react/menu'
import { Fragment } from 'react'
import { Button } from './Button'
import { Icon } from '../icons/Icon'
import type { IconName } from '../icons/icon-map'
import { MotionPanel } from '../motion/MotionPanel'

export interface OptionMenuAction {
  id: string
  label: string
  description?: string
  icon?: IconName
  disabled?: boolean
  danger?: boolean
  separatorBefore?: boolean
  onSelect: () => void
}

export function OptionActionsMenu({ actions, label, triggerLabel = '更多操作', disabled = false, iconOnly = false, side = 'bottom' }: {
  actions: OptionMenuAction[]
  label: string
  triggerLabel?: string
  disabled?: boolean
  iconOnly?: boolean
  /** A trigger at the bottom of a fixed-height surface opens upward. */
  side?: 'top' | 'bottom'
}) {
  if (!actions.length) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger aria-label={label} disabled={disabled || actions.every(action => action.disabled)}
        render={<Button size={iconOnly ? 'icon-sm' : 'sm'} variant={iconOnly ? 'ghost' : 'secondary'} />}>
        {iconOnly ? <Icon name="MoreHorizontal" size={16} aria-hidden="true" /> : triggerLabel}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side={side} align="end" sideOffset={6} collisionPadding={12} className="z-[10000]">
          <Menu.Popup
            aria-label={label}
            render={<MotionPanel variant="menu" />}
            className="max-h-[var(--available-height)] w-[min(320px,calc(100vw_-_24px))] overflow-y-auto rounded-ds-menu border border-ds-border bg-ds-surface-2 ds-inset-menu [filter:var(--ds-filter-popover)] outline-none"
          >
            {actions.map(action => (
              <Fragment key={action.id}>
                {action.separatorBefore ? <Menu.Separator className="my-1 h-px bg-ds-border-subtle" /> : null}
                <Menu.Item
                  disabled={action.disabled}
                  nativeButton
                  render={<button type="button" />}
                  aria-label={action.description ? action.label + '：' + action.description : action.label}
                  onClick={action.onSelect}
                  className={`curator-menu-item flex min-h-10 w-full cursor-pointer items-start gap-2.5 rounded-ds-sm px-3 py-2.5 text-left text-[13px] outline-none data-[disabled]:cursor-default data-[disabled]:opacity-45 ${
                    action.danger ? 'text-ds-danger-text hover:bg-ds-danger-soft data-[highlighted]:bg-ds-danger-soft'
                      : 'text-ds-text-primary hover:bg-ds-hover data-[highlighted]:bg-ds-hover'}`}
                >
                  {action.icon ? <Icon name={action.icon} size={15} aria-hidden="true" className="mt-0.5 shrink-0" /> : null}
                  <span className="grid min-w-0 gap-1">
                    <span className="font-medium leading-5">{action.label}</span>
                    {action.description ? <span className="text-xs leading-[1.5] text-ds-text-secondary [overflow-wrap:anywhere]">{action.description}</span> : null}
                  </span>
                </Menu.Item>
              </Fragment>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
