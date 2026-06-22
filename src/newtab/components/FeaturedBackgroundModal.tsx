import { useEffect, useLayoutEffect, useRef } from 'react'
import { Button } from '../../ui/base/Button'
import { CloseButton } from '../../ui/base/CloseButton'
import { DialogClose, DialogOverlay, DialogPanel, DialogTitle } from '../../ui/base/Dialog'
import {
  dispatchNewtabFeaturedBackgroundModalGridScroll,
  dispatchNewtabFeaturedBackgroundModalOpenChange,
  dispatchNewtabFeaturedBackgroundModalReady,
  dispatchNewtabFeaturedBackgroundModalRefreshClick,
  setNewtabFeaturedBackgroundModalNodes,
  useNewtabFeaturedBackgroundModalView
} from '../newtab-featured-background-modal-store'
import {
  getNewtabFeaturedBackgroundPickerNodes,
  useNewtabFeaturedBackgroundPickerFocusRequest,
  useNewtabFeaturedBackgroundPickerView,
  type FeaturedBackgroundPickerView
} from '../newtab-featured-background-picker-store'
import { FeaturedBackgroundHoverPreviewHost } from './FeaturedBackgroundHoverPreview'
import { FeaturedBackgroundPicker } from './FeaturedBackgroundPicker'
import { FEATURED_WALLPAPER_CONTROL_CLASS } from './featuredWallpaperControlClasses'

const featuredWallpaperPanelMotionClass =
  'origin-center scale-[var(--modal-scale)] opacity-0 transition-[transform,scale,opacity] duration-[var(--modal-open-dur)] ease-[var(--modal-ease)] [will-change:transform,scale,opacity] motion-reduce:transition-none'
const featuredWallpaperPanelOpenClass = 'scale-100 opacity-100 pointer-events-auto'
const featuredWallpaperPanelClosedClass = 'pointer-events-none'
const featuredWallpaperPanelClosingClass =
  'scale-[var(--modal-scale-close)] opacity-0 pointer-events-none duration-[var(--modal-close-dur)]'
const featuredWallpaperModalLayoutClass =
  'fixed inset-0 z-[10020] grid place-items-center bg-[rgba(0,0,0,0.72)] p-6 transition-opacity motion-reduce:transition-none'
const featuredWallpaperModalOpenClass =
  'opacity-100 pointer-events-auto duration-[var(--ui-motion-surface)] ease-[var(--ui-ease-standard)]'
const featuredWallpaperModalClosedClass =
  'opacity-0 pointer-events-none duration-[var(--ui-motion-surface)] ease-[var(--ui-ease-standard)] [content-visibility:hidden] [contain-intrinsic-size:100vw_100vh]'
const featuredWallpaperModalClosingClass =
  'opacity-0 pointer-events-none duration-[var(--modal-close-dur)] ease-[var(--modal-ease)]'
const featuredWallpaperPanelLayoutClass =
  'grid w-[min(1320px,calc(100vw_-_48px))] max-h-[min(820px,calc(100vh_-_48px))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden'
const featuredWallpaperPanelSurfaceClass =
  '!border !border-[var(--ui-divider)] !rounded-[var(--ui-radius-panel)] !bg-[var(--ui-bg-main)] !text-[var(--ui-text-primary)] !shadow-[var(--ui-shadow-panel)]'
const featuredWallpaperStatusClass =
  'featured-wallpaper-status border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-secondary)] shadow-none'
const featuredWallpaperActionClass = `featured-wallpaper-action ${FEATURED_WALLPAPER_CONTROL_CLASS}`

