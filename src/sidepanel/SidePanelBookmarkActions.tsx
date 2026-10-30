import { useRef, useState } from 'react'
import { Button } from '../ui/base/Button'
import { StatusButton } from '../ui/actions/StatusButton'
import { COPY_ACTION_LABELS } from '../ui/actions/ActionFeedback'
import { IDLE_ACTION_FEEDBACK } from '../shared/action-feedback'
import { Popover } from '../ui/base/Popover'
import { Icon } from '../ui/icons/Icon'
import type { PopupActionMenuViewModel } from '../popup/components/PopupViewModels'

export function SidePanelBookmarkActions({ menu, onMenuAction }: {
  menu: PopupActionMenuViewModel
  onMenuAction?: (bookmarkId: string, action: string, returnFocusElement?: HTMLElement | null) => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <div className="absolute right-3 top-1/2 z-[3] -translate-y-1/2">
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="end"
        side="bottom"
        showArrow={false}
        keepMounted={false}
        title="书签操作"
        popupClassName="w-48 max-w-[calc(100vw-24px)] !gap-1 !p-2"
        trigger={<Button ref={trigger} size="sm" variant="secondary" className="sidepanel-bookmark-menu !h-7 !w-7 !min-w-0 !p-0" aria-label="打开书签操作"><Icon name="MoreHorizontal" size={16} /></Button>}
      >
        <div data-popup-row-menu className="grid gap-1">
          {menu.items.map(item => item.action === 'copy-url' ? (
            <StatusButton
              key={item.action}
              size="sm"
              variant="ghost"
              className="w-full !justify-start"
              aria-label={item.ariaLabel}
              data-bookmark-menu-action={item.action}
              disabled={item.disabled}
              feedback={item.feedback || IDLE_ACTION_FEEDBACK}
              labels={COPY_ACTION_LABELS}
              icon="Copy"
              onClick={(event) => onMenuAction?.(item.bookmarkId, item.action, event.currentTarget)}
            />
          ) : (
            <Button
              key={item.action}
              size="sm"
              variant="ghost"
              className={item.danger ? 'w-full !justify-start text-ds-danger-text' : 'w-full !justify-start'}
              aria-label={item.ariaLabel}
              data-bookmark-menu-action={item.action}
              disabled={item.disabled}
              onClick={() => { setOpen(false); onMenuAction?.(item.bookmarkId, item.action, trigger.current) }}
            >{item.label}</Button>
          ))}
        </div>
      </Popover>
    </div>
  )
}
