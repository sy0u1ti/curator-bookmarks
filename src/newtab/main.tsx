import { prefetchNewtabStartupData } from './newtab-startup-data'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './newtab.css'
import { initSquircleEngine } from '../shared/squircle-engine'
import { NewtabApp } from './NewtabApp'

const root = document.getElementById('newtab-react-root')

if (!root) {
  throw new Error('Missing newtab React root')
}

prefetchNewtabStartupData()
markNewTabStartupBaseline()
initSquircleEngine()
createRoot(root).render(<NewtabApp />)
scheduleNewTabControllerStart()

function markNewTabStartupBaseline(): void {
  try {
    performance.mark('newtab.domContentLoaded')
  } catch {
    // Performance marks are diagnostics only and must never block startup.
  }
}

function scheduleNewTabControllerStart(): void {
  const loadController = () => {
    void import('./newtab-controller')
      .then(({ startNewTabController }) => {
        startNewTabController()
      })
      .catch((error) => {
        console.error('新标签页控制器加载失败。', error)
      })
  }

  if (document.visibilityState === 'hidden') {
    window.setTimeout(loadController, 0)
    return
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(loadController, 0)
  })
}
