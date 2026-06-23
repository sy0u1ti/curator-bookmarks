import { useCallback, useEffect, useRef } from 'react'
import { Button, DialogOverlay, DialogPanel, RoseCurveLoader } from '../../ui'
import {
  dispatchNewtabDashboardOverlayFallbackRetry,
  dispatchNewtabDashboardOverlayFallbackReturn,
  dispatchNewtabDashboardOverlayFrameError,
  dispatchNewtabDashboardOverlayOpenChange,
  dispatchNewtabDashboardOverlayReady,
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
// The iframe embeds this extension's own dashboard page, which needs scripts and same-origin access for Chrome APIs.
const DASHBOARD_FRAME_SANDBOX = 'allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts'
const DASHBOARD_SURFACE_CLASS = 'border border-ds-border rounded-ds-lg bg-ds-app text-ds-text-primary shadow-ds-dialog'
const DASHBOARD_OVERLAY_CLASS = 'newtab-dashboard-overlay fixed inset-0 z-[10010] overflow-hidden bg-ds-app'
const DASHBOARD_PANEL_CLASS = `newtab-dashboard-surface fixed inset-0 grid h-dvh w-screen overflow-hidden ${DASHBOARD_SURFACE_CLASS}`
const DASHBOARD_LOADING_CLASS = `newtab-dashboard-loading fixed inset-0 z-[2] grid place-items-center ${DASHBOARD_SURFACE_CLASS}`
const DASHBOARD_FALLBACK_CLASS = `newtab-dashboard-fallback fixed inset-0 z-[3] grid place-items-center p-6 ${DASHBOARD_SURFACE_CLASS}`
const DASHBOARD_FRAME_CLASS = `newtab-dashboard-frame h-full w-full border-0 ${DASHBOARD_SURFACE_CLASS}`
const DASHBOARD_FRAME_VISIBLE_CLASS = 'opacity-100'
const DASHBOARD_FRAME_LOADING_CLASS = 'opacity-0'
const DASHBOARD_CARD_CLASS = 'rounded-ds-sm border border-ds-border bg-ds-surface-1 shadow-none'
const DASHBOARD_LOADING_CARD_CLASS = 'newtab-dashboard-loading-card grid size-[86px] place-items-center rounded-ds-sm border border-ds-border bg-ds-surface-1 text-ds-text-primary shadow-none'
const DASHBOARD_LOADING_LOADER_CLASS = 'newtab-dashboard-loading-loader size-[58px]'

export function DashboardOverlay({
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
      aria-hidden={open ? 'false' : 'true'}
      data-dashboard-ready={ready && !hasError ? 'true' : 'false'}
      data-dashboard-error={hasError ? 'true' : 'false'}
      tabIndex={-1}
      hidden={!open}
      disablePointerDismissal
    >
      <DialogPanel
        className={DASHBOARD_PANEL_CLASS}
        aria-label="书签仪表盘"
        initialFocus={false}
        finalFocus={false}
        unanimated
      >
        <output
          className={DASHBOARD_LOADING_CLASS}
          aria-live="polite"
          aria-label="正在打开书签仪表盘"
          hidden={ready || hasError}
        >
          <div className={DASHBOARD_LOADING_CARD_CLASS}>
            <RoseCurveLoader className={DASHBOARD_LOADING_LOADER_CLASS} />
          </div>
        </output>
        <div
          id="newtab-dashboard-fallback"
          className={DASHBOARD_FALLBACK_CLASS}
          role="alert"
          aria-live="assertive"
          hidden={!hasError}
        >
          <div className={`newtab-dashboard-fallback-card ${DASHBOARD_CARD_CLASS}`}>
            <p className="newtab-dashboard-fallback-kicker">Dashboard</p>
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
                重试
              </Button>
            </div>
          </div>
        </div>
        <iframe
          id="newtab-dashboard-frame"
          className={`${DASHBOARD_FRAME_CLASS} ${ready && !hasError ? DASHBOARD_FRAME_VISIBLE_CLASS : DASHBOARD_FRAME_LOADING_CLASS}`}
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
