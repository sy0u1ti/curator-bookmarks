import { CloseButton, DrawerClose } from '../../ui'

export function SettingsDrawerClose() {
  return (
    <DrawerClose
      render={
        <CloseButton
          id="newtab-settings-close"
          className="settings-close"
          type="button"
          label="关闭设置"
          variant="ghost"
        />
      }
    />
  )
}
