import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cx } from './utils'

export type CollapsiblePanelProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Panel>,
  'className'
> & {
  className?: string
}

export const CollapsiblePanel = forwardRef<HTMLDivElement, CollapsiblePanelProps & { children?: ReactNode }>(
  function CollapsiblePanel({ children, className, keepMounted = true, ...props }, ref) {
    return (
      <BaseCollapsible.Panel ref={ref} keepMounted={keepMounted} className="t-acc-panel" {...props}>
        <div className="t-acc-panel-inner">
          <div className={cx('t-acc-panel-content pt-2', className)}>
            {children}
          </div>
        </div>
      </BaseCollapsible.Panel>
    )
  }
)
