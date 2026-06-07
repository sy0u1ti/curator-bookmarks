import { useEffect, useState } from 'react'
import { DialogOverlay, ThemeProvider } from '../ui'
import { getModalCloseDurationMs } from '../shared/motion'
import { PopupAutoAnalyzeStatus } from './components/PopupAutoAnalyzeStatus'
import { PopupChromeHost } from './components/PopupChromeHost'
import { PopupContentHost } from './components/PopupContentHost'
import { PopupModalsHost } from './components/PopupModalsHost'
import { PopupSmartClassifierHost } from './components/PopupSmartClassifierHost'
import { PopupToasts } from './components/PopupToasts'

export function PopupApp() {
  useEffect(() => {
    let disposed = false
    let cleanupRuntime: (() => void) | null = null

    void import('./popup-runtime.js').then(({ startPopupRuntime }) => {
      if (!disposed) {
        cleanupRuntime = startPopupRuntime()
      }
    })

    return () => {
      disposed = true
      cleanupRuntime?.()
      cleanupRuntime = null
    }
  }, [])

  return (
    <ThemeProvider>
      <PopupShell />
    </ThemeProvider>
  )
}

function PopupShell() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalClosing, setModalClosing] = useState(false)
  const [modalPortalContainer, setModalPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let modalCloseTimer = 0
    const handleModalState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      const nextOpen = Boolean(detail?.open)
      window.clearTimeout(modalCloseTimer)
      if (nextOpen) {
        setModalClosing(false)
        setModalOpen(true)
        return
      }
      setModalClosing(true)
      modalCloseTimer = window.setTimeout(() => {
        setModalClosing(false)
        setModalOpen(false)
      }, getModalCloseDurationMs())
    }

    setModalPortalContainer(document.getElementById('popup-root'))
    window.addEventListener('popup:modal-state', handleModalState)

    return () => {
      window.removeEventListener('popup:modal-state', handleModalState)
      window.clearTimeout(modalCloseTimer)
    }
  }, [])

  const modalBackdropClassName = [
    'modal-backdrop',
    modalOpen ? '' : 'hidden',
    modalClosing ? 'is-closing' : ''
  ].filter(Boolean).join(' ')

  return (
    <>
      <main
        id="popup-app-shell"
        className="app-shell"
        aria-hidden={modalOpen && !modalClosing ? 'true' : 'false'}
        inert={modalOpen && !modalClosing}
      >
        <PopupChromeHost>
          <PopupSmartClassifierHost />
        </PopupChromeHost>

        <section className="content-shell">
          <PopupContentHost />
        </section>

        <PopupAutoAnalyzeStatus />
      </main>

      <DialogOverlay
        id="modal-backdrop"
        className={modalBackdropClassName}
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && modalOpen) {
            window.dispatchEvent(new CustomEvent('popup:modal-close'))
            return
          }
          setModalOpen(open)
        }}
        aria-hidden={modalOpen && !modalClosing ? 'false' : 'true'}
        disablePointerDismissal
        portalContainer={modalPortalContainer ?? undefined}
      >
        <PopupModalsHost />
      </DialogOverlay>

      <PopupToasts />
    </>
  )
}
