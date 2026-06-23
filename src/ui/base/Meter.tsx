import { Meter as BaseMeter } from '@base-ui/react/meter'
import { cx } from './utils'

export interface MeterProps {
  className?: string
  indicatorClassName?: string
  label?: string
  max?: number
  min?: number
  trackClassName?: string
  unstyled?: boolean
  value: number
}

export function Meter({
  className,
  indicatorClassName,
  label,
  max = 100,
  min = 0,
  trackClassName,
  unstyled = false,
  value
}: MeterProps) {
  return (
    <BaseMeter.Root
      className={unstyled ? className : cx('base-meter grid gap-1.5', className)}
      max={max}
      min={min}
      value={value}
    >
      {label ? <BaseMeter.Label className="text-xs text-ds-text-secondary">{label}</BaseMeter.Label> : null}
      <BaseMeter.Track
        className={unstyled ? trackClassName : cx(
          'base-meter-track h-2 overflow-hidden rounded-full bg-ds-hover',
          trackClassName
        )}
      >
        <BaseMeter.Indicator
          className={unstyled ? indicatorClassName : cx(
            'base-meter-indicator h-full rounded-full bg-ds-accent transition-transform',
            indicatorClassName
          )}
        />
      </BaseMeter.Track>
    </BaseMeter.Root>
  )
}
