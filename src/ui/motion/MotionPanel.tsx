import type { ComponentPropsWithRef } from 'react'
import { cx } from '../base/utils'

export type MotionPanelVariant = 'dialog' | 'drawer' | 'list' | 'menu' | 'popover'

export type MotionPanelProps = ComponentPropsWithRef<'div'> & {
  variant?: MotionPanelVariant
}

/**
 * Base UI owns the mount lifecycle for shared surfaces. Its starting/ending
 * attributes are intentionally styled in CSS so every open, close, and
 * interrupted reversal starts from the element's current presentation state.
 */
export function MotionPanel({ className, variant = 'dialog', ...props }: MotionPanelProps) {
  return (
    <div
      className={cx('curator-overlay-panel', `curator-overlay-panel--${variant}`, className)}
      {...props}
    />
  )
}
