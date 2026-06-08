import { Icon } from '../ui/icons/Icon'
import { Button } from '../ui/primitives/Button'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { useNewtabController } from './newtab-controller'
import { DashboardOverlayHost } from './components/DashboardOverlay'
import { BookmarkMenusHost } from './components/BookmarkMenusHost'
import { FeaturedBackgroundModalHost } from './components/FeaturedBackgroundModal'
import { NewtabContentHost } from './components/NewtabContentHost'
import { NewtabDeleteToastHost } from './components/NewtabDeleteToastHost'
import { SettingsDrawerHost } from './components/SettingsDrawer'
import {
  dispatchNewtabSettingsDrawerToggleRequest,
  useNewtabSettingsDrawerView
} from './newtab-settings-drawer-store'

export function NewtabApp() {
  useNewtabController()

  return (
    <ThemeProvider>
      <NewtabShell />
    </ThemeProvider>
  )
}

function NewtabShell() {
  const settingsDrawer = useNewtabSettingsDrawerView()

  return (
    <>
      <div id="newtab-background-mask" className="newtab-background-mask" aria-hidden="true"></div>
      <output className="wallpaper-loading-indicator" aria-live="polite" aria-label="正在加载背景图">
        <div className="wallpaper-loading-card">
          <div className="wallpaper-loading-loader" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </output>

      <div className="settings-trigger-zone">
        <a
          id="newtab-dashboard-trigger"
          className="settings-trigger dashboard-trigger"
          href="#dashboard"
          aria-label="打开书签仪表盘"
          aria-controls="newtab-dashboard-overlay"
        >
          <Icon name="Bookmark" size={18} aria-hidden="true" />
          <span>打开书签仪表盘</span>
        </a>
        <span className="dashboard-shortcut-hint" aria-hidden="true">Ctrl/Cmd+K 快捷打开书签仪表盘</span>
        <Button
          id="newtab-settings-trigger"
          className="settings-trigger"
          type="button"
          aria-label="打开设置"
          aria-controls="newtab-settings-drawer"
          aria-expanded={settingsDrawer.open ? 'true' : 'false'}
          onClick={dispatchNewtabSettingsDrawerToggleRequest}
          unstyled
        >
          <Icon name="Settings" size={18} aria-hidden="true" />
        </Button>
      </div>

      <div id="newtab-settings-backdrop" className="settings-backdrop" data-close-settings></div>
      <div id="newtab-root" className="newtab-shell">
        <NewtabContentHost />
      </div>
      <DashboardOverlayHost />
      <SettingsDrawerHost />
      <FeaturedBackgroundModalHost />
      <NewtabDeleteToastHost />
      <BookmarkMenusHost />
    </>
  )
}
