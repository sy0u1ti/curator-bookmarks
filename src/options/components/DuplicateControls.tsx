import { useState } from 'react'
import { Button } from '../../ui/base/Button'
import { Select } from '../../ui/base/Select'
import { StatusMessage } from '../../ui/base/StatusMessage'
import { handleDuplicateAction } from '../options-controller'
import { useDuplicateControlsState } from './duplicate-controls-store.js'

const duplicateStrategies = [
  { label: '按推荐保留', value: 'recommended' },
  { label: '保留最新', value: 'newest' },
  { label: '保留最早', value: 'oldest' },
  { label: '保留路径最短', value: 'shorter-path' },
  { label: '保留有标签', value: 'tagged' },
  { label: '保留新标签页来源', value: 'newtab-source' },
  { label: '保留最近访问', value: 'recent' }
]

const SUMMARY_GRID_CLASS =
  'options-interactive-surface m-0 mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-border-subtle max-[760px]:mt-4 max-[760px]:grid-cols-2'
const SUMMARY_PRIMARY_CLASS = 'grid content-center gap-2 bg-ds-surface-1 px-5 py-4 max-[760px]:px-4'
const SUMMARY_LABEL_ROW_CLASS =
  'min-w-0 text-xs font-medium leading-4 text-ds-text-muted'
const SUMMARY_PRIMARY_VALUE_CLASS = 'm-0 text-2xl font-semibold leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'
const TOOLBAR_CLASS = 'mt-5 flex flex-wrap items-end justify-between gap-3 max-[760px]:mt-4'
const STRATEGY_CONTROLS_CLASS =
  'flex min-w-0 flex-wrap items-end justify-start gap-2'
const PRIMARY_ACTION_CLASS = 'min-h-9 shrink-0'
const STRATEGY_STATUS_CLASS =
  'm-0 text-xs leading-[1.5] text-ds-text-secondary [overflow-wrap:anywhere]'

export function DuplicateControls() {
  const state = useDuplicateControlsState()

  return (
    <dl className={SUMMARY_GRID_CLASS}>
      <div className={SUMMARY_PRIMARY_CLASS}>
        <dt className={SUMMARY_LABEL_ROW_CLASS}>重复分组</dt>
        <dd className={SUMMARY_PRIMARY_VALUE_CLASS}>{state.summary.totalGroups}</dd>
      </div>
      <div className={SUMMARY_PRIMARY_CLASS}>
        <dt className={SUMMARY_LABEL_ROW_CLASS}>可清理副本</dt>
        <dd className={SUMMARY_PRIMARY_VALUE_CLASS}>{state.summary.deleteCandidates}</dd>
      </div>
      <div className={SUMMARY_PRIMARY_CLASS}>
        <dt className={SUMMARY_LABEL_ROW_CLASS}>跨文件夹</dt>
        <dd className={SUMMARY_PRIMARY_VALUE_CLASS}>{state.summary.crossFolderGroups}</dd>
      </div>
      <div className={SUMMARY_PRIMARY_CLASS}>
        <dt className={SUMMARY_LABEL_ROW_CLASS}>标题不同</dt>
        <dd className={SUMMARY_PRIMARY_VALUE_CLASS}>{state.summary.titleVariantGroups}</dd>
      </div>
    </dl>
  )
}

export function DuplicateResultsControls() {
  const state = useDuplicateControlsState()
  const hasResults = state.resultCount > 0
  const [strategy, setStrategy] = useState('recommended')

  return (
    <>
      {hasResults ? (
        <div className={TOOLBAR_CLASS}>
          <div
            className={STRATEGY_CONTROLS_CLASS}
            aria-label="重复书签选择策略"
          >
            <Select
              id="duplicate-keep-rule"
              label="保留规则"
              ariaLabel="重复书签保留规则"
              value={strategy}
              options={duplicateStrategies}
              disabled={state.locked}
              onValueChange={value => { if (value) setStrategy(value) }}
              className="min-w-0"
              triggerClassName="min-w-44 max-[420px]:min-w-0"
            />
            <Button
              className={PRIMARY_ACTION_CLASS}
              size="sm"
              type="button"
              variant="primary"
              aria-label={strategy === 'recommended' ? '按推荐选择重复书签当前结果' : '按保留规则选择重复书签当前结果'}
              disabled={state.locked || !hasResults}
              focusableWhenDisabled={state.locked}
              onClick={() => handleDuplicateAction({ action: 'strategy', strategy })}
            >
              选择待清理副本
            </Button>
          </div>
          <StatusMessage
            className={STRATEGY_STATUS_CLASS}
            reserve={[state.resultsSubtitle || '已手动调整选择。']}
          >
            {state.strategyStatus || state.resultsSubtitle}
          </StatusMessage>
        </div>
      ) : null}
    </>
  )
}
