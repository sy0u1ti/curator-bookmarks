import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button } from '../../ui/primitives/Button.js'
import { Card } from '../../ui/primitives/Card.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { dispatchHistoryAction } from './history-events.js'

export interface AvailabilityHistoryControlsState {
  clearDisabled: boolean
  logCount: number
  logToggleDisabled: boolean
  logToggleLabel: string
  metrics: {
    newCount: number
    persistentCount: number
    recoveredCount: number
  }
  subtitle: string
  timestamp: string
}

const roots = new WeakMap<Element, Root>()

export function renderAvailabilityHistoryControlsIsland(
  container: Element,
  state: AvailabilityHistoryControlsState
): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <AvailabilityHistoryControls state={state} />
      </ThemeProvider>
    )
  })
}

function AvailabilityHistoryControls({ state }: { state: AvailabilityHistoryControlsState }) {
  return (
    <>
      <div className="detect-results-header">
        <div>
          <strong>检测历史</strong>
          <p id="availability-history-subtitle" className="detect-results-subtitle">
            {state.subtitle}
          </p>
        </div>
        <div className="detect-results-actions">
          <span id="availability-history-timestamp" className="option-value">{state.timestamp}</span>
          <Button
            id="availability-clear-history"
            className="options-button secondary small"
            size="sm"
            type="button"
            variant="secondary"
            aria-label="清空可用性检测历史日志"
            disabled={state.clearDisabled}
            onClick={() => dispatchHistoryAction('clear-history')}
          >
            清空历史日志
          </Button>
        </div>
      </div>
      <div className="detect-history-grid">
        <Card className="summary-card compact">
          <span className="summary-label">新增异常</span>
          <strong id="availability-history-new">{state.metrics.newCount}</strong>
        </Card>
        <Card className="summary-card compact">
          <span className="summary-label">持续异常</span>
          <strong id="availability-history-persistent">{state.metrics.persistentCount}</strong>
        </Card>
        <Card className="summary-card compact">
          <span className="summary-label">已恢复</span>
          <strong id="availability-history-recovered">{state.metrics.recoveredCount}</strong>
        </Card>
      </div>
      <div className="detect-results-header history-subheader">
        <div>
          <strong>检测日志</strong>
          <p className="detect-results-subtitle">每条日志会同时展示异常数量变化、新增异常、已恢复结果，以及各异常书签的连续异常次数。</p>
        </div>
        <div className="detect-results-actions">
          <span id="availability-history-log-count" className="option-value">{state.logCount} 次记录</span>
          <Button
            id="availability-toggle-history-logs"
            className="options-button secondary small"
            size="sm"
            type="button"
            variant="secondary"
            disabled={state.logToggleDisabled}
            onClick={() => dispatchHistoryAction('toggle-logs')}
          >
            {state.logToggleLabel}
          </Button>
        </div>
      </div>
    </>
  )
}
