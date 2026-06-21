import { useEffect, useReducer } from 'react'
import { DialogOverlay } from '../ui/base/Dialog'
import { cx } from '../ui/base/utils'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { getModalCloseDurationMs } from '../shared/motion'
import {
  dispatchPopupModalAction,
  usePopupModalsView,
  usePopupSmartClassifierView
} from './popup-controller-store'
import {
  dispatchPopupDocumentKeyDown,
  dispatchPopupPageHide,
  dispatchPopupStorageChanged
} from './popup-browser-events-store'
import { usePopupController } from './popup-controller'
import { PopupAutoAnalyzeStatus } from './components/PopupAutoAnalyzeStatus'
import { PopupChromeHost } from './components/PopupChromeHost'
import { PopupContentHost } from './components/PopupContentHost'
import { PopupModalsHost } from './components/PopupModalsHost'
import { PopupSmartClassifierHost } from './components/PopupSmartClassifierHost'
import { PopupToasts } from './components/PopupToasts'

const appShellBaseClass = [
  'group relative flex h-full flex-col overflow-hidden border border-[#1b1d22] bg-[#0f1012] text-[var(--ui-text-primary)]',
  'px-3.5 pb-3.5 pt-0 [font-family:var(--font-sans)] tracking-normal [hanging-punctuation:allow-end] [line-break:strict] [text-autospace:normal] [text-spacing-trim:trim-start]'
].join(' ')
const appShellDefaultClass = 'gap-[14px]'
const appShellSmartClass = 'gap-2'
const contentShellClass =
  'relative z-[1] grid min-h-0 flex-[1_1_auto] overflow-hidden border-0 bg-transparent [height:auto]'
const modalBackdropBaseClass = [
  'absolute inset-0 z-20 grid place-items-center bg-black/[0.78] p-3.5 opacity-100',
  'backdrop-blur-[18px] backdrop-saturate-[1.08]',
  'transition-opacity duration-[var(--modal-close-dur)] ease-[var(--modal-ease)] motion-reduce:transition-none'
].join(' ')

export function PopupApp({ portalContainer }: { portalContainer?: HTMLElement | null }) {
  usePopupController()

  return (
    <ThemeProvider>
      <PopupShell portalContainer={portalContainer} />
    </ThemeProvider>
  )
}

function PopupShell({ portalContainer }: { portalContainer?: HTMLElement | null }) {
  const modalsView = usePopupModalsView()
  const smartClassifierView = usePopupSmartClassifierView()
  const modalOpen = modalsView.open
  const smartActive = ['loading', 'results', 'error', 'permission'].includes(smartClassifierView.status)
  const [modalPresence, dispatchModalPresence] = useReducer(reduceModalPresence, {
    closing: false,
    visible: modalOpen
  })
  useEffect(() => {
    const storage = typeof chrome === 'undefined' ? null : chrome.storage

    document.addEventListener('keydown', dispatchPopupDocumentKeyDown)
    window.addEventListener('pagehide', dispatchPopupPageHide)
    storage?.onChanged?.addListener(dispatchPopupStorageChanged)
    return () => {
      document.removeEventListener('keydown', dispatchPopupDocumentKeyDown)
      window.removeEventListener('pagehide', dispatchPopupPageHide)
      storage?.onChanged?.removeListener(dispatchPopupStorageChanged)
    }
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

  const modalBackdropClassName = cx(
    modalBackdropBaseClass,
    modalPresence.closing ? 'pointer-events-none opacity-0' : ''
  )
  const appShellClassName = cx(
    appShellBaseClass,
    smartActive ? appShellSmartClass : appShellDefaultClass
  )

  return (
    <>
      <main
        id="popup-app-shell"
        className={appShellClassName}
        aria-hidden={modalOpen && !modalPresence.closing ? 'true' : 'false'}
        inert={modalOpen && !modalPresence.closing}
      >
        <PopupChromeHost smartActive={smartActive}>
          <PopupSmartClassifierHost />
        </PopupChromeHost>

        <section className={contentShellClass} hidden={smartActive}>
          <PopupContentHost />
        </section>

        <PopupAutoAnalyzeStatus smartActive={smartActive} />
      </main>

      <DialogOverlay
        id="modal-backdrop"
        className={modalBackdropClassName}
        hidden={!modalPresence.visible}
        open={modalPresence.visible}
        onOpenChange={(open) => {
          if (!open && modalOpen) {
            dispatchPopupModalAction('close')
            return
          }
        }}
        aria-hidden={modalPresence.visible && !modalPresence.closing ? 'false' : 'true'}
        disablePointerDismissal
        portalContainer={portalContainer ?? undefined}
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
