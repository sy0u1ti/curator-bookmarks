import type { ComponentPropsWithoutRef } from 'react'
import { Icon } from '../icons/Icon'
import { Button } from './Button'

export type CloseButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, 'children'> & {
  label: string
  iconSize?: number
}

export function CloseButton({ label, iconSize = 18, ...props }: CloseButtonProps) {
  return (
    <Button aria-label={label} title={props.title || label} {...props}>
      <Icon name="X" size={iconSize} aria-hidden="true" />
    </Button>
  )
}
