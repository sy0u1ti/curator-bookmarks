import { Button, DialogOverlay, DialogPanel, DotMatrixLoader } from '../../ui'

export interface DashboardOverlayProps {
  open: boolean
  onOpenChange: (open: boolean, event?: Event) => void
}

export function DashboardOverlay({ open, onOpenChange }: DashboardOverlayProps) {
  return (
    <DialogOverlay
      id="newtab-dashboard-overlay"
      className="newtab-dashboard-overlay"
      open={open}
      onOpenChange={onOpenChange}
      triggerId="newtab-dashboard-trigger"
      aria-hidden={open ? 'false' : 'true'}
      data-dashboard-ready="false"
      data-dashboard-error="false"
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
        <div className="newtab-dashboard-loading" role="status" aria-label="正在打开书签仪表盘">
          <div className="newtab-dashboard-loading-card">
            <DotMatrixLoader className="newtab-dashboard-loading-loader" />
          </div>
        </div>
        <div
          id="newtab-dashboard-fallback"
          className="newtab-dashboard-fallback"
          role="alert"
          aria-live="assertive"
          hidden
        >
          <div className="newtab-dashboard-fallback-card">
            <p className="newtab-dashboard-fallback-kicker">Dashboard</p>
            <h2>书签仪表盘暂时无法打开</h2>
            <p id="newtab-dashboard-fallback-copy">加载耗时过长。你可以返回新标签页，或重试打开仪表盘。</p>
            <div className="newtab-dashboard-fallback-actions">
              <Button className="newtab-button secondary" type="button" data-dashboard-fallback-action="return" unstyled>
                返回新标签页
              </Button>
              <Button className="newtab-button" type="button" data-dashboard-fallback-action="retry" unstyled>
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
          tabIndex={0}
        />
      </DialogPanel>
    </DialogOverlay>
  )
}
