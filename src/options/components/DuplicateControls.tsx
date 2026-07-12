import { Button } from '../../ui/base/Button'
import { handleDuplicateAction } from '../options-controller'
import { useDuplicateControlsState } from './duplicate-controls-store.js'

const duplicateMetrics = [
  { key: 'totalGroups', label: '重复分组', tone: 'total' },
  { key: 'deleteCandidates', label: '建议清理', tone: 'info' },
  { key: 'crossFolderGroups', label: '跨文件夹', tone: 'warning' },
  { key: 'titleVariantGroups', label: '标题差异', tone: 'warning' },
  { key: 'highRiskGroups', label: '高风险', tone: 'danger' },
  { key: 'selectedItems', label: '已选择', tone: 'success' }
] as const

const duplicateStrategies = [
  { label: '保留最新', value: 'newest' },
  { label: '保留最早', value: 'oldest' },
  { label: '保留路径最短', value: 'shorter-path' },
  { label: '保留有标签', value: 'tagged' },
  { label: '保留新标签页来源', value: 'newtab-source' },
  { label: '保留最近访问', value: 'recent' }
] as const

const RESULTS_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const RESULTS_HEADER_COPY_CLASS = 'min-w-0'
const RESULTS_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const RESULTS_SUBTITLE_CLASS = 'mt-2 text-[13px] leading-[1.55] text-ds-text-secondary'
const SUMMARY_GRID_CLASS =
  'mt-[18px] grid grid-cols-[minmax(150px,0.65fr)_minmax(0,2fr)] gap-4 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-4 max-[760px]:grid-cols-1'
const SUMMARY_PRIMARY_CLASS = 'grid content-center gap-1 border-r border-ds-border-subtle pr-4 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:pb-3 max-[760px]:pr-0'
const SUMMARY_LIST_CLASS = 'grid grid-cols-3 gap-x-5 gap-y-2 max-[980px]:grid-cols-2 max-[520px]:grid-cols-1'
const SUMMARY_ITEM_CLASS = 'flex min-w-0 items-baseline justify-between gap-3 border-b border-ds-border-subtle py-1.5'
const SUMMARY_LABEL_ROW_CLASS =
  'min-w-0 text-xs font-medium leading-4 text-ds-text-secondary'
const SUMMARY_VALUE_CLASS =
  'text-sm font-semibold leading-none text-ds-text-primary tabular-nums'
const SUMMARY_PRIMARY_VALUE_CLASS = 'text-[28px] font-[650] leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'
const TOOLBAR_CLASS = 'mt-4 grid gap-2.5 border-t border-[rgba(255,255,255,0.075)] pt-4'
const STRATEGY_CONTROLS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-start gap-[7px]'
const PRIMARY_ACTION_CLASS = 'min-w-40 max-[760px]:min-w-0 max-[760px]:w-full'
const STRATEGY_STATUS_CLASS =
  'min-w-[220px] flex-1 basis-60 text-xs font-semibold leading-[1.5] text-[rgba(245,245,247,0.54)] [overflow-wrap:anywhere] max-[760px]:min-w-0 max-[760px]:basis-full'

export function DuplicateControls() {
  const state = useDuplicateControlsState()

  return (
    <div className={SUMMARY_GRID_CLASS}>
      <div className={SUMMARY_PRIMARY_CLASS}>
        <span className={SUMMARY_LABEL_ROW_CLASS}>重复分组</span>
        <strong className={SUMMARY_PRIMARY_VALUE_CLASS}>{state.summary.totalGroups}</strong>
      </div>
      <dl className={SUMMARY_LIST_CLASS}>
        {duplicateMetrics.slice(1).map((metric) => (
          <div className={SUMMARY_ITEM_CLASS} key={metric.key}>
            <dt className={SUMMARY_LABEL_ROW_CLASS}>{metric.label}</dt>
            <dd className={SUMMARY_VALUE_CLASS}>{state.summary[metric.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function DuplicateResultsControls() {
  const state = useDuplicateControlsState()
  const hasResults = state.resultCount > 0

  return (
    <>
      <div className={RESULTS_HEADER_CLASS}>
        <div className={RESULTS_HEADER_COPY_CLASS}>
          <strong className={RESULTS_TITLE_CLASS}>重复分组</strong>
          <p className={RESULTS_SUBTITLE_CLASS}>
            {state.resultsSubtitle}
          </p>
        </div>
      </div>
      {hasResults ? (
        <div className={TOOLBAR_CLASS}>
        <div
          className={STRATEGY_CONTROLS_CLASS}
          aria-label="重复书签选择策略"
        >
          <Button
            className={PRIMARY_ACTION_CLASS}
            size="sm"
            type="button"
            variant="primary"
            aria-label="按推荐选择重复书签当前结果"
            disabled={state.locked || !hasResults}
            focusableWhenDisabled={state.locked}
            onClick={() => handleDuplicateAction({ action: 'strategy', strategy: 'recommended' })}
          >
            按推荐选择
          </Button>
          {duplicateStrategies.map((strategy) => (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              aria-label={`${strategy.label}重复书签`}
              disabled={state.locked || !hasResults}
              focusableWhenDisabled={state.locked}
              key={strategy.value}
              onClick={() => handleDuplicateAction({ action: 'strategy', strategy: strategy.value })}
            >
              {strategy.label}
            </Button>
          ))}
          <span className={STRATEGY_STATUS_CLASS}>
            {state.strategyStatus}
          </span>
        </div>
        </div>
      ) : null}
    </>
  )
}
