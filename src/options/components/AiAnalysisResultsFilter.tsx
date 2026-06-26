import { Button } from '../../ui'
import { Input } from '../../ui'
import { Select, type SelectOption } from '../../ui'
import { handleAiResultsFilterChange } from '../options-controller'
import { AI_ANALYSIS_SMALL_BUTTON_CLASS } from './ai-analysis-classes.js'
import { useAiAnalysisResultsFilter } from './ai-analysis-status-store.js'

const statusOptions: SelectOption[] = [
  { value: 'all', label: '全部状态' },
  { value: 'suggested', label: '只看建议改名' },
  { value: 'changed', label: '只看标题变化大' },
  { value: 'manual_review', label: '只看待人工确认' },
  { value: 'failed', label: '只看失败' }
]

const confidenceOptions: SelectOption[] = [
  { value: 'all', label: '全部置信度' },
  { value: 'high', label: '只看高置信' },
  { value: 'medium', label: '只看中置信' },
  { value: 'low', label: '只看低置信' }
]

const AI_RESULTS_FILTER_ROW_CLASS =
  'mt-[14px] min-w-0'
const AI_RESULTS_FILTER_ACTIONS_CLASS =
  'grid w-full min-w-0 grid-cols-[minmax(260px,286px)_minmax(220px,242px)_minmax(220px,242px)_auto] items-end gap-2.5 max-[980px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[760px]:grid-cols-1'
const AI_RESULTS_FILTER_FIELD_CLASS =
  'grid min-w-0 gap-1.5'
const AI_RESULTS_FILTER_LABEL_CLASS =
  'text-xs font-medium leading-none text-ds-text-secondary'
const AI_RESULTS_FILTER_QUERY_CLASS =
  'h-[42px] min-h-[42px] w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3.5 font-[inherit] text-sm font-medium leading-[42px] text-ds-text-primary outline-none shadow-none placeholder:text-[rgba(255,255,255,0.58)] focus:border-ds-border focus:bg-ds-surface-2 focus:outline focus:outline-1 focus:outline-offset-2 focus:outline-ds-focus'
const AI_RESULTS_FILTER_SELECT_CLASS = 'w-full'
const AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS = 'min-h-[42px] w-full'
const AI_RESULTS_FILTER_CLEAR_CLASS =
  `${AI_ANALYSIS_SMALL_BUTTON_CLASS} h-[42px] self-end whitespace-nowrap px-3.5 max-[760px]:w-full`

export function AiAnalysisResultsFilter() {
  const state = useAiAnalysisResultsFilter()

  return (
    <div className={AI_RESULTS_FILTER_ROW_CLASS}>
      <div className={AI_RESULTS_FILTER_ACTIONS_CLASS}>
        <label className={AI_RESULTS_FILTER_FIELD_CLASS}>
          <span className={AI_RESULTS_FILTER_LABEL_CLASS}>文件夹或域名</span>
          <Input
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
          ariaLabel="按状态筛选书签智能分析结果"
          className={AI_RESULTS_FILTER_SELECT_CLASS}
          label="状态"
          options={statusOptions}
          triggerClassName={AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS}
          value={state.status}
          onValueChange={(value) => handleAiResultsFilterChange({
            action: 'change',
            key: 'status',
            value: value || 'all'
          })}
        />
        <Select
          ariaLabel="按置信度筛选书签智能分析结果"
          className={AI_RESULTS_FILTER_SELECT_CLASS}
          label="置信度"
          options={confidenceOptions}
          triggerClassName={AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS}
          value={state.confidence}
          onValueChange={(value) => handleAiResultsFilterChange({
            action: 'change',
            key: 'confidence',
            value: value || 'all'
          })}
        />
        <Button
          className={AI_RESULTS_FILTER_CLEAR_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清空书签智能分析筛选条件"
          disabled={state.clearDisabled}
          focusableWhenDisabled={state.clearDisabled}
          onClick={() => handleAiResultsFilterChange({ action: 'clear' })}
        >
          清空筛选
        </Button>
      </div>
    </div>
  )
}
