import { Button } from '../../ui'
import { handleAvailabilityPanelAction } from '../options-controller'
import { useAvailabilityResultsHeader } from './availability-overview-store.js'

const AVAILABILITY_RESULTS_HEADER_CLASS =
  'flex min-w-0 flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AVAILABILITY_RESULTS_HEADER_COPY_CLASS = 'min-w-0'
const AVAILABILITY_RESULTS_HEADER_TITLE_CLASS =
  'block text-[15px] font-semibold leading-normal tracking-[0] text-ds-text-primary'
const AVAILABILITY_RESULTS_SUBTITLE_CLASS =
  'mt-2.5 mb-0 text-[13px] leading-[1.7] text-ds-text-secondary'
const AVAILABILITY_RESULTS_ACTIONS_CLASS =
  'flex min-w-0 flex-[0_0_auto] flex-wrap items-center justify-end gap-2.5 max-[760px]:flex-col max-[760px]:items-start max-[760px]:justify-start'
const AVAILABILITY_RESULTS_ACTION_BUTTON_CLASS = 'max-[760px]:w-full'

export function AvailabilityResultsHeader({ kind }: { kind: 'failed' | 'review' }) {
  const state = useAvailabilityResultsHeader()

  if (kind === 'failed') {
    return (
      <div className={AVAILABILITY_RESULTS_HEADER_CLASS}>
        <div className={AVAILABILITY_RESULTS_HEADER_COPY_CLASS}>
          <strong className={AVAILABILITY_RESULTS_HEADER_TITLE_CLASS}>
            {state.failedTitle}
          </strong>
          <p className={AVAILABILITY_RESULTS_SUBTITLE_CLASS}>{state.failedLastRun}</p>
        </div>
        <div className={AVAILABILITY_RESULTS_ACTIONS_CLASS}>
          <Button
            className={AVAILABILITY_RESULTS_ACTION_BUTTON_CLASS}
            size="sm"
            type="button"
            variant="secondary"
            aria-label="全选高置信异常书签"
            onClick={() => handleAvailabilityPanelAction({ action: 'select-failed' })}
          >
            全选本区
          </Button>
          <Button
            className={AVAILABILITY_RESULTS_ACTION_BUTTON_CLASS}
            size="sm"
            type="button"
            variant="danger"
            aria-label="批量删除高置信异常书签"
            disabled={state.deleteFailedDisabled}
            focusableWhenDisabled={state.deleteFailedDisabled}
            onClick={() => handleAvailabilityPanelAction({ action: 'delete-failed' })}
          >
            {state.deleteFailedLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={AVAILABILITY_RESULTS_HEADER_CLASS}>
      <div className={AVAILABILITY_RESULTS_HEADER_COPY_CLASS}>
        <strong className={AVAILABILITY_RESULTS_HEADER_TITLE_CLASS}>
          {state.reviewTitle}
        </strong>
        <p className={AVAILABILITY_RESULTS_SUBTITLE_CLASS}>
          {state.reviewSubtitle}
        </p>
      </div>
      <div className={AVAILABILITY_RESULTS_ACTIONS_CLASS}>
        <Button
          className={AVAILABILITY_RESULTS_ACTION_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="全选低置信异常书签"
          onClick={() => handleAvailabilityPanelAction({ action: 'select-review' })}
        >
          全选本区
        </Button>
      </div>
    </div>
  )
}
