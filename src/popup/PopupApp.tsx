import { useEffect, useMemo, useReducer } from 'react'
import { DialogOverlay } from '../ui/primitives/Dialog'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { getModalCloseDurationMs } from '../shared/motion'
import { dispatchPopupModalAction, usePopupModalsView } from './popup-controller-store'
import { usePopupController } from './popup-controller'
import { PopupAutoAnalyzeStatus } from './components/PopupAutoAnalyzeStatus'
import { PopupChromeHost } from './components/PopupChromeHost'
import { PopupContentHost } from './components/PopupContentHost'
import { PopupModalsHost } from './components/PopupModalsHost'
import { PopupSmartClassifierHost } from './components/PopupSmartClassifierHost'
import { PopupToasts } from './components/PopupToasts'

export function PopupApp() {
  usePopupController()

  return (
    <ThemeProvider>
      <PopupShell />
    </ThemeProvider>
  )
}

function PopupShell() {
  const modalsView = usePopupModalsView()
  const modalOpen = modalsView.open
  const [modalPresence, dispatchModalPresence] = useReducer(reduceModalPresence, {
    closing: false,
    visible: modalOpen
  })
  const modalPortalContainer = useMemo(() => {
    return typeof document === 'undefined' ? null : document.getElementById('popup-root')
  }, [])

  useEffect(() => {
    let modalCloseTimer = 0
    if (modalOpen) {
      dispatchModalPresence({ type: 'open' })
      return () => window.clearTimeout(modalCloseTimer)
    }

    if (!modalPresence.visible) {
      dispatchModalPresence({ type: 'hidden' })
      return () => window.clearTimeout(modalCloseTimer)
    }

    dispatchModalPresence({ type: 'closing' })
    modalCloseTimer = window.setTimeout(() => {
      dispatchModalPresence({ type: 'hidden' })
    }, getModalCloseDurationMs())

    return () => {
      window.clearTimeout(modalCloseTimer)
    }
  }, [modalOpen, modalPresence.visible])

  const modalBackdropClassName = [
    'modal-backdrop',
    modalPresence.visible ? '' : 'hidden',
    modalPresence.closing ? 'is-closing' : ''
  ].filter(Boolean).join(' ')

  return (
    <>
      <main
        id="popup-app-shell"
        className="app-shell"
        aria-hidden={modalOpen && !modalPresence.closing ? 'true' : 'false'}
        inert={modalOpen && !modalPresence.closing}
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
        open={modalPresence.visible}
        onOpenChange={(open) => {
          if (!open && modalOpen) {
            dispatchPopupModalAction('close')
            return
          }
        }}
        aria-hidden={modalPresence.visible && !modalPresence.closing ? 'false' : 'true'}
        disablePointerDismissal
        portalContainer={modalPortalContainer ?? undefined}
      >
        <PopupModalsHost />
      </DialogOverlay>

      <PopupToasts />
    </>
  )
}

interface ModalPresenceState {
  closing: boolean
  visible: boolean
}

type ModalPresenceAction =
  | { type: 'closing' }
  | { type: 'hidden' }
  | { type: 'open' }

function reduceModalPresence(state: ModalPresenceState, action: ModalPresenceAction): ModalPresenceState {
  if (action.type === 'open') {
    return { closing: false, visible: true }
  }
  if (action.type === 'closing') {
    return state.visible ? { closing: true, visible: true } : { closing: false, visible: false }
  }
  return { closing: false, visible: false }
}
