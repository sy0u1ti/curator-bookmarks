import { Menu as BaseMenu } from '@base-ui/react/menu'
import { useRef, type Ref, type ReactNode } from 'react'
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
}

export function Menu({ trigger, actions }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={<span />}>{trigger}</BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={6}>
          <BaseMenu.Popup
            render={
              <MotionPanel
                variant="menu"
                className="z-50 min-w-40 rounded-md border border-curator-border bg-curator-bg-elevated p-1 text-sm text-curator-text shadow-[var(--shadow-popover)] outline-none"
              />
            }
          >
            {actions.map((action) => (
              <BaseMenu.Item
                key={action.id}
                disabled={action.disabled}
                onClick={action.onSelect}
                className="flex cursor-default items-center justify-between gap-3 rounded px-2.5 py-2 outline-none data-[highlighted]:bg-curator-muted data-[disabled]:opacity-45"
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
  open: boolean
  trigger: ReactNode
}

export function InlineMenu({
  actions,
  className,
  id,
  label,
  open,
  trigger
}: InlineMenuProps) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)

  return (
    <BaseMenu.Root open={open} modal={false}>
      <BaseMenu.Trigger render={<span />}>{trigger}</BaseMenu.Trigger>
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
                  render={<button type="button" />}
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

export interface InlineMenuListProps {
  actions: InlineMenuAction[]
  className?: string
  label: string
}

export function InlineMenuList({ actions, className, label }: InlineMenuListProps) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)

  return (
    <BaseMenu.Root open modal={false}>
      <span ref={portalContainerRef} />
      <BaseMenu.Portal container={portalContainerRef}>
        <BaseMenu.Positioner
          render={(positionerProps) => {
            const {
              hidden: _hidden,
              style: _style,
              role: _role,
              ...inlinePositionerProps
            } = positionerProps
            return <div {...inlinePositionerProps} />
          }}
        >
          <BaseMenu.Popup
            aria-label={label}
            render={<MotionPanel variant="menu" className={className} />}
          >
            {actions.map((action) => (
              <BaseMenu.Item
                key={action.id}
                disabled={action.disabled}
                closeOnClick={action.closeOnSelect ?? false}
                render={<button type="button" />}
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
    </BaseMenu.Root>
  )
}
