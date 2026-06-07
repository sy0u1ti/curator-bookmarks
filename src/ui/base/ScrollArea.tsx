import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area'
import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './utils'

type RootProps = ComponentPropsWithoutRef<typeof BaseScrollArea.Root>
type ViewportProps = ComponentPropsWithoutRef<typeof BaseScrollArea.Viewport>

export interface ScrollAreaProps extends Omit<RootProps, 'className'> {
  className?: string
  viewportClassName?: string
  viewportProps?: Omit<ViewportProps, 'className'>
}

export function ScrollArea({
  children,
  className,
  viewportClassName,
  viewportProps,
  ...props
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root className={cx('relative min-h-0 overflow-hidden', className)} {...props}>
      <BaseScrollArea.Viewport
        className={cx('h-full min-h-0 overscroll-contain scrollbar-thin', viewportClassName)}
        {...viewportProps}
      >
        {children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        className="flex w-2.5 justify-center rounded-full bg-transparent p-0.5 opacity-70 transition-opacity hover:opacity-100"
        orientation="vertical"
      >
        <BaseScrollArea.Thumb className="w-1.5 rounded-full bg-white/20" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  )
}

