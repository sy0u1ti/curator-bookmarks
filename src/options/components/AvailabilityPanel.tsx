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
  OPTION_RUN_CELL_CLASS,
  OPTION_RUN_CELL_TEXT_CLASS,
  OPTION_RUN_CELL_TITLE_CLASS,
  OPTION_RUN_HEADER_CLASS,
  OPTION_SECTION_LABEL_CLASS,
  OPTION_TOOL_PANEL_CLASS
} from './option-layout-classes.js'
import { ResultsPagination } from './ResultsPagination.js'
import { ScopePickerTriggerButton } from './ScopePickerTrigger.js'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

const AVAILABILITY_RESULTS_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const AVAILABILITY_RESULTS_LIST_CLASS = 'mt-4 flex flex-col gap-3'

export function AvailabilityPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="availability" className={OPTION_PANEL_CLASS} aria-labelledby="availability-title" hidden={hidden}>
      <p className={OPTION_SECTION_LABEL_CLASS}>Availability</p>
      <h1 id="availability-title" className={OPTION_PANEL_TITLE_CLASS}>书签可用性检测</h1>

      <div className={OPTION_RUN_HEADER_CLASS}>
        <div className={OPTION_RUN_CELL_CLASS}>
          <strong className={OPTION_RUN_CELL_TITLE_CLASS}>检测范围</strong>
          <p className={OPTION_RUN_CELL_TEXT_CLASS}>先限定范围，再执行多层校验。</p>
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
