import { DialogBackdrop, DialogOverlay, DialogPanel } from '../../ui/base/Dialog'
import { PopupModalsHost } from './PopupModalsHost'

// Chrome can briefly report a popup host taller than its visible 800 × 600
// surface (for example while restoring or reparenting the action popup). Keep
// the modal viewport tied to the visible viewport instead of that host height,
// otherwise tall folder pickers are centered below the clipped window.
const modalPortalClass =
  'absolute inset-x-0 top-0 z-20 grid h-dvh max-h-full min-h-0 w-full place-items-center overflow-hidden pointer-events-none'
const modalBackdropClass = 'absolute inset-0 bg-ds-overlay'
const modalPanelClass =
  'pointer-events-auto h-full max-h-full min-h-0 w-full overflow-hidden bg-transparent outline-none'

export function PopupModalLayer({
  onDismiss,
  open,
  portalContainer
}: {
  onDismiss: () => void
  open: boolean
  portalContainer?: HTMLElement
}) {
  return (
    <DialogOverlay
      id="modal-backdrop"
      className={modalPortalClass}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          onDismiss()
        }
      }}
      aria-hidden={open ? 'false' : 'true'}
      disablePointerDismissal
      portalContainer={portalContainer}
    >
      <DialogBackdrop className={modalBackdropClass} />
      <DialogPanel
        className={modalPanelClass}
        aria-label="书签操作弹窗"
        initialFocus={false}
        finalFocus={false}
      >
        <PopupModalsHost />
      </DialogPanel>
    </DialogOverlay>
  )
}
