import { Menu as BaseMenu } from '@base-ui/react/menu'
import { useRef } from 'react'
import { MotionPanel } from '../motion/MotionPanel'
import type { InlineMenuAction } from './InlineMenu.js'
import { getInlineMenuActionLabel } from './menu-labels.js'

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
    </BaseMenu.Root>
  )
}
