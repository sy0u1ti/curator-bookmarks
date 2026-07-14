import { Button } from '../../ui/base/Button'
import { NumberPop } from '../../ui/motion/NumberPop'
import { handleAiResultsPagination } from '../options-controller'
import { useAiAnalysisResultsPagination } from './ai-analysis-status-store.js'
import {
  OPTION_PAGINATION_CLASS,
  OPTION_PAGINATION_HIDDEN_CLASS,
  OPTION_PAGINATION_LABEL_CLASS,
  OPTION_PAGINATION_PAGE_VALUE_CLASS,
  OPTION_PAGINATION_RANGE_VALUE_CLASS,
  OPTION_VALUE_CLASS
} from './option-layout-classes.js'

export function AiAnalysisResultsPagination() {
  const state = useAiAnalysisResultsPagination()

  return (
    <div aria-label="AI 标签与命名结果分页">
      <div
        className={[
          OPTION_PAGINATION_CLASS,
          state.visible ? '' : OPTION_PAGINATION_HIDDEN_CLASS
        ].filter(Boolean).join(' ')}
        aria-hidden={state.visible ? undefined : 'true'}
        inert={!state.visible}
      >
        <span className={OPTION_PAGINATION_LABEL_CLASS}>
          {state.label} <NumberPop className={OPTION_PAGINATION_RANGE_VALUE_CLASS} text={`${state.start}-${state.end} / ${state.totalCount}`} />
        </span>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={!state.visible || state.page <= 1}
          onClick={() => handleAiResultsPagination({ direction: 'prev' })}
        >
          上一页
        </Button>
        <span className={OPTION_VALUE_CLASS}>
          <NumberPop className={OPTION_PAGINATION_PAGE_VALUE_CLASS} text={`${state.page} / ${state.totalPages}`} />
        </span>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={!state.visible || state.page >= state.totalPages}
          onClick={() => handleAiResultsPagination({ direction: 'next' })}
        >
          下一页
        </Button>
      </div>
    </div>
  )
}
