import type { HTMLAttributes } from 'react'
import { cx } from './utils'

export type CardProps = HTMLAttributes<HTMLElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <article
      className={cx(
        'rounded-[var(--ui-radius-group)] border border-curator-border bg-curator-bg-panel p-4 text-curator-text',
        className
      )}
      {...props}
    />
  )
}
