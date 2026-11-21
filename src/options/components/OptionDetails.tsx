import type { ReactNode } from 'react'
import { Button } from '../../ui/base/Button'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'

export function OptionDetails({
  actions,
  ariaLabel,
  children,
  className = '',
  label = '查看详情',
  panelClassName = 'mt-3 border-t border-ds-border-subtle pt-3',
  triggerVariant = 'secondary'
}: {
  actions?: ReactNode
  ariaLabel?: string
  children: ReactNode
  className?: string
  label?: string
  panelClassName?: string
  triggerVariant?: 'secondary' | 'ghost'
}) {
  return (
    <CollapsibleRoot className={className}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        {actions}
        <CollapsibleTrigger
          aria-label={ariaLabel || label}
          className="ml-auto w-auto shrink-0 max-[760px]:ml-0"
          render={<Button size="sm" variant={triggerVariant} />}
        >
          {label}
        </CollapsibleTrigger>
      </div>
      <CollapsiblePanel keepMounted={false} className="options-details-panel">
        <div className="options-details-panel-inner">
          <div className={panelClassName}>
            {children}
          </div>
        </div>
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}
