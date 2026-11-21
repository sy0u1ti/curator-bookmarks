import { useRef } from 'react'
import { Button } from '../../ui/base/Button'
import { Input } from '../../ui/base/Input'
import { Select, type SelectOption } from '../../ui/base/Select'
import { handleAiResultsFilterChange } from '../options-controller'
import { AI_ANALYSIS_SMALL_BUTTON_CLASS } from './ai-analysis-classes.js'
import { useAiAnalysisResultsFilter } from './ai-analysis-status-store.js'

const resultOptions: SelectOption[] = [
  { value: 'all', label: '全部结果' },
  { value: 'suggested', label: '建议改名' },
  { value: 'manual_review', label: '待人工确认' },
  { value: 'unchanged', label: '无需改名' },
  { value: 'failed', label: '失败' }
]

const AI_RESULTS_FILTER_ROW_CLASS =
  'min-w-0 border-b border-ds-border-subtle bg-ds-surface-1 px-5 py-3.5 max-[760px]:px-4'
const AI_RESULTS_FILTER_ACTIONS_TWO_COL_CLASS =
  'grid w-full min-w-0 grid-cols-[minmax(220px,1fr)_minmax(180px,220px)] items-end gap-3 max-[760px]:grid-cols-1'
const AI_RESULTS_FILTER_ACTIONS_THREE_COL_CLASS =
  'grid w-full min-w-0 grid-cols-[minmax(220px,1fr)_minmax(180px,220px)_auto] items-end gap-3 max-[760px]:grid-cols-1'
const AI_RESULTS_FILTER_FIELD_CLASS =
  'grid min-w-0 gap-1.5'
const AI_RESULTS_FILTER_LABEL_CLASS =
  'text-xs font-medium leading-none text-ds-text-secondary'
const AI_RESULTS_FILTER_QUERY_CLASS =
  'h-10 min-h-10 w-full rounded-ds-sm border border-ds-border bg-ds-bg-page px-3 font-[inherit] text-[13px] font-normal leading-10 text-ds-text-primary outline-none transition-[border-color,background-color] duration-ds-fast ease-ds-standard placeholder:text-ds-text-muted hover:border-ds-border-hover focus:border-ds-focus'
const AI_RESULTS_FILTER_SELECT_CLASS = 'w-full'
const AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS = 'min-h-10 w-full'
const AI_RESULTS_FILTER_CLEAR_CLASS =
  `${AI_ANALYSIS_SMALL_BUTTON_CLASS} h-10 self-end whitespace-nowrap px-3.5 max-[760px]:w-full`

export function AiAnalysisResultsFilter() {
  const state = useAiAnalysisResultsFilter()
  const inputRef = useRef<HTMLInputElement>(null)
  if (!state.visible) return null
  const showClear = !state.clearDisabled

  return (
    <div className={AI_RESULTS_FILTER_ROW_CLASS}>
      <div className={showClear ? AI_RESULTS_FILTER_ACTIONS_THREE_COL_CLASS : AI_RESULTS_FILTER_ACTIONS_TWO_COL_CLASS}>
        <label className={AI_RESULTS_FILTER_FIELD_CLASS} htmlFor="ai-analysis-results-filter-query">
          <span className={AI_RESULTS_FILTER_LABEL_CLASS}>文件夹或域名</span>
          <Input
            id="ai-analysis-results-filter-query"
            ref={inputRef}
            className={AI_RESULTS_FILTER_QUERY_CLASS}
            type="search"
            spellCheck={false}
            placeholder="筛选文件夹或域名"
            aria-label="筛选书签智能分析结果"
            value={state.query}
            onValueChange={(value) => handleAiResultsFilterChange({
              action: 'change',
              key: 'query',
              value
            })}
            unstyled
          />
        </label>
        <Select
          ariaLabel="按结果筛选书签智能分析结果"
          className={AI_RESULTS_FILTER_SELECT_CLASS}
          label="结果"
          options={resultOptions}
          triggerClassName={AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS}
          value={state.status}
          onValueChange={(value) => handleAiResultsFilterChange({
            action: 'change',
            key: 'status',
            value: value || 'all'
          })}
        />
        {showClear ? <Button
          className={AI_RESULTS_FILTER_CLEAR_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清除书签智能分析筛选"
          onClick={() => {
            inputRef.current?.focus()
            handleAiResultsFilterChange({ action: 'clear' })
          }}
        >
          清除筛选
        </Button> : null}
      </div>
    </div>
  )
}
