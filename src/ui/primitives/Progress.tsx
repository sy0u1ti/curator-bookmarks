import { Progress as BaseProgress } from '@base-ui/react/progress'
import type { CSSProperties } from 'react'
import { cx } from './utils'

export interface ProgressProps {
  id?: string
  value?: number | null
  max?: number
  label?: string
  className?: string
  indicatorClassName?: string
  indicatorProps?: Record<string, string | number | boolean | null | undefined>
  indicatorStyle?: CSSProperties
  unstyled?: boolean
}

export function Progress({
  id,
  value = null,
  max = 100,
  label,
  className,
  indicatorClassName,
  indicatorProps,
  indicatorStyle,
  unstyled = false
}: ProgressProps) {
  const numericValue = typeof value === 'number' ? Math.max(0, Math.min(max, value)) : null
  const percent = numericValue === null ? 0 : (numericValue / max) * 100
  const style = indicatorStyle ?? { transform: `translateX(-${100 - percent}%)` }

  return (
    <BaseProgress.Root
      value={numericValue}
      max={max}
      aria-label={label}
      className={unstyled ? className : cx('h-2 overflow-hidden rounded-full bg-curator-muted', className)}
    >
      <BaseProgress.Indicator
        {...normalizeIndicatorProps(indicatorProps)}
        id={id}
        className={unstyled ? indicatorClassName : cx('h-full rounded-full bg-curator-text transition-transform', indicatorClassName)}
        style={style}
      />
    </BaseProgress.Root>
  )
}

function normalizeIndicatorProps(
  props: Record<string, string | number | boolean | null | undefined> | undefined
) {
  if (!props) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== null && value !== undefined && value !== false)
  )
}
