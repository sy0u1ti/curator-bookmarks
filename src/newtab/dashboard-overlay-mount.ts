import './newtab-deferred.css'
import { DASHBOARD_OVERLAY_MARKUP } from './dashboard-overlay-template.js'

export interface DashboardOverlayMountResult {
  overlay: HTMLElement | null
  frame: HTMLIFrameElement | null
  fallback: HTMLElement | null
  fallbackCopy: HTMLElement | null
}

export interface DashboardOverlayMountCallbacks {
  onFrameError: () => void
  onFallbackReturn: () => void
  onFallbackRetry: () => void
}

export function mountDashboardOverlay(
  callbacks: DashboardOverlayMountCallbacks
): DashboardOverlayMountResult | null {
  const template = document.createElement('template')
  template.innerHTML = DASHBOARD_OVERLAY_MARKUP.trim()
  document.body.appendChild(template.content.cloneNode(true))

  const overlay = document.getElementById('newtab-dashboard-overlay')
  const frame = document.getElementById('newtab-dashboard-frame') as HTMLIFrameElement | null
  const fallback = document.getElementById('newtab-dashboard-fallback')
  const fallbackCopy = document.getElementById('newtab-dashboard-fallback-copy')

  frame?.addEventListener('error', () => {
    callbacks.onFrameError()
  })

  fallback?.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const actionButton = target.closest<HTMLElement>('[data-dashboard-fallback-action]')
    const action = actionButton?.getAttribute('data-dashboard-fallback-action')
    if (action === 'return') {
      callbacks.onFallbackReturn()
      return
    }
    if (action === 'retry') {
      callbacks.onFallbackRetry()
    }
  })

  return { overlay, frame, fallback, fallbackCopy }
}
