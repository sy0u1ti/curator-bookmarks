import type { HTMLAttributes } from 'react'
import { cx } from '../base/utils'

export interface TextSwapProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  animate?: boolean
  text: string
}

export function TextSwap({ animate = false, className, text, ...props }: TextSwapProps) {
  return (
    <span className={cx('t-text-swap', animate && 't-text-swap--animate', className)} {...props}>
      <span className="t-text-swap-value" key={text}>{text}</span>
    </span>
  )
}
