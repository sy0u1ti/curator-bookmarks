import { Button, CloseButton, DialogClose, DialogOverlay, DialogPanel, DialogTitle } from '../../ui'

export interface FeaturedBackgroundModalProps {
  open: boolean
  closing?: boolean
  onOpenChange: (open: boolean, event?: Event) => void
  onModalPointerDownCapture: (event: PointerEvent) => void
}

export function FeaturedBackgroundModal({
  open,
  closing = false,
  onOpenChange,
  onModalPointerDownCapture
}: FeaturedBackgroundModalProps) {
  const modalClassName = [
    'featured-wallpaper-modal',
    open ? 'open' : '',
    closing ? 'is-closing' : ''
  ].filter(Boolean).join(' ')
  const panelClassName = [
    'featured-wallpaper-panel',
    't-modal',
    open && !closing ? 'is-open' : '',
    closing ? 'is-closing' : ''
  ].filter(Boolean).join(' ')

  return (
    <DialogOverlay
      id="background-featured-modal"
      className={modalClassName}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="background-featured-picker"
      aria-hidden={open && !closing ? 'false' : 'true'}
      inert={!open || closing}
      onPointerDownCapture={(event) => {
        onModalPointerDownCapture(event.nativeEvent)
      }}
      disablePointerDismissal
    >
      <DialogPanel className={panelClassName} initialFocus={false} finalFocus={false} unanimated>
        <header className="featured-wallpaper-head">
          <div>
            <p className="featured-wallpaper-kicker">Featured Gallery</p>
            <DialogTitle as="h3" id="background-featured-modal-title">选择精选图库壁纸</DialogTitle>
          </div>
          <div className="featured-wallpaper-actions">
            <span
              id="background-featured-status"
              className="featured-wallpaper-status"
              role="status"
              aria-live="polite"
              hidden
            />
            <Button id="background-featured-refresh" className="featured-wallpaper-action" type="button" unstyled>
              刷新图库
            </Button>
            <DialogClose
              render={
                <CloseButton
                  id="background-featured-modal-close"
                  className="featured-wallpaper-close"
                  type="button"
                  label="关闭精选图库"
                  variant="ghost"
                />
              }
            />
          </div>
        </header>
        <div
          id="background-featured-modal-grid"
          className="featured-wallpaper-grid"
          aria-label="精选图库壁纸列表"
        />
      </DialogPanel>
    </DialogOverlay>
  )
}
