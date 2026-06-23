import { AvailabilityControls } from './AvailabilityControls.js'
import { AvailabilityDecisionMetrics } from './AvailabilityDecisionMetrics.js'
import { AvailabilityDecisionPanel } from './AvailabilityDecisionPanel.js'
import { AvailabilityFilterBar } from './AvailabilityFilterBar.js'
import { AvailabilityResults } from './AvailabilityResults.js'
import { AvailabilityResultsHeader } from './AvailabilityResultsHeader.js'
import { AvailabilitySelectionActions } from './AvailabilitySelectionActions.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_PANEL_TITLE_CLASS,
  OPTION_REVEAL_ENTER_CLASS,
  OPTION_SECTION_LABEL_CLASS
} from './option-layout-classes.js'
import { ResultsPagination } from './ResultsPagination.js'
import { ScopePickerTrigger } from './ScopePickerTrigger.js'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

const AVAILABILITY_RESULTS_GROUP_CLASS =
  `mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`
const AVAILABILITY_RESULTS_LIST_CLASS = 'mt-4 flex flex-col gap-3'

export function AvailabilityPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="availability" className={OPTION_PANEL_CLASS} aria-labelledby="availability-title" hidden={hidden}>
      <p className={OPTION_SECTION_LABEL_CLASS}>Availability</p>
      <h1 id="availability-title" className={OPTION_PANEL_TITLE_CLASS}>书签可用性检测</h1>

      <ScopePickerTrigger source="availability" />

      <AvailabilityControls />

      <AvailabilityDecisionPanel>
        <AvailabilityDecisionMetrics />
        <AvailabilityFilterBar />
      </AvailabilityDecisionPanel>

      <AvailabilitySelectionActions />

      <div className={AVAILABILITY_RESULTS_GROUP_CLASS}>
        <AvailabilityResultsHeader kind="review" />
        <div className={AVAILABILITY_RESULTS_LIST_CLASS}>
          <AvailabilityResults kind="review" />
        </div>
        <ResultsPagination kind="availability-review" ariaLabel="低置信异常分页" />
      </div>

      <div className={AVAILABILITY_RESULTS_GROUP_CLASS}>
        <AvailabilityResultsHeader kind="failed" />
        <div className={AVAILABILITY_RESULTS_LIST_CLASS}>
          <AvailabilityResults kind="failed" />
        </div>
        <ResultsPagination kind="availability-failed" ariaLabel="高置信异常分页" />
      </div>
    </section>
  )
}
