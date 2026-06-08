import { useEffect } from 'react'
import { Button } from '../../ui/primitives/Button'
import { CloseButton } from '../../ui/primitives/CloseButton'
import { DialogClose, DialogOverlay, DialogPanel, DialogTitle } from '../../ui/primitives/Dialog'
import {
  dispatchNewtabFeaturedBackgroundModalGridScroll,
  dispatchNewtabFeaturedBackgroundModalOpenChange,
  dispatchNewtabFeaturedBackgroundModalPointerDownCapture,
  dispatchNewtabFeaturedBackgroundModalReady,
  dispatchNewtabFeaturedBackgroundModalRefreshClick,
  useNewtabFeaturedBackgroundModalView
} from '../newtab-featured-background-modal-store'
import {
  useNewtabFeaturedBackgroundPickerView,
  type FeaturedBackgroundPickerView
} from '../newtab-featured-background-picker-store'
import { FeaturedBackgroundHoverPreviewHost } from './FeaturedBackgroundHoverPreview'
import { FeaturedBackgroundPicker } from './FeaturedBackgroundPicker'

export interface FeaturedBackgroundModalProps {
  open: boolean
  closing?: boolean
  refreshing?: boolean
  status?: string
  statusTone?: string
  onOpenChange: (open: boolean, event?: Event) => void
  onGridScroll: () => void
  onModalPointerDownCapture: (event: PointerEvent) => void
  onRefreshClick: () => void
  pickerView: FeaturedBackgroundPickerView | null
}

export function FeaturedBackgroundModal({
  open,
  closing = false,
  refreshing = false,
  status = '',
  statusTone = 'info',
  onGridScroll,
  onOpenChange,
  onModalPointerDownCapture,
  onRefreshClick,
  pickerView
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
            <output
              id="background-featured-status"
              className="featured-wallpaper-status"
              aria-live="polite"
              data-tone={statusTone}
              hidden={!status}
            >
              {status}
            </output>
            <Button
              id="background-featured-refresh"
              className="featured-wallpaper-action"
              type="button"
              disabled={refreshing}
              focusableWhenDisabled
              onClick={onRefreshClick}
              unstyled
            >
              {refreshing ? '刷新中...' : '刷新图库'}
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
          onScroll={onGridScroll}
        >
          {pickerView ? <FeaturedBackgroundPicker state={pickerView} /> : null}
        </div>
        <FeaturedBackgroundHoverPreviewHost />
      </DialogPanel>
    </DialogOverlay>
  )
}

export function FeaturedBackgroundModalHost() {
  const view = useNewtabFeaturedBackgroundModalView()
  const pickerView = useNewtabFeaturedBackgroundPickerView()

  useEffect(() => {
    dispatchNewtabFeaturedBackgroundModalReady()
  }, [])

  return (
    <FeaturedBackgroundModal
      open={view.open}
      closing={view.closing}
      refreshing={view.refreshing}
      status={view.status}
      statusTone={view.statusTone}
      onGridScroll={dispatchNewtabFeaturedBackgroundModalGridScroll}
      onOpenChange={dispatchNewtabFeaturedBackgroundModalOpenChange}
      onModalPointerDownCapture={dispatchNewtabFeaturedBackgroundModalPointerDownCapture}
      onRefreshClick={dispatchNewtabFeaturedBackgroundModalRefreshClick}
      pickerView={pickerView}
    />
  )
}
