import { Button } from '../../ui/base/Button.js'
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

const SELECTION_GROUP_CLASS =
  'mt-5 rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[var(--ui-surface)] p-[18px_20px_20px] shadow-none max-[760px]:p-4'
const RESULTS_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const RESULTS_HEADER_COPY_CLASS = 'min-w-0'
const RESULTS_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-[var(--ui-text-primary)]'
const RESULTS_SUBTITLE_CLASS = 'mt-2.5 text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const RESULTS_ACTIONS_CLASS =
  'flex flex-none flex-wrap items-center justify-end gap-2.5 max-[760px]:w-full max-[760px]:justify-start'
const SELECTION_WARNING_CLASS =
  'mt-2 text-xs font-semibold leading-[1.6] text-[#ffb7b0]'
const SUMMARY_GRID_CLASS =
  'mt-[18px] grid grid-cols-4 gap-3 max-[1180px]:grid-cols-3 max-[760px]:grid-cols-1'
const SUMMARY_CARD_CLASS =
  'relative min-w-0 overflow-hidden rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[#050505] p-[14px_16px] text-[var(--ui-text-primary)] shadow-none transition-colors before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""] hover:border-[var(--ui-divider)] hover:bg-[#080808]'
const SUMMARY_ACCENT_CLASS = {
  danger: 'before:bg-[rgba(255,183,176,0.78)]',
  info: 'before:bg-[rgba(141,181,255,0.62)]',
  success: 'before:bg-[rgba(189,243,202,0.72)]',
  total: 'before:bg-[rgba(245,245,247,0.4)]',
  warning: 'before:bg-[rgba(255,220,165,0.72)]'
} as const
const SUMMARY_LABEL_CLASS =
  'block text-[11px] font-semibold uppercase leading-normal tracking-[0] text-[var(--ui-text-disabled)]'
const SUMMARY_VALUE_CLASS =
  'mt-2 block text-2xl font-[650] leading-none tracking-[0] text-[var(--ui-text-primary)]'
const TOOLBAR_CLASS = 'mt-4 grid gap-2.5 border-t border-[rgba(255,255,255,0.075)] pt-4'
const STRATEGY_CONTROLS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-start gap-[7px]'
const PRIMARY_ACTION_CLASS = 'min-w-40 max-[760px]:min-w-0 max-[760px]:w-full'
const STRATEGY_STATUS_CLASS =
  'min-w-[220px] flex-1 basis-60 text-xs font-semibold leading-[1.5] text-[rgba(245,245,247,0.54)] [overflow-wrap:anywhere] max-[760px]:min-w-0 max-[760px]:basis-full'

export function DuplicateControls() {
  const state = useDuplicateControlsState()
  const hasSelection = state.selectionStats.deleteCount > 0
  const unsafe = state.selectionStats.unsafeGroupCount > 0

  return (
    <>
      {hasSelection ? (
        <div className={SELECTION_GROUP_CLASS}>
          <div className={RESULTS_HEADER_CLASS}>
            <div className={RESULTS_HEADER_COPY_CLASS}>
              <strong className={RESULTS_TITLE_CLASS}>
                {state.selectionStats.deleteCount} 条待移入回收站
              </strong>
              <p className={RESULTS_SUBTITLE_CLASS}>
                将移入回收站 {state.selectionStats.deleteCount} 条，保留 {state.selectionStats.keepCount}
                {' '}条，涉及 {state.selectionStats.groupCount} 组。
              </p>
              {unsafe ? (
                <p className={SELECTION_WARNING_CLASS}>
                  {state.selectionStats.unsafeGroupCount} 组重复已被全选；每组至少保留 1 条后才能移入回收站。
                </p>
              ) : null}
            </div>
            <div className={RESULTS_ACTIONS_CLASS}>
              <Button
                className="max-[760px]:w-full"
                size="sm"
                type="button"
                variant="secondary"
                aria-label="清空重复书签已选项"
                onClick={() => handleDuplicateAction({ action: 'clear-selection' })}
              >
                清空选择
              </Button>
              <Button
                className="max-[760px]:w-full"
                size="sm"
                type="button"
                variant="danger"
                aria-label="将重复书签已选项移入回收站"
                disabled={state.locked || !hasSelection || unsafe}
                focusableWhenDisabled={state.locked}
                onClick={() => handleDuplicateAction({ action: 'delete-selection' })}
              >
                移入回收站
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={SUMMARY_GRID_CLASS}>
        {duplicateMetrics.map((metric) => (
          <article
            className={`${SUMMARY_CARD_CLASS} ${SUMMARY_ACCENT_CLASS[metric.tone]}`}
            key={metric.key}
          >
            <span className={SUMMARY_LABEL_CLASS}>{metric.label}</span>
            <strong className={SUMMARY_VALUE_CLASS}>{state.summary[metric.key]}</strong>
          </article>
        ))}
      </div>
    </>
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
            按推荐选择当前结果
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
    </>
  )
}
