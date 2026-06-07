import { Separator as BaseSeparator } from '@base-ui/react/separator'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export interface SeparatorProps extends Omit<ComponentPropsWithoutRef<typeof BaseSeparator>, 'className'> {
  className?: string
  unstyled?: boolean
}

export function Separator({ className, orientation = 'horizontal', unstyled = false, ...props }: SeparatorProps) {
  return (
    <BaseSeparator
      className={unstyled ? className : cx(
        orientation === 'vertical' ? 'h-full w-px bg-curator-border' : 'h-px w-full bg-curator-border',
        className
      )}
      orientation={orientation}
      {...props}
    />
  )
}
