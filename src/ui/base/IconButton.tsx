import type { ComponentPropsWithRef } from 'react'
import { Button } from './Button'
import { Icon, type IconName } from '../icons/Icon'
import { cx } from './utils'

export type IconButtonProps = Omit<ComponentPropsWithRef<typeof Button>, 'children'> & {
  icon: IconName
  label: string
  iconSize?: number
}

export function IconButton({
  icon,
  label,
  iconSize = 16,
  className,
  ref,
  ...props
}: IconButtonProps) {
  return (
    <Button
      ref={ref}
      aria-label={label}
      title={props.title || label}
      className={cx('size-9 px-0', className)}
      {...props}
    >
      <Icon name={icon} size={iconSize} aria-hidden="true" />
    </Button>
  )
}
