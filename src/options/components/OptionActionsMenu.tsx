import { Menu } from '@base-ui/react/menu'
import { Fragment } from 'react'
import { Button } from '../../ui/base/Button'
import { Icon } from '../../ui/icons/Icon'
import type { IconName } from '../../ui/icons/icon-map'
import { MotionPanel } from '../../ui/motion/MotionPanel'

export interface OptionMenuAction {
  id: string
  label: string
  description?: string
  icon?: IconName
  disabled?: boolean
  separatorBefore?: boolean
  onSelect: () => void
}

export function OptionActionsMenu({ actions, label }: { actions: OptionMenuAction[]; label: string }) {
  if (!actions.length) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger aria-label={label} disabled={actions.every(action => action.disabled)} render={<Button size="sm" variant="secondary" />}>
        更多操作 <Icon name="ChevronDown" size={14} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} collisionPadding={12} className="z-[10000]">
          <Menu.Popup
            aria-label={label}
            render={<MotionPanel variant="menu" />}
            className="max-h-[var(--available-height)] w-[min(320px,calc(100vw_-_24px))] overflow-y-auto rounded-ds-md border border-ds-border bg-ds-surface-2 p-1.5 shadow-lg outline-none"
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
                  className="flex min-h-10 w-full cursor-pointer items-start gap-2.5 rounded-ds-sm px-3 py-2.5 text-left text-[13px] text-ds-text-primary outline-none hover:bg-ds-hover data-[highlighted]:bg-ds-hover data-[disabled]:cursor-default data-[disabled]:opacity-45"
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
