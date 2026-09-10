import { prefetchNewtabStartupData } from './newtab-startup-data'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './newtab.css'
import './hyalite-glass.css'
import { initializeNewtabGlassSettings } from './newtab-glass-settings-store'
import { initSquircleEngine } from '../shared/squircle-engine'
import { NewtabApp } from './NewtabApp'
import { startNewTabController } from './newtab-controller'
import { dispatchNewtabSettingsDrawerToggleRequest } from './newtab-settings-drawer-store'

const root = document.getElementById('newtab-react-root')

if (!root) {
  throw new Error('Missing newtab React root')
}

prefetchNewtabStartupData()
initializeNewtabGlassSettings()
markNewTabStartupBaseline()
initSquircleEngine()
createRoot(root).render(<NewtabApp onOpenSettings={openSettings} />)
scheduleNewTabControllerStart()

function openSettings(): void {
  startNewTabController()
  dispatchNewtabSettingsDrawerToggleRequest()
}

function markNewTabStartupBaseline(): void {
  try {
    performance.mark('newtab.domContentLoaded')
  } catch {
    // Performance marks are diagnostics only and must never block startup.
  }
}

function scheduleNewTabControllerStart(): void {
  // Search and bookmark actions need this controller on every open. Loading
  // it with the entry removes a second module-graph waterfall; the classic
  // wallpaper/bookmark preboot still runs independently of React.
  window.setTimeout(() => {
    startNewTabController()
    void import('./newtab-glass-runtime').then(({ startNewtabGlassRuntime }) => startNewtabGlassRuntime())
      .catch(error => console.warn('液态玻璃使用兼容材质。', error))
  }, 0)
}
