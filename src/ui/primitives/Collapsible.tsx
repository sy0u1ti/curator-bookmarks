import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import type { ComponentPropsWithoutRef } from 'react'
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
  return <BaseCollapsible.Root className={cx('grid gap-2', className)} {...props} />
}

export function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps) {
  return (
    <BaseCollapsible.Trigger
      className={cx('outline-none focus-visible:ring-2 focus-visible:ring-white/20', className)}
      {...props}
    />
  )
}

export function CollapsiblePanel({ className, keepMounted = true, ...props }: CollapsiblePanelProps) {
  return <BaseCollapsible.Panel keepMounted={keepMounted} className={className} {...props} />
}
