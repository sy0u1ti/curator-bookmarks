import type { ReactNode } from 'react'
import { Button } from '../../ui/base/Button'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import { Icon } from '../../ui/icons/Icon'

export function OptionDetails({ actions, ariaLabel, children, className = '', label = '查看详情' }: {
  actions?: ReactNode
  ariaLabel?: string
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <CollapsibleRoot className={className}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        {actions}
        <CollapsibleTrigger
          aria-label={ariaLabel || label}
          className="group ml-auto w-auto shrink-0 gap-1.5 max-[760px]:ml-0"
          render={<Button size="sm" variant="secondary" />}
        >
          {label}
          <Icon name="ChevronDown" size={14} aria-hidden="true" className="transition-transform duration-ds-fast group-aria-expanded:rotate-180 motion-reduce:transition-none" />
        </CollapsibleTrigger>
      </div>
      <CollapsiblePanel keepMounted={false} className="mt-3 border-t border-ds-border-subtle pt-3">
        {children}
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}
