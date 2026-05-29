import { Progress as BaseProgress } from '@base-ui/react/progress'
import { cx } from './utils'

export interface ProgressProps {
  id?: string
  value?: number | null
  max?: number
  label?: string
  className?: string
}

export function Progress({ id, value = null, max = 100, label, className }: ProgressProps) {
  const numericValue = typeof value === 'number' ? Math.max(0, Math.min(max, value)) : null
  const percent = numericValue === null ? 0 : (numericValue / max) * 100

  return (
    <BaseProgress.Root
      value={numericValue}
      max={max}
      aria-label={label}
      className={cx('h-2 overflow-hidden rounded-full bg-curator-muted', className)}
    >
      <BaseProgress.Indicator
        id={id}
        className="h-full rounded-full bg-curator-text transition-transform"
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </BaseProgress.Root>
  )
}
