import type { HTMLAttributes } from 'react'
import { cx } from '../base/utils'

export interface NumberPopProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  animate?: boolean
  text: number | string
}

export function NumberPop({ animate = false, className, text, ...props }: NumberPopProps) {
  const value = String(text)
  const { ['aria-label']: ariaLabel, ...spanProps } = props

  return (
    <span
      className={cx('t-number', animate && 't-number--animate', className)}
      aria-label={ariaLabel ?? value}
      {...spanProps}
    >
      <span className="t-number-value" aria-hidden="true" key={value}>{value}</span>
    </span>
  )
}
