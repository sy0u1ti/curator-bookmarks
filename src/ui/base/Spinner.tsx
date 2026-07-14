import type { HTMLAttributes } from 'react'
import { Icon } from '../icons/Icon'
import { cx } from './utils'

export type SpinnerProps = HTMLAttributes<HTMLSpanElement>

export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <span className={cx('inline-flex animate-spin text-ds-text-secondary motion-reduce:animate-none motion-reduce:opacity-70', className)} {...props}>
      <Icon name="LoaderCircle" size={16} aria-hidden="true" />
    </span>
  )
}
