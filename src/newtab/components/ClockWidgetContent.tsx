import type { NewTabTimeSettings } from '../time-settings'
import {
  CLOCK_PERIOD_CLASS,
  CLOCK_TIME_GROUP_CLASS,
  getClockDateClass,
  getClockTimeClass
} from './clockClasses'

export interface ClockWidgetState {
  ariaLabel: string
  dateDateTime: string
  dateText: string
  periodText: string
  settings: NewTabTimeSettings
  timeDateTime: string
  timeText: string
}

export function ClockWidgetContent({ state }: { state: ClockWidgetState }) {
  const { settings } = state

  return (
    <>
      {settings.displayMode !== 'date' ? (
        <span className={CLOCK_TIME_GROUP_CLASS}>
          <time className={getClockTimeClass(settings)} data-clock-time="true" dateTime={state.timeDateTime}>
            {state.timeText}
          </time>
          {settings.hour12 ? (
            <span className={CLOCK_PERIOD_CLASS} data-clock-period="true">
              {state.periodText}
            </span>
          ) : null}
        </span>
      ) : null}
      {settings.displayMode !== 'time' ? (
        <time className={getClockDateClass(settings)} data-clock-date="true" dateTime={state.dateDateTime}>
          {state.dateText}
        </time>
      ) : null}
    </>
  )
}
