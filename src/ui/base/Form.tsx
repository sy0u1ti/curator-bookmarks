import { Form as BaseForm } from '@base-ui/react/form'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export type FormProps = ComponentPropsWithoutRef<typeof BaseForm> & {
  className?: string
}

export function Form({ className, ...props }: FormProps) {
  return <BaseForm className={cx('base-form', className)} {...props} />
}
