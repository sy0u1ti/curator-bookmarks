import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from './utils'

export type CollapsibleRootProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Root>,
  'className'
> & {
  className?: string
}
export type CollapsibleTriggerProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Trigger>,
  'className'
> & {
  className?: string
}
export type CollapsiblePanelProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Panel>,
  'className'
> & {
  className?: string
}

export function CollapsibleRoot({ className, ...props }: CollapsibleRootProps) {
  return <BaseCollapsible.Root className={cx('t-acc grid gap-2', className)} {...props} />
}

export function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps) {
  return (
    <BaseCollapsible.Trigger
      className={cx('t-acc-head outline-none focus-visible:shadow-ds-focus', className)}
      {...props}
    />
  )
}

export function CollapsiblePanel({
  children,
  className,
  keepMounted = true,
  ...props
}: CollapsiblePanelProps & { children?: ReactNode }) {
  return (
    <BaseCollapsible.Panel keepMounted={keepMounted} className="t-acc-panel" {...props}>
      <div className={cx('t-acc-panel-inner', className)}>
        {children}
      </div>
    </BaseCollapsible.Panel>
  )
}
