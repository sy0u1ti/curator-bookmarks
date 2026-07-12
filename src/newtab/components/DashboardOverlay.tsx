import { useCallback, useEffect, useRef } from 'react'
import { Button } from '../../ui/Button'
import { DialogOverlay, DialogPanel } from '../../ui/Dialog'
import {
  dispatchNewtabDashboardOverlayFallbackRetry,
  dispatchNewtabDashboardOverlayFallbackReturn,
  dispatchNewtabDashboardOverlayFrameError,
  dispatchNewtabDashboardOverlayOpenChange,
  dispatchNewtabDashboardOverlayReady,
  getNewtabDashboardOverlayNodes,
  setNewtabDashboardOverlayNodes,
  useNewtabDashboardOverlayView
} from '../newtab-dashboard-overlay-store'
import { getNewtabButtonClass } from './newtabButtonClass'

export interface DashboardOverlayProps {
  errorMessage: string
  frameSrc: string
  open: boolean
  ready: boolean
  onFallbackRetry: () => void
  onFallbackReturn: () => void
  onFrameError: () => void
  onOpenChange: (open: boolean, event?: Event) => void
}

const DEFAULT_DASHBOARD_ERROR_MESSAGE = '加载耗时过长。你可以返回新标签页，或重试打开仪表盘。'
const DASHBOARD_FRAME_SANDBOX = 'allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts'
const DASHBOARD_OVERLAY_CLASS = 'newtab-dashboard-overlay fixed inset-0 z-[10010] overflow-hidden pointer-events-none'
const DASHBOARD_PANEL_CLASS = 'newtab-dashboard-surface pointer-events-auto fixed inset-0 grid h-dvh w-screen overflow-hidden border-0 bg-ds-app text-ds-text-primary shadow-none'
const DASHBOARD_FALLBACK_CLASS = 'newtab-dashboard-fallback fixed inset-0 z-[3] grid place-items-center bg-ds-app p-6 text-ds-text-primary'
const DASHBOARD_FRAME_CLASS = 'newtab-dashboard-frame h-full w-full rounded-none border-0 bg-ds-app shadow-none'
const DASHBOARD_FRAME_VISIBLE_CLASS = 'opacity-100'
const DASHBOARD_FRAME_LOADING_CLASS = 'opacity-0'
const DASHBOARD_CARD_CLASS = 'rounded-ds-sm border border-ds-border bg-ds-surface-1 shadow-none'

function DashboardOverlay({
  errorMessage,
  frameSrc,
  open,
  ready,
  onFallbackRetry,
  onFallbackReturn,
  onFrameError,
  onOpenChange
}: DashboardOverlayProps) {
  const hasError = Boolean(errorMessage)
  const frameVisible = Boolean(frameSrc) && !hasError
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const setOverlayRef = useCallback((element: HTMLDivElement | null) => {
    overlayRef.current = element
    setNewtabDashboardOverlayNodes({
      overlay: element
    })
  }, [])

  const setFrameRef = useCallback((element: HTMLIFrameElement | null) => {
    frameRef.current = element
    setNewtabDashboardOverlayNodes({
      frame: element
    })
  }, [])

  return (
    <DialogOverlay
      id="newtab-dashboard-overlay"
      className={DASHBOARD_OVERLAY_CLASS}
      ref={setOverlayRef}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="newtab-dashboard-trigger"
      data-dashboard-ready={ready && !hasError ? 'true' : 'false'}
      data-dashboard-error={hasError ? 'true' : 'false'}
      tabIndex={-1}
      disablePointerDismissal
      modal
    >
      <DialogPanel
        className={DASHBOARD_PANEL_CLASS}
        aria-label="书签仪表盘"
        initialFocus={false}
        finalFocus={() => getNewtabDashboardOverlayNodes().trigger || false}
        motionVariant="list"
      >
        <div
          id="newtab-dashboard-fallback"
          className={DASHBOARD_FALLBACK_CLASS}
          role="alert"
          aria-live="assertive"
          hidden={!hasError}
        >
          <div className={`newtab-dashboard-fallback-card ${DASHBOARD_CARD_CLASS}`}>
            <p className="newtab-dashboard-fallback-kicker">书签仪表盘</p>
            <h2>书签仪表盘暂时无法打开</h2>
            <p id="newtab-dashboard-fallback-copy">
              {errorMessage || DEFAULT_DASHBOARD_ERROR_MESSAGE}
            </p>
            <div className="newtab-dashboard-fallback-actions">
              <Button
                className={getNewtabButtonClass('secondary')}
                type="button"
                data-dashboard-fallback-action="return"
                onClick={onFallbackReturn}
                unstyled
              >
                返回新标签页
              </Button>
              <Button
                className={getNewtabButtonClass()}
                type="button"
                data-dashboard-fallback-action="retry"
                onClick={onFallbackRetry}
                unstyled
              >
                重试打开仪表盘
              </Button>
            </div>
          </div>
        </div>
        <iframe
          id="newtab-dashboard-frame"
          className={`${DASHBOARD_FRAME_CLASS} ${frameVisible ? DASHBOARD_FRAME_VISIBLE_CLASS : DASHBOARD_FRAME_LOADING_CLASS}`}
          ref={setFrameRef}
          title="书签仪表盘"
          loading="lazy"
          onError={onFrameError}
          sandbox={DASHBOARD_FRAME_SANDBOX}
          src={frameSrc || undefined}
        />
      </DialogPanel>
    </DialogOverlay>
  )
}

export function DashboardOverlayHost() {
  const view = useNewtabDashboardOverlayView()

  useEffect(() => {
    dispatchNewtabDashboardOverlayReady()
  }, [])

  return (
    <DashboardOverlay
      errorMessage={view.errorMessage}
      frameSrc={view.frameSrc}
      open={view.open}
      ready={view.ready}
      onFallbackRetry={dispatchNewtabDashboardOverlayFallbackRetry}
      onFallbackReturn={dispatchNewtabDashboardOverlayFallbackReturn}
      onFrameError={dispatchNewtabDashboardOverlayFrameError}
      onOpenChange={dispatchNewtabDashboardOverlayOpenChange}
    />
  )
}
