import { Menu as BaseMenu } from '@base-ui/react/menu'
import { useRef } from 'react'
import { MotionPanel } from '../motion/MotionPanel'
import type { InlineMenuAction } from './InlineMenu.js'
import { InlineMenuItems, useMenuCascade } from './InlineMenuItems'

export interface InlineMenuListProps {
  actions: InlineMenuAction[]
  className?: string
  label: string
  active?: boolean
  animated?: boolean
  submenuAttributes?: Record<string, string>
}

export function InlineMenuList({ actions, active = true, animated = true, className, label, submenuAttributes }: InlineMenuListProps) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)
  const cascade = useMenuCascade({ actions, open: active })

  return (
    <BaseMenu.Root
      open
      modal={false}
      disabled={!active}
      highlightItemOnHover={!cascade.enabled}
      onOpenChange={(open, details) => {
        // This root is inline, and the cascade owns pointer/sibling changes.
        // A submenu opening must not reset the parent that just opened it.
        if (details.reason === 'sibling-open' || details.reason === 'trigger-hover' ||
          (!open && (details.reason === 'outside-press' || details.reason === 'focus-out') && cascade.containsEventTarget(details.event))) {
          details.cancel()
          return
        }
        if (!open) cascade.intent.reset()
      }}
    >
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
            className={animated ? undefined : className}
            render={animated ? <MotionPanel variant="menu" material={false} className={className} /> : undefined}
          >
            <InlineMenuItems
              actions={actions}
              cascade={cascade}
              closeOnSelect={false}
              submenuAttributes={submenuAttributes}
            />
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
