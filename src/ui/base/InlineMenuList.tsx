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
  submenuAttributes?: Record<string, string>
}

export function InlineMenuList({ actions, active = true, className, label, submenuAttributes }: InlineMenuListProps) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)
  const cascade = useMenuCascade({ actions, open: active })

  return (
    <BaseMenu.Root
      open
      modal={false}
      disabled={!active}
      highlightItemOnHover={!cascade.enabled}
      onOpenChange={(open) => { if (!open) cascade.intent.reset() }}
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
            render={<MotionPanel variant="menu" className={className} />}
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
