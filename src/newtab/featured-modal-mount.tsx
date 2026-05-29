import './newtab-deferred.css'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '../ui'
import { FeaturedBackgroundModal } from './components/FeaturedBackgroundModal'

export interface FeaturedBackgroundModalMountResult {
  modal: HTMLElement | null
  grid: HTMLElement | null
  close: HTMLElement | null
  refresh: HTMLElement | null
  status: HTMLElement | null
  setOpen: (open: boolean) => void
  isOpen: () => boolean
}

export interface FeaturedBackgroundModalMountCallbacks {
  onRefreshClick: () => void
  onCloseRequest: (event: Event) => void
  onGridScroll: () => void
  onModalPointerDownCapture: (event: PointerEvent) => void
  bindCardDelegation: (grid: HTMLElement | null) => void
}

let featuredBackgroundModalRoot: Root | null = null
let featuredBackgroundModalOpen = false
let featuredBackgroundModalCallbacks: FeaturedBackgroundModalMountCallbacks | null = null

function renderFeaturedBackgroundModal(): void {
  featuredBackgroundModalRoot?.render(
    <ThemeProvider>
      <FeaturedBackgroundModal
        open={featuredBackgroundModalOpen}
        onOpenChange={(open, event) => {
          if (!open && featuredBackgroundModalOpen) {
            featuredBackgroundModalCallbacks?.onCloseRequest(event ?? new Event('dialog-close'))
            return
          }
          featuredBackgroundModalOpen = open
          renderFeaturedBackgroundModal()
        }}
        onModalPointerDownCapture={(event) => {
          featuredBackgroundModalCallbacks?.onModalPointerDownCapture(event)
        }}
      />
    </ThemeProvider>
  )
}

function setFeaturedBackgroundModalOpen(open: boolean): void {
  if (featuredBackgroundModalOpen === open) return
  featuredBackgroundModalOpen = open
  flushSync(renderFeaturedBackgroundModal)
}

export function mountFeaturedBackgroundModal(
  callbacks: FeaturedBackgroundModalMountCallbacks
): FeaturedBackgroundModalMountResult | null {
  featuredBackgroundModalCallbacks = callbacks
  if (!featuredBackgroundModalRoot) {
    const host = document.createElement('div')
    host.id = 'background-featured-modal-root'
    document.body.appendChild(host)
    featuredBackgroundModalRoot = createRoot(host)
    flushSync(renderFeaturedBackgroundModal)
  }

  const modal = document.getElementById('background-featured-modal')
  const grid = document.getElementById('background-featured-modal-grid')
  const close = document.getElementById('background-featured-modal-close')
  const refresh = document.getElementById('background-featured-refresh')
  const status = document.getElementById('background-featured-status')

  refresh?.addEventListener('click', () => {
    callbacks.onRefreshClick()
  })
  grid?.addEventListener('scroll', () => {
    callbacks.onGridScroll()
  })
  callbacks.bindCardDelegation(grid)

  return {
    modal,
    grid,
    close,
    refresh,
    status,
    setOpen: setFeaturedBackgroundModalOpen,
    isOpen: () => featuredBackgroundModalOpen
  }
}
