import { useEffect } from 'react'
import { Button } from '../../ui/primitives/Button'
import { DialogOverlay, DialogPanel } from '../../ui/primitives/Dialog'
import { DotMatrixLoader } from '../../ui/primitives/DotMatrixLoader'
import {
  dispatchNewtabDashboardOverlayFallbackRetry,
  dispatchNewtabDashboardOverlayFallbackReturn,
  dispatchNewtabDashboardOverlayFrameError,
  dispatchNewtabDashboardOverlayOpenChange,
  dispatchNewtabDashboardOverlayReady,
  useNewtabDashboardOverlayView
} from '../newtab-dashboard-overlay-store'

export interface DashboardOverlayProps {
  errorMessage: string
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

export function DashboardOverlay({
  errorMessage,
  open,
  ready,
  onFallbackRetry,
  onFallbackReturn,
  onFrameError,
  onOpenChange
}: DashboardOverlayProps) {
  const hasError = Boolean(errorMessage)

  return (
    <DialogOverlay
      id="newtab-dashboard-overlay"
      className="newtab-dashboard-overlay"
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
        <output className="newtab-dashboard-loading" aria-live="polite" aria-label="正在打开书签仪表盘">
          <div className="newtab-dashboard-loading-card">
            <DotMatrixLoader className="newtab-dashboard-loading-loader" />
          </div>
        </output>
        <div
          id="newtab-dashboard-fallback"
          className="newtab-dashboard-fallback"
          role="alert"
          aria-live="assertive"
          hidden={!hasError}
        >
          <div className="newtab-dashboard-fallback-card">
            <p className="newtab-dashboard-fallback-kicker">Dashboard</p>
            <h2>书签仪表盘暂时无法打开</h2>
            <p id="newtab-dashboard-fallback-copy">
              {errorMessage || DEFAULT_DASHBOARD_ERROR_MESSAGE}
            </p>
            <div className="newtab-dashboard-fallback-actions">
              <Button
                className="newtab-button secondary"
                type="button"
                data-dashboard-fallback-action="return"
                onClick={onFallbackReturn}
                unstyled
              >
                返回新标签页
              </Button>
              <Button
                className="newtab-button"
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
          className="newtab-dashboard-frame"
          title="书签仪表盘"
          loading="lazy"
          onError={onFrameError}
          sandbox={DASHBOARD_FRAME_SANDBOX}
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
      open={view.open}
      ready={view.ready}
      onFallbackRetry={dispatchNewtabDashboardOverlayFallbackRetry}
      onFallbackReturn={dispatchNewtabDashboardOverlayFallbackReturn}
      onFrameError={dispatchNewtabDashboardOverlayFrameError}
      onOpenChange={dispatchNewtabDashboardOverlayOpenChange}
    />
  )
}
