import type { NewTabTimeSettings } from '../time-settings'

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
        <span className="newtab-clock-time-group">
          <time className="newtab-clock-time" data-clock-time="true" dateTime={state.timeDateTime}>
            {state.timeText}
          </time>
          {settings.hour12 ? (
            <span className="newtab-clock-period" data-clock-period="true">
              {state.periodText}
            </span>
          ) : null}
        </span>
      ) : null}
      {settings.displayMode !== 'time' ? (
        <time className="newtab-clock-date" data-clock-date="true" dateTime={state.dateDateTime}>
          {state.dateText}
        </time>
      ) : null}
    </>
  )
}
