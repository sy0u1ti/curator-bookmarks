import { Button } from '../../ui/base/Button.js'
import { cx } from '../../ui/base/utils.js'
import { handleAvailabilityPanelAction } from '../options-controller'
import { useAvailabilityFilters } from './availability-overview-store.js'

const AVAILABILITY_FILTER_BAR_CLASS = 'mt-3 flex flex-wrap items-center gap-2'
const AVAILABILITY_FILTER_BUTTON_CLASS = 'rounded-[var(--ui-radius-control)] whitespace-nowrap'
const AVAILABILITY_FILTER_BUTTON_ACTIVE_CLASS =
  '!border-[rgba(255,255,255,0.42)] !bg-[rgba(255,255,255,0.12)] !text-[var(--ui-text-primary)]'

export function AvailabilityFilterBar() {
  const state = useAvailabilityFilters()

  return (
    <div className={AVAILABILITY_FILTER_BAR_CLASS} role="toolbar" aria-label="筛选可用性检测结果">
      {state.filters.map((item) => (
        <Button
          className={cx(
            AVAILABILITY_FILTER_BUTTON_CLASS,
            item.active && AVAILABILITY_FILTER_BUTTON_ACTIVE_CLASS
          )}
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
