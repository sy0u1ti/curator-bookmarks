import { useCallback, useEffect, useRef } from 'react'
import { Button } from '../../ui/base/Button'
import { DialogOverlay, DialogPanel } from '../../ui/base/Dialog'
import { DotMatrixLoader } from '../../ui/base/DotMatrixLoader'
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
const DASHBOARD_SURFACE_CLASS = '!border-[var(--ui-divider)] !rounded-[var(--ui-radius-panel)] !bg-[var(--ui-bg-main)] !text-[var(--ui-text-primary)] !shadow-[var(--ui-shadow-panel)]'
const DASHBOARD_CARD_CLASS = 'border border-[var(--ui-divider)] rounded-[var(--ui-radius-control)] bg-[var(--ui-surface)] shadow-none'

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
      className={`newtab-dashboard-overlay ${DASHBOARD_SURFACE_CLASS}`}
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
        className="newtab-dashboard-surface"
        aria-label="书签仪表盘"
        initialFocus={false}
        finalFocus={false}
        unanimated
      >
        <output
          className={`newtab-dashboard-loading ${DASHBOARD_SURFACE_CLASS}`}
          aria-live="polite"
          aria-label="正在打开书签仪表盘"
        >
          <div className={`newtab-dashboard-loading-card ${DASHBOARD_CARD_CLASS}`}>
            <DotMatrixLoader className="newtab-dashboard-loading-loader" />
          </div>
        </output>
        <div
          id="newtab-dashboard-fallback"
          className={`newtab-dashboard-fallback ${DASHBOARD_SURFACE_CLASS}`}
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
          className={`newtab-dashboard-frame ${DASHBOARD_SURFACE_CLASS}`}
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
