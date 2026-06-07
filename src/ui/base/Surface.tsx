import type { HTMLAttributes } from 'react'
import { cx } from './utils'

type SurfaceVariant = 'plain' | 'group' | 'panel' | 'row'

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div' | 'section'
  variant?: SurfaceVariant
}

const variantClass: Record<SurfaceVariant, string> = {
  plain: 'bg-transparent text-curator-text',
  group: 'rounded-[var(--ui-radius-group)] border border-curator-border bg-curator-bg-panel text-curator-text shadow-none',
  panel: 'rounded-[var(--ui-radius-panel)] border border-curator-border bg-curator-bg-elevated text-curator-text shadow-[var(--ui-shadow-panel)]',
  row: 'border-curator-border bg-transparent text-curator-text'
}

export function Surface({
  as: Component = 'div',
  className,
  variant = 'group',
  ...props
}: SurfaceProps) {
  return <Component className={cx(variantClass[variant], className)} {...props} />
}

