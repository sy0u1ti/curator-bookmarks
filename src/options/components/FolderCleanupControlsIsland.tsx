import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button } from '../../ui/primitives/Button.js'
import { Card } from '../../ui/primitives/Card.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { dispatchFolderCleanupAction } from './folder-cleanup-events.js'

export interface FolderCleanupControlsState {
  analyzeDisabled: boolean
  analyzeLabel: string
  countLabel: string
  resultsSubtitle: string
  status: {
    label: string
    tone: 'muted' | 'success' | 'warning'
  }
  summary: {
    deep: number
    empty: number
    large: number
    sameName: number
    total: number
  }
}

const roots = new WeakMap<Element, Root>()

export function renderFolderCleanupControlsIsland(container: Element, state: FolderCleanupControlsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <FolderCleanupControls state={state} />
      </ThemeProvider>
    )
  })
}

function FolderCleanupControls({ state }: { state: FolderCleanupControlsState }) {
  const metrics = [
    { className: 'metric-total', id: 'folder-cleanup-summary-total', label: '建议总数', value: state.summary.total },
    { className: 'metric-danger', id: 'folder-cleanup-summary-empty', label: '空文件夹', value: state.summary.empty },
    { className: 'metric-warning', id: 'folder-cleanup-summary-deep', label: '深层低价值', value: state.summary.deep },
    { className: 'metric-info', id: 'folder-cleanup-summary-same-name', label: '同名合并', value: state.summary.sameName },
    { className: 'metric-muted', id: 'folder-cleanup-summary-large', label: '超大拆分', value: state.summary.large }
  ]

  return (
    <>
      <div className="options-group">
        <div className="option-row">
          <div className="option-copy">
            <strong>建议和预览优先</strong>
            <p>先重新读取当前 Chrome 书签树，再扫描空文件夹、深层低价值文件夹、单一路径、同名文件夹和超大文件夹；删除、合并、移动和拆分都会在确认后执行，并先调用自动备份 hook。拆分会记录本次移动，可在建议区撤销本次拆分。</p>
          </div>
          <div className="detect-results-actions">
            <span id="folder-cleanup-status" className={`options-chip ${state.status.tone}`}>{state.status.label}</span>
            <Button
              id="folder-cleanup-analyze"
              className="options-button small"
              size="sm"
              type="button"
              disabled={state.analyzeDisabled}
              focusableWhenDisabled={state.analyzeLabel === '扫描中...'}
              onClick={() => dispatchFolderCleanupAction('rescan')}
            >
              {state.analyzeLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className="detect-summary-grid compact-grid">
        {metrics.map((metric) => (
          <Card className={`summary-card compact metric-card ${metric.className}`} key={metric.id}>
            <span className="summary-label">{metric.label}</span>
            <strong id={metric.id}>{metric.value}</strong>
          </Card>
        ))}
      </div>

      <div className="detect-results-header">
        <div>
          <strong>清理建议</strong>
          <p id="folder-cleanup-results-subtitle" className="detect-results-subtitle">
            {state.resultsSubtitle}
          </p>
        </div>
        <span id="folder-cleanup-count" className="option-value">{state.countLabel}</span>
      </div>
    </>
  )
}
