import './newtab-deferred.css'
import { FEATURED_BACKGROUND_MODAL_MARKUP } from './featured-modal-template.js'

export interface FeaturedBackgroundModalMountResult {
  modal: HTMLElement | null
  grid: HTMLElement | null
  close: HTMLElement | null
  refresh: HTMLElement | null
  status: HTMLElement | null
}

export interface FeaturedBackgroundModalMountCallbacks {
  onRefreshClick: () => void
  onCloseRequest: (event: Event) => void
  onGridScroll: () => void
  onModalPointerDownCapture: (event: PointerEvent) => void
  bindCardDelegation: (grid: HTMLElement | null) => void
}

export function mountFeaturedBackgroundModal(
  callbacks: FeaturedBackgroundModalMountCallbacks
): FeaturedBackgroundModalMountResult | null {
  const template = document.createElement('template')
  template.innerHTML = FEATURED_BACKGROUND_MODAL_MARKUP.trim()
  document.body.appendChild(template.content.cloneNode(true))

  const modal = document.getElementById('background-featured-modal')
  const grid = document.getElementById('background-featured-modal-grid')
  const close = document.getElementById('background-featured-modal-close')
  const refresh = document.getElementById('background-featured-refresh')
  const status = document.getElementById('background-featured-status')

  refresh?.addEventListener('click', () => {
    callbacks.onRefreshClick()
  })
  close?.addEventListener('click', callbacks.onCloseRequest)
  grid?.addEventListener('scroll', () => {
    callbacks.onGridScroll()
  })
  callbacks.bindCardDelegation(grid)
  modal?.addEventListener('pointerdown', callbacks.onModalPointerDownCapture, true)

  return { modal, grid, close, refresh, status }
}
