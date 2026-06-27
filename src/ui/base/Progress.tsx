import { Progress as BaseProgress } from '@base-ui/react/progress'
import type { CSSProperties, HTMLAttributes } from 'react'
import { cx } from './utils'

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value?: number | null
  max?: number
  label?: string
  className?: string
  indicatorClassName?: string
  indicatorProps?: HTMLAttributes<HTMLDivElement>
  indicatorStyle?: CSSProperties
  rootClassName?: string
  trackClassName?: string
  unstyled?: boolean
}

export function Progress({
  value = null,
  max = 100,
  label,
  className,
  indicatorClassName,
  indicatorProps,
  indicatorStyle,
  rootClassName,
  trackClassName,
  unstyled = false,
  ...props
}: ProgressProps) {
  const numericValue = typeof value === 'number' ? Math.max(0, Math.min(max, value)) : null
  const percent = numericValue === null ? 0 : (numericValue / max) * 100
  const defaultIndicatorStyle = { transform: `translateX(-${100 - percent}%)` }

  return (
    <BaseProgress.Root
      value={numericValue}
      max={max}
      aria-label={label}
      className={unstyled ? rootClassName : cx('base-progress', rootClassName)}
      {...props}
    >
      <BaseProgress.Track className={unstyled ? className : cx(
        'base-progress-track h-2 overflow-hidden rounded-full bg-ds-hover',
        className,
        trackClassName
      )}>
        <BaseProgress.Indicator
          className={unstyled ? indicatorClassName : cx(
            'base-progress-indicator h-full rounded-full bg-ds-accent transition-transform duration-ds-standard ease-ds-standard will-change-transform motion-reduce:transition-none',
            indicatorClassName
          )}
          style={indicatorStyle ?? defaultIndicatorStyle}
          {...indicatorProps}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}
