import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export type CollapsibleTriggerProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Trigger>,
  'className'
> & {
  className?: string
}

export const CollapsibleTrigger = forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  function CollapsibleTrigger({ className, ...props }, ref) {
    return (
      <BaseCollapsible.Trigger
        ref={ref}
        className={cx('t-acc-head outline-none focus-visible:shadow-ds-focus', className)}
        {...props}
      />
    )
  }
)
