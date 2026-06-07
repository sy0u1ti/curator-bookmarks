import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from './utils'

export interface FieldsetProps extends Omit<ComponentPropsWithoutRef<typeof BaseFieldset.Root>, 'className'> {
  className?: string
  legend?: ReactNode
  legendClassName?: string
  unstyled?: boolean
}

export function Fieldset({
  children,
  className,
  legend,
  legendClassName,
  unstyled = false,
  ...props
}: FieldsetProps) {
  return (
    <BaseFieldset.Root
      className={unstyled ? className : cx('base-fieldset grid gap-3 border-0 p-0 text-curator-text', className)}
      {...props}
    >
      {legend ? (
        <BaseFieldset.Legend className={unstyled ? legendClassName : cx('text-sm font-semibold', legendClassName)}>
          {legend}
        </BaseFieldset.Legend>
      ) : null}
      {children}
    </BaseFieldset.Root>
  )
}
