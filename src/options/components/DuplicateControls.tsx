import { NumberPop } from '../../ui/motion/NumberPop'
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
  'mt-[18px] grid grid-cols-4 gap-3 max-[1180px]:grid-cols-3 max-[760px]:grid-cols-1'
const SUMMARY_CARD_CLASS =
  'min-w-0 overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] text-ds-text-primary shadow-none transition-colors hover:border-ds-border hover:bg-ds-hover'
const SUMMARY_LABEL_ROW_CLASS =
  'flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase leading-normal tracking-[0] text-ds-text-disabled'
const SUMMARY_DOT_CLASS = {
  danger: 'bg-ds-danger',
  info: 'bg-ds-text-muted',
  success: 'bg-ds-success',
  total: 'bg-ds-border-hover',
  warning: 'bg-ds-warning'
} as const
const SUMMARY_VALUE_CLASS =
  'mt-2 block text-2xl font-[650] leading-none tracking-[0] text-ds-text-primary'
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
      {duplicateMetrics.map((metric) => (
        <article
          className={SUMMARY_CARD_CLASS}
          key={metric.key}
        >
          <span className={SUMMARY_LABEL_ROW_CLASS}>
            <span className={`size-1.5 rounded-full ${SUMMARY_DOT_CLASS[metric.tone]}`} aria-hidden="true" />
            {metric.label}
          </span>
          <strong className={SUMMARY_VALUE_CLASS}>
            <NumberPop text={state.summary[metric.key]} />
          </strong>
        </article>
      ))}
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
