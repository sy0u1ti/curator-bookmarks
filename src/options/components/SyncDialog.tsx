import type { ReactNode } from 'react'
import { DialogBackdrop, DialogOverlay, DialogPanel } from '../../ui/base/Dialog'
import {
  OPTIONS_MODAL_BACKDROP_CLASS,
  OPTIONS_MODAL_PANEL_CLASS,
  OPTIONS_MODAL_WIDE_PANEL_CLASS
} from './options-modal-classes.js'

/** The options page's modal shell for sync: a confirmation, or a form whose body scrolls. */
export function SyncDialog({ open, onClose, labelledBy, describedBy, form = false, children }: {
  open: boolean
  onClose: () => void
  labelledBy: string
  describedBy?: string
  form?: boolean
  children: ReactNode
}) {
  return (
    <DialogOverlay
      className="pointer-events-none fixed inset-0 z-30 grid place-items-center p-5"
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen && open) onClose() }}
      modal
      disablePointerDismissal
    >
      {/* A form holds unsaved input: only its own controls and Escape close it. */}
      <DialogBackdrop className={OPTIONS_MODAL_BACKDROP_CLASS} onClick={form ? undefined : onClose} />
      <DialogPanel
        layout={form ? 'workspace' : 'centered'}
        className={form ? OPTIONS_MODAL_WIDE_PANEL_CLASS : OPTIONS_MODAL_PANEL_CLASS}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </DialogPanel>
    </DialogOverlay>
  )
}
