import { useState } from 'react'
import { Button } from '../../ui/base/Button'
import { Select } from '../../ui/base/Select'
import { handleDuplicateAction } from '../options-controller'
import { useDuplicateControlsState } from './duplicate-controls-store.js'
import { OPTION_SURFACE_CLASS } from './option-layout-classes.js'

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
  `mt-[18px] flex flex-wrap items-center gap-x-8 gap-y-4 ${OPTION_SURFACE_CLASS} px-5 py-4`
const SUMMARY_PRIMARY_CLASS = 'grid min-w-24 gap-2'
const SUMMARY_LABEL_ROW_CLASS =
  'min-w-0 text-xs font-medium leading-4 text-ds-text-secondary'
const SUMMARY_PRIMARY_VALUE_CLASS = 'm-0 text-2xl font-semibold leading-none text-ds-text-primary tabular-nums'
const SUMMARY_CONTEXT_CLASS = 'ml-auto flex flex-wrap gap-x-5 gap-y-2 text-xs text-ds-text-secondary max-[520px]:ml-0 max-[520px]:basis-full'
const TOOLBAR_CLASS = 'grid gap-3'
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
      <div className={SUMMARY_CONTEXT_CLASS}>
        <div className="flex gap-2"><dt>跨文件夹</dt><dd className="m-0 tabular-nums">{state.summary.crossFolderGroups}</dd></div>
        <div className="flex gap-2"><dt>标题不同</dt><dd className="m-0 tabular-nums">{state.summary.titleVariantGroups}</dd></div>
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
          <p className={STRATEGY_STATUS_CLASS} role="status">{state.strategyStatus}</p>
        </div>
      ) : null}
    </>
  )
}
