import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button } from '../../ui/primitives/Button.js'
import { Card } from '../../ui/primitives/Card.js'
import { ThemeProvider } from '../../ui/theme/ThemeProvider.js'
import { dispatchDuplicateAction } from './duplicate-events.js'

export interface DuplicateControlsSummary {
  crossFolderGroups: number
  deleteCandidates: number
  highRiskGroups: number
  selectedItems: number
  titleVariantGroups: number
  totalGroups: number
}

export interface DuplicateControlsSelectionStats {
  deleteCount: number
  groupCount: number
  keepCount: number
  unsafeGroupCount: number
}

export interface DuplicateControlsState {
  groupCountLabel: string
  locked: boolean
  resultCount: number
  resultsSubtitle: string
  selectionStats: DuplicateControlsSelectionStats
  strategyStatus: string
  summary: DuplicateControlsSummary
}

const duplicateMetrics = [
  { className: 'metric-total', key: 'totalGroups', label: '重复分组', valueId: 'duplicate-summary-groups' },
  { className: 'metric-info', key: 'deleteCandidates', label: '建议清理', valueId: 'duplicate-summary-candidates' },
  { className: 'metric-warning', key: 'crossFolderGroups', label: '跨文件夹', valueId: 'duplicate-summary-cross-folder' },
  { className: 'metric-warning', key: 'titleVariantGroups', label: '标题差异', valueId: 'duplicate-summary-title-variants' },
  { className: 'metric-danger', key: 'highRiskGroups', label: '高风险', valueId: 'duplicate-summary-high-risk' },
  { className: 'metric-success', key: 'selectedItems', label: '已选择', valueId: 'duplicate-summary-selected' }
] as const

const duplicateStrategies = [
  { label: '保留最新', value: 'newest' },
  { label: '保留最早', value: 'oldest' },
  { label: '保留路径最短', value: 'shorter-path' },
  { label: '保留有标签', value: 'tagged' },
  { label: '保留新标签页来源', value: 'newtab-source' },
  { label: '保留最近访问', value: 'recent' }
] as const

const roots = new WeakMap<Element, Root>()

export function renderDuplicateControlsIsland(container: Element, state: DuplicateControlsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <DuplicateControls state={state} />
      </ThemeProvider>
    )
  })
}

export function renderDuplicateResultsControlsIsland(container: Element, state: DuplicateControlsState): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(
      <ThemeProvider>
        <DuplicateResultsControls state={state} />
      </ThemeProvider>
    )
  })
}

function DuplicateControls({ state }: { state: DuplicateControlsState }) {
  const hasSelection = state.selectionStats.deleteCount > 0
  const unsafe = state.selectionStats.unsafeGroupCount > 0

  return (
    <>
      <div
        id="duplicate-selection-group"
        className="options-group detect-selection-group hidden"
      >
        <div className="detect-results-header">
          <div>
            <strong id="duplicate-selection-count">
              {state.selectionStats.deleteCount} 条待移入回收站
            </strong>
            <p id="duplicate-selection-impact" className="detect-results-subtitle">
              将移入回收站 {state.selectionStats.deleteCount} 条，保留 {state.selectionStats.keepCount}
              {' '}条，涉及 {state.selectionStats.groupCount} 组。
            </p>
            {unsafe ? (
              <p id="duplicate-selection-warning" className="duplicate-selection-warning">
                {state.selectionStats.unsafeGroupCount} 组重复已被全选；每组至少保留 1 条后才能移入回收站。
              </p>
            ) : (
              <p id="duplicate-selection-warning" className="duplicate-selection-warning hidden" />
            )}
          </div>
          <div className="detect-results-actions">
            <Button
              id="duplicate-clear-selection"
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label="清空重复书签已选项"
              onClick={() => dispatchDuplicateAction({ action: 'clear-selection' })}
            >
              清空选择
            </Button>
            <Button
              id="duplicate-delete-selection"
              className="options-button danger small"
              size="sm"
              type="button"
              variant="danger"
              aria-label="将重复书签已选项移入回收站"
              disabled={state.locked || !hasSelection || unsafe}
              focusableWhenDisabled={state.locked}
              onClick={() => dispatchDuplicateAction({ action: 'delete-selection' })}
            >
              移入回收站
            </Button>
          </div>
        </div>
      </div>

      <div className="detect-summary-grid compact-grid duplicate-summary-grid">
        {duplicateMetrics.map((metric) => (
          <Card className={`summary-card compact metric-card ${metric.className}`} key={metric.key}>
            <span className="summary-label">{metric.label}</span>
            <strong id={metric.valueId}>{state.summary[metric.key]}</strong>
          </Card>
        ))}
      </div>
    </>
  )
}

function DuplicateResultsControls({ state }: { state: DuplicateControlsState }) {
  const hasResults = state.resultCount > 0

  return (
    <>
      <div className="detect-results-header">
        <div>
          <strong>重复分组</strong>
          <p id="duplicate-results-subtitle" className="detect-results-subtitle">
            {state.resultsSubtitle}
          </p>
        </div>
        <span id="duplicate-group-count" className="option-value">
          {state.groupCountLabel}
        </span>
      </div>
      <div className="duplicate-toolbar">
        <div
          id="duplicate-strategy-controls"
          className="duplicate-strategy-controls duplicate-primary-action-row"
          aria-label="重复书签选择策略"
        >
          <Button
            className="options-button small duplicate-primary-action"
            size="sm"
            type="button"
            aria-label="按推荐选择重复书签当前结果"
            disabled={state.locked || !hasResults}
            focusableWhenDisabled={state.locked}
            onClick={() => dispatchDuplicateAction({ action: 'strategy', strategy: 'recommended' })}
          >
            按推荐选择当前结果
          </Button>
          {duplicateStrategies.map((strategy) => (
            <Button
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              aria-label={`${strategy.label}重复书签`}
              disabled={state.locked || !hasResults}
              focusableWhenDisabled={state.locked}
              key={strategy.value}
              onClick={() => dispatchDuplicateAction({ action: 'strategy', strategy: strategy.value })}
            >
              {strategy.label}
            </Button>
          ))}
          <span id="duplicate-strategy-status" className="duplicate-strategy-status">
            {state.strategyStatus}
          </span>
        </div>
      </div>
    </>
  )
}
