import type { HTMLAttributes } from 'react'
import { cx } from './utils'

type SurfaceVariant = 'plain' | 'group' | 'panel' | 'row'

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div' | 'section'
  variant?: SurfaceVariant
}

const variantClass: Record<SurfaceVariant, string> = {
  plain: 'bg-transparent text-ds-text-primary',
  group: 'rounded-ds-md border border-ds-border bg-ds-surface-1 text-ds-text-primary shadow-none',
  panel: 'rounded-ds-lg border border-ds-border bg-ds-surface-2 text-ds-text-primary shadow-ds-dialog',
  row: 'border-ds-border bg-transparent text-ds-text-primary'
}

export function Surface({
  as: Component = 'div',
  className,
  variant = 'group',
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={cx(
        variantClass[variant],
        'transition-[background-color,border-color,box-shadow,transform,opacity] duration-ds-fast ease-ds-standard motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  )
}
