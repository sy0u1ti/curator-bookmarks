import { Button } from '../../ui/base/Button'
import { handleAvailabilityPanelAction } from '../options-controller'
import { useAvailabilityFilters } from './availability-overview-store.js'

const AVAILABILITY_FILTER_BAR_CLASS = 'mt-3 flex flex-wrap items-center gap-2'
const AVAILABILITY_FILTER_BUTTON_CLASS =
  'rounded-ds-sm whitespace-nowrap aria-pressed:border-ds-border-hover aria-pressed:bg-ds-selected aria-pressed:text-ds-text-primary'

export function AvailabilityFilterBar() {
  const state = useAvailabilityFilters()

  return (
    <div className={AVAILABILITY_FILTER_BAR_CLASS} role="toolbar" aria-label="筛选可用性检测结果">
      {state.filters.map((item) => (
        <Button
          className={AVAILABILITY_FILTER_BUTTON_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-pressed={item.active}
          key={item.filter}
          onClick={() => handleAvailabilityPanelAction({
            action: 'filter-change',
            filter: item.filter
          })}
        >
          {item.label} {item.count}
        </Button>
      ))}
    </div>
  )
}
