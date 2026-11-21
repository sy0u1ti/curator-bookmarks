import { AvailabilityControls } from './AvailabilityControls.js'
import { AvailabilityDecisionMetrics } from './AvailabilityDecisionMetrics.js'
import { AvailabilityDecisionPanel } from './AvailabilityDecisionPanel.js'
import { AvailabilityFilterBar } from './AvailabilityFilterBar.js'
import { AvailabilityResults } from './AvailabilityResults.js'
import { AvailabilityResultsHeader } from './AvailabilityResultsHeader.js'
import { AvailabilitySelectionActions } from './AvailabilitySelectionActions.js'
import {
  OPTION_LIST_SECTION_CLASS,
  OPTION_PANEL_CLASS,
  OPTION_RUN_CELL_CLASS,
  OPTION_RUN_CELL_TITLE_CLASS,
  OPTION_RUN_HEADER_CLASS
} from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'
import { ResultsPagination } from './ResultsPagination.js'
import { ScopePickerTriggerButton } from './ScopePickerTrigger.js'
import { useAvailabilityResultsHeader } from './availability-overview-store.js'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

const AVAILABILITY_RESULTS_GROUP_CLASS = OPTION_LIST_SECTION_CLASS
const AVAILABILITY_RESULTS_LIST_CLASS = 'divide-y divide-ds-border-subtle'
const AVAILABILITY_RESULTS_PAGINATION_CLASS =
  'mt-0 border-t border-ds-border-subtle px-5 py-3 max-[760px]:px-4'

export function AvailabilityPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="availability" className={OPTION_PANEL_CLASS} aria-labelledby="availability-title" hidden={hidden}>
      <OptionPanelHeader
        titleId="availability-title"
        title="失效书签检测"
      />

      <div className={OPTION_RUN_HEADER_CLASS}>
        <div className={OPTION_RUN_CELL_CLASS}>
          <strong className={OPTION_RUN_CELL_TITLE_CLASS}>检测范围</strong>
          <div className="mt-3">
            <ScopePickerTriggerButton className="min-w-full" source="availability" />
          </div>
        </div>
        <AvailabilityControls />
      </div>

      <AvailabilityDecisionPanel>
        <AvailabilityDecisionMetrics />
        <AvailabilityFilterBar />
      </AvailabilityDecisionPanel>

      <AvailabilitySelectionActions />

      <AvailabilityResultGroups />
    </section>
  )
}

function AvailabilityResultGroups() {
  const { visible, reviewVisible = true, failedVisible = true } = useAvailabilityResultsHeader()
  if (!visible) return null

  return (
    <>
      {failedVisible ? <div className={AVAILABILITY_RESULTS_GROUP_CLASS}>
        <AvailabilityResultsHeader kind="failed" />
        <div className={AVAILABILITY_RESULTS_LIST_CLASS}>
          <AvailabilityResults kind="failed" />
        </div>
        <ResultsPagination className={AVAILABILITY_RESULTS_PAGINATION_CLASS} kind="availability-failed" ariaLabel="无法访问的书签分页" />
      </div> : null}

      {reviewVisible ? <div className={AVAILABILITY_RESULTS_GROUP_CLASS}>
        <AvailabilityResultsHeader kind="review" />
        <div className={AVAILABILITY_RESULTS_LIST_CLASS}>
          <AvailabilityResults kind="review" />
        </div>
        <ResultsPagination className={AVAILABILITY_RESULTS_PAGINATION_CLASS} kind="availability-review" ariaLabel="待确认书签分页" />
      </div> : null}
    </>
  )
}
