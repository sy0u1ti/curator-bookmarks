import type { HTMLAttributes } from 'react'
import { cx } from './utils'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'border-curator-border bg-curator-muted text-curator-text-muted',
  success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  danger: 'border-red-400/25 bg-red-500/10 text-red-200'
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex min-h-6 items-center rounded-[var(--ui-radius-control)] border px-2 py-0.5 text-xs font-medium leading-none',
        toneClass[tone],
        className
      )}
      {...props}
    />
  )
}
