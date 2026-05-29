import type { TextareaHTMLAttributes } from 'react'
import { cx } from './utils'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cx(
        'min-h-24 w-full resize-y rounded-md border border-curator-border bg-curator-bg-panel px-3 py-2 text-sm text-curator-text outline-none transition-colors placeholder:text-curator-text-subtle focus:border-curator-border-strong focus:ring-2 focus:ring-white/10 disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
