import type { Ref, TextareaHTMLAttributes } from 'react'
import { cx } from './utils'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cx(
        'base-textarea min-h-24 w-full resize-y rounded-[var(--ui-radius-control)] border border-curator-border bg-curator-bg-panel px-3 py-2 text-sm text-curator-text outline-none transition-colors placeholder:text-curator-text-subtle focus:border-[var(--ui-focus-ring)] focus:ring-2 focus:ring-white/12 disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
