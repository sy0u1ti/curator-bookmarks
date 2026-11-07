import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { createContext, useState, type ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

export type CollapsibleRootProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCollapsible.Root>,
  'className'
> & {
  className?: string
}

export const CollapsibleMotionContext = createContext(true)

export function CollapsibleRoot({ className, open, defaultOpen, onOpenChange, ...props }: CollapsibleRootProps) {
  const [initialOpen] = useState(open ?? defaultOpen ?? false)
  const [changed, setChanged] = useState(false)
  // Controlled changes need the same gate as an uncontrolled trigger. A render
  // adjustment prevents the new DOM from painting with the initial-state policy.
  if (!changed && open !== undefined && open !== initialOpen) setChanged(true)
  return (
    <CollapsibleMotionContext value={changed}>
      <BaseCollapsible.Root
        className={cx('t-acc grid', className)}
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={(next, details) => {
          setChanged(true)
          onOpenChange?.(next, details)
        }}
        {...props}
      />
    </CollapsibleMotionContext>
  )
}
