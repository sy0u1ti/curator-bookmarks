import type { Ref } from 'react'
import { CloseButton } from '../../ui'
import { DrawerClose } from '../../ui'
import { cx } from '../../ui'

export function SettingsDrawerClose({
  buttonRef,
  className
}: {
  buttonRef?: Ref<HTMLButtonElement>
  className?: string
}) {
  return (
    <DrawerClose
      render={
        <CloseButton
          id="newtab-settings-close"
          className={cx('absolute right-3.5 top-3.5 z-[2] size-10 min-h-10 min-w-10 rounded-ds-sm p-0', className)}
          type="button"
          label="关闭设置"
          iconSize={20}
          variant="ghost"
          ref={buttonRef}
        />
      }
    />
  )
}
