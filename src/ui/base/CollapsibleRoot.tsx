import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export type CollapsibleRootProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Root>,
  'className'
> & {
  className?: string
}

export function CollapsibleRoot({ className, ...props }: CollapsibleRootProps) {
  return <BaseCollapsible.Root className={cx('t-acc grid gap-2', className)} {...props} />
}
