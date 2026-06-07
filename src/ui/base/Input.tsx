import { Input as BaseInput } from '@base-ui/react/input'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export type InputProps = Omit<ComponentPropsWithoutRef<typeof BaseInput>, 'className'> & {
  className?: string
  unstyled?: boolean
}

export function Input({ className, unstyled = false, ...props }: InputProps) {
  if (unstyled) {
    return <BaseInput className={cx('base-input', className)} {...props} />
  }

  return (
    <BaseInput
      className={cx(
        'base-input h-9 w-full rounded-[var(--ui-radius-control)] border border-curator-border bg-curator-bg-panel px-3 text-sm text-curator-text outline-none transition-colors placeholder:text-curator-text-subtle focus:border-[var(--ui-focus-ring)] focus:ring-2 focus:ring-white/12 disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
