import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export type CollapsibleTriggerProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Trigger>,
  'className'
> & {
  className?: string
}

export function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps) {
  return (
    <BaseCollapsible.Trigger
      className={cx('t-acc-head outline-none focus-visible:shadow-ds-focus', className)}
      {...props}
    />
  )
}
