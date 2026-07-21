import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from './utils'

export type CollapsiblePanelProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Panel>,
  'className'
> & {
  className?: string
}

export function CollapsiblePanel({
  children,
  className,
  keepMounted = true,
  ...props
}: CollapsiblePanelProps & { children?: ReactNode }) {
  return (
    <BaseCollapsible.Panel keepMounted={keepMounted} className="t-acc-panel" {...props}>
      <div className="t-acc-panel-inner">
        <div className={cx('t-acc-panel-content pt-2', className)}>
          {children}
        </div>
      </div>
    </BaseCollapsible.Panel>
  )
}
