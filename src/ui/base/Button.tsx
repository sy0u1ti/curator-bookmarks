import { Button as BaseButton } from '@base-ui/react/button'
import type { ComponentPropsWithRef } from 'react'
import { cx } from './utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = Omit<ComponentPropsWithRef<typeof BaseButton>, 'className'> & {
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
  unstyled?: boolean
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'border-ds-accent bg-ds-accent text-ds-accent-contrast hover:border-ds-accent-hover hover:bg-ds-accent-hover',
  secondary: 'border-ds-border bg-ds-hover text-ds-text-primary hover:border-ds-border-hover hover:bg-ds-surface-1',
  ghost: 'border-transparent bg-transparent text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary',
  danger: 'border-ds-danger/35 bg-transparent text-ds-danger-text hover:border-ds-danger hover:bg-ds-danger-soft'
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3.5 text-sm'
}

export function Button({
  className,
  variant = 'secondary',
  size = 'md',
  unstyled = false,
  nativeButton,
  ref,
  render,
  ...props
}: ButtonProps) {
  const resolvedNativeButton = nativeButton ?? (render ? false : undefined)

  if (unstyled) {
    return <BaseButton ref={ref} className={className} nativeButton={resolvedNativeButton} render={render} {...props} />
  }

  return (
    <BaseButton
      ref={ref}
      nativeButton={resolvedNativeButton}
      render={render}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-ds-sm border font-medium leading-none outline-none transition-colors focus-visible:border-ds-focus focus-visible:shadow-ds-focus disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  )
}
