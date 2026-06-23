import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export interface ToolbarProps extends Omit<ComponentPropsWithoutRef<typeof BaseToolbar.Root>, 'className'> {
  className?: string
  compact?: boolean
  unstyled?: boolean
}

export function Toolbar({ className, compact = false, unstyled = false, ...props }: ToolbarProps) {
  return (
    <BaseToolbar.Root
      className={unstyled ? className : cx(
        'flex min-w-0 flex-wrap items-center gap-2 border-ds-border text-sm text-ds-text-primary',
        compact ? 'min-h-8' : 'min-h-10',
        className
      )}
      {...props}
    />
  )
}