export interface FeaturedBackgroundModalProps {
  open: boolean
  closing?: boolean
  refreshing?: boolean
  status?: string
  statusTone?: string
  onOpenChange: (open: boolean, event?: Event) => void
  onGridScroll: () => void
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
  onRefreshClick,
  pickerView
}: FeaturedBackgroundModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLElement | null>(null)
  const focusRequest = useNewtabFeaturedBackgroundPickerFocusRequest()
  const modalClassName = [
    'featured-wallpaper-modal',
    featuredWallpaperModalLayoutClass,
    open ? 'open' : '',
    open && !closing ? featuredWallpaperModalOpenClass : '',
    closing ? 'is-closing' : '',
    closing ? featuredWallpaperModalClosingClass : '',
    !open ? featuredWallpaperModalClosedClass : ''
  ].filter(Boolean).join(' ')
  const panelClassName = [
    'featured-wallpaper-panel',
    featuredWallpaperPanelLayoutClass,
    featuredWallpaperPanelSurfaceClass,
    featuredWallpaperPanelMotionClass,
    open && !closing ? featuredWallpaperPanelOpenClass : '',
    !open ? featuredWallpaperPanelClosedClass : '',
    closing ? featuredWallpaperPanelClosingClass : ''
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (!open ||
      closing ||
      focusRequest.requestId === 0 ||
      hasFocusableFeaturedBackgroundPickerCard(pickerView)) {
      return
    }
    closeButtonRef.current?.focus()
  }, [closing, focusRequest.requestId, open, pickerView])

  useEffect(() => {
    if (!open || !closing) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const trigger = getNewtabFeaturedBackgroundPickerNodes().trigger
      if (trigger?.isConnected) {
        trigger.focus({ preventScroll: true })
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [closing, open])

  useLayoutEffect(() => {
    setNewtabFeaturedBackgroundModalNodes({
      grid: gridRef.current,
      modal: overlayRef.current
    })
    return () => {
      setNewtabFeaturedBackgroundModalNodes({
        grid: null,
        modal: null
      })
    }
  }, [open, closing])

  return (
    <DialogOverlay
      id="background-featured-modal"
      className={modalClassName}
      ref={overlayRef}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="background-featured-picker"
      aria-hidden={open && !closing ? 'false' : 'true'}
      inert={!open || closing}
      onPointerDownCapture={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }
        onOpenChange(false, event.nativeEvent)
      }}
      modal={open && !closing}
      disablePointerDismissal
    >
      <DialogPanel
        className={panelClassName}
        ref={panelRef}
        initialFocus={false}
        finalFocus={() => getNewtabFeaturedBackgroundPickerNodes().trigger}
        unanimated
      >
        <header className="featured-wallpaper-head">
          <div>
            <p className="featured-wallpaper-kicker">Featured Gallery</p>
            <DialogTitle as="h3" id="background-featured-modal-title">选择精选图库壁纸</DialogTitle>
          </div>
          <div className="featured-wallpaper-actions">
            <output
              id="background-featured-status"
              className={featuredWallpaperStatusClass}
              aria-live="polite"
              data-tone={statusTone}
              hidden={!status}
            >
              {status}
            </output>
            <Button
              id="background-featured-refresh"
              className={featuredWallpaperActionClass}
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
                  ref={closeButtonRef}
                  id="background-featured-modal-close"
                  className={`featured-wallpaper-close ${FEATURED_WALLPAPER_CONTROL_CLASS}`}
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
          ref={(element) => {
            gridRef.current = element
          }}
          onScroll={onGridScroll}
        >
          {pickerView ? <FeaturedBackgroundPicker previewRootRef={gridRef} state={pickerView} /> : null}
        </div>
        <FeaturedBackgroundHoverPreviewHost />
      </DialogPanel>
    </DialogOverlay>
  )
}

function hasFocusableFeaturedBackgroundPickerCard(view: FeaturedBackgroundPickerView | null): boolean {
  if (!view || view.type !== 'sections') {
    return false
  }

  return view.sections.some((section) => {
    if (section.type === 'grid') {
      return section.section.cards.length > 0
    }

    return section.groups.some((group) => group.cards.length > 0)
  })
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
      onRefreshClick={dispatchNewtabFeaturedBackgroundModalRefreshClick}
      pickerView={pickerView}
    />
  )
}
