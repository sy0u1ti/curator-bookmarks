import type { NewTabTimeSettings } from '../time-settings'
import { cx } from '../../ui/base/utils'

const CLOCK_BASE_CLASS = 'newtab-clock grid w-fit max-w-[min(100%,1229px)] min-h-[calc(38px*var(--clock-scale))] auto-cols-max grid-flow-col items-center justify-center gap-[calc(10px*var(--clock-scale))] rounded-[calc(12px*var(--clock-scale))] border border-[rgba(245,245,247,0.14)] bg-[var(--newtab-glass-bg-hero)] px-[calc(11px*var(--clock-scale))] py-[calc(7px*var(--clock-scale))] text-center text-[var(--ui-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [filter:drop-shadow(0_16px_36px_rgba(0,0,0,0.2))] select-none [-webkit-backdrop-filter:var(--newtab-glass-filter-hero)] [backdrop-filter:var(--newtab-glass-filter-hero)]'
const CLOCK_COMPACT_CLASS = 'min-h-[calc(24px*var(--clock-scale))] gap-[calc(8px*var(--clock-scale))] border-transparent bg-transparent p-0 shadow-none [filter:none] [-webkit-backdrop-filter:none] [backdrop-filter:none]'
const CLOCK_COMFORTABLE_CLASS = 'min-w-[min(100%,300px)] min-h-[calc(74px*var(--clock-scale))] grid-flow-row gap-[calc(6px*var(--clock-scale))] rounded-[calc(16px*var(--clock-scale))] px-[calc(18px*var(--clock-scale))] py-[calc(13px*var(--clock-scale))]'
const CLOCK_COMFORTABLE_DATE_ONLY_CLASS = 'min-h-[calc(54px*var(--clock-scale))]'

export const CLOCK_SPACER_CLASS = 'newtab-clock-spacer min-h-0'
export const CLOCK_TIME_GROUP_CLASS = 'newtab-clock-time-group inline-flex min-w-0 items-baseline justify-center gap-[calc(5px*var(--clock-scale))]'
const CLOCK_TIME_BASE_CLASS = 'newtab-clock-time whitespace-nowrap text-[calc(22px*var(--clock-scale))] font-[720] leading-none tracking-[0] text-[rgba(245,245,247,0.92)] tabular-nums'
const CLOCK_TIME_MINUTES_CLASS = 'min-w-[5ch]'
const CLOCK_TIME_SECONDS_CLASS = 'min-w-[8ch]'
export const CLOCK_PERIOD_CLASS = 'newtab-clock-period whitespace-nowrap text-[calc(10px*var(--clock-scale))] font-[720] leading-none tracking-[0] text-[rgba(245,245,247,0.72)]'
const CLOCK_DATE_BASE_CLASS = 'newtab-clock-date whitespace-nowrap text-[calc(12px*var(--clock-scale))] font-[650] leading-[1.05] tracking-[0] text-[rgba(245,245,247,0.72)]'
const CLOCK_DATE_ONLY_CLASS = 'text-[calc(16px*var(--clock-scale))] font-bold text-[rgba(245,245,247,0.82)]'
const CLOCK_DATE_COMFORTABLE_CLASS = 'text-[rgba(245,245,247,0.8)]'

export function getClockClass(settings: NewTabTimeSettings): string {
  return cx(
    CLOCK_BASE_CLASS,
    settings.density === 'compact' && CLOCK_COMPACT_CLASS,
    settings.density === 'comfortable' && CLOCK_COMFORTABLE_CLASS,
    settings.density === 'comfortable' && settings.displayMode === 'date' && CLOCK_COMFORTABLE_DATE_ONLY_CLASS
  )
}

export function getClockTimeClass(settings: NewTabTimeSettings): string {
  return cx(
    CLOCK_TIME_BASE_CLASS,
    settings.showSeconds ? CLOCK_TIME_SECONDS_CLASS : CLOCK_TIME_MINUTES_CLASS
  )
}

export function getClockDateClass(settings: NewTabTimeSettings): string {
  return cx(
    CLOCK_DATE_BASE_CLASS,
    settings.displayMode === 'date' && CLOCK_DATE_ONLY_CLASS,
    settings.density === 'comfortable' && CLOCK_DATE_COMFORTABLE_CLASS
  )
}
