import { useEffect } from 'react'
import { Button, Icon, ThemeProvider } from '../ui'

export function NewtabApp() {
  useEffect(() => {
    let disposed = false

    void import('./newtab-runtime.js').then(({ startNewTabRuntime }) => {
      if (!disposed) {
        startNewTabRuntime()
      }
    })

    return () => {
      disposed = true
    }
  }, [])

  return (
    <ThemeProvider>
      <NewtabShell />
    </ThemeProvider>
  )
}

function NewtabShell() {
  return (
    <>
      <div id="newtab-background-mask" className="newtab-background-mask" aria-hidden="true"></div>
      <div className="wallpaper-loading-indicator" role="status" aria-live="polite" aria-label="正在加载背景图">
        <div className="wallpaper-loading-card">
          <div className="wallpaper-loading-loader" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

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
          aria-expanded="false"
          unstyled
        >
          <Icon name="Settings" size={18} aria-hidden="true" />
        </Button>
      </div>

      <div id="newtab-settings-backdrop" className="settings-backdrop" data-close-settings></div>
      <div id="newtab-root" className="newtab-shell"></div>
    </>
  )
}
