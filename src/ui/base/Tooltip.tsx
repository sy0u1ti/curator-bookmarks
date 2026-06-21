import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'

export interface TooltipProps {
  children: ReactElement
  content: ReactNode
  closeDelay?: number
  delay?: number
  popupClassName?: string
  sideOffset?: number
}

export interface TooltipTriggerShellProps extends TooltipProps {}

export function Tooltip({
  children,
  closeDelay = 0,
  content,
  delay = 200,
  popupClassName = 'z-50 rounded-md border border-curator-border bg-curator-bg-elevated px-2 py-1 text-xs text-curator-text shadow-[var(--shadow-popover)]',
  sideOffset = 6
}: TooltipProps) {
  return (
    <TooltipTriggerShell
      closeDelay={closeDelay}
      content={content}
      delay={delay}
      popupClassName={popupClassName}
      sideOffset={sideOffset}
    >
      {children}
    </TooltipTriggerShell>
  )
}

export function TooltipTriggerShell({
  children,
  closeDelay = 0,
  content,
  delay = 200,
  popupClassName = 'z-50 rounded-md border border-curator-border bg-curator-bg-elevated px-2 py-1 text-xs text-curator-text shadow-[var(--shadow-popover)]',
  sideOffset = 6
}: TooltipTriggerShellProps) {
  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          closeDelay={closeDelay}
          delay={delay}
          render={children}
        />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner sideOffset={sideOffset}>
            <BaseTooltip.Popup className={popupClassName}>
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}
