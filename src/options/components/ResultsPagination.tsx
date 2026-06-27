import { Button, NumberPop } from '../../ui'
import { handleResultsPagination } from '../options-controller'
import { useResultsPaginationState } from './results-pagination-store.js'
import {
  OPTION_PAGINATION_CLASS,
  OPTION_PAGINATION_LABEL_CLASS,
  OPTION_VALUE_CLASS
} from './option-layout-classes.js'

export function ResultsPagination({
  ariaLabel,
  kind
}: {
  ariaLabel: string
  kind: string
}) {
  const state = useResultsPaginationState(kind)

  return (
    <div aria-label={ariaLabel}>
      {state.visible ? (
        <div className={OPTION_PAGINATION_CLASS}>
          <span className={OPTION_PAGINATION_LABEL_CLASS}>
            {state.label} <NumberPop text={`${state.start}-${state.end} / ${state.totalCount}`} />
          </span>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            disabled={state.page <= 1}
            onClick={() => handleResultsPagination({ direction: 'prev', kind })}
          >
            上一页
          </Button>
          <span className={OPTION_VALUE_CLASS}>
            <NumberPop text={`${state.page} / ${state.totalPages}`} />
          </span>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            disabled={state.page >= state.totalPages}
            onClick={() => handleResultsPagination({ direction: 'next', kind })}
          >
            下一页
          </Button>
        </div>
      ) : null}
    </div>
  )
}
