import { Input as BaseInput } from '@base-ui/react/input'
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react'
import { cx } from './utils'

export type InputProps = Omit<ComponentPropsWithoutRef<typeof BaseInput>, 'className'> & {
  className?: string
  unstyled?: boolean
}

export const Input = forwardRef<ComponentRef<typeof BaseInput>, InputProps>(function Input(
  { className, unstyled = false, ...props },
  ref
) {
  if (unstyled) {
    return <BaseInput ref={ref} className={className} {...props} />
  }

  return (
    <BaseInput
      ref={ref}
      className={cx(
        'h-9 w-full rounded-md border border-curator-border bg-curator-bg-panel px-3 text-sm text-curator-text outline-none transition-colors placeholder:text-curator-text-subtle focus:border-curator-border-strong focus:ring-2 focus:ring-white/10 disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
