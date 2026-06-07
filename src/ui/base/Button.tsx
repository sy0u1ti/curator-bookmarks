import { Button as BaseButton } from '@base-ui/react/button'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = Omit<ComponentPropsWithoutRef<typeof BaseButton>, 'className'> & {
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
  unstyled?: boolean
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'border-curator-border-strong bg-curator-text text-curator-bg hover:bg-white',
  secondary: 'border-curator-border bg-curator-muted text-curator-text hover:border-curator-border-strong hover:bg-curator-panel',
  ghost: 'border-transparent bg-transparent text-curator-text-muted hover:bg-curator-muted hover:text-curator-text',
  danger: 'border-red-400/25 bg-transparent text-red-200 hover:border-red-300/35 hover:bg-red-500/10'
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
  render,
  ...props
}: ButtonProps) {
  const resolvedNativeButton = nativeButton ?? (render ? false : undefined)

  if (unstyled) {
    return <BaseButton className={className} nativeButton={resolvedNativeButton} render={render} {...props} />
  }

  return (
    <BaseButton
      nativeButton={resolvedNativeButton}
      render={render}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border font-medium leading-none outline-none transition-colors focus-visible:border-[var(--ui-focus-ring)] focus-visible:ring-2 focus-visible:ring-white/18 disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  )
}
