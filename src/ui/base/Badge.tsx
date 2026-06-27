import type { HTMLAttributes } from 'react'
import { cx } from './utils'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'border-ds-border bg-ds-hover text-ds-text-secondary',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning',
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text'
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex min-h-6 items-center rounded-ds-sm border px-2 py-0.5 text-xs font-medium leading-none transition-[background-color,border-color,color,opacity,transform] duration-ds-fast ease-ds-standard motion-reduce:transition-none',
        toneClass[tone],
        className
      )}
      {...props}
    />
  )
}
