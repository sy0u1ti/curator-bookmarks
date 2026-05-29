import './newtab-deferred.css'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '../ui'
import { DashboardOverlay } from './components/DashboardOverlay'

export interface DashboardOverlayMountResult {
  overlay: HTMLElement | null
  frame: HTMLIFrameElement | null
  fallback: HTMLElement | null
  fallbackCopy: HTMLElement | null
  setOpen: (open: boolean) => void
  isOpen: () => boolean
}

export interface DashboardOverlayMountCallbacks {
  onFrameError: () => void
  onCloseRequest: (event: Event) => void
  onFallbackReturn: () => void
  onFallbackRetry: () => void
}

let dashboardOverlayRoot: Root | null = null
let dashboardOverlayOpen = false
let dashboardOverlayCallbacks: DashboardOverlayMountCallbacks | null = null

function renderDashboardOverlay(): void {
  dashboardOverlayRoot?.render(
    <ThemeProvider>
      <DashboardOverlay
        open={dashboardOverlayOpen}
        onOpenChange={(open, event) => {
          if (!open && dashboardOverlayOpen) {
            dashboardOverlayCallbacks?.onCloseRequest(event ?? new Event('dialog-close'))
            return
          }
          dashboardOverlayOpen = open
          renderDashboardOverlay()
        }}
      />
    </ThemeProvider>
  )
}

function setDashboardOverlayOpen(open: boolean): void {
  if (dashboardOverlayOpen === open) return
  dashboardOverlayOpen = open
  flushSync(renderDashboardOverlay)
}

export function mountDashboardOverlay(
  callbacks: DashboardOverlayMountCallbacks
): DashboardOverlayMountResult | null {
  dashboardOverlayCallbacks = callbacks
  if (!dashboardOverlayRoot) {
    const host = document.createElement('div')
    host.id = 'newtab-dashboard-overlay-root'
    document.body.appendChild(host)
    dashboardOverlayRoot = createRoot(host)
    flushSync(renderDashboardOverlay)
  }

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

  return {
    overlay,
    frame,
    fallback,
    fallbackCopy,
    setOpen: setDashboardOverlayOpen,
    isOpen: () => dashboardOverlayOpen
  }
}
