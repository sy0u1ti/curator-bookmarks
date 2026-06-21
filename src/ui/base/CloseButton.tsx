import type { ComponentPropsWithRef } from 'react'
import { Icon } from '../icons/Icon'
import { Button } from './Button'

export type CloseButtonProps = Omit<ComponentPropsWithRef<typeof Button>, 'children'> & {
  label: string
  iconSize?: number
}

export function CloseButton({ label, iconSize = 18, ref, ...props }: CloseButtonProps) {
  return (
    <Button ref={ref} aria-label={label} title={props.title || label} {...props}>
      <Icon name="X" size={iconSize} aria-hidden="true" />
    </Button>
  )
}
