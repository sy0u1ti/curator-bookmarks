import { Field as BaseField } from '@base-ui/react/field'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from './utils'

export interface FieldProps extends ComponentPropsWithoutRef<typeof BaseField.Root> {
  className?: string
  description?: ReactNode
  error?: ReactNode
  label?: ReactNode
  labelClassName?: string
  descriptionClassName?: string
  children: ReactNode
}

export function Field({
  className,
  description,
  descriptionClassName,
  error,
  label,
  labelClassName,
  children,
  ...props
}: FieldProps) {
  return (
    <BaseField.Root className={cx('grid gap-1.5 text-sm text-ds-text-primary', className)} {...props}>
      {label ? (
        <BaseField.Label className={cx('font-medium text-ds-text-primary', labelClassName)}>
          {label}
        </BaseField.Label>
      ) : null}
      {children}
      {description ? (
        <BaseField.Description className={cx('text-xs leading-5 text-ds-text-secondary', descriptionClassName)}>
          {description}
        </BaseField.Description>
      ) : null}
      {error ? (
        <BaseField.Error className="text-xs leading-5 text-ds-danger-text">
          {error}
        </BaseField.Error>
      ) : null}
    </BaseField.Root>
  )
}

