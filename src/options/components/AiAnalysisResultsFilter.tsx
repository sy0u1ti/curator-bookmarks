import { Button } from '../../ui/base/Button.js'
import { Input } from '../../ui/base/Input.js'
import { Select, type SelectOption } from '../../ui/base/Select.js'
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
  'mt-[14px] flex min-w-0 flex-wrap items-stretch justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AI_RESULTS_FILTER_ACTIONS_CLASS =
  'flex min-w-0 flex-[0_0_auto] flex-wrap items-center justify-start gap-2.5 max-[760px]:w-full'
const AI_RESULTS_FILTER_QUERY_CLASS =
  'h-[42px] min-h-[42px] w-[min(260px,100%)] rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-3.5 font-[inherit] text-sm font-medium leading-[42px] text-[var(--ui-text-primary)] outline-none shadow-none placeholder:text-[rgba(255,255,255,0.58)] focus:border-[var(--ui-divider)] focus:bg-[var(--ui-surface-raised)] focus:outline focus:outline-1 focus:outline-offset-2 focus:outline-[var(--ui-focus-ring)] max-[760px]:w-full'
const AI_RESULTS_FILTER_CONTROLS_CLASS = 'contents'
const AI_RESULTS_FILTER_SELECT_CLASS = 'w-[min(220px,100%)] max-[760px]:w-full'
const AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS = 'min-h-[42px] w-full'

export function AiAnalysisResultsFilter() {
  const state = useAiAnalysisResultsFilter()

  return (
    <div className={AI_RESULTS_FILTER_ROW_CLASS}>
      <div className={AI_RESULTS_FILTER_ACTIONS_CLASS}>
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
        <div className={AI_RESULTS_FILTER_CONTROLS_CLASS}>
          <Select
            className={AI_RESULTS_FILTER_SELECT_CLASS}
            label="按状态筛选书签智能分析结果"
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
            className={AI_RESULTS_FILTER_SELECT_CLASS}
            label="按置信度筛选书签智能分析结果"
            options={confidenceOptions}
            triggerClassName={AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS}
            value={state.confidence}
            onValueChange={(value) => handleAiResultsFilterChange({
              action: 'change',
              key: 'confidence',
              value: value || 'all'
            })}
          />
        </div>
        <Button
          className={AI_ANALYSIS_SMALL_BUTTON_CLASS}
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
